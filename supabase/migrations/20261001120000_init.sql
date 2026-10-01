-- VISIONGUARD schema for Supabase / PostgreSQL.
-- Apply with the Supabase CLI. Do not put the service-role key in the browser.

create extension if not exists pgcrypto;

create table public.roles (
  id uuid primary key,
  code text not null unique,
  name_ar text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role_code text not null references public.roles (code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key,
  code text not null unique,
  name text not null,
  description text,
  facility_type text not null,
  status text not null check (status in ('active', 'inactive', 'archived')),
  address text,
  latitude double precision,
  longitude double precision,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);

create table public.sectors (
  id uuid primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code)
);

create table public.inspection_zones (
  id uuid primary key,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  sector_id uuid not null references public.sectors (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  risk_level text not null check (risk_level in ('normal', 'medium', 'high')),
  hazard_categories text[] not null default '{}',
  human_access text not null check (human_access in ('allowed', 'restricted', 'prohibited')),
  recommended_method text not null,
  required_ppe text[] not null default '{}',
  safety_notes text,
  boundary jsonb not null default '{"points":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  sector_id uuid references public.sectors (id),
  zone_id uuid references public.inspection_zones (id),
  code text not null,
  name text not null,
  equipment_type text not null,
  status text not null,
  risk_level text not null,
  position_x double precision,
  position_y double precision,
  description text,
  last_inspection_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);

create table public.inspection_templates (
  id uuid primary key,
  name text not null,
  category text not null,
  description text,
  scoring_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_template_items (
  id uuid primary key,
  template_id uuid not null references public.inspection_templates (id) on delete cascade,
  category text not null,
  label text not null,
  response_type text not null,
  weight numeric not null default 1,
  critical boolean not null default false,
  sort_order integer not null,
  numeric_unit text,
  numeric_min numeric,
  numeric_max numeric,
  created_at timestamptz not null default now()
);

create table public.sensor_thresholds (
  id uuid primary key,
  sensor_code text not null,
  measurement_type text not null,
  substance text,
  unit text not null,
  min_value numeric,
  max_value numeric,
  label text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.drones (
  id uuid primary key,
  code text not null unique,
  name text not null,
  model text not null,
  manufacturer text not null,
  camera_capable boolean not null default true,
  resolution text,
  battery_capacity_mah integer not null,
  current_battery numeric not null,
  signal_quality numeric,
  operational_status text not null,
  availability text not null,
  current_mission_id uuid,
  last_maintenance_at timestamptz,
  total_flight_minutes numeric not null default 0,
  position_label text,
  last_position jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.robots (
  id uuid primary key,
  code text not null unique,
  name text not null,
  robot_type text not null,
  model text not null,
  manufacturer text not null,
  sensors text[] not null default '{}',
  battery_capacity_mah integer not null,
  current_battery numeric not null,
  operational_status text not null,
  availability text not null,
  current_mission_id uuid,
  location_label text,
  last_maintenance_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key,
  code text not null unique,
  facility_id uuid not null references public.facilities (id),
  site_id uuid not null references public.sites (id),
  sector_id uuid not null references public.sectors (id),
  zone_id uuid not null references public.inspection_zones (id),
  equipment_id uuid references public.equipment (id),
  inspection_type text not null,
  risk_level text not null,
  method text not null,
  template_id uuid not null references public.inspection_templates (id),
  assigned_inspector_id uuid references public.profiles (id),
  planned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null,
  notes text,
  risk_acknowledgement text,
  created_by uuid references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_assignments (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id),
  role_in_inspection text not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id)
);

create table public.inspection_checklists (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  template_id uuid not null references public.inspection_templates (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_checklist_items (
  id uuid primary key,
  checklist_id uuid not null references public.inspection_checklists (id) on delete cascade,
  template_item_id uuid references public.inspection_template_items (id),
  category text not null,
  label text not null,
  response text,
  numeric_value numeric,
  notes text,
  severity text,
  weight numeric not null,
  critical boolean not null default false,
  response_type text not null,
  numeric_unit text,
  sort_order integer not null,
  evidence_media_id uuid,
  updated_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key,
  code text not null unique,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  sector_id uuid not null references public.sectors (id),
  zone_id uuid not null references public.inspection_zones (id),
  device_kind text,
  device_id uuid,
  inspector_id uuid references public.profiles (id),
  risk_level text not null,
  mission_type text not null,
  status text not null,
  progress numeric not null default 0,
  stage integer not null default 1,
  is_simulation boolean not null default true,
  safety_prerequisites jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_events (
  id uuid primary key,
  mission_id uuid not null references public.missions (id) on delete cascade,
  event_type text not null,
  message text not null,
  from_status text,
  to_status text,
  stage integer,
  origin text not null,
  metadata jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.telemetry_records (
  id uuid primary key,
  mission_id uuid not null references public.missions (id) on delete cascade,
  device_id uuid,
  device_kind text,
  altitude_m numeric,
  speed_mps numeric,
  battery_percent numeric,
  signal_quality numeric,
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz not null,
  source text not null,
  quality text not null,
  created_at timestamptz not null default now()
);

create table public.sensor_readings (
  id uuid primary key,
  mission_id uuid references public.missions (id) on delete cascade,
  sensor_code text not null,
  measurement_type text not null,
  numeric_value numeric,
  unit text not null,
  text_value text,
  recorded_at timestamptz not null,
  source text not null,
  quality text not null,
  threshold_id uuid references public.sensor_thresholds (id),
  created_at timestamptz not null default now()
);

create table public.inspection_points (
  id uuid primary key,
  code text not null unique,
  mission_id uuid references public.missions (id) on delete set null,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  equipment_id uuid references public.equipment (id),
  zone_id uuid references public.inspection_zones (id),
  location_label text,
  category text not null,
  description text not null,
  severity text not null,
  source text not null,
  confidence numeric,
  review_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_observations (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  point_id uuid references public.inspection_points (id) on delete set null,
  mission_id uuid references public.missions (id) on delete set null,
  category text not null,
  description text not null,
  severity text not null,
  source text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.inspection_decisions (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  point_id uuid references public.inspection_points (id) on delete set null,
  observation_id uuid references public.inspection_observations (id) on delete set null,
  action text not null,
  notes text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.inspection_media (
  id uuid primary key,
  inspection_id uuid references public.inspections (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete set null,
  point_id uuid references public.inspection_points (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  caption text,
  captured_at timestamptz not null,
  source text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key,
  code text not null unique,
  category text not null,
  severity text not null,
  message text not null,
  facility_id uuid references public.facilities (id),
  device_id uuid,
  device_kind text,
  mission_id uuid references public.missions (id) on delete set null,
  inspection_id uuid references public.inspections (id) on delete set null,
  read_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id),
  resolution_status text not null,
  assigned_user_id uuid references public.profiles (id),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_reports (
  id uuid primary key,
  code text not null unique,
  inspection_id uuid not null references public.inspections (id),
  revision integer not null,
  status text not null check (status = 'final'),
  snapshot jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (inspection_id, revision)
);

create table public.inspection_report_items (
  id uuid primary key,
  report_id uuid not null references public.inspection_reports (id) on delete cascade,
  category text not null,
  label text not null,
  response text,
  score numeric,
  notes text,
  sort_order integer not null
);

create table public.maintenance_records (
  id uuid primary key,
  device_id uuid not null,
  device_kind text not null,
  description text not null,
  status text not null,
  performed_at timestamptz,
  next_due_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_table text not null,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.code_sequences (
  id text primary key,
  value integer not null
);

create table public.settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create index inspections_facility_status_idx on public.inspections (facility_id, status);
create index inspections_inspector_idx on public.inspections (assigned_inspector_id);
create index missions_inspection_idx on public.missions (inspection_id, status);
create index missions_device_idx on public.missions (device_id);
create index alerts_status_idx on public.alerts (resolution_status, created_at desc);
create index telemetry_mission_idx on public.telemetry_records (mission_id, recorded_at desc);
create index audit_target_idx on public.audit_logs (target_table, target_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles','facilities','sites','sectors','inspection_zones','equipment','inspection_templates',
    'inspections','inspection_checklists','inspection_checklist_items','missions','drones','robots',
    'inspection_points','alerts','settings'
  ]
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;

create or replace function public.has_role(allowed text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role_code = any (allowed)
  );
$$;

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role_code = 'ADMIN' and is_active);
$$;

create or replace function public.bootstrap_first_admin()
returns void language plpgsql security definer set search_path = public as $$
declare
  existing integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  select count(*) into existing from public.profiles where role_code = 'ADMIN';
  if existing > 0 then
    raise exception 'administrator already exists';
  end if;
  insert into public.profiles (id, full_name, email, role_code)
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', 'Administrator'), u.email, 'ADMIN'
  from auth.users u where u.id = auth.uid();
end $$;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role_code is distinct from old.role_code or new.is_active is distinct from old.is_active)
     and not public.has_role(array['ADMIN']) then
    raise exception 'only an administrator can change role or activation';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
for each row execute function public.protect_profile_role();

grant usage on schema public to anon, authenticated;
grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.bootstrap_first_admin() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.facilities enable row level security;
alter table public.sites enable row level security;
alter table public.sectors enable row level security;
alter table public.inspection_zones enable row level security;
alter table public.equipment enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.sensor_thresholds enable row level security;
alter table public.drones enable row level security;
alter table public.robots enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_assignments enable row level security;
alter table public.inspection_checklists enable row level security;
alter table public.inspection_checklist_items enable row level security;
alter table public.missions enable row level security;
alter table public.mission_events enable row level security;
alter table public.telemetry_records enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.inspection_points enable row level security;
alter table public.inspection_observations enable row level security;
alter table public.inspection_decisions enable row level security;
alter table public.inspection_media enable row level security;
alter table public.alerts enable row level security;
alter table public.inspection_reports enable row level security;
alter table public.inspection_report_items enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.code_sequences enable row level security;
alter table public.settings enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create policy roles_read on public.roles for select to authenticated using (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(array['ADMIN']));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(array['ADMIN'])) with check (id = auth.uid() or public.has_role(array['ADMIN']));

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'facilities','sites','sectors','inspection_zones','equipment','inspection_templates','inspection_template_items',
    'sensor_thresholds','drones','robots','inspections','inspection_assignments','inspection_checklists','inspection_checklist_items',
    'missions','mission_events','telemetry_records','sensor_readings','inspection_points','inspection_observations','inspection_decisions',
    'inspection_media','alerts','inspection_reports','inspection_report_items','maintenance_records','audit_logs','code_sequences','settings'
  ]
  loop
    execute format('create policy %I_read on public.%I for select to authenticated using (public.has_role(array[''ADMIN'',''INSPECTOR'',''OPERATOR'']))', tbl, tbl);
  end loop;
end $$;

create policy facilities_write on public.facilities for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy sites_write on public.sites for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy sectors_write on public.sectors for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy zones_write on public.inspection_zones for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy equipment_write on public.equipment for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy templates_write on public.inspection_templates for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy template_items_write on public.inspection_template_items for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy thresholds_write on public.sensor_thresholds for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy drones_write on public.drones for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy robots_write on public.robots for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy settings_write on public.settings for all to authenticated using (public.has_role(array['ADMIN'])) with check (public.has_role(array['ADMIN']));
create policy inspections_write on public.inspections for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR'])) with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy assignments_write on public.inspection_assignments for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy checklists_write on public.inspection_checklists for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR'])) with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy checklist_items_write on public.inspection_checklist_items for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR'])) with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy missions_write on public.missions for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR','OPERATOR'])) with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy events_write on public.mission_events for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy telemetry_write on public.telemetry_records for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy readings_write on public.sensor_readings for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy points_write on public.inspection_points for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR','OPERATOR'])) with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy observations_write on public.inspection_observations for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy decisions_write on public.inspection_decisions for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy media_write on public.inspection_media for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy alerts_write on public.alerts for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR','OPERATOR'])) with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));
create policy reports_write on public.inspection_reports for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy report_items_write on public.inspection_report_items for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy maintenance_write on public.maintenance_records for insert to authenticated with check (public.has_role(array['ADMIN','INSPECTOR']));
create policy audit_write on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());
create policy sequences_write on public.code_sequences for all to authenticated using (public.has_role(array['ADMIN','INSPECTOR','OPERATOR'])) with check (public.has_role(array['ADMIN','INSPECTOR','OPERATOR']));

