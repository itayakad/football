ALTER TABLE "Coach" ADD COLUMN "salary" INTEGER NOT NULL DEFAULT 1500000;

UPDATE "Coach"
SET "salary" = (
  round((
    1500000
    + ("reputation" * "reputation" * 2200 * CASE WHEN "role" = 'HEAD_COACH' THEN 1.8 ELSE 1.0 END)
    + ("titles" * 850000)
  ) / 100000.0) * 100000
)::INTEGER;
