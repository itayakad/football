import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { prisma } from '../db';
import { computeStandings } from '../simulation/standings';
import { computePositionGroups } from '../simulation/positionGroups';
import { recommendGameplan } from '../simulation/aiCoach';
import { TeamMatchProfile } from '../simulation/matchEngine';
import { simulateSingleMatch } from './simulateOne';
import { Gameplan, normalizeGameplan } from '../simulation/gameplan';
import {
  allPlays,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  defaultLoadout,
  loadPlayCatalog,
  normalizePlayLoadout,
  PlayUnit,
  playById,
  playsForUnit,
} from '../simulation/playLibrary';
import { deriveTeamIdentity, TeamIdentity } from '../simulation/teamIdentity';
import { computeRecentForm } from './teamForm';
import { generateNewsFeed } from './newsGenerator';
import { finalizeCurrentSeason } from '../simulation/seasonHistory';
import { advanceOffseason } from '../simulation/offseason';
import {
  generateOverall,
  personnelSalary,
  randomName,
  randomCoachName,
  splitIntoStats,
  clampRating,
} from '../seed';
import {
  COACH_POSITIONS,
  PLAYER_POSITIONS,
  isCoachPosition,
  personnelArchetype,
  statLabels,
  idSeed,
} from '../simulation/personnel';

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors());
app.use(express.json());

// MVP: hardcoded user team. Real auth comes later — this lets us build the
// matchday vertical slice without an auth system in the way.
const USER_TEAM_NAME = process.env.USER_TEAM_NAME ?? 'Dallas Vanguard';
const OFFENSIVE_PHILOSOPHIES = ['WEST_COAST', 'VERTICAL_SPREAD', 'SMASHMOUTH', 'RPO_HEAVY', 'QUICK_GAME', 'PLAY_ACTION_HEAVY'];

type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  overall: number;
  stat1: number;
  stat2: number;
  age: number;
  salary?: number;
  contractYearsLeft?: number;
};

const POSITION_GROUPS: Array<{ key: string; label: string; positions: string[] }> = [
  { key: 'qb',        label: 'QB',            positions: ['QB'] },
  { key: 'skill',     label: 'Skill Players', positions: ['RB', 'WR', 'TE'] },
  { key: 'ol',        label: 'OL',            positions: ['OL'] },
  { key: 'dl',        label: 'DL',            positions: ['DE', 'DT'] },
  { key: 'lb',        label: 'LB',            positions: ['LB'] },
  { key: 'secondary', label: 'Secondary',     positions: ['CB', 'S'] },
];

const STARTER_COUNTS_BY_POSITION: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  OL: 5,
  DE: 2,
  DT: 2,
  LB: 3,
  CB: 2,
  S: 2,
};

function playerSeed(player: RosterPlayer): number {
  return idSeed(player.id);
}

type CoachPosition = 'HC' | 'OC' | 'DC';

function playerArchetype(player: RosterPlayer): string {
  return personnelArchetype(player);
}

function keyAttributes(p: { position: string; stat1: number; stat2: number }): Record<string, number> {
  const [label1, label2] = statLabels(p.position);
  return { [label1.toLowerCase()]: p.stat1, [label2.toLowerCase()]: p.stat2 };
}

function schemeFit(player: RosterPlayer, identity: TeamIdentity) {
  const archetype = playerArchetype(player);
  const offensive =
    (['PASS_HEAVY', 'VERTICAL'].includes(identity.offense) && ['QB', 'WR', 'TE', 'OL'].includes(player.position)) ||
    (identity.offense === 'RUN_HEAVY' && ['RB', 'TE', 'OL'].includes(player.position));
  const defensive =
    (identity.defense === 'PRESSURE' && ['DE', 'DT', 'LB', 'CB'].includes(player.position)) ||
    (['MAN_HEAVY', 'ZONE_HEAVY'].includes(identity.defense) && ['CB', 'S', 'LB'].includes(player.position));
  const fit = offensive || defensive || player.overall >= 84 ? 'Excellent Fit' : player.overall >= 75 ? 'Solid Fit' : 'Development Fit';
  const detail = fit === 'Excellent Fit'
    ? `Thrives as a ${archetype.toLowerCase()} in this system.`
    : fit === 'Solid Fit'
      ? `Can handle the current role without changing the scheme.`
      : `Useful depth, but may need easier assignments.`;
  return { label: fit, detail };
}

function coachPositionOrder(position: string): number {
  if (position === 'HC') return 0;
  if (position === 'OC') return 1;
  if (position === 'DC') return 2;
  return 3;
}

type CoachRow = {
  id: string;
  name: string;
  position: string;
  overall: number;
  stat1: number;
  stat2: number;
  age: number;
  yearsWithTeam: number;
  salary: number;
  contractYearsLeft: number;
  careerWins: number;
  careerLosses: number;
  titles: number;
  teamId: string | null;
};

