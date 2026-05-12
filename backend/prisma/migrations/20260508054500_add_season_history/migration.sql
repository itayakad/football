-- CreateTable
CREATE TABLE "SeasonHistory" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSeasonHistory" (
    "id" TEXT NOT NULL,
    "seasonHistoryId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "championTeamId" TEXT NOT NULL,
    "championTeamName" TEXT NOT NULL,
    "mvpPlayerId" TEXT,
    "mvpPlayerName" TEXT,
    "mvpTeamName" TEXT,
    "biggestGame" TEXT,
    "standings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueSeasonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSeasonHistory" (
    "id" TEXT NOT NULL,
    "seasonHistoryId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "ties" INTEGER NOT NULL,
    "pointsFor" INTEGER NOT NULL,
    "pointsAgainst" INTEGER NOT NULL,
    "diff" INTEGER NOT NULL,
    "resultLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSeasonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeHistory" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "fromTeamName" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "toTeamName" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "story" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSeasonHistory_season_leagueId_key" ON "LeagueSeasonHistory"("season", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonHistory_season_teamId_key" ON "TeamSeasonHistory"("season", "teamId");

-- AddForeignKey
ALTER TABLE "LeagueSeasonHistory" ADD CONSTRAINT "LeagueSeasonHistory_seasonHistoryId_fkey" FOREIGN KEY ("seasonHistoryId") REFERENCES "SeasonHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueSeasonHistory" ADD CONSTRAINT "LeagueSeasonHistory_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonHistory" ADD CONSTRAINT "TeamSeasonHistory_seasonHistoryId_fkey" FOREIGN KEY ("seasonHistoryId") REFERENCES "SeasonHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonHistory" ADD CONSTRAINT "TeamSeasonHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
