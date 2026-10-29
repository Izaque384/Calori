ALTER TABLE "restaurant_members"
  DROP CONSTRAINT IF EXISTS "restaurant_members_work_area_ck";

ALTER TABLE "team_invites"
  DROP CONSTRAINT IF EXISTS "team_invites_work_area_ck";

ALTER TABLE "restaurant_members"
  DROP COLUMN IF EXISTS "work_area";

ALTER TABLE "team_invites"
  DROP COLUMN IF EXISTS "work_area";
