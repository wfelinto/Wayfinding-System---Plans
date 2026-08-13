-- Migration 12: FA Signage module (parallel to Wayfinding projects) and
-- user roles/permissions.

-- FA Signage Projects
create table if not exists fa_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- FA Sign Types (KOP) — same fields as the Wayfinding KOP, plus physical
-- dimensions and a per-unit rate used to price requests.
create table if not exists fa_sign_types (
  id uuid primary key default gen_random_uuid(),
  fa_project_id uuid references fa_projects(id) on delete cascade,
  name text not null,
  max_messages integer default 1,
  max_chars_per_line integer,
  supports_pictogram boolean default true,
  mounting text,
  sign_design text,
  width numeric,
  height numeric,
  unit_cost numeric,
  notes text,
  created_at timestamptz default now()
);

-- Venues, feeding the Venue dropdown on requests (by acronym).
create table if not exists fa_venues (
  id uuid primary key default gen_random_uuid(),
  fa_project_id uuid references fa_projects(id) on delete cascade,
  name text not null,
  acronym text not null,
  city text,
  address text,
  delivery_point text,
  focal_point text,
  focal_point_email text,
  focal_point_phone text,
  created_at timestamptz default now()
);

-- One row per sign request — this is the "schedule".
create table if not exists fa_requests (
  id uuid primary key default gen_random_uuid(),
  fa_project_id uuid references fa_projects(id) on delete cascade,
  requester_name text,
  functional_area text,
  venue_id uuid references fa_venues(id) on delete set null,
  operations_start_date date,
  sign_type_id uuid references fa_sign_types(id) on delete set null,
  message text,
  languages jsonb default '[]'::jsonb,
  quantity integer default 1,
  total_cost numeric,
  comments text,
  approval_status text default 'In Progress',
  created_at timestamptz default now()
);

-- User roles and FA Signage approval permissions.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'user', -- 'admin' | 'user'
  fa_signage_approval boolean default false,
  fa_signage_approval_area text,
  created_at timestamptz default now()
);

alter table fa_projects enable row level security;
alter table fa_sign_types enable row level security;
alter table fa_venues enable row level security;
alter table fa_requests enable row level security;
alter table profiles enable row level security;

create policy "Authenticated only - fa_projects" on fa_projects for all to authenticated using (true) with check (true);
create policy "Authenticated only - fa_sign_types" on fa_sign_types for all to authenticated using (true) with check (true);
create policy "Authenticated only - fa_venues" on fa_venues for all to authenticated using (true) with check (true);
create policy "Authenticated only - fa_requests" on fa_requests for all to authenticated using (true) with check (true);

-- profiles is readable by any signed-in user (small trusted team, same
-- pattern as the rest of the app) but NOT directly writable from the
-- browser — every write goes through a server-side API route using the
-- service role key, which can enforce "only admins can do this."
create policy "Authenticated can read profiles" on profiles for select to authenticated using (true);

NOTIFY pgrst, 'reload schema';