function coachContractPayload(coach: { salary: number; contractYearsLeft: number }) {
  return {
    salary: coach.salary,
    yearsLeft: coach.contractYearsLeft,
    totalCost: coach.salary * Math.max(1, coach.contractYearsLeft),
  };
}

function coachCost(coach: { salary: number; contractYearsLeft: number }): number {
  return coachContractPayload(coach).totalCost;
}

function coachMarketStory(coach: CoachRow): string {
  if (coach.titles > 0) return 'Proven winner who can reset a franchise standard.';
  if (coach.overall >= 80) return `${personnelArchetype(coach)} with strong league-wide respect.`;
  if (coach.overall >= 70) return `${personnelArchetype(coach)} ready for a bigger role.`;
  return `${personnelArchetype(coach)} with room to grow.`;
}

function defaultCoachContractYears(position: string): number {
  return position === 'HC' ? 4 : 3;
}

function buildCoachCandidate(position: CoachPosition) {
  const baseRating = 48 + Math.floor(Math.random() * 32); // 48..79
  const stat1 = clampRating(baseRating + Math.floor(Math.random() * 20) - 8);
  const stat2 = clampRating(baseRating + Math.floor(Math.random() * 20) - 8);
  const overall = Math.round((stat1 + stat2) / 2);
  const age = 34 + Math.floor(Math.random() * 28);
  return {
    name: randomCoachName(),
    position,
    overall,
    stat1,
    stat2,
    age,
    yearsWithTeam: 0,
    salary: personnelSalary(position, overall, age),
    contractYearsLeft: 1,
    teamId: null,
  };
}

function coachPayload(coach: CoachRow) {
  const contract = coachContractPayload(coach);
  return {
    id: coach.id,
    name: coach.name,
    position: coach.position,
    overall: coach.overall,
    stat1: coach.stat1,
    stat2: coach.stat2,
    statLabels: statLabels(coach.position),
    archetype: personnelArchetype(coach),
    careerWins: coach.careerWins,
    careerLosses: coach.careerLosses,
    titles: coach.titles,
    salary: contract.salary,
    contractYearsLeft: contract.yearsLeft,
    contract,
    yearsWithTeam: coach.yearsWithTeam,
    age: coach.age,
    cost: coachCost(coach),
    story: coachMarketStory(coach),
  };
}

function buildFreeAgentPlayer(position: string) {
  const age = 22 + Math.floor(Math.random() * 12);
  const overall = generateOverall(age, 2);
  const { stat1, stat2 } = splitIntoStats(overall);
  return {
    name: randomName(),
    position,
    overall: Math.round((stat1 + stat2) / 2),
    stat1,
    stat2,
    age,
    salary: personnelSalary(position, overall, age),
    contractYearsLeft: 1 + Math.floor(Math.random() * 3),
    yearsWithTeam: 0,
    teamId: null,
  };
}

function freeAgentPlayerPayload(player: RosterPlayer, salaryUsed: number, salaryCap: number) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    overall: player.overall,
    age: player.age,
    stat1: player.stat1,
    stat2: player.stat2,
    statLabels: statLabels(player.position),
    archetype: playerArchetype(player),
    attributes: keyAttributes(player),
    contract: {
      yearsLeft: player.contractYearsLeft,
      salary: player.salary,
    },
    canSign: salaryUsed + (player.salary ?? 0) <= salaryCap,
  };
}

async function ensurePlayerFreeAgents(position?: string): Promise<void> {
  const positions = position && (PLAYER_POSITIONS as readonly string[]).includes(position) ? [position] : [...PLAYER_POSITIONS];
  for (const pos of positions) {
    const count = await prisma.personnel.count({ where: { teamId: null, position: pos } });
    const needed = Math.max(0, 8 - count);
    if (needed > 0) {
      await prisma.personnel.createMany({
        data: Array.from({ length: needed }, () => buildFreeAgentPlayer(pos)),
      });
    }
  }
}

async function ensureCoachCandidates(): Promise<void> {
  const count = await prisma.personnel.count({ where: { teamId: null, position: { in: [...COACH_POSITIONS] } } });
  if (count >= 18) return;

  const positions: CoachPosition[] = ['HC', 'OC', 'DC'];
  const needed = 24 - count;
  await prisma.personnel.createMany({
    data: Array.from({ length: needed }, (_, index) => buildCoachCandidate(positions[index % positions.length])),
  });
}

async function currentSeasonNumber(): Promise<number> {
  const last = await prisma.seasonHistory.findFirst({ orderBy: { season: 'desc' } });
  return (last?.season ?? 0) + 1;
}

