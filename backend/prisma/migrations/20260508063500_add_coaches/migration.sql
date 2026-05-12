-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "philosophy" TEXT NOT NULL,
    "developmentSpecialty" TEXT NOT NULL,
    "aggression" INTEGER NOT NULL,
    "moraleImpact" INTEGER NOT NULL,
    "preferredTempo" "Tempo" NOT NULL,
    "reputation" INTEGER NOT NULL,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "titles" INTEGER NOT NULL DEFAULT 0,
    "hotSeat" INTEGER NOT NULL DEFAULT 20,
    "yearsWithTeam" INTEGER NOT NULL DEFAULT 1,
    "age" INTEGER NOT NULL DEFAULT 48,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
