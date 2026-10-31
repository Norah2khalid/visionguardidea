CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.review_status AS ENUM ('new','in_review','reviewed');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- First signed-in account claims admin only if no admin exists yet
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(auth.uid(), 'admin');
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_name text NOT NULL,
  email text NOT NULL,
  project_name text NOT NULL,
  challenge text NOT NULL CHECK (challenge IN ('challenge_1','challenge_2')),
  project_description text NOT NULL,
  project_url text NOT NULL,
  presentation_url text,
  status public.review_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.submissions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit" ON public.submissions FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
CREATE POLICY "Admins read" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.validate_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.participant_name := btrim(NEW.participant_name);
    NEW.email := lower(btrim(NEW.email));
    NEW.project_name := btrim(NEW.project_name);
    NEW.project_description := btrim(NEW.project_description);
    NEW.project_url := btrim(NEW.project_url);
    NEW.presentation_url := NULLIF(btrim(coalesce(NEW.presentation_url,'')),'');
    NEW.created_at := now();
    NEW.status := 'new';
    IF length(NEW.participant_name) < 2 OR length(NEW.participant_name) > 150 THEN RAISE EXCEPTION 'invalid_name'; END IF;
    IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(NEW.email) > 255 THEN RAISE EXCEPTION 'invalid_email'; END IF;
    IF length(NEW.project_name) < 2 OR length(NEW.project_name) > 200 THEN RAISE EXCEPTION 'invalid_project_name'; END IF;
    IF length(NEW.project_description) < 20 OR length(NEW.project_description) > 5000 THEN RAISE EXCEPTION 'invalid_description'; END IF;
    IF NEW.project_url !~* '^https?://[^\s/$.?#].[^\s]*$' OR length(NEW.project_url) > 2048 THEN RAISE EXCEPTION 'invalid_project_url'; END IF;
    IF NEW.presentation_url IS NOT NULL AND (NEW.presentation_url !~* '^https?://[^\s/$.?#].[^\s]*$' OR length(NEW.presentation_url) > 2048) THEN RAISE EXCEPTION 'invalid_presentation_url'; END IF;
  ELSE
    -- admins may only change status
    NEW.participant_name := OLD.participant_name; NEW.email := OLD.email; NEW.project_name := OLD.project_name;
    NEW.challenge := OLD.challenge; NEW.project_description := OLD.project_description; NEW.project_url := OLD.project_url;
    NEW.presentation_url := OLD.presentation_url; NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submissions_validate BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.validate_submission();