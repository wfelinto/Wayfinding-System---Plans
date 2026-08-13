-- Catch-up migration: safely (re-)adds every decision_points column the
-- app currently expects. Safe to run even if some of these already exist
-- — "add column if not exists" skips anything already present.

alter table decision_points add column if not exists functional_area text;
alter table decision_points add column if not exists messages text;
alter table decision_points add column if not exists needs_pictogram boolean default false;
alter table decision_points add column if not exists sign_code text;
alter table decision_points add column if not exists location text;
alter table decision_points add column if not exists status text default 'Draft';
alter table decision_points add column if not exists image_path text;
alter table decision_points add column if not exists comments text;
alter table decision_points add column if not exists message_slots jsonb default '[]'::jsonb;

-- sign_type_id needs sign_types to exist first, which it should already.
alter table decision_points add column if not exists sign_type_id uuid references sign_types(id);

-- Also make sure projects/plans linkage is in place.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
alter table plans add column if not exists project_id uuid references projects(id) on delete cascade;

-- Force Supabase's API layer to pick up all of the above immediately.
NOTIFY pgrst, 'reload schema';
