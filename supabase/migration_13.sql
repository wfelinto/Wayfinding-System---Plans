-- Migration 13: Functional Areas master list, FA info per Venue linkage,
-- Orientation/Priority/design-quantity fields, computed Total
-- Quantity/Price, and a unique auto-numbered request ID.

-- Master list of Functional Areas per FA project — feeds the dropdown
-- on requests and on FA info per Venue.
create table if not exists fa_functional_areas (
  id uuid primary key default gen_random_uuid(),
  fa_project_id uuid references fa_projects(id) on delete cascade,
  name text not null,
  acronym text,
  created_at timestamptz default now()
);

alter table fa_functional_areas enable row level security;
create policy "Authenticated only - fa_functional_areas" on fa_functional_areas
  for all to authenticated using (true) with check (true);

-- Each "FA info per Venue" row now also tags which Functional Area it's
-- for, so a request's chosen Venue carries its own delivery/focal point
-- details specific to that Venue + Functional Area combination.
alter table fa_venues add column if not exists functional_area_id uuid references fa_functional_areas(id);

-- New request fields.
alter table fa_requests add column if not exists orientation text;
alter table fa_requests add column if not exists priority text;
alter table fa_requests add column if not exists quantity_of_designs text;
alter table fa_requests add column if not exists quantity_per_design text;
alter table fa_requests add column if not exists total_quantity numeric;
alter table fa_requests add column if not exists total_price numeric;

-- Auto-generated, globally unique per submission — bigserial assigns
-- this automatically on insert, no application logic needed.
alter table fa_requests add column if not exists request_number bigserial;

NOTIFY pgrst, 'reload schema';
