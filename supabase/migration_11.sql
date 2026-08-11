-- Migration 11: Sign Types (KOP) and Pictograms become project-scoped
-- instead of one shared global library.
--
-- Existing rows are left with project_id = NULL rather than reassigned,
-- and every query treats NULL as "visible in every project" — so
-- anything already in your KOP/pictogram library keeps working exactly
-- as before in every existing project. Only entries created going
-- forward (from within a specific project) are scoped to just that
-- project.

alter table sign_types add column if not exists project_id uuid references projects(id) on delete cascade;
alter table pictograms add column if not exists project_id uuid references projects(id) on delete cascade;

NOTIFY pgrst, 'reload schema';
