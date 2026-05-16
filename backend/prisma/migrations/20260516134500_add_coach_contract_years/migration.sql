ALTER TABLE "Coach" ADD COLUMN "contractYearsLeft" INTEGER NOT NULL DEFAULT 3;

UPDATE "Coach"
SET "contractYearsLeft" = CASE
  WHEN "teamId" IS NULL THEN 1
  WHEN "role" = 'HEAD_COACH' THEN 4
  ELSE 3
END;
