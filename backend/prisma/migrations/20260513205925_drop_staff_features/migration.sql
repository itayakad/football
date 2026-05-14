-- Remove support-staff coach rows (TRAINER / MEDICAL / RECRUITMENT) before dropping columns
DELETE FROM "Coach" WHERE role IN ('TRAINER', 'MEDICAL', 'RECRUITMENT');

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "trainWeek";
ALTER TABLE "Team" DROP COLUMN "healWeek";
ALTER TABLE "Team" DROP COLUMN "recruitWeek";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "fatigue";
ALTER TABLE "Player" DROP COLUMN "conditioning";
ALTER TABLE "Player" DROP COLUMN "injuryStatus";
ALTER TABLE "Player" DROP COLUMN "injuryType";
ALTER TABLE "Player" DROP COLUMN "injuryWeeks";
