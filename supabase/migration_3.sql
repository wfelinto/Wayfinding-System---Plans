-- Migration 3: projects (grouping multiple plans), sign codes, per-sign
-- location and approval status, manual sign type selection, and photos
-- attached to each decision point.
-- Run this once in the Supabase SQL Editor, after migration_2.sql.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table plans add column if not exists project_id uuid references projects(id) on delete cascade;

alter table decision_points add column if not exists sign_code text;
alter table decision_points add column if not exists location text;
alter table decision_points add column if not exists status text default 'Draft';
alter table decision_points add column if not exists sign_type_id uuid references sign_types(id);
alter table decision_points add column if not exists image_path text;

alter table projects enable row level security;
create policy "Allow all - projects" on projects for all using (true) with check (true);

-- Storage bucket for per-sign photos.
insert into storage.buckets (id, name, public)
values ('dot-images', 'dot-images', true)
on conflict (id) do nothing;

create policy "Allow all - dot-images bucket read" on storage.objects
  for select using (bucket_id = 'dot-images');
create policy "Allow all - dot-images bucket write" on storage.objects
  for insert with check (bucket_id = 'dot-images');

-- Your existing test plan(s) won't belong to a project yet. Either leave
-- them (they just won't show up on the new projects landing page until
-- assigned) or run something like this after creating a project:
--   update plans set project_id = 'YOUR-PROJECT-ID-HERE' where project_id is null;
