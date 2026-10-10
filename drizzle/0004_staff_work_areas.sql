ALTER TABLE restaurant_members
  ADD COLUMN IF NOT EXISTS work_area text;

ALTER TABLE team_invites
  ADD COLUMN IF NOT EXISTS work_area text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_members_work_area_ck'
  ) THEN
    ALTER TABLE restaurant_members
      ADD CONSTRAINT restaurant_members_work_area_ck
      CHECK (work_area IS NULL OR work_area IN ('waiter', 'kitchen'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_invites_work_area_ck'
  ) THEN
    ALTER TABLE team_invites
      ADD CONSTRAINT team_invites_work_area_ck
      CHECK (work_area IS NULL OR work_area IN ('waiter', 'kitchen'));
  END IF;
END
$$;
