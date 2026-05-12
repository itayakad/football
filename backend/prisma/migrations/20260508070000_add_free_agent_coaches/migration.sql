-- Allow coaches to exist as free-agent candidates.
ALTER TABLE "Coach" ALTER COLUMN "teamId" DROP NOT NULL;
