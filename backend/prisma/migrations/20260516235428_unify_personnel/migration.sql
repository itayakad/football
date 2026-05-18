/*
  Warnings:

  - You are about to drop the `Coach` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TradeHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransferListing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransferOffer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Coach" DROP CONSTRAINT "Coach_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TransferListing" DROP CONSTRAINT "TransferListing_playerId_fkey";

-- DropForeignKey
ALTER TABLE "TransferListing" DROP CONSTRAINT "TransferListing_sellerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TransferOffer" DROP CONSTRAINT "TransferOffer_buyerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TransferOffer" DROP CONSTRAINT "TransferOffer_listingId_fkey";

-- DropTable
DROP TABLE "Coach";

-- DropTable
DROP TABLE "Player";

-- DropTable
DROP TABLE "TradeHistory";

-- DropTable
DROP TABLE "TransferListing";

-- DropTable
DROP TABLE "TransferOffer";

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "overall" INTEGER NOT NULL DEFAULT 60,
    "stat1" INTEGER NOT NULL DEFAULT 60,
    "stat2" INTEGER NOT NULL DEFAULT 60,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "titles" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL DEFAULT 2700000,
    "contractYearsLeft" INTEGER NOT NULL DEFAULT 4,
    "age" INTEGER NOT NULL DEFAULT 25,
    "yearsWithTeam" INTEGER NOT NULL DEFAULT 1,
    "teamId" TEXT,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Personnel_teamId_position_idx" ON "Personnel"("teamId", "position");

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