function schemeNeedPositions(identity: TeamIdentity): string[] {
  const needs = new Set<string>();
  if (['PASS_HEAVY', 'VERTICAL'].includes(identity.offense)) ['QB', 'WR', 'OL'].forEach((p) => needs.add(p));
  if (identity.offense === 'RUN_HEAVY') ['RB', 'OL', 'TE'].forEach((p) => needs.add(p));
  if (identity.defense === 'PRESSURE') ['DE', 'DT', 'LB', 'CB'].forEach((p) => needs.add(p));
  if (['MAN_HEAVY', 'ZONE_HEAVY'].includes(identity.defense)) ['CB', 'S', 'LB'].forEach((p) => needs.add(p));
  if (needs.size === 0) ['QB', 'OL', 'CB'].forEach((p) => needs.add(p));
  return [...needs];
}

function sortByOverall<T extends { position: string; overall: number; age?: number; id: string }>(players: T[]): T[] {
  return [...players].sort((a, b) =>
    a.position.localeCompare(b.position) ||
    b.overall - a.overall ||
    (a.age ?? 99) - (b.age ?? 99) ||
    a.id.localeCompare(b.id)
  );
}

function startersByOverall<T extends { position: string }>(players: T[]): T[] {
  const counts: Record<string, number> = {};
  return players.filter((player) => {
    const limit = STARTER_COUNTS_BY_POSITION[player.position] ?? 0;
    if (limit === 0) return false;
    const used = counts[player.position] ?? 0;
    counts[player.position] = used + 1;
    return used < limit;
  });
}

async function ensureDefaultSchemes(teamId: string): Promise<void> {
  const existing = await prisma.teamScheme.findMany({ where: { teamId }, select: { unit: true } });
  const hasOffense = existing.some((scheme) => scheme.unit === 'offense');
  const hasDefense = existing.some((scheme) => scheme.unit === 'defense');
  const team = (!hasOffense || !hasDefense)
    ? await prisma.team.findUnique({ where: { id: teamId }, select: { offensivePlays: true, defensivePlays: true } })
    : null;
  const data = [];
  if (!hasOffense) {
    data.push({
      teamId,
      unit: 'offense',
      name: 'Base Offense',
      plays: normalizePlayLoadout('offense', team?.offensivePlays) as any,
      isDefault: true,
    });
  }
  if (!hasDefense) {
    data.push({
      teamId,
      unit: 'defense',
      name: 'Base Defense',
      plays: normalizePlayLoadout('defense', team?.defensivePlays) as any,
      isDefault: true,
    });
  }
  if (data.length > 0) await prisma.teamScheme.createMany({ data, skipDuplicates: true });
}

type TeamWithLoadout = { offensivePlays?: unknown; defensivePlays?: unknown };
type SchemeWithLoadout = { unit: string; plays: unknown; isDefault: boolean };

function activeSchemePlays(unit: PlayUnit, schemes: SchemeWithLoadout[] | undefined, fallback: unknown): string[] {
  const unitSchemes = (schemes ?? []).filter((scheme) => scheme.unit === unit);
  const active = unitSchemes.find((scheme) => scheme.isDefault) ?? unitSchemes[0];
  return normalizePlayLoadout(unit, active?.plays ?? fallback);
}

function identityFromActiveSchemes(team: TeamWithLoadout & { schemes?: SchemeWithLoadout[] }): TeamIdentity {
  return deriveTeamIdentity({
    offensivePlays: activeSchemePlays('offense', team.schemes, team.offensivePlays),
    defensivePlays: activeSchemePlays('defense', team.schemes, team.defensivePlays),
  });
}

function gameplanFromActiveSchemes(team: TeamWithLoadout & { schemes?: SchemeWithLoadout[] }): Gameplan {
  return normalizeGameplan({
    offensivePlays: activeSchemePlays('offense', team.schemes, team.offensivePlays),
    defensivePlays: activeSchemePlays('defense', team.schemes, team.defensivePlays),
  });
}

function normalizeSchemeUnit(value: unknown): PlayUnit | null {
  return value === 'offense' || value === 'defense' ? value : null;
}

function strictPlayIds(unit: PlayUnit, value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is string => typeof item === 'string');
  if (ids.length !== 9) return null;
  const seen = new Set<string>();
  for (const id of ids) {
    const play = playById(id);
    if (!play || play.unit !== unit || seen.has(id)) return null;
    seen.add(id);
  }
  return ids;
}

// Accepts 0–9 unique valid plays for the given unit. Used when persisting partial
// playbooks; the strict 9-play check is enforced separately when marking a scheme
// as the default.
function loosePlayIds(unit: PlayUnit, value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is string => typeof item === 'string');
  if (ids.length > 9) return null;
  const seen = new Set<string>();
  for (const id of ids) {
    const play = playById(id);
    if (!play || play.unit !== unit || seen.has(id)) return null;
    seen.add(id);
  }
  return ids;
}

function playPayload(play: ReturnType<typeof playById>) {
  if (!play) return null;
  return {
    id: play.id,
    unit: play.unit,
    name: play.name,
    category: play.category,
    categoryLabel: CATEGORY_LABEL[play.category],
    categoryColor: CATEGORY_COLOR[play.category],
    keySlots: play.keySlots,
  };
}

