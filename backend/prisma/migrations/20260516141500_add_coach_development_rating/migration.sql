ALTER TABLE "Coach" ADD COLUMN "developmentRating" INTEGER NOT NULL DEFAULT 60;

UPDATE "Coach"
SET "developmentRating" = CASE
  WHEN "role" = 'OC' THEN "offenseRating"
  WHEN "role" = 'DC' THEN "defenseRating"
  ELSE round(("offenseRating" + "defenseRating") / 2.0)::INTEGER
END;

UPDATE "Coach"
SET "overall" = CASE
  WHEN "role" = 'OC' THEN round(("offenseRating" + "developmentRating") / 2.0)::INTEGER
  WHEN "role" = 'DC' THEN round(("defenseRating" + "developmentRating") / 2.0)::INTEGER
  ELSE round(("offenseRating" + "defenseRating") / 2.0)::INTEGER
END;
