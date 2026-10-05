-- VISIONGUARD operational schema.
-- Demo mode does not use this database. Production access is through Supabase Auth and RLS.
-- Never put the service-role key in a VITE_ variable or in frontend code.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('manager', 'inspector', 'report_collector')),
  name_ar text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null unique,
  role_code text not null references public.roles (code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  region text not null,
  facility_type text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  code text not null unique,
  name text not null,
  equipment_type text not null check (equipment_type in ('tank', 'pipeline', 'valve', 'pump', 'tower', 'industrial')),
  status text not null default 'active' check (status in ('active', 'out_of_service')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  map_x double precision not null,
  map_y double precision not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  marker_state text not null check (marker_state in ('NORMAL', 'WARNING', 'CRITICAL', 'INSPECTED')),
  inspection_status text not null,
  last_inspection_at timestamptz,
  next_inspection_at date,
  last_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  facility_id uuid not null references public.facilities (id),
  location_id uuid not null references public.inspection_locations (id),
  equipment_id uuid not null references public.equipment (id),
  inspector_id uuid references public.users (id),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  due_date date not null,
  status text not null check (status in ('new', 'scheduled', 'in_progress', 'pending_review', 'completed', 'cancelled')),
  workflow_stage text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  task_id uuid not null references public.inspection_tasks (id),
  facility_id uuid not null references public.facilities (id),
  location_id uuid not null references public.inspection_locations (id),
  equipment_id uuid not null references public.equipment (id),
  inspector_id uuid not null references public.users (id),
  result text not null check (result in ('pass', 'warning', 'fail', 'pending')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null check (status in ('in_progress', 'pending_review', 'completed', 'cancelled')),
  workflow_stage text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  summary text not null default '',
  clearance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_checklists (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections (id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.inspection_checklists (id) on delete cascade,
  item_key text not null,
  label text not null,
  response text check (response in ('pass', 'warning', 'fail', 'not_applicable')),
  numeric_value double precision,
  unit text,
  notes text not null default '',
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

create table public.ai_analysis_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  provider text not null,
  is_demo boolean not null default true,
  summary text not null,
  created_at timestamptz not null default now()
);

create table public.inspection_images (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  equipment_id uuid not null references public.equipment (id),
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  caption text not null default '',
  captured_at timestamptz not null,
  media_type text not null check (media_type in ('image', 'video')),
  source text not null check (source in ('LIVE', 'IMPORTED', 'SIMULATION', 'UNAVAILABLE')),
  comparison_group text,
  comparison_role text not null check (comparison_role in ('before', 'after', 'single')),
  playback text not null check (playback in ('available', 'unavailable')),
  created_at timestamptz not null default now()
);

create table public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  analysis_id uuid references public.ai_analysis_results (id),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  equipment_id uuid not null references public.equipment (id),
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence double precision not null,
  status text not null check (status in ('open', 'approved', 'rejected', 'extra_inspection', 'maintenance')),
  summary text not null,
  image_id uuid references public.inspection_images (id),
  is_demo boolean not null default true,
  detected_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid references public.inspection_findings (id) on delete cascade,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  reviewer_id uuid not null references public.users (id),
  decision text not null check (decision in ('approve', 'reject', 'extra_inspection', 'maintenance', 'note')),
  notes text not null,
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  inspection_id uuid not null references public.inspections (id),
  facility_id uuid not null references public.facilities (id),
  location_id uuid not null references public.inspection_locations (id),
  inspector_id uuid not null references public.users (id),
  revision integer not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null check (status in ('new', 'in_review', 'completed', 'needs_completion', 'archived')),
  snapshot jsonb not null,
  completion_note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_id, revision)
);

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  inspection_id uuid not null references public.inspections (id),
  description text not null,
  status text not null check (status in ('open', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  device_type text not null check (device_type in ('drone', 'robot', 'camera', 'temperature_sensor', 'gas_sensor', 'other_sensor')),
  status text not null,
  facility_id uuid not null references public.facilities (id),
  last_communication_at timestamptz,
  battery_percent double precision,
  latitude double precision,
  longitude double precision,
  temperature_c double precision,
  altitude_m double precision,
  speed_mps double precision,
  source text not null check (source in ('LIVE', 'IMPORTED', 'SIMULATION', 'UNAVAILABLE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telemetry_records (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  latitude double precision,
  longitude double precision,
  temperature_c double precision,
  altitude_m double precision,
  speed_mps double precision,
  battery_percent double precision,
  source text not null check (source in ('LIVE', 'IMPORTED', 'SIMULATION', 'UNAVAILABLE')),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  message text not null,
  actor_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index inspection_tasks_status_idx on public.inspection_tasks (status);
create index inspection_tasks_due_idx on public.inspection_tasks (due_date);
create index inspection_tasks_inspector_idx on public.inspection_tasks (inspector_id);
create index inspection_tasks_facility_idx on public.inspection_tasks (facility_id);
create index inspections_status_idx on public.inspections (status);
create index inspections_equipment_idx on public.inspections (equipment_id);
create index inspections_inspector_idx on public.inspections (inspector_id);
create index findings_status_idx on public.inspection_findings (status);
create index findings_inspection_idx on public.inspection_findings (inspection_id);
create index reports_status_idx on public.reports (status);
create index reports_facility_idx on public.reports (facility_id);
create index locations_facility_idx on public.inspection_locations (facility_id);
create index locations_marker_idx on public.inspection_locations (marker_state);
create index telemetry_device_idx on public.telemetry_records (device_id, recorded_at desc);
create index activity_entity_idx on public.activity_logs (entity_type, entity_id, created_at desc);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role_code from public.users where auth_user_id = auth.uid() and is_active limit 1
$$;

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.auth_user_id = auth.uid() and new.role_code is distinct from old.role_code then
    raise exception 'لا يمكن للمستخدم تغيير دوره';
  end if;
  return new;
end;
$$;

create trigger users_role_guard before update on public.users
for each row execute function public.prevent_self_role_change();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles', 'users', 'facilities', 'zones', 'equipment', 'inspection_locations', 'inspection_tasks',
    'inspections', 'inspection_checklists', 'reports', 'corrective_actions', 'devices', 'inspection_findings'
  ]
  loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.facilities enable row level security;
alter table public.zones enable row level security;
alter table public.equipment enable row level security;
alter table public.inspection_locations enable row level security;
alter table public.inspection_tasks enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_checklists enable row level security;
alter table public.inspection_checklist_items enable row level security;
alter table public.ai_analysis_results enable row level security;
alter table public.inspection_images enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.human_reviews enable row level security;
alter table public.observations enable row level security;
alter table public.reports enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.devices enable row level security;
alter table public.telemetry_records enable row level security;
alter table public.activity_logs enable row level security;

-- Active staff can read. Anonymous users cannot.
create policy roles_read on public.roles for select to authenticated using (public.current_app_role() is not null);
create policy users_read on public.users for select to authenticated using (public.current_app_role() is not null);
create policy facilities_read on public.facilities for select to authenticated using (public.current_app_role() is not null);
create policy zones_read on public.zones for select to authenticated using (public.current_app_role() is not null);
create policy equipment_read on public.equipment for select to authenticated using (public.current_app_role() is not null);
create policy locations_read on public.inspection_locations for select to authenticated using (public.current_app_role() is not null);
create policy tasks_read on public.inspection_tasks for select to authenticated using (public.current_app_role() is not null);
create policy inspections_read on public.inspections for select to authenticated using (public.current_app_role() is not null);
create policy checklists_read on public.inspection_checklists for select to authenticated using (public.current_app_role() is not null);
create policy checklist_items_read on public.inspection_checklist_items for select to authenticated using (public.current_app_role() is not null);
create policy analysis_read on public.ai_analysis_results for select to authenticated using (public.current_app_role() is not null);
create policy images_read on public.inspection_images for select to authenticated using (public.current_app_role() is not null);
create policy findings_read on public.inspection_findings for select to authenticated using (public.current_app_role() is not null);
create policy reviews_read on public.human_reviews for select to authenticated using (public.current_app_role() is not null);
create policy observations_read on public.observations for select to authenticated using (public.current_app_role() is not null);
create policy reports_read on public.reports for select to authenticated using (public.current_app_role() is not null);
create policy actions_read on public.corrective_actions for select to authenticated using (public.current_app_role() is not null);
create policy devices_read on public.devices for select to authenticated using (public.current_app_role() is not null);
create policy telemetry_read on public.telemetry_records for select to authenticated using (public.current_app_role() is not null);
create policy activity_read on public.activity_logs for select to authenticated using (public.current_app_role() is not null);

create policy facilities_write on public.facilities for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy zones_write on public.zones for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy equipment_write on public.equipment for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy locations_write on public.inspection_locations for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy tasks_write on public.inspection_tasks for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy users_write on public.users for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');

create policy inspections_write on public.inspections for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy checklists_write on public.inspection_checklists for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy checklist_items_write on public.inspection_checklist_items for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy images_write on public.inspection_images for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy findings_write on public.inspection_findings for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy analysis_write on public.ai_analysis_results for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy reviews_write on public.human_reviews for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));
create policy observations_write on public.observations for all to authenticated
  using (public.current_app_role() in ('manager', 'inspector')) with check (public.current_app_role() in ('manager', 'inspector'));

create policy reports_write on public.reports for all to authenticated
  using (public.current_app_role() in ('manager', 'report_collector')) with check (public.current_app_role() in ('manager', 'report_collector'));
create policy actions_write on public.corrective_actions for all to authenticated
  using (public.current_app_role() in ('manager', 'report_collector')) with check (public.current_app_role() in ('manager', 'report_collector'));

create policy devices_write on public.devices for all to authenticated
  using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');
create policy telemetry_write on public.telemetry_records for insert to authenticated
  with check (public.current_app_role() in ('manager', 'inspector'));
create policy activity_write on public.activity_logs for insert to authenticated
  with check (public.current_app_role() is not null);

insert into storage.buckets (id, name, public)
values
  ('inspection-media', 'inspection-media', false),
  ('inspection-videos', 'inspection-videos', false),
  ('report-attachments', 'report-attachments', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

create policy media_read on storage.objects for select to authenticated
  using (bucket_id in ('inspection-media', 'inspection-videos', 'report-attachments', 'documents') and public.current_app_role() is not null);
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id in ('inspection-media', 'inspection-videos', 'report-attachments', 'documents') and public.current_app_role() is not null);
create policy media_update on storage.objects for update to authenticated
  using (bucket_id in ('inspection-media', 'inspection-videos', 'report-attachments', 'documents') and public.current_app_role() in ('manager', 'inspector', 'report_collector'));

-- Object paths:
-- inspection-media/{facility_id}/{inspection_id}/{file}
-- inspection-videos/{facility_id}/{inspection_id}/{file}
-- report-attachments/{facility_id}/{report_id}/{file}
-- documents/{facility_id}/{file}
