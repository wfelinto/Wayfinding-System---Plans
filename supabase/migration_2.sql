-- Migration: consolidate sign content onto the decision point itself.
-- Run this once in the Supabase SQL Editor, after the original schema.sql.
--
-- After this, each decision point (dot) has:
--   - functional_area: free text (its own CSV column)
--   - messages: free text, one message per line (its own CSV column)
--   - needs_pictogram: checkbox
--
-- The old "messages" table and per-POI functional_area are no longer used
-- by the app. This migration leaves them in place (nothing is deleted)
-- rather than dropping them, in case you had existing data in them —
-- drop them yourself later once you've confirmed you don't need it.

alter table decision_points add column if not exists functional_area text;
alter table decision_points add column if not exists messages text;
alter table decision_points add column if not exists needs_pictogram boolean default false;
