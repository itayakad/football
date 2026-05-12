import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile, MatchSimResult } from '../simulation/matchEngine';
import { Gameplan, normalizeGameplan } from '../simulation/gameplan';
import { chooseAIGameplan } from '../simulation/aiCoach';
import { normalizePlayLoadout } from '../simulation/playLibrary';
import { generateMatchFeed, FeedEvent } from './feedGenerator';
import { buildPostMatchHealthUpdates } from '../simulation/playerHealth';
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
  moraleChange:   { home: number; away: number };
  injuryReport:   Array<{ playerId: string; playerName: string; teamId: string; status: string; type: string | null; weeks: number }>;
  seasonAdvance:  OffseasonResult | null;
}

const MORALE_SWING = 5;

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
  if (isUserHome && hasOutStarter(match.homeTeam.players)) throw new Error('Out starter must be subbed out');
  if (isUserAway && hasOutStarter(match.awayTeam.players)) throw new Error('Out starter must be subbed out');

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

  const moraleChange = await updateMoraleAfterMatch(match.homeTeamId, match.awayTeamId, result.homeScore, result.awayScore);
  const injuryReport = await updatePlayerHealthAfterMatch(
    { id: match.homeTeamId, offenseStyle: match.homeTeam.offenseStyle, defenseStyle: match.homeTeam.defenseStyle, tempo: match.homeTeam.tempo, players: match.homeTeam.players },
    { id: match.awayTeamId, offenseStyle: match.awayTeam.offenseStyle, defenseStyle: match.awayTeam.defenseStyle, tempo: match.awayTeam.tempo, players: match.awayTeam.players },
    homeGameplan,
    awayGameplan,
  );

  const events = generateMatchFeed(
    { name: match.homeTeam.name, side: 'home', topPlayers: pickTopPlayers(match.homeTeam.players) },
    { name: match.awayTeam.name, side: 'away', topPlayers: pickTopPlayers(match.awayTeam.players) },
    result,
  );

  await simulateRestOfWeek(match.week, matchId);

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
    moraleChange,
    injuryReport,
    seasonAdvance,
  };
}

function hasOutStarter(players: Array<{ id: string; position: string; overall: number; depthOrder?: number | null; injuryStatus?: string }>): boolean {
  return activeDepthPlayers(players).some((player) => player.injuryStatus === 'MULTI_WEEK');
}

async function simulateRestOfWeek(week: number, excludeMatchId: string): Promise<void> {
  const others = await prisma.match.findMany({
    where: { week, played: false, id: { not: excludeMatchId } },
    include: {
      homeTeam: { include: { players: true, coaches: true } },
      awayTeam: { include: { players: true, coaches: true } },
    },
  });

  for (const m of others) {
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

    await updateMoraleAfterMatch(m.homeTeamId, m.awayTeamId, r.homeScore, r.awayScore);
    await updatePlayerHealthAfterMatch(
      { id: m.homeTeamId, offenseStyle: m.homeTeam.offenseStyle, defenseStyle: m.homeTeam.defenseStyle, tempo: m.homeTeam.tempo, players: m.homeTeam.players },
      { id: m.awayTeamId, offenseStyle: m.awayTeam.offenseStyle, defenseStyle: m.awayTeam.defenseStyle, tempo: m.awayTeam.tempo, players: m.awayTeam.players },
      homeGameplan,
      awayGameplan,
    );
  }
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

async function updatePlayerHealthAfterMatch(
  home: { id: string; offenseStyle: string; defenseStyle: string; tempo: string; players: any[] },
  away: { id: string; offenseStyle: string; defenseStyle: string; tempo: string; players: any[] },
  homeGameplan: Gameplan,
  awayGameplan: Gameplan,
): Promise<Array<{ playerId: string; playerName: string; teamId: string; status: string; type: string | null; weeks: number }>> {
  const updates = [
    ...buildPostMatchHealthUpdates(home, homeGameplan).map((update) => ({ ...update, teamId: home.id, sourcePlayers: home.players })),
    ...buildPostMatchHealthUpdates(away, awayGameplan).map((update) => ({ ...update, teamId: away.id, sourcePlayers: away.players })),
  ];
  const report: Array<{ playerId: string; playerName: string; teamId: string; status: string; type: string | null; weeks: number }> = [];

  for (const update of updates) {
    const player = update.sourcePlayers.find((candidate) => candidate.id === update.playerId);
    const previousStatus = player?.injuryStatus ?? 'HEALTHY';
    await prisma.player.update({
      where: { id: update.playerId },
      data: {
        fatigue:      update.fatigue,
        injuryStatus: update.injuryStatus,
        injuryType:   update.injuryType,
        injuryWeeks:  update.injuryWeeks,
        conditioning: update.conditioning,
      },
    });

    if (update.injuryStatus !== 'HEALTHY' && update.injuryStatus !== previousStatus) {
      report.push({
        playerId:   update.playerId,
        playerName: player?.name ?? 'Unknown Player',
        teamId:     update.teamId,
        status:     update.injuryStatus,
        type:       update.injuryType,
        weeks:      update.injuryWeeks,
      });
    }
  }

  return report;
}

async function updateMoraleAfterMatch(
  homeId: string, awayId: string, homeScore: number, awayScore: number,
): Promise<{ home: number; away: number }> {
  let homeDelta = 0, awayDelta = 0;
  if (homeScore > awayScore)      { homeDelta = +MORALE_SWING; awayDelta = -MORALE_SWING; }
  else if (awayScore > homeScore) { awayDelta = +MORALE_SWING; homeDelta = -MORALE_SWING; }

  const teams = await prisma.team.findMany({
    where:  { id: { in: [homeId, awayId] } },
    select: { id: true, morale: true },
  });
  for (const t of teams) {
    const delta = t.id === homeId ? homeDelta : awayDelta;
    const newMorale = Math.max(0, Math.min(100, t.morale + delta));
    await prisma.team.update({ where: { id: t.id }, data: { morale: newMorale } });
  }

  return { home: homeDelta, away: awayDelta };
}
