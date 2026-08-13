-- Migration 10: per-project glossary of terms, keyed by a stable
-- external ID (the "ID" column in the uploaded Excel) so re-uploading
-- an updated glossary with the same IDs updates existing terms in place
-- — including everywhere they're already used on signs — rather than
-- creating duplicates.

create table if not exists glossary_terms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  external_id integer not null,
  term_en text not null,
  term_es text,
  term_fr text,
  term_pt text,
  created_at timestamptz default now(),
  unique (project_id, external_id)
);

alter table glossary_terms enable row level security;
create policy "Authenticated only - glossary_terms" on glossary_terms
  for all to authenticated using (true) with check (true);

NOTIFY pgrst, 'reload schema';
