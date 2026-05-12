CREATE TYPE "OffensivePhilosophy" AS ENUM (
  'WEST_COAST',
  'VERTICAL_SPREAD',
  'SMASHMOUTH',
  'RPO_HEAVY',
  'QUICK_GAME',
  'PLAY_ACTION_HEAVY'
);

ALTER TABLE "Team"
ADD COLUMN "offensivePhilosophy" "OffensivePhilosophy" NOT NULL DEFAULT 'WEST_COAST';

UPDATE "Team"
SET "offensivePhilosophy" = CASE
  WHEN "offenseStyle" = 'PASS_HEAVY' THEN 'VERTICAL_SPREAD'::"OffensivePhilosophy"
  WHEN "offenseStyle" = 'RUN_HEAVY' THEN 'SMASHMOUTH'::"OffensivePhilosophy"
  ELSE 'WEST_COAST'::"OffensivePhilosophy"
END;
