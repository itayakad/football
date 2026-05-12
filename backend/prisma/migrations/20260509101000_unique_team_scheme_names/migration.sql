DELETE FROM "TeamScheme" t
USING "TeamScheme" dup
WHERE t."teamId" = dup."teamId"
  AND t."unit" = dup."unit"
  AND t."name" = dup."name"
  AND t.id > dup.id;

CREATE UNIQUE INDEX "TeamScheme_teamId_unit_name_key" ON "TeamScheme"("teamId", "unit", "name");