function schemePayload(scheme: { id: string; unit: string; name: string; plays: any; isDefault: boolean }) {
  const unit = normalizeSchemeUnit(scheme.unit) ?? 'offense';
  // Return raw stored plays (0–9) — do NOT pad with library defaults, or empty
  // schemes will appear pre-filled to the playbook editor.
  const raw: unknown = scheme.plays;
  const ids = (Array.isArray(raw) ? raw : []).filter((id: unknown): id is string => typeof id === 'string');
  const seen = new Set<string>();
  const playIds: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const play = playById(id);
    if (!play || play.unit !== unit) continue;
    seen.add(id);
    playIds.push(id);
    if (playIds.length === 9) break;
  }
  return {
    id: scheme.id,
    unit,
    name: scheme.name,
    isDefault: scheme.isDefault,
    plays: playIds,
    playTemplates: playIds.map((id) => playPayload(playById(id))).filter(Boolean),
  };
}

// ─── GET /api/me ──────────────────────────────────────────
//
// Returns the current user's team info. Frontend calls this at boot to
// discover the team id, then uses it for all subsequent dashboard/match calls.
//
app.get('/api/me', async (_req, res, next) => {
  try {
    const team = await prisma.team.findFirst({
      where:  { name: USER_TEAM_NAME },
      select: { id: true, name: true, leagueId: true },
    });
    if (!team) return res.status(404).json({ error: `User team "${USER_TEAM_NAME}" not found — has the world been seeded?` });
    res.json(team);
  } catch (e) { next(e); }
});