insert into public.roles (id, code, name_ar, description) values
  ('10000000-0000-4000-8000-0000000000a1', 'ADMIN', 'مدير النظام', 'إدارة المستخدمين والمنشآت والقوالب والأجهزة.'),
  ('10000000-0000-4000-8000-0000000000a2', 'INSPECTOR', 'مفتش', 'تنفيذ التفتيش والمراجعة وإصدار التقارير.'),
  ('10000000-0000-4000-8000-0000000000a3', 'OPERATOR', 'مشغّل', 'متابعة المهام والأجهزة والتنبيهات.')
on conflict (code) do nothing;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('inspection-media', 'inspection-media', false),
           ('reports', 'reports', false),
           ('facility-docs', 'facility-docs', false)
    on conflict (id) do nothing;
    execute 'create policy inspection_media_read on storage.objects for select to authenticated using (bucket_id in (''inspection-media'',''reports'',''facility-docs''))';
    execute 'create policy inspection_media_write on storage.objects for insert to authenticated with check (bucket_id in (''inspection-media'',''reports'',''facility-docs''))';
  end if;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.missions;
  alter publication supabase_realtime add table public.mission_events;
  alter publication supabase_realtime add table public.telemetry_records;
  alter publication supabase_realtime add table public.alerts;
exception when undefined_object or duplicate_object then
  null;
end $$;
