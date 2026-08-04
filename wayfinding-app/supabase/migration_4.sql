-- Migration 4: comments field, structured message+arrow slots (replacing
-- the old free-text messages field), and drops the old "Add location"
-- workflow (pois/route_segments tables are left in place, just unused).
-- Run this once in the Supabase SQL Editor, after migration_3.sql.

alter table decision_points add column if not exists comments text;

-- Ten message slots, each { text, arrow }. Replaces the old free-text
-- "messages" column, which is left in place (unused) rather than dropped,
-- in case you want to recover anything from it.
alter table decision_points add column if not exists message_slots jsonb default '[]'::jsonb;
