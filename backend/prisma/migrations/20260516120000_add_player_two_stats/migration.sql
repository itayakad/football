-- Add the two stored attributes that drive overall. Each player has exactly
-- two stats; their average is the displayed overall.
ALTER TABLE "Player" ADD COLUMN "statHigh" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Player" ADD COLUMN "statLow"  INTEGER NOT NULL DEFAULT 60;

-- Backfill existing rows so statHigh/statLow average to the current overall.
UPDATE "Player" SET "statHigh" = "overall", "statLow" = "overall";
