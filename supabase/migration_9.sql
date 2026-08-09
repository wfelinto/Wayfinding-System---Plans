-- Migration 9: distinguishes simple "dot" locations from full "sign"
-- points. Existing rows automatically become 'sign' (their prior
-- behavior), since that's the column default.

alter table decision_points add column if not exists point_type text default 'sign';

NOTIFY pgrst, 'reload schema';
