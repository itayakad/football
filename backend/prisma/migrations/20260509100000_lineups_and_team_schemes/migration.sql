ALTER TABLE "Player" ADD COLUMN "depthOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "Player"
SET "depthOrder" = ranked.rank
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "teamId", position
    ORDER BY overall DESC, age ASC, id ASC
  ) - 1 AS rank
  FROM "Player"
) ranked
WHERE "Player".id = ranked.id;

CREATE TABLE "TeamScheme" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "plays" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamScheme_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamScheme_teamId_unit_idx" ON "TeamScheme"("teamId", "unit");

ALTER TABLE "TeamScheme"
ADD CONSTRAINT "TeamScheme_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
