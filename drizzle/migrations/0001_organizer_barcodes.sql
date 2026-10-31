CREATE TABLE public.barcodes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 section text NOT NULL CHECK (section IN ('problem_1','problem_2','problem_3','problem_4','application','ai_assistant')),
 image_path text NOT NULL UNIQUE,
 original_name text NOT NULL,
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.barcodes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barcodes TO authenticated;
GRANT ALL ON public.barcodes TO service_role;
ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published barcode reads" ON public.barcodes FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY "Organizer barcode reads" ON public.barcodes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizer barcode inserts" ON public.barcodes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizer barcode updates" ON public.barcodes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizer barcode deletes" ON public.barcodes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Published barcode images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'event-barcodes' AND EXISTS (SELECT 1 FROM public.barcodes b WHERE b.image_path = name AND b.published));
CREATE POLICY "Organizer image reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'event-barcodes' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizer image uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-barcodes' AND public.has_role(auth.uid(), 'admin') AND lower(storage.extension(name)) IN ('png','jpg','jpeg'));
CREATE POLICY "Organizer image deletes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-barcodes' AND public.has_role(auth.uid(), 'admin'));
REVOKE INSERT ON public.submissions FROM anon, authenticated;
COMMENT ON TABLE public.submissions IS 'DEPRECATED: participant project submissions retired; organizer barcode management replaces the workflow.';