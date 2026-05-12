-- CreateTable
CREATE TABLE "RetirementHistory" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "story" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetirementHistory_pkey" PRIMARY KEY ("id")
);
