-- Migration 5: restrict data access to logged-in users only.
--
-- Until now, every table used "allow all" policies, meaning anyone with
-- your public API key (visible in the app's front-end code) could read
-- and write data without logging in. This replaces those with policies
-- scoped to the "authenticated" role, so only users who have actually
-- signed in (via the app's new login page) can access anything.
--
-- Run this once in the Supabase SQL Editor, after creating at least one
-- user account (see the instructions that came with this migration).

drop policy if exists "Allow all - projects" on projects;
drop policy if exists "Allow all - plans" on plans;
drop policy if exists "Allow all - decision_points" on decision_points;
drop policy if exists "Allow all - route_segments" on route_segments;
drop policy if exists "Allow all - pois" on pois;
drop policy if exists "Allow all - sign_types" on sign_types;

create policy "Authenticated only - projects" on projects
  for all to authenticated using (true) with check (true);
create policy "Authenticated only - plans" on plans
  for all to authenticated using (true) with check (true);
create policy "Authenticated only - decision_points" on decision_points
  for all to authenticated using (true) with check (true);
create policy "Authenticated only - route_segments" on route_segments
  for all to authenticated using (true) with check (true);
create policy "Authenticated only - pois" on pois
  for all to authenticated using (true) with check (true);
create policy "Authenticated only - sign_types" on sign_types
  for all to authenticated using (true) with check (true);

NOTIFY pgrst, 'reload schema';