// ─── GET /api/dashboard/:teamId ───────────────────────────
//
// Powers the Home screen. One call, everything the dashboard needs.
//
app.get('/api/dashboard/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where:   { id: teamId },
      include: { league: true, personnel: true, schemes: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await ensureDefaultSchemes(teamId);

    const [nextMatch, recentMatch, played, leagueTeams, recentForm, news, scheduleWeeks] = await Promise.all([
      prisma.match.findFirst({
        where:   { played: false, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        orderBy: { week: 'asc' },
        include: { homeTeam: { include: { schemes: true } }, awayTeam: { include: { schemes: true } } },
      }),
      prisma.match.findFirst({
        where:   { played: true,  OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        orderBy: { week: 'desc' },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({ where: { leagueId: team.leagueId, played: true } }),
      prisma.team.findMany({  where: { leagueId: team.leagueId }, select: { id: true, name: true } }),
      computeRecentForm(teamId),
      generateNewsFeed(3, team.leagueId),
      prisma.match.aggregate({ where: { leagueId: team.leagueId }, _max: { week: true } }),
    ]);

    const standings  = computeStandings(played, leagueTeams);
    const myStanding = standings.find((s) => s.teamId === teamId);
    const myRank     = myStanding ? standings.indexOf(myStanding) + 1 : null;

    const isUserHome = nextMatch && nextMatch.homeTeamId === teamId;
    const opp        = nextMatch ? (isUserHome ? nextMatch.awayTeam : nextMatch.homeTeam) : null;

    const wasUserHome = recentMatch && recentMatch.homeTeamId === teamId;
    const myScore     = recentMatch ? (wasUserHome ? recentMatch.homeScore : recentMatch.awayScore) : 0;
    const oppScore    = recentMatch ? (wasUserHome ? recentMatch.awayScore : recentMatch.homeScore) : 0;
    const oppName     = recentMatch ? (wasUserHome ? recentMatch.awayTeam.name : recentMatch.homeTeam.name) : '';
    const teamIdentity = identityFromActiveSchemes(team);
    res.json({
      team: {
        id:             team.id,
        name:           team.name,
        identity:       teamIdentity,
        offensivePhilosophy: team.offensivePhilosophy,
        offenseRating:  team.offenseRating,
        defenseRating:  team.defenseRating,
        leagueName:     team.league.name,
        leagueTier:     team.league.tier,
      },
      nextMatch: nextMatch ? {
        id:         nextMatch.id,
        week:       nextMatch.week,
        totalWeeks: scheduleWeeks._max.week ?? nextMatch.week,
        isHome:     isUserHome,
        opponent: {
          id:           opp!.id,
          name:         opp!.name,
          identity:     identityFromActiveSchemes(opp!),
        },
      } : null,
      recentResult: recentMatch ? {
        id:           recentMatch.id,
        week:         recentMatch.week,
        opponentName: oppName,
        myScore,
        theirScore:   oppScore,
        result:       myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T',
      } : null,
      standingsPosition: {
        rank:   myRank,
        total:  leagueTeams.length,
        wins:   myStanding?.wins   ?? 0,
        losses: myStanding?.losses ?? 0,
        ties:   myStanding?.ties   ?? 0,
      },
      recentForm,
      news,
    });
  } catch (e) { next(e); }
});

// ─── GET /api/team/:teamId/roster ────────────────────────
//
// Compact roster-management view. This is intentionally not a full ratings
// table: it exposes only the decisions the user can act on right now.
app.get('/api/team/:teamId/roster', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where:   { id: teamId },
      include: { personnel: true, schemes: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await ensureDefaultSchemes(teamId);

    const coaches = team.personnel.filter((p) => isCoachPosition(p.position));
    const players = sortByOverall(team.personnel.filter((p) => !isCoachPosition(p.position)));
    const identity = identityFromActiveSchemes(team);

    const enriched = players.map((player) => ({
      id:        player.id,
      name:      player.name,
      position:  player.position,
      overall:   player.overall,
      age:       player.age,
      stat1:     player.stat1,
      stat2:     player.stat2,
      statLabels: statLabels(player.position),
      archetype: personnelArchetype(player),
      attributes: keyAttributes(player),
      schemeFit: schemeFit(player, identity),
      yearsWithClub: player.yearsWithTeam,
      contract: {
        yearsLeft: player.contractYearsLeft,
        salary:    player.salary,
      },
    }));

    const salaryUsed = enriched.reduce((sum, player) => sum + player.contract.salary, 0);

    const schemes = await prisma.teamScheme.findMany({
      where: { teamId },
      orderBy: [{ unit: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });

    res.json({
      team: {
        id:            team.id,
        name:          team.name,
        offenseRating: team.offenseRating,
        defenseRating: team.defenseRating,
        identity,
        offensivePhilosophy: team.offensivePhilosophy,
        salaryCap:     150_000_000,
        salaryUsed,
        coaches:       coaches.sort((a, b) => coachPositionOrder(a.position) - coachPositionOrder(b.position)).map((coach) => ({
          ...coachPayload(coach),
          story: undefined,
          cost: undefined,
        })),
      },
      schemes: schemes.map(schemePayload),
      playTemplates: {
        offense: playsForUnit('offense').map((play) => playPayload(play)).filter(Boolean),
        defense: playsForUnit('defense').map((play) => playPayload(play)).filter(Boolean),
      },
      groups: POSITION_GROUPS.map((group) => ({
        key:     group.key,
        label:   group.label,
        players: enriched
          .filter((player) => group.positions.includes(player.position))
          .sort((a, b) => b.overall - a.overall),
      })).filter((group) => group.players.length > 0),
    });
  } catch (e) { next(e); }
});

app.patch('/api/team/:teamId/philosophy', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { offensivePhilosophy } = req.body as { offensivePhilosophy?: string };
    if (!offensivePhilosophy || !OFFENSIVE_PHILOSOPHIES.includes(offensivePhilosophy as any)) {
      return res.status(400).json({ error: 'Invalid offensive philosophy' });
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { offensivePhilosophy: offensivePhilosophy as any },
      select: { id: true, offensivePhilosophy: true },
    });
    res.json(team);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Team not found' });
    next(e);
  }
});

app.get('/api/plays', (_req, res) => {
  res.json({
    plays: allPlays().map((play) => playPayload(play)).filter(Boolean),
  });
});

app.get('/api/team/:teamId/schemes', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const unit = normalizeSchemeUnit(req.query.unit);
    await ensureDefaultSchemes(teamId);
    const schemes = await prisma.teamScheme.findMany({
      where: { teamId, ...(unit ? { unit } : {}) },
      orderBy: [{ unit: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json({
      schemes: schemes.map(schemePayload),
      playTemplates: (unit ? playsForUnit(unit) : allPlays()).map((play) => playPayload(play)).filter(Boolean),
    });
  } catch (e) { next(e); }
});

app.post('/api/team/:teamId/schemes', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const unit = normalizeSchemeUnit(req.body?.unit);
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : null;
    if (!unit || !name) return res.status(400).json({ error: 'unit and name are required' });
    const plays = loosePlayIds(unit, req.body?.plays ?? []);
    if (!plays) return res.status(400).json({ error: 'Scheme plays must be 0–9 unique valid plays for this unit' });

    const scheme = await prisma.teamScheme.create({
      data: { teamId, unit, name, plays: plays as any, isDefault: false },
    });
    res.json(schemePayload(scheme));
  } catch (e) { next(e); }
});

app.patch('/api/team/:teamId/schemes/:schemeId', async (req, res, next) => {
  try {
    const { teamId, schemeId } = req.params;
    const existing = await prisma.teamScheme.findFirst({ where: { id: schemeId, teamId } });
    if (!existing) return res.status(404).json({ error: 'Scheme not found' });
    const unit = normalizeSchemeUnit(existing.unit)!;
    const data: { name?: string; plays?: any; isDefault?: boolean } = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();
    if (Array.isArray(req.body?.plays)) {
      const plays = loosePlayIds(unit, req.body.plays);
      if (!plays) return res.status(400).json({ error: 'Scheme plays must be 0–9 unique valid plays for this unit' });
      data.plays = plays as any;
    }
    if (typeof req.body?.isDefault === 'boolean') data.isDefault = req.body.isDefault;
    if (data.isDefault === true) {
      const finalPlays = Array.isArray(data.plays)
        ? (data.plays as string[])
        : normalizePlayLoadout(unit, existing.plays);
      if (finalPlays.length !== 9) {
        return res.status(400).json({ error: 'A playbook must contain 9 plays before it can be set active' });
      }
    }
    const scheme = data.isDefault === true
      ? await prisma.$transaction(async (tx) => {
          await tx.teamScheme.updateMany({ where: { teamId, unit, id: { not: schemeId } }, data: { isDefault: false } });
          return tx.teamScheme.update({ where: { id: schemeId }, data });
        })
      : await prisma.teamScheme.update({ where: { id: schemeId }, data });
    if (scheme.isDefault) {
      await prisma.team.update({
        where: { id: teamId },
        data: unit === 'offense'
          ? { offensivePlays: normalizePlayLoadout('offense', scheme.plays) as any }
          : { defensivePlays: normalizePlayLoadout('defense', scheme.plays) as any },
      });
    }
    res.json(schemePayload(scheme));
  } catch (e) { next(e); }
});

app.delete('/api/team/:teamId/schemes/:schemeId', async (req, res, next) => {
  try {
    const { teamId, schemeId } = req.params;
    const existing = await prisma.teamScheme.findFirst({ where: { id: schemeId, teamId } });
    if (!existing) return res.status(404).json({ error: 'Scheme not found' });
    if (existing.isDefault) return res.status(409).json({ error: 'Default scheme cannot be deleted' });
    await prisma.teamScheme.delete({ where: { id: schemeId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── GET /api/coaches/market ─────────────────────────────
//
// Free-agent staff pool, sorted by overall.
app.get('/api/coaches/market', async (req, res, next) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    await ensureCoachCandidates();

    const [team, candidates] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId } }),
      prisma.personnel.findMany({
        where: { teamId: null, position: { in: [...COACH_POSITIONS] } },
        orderBy: [{ overall: 'desc' }, { age: 'asc' }],
        take: 24,
      }),
    ]);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    res.json({
      team: { id: team.id, money: team.money },
      candidates: candidates.map((coach) => ({
        ...coachPayload(coach),
        canHire: team.money >= coachCost(coach),
      })),
    });
  } catch (e) { next(e); }
});

