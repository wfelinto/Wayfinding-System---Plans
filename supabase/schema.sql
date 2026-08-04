-- Wayfinding scoping tool: database schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- This is the full schema for a fresh install. If you already ran an
-- earlier version, use the migration_*.sql files instead.

create extension if not exists "pgcrypto";

-- A project groups every plan for one job (e.g. one airport, one campus).
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- A plan is one uploaded floor plan (image, or a PDF rendered to an
-- image on upload), belonging to a project.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  file_path text not null,        -- path inside the "plans" storage bucket
  floor_label text,
  scale_ratio numeric,            -- real-world units per pixel, optional for now
  created_at timestamptz default now()
);

-- The KOP: your reusable library of sign types and what each one can hold.
-- Lives independently of any single project so it can be reused, and is
-- added to manually from the Sign types (KOP) page. Created before
-- decision_points since that table references it.
create table if not exists sign_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_messages integer not null,
  max_chars_per_line integer,
  supports_pictogram boolean default true,
  mounting text,                  -- "wall", "ceiling", "freestanding"
  notes text,
  created_at timestamptz default now()
);

-- Decision points sit along a route: a junction, lobby, or intersection
-- where a wayfinding decision needs to be made, and where a sign gets
-- placed. Points are linked in sequence to form the drawn route via
-- route_segments. Each point IS a sign, and carries everything needed to
-- scope it:
--   - sign_code: auto-assigned "Sign N" on creation, editable afterward.
--     This is the first column in the schedule/CSV.
--   - location: free text describing where the sign physically sits.
--   - functional_area: free text, its own cell in the export.
--   - messages: free text, one message per line — all lines together
--     form the single "Messages" cell in the export.
--   - status: an approval-workflow stage, see the fixed list in the app.
--   - sign_type_id: manually chosen from the KOP (sign_types), rather
--     than left purely to automatic suggestion.
--   - image_path: an optional reference photo, stored in the
--     "dot-images" bucket.
create table if not exists decision_points (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  x numeric not null,             -- stored as % of image width (0-100)
  y numeric not null,             -- stored as % of image height (0-100)
  label text,
  sign_code text,
  location text,
  functional_area text,
  messages text,
  needs_pictogram boolean default false,
  status text default 'Draft',
  sign_type_id uuid references sign_types(id),
  image_path text,
  sequence_order integer,         -- order in which the point was placed on its route
  created_at timestamptz default now()
);

-- A route segment is a single line connecting two consecutive decision
-- points, drawn automatically as points are placed in order.
create table if not exists route_segments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  from_point uuid references decision_points(id) on delete cascade,
  to_point uuid references decision_points(id) on delete cascade,
  created_at timestamptz default now()
);

-- A location of interest: a room, department, or destination reachable
-- from a decision point. Sign content lives on the decision point, not
-- here — this is purely for wayfinding/routing context.
create table if not exists pois (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  decision_point_id uuid references decision_points(id) on delete set null,
  name text not null,
  x numeric,
  y numeric,
  created_at timestamptz default now()
);

-- --- Row Level Security -----------------------------------------------
-- Enabled with permissive "allow all" policies for now, since this is a
-- test/internal-scoping tool with no end-user accounts yet. Before this
-- becomes anything client-facing, replace these with policies scoped to
-- an authenticated user or organization.

alter table projects enable row level security;
alter table plans enable row level security;
alter table decision_points enable row level security;
alter table route_segments enable row level security;
alter table pois enable row level security;
alter table sign_types enable row level security;

create policy "Allow all - projects" on projects for all using (true) with check (true);
create policy "Allow all - plans" on plans for all using (true) with check (true);
create policy "Allow all - decision_points" on decision_points for all using (true) with check (true);
create policy "Allow all - route_segments" on route_segments for all using (true) with check (true);
create policy "Allow all - pois" on pois for all using (true) with check (true);
create policy "Allow all - sign_types" on sign_types for all using (true) with check (true);

-- --- Storage ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('plans', 'plans', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dot-images', 'dot-images', true)
on conflict (id) do nothing;

create policy "Allow all - plans bucket read" on storage.objects
  for select using (bucket_id = 'plans');
create policy "Allow all - plans bucket write" on storage.objects
  for insert with check (bucket_id = 'plans');

create policy "Allow all - dot-images bucket read" on storage.objects
  for select using (bucket_id = 'dot-images');
create policy "Allow all - dot-images bucket write" on storage.objects
  for insert with check (bucket_id = 'dot-images');
