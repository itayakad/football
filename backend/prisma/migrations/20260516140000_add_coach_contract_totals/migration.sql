ALTER TABLE "Coach" ADD COLUMN "contractTotalYears" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Coach" ADD COLUMN "contractTotalCost" INTEGER NOT NULL DEFAULT 4500000;

UPDATE "Coach"
SET
  "contractTotalYears" = "contractYearsLeft",
  "contractTotalCost" = "salary" * "contractYearsLeft";