// ─── POST /api/coaches/:coachId/hire ─────────────────────
//
// Hire a free-agent coach, replacing the current coach in that same role.
// The outgoing coach becomes a free agent instead of disappearing.
app.post('/api/coaches/:coachId/hire', async (req, res, next) => {
  try {
    const { coachId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const [team, incoming] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId }, include: { personnel: true } }),
      prisma.personnel.findUnique({ where: { id: coachId } }),
    ]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!incoming || incoming.teamId || !isCoachPosition(incoming.position)) {
      return res.status(404).json({ error: 'Coach candidate not available' });
    }

    const cost = coachCost(incoming);
    if (team.money < cost) return res.status(400).json({ error: 'Not enough cash to hire this coach' });

    const outgoing = team.personnel.find((c) => c.position === incoming.position);
    const years = defaultCoachContractYears(incoming.position);
    await prisma.$transaction([
      prisma.team.update({ where: { id: teamId }, data: { money: { decrement: cost } } }),
      ...(outgoing ? [prisma.personnel.update({
        where: { id: outgoing.id },
        data: {
          teamId: null,
          yearsWithTeam: 0,
          contractYearsLeft: 1,
        },
      })] : []),
      prisma.personnel.update({
        where: { id: incoming.id },
        data: {
          teamId,
          yearsWithTeam: 1,
          contractYearsLeft: years,
        },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── GET /api/players/free-agents ────────────────────────
//
// Position-filtered free-agent pool used by the roster substitution sheet.
app.get('/api/players/free-agents', async (req, res, next) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    const position = req.query.position as string | undefined;
    const limit = Math.max(1, Math.min(12, parseInt(String(req.query.limit ?? '5'), 10)));
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    if (!position || !(PLAYER_POSITIONS as readonly string[]).includes(position)) {
      return res.status(400).json({ error: 'valid position is required' });
    }

    await ensurePlayerFreeAgents(position);

    const [team, players] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId }, include: { personnel: true } }),
      prisma.personnel.findMany({
        where: { teamId: null, position },
        orderBy: [{ overall: 'desc' }, { age: 'asc' }],
        take: limit,
      }),
    ]);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const salaryCap = 150_000_000;
    const salaryUsed = team.personnel.filter((p) => !isCoachPosition(p.position)).reduce((sum, p) => sum + p.salary, 0);
    res.json({
      candidates: players.map((player) => freeAgentPlayerPayload(player, salaryUsed, salaryCap)),
    });
  } catch (e) { next(e); }
});

