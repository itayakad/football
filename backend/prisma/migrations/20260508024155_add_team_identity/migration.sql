-- CreateEnum
CREATE TYPE "OffenseStyle" AS ENUM ('RUN_HEAVY', 'BALANCED', 'PASS_HEAVY');

-- CreateEnum
CREATE TYPE "DefenseStyle" AS ENUM ('AGGRESSIVE', 'BALANCED', 'PREVENT');

-- CreateEnum
CREATE TYPE "Tempo" AS ENUM ('SLOW', 'NORMAL', 'FAST');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "defenseStyle" "DefenseStyle" NOT NULL DEFAULT 'BALANCED',
ADD COLUMN     "offenseStyle" "OffenseStyle" NOT NULL DEFAULT 'BALANCED',
ADD COLUMN     "tempo" "Tempo" NOT NULL DEFAULT 'NORMAL';
