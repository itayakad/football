import { prisma } from '../db';
import { computeStandings, TeamRecord } from './standings';
import { isCoachPosition } from './personnel';

export interface FinalizeSeasonResult {
  season: number;
  leagues: Array<{
    leagueId: string;
    leagueName: string;
    tier: number;
    championTeamName: string;
    mvpPlayerName: string | null;
  }>;
}

export async function finalizeCurrentSeason(): Promise<FinalizeSeasonResult> {
  const remaining = await prisma.match.count({ where: { played: false } });
  if (remaining > 0) throw new Error(`Season has ${remaining} unplayed matches`);

  const season = await nextSeasonNumber();
  const seasonHistory = await prisma.seasonHistory.create({ data: { season } });
  const leagues = await prisma.league.findMany({
    include: { teams: { include: { personnel: true } } },
    orderBy: { tier: 'asc' },
  });

  const result: FinalizeSeasonResult = { season, leagues: [] };

  for (const league of leagues) {
    const played = await prisma.match.findMany({
      where: { leagueId: league.id, played: true },
      include: { homeTeam: true, awayTeam: true },
    });
    const standings = computeStandings(played, league.teams.map((team) => ({ id: team.id, name: team.name })));
    const champion = standings[0];
    const mvp = chooseMvp(standings, league.teams);
    const biggestGame = played.length > 0
      ? played.reduce((best, match) => {
          const bestMargin = Math.abs(best.homeScore - best.awayScore);
          const matchMargin = Math.abs(match.homeScore - match.awayScore);
          return matchMargin > bestMargin ? match : best;
        })
      : null;

    await prisma.leagueSeasonHistory.create({
      data: {
        seasonHistoryId: seasonHistory.id,
        season,
        leagueId: league.id,
        leagueName: league.name,
        tier: league.tier,
        championTeamId: champion.teamId,
        championTeamName: champion.teamName,
        mvpPlayerId: mvp?.id,
        mvpPlayerName: mvp?.name,
        mvpTeamName: mvp?.teamName,
        biggestGame: biggestGame
          ? `${biggestGame.homeTeam.name} ${biggestGame.homeScore}-${biggestGame.awayScore} ${biggestGame.awayTeam.name}`
          : null,
        standings: standings as any,
      },
    });

    await Promise.all(standings.map((row, index) =>
      prisma.teamSeasonHistory.create({
        data: {
          seasonHistoryId: seasonHistory.id,
          season,
          teamId: row.teamId,
          teamName: row.teamName,
          leagueName: league.name,
          tier: league.tier,
          rank: index + 1,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          pointsFor: row.pointsFor,
          pointsAgainst: row.pointsAgainst,
          diff: row.diff,
          resultLabel: resultLabel(index + 1, standings.length, league.tier),
        },
      })
    ));

    result.leagues.push({
      leagueId: league.id,
      leagueName: league.name,
      tier: league.tier,
      championTeamName: champion.teamName,
      mvpPlayerName: mvp?.name ?? null,
    });
  }

  return result;
}

async function nextSeasonNumber(): Promise<number> {
  const last = await prisma.seasonHistory.findFirst({ orderBy: { season: 'desc' } });
  return (last?.season ?? 0) + 1;
}

function chooseMvp(
  standings: TeamRecord[],
  teams: Array<{ id: string; name: string; personnel: Array<{ id: string; name: string; position: string; overall: number; age: number }> }>,
) {
  const rankByTeam = new Map(standings.map((row, index) => [row.teamId, index + 1]));
  const candidates = teams.flatMap((team) =>
    team.personnel
      .filter((p) => !isCoachPosition(p.position))
      .map((player) => ({
        ...player,
        teamId: team.id,
        teamName: team.name,
        score: player.overall * 1.8 +
          (player.position === 'QB' ? 8 : ['WR', 'RB', 'DE', 'CB'].includes(player.position) ? 4 : 0) +
          (9 - (rankByTeam.get(team.id) ?? 8)) * 2,
      }))
  );
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function resultLabel(rank: number, total: number, tier: number): string {
  if (rank <= 3 && tier !== 1) return 'Promoted';
  if (rank === 1) return 'Top Seed';
  if (rank <= 6) return 'Playoff Appearance';
  if (rank > total - 3) return tier === 3 ? 'Bottom Tier' : 'Relegation Danger';
  return 'Mid-table';
}