// ─── POST /api/players/free-agents/:playerId/sign ────────
app.post('/api/players/free-agents/:playerId/sign', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const [team, player] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId }, include: { personnel: true } }),
      prisma.personnel.findUnique({ where: { id: playerId } }),
    ]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!player || player.teamId || isCoachPosition(player.position)) {
      return res.status(404).json({ error: 'Free agent not available' });
    }

    const salaryUsed = team.personnel.filter((p) => !isCoachPosition(p.position)).reduce((sum, p) => sum + p.salary, 0);
    if (salaryUsed + player.salary > 150_000_000) return res.status(400).json({ error: 'Salary cap exceeded' });

    await prisma.personnel.update({
      where: { id: playerId },
      data: { teamId, yearsWithTeam: 1 },
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── GET /api/history/:teamId ────────────────────────────
//
// Long-term memory: champions, team finishes, awards.
app.get('/api/history/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const [teamHistory, leagueHistory] = await Promise.all([
      prisma.teamSeasonHistory.findMany({
        where: { teamId },
        orderBy: { season: 'desc' },
        take: 12,
      }),
      prisma.leagueSeasonHistory.findMany({
        orderBy: [{ season: 'desc' }, { tier: 'asc' }],
        take: 18,
      }),
    ]);

    res.json({
      teamHistory,
      leagueHistory,
      trades: [],
    });
  } catch (e) { next(e); }
});

// ─── POST /api/season/finalize ───────────────────────────
//
// Archives the current completed season. Offseason progression comes next.
app.post('/api/season/finalize', async (_req, res, next) => {
  try {
    const result = await finalizeCurrentSeason();
    res.json(result);
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.includes('unplayed matches')) {
      return res.status(409).json({ error: e.message });
    }
    next(e);
  }
});

// ─── POST /api/offseason/advance ─────────────────────────
//
// Full season transition: archive history, promote/relegate clubs, age and
// progress players, process retirements/contracts, and build next fixtures.
app.post('/api/offseason/advance', async (_req, res, next) => {
  try {
    const result = await advanceOffseason();
    res.json(result);
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.includes('unplayed matches')) {
      return res.status(409).json({ error: e.message });
    }
    next(e);
  }
});

