-- Backfill coach staffs for existing seeded worlds.
INSERT INTO "Coach" (
  "id", "name", "role", "philosophy", "developmentSpecialty", "aggression",
  "moraleImpact", "preferredTempo", "reputation", "hotSeat", "age", "teamId"
)
SELECT
  'hc_' || "id",
  split_part("name", ' ', 1) || ' HC',
  'HEAD_COACH',
  CASE
    WHEN "offenseStyle" = 'RUN_HEAVY' THEN 'Old-School Builder'
    WHEN "offenseStyle" = 'PASS_HEAVY' THEN 'Modern Shot-Caller'
    ELSE 'Program Stabilizer'
  END,
  CASE
    WHEN "offenseStyle" = 'PASS_HEAVY' THEN 'QB'
    WHEN "offenseStyle" = 'RUN_HEAVY' THEN 'OL'
    ELSE 'Skill'
  END,
  CASE WHEN "defenseStyle" = 'AGGRESSIVE' THEN 78 ELSE 52 END,
  4,
  "tempo",
  62,
  22,
  49,
  "id"
FROM "Team";

INSERT INTO "Coach" (
  "id", "name", "role", "philosophy", "developmentSpecialty", "aggression",
  "moraleImpact", "preferredTempo", "reputation", "hotSeat", "age", "teamId"
)
SELECT
  'oc_' || "id",
  split_part("name", ' ', 1) || ' OC',
  'OC',
  CASE
    WHEN "offenseStyle" = 'RUN_HEAVY' THEN 'Ground Game Designer'
    WHEN "offenseStyle" = 'PASS_HEAVY' THEN 'Vertical Architect'
    ELSE 'Balanced Playcaller'
  END,
  CASE
    WHEN "offenseStyle" = 'PASS_HEAVY' THEN 'QB'
    WHEN "offenseStyle" = 'RUN_HEAVY' THEN 'OL'
    ELSE 'Skill'
  END,
  CASE WHEN "offenseStyle" = 'PASS_HEAVY' THEN 82 ELSE 48 END,
  3,
  "tempo",
  56,
  18,
  43,
  "id"
FROM "Team";

INSERT INTO "Coach" (
  "id", "name", "role", "philosophy", "developmentSpecialty", "aggression",
  "moraleImpact", "preferredTempo", "reputation", "hotSeat", "age", "teamId"
)
SELECT
  'dc_' || "id",
  split_part("name", ' ', 1) || ' DC',
  'DC',
  CASE
    WHEN "defenseStyle" = 'AGGRESSIVE' THEN 'Pressure Merchant'
    WHEN "defenseStyle" = 'PREVENT' THEN 'Coverage Professor'
    ELSE 'Flexible Defender'
  END,
  CASE
    WHEN "defenseStyle" = 'PREVENT' THEN 'Secondary'
    WHEN "defenseStyle" = 'AGGRESSIVE' THEN 'DL'
    ELSE 'LB'
  END,
  CASE WHEN "defenseStyle" = 'AGGRESSIVE' THEN 86 ELSE 46 END,
  2,
  "tempo",
  56,
  18,
  44,
  "id"
FROM "Team";
