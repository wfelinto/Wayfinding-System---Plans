-- Fixes a missing/incomplete RLS policy on fa_sign_types (and
-- reapplies the others defensively) — safe to run even if some of
-- these already exist correctly.

alter table fa_projects enable row level security;
alter table fa_sign_types enable row level security;
alter table fa_venues enable row level security;
alter table fa_requests enable row level security;
alter table profiles enable row level security;

drop policy if exists "Authenticated only - fa_projects" on fa_projects;
create policy "Authenticated only - fa_projects" on fa_projects for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated only - fa_sign_types" on fa_sign_types;
create policy "Authenticated only - fa_sign_types" on fa_sign_types for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated only - fa_venues" on fa_venues;
create policy "Authenticated only - fa_venues" on fa_venues for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated only - fa_requests" on fa_requests;
create policy "Authenticated only - fa_requests" on fa_requests for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated can read profiles" on profiles;
create policy "Authenticated can read profiles" on profiles for select to authenticated using (true);

NOTIFY pgrst, 'reload schema';
