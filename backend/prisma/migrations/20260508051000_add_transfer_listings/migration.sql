-- CreateTable
CREATE TABLE "TransferListing" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sellerTeamId" TEXT NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferListing_playerId_key" ON "TransferListing"("playerId");

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_sellerTeamId_fkey" FOREIGN KEY ("sellerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
