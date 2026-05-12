-- DropForeignKey
ALTER TABLE "Coach" DROP CONSTRAINT "Coach_teamId_fkey";

-- AlterTable
ALTER TABLE "LeagueSeasonHistory" ADD COLUMN     "awards" JSONB,
ADD COLUMN     "playoffBracket" JSONB;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "playoffRound" TEXT;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
