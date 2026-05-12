import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile } from './matchEngine';
import { chooseAIGameplan } from './aiCoach';
import { normalizePlayLoadout } from './playLibrary';

export type PlayoffRound = 'WILD_CARD' | 'SEMI' | 'FINAL';

export interface PlayoffSeed {
  rank:     number;
  teamId:   string;
  teamName: string;
  record:   string;
}

export interface PlayoffMatchOutcome {
  matchId:      string;
  round:        PlayoffRound;
  homeTeamId:   string;
  homeTeamName: string;
  homeSeed:     number;
  awayTeamId:   string;
  awayTeamName: string;
  awaySeed:     number;
  homeScore:    number;
  awayScore:    number;
  winnerTeamId: string;
}

export interface LeaguePlayoffBracket {
  leagueId:         string;
  leagueName:       string;
  seeds:            PlayoffSeed[];
  wildCard:         PlayoffMatchOutcome[];
  semi:             PlayoffMatchOutcome[];
  final:            PlayoffMatchOutcome | null;
  championTeamId:   string | null;
  championTeamName: string | null;
}

const MORALE_SWING = 5;

interface SeededTeam {
  rank: number;
  teamId: string;
  teamName: string;
  record: string;
  team: TeamLike;
}

interface TeamLike {
  id: string;
  name: string;
  offensivePlays: unknown;
  defensivePlays: unknown;
  coaches: Array<{
    role: string;
    overall: number;
    offenseRating: number;
    defenseRating: number;
    reputation: number;
  }>;
  players: Array<{
    id: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
    age: number;
    morale: number;
    fatigue: number;
    injuryStatus: string;
    injuryType: string | null;
    injuryWeeks: number;
  }>;
}

export async function runLeaguePlayoffs(season: number, leagueId: string, leagueName: string): Promise<LeaguePlayoffBracket> {
  const top6Rows = await prisma.teamSeasonHistory.findMany({
    where: { season, team: { leagueId }, rank: { lte: 6 } },
    orderBy: { rank: 'asc' },
    include: { team: { include: { players: true, coaches: true } } },
  });

  if (top6Rows.length < 6) {
    throw new Error(`Playoffs need 6 teams; league ${leagueName} only has ${top6Rows.length} ranked teams`);
  }

  const seeded: SeededTeam[] = top6Rows.map((row) => ({
    rank:     row.rank,
    teamId:   row.teamId,
    teamName: row.teamName,
    record:   `${row.wins}-${row.losses}${row.ties > 0 ? `-${row.ties}` : ''}`,
    team:     row.team as unknown as TeamLike,
  }));

  const seeds: PlayoffSeed[] = seeded.map(({ rank, teamId, teamName, record }) => ({ rank, teamId, teamName, record }));

  // Wild card: seed 3 vs seed 6, seed 4 vs seed 5. Higher seed hosts.
  const wc1 = await playPlayoffMatch(seeded[2], seeded[5], leagueId, 'WILD_CARD', 15);
  const wc2 = await playPlayoffMatch(seeded[3], seeded[4], leagueId, 'WILD_CARD', 15);

  // Re-seed semis: seed 1 plays the lowest-seeded remaining winner; seed 2 plays the other.
  const winners = [wc1, wc2].map((m) => seeded.find((s) => s.teamId === m.winnerTeamId)!);
  const winnersByRank = [...winners].sort((a, b) => a.rank - b.rank);
  const higherSeedWinner = winnersByRank[0];
  const lowerSeedWinner = winnersByRank[winnersByRank.length - 1];

  const semi1 = await playPlayoffMatch(seeded[0], lowerSeedWinner, leagueId, 'SEMI', 16);
  const semi2 = await playPlayoffMatch(seeded[1], higherSeedWinner, leagueId, 'SEMI', 16);

  const finalists = [semi1, semi2].map((m) => seeded.find((s) => s.teamId === m.winnerTeamId)!);
  const [finalHome, finalAway] = finalists[0].rank <= finalists[1].rank ? finalists : [finalists[1], finalists[0]];
  const finalGame = await playPlayoffMatch(finalHome, finalAway, leagueId, 'FINAL', 17);

  const championTeam = seeded.find((s) => s.teamId === finalGame.winnerTeamId) ?? null;

  return {
    leagueId,
    leagueName,
    seeds,
    wildCard: [wc1, wc2],
    semi: [semi1, semi2],
    final: finalGame,
    championTeamId:   championTeam?.teamId   ?? null,
    championTeamName: championTeam?.teamName ?? null,
  };
}

async function playPlayoffMatch(
  home: SeededTeam,
  away: SeededTeam,
  leagueId: string,
  round: PlayoffRound,
  week: number,
): Promise<PlayoffMatchOutcome> {
  const homeProfile: TeamMatchProfile = {
    id:       home.team.id,
    name:     home.team.name,
    coaches:  home.team.coaches as any,
    players:  home.team.players,
    offensivePlays: normalizePlayLoadout('offense', home.team.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', home.team.defensivePlays),
  };
  const awayProfile: TeamMatchProfile = {
    id:       away.team.id,
    name:     away.team.name,
    coaches:  away.team.coaches as any,
    players:  away.team.players,
    offensivePlays: normalizePlayLoadout('offense', away.team.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', away.team.defensivePlays),
  };

  const homeGameplan = chooseAIGameplan(homeProfile);
  const awayGameplan = chooseAIGameplan(awayProfile);
  const result = simulateMatch(homeProfile, awayProfile, week, homeGameplan, awayGameplan);

  // Tied game: simulateMatch already breaks ties via OT, but if it ever comes back tied,
  // give home the win as a deterministic tiebreaker.
  let homeScore = result.homeScore;
  let awayScore = result.awayScore;
  if (homeScore === awayScore) homeScore += 1;

  const match = await prisma.match.create({
    data: {
      homeTeamId:   home.teamId,
      awayTeamId:   away.teamId,
      homeScore,
      awayScore,
      week,
      played:       true,
      leagueId,
      playoffRound: round,
      homeGameplan: homeGameplan as any,
      awayGameplan: awayGameplan as any,
    },
  });

  const winnerTeamId = homeScore > awayScore ? home.teamId : away.teamId;
  await applyPlayoffMorale(home.teamId, away.teamId, homeScore, awayScore);

  return {
    matchId:      match.id,
    round,
    homeTeamId:   home.teamId,
    homeTeamName: home.teamName,
    homeSeed:     home.rank,
    awayTeamId:   away.teamId,
    awayTeamName: away.teamName,
    awaySeed:     away.rank,
    homeScore,
    awayScore,
    winnerTeamId,
  };
}

async function applyPlayoffMorale(homeId: string, awayId: string, homeScore: number, awayScore: number): Promise<void> {
  const homeDelta = homeScore > awayScore ? +MORALE_SWING : -MORALE_SWING;
  const awayDelta = -homeDelta;
  const teams = await prisma.team.findMany({
    where: { id: { in: [homeId, awayId] } },
    select: { id: true, morale: true },
  });
  for (const t of teams) {
    const delta = t.id === homeId ? homeDelta : awayDelta;
    await prisma.team.update({
      where: { id: t.id },
      data: { morale: Math.max(0, Math.min(100, t.morale + delta)) },
    });
  }
}
