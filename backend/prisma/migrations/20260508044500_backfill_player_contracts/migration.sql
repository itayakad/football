-- Backfill existing seeded players that received the default contract values
-- when pressure-system columns were added.
UPDATE "Player"
SET
  "salary" = GREATEST(
    700000,
    ROUND((350000 + "overall" * "overall" * 420 + CASE
      WHEN "age" BETWEEN 27 AND 31 THEN 250000
      WHEN "age" >= 32 THEN -150000
      ELSE 0
    END) / 100000.0) * 100000
  )::INTEGER,
  "contractYearsLeft" = 1 + (ASCII(SUBSTRING("id", LENGTH("id"), 1)) % 4),
  "extensionEligible" = ("age" >= 27 OR "overall" >= 82)
WHERE "salary" = 2500000
  AND "contractYearsLeft" = 2
  AND "extensionEligible" = false;
