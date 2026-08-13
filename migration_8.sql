-- Migration 8: Sign Design on the KOP (drives marker shape), marker
-- rotation per sign, and drops reliance on the old needs_pictogram field.

alter table sign_types add column if not exists sign_design text;
alter table decision_points add column if not exists rotation numeric default 0;

NOTIFY pgrst, 'reload schema';
