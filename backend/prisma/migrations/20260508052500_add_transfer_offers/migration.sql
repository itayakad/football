-- CreateTable
CREATE TABLE "TransferOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerTeamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferOffer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "TransferListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_buyerTeamId_fkey" FOREIGN KEY ("buyerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
