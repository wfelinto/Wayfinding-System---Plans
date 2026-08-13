-- Migration 6: an Artwork photo field alongside the existing Photo field.
alter table decision_points add column if not exists artwork_path text;
NOTIFY pgrst, 'reload schema';
