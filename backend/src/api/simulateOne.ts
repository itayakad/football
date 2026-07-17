import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile, MatchSimResult } from '../simulation/matchEngine';
import { Gameplan, normalizeGameplan } from '../simulation/gameplan';
import { chooseAIGameplan } from '../simulation/aiCoach';
import { normalizePlayLoadout } from '../simulation/playLibrary';
import { generateMatchFeed, FeedEvent } from './feedGenerator';
import { advanceOffseason, OffseasonResult } from '../simulation/offseason';
import { isCoachPosition } from '../simulation/personnel';

export interface SingleMatchResult {
  matchId:        string;
  homeScore:      number;
  awayScore:      number;
  homeTeamName:   string;
  awayTeamName:   string;
  homeGameplan:   Gameplan;
  awayGameplan:   Gameplan;
  narrative:      string;
  keyMatchup:     string;
  quarterScores:  Array<[number, number]>;
  events:         FeedEvent[];
  seasonAdvance:  OffseasonResult | null;
}

const STARTER_COUNTS_BY_POSITION: Record<string, number> = {
  QB: 1, RB: 2, WR: 2, TE: 1, OL: 5, DE: 2, DT: 2, LB: 3, CB: 3, S: 2,
};

function startersByOverall<T extends { id: string; position: string; overall: number }>(players: T[]): T[] {
  const sorted = [...players].sort((a, b) =>
    a.position.localeCompare(b.position) ||
    b.overall - a.overall
  );
  const counts: Record<string, number> = {};
  return sorted.filter((player) => {
    const limit = STARTER_COUNTS_BY_POSITION[player.position] ?? 0;
    if (limit === 0) return false;
    const used = counts[player.position] ?? 0;
    counts[player.position] = used + 1;
    return used < limit;
  });
}

export type TeamWithPersonnel = {
  id: string;
  name: string;
  offensivePlays: unknown;
  defensivePlays: unknown;
  personnel: Array<{ id: string; name: string; position: string; overall: number; stat1: number; stat2: number }>;
};

export function buildMatchProfile(team: TeamWithPersonnel): TeamMatchProfile {
  const coaches = team.personnel.filter((p) => isCoachPosition(p.position));
  const players = team.personnel.filter((p) => !isCoachPosition(p.position));
  return {
    id:       team.id,
    name:     team.name,
    coaches,
    players:  startersByOverall(players),
    offensivePlays: normalizePlayLoadout('offense', team.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', team.defensivePlays),
  };
}

export async function loadMatchProfiles(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { personnel: true, schemes: true } },
      awayTeam: { include: { personnel: true, schemes: true } },
    },
  });
  if (!match) throw new Error('Match not found');
  return {
    match,
    home: buildMatchProfile(match.homeTeam),
    away: buildMatchProfile(match.awayTeam),
  };
}

export async function finishInteractiveMatch(week: number, matchId: string): Promise<OffseasonResult | null> {
  await simulateRestOfWeek(week, matchId);
  const remaining = await prisma.match.count({ where: { played: false } });
  return remaining === 0 ? advanceOffseason() : null;
}

export async function simulateSingleMatch(
  matchId:      string,
  userTeamId?:  string,
  userGameplan?: Gameplan,
): Promise<SingleMatchResult> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { personnel: true } },
      awayTeam: { include: { personnel: true } },
    },
  });

  if (!match)        throw new Error('Match not found');
  if (match.played)  throw new Error('Match already played');

  const home = buildMatchProfile(match.homeTeam);
  const away = buildMatchProfile(match.awayTeam);

  const isUserHome = userTeamId === match.homeTeamId;
  const isUserAway = userTeamId === match.awayTeamId;

  const homeGameplan: Gameplan = isUserHome && userGameplan
    ? normalizeGameplan(userGameplan)
    : chooseAIGameplan(home);
  const awayGameplan: Gameplan = isUserAway && userGameplan
    ? normalizeGameplan(userGameplan)
    : chooseAIGameplan(away);

  const result: MatchSimResult = simulateMatch(home, away, match.week, homeGameplan, awayGameplan);

  await prisma.match.update({
    where: { id: matchId },
    data:  {
      homeScore:    result.homeScore,
      awayScore:    result.awayScore,
      played:       true,
      homeGameplan: homeGameplan as any,
      awayGameplan: awayGameplan as any,
    },
  });

  const homePlayers = match.homeTeam.personnel.filter((p) => !isCoachPosition(p.position));
  const awayPlayers = match.awayTeam.personnel.filter((p) => !isCoachPosition(p.position));
  const events = generateMatchFeed(
    { name: match.homeTeam.name, side: 'home', topPlayers: pickTopPlayers(homePlayers) },
    { name: match.awayTeam.name, side: 'away', topPlayers: pickTopPlayers(awayPlayers) },
    result,
  );

  simulateRestOfWeek(match.week, matchId).catch((err) =>
    console.error('[simulateRestOfWeek] background error:', err),
  );

  const remaining = await prisma.match.count({ where: { played: false } });
  const seasonAdvance = remaining === 0 ? await advanceOffseason() : null;

  return {
    matchId:       match.id,
    homeScore:     result.homeScore,
    awayScore:     result.awayScore,
    homeTeamName:  match.homeTeam.name,
    awayTeamName:  match.awayTeam.name,
    homeGameplan,
    awayGameplan,
    narrative:     result.narrative,
    keyMatchup:    result.keyMatchup,
    quarterScores: result.quarterScores,
    events,
    seasonAdvance,
  };
}

async function simulateRestOfWeek(week: number, excludeMatchId: string): Promise<void> {
  const others = await prisma.match.findMany({
    where: { week, played: false, id: { not: excludeMatchId } },
    include: {
      homeTeam: { include: { personnel: true } },
      awayTeam: { include: { personnel: true } },
    },
  });

  await Promise.all(others.map(async (m) => {
    const home = buildMatchProfile(m.homeTeam);
    const away = buildMatchProfile(m.awayTeam);
    const homeGameplan = chooseAIGameplan(home);
    const awayGameplan = chooseAIGameplan(away);
    const r = simulateMatch(home, away, m.week, homeGameplan, awayGameplan);

    await prisma.match.update({
      where: { id: m.id },
      data: {
        homeScore:    r.homeScore,
        awayScore:    r.awayScore,
        played:       true,
        homeGameplan: homeGameplan as any,
        awayGameplan: awayGameplan as any,
      },
    });
  }));
}

function pickTopPlayers(players: Array<{ name: string; position: string; overall: number }>) {
  const byOverall = [...players].sort((a, b) => b.overall - a.overall);
  const result = byOverall.slice(0, 5).map((p) => ({ name: p.name, position: p.position, overall: p.overall }));
  const fills = ['QB', 'RB', 'WR'];
  for (const pos of fills) {
    if (result.some((p) => p.position === pos)) continue;
    const best = byOverall.find((p) => p.position === pos);
    if (best) result.push({ name: best.name, position: best.position, overall: best.overall });
  }
  return result;
}
