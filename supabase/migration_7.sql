-- Migration 7: Unit Cost (KOP), Mounting (per sign), and a Pictogram
-- library (like the KOP, but for pictogram images).

alter table sign_types add column if not exists unit_cost numeric;
alter table decision_points add column if not exists mounting text;

create table if not exists pictograms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_path text not null,
  created_at timestamptz default now()
);

alter table pictograms enable row level security;
create policy "Authenticated only - pictograms" on pictograms
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('pictograms', 'pictograms', true)
on conflict (id) do nothing;

create policy "Authenticated - pictograms bucket read" on storage.objects
  for select to authenticated using (bucket_id = 'pictograms');
create policy "Authenticated - pictograms bucket write" on storage.objects
  for insert to authenticated with check (bucket_id = 'pictograms');

NOTIFY pgrst, 'reload schema';