// ─── GET /api/match/:matchId/preview ──────────────────────
//
// Powers the Match Preview screen. Includes the AI coach's recommendation
// + reasoning for the user-facing advisor.
//
app.get('/api/match/:matchId/preview', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const userTeamId  = req.query.userTeamId as string | undefined;

    const match = await prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        homeTeam: { include: { personnel: true, schemes: true } },
        awayTeam: { include: { personnel: true, schemes: true } },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const isUserHome = userTeamId === match.homeTeamId;
    const myTeam     = isUserHome ? match.homeTeam : match.awayTeam;
    const opp        = isUserHome ? match.awayTeam : match.homeTeam;
    const myActiveGameplan = gameplanFromActiveSchemes(myTeam);
    const oppActiveGameplan = gameplanFromActiveSchemes(opp);

    const myCoaches = myTeam.personnel.filter((p) => isCoachPosition(p.position));
    const myPlayers = myTeam.personnel.filter((p) => !isCoachPosition(p.position));
    const oppCoaches = opp.personnel.filter((p) => isCoachPosition(p.position));
    const oppPlayers = opp.personnel.filter((p) => !isCoachPosition(p.position));

    const myProfile: TeamMatchProfile = {
      id:            myTeam.id,
      name:          myTeam.name,
      coaches:       myCoaches,
      players:       startersByOverall(sortByOverall(myPlayers)),
      offensivePlays: myActiveGameplan.offensivePlays,
      defensivePlays: myActiveGameplan.defensivePlays,
    };

    const recommendation = recommendGameplan(myProfile);
    const oppGroups      = computePositionGroups(startersByOverall(sortByOverall(oppPlayers)));
    await ensureDefaultSchemes(myTeam.id);
    const mySchemes = await prisma.teamScheme.findMany({
      where: { teamId: myTeam.id },
      orderBy: [{ unit: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    // Recent form for both sides — gives the user "this is a hot team" or
    // "they're slumping" context on the preview screen.
    const [myForm, oppForm] = await Promise.all([
      computeRecentForm(myTeam.id),
      computeRecentForm(opp.id),
    ]);

    res.json({
      matchId: match.id,
      week:    match.week,
      isHome:  isUserHome,
      myForm,
      oppForm,
      myTeam: {
        id:            myTeam.id,
        name:          myTeam.name,
        identity:      identityFromActiveSchemes(myTeam),
        offensivePhilosophy: myTeam.offensivePhilosophy,
        offenseRating: myTeam.offenseRating,
        defenseRating: myTeam.defenseRating,
      },
      opponent: {
        id:            opp.id,
        name:          opp.name,
        identity:      identityFromActiveSchemes(opp),
        offensivePhilosophy: opp.offensivePhilosophy,
        offenseRating: opp.offenseRating,
        defenseRating: opp.defenseRating,
        groups:        oppGroups,
      },
      recommendation,
      schemes: mySchemes.map(schemePayload),
      playTemplates: {
        offense: playsForUnit('offense').map((play) => playPayload(play)).filter(Boolean),
        defense: playsForUnit('defense').map((play) => playPayload(play)).filter(Boolean),
      },
    });
  } catch (e) { next(e); }
});

// ─── POST /api/match/:matchId/simulate ────────────────────
//
// Body: { userTeamId, gameplan }
// Runs the single-match simulation, persists results, returns full
// outcome including the live feed events for animated UI reveal.
//
app.post('/api/match/:matchId/simulate', async (req, res, next) => {
  try {
    const { matchId }    = req.params;
    const { userTeamId, gameplan, offenseSchemeId, defenseSchemeId } = req.body as {
      userTeamId?: string;
      gameplan?: Gameplan;
      offenseSchemeId?: string;
      defenseSchemeId?: string;
    };

    const schemeGameplan = userTeamId && (!gameplan || offenseSchemeId || defenseSchemeId)
      ? await buildSchemeGameplan(userTeamId, offenseSchemeId, defenseSchemeId)
      : gameplan;
    const result = await simulateSingleMatch(matchId, userTeamId, schemeGameplan);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'Match not found')      return res.status(404).json({ error: e.message });
    if (e?.message === 'Match already played') return res.status(409).json({ error: e.message });
    if (e?.message === 'Out starter must be subbed out') return res.status(409).json({ error: e.message });
    next(e);
  }
});

async function buildSchemeGameplan(teamId: string, offenseSchemeId?: string, defenseSchemeId?: string): Promise<Gameplan> {
  await ensureDefaultSchemes(teamId);
  const schemes = await prisma.teamScheme.findMany({ where: { teamId } });
  const offense = schemes.find((scheme) => scheme.id === offenseSchemeId && scheme.unit === 'offense') ??
    schemes.find((scheme) => scheme.unit === 'offense' && scheme.isDefault) ??
    schemes.find((scheme) => scheme.unit === 'offense');
  const defense = schemes.find((scheme) => scheme.id === defenseSchemeId && scheme.unit === 'defense') ??
    schemes.find((scheme) => scheme.unit === 'defense' && scheme.isDefault) ??
    schemes.find((scheme) => scheme.unit === 'defense');
  const raw = {
    offensivePlays: normalizePlayLoadout('offense', offense?.plays),
    defensivePlays: normalizePlayLoadout('defense', defense?.plays),
  };
  return normalizeGameplan(raw);
}

// ─── GET /api/match/:matchId ──────────────────────────────
//
// Read-only view of a played match — for postgame replay or history.
//
app.get('/api/match/:matchId', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const match = await prisma.match.findUnique({
      where:   { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({
      ...match,
      homeGameplan: normalizeGameplan(match.homeGameplan),
      awayGameplan: normalizeGameplan(match.awayGameplan),
    });
  } catch (e) { next(e); }
});

// ─── GET /api/league/:leagueId/standings ──────────────────
//
app.get('/api/league/:leagueId/standings', async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const [played, teams, league] = await Promise.all([
      prisma.match.findMany({ where: { leagueId, played: true } }),
      prisma.team.findMany({
        where: { leagueId },
        include: {
          personnel: true,
          schemes: true,
        },
      }),
      prisma.league.findUnique({ where: { id: leagueId } }),
    ]);
    const standings = computeStandings(played, teams.map((t) => ({ id: t.id, name: t.name })));
    const styleByTeam = new Map(teams.map((t) => {
      const coaches = t.personnel.filter((p) => isCoachPosition(p.position));
      const players = t.personnel.filter((p) => !isCoachPosition(p.position));
      return [t.id, {
        identity: identityFromActiveSchemes(t),
        coaches: coaches
          .sort((a, b) => coachPositionOrder(a.position) - coachPositionOrder(b.position))
          .map((coach) => ({
            id: coach.id,
            name: coach.name,
            position: coach.position,
            archetype: personnelArchetype(coach),
            overall: coach.overall,
          })),
        topPlayers: [...players]
          .sort((a, b) => b.overall - a.overall)
          .slice(0, 3)
          .map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position,
            overall: player.overall,
            age: player.age,
          })),
      }];
    }));
    res.json({
      league:    league ? { id: league.id, name: league.name, tier: league.tier } : null,
      standings: standings.map((s) => ({ ...s, ...styleByTeam.get(s.teamId) })),
    });
  } catch (e) { next(e); }
});

// ─── Error handler ────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

loadPlayCatalog(prisma)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to load play catalog from DB. Did you run `npm run seed`?', err);
    process.exit(1);
  });
