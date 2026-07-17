ALTER TABLE "Match"
ADD COLUMN "liveState" JSONB,
ADD COLUMN "liveAutomation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "liveDeadlineAt" TIMESTAMP(3),
ADD COLUMN "liveRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MatchPlay" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "clock" TEXT NOT NULL,
    "offenseSide" TEXT NOT NULL,
    "offensePlayId" TEXT NOT NULL,
    "defensePlayId" TEXT NOT NULL,
    "action" TEXT,
    "down" INTEGER NOT NULL,
    "distance" INTEGER NOT NULL,
    "yardLine" INTEGER NOT NULL,
    "yards" INTEGER NOT NULL,
    "resultLabel" TEXT NOT NULL,
    "scoringEvent" TEXT,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "highlightPlayer" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPlay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchPlay_matchId_sequence_key" ON "MatchPlay"("matchId", "sequence");
CREATE INDEX "MatchPlay_matchId_createdAt_idx" ON "MatchPlay"("matchId", "createdAt");
ALTER TABLE "MatchPlay" ADD CONSTRAINT "MatchPlay_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
