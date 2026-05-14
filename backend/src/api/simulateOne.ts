import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile, MatchSimResult } from '../simulation/matchEngine';
import { Gameplan, normalizeGameplan } from '../simulation/gameplan';
import { chooseAIGameplan } from '../simulation/aiCoach';
import { normalizePlayLoadout } from '../simulation/playLibrary';
import { generateMatchFeed, FeedEvent } from './feedGenerator';
import { advanceOffseason, OffseasonResult } from '../simulation/offseason';

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
  QB: 1, RB: 2, WR: 3, TE: 1, OL: 5, DE: 2, DT: 2, LB: 3, CB: 3, S: 2,
};

function activeDepthPlayers<T extends { id: string; position: string; overall: number; depthOrder?: number | null }>(players: T[]): T[] {
  const sorted = [...players].sort((a, b) =>
    a.position.localeCompare(b.position) ||
    (a.depthOrder ?? 999) - (b.depthOrder ?? 999) ||
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

export async function simulateSingleMatch(
  matchId:      string,
  userTeamId?:  string,
  userGameplan?: Gameplan,
): Promise<SingleMatchResult> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { players: true, coaches: true } },
      awayTeam: { include: { players: true, coaches: true } },
    },
  });

  if (!match)        throw new Error('Match not found');
  if (match.played)  throw new Error('Match already played');

  const home: TeamMatchProfile = {
    id:       match.homeTeamId,
    name:     match.homeTeam.name,
    coaches:  match.homeTeam.coaches,
    players:  activeDepthPlayers(match.homeTeam.players),
    offensivePlays: normalizePlayLoadout('offense', match.homeTeam.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', match.homeTeam.defensivePlays),
  };

  const away: TeamMatchProfile = {
    id:       match.awayTeamId,
    name:     match.awayTeam.name,
    coaches:  match.awayTeam.coaches,
    players:  activeDepthPlayers(match.awayTeam.players),
    offensivePlays: normalizePlayLoadout('offense', match.awayTeam.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', match.awayTeam.defensivePlays),
  };

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

  const events = generateMatchFeed(
    { name: match.homeTeam.name, side: 'home', topPlayers: pickTopPlayers(match.homeTeam.players) },
    { name: match.awayTeam.name, side: 'away', topPlayers: pickTopPlayers(match.awayTeam.players) },
    result,
  );

  // Fire-and-forget: simulate other week games in the background so the
  // response returns to the frontend immediately.
  simulateRestOfWeek(match.week, matchId).catch((err) =>
    console.error('[simulateRestOfWeek] background error:', err),
  );

  // Season-advance check: run after a short yield so background work can
  // settle, but still within the same request for simplicity.
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
      homeTeam: { include: { players: true, coaches: true } },
      awayTeam: { include: { players: true, coaches: true } },
    },
  });

  // Simulate all remaining games in parallel — no need to block on each other.
  await Promise.all(others.map(async (m) => {
    const home: TeamMatchProfile = {
      id:       m.homeTeamId,
      name:     m.homeTeam.name,
      coaches:  m.homeTeam.coaches,
      players:  activeDepthPlayers(m.homeTeam.players),
      offensivePlays: normalizePlayLoadout('offense', m.homeTeam.offensivePlays),
      defensivePlays: normalizePlayLoadout('defense', m.homeTeam.defensivePlays),
    };
    const away: TeamMatchProfile = {
      id:       m.awayTeamId,
      name:     m.awayTeam.name,
      coaches:  m.awayTeam.coaches,
      players:  activeDepthPlayers(m.awayTeam.players),
      offensivePlays: normalizePlayLoadout('offense', m.awayTeam.offensivePlays),
      defensivePlays: normalizePlayLoadout('defense', m.awayTeam.defensivePlays),
    };
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
