-- Wayfinding scoping tool: database schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- A plan is one uploaded floor plan image/PDF page, with a scale
-- so pixel distances can be converted to real-world units later.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_path text not null,        -- path inside the "plans" storage bucket
  floor_label text,
  scale_ratio numeric,            -- real-world units per pixel, optional for now
  created_at timestamptz default now()
);

-- Decision points sit along a route: a junction, lobby, or intersection
-- where a wayfinding decision needs to be made. Points are linked in
-- sequence to form the drawn route via route_segments.
create table if not exists decision_points (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  x numeric not null,             -- stored as % of image width (0-100)
  y numeric not null,             -- stored as % of image height (0-100)
  label text,
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

-- A location of interest: a room, department, or destination.
-- Linked to the nearest decision point that leads to it.
create table if not exists pois (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  decision_point_id uuid references decision_points(id) on delete set null,
  name text not null,
  functional_area text,           -- e.g. "Parking", "Retail", "Emergency"
  x numeric,
  y numeric,
  created_at timestamptz default now()
);

-- A message is one line of sign content tied to a POI: the destination
-- name, direction, and whether it needs a pictogram.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid references pois(id) on delete cascade,
  text text not null,
  has_pictogram boolean default false,
  language text default 'en',
  priority integer default 1,     -- lower number = higher priority/hierarchy
  created_at timestamptz default now()
);

-- The KOP: your reusable library of sign types and what each one can hold.
-- Lives independently of any single project so it can be reused.
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

-- The output of the crosscheck engine: which sign type and which
-- messages were assigned to each decision point.
create table if not exists sign_assignments (
  id uuid primary key default gen_random_uuid(),
  decision_point_id uuid references decision_points(id) on delete cascade,
  sign_type_id uuid references sign_types(id),
  message_ids uuid[],
  status text default 'auto',     -- "auto", "manual", "conflict"
  reason text,
  created_at timestamptz default now()
);

-- --- Row Level Security -----------------------------------------------
-- Enabled with permissive "allow all" policies for now, since this is a
-- test/internal-scoping tool with no end-user accounts yet. Before this
-- becomes anything client-facing, replace these with policies scoped to
-- an authenticated user or organization.

alter table plans enable row level security;
alter table decision_points enable row level security;
alter table route_segments enable row level security;
alter table pois enable row level security;
alter table messages enable row level security;
alter table sign_types enable row level security;
alter table sign_assignments enable row level security;

create policy "Allow all - plans" on plans for all using (true) with check (true);
create policy "Allow all - decision_points" on decision_points for all using (true) with check (true);
create policy "Allow all - route_segments" on route_segments for all using (true) with check (true);
create policy "Allow all - pois" on pois for all using (true) with check (true);
create policy "Allow all - messages" on messages for all using (true) with check (true);
create policy "Allow all - sign_types" on sign_types for all using (true) with check (true);
create policy "Allow all - sign_assignments" on sign_assignments for all using (true) with check (true);

-- --- Storage ------------------------------------------------------------
-- Run this separately if the bucket doesn't already exist (or create it
-- from the Storage tab in the dashboard, as covered in the setup steps).
insert into storage.buckets (id, name, public)
values ('plans', 'plans', true)
on conflict (id) do nothing;

create policy "Allow all - plans bucket read" on storage.objects
  for select using (bucket_id = 'plans');
create policy "Allow all - plans bucket write" on storage.objects
  for insert with check (bucket_id = 'plans');
