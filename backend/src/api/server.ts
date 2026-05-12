import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { prisma } from '../db';
import { computeStandings } from '../simulation/standings';
import { computePositionGroups } from '../simulation/positionGroups';
import { recommendGameplan } from '../simulation/aiCoach';
import { TeamMatchProfile } from '../simulation/matchEngine';
import { simulateSingleMatch } from './simulateOne';
import { Gameplan, OFFENSIVE_PHILOSOPHIES, normalizeGameplan } from '../simulation/gameplan';
import {
  defaultPlaysForUnit,
  normalizePlayIds,
  normalizeSchemeUnit,
  PLAY_TEMPLATES,
  templatesForUnit,
  SchemeUnit,
} from '../simulation/playTemplates';
import { computeRecentForm } from './teamForm';
import { generateNewsFeed } from './newsGenerator';
import { finalizeCurrentSeason } from '../simulation/seasonHistory';
import { advanceOffseason } from '../simulation/offseason';

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors());
app.use(express.json());

// MVP: hardcoded user team. Real auth comes later — this lets us build the
// matchday vertical slice without an auth system in the way.
const USER_TEAM_NAME = process.env.USER_TEAM_NAME ?? 'Dallas Vanguard';

type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  overall: number;
  potential: number;
  age: number;
  morale: number;
  fatigue: number;
  injuryStatus?: string;
  injuryType?: string | null;
  injuryWeeks?: number;
  depthOrder?: number;
  salary?: number;
  contractYearsLeft?: number;
  extensionEligible?: boolean;
};

type CoachRole = 'HEAD_COACH' | 'OC' | 'DC' | 'TRAINER' | 'MEDICAL' | 'RECRUITMENT';

const COACH_FIRST_NAMES = ['Frank', 'Marty', 'Calvin', 'Shane', 'Victor', 'Eli', 'Grant', 'Wes', 'Nolan', 'Ray', 'Cole', 'Andre'];
const COACH_LAST_NAMES = ['Hayes', 'Bennett', 'Porter', 'Hughes', 'Walsh', 'Foster', 'Carver', 'Brooks', 'Sullivan', 'Pierce', 'Graves', 'Knight'];
const COACH_SPECIALTIES = ['QB', 'Skill', 'OL', 'DL', 'LB', 'Secondary'];
const MEDICAL_SPECIALTIES = ['Soft Tissue', 'Orthopedic', 'Recovery'];
const RECRUITMENT_SPECIALTIES = ['College', 'Pro', 'International'];

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
  return [...player.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function playerArchetype(player: RosterPlayer): string {
  const roll = playerSeed(player) % 3;
  const byPosition: Record<string, string[]> = {
    QB: ['Field General', 'Gunslinger', 'Dual Threat'],
    RB: ['Workhorse', 'Elusive Back', 'Power Runner'],
    WR: ['Deep Threat', 'Route Technician', 'Possession Target'],
    TE: ['Move Tight End', 'Red Zone Target', 'Inline Blocker'],
    OL: ['Pass Protector', 'Road Grader', 'Technician'],
    DE: ['Edge Rusher', 'Power End', 'Run Setter'],
    DT: ['Interior Anchor', 'Disruptor', 'Nose Tackle'],
    LB: ['Field General', 'Coverage Backer', 'Downhill Thumper'],
    CB: ['Lockdown Corner', 'Ball Hawk', 'Press Specialist'],
    S:  ['Deep Safety', 'Box Safety', 'Playmaker'],
  };
  return (byPosition[player.position] ?? ['Balanced Contributor', 'Role Player', 'Specialist'])[roll];
}

function playerTraits(player: RosterPlayer): string[] {
  const traits = [
    player.overall >= 86 ? 'Team Leader' : player.potential - player.overall >= 15 ? 'High Ambition' : 'Reliable Pro',
    player.fatigue >= 65 ? 'Needs Rest' : player.morale >= 78 ? 'Confident' : player.morale <= 55 ? 'Frustrated' : 'Steady',
    player.age >= 31 ? 'Veteran Presence' : player.age <= 24 ? 'Developing Talent' : 'Prime Years',
  ];
  if (playerSeed(player) % 7 === 0) traits[1] = 'Clutch Performer';
  if (playerSeed(player) % 11 === 0) traits[2] = 'Injury Prone';
  return traits;
}

function keyAttributes(player: RosterPlayer): Record<string, number> {
  const seed = playerSeed(player);
  const nudge = (offset: number) => Math.max(35, Math.min(99, player.overall + ((seed + offset) % 13) - 6));
  switch (player.position) {
    case 'QB': return { accuracy: nudge(1), awareness: nudge(5), composure: nudge(9), mobility: nudge(13) };
    case 'RB': return { vision: nudge(2), burst: nudge(6), power: nudge(10), security: nudge(14) };
    case 'WR':
    case 'TE': return { hands: nudge(3), routeRunning: nudge(7), separation: nudge(11), toughness: nudge(15) };
    case 'OL': return { passBlock: nudge(4), runBlock: nudge(8), strength: nudge(12), discipline: nudge(16) };
    case 'DE':
    case 'DT': return { rush: nudge(5), strength: nudge(9), runDefense: nudge(13), motor: nudge(17) };
    case 'LB': return { tackling: nudge(6), coverage: nudge(10), instincts: nudge(14), pursuit: nudge(18) };
    case 'CB':
    case 'S': return { coverage: nudge(7), tackling: nudge(11), awareness: nudge(15), ballSkills: nudge(19) };
    default: return { technique: nudge(8), power: nudge(12), composure: nudge(16), consistency: nudge(20) };
  }
}

function schemeFit(player: RosterPlayer, offenseStyle: string, defenseStyle: string, tempo: string) {
  const archetype = playerArchetype(player);
  const offensive =
    (offenseStyle === 'PASS_HEAVY' && ['QB', 'WR', 'TE', 'OL'].includes(player.position)) ||
    (offenseStyle === 'RUN_HEAVY' && ['RB', 'TE', 'OL'].includes(player.position)) ||
    (tempo === 'FAST' && ['QB', 'WR', 'CB', 'S'].includes(player.position));
  const defensive =
    (defenseStyle === 'AGGRESSIVE' && ['DE', 'DT', 'LB', 'CB'].includes(player.position)) ||
    (defenseStyle === 'PREVENT' && ['CB', 'S', 'LB'].includes(player.position));
  const fit = offensive || defensive || player.overall >= 84 ? 'Excellent Fit' : player.overall >= 75 ? 'Solid Fit' : 'Development Fit';
  const detail = fit === 'Excellent Fit'
    ? `Thrives as a ${archetype.toLowerCase()} in this system.`
    : fit === 'Solid Fit'
      ? `Can handle the current role without changing the scheme.`
      : `Useful depth, but may need easier assignments.`;
  return { label: fit, detail };
}

function coachRoleOrder(role: string): number {
  if (role === 'HEAD_COACH') return 0;
  if (role === 'OC') return 1;
  if (role === 'DC') return 2;
  if (role === 'TRAINER') return 3;
  if (role === 'MEDICAL') return 4;
  if (role === 'RECRUITMENT') return 5;
  return 6;
}

function coachCost(coach: { reputation: number; role: string; titles: number }): number {
  const rolePremium =
    coach.role === 'HEAD_COACH' ? 1.8 :
    coach.role === 'OC' || coach.role === 'DC' ? 1.0 :
    0.65;
  return Math.round((1_500_000 + coach.reputation * coach.reputation * 2_200 * rolePremium + coach.titles * 850_000) / 100_000) * 100_000;
}

function coachMarketStory(coach: { role: string; philosophy: string; developmentSpecialty: string; reputation: number; hotSeat: number; titles: number }): string {
  if (coach.titles > 0) return 'Proven winner who can reset a franchise standard.';
  if (coach.reputation >= 72) return `${coach.philosophy} with strong league-wide respect.`;
  if (coach.role === 'TRAINER') return `${coach.developmentSpecialty} development specialist who unlocks young talent.`;
  if (coach.role === 'MEDICAL') return `${coach.developmentSpecialty} focus — keeps players on the field.`;
  if (coach.role === 'RECRUITMENT') return `${coach.developmentSpecialty} pipeline scout with a reliable little black book.`;
  if (coach.developmentSpecialty === 'QB') return 'QB development profile makes him attractive to passing teams.';
  if (coach.hotSeat >= 60) return 'Reputation took a hit, but the philosophy still has believers.';
  return `${coach.developmentSpecialty} development specialist with room to grow.`;
}

function randomCoachName(): string {
  return `${COACH_FIRST_NAMES[Math.floor(Math.random() * COACH_FIRST_NAMES.length)]} ${COACH_LAST_NAMES[Math.floor(Math.random() * COACH_LAST_NAMES.length)]}`;
}

function buildCoachCandidate(role: CoachRole) {
  const specialty =
    role === 'MEDICAL' ? MEDICAL_SPECIALTIES[Math.floor(Math.random() * MEDICAL_SPECIALTIES.length)] :
    role === 'RECRUITMENT' ? RECRUITMENT_SPECIALTIES[Math.floor(Math.random() * RECRUITMENT_SPECIALTIES.length)] :
    COACH_SPECIALTIES[Math.floor(Math.random() * COACH_SPECIALTIES.length)];
  const philosophy =
    role === 'OC' && specialty === 'QB' ? 'Vertical Architect' :
    role === 'OC' && specialty === 'OL' ? 'Ground Game Designer' :
    role === 'DC' && specialty === 'Secondary' ? 'Coverage Professor' :
    role === 'DC' && ['DL', 'LB'].includes(specialty) ? 'Pressure Merchant' :
    role === 'HEAD_COACH' && Math.random() > 0.5 ? 'Program Stabilizer' :
    role === 'HEAD_COACH' ? 'Culture Builder' :
    role === 'TRAINER' ? randomChoice(['Strength Coach', 'Skill Developer', 'Speed Specialist', 'Veteran Refiner']) :
    role === 'MEDICAL' ? randomChoice(['Preventive Specialist', 'Surgical Lead', 'Recovery Architect']) :
    role === 'RECRUITMENT' ? randomChoice(['College Pipeline', 'Free Agent Hunter', 'International Scout']) :
    'Balanced Playcaller';
  return {
    name: randomCoachName(),
    role,
    philosophy,
    developmentSpecialty: specialty,
    aggression: 35 + Math.floor(Math.random() * 58),
    moraleImpact: Math.floor(Math.random() * 10) - 2,
    preferredTempo: (['SLOW', 'NORMAL', 'FAST'] as const)[Math.floor(Math.random() * 3)] as any,
    reputation: 42 + Math.floor(Math.random() * 36),
    hotSeat: 8 + Math.floor(Math.random() * 28),
    yearsWithTeam: 0,
    age: 34 + Math.floor(Math.random() * 28),
    teamId: null,
  };
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function coachPayload(coach: any) {
  return {
    id: coach.id,
    name: coach.name,
    role: coach.role,
    philosophy: coach.philosophy,
    developmentSpecialty: coach.developmentSpecialty,
    aggression: coach.aggression,
    moraleImpact: coach.moraleImpact,
    preferredTempo: coach.preferredTempo,
    reputation: coach.reputation,
    careerWins: coach.careerWins,
    careerLosses: coach.careerLosses,
    titles: coach.titles,
    hotSeat: coach.hotSeat,
    yearsWithTeam: coach.yearsWithTeam,
    age: coach.age,
    cost: coachCost(coach),
    story: coachMarketStory(coach),
  };
}

function playerMarketValue(player: RosterPlayer): number {
  const ratingValue = Math.pow(player.overall, 2) * 18_000;
  const potentialBonus = Math.max(0, player.potential - player.overall) * 850_000;
  const ageMultiplier =
    player.age <= 23 ? 1.28 :
    player.age <= 26 ? 1.18 :
    player.age <= 30 ? 1.00 :
    player.age <= 33 ? 0.78 :
    0.58;
  const moraleMultiplier = player.morale >= 78 ? 1.06 : player.morale <= 55 ? 0.90 : 1;
  const contractMultiplier =
    (player.contractYearsLeft ?? 2) >= 4 ? 1.12 :
    (player.contractYearsLeft ?? 2) === 1 ? 0.84 :
    1;
  const injuryMultiplier =
    player.injuryStatus === 'MULTI_WEEK' ? 0.62 :
    player.injuryStatus === 'MINOR' ? 0.82 :
    player.injuryStatus === 'QUESTIONABLE' ? 0.92 :
    1;
  const positionalPremium = ['QB', 'WR', 'CB', 'DE'].includes(player.position) ? 1.12 : 1;
  const raw = (ratingValue + potentialBonus + (player.salary ?? 0) * 1.8)
    * ageMultiplier
    * moraleMultiplier
    * contractMultiplier
    * injuryMultiplier
    * positionalPremium;
  return Math.max(500_000, Math.round(raw / 100_000) * 100_000);
}

function formatMarketStory(player: RosterPlayer, team: { offenseStyle: string; defenseStyle: string; tempo: string }): string {
  const fit = schemeFit(player, team.offenseStyle, team.defenseStyle, team.tempo).label;
  if (player.contractYearsLeft === 1) return 'Final contract year creates a decision point.';
  if (player.age >= 31 && player.overall >= 82) return 'Veteran star with win-now value.';
  if (player.potential - player.overall >= 14) return 'High-upside prospect for a patient club.';
  if (fit === 'Excellent Fit') return 'Clean scheme fit for the right contender.';
  return 'Useful depth piece at a manageable number.';
}

function marketPlayer(player: RosterPlayer, team: { offenseStyle: string; defenseStyle: string; tempo: string }) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    overall: player.overall,
    potential: player.potential,
    age: player.age,
    morale: player.morale,
    fatigue: player.fatigue,
    archetype: playerArchetype(player),
    value: playerMarketValue(player),
    story: formatMarketStory(player, team),
    contract: {
      yearsLeft: player.contractYearsLeft,
      salary: player.salary,
      extensionEligible: player.extensionEligible,
    },
    injury: {
      status: player.injuryStatus,
      type: player.injuryType,
      weeks: player.injuryWeeks,
    },
  };
}

async function ensureMarketListings(userTeamId: string): Promise<void> {
  const activeCount = await prisma.transferListing.count({ where: { status: 'ACTIVE', sellerTeamId: { not: userTeamId } } });
  if (activeCount >= 10) return;

  const teams = await prisma.team.findMany({
    where: { id: { not: userTeamId } },
    include: { players: true },
    take: 12,
  });
  const candidates = teams.flatMap((team) => {
    const needs = schemeNeedPositions(team.offenseStyle, team.defenseStyle);
    return team.players
      .filter((player) => player.overall >= 64 && !needs.includes(player.position))
      .sort((a, b) => {
        const aScore = (a.age >= 31 ? 10 : 0) + (a.contractYearsLeft === 1 ? 8 : 0) + (a.morale <= 58 ? 6 : 0) - a.overall * 0.05;
        const bScore = (b.age >= 31 ? 10 : 0) + (b.contractYearsLeft === 1 ? 8 : 0) + (b.morale <= 58 ? 6 : 0) - b.overall * 0.05;
        return bScore - aScore;
      })
      .slice(0, 2)
      .map((player) => ({ team, player }));
  });

  for (const { team, player } of candidates.slice(0, 12 - activeCount)) {
    await prisma.transferListing.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        sellerTeamId: team.id,
        askingPrice: Math.round(playerMarketValue(player) * (1.02 + (playerSeed(player) % 12) / 100) / 100_000) * 100_000,
      },
      update: {},
    });
  }
}

async function ensureIncomingOffers(userTeamId: string): Promise<void> {
  const listings = await prisma.transferListing.findMany({
    where: { sellerTeamId: userTeamId, status: 'ACTIVE' },
    include: { player: true },
  });
  if (listings.length === 0) return;

  const buyers = await prisma.team.findMany({
    where: { id: { not: userTeamId }, money: { gt: 10_000_000 } },
    include: { players: true },
    take: 12,
  });

  for (const listing of listings) {
    const existing = await prisma.transferOffer.count({ where: { listingId: listing.id, status: 'PENDING' } });
    if (existing > 0) continue;

    const preferredBuyers = buyers
      .filter((team) => schemeNeedPositions(team.offenseStyle, team.defenseStyle).includes(listing.player.position))
      .filter((team) => team.players.reduce((sum, player) => sum + player.salary, 0) + listing.player.salary <= 150_000_000)
      .sort((a, b) => b.money - a.money);
    const buyer = preferredBuyers[0] ?? buyers[0];
    if (!buyer) continue;

    const discount = 0.86 + (playerSeed(listing.player) % 10) / 100;
    const amount = Math.round(listing.askingPrice * discount / 100_000) * 100_000;
    if (buyer.money < amount) continue;
    await prisma.transferOffer.create({
      data: {
        listingId: listing.id,
        buyerTeamId: buyer.id,
        amount,
      },
    });
  }
}

async function ensureCoachCandidates(): Promise<void> {
  const count = await prisma.coach.count({ where: { teamId: null } });
  if (count >= 18) return;

  const roles: CoachRole[] = ['HEAD_COACH', 'OC', 'DC', 'TRAINER', 'MEDICAL', 'RECRUITMENT'];
  const needed = 24 - count;
  await prisma.coach.createMany({
    data: Array.from({ length: needed }, (_, index) => buildCoachCandidate(roles[index % roles.length])),
  });
}

async function currentSeasonNumber(): Promise<number> {
  const last = await prisma.seasonHistory.findFirst({ orderBy: { season: 'desc' } });
  return (last?.season ?? 0) + 1;
}

function schemeNeedPositions(offenseStyle: string, defenseStyle: string): string[] {
  const needs = new Set<string>();
  if (offenseStyle === 'PASS_HEAVY') ['QB', 'WR', 'OL'].forEach((p) => needs.add(p));
  if (offenseStyle === 'RUN_HEAVY') ['RB', 'OL', 'TE'].forEach((p) => needs.add(p));
  if (defenseStyle === 'AGGRESSIVE') ['DE', 'LB', 'CB'].forEach((p) => needs.add(p));
  if (defenseStyle === 'PREVENT') ['CB', 'S', 'LB'].forEach((p) => needs.add(p));
  if (needs.size === 0) ['QB', 'OL', 'CB'].forEach((p) => needs.add(p));
  return [...needs];
}

const TRAIN_COST = 500_000;
const HEAL_COST = 400_000;
const HEAL_COST_DISCOUNTED = 300_000;
const RECRUIT_COST = 1_500_000;

function devGroup(position: string): string {
  if (position === 'QB') return 'QB';
  if (['RB', 'WR', 'TE'].includes(position)) return 'Skill';
  if (position === 'OL') return 'OL';
  if (['DE', 'DT'].includes(position)) return 'DL';
  if (position === 'LB') return 'LB';
  if (['CB', 'S'].includes(position)) return 'Secondary';
  return 'Skill';
}

async function currentRegularSeasonWeek(leagueId: string): Promise<number | null> {
  const next = await prisma.match.findFirst({
    where: { leagueId, played: false, playoffRound: null },
    orderBy: { week: 'asc' },
    select: { week: true },
  });
  return next?.week ?? null;
}

function healCostFor(coach: { developmentSpecialty: string } | undefined): number {
  return coach?.developmentSpecialty === 'Recovery' ? HEAL_COST_DISCOUNTED : HEAL_COST;
}

function downgradeInjury(status: string, weeks: number): { status: string; weeks: number; type: string | null } {
  if (status === 'MULTI_WEEK') return { status: 'MINOR', weeks: Math.min(weeks, 2), type: 'Soft Tissue' };
  if (status === 'MINOR') return { status: 'QUESTIONABLE', weeks: Math.min(weeks, 1), type: 'Tweak' };
  return { status: 'HEALTHY', weeks: 0, type: null };
}

function sortByDepth<T extends { position: string; depthOrder?: number | null; overall: number; age?: number; id: string }>(players: T[]): T[] {
  return [...players].sort((a, b) =>
    a.position.localeCompare(b.position) ||
    (a.depthOrder ?? 999) - (b.depthOrder ?? 999) ||
    b.overall - a.overall ||
    (a.age ?? 99) - (b.age ?? 99) ||
    a.id.localeCompare(b.id)
  );
}

function startersFromDepth<T extends { position: string }>(players: T[]): T[] {
  const counts: Record<string, number> = {};
  return players.filter((player) => {
    const limit = STARTER_COUNTS_BY_POSITION[player.position] ?? 0;
    if (limit === 0) return false;
    const used = counts[player.position] ?? 0;
    counts[player.position] = used + 1;
    return used < limit;
  });
}

function buildLineupReadiness(players: Array<{ id: string; name: string; position: string; injuryStatus?: string; injuryType?: string | null; injuryWeeks?: number }>) {
  const starters = startersFromDepth(players);
  const blockers = starters
    .filter((player) => player.injuryStatus === 'MULTI_WEEK')
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      position: player.position,
      status: 'MULTI_WEEK',
      message: `${player.position} ${player.name} is out and must be subbed out.`,
    }));
  const warnings = starters
    .filter((player) => player.injuryStatus === 'MINOR')
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      position: player.position,
      status: 'MINOR',
      message: `${player.position} ${player.name} can play, but minor injuries raise OUT risk.`,
    }));
  return { blocked: blockers.length > 0, blockers, warnings };
}

async function ensureDefaultSchemes(teamId: string): Promise<void> {
  const existing = await prisma.teamScheme.findMany({ where: { teamId }, select: { unit: true } });
  const hasOffense = existing.some((scheme) => scheme.unit === 'offense');
  const hasDefense = existing.some((scheme) => scheme.unit === 'defense');
  const data = [];
  if (!hasOffense) {
    data.push({ teamId, unit: 'offense', name: 'Base Offense', plays: defaultPlaysForUnit('offense') as any, isDefault: true });
  }
  if (!hasDefense) {
    data.push({ teamId, unit: 'defense', name: 'Base Defense', plays: defaultPlaysForUnit('defense') as any, isDefault: true });
  }
  if (data.length > 0) await prisma.teamScheme.createMany({ data, skipDuplicates: true });
}

function schemePayload(scheme: { id: string; unit: string; name: string; plays: any; isDefault: boolean }) {
  const unit = normalizeSchemeUnit(scheme.unit) ?? 'offense';
  const playIds = normalizePlayIds(unit, scheme.plays);
  return {
    id: scheme.id,
    unit,
    name: scheme.name,
    isDefault: scheme.isDefault,
    plays: playIds,
    playTemplates: playIds.map((id) => PLAY_TEMPLATES.find((play) => play.id === id)).filter(Boolean),
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
      include: { league: true, coaches: true, players: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const [nextMatch, recentMatch, played, leagueTeams, recentForm, news] = await Promise.all([
      prisma.match.findFirst({
        where:   { played: false, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        orderBy: { week: 'asc' },
        include: { homeTeam: true, awayTeam: true },
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
    const lineupReadiness = buildLineupReadiness(sortByDepth(team.players));

    res.json({
      team: {
        id:             team.id,
        name:           team.name,
        offenseStyle:   team.offenseStyle,
        offensivePhilosophy: team.offensivePhilosophy,
        defenseStyle:   team.defenseStyle,
        tempo:          team.tempo,
        offenseRating:  team.offenseRating,
        defenseRating:  team.defenseRating,
        morale:         team.morale,
        leagueName:     team.league.name,
        leagueTier:     team.league.tier,
      },
      nextMatch: nextMatch ? {
        id:         nextMatch.id,
        week:       nextMatch.week,
        isHome:     isUserHome,
        opponent: {
          id:           opp!.id,
          name:         opp!.name,
          offenseStyle: opp!.offenseStyle,
          defenseStyle: opp!.defenseStyle,
          tempo:        opp!.tempo,
          morale:       opp!.morale,
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
      staffActions: buildStaffActions(team, nextMatch?.week ?? null),
      lineupReadiness,
    });
  } catch (e) { next(e); }
});

function buildStaffActions(
  team: { trainWeek: number; recruitWeek: number; money: number; coaches: Array<{ role: string; developmentSpecialty: string }> },
  currentWeek: number | null,
) {
  const trainer = team.coaches.find((c) => c.role === 'TRAINER');
  const scout   = team.coaches.find((c) => c.role === 'RECRUITMENT');

  const buildEntry = (used: number, hasStaff: boolean, cost: number) => {
    if (currentWeek === null) return { available: false, reason: 'Season over', cost, usedThisWeek: false };
    if (!hasStaff) return { available: false, reason: 'Hire staff first', cost, usedThisWeek: false };
    if (used >= currentWeek) return { available: false, reason: 'Used this week', cost, usedThisWeek: true };
    if (team.money < cost) return { available: false, reason: 'Not enough cash', cost, usedThisWeek: false };
    return { available: true, reason: null as string | null, cost, usedThisWeek: false };
  };

  return {
    currentWeek,
    train:   { ...buildEntry(team.trainWeek,   !!trainer, TRAIN_COST),   specialty: trainer?.developmentSpecialty ?? null },
    recruit: { ...buildEntry(team.recruitWeek, !!scout,   RECRUIT_COST), specialty: scout?.developmentSpecialty ?? null },
  };
}

// ─── GET /api/team/:teamId/roster ────────────────────────
//
// Compact roster-management view. This is intentionally not a full ratings
// table: it exposes only the decisions the user can act on right now.
app.get('/api/team/:teamId/roster', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where:   { id: teamId },
      include: { players: true, coaches: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await ensureDefaultSchemes(teamId);

    const players = sortByDepth(team.players);

    const enriched = players.map((player) => ({
      id:        player.id,
      name:      player.name,
      position:  player.position,
      overall:   player.overall,
      potential: player.potential,
      age:       player.age,
      morale:    player.morale,
      fatigue:   player.fatigue,
      conditioning: player.conditioning,
      depthOrder: player.depthOrder,
      archetype: playerArchetype(player),
      traits:    playerTraits(player),
      attributes: keyAttributes(player),
      schemeFit: schemeFit(player, team.offenseStyle, team.defenseStyle, team.tempo),
      yearsWithClub: 1 + (playerSeed(player) % Math.min(8, Math.max(1, player.age - 20))),
      contract: {
        yearsLeft: player.contractYearsLeft,
        salary:    player.salary,
        extensionEligible: player.extensionEligible,
      },
      injury: {
        status: player.injuryStatus,
        type:   player.injuryType,
        weeks:  player.injuryWeeks,
      },
    }));

    const salaryUsed = enriched.reduce((sum, player) => sum + player.contract.salary, 0);
    const injuryReport = enriched
      .filter((player) => player.injury.status !== 'HEALTHY')
      .map((player) => ({
        playerId: player.id,
        name:     player.name,
        position: player.position,
        status:   player.injury.status,
        type:     player.injury.type,
        weeks:    player.injury.weeks,
      }));

    const week = await currentRegularSeasonWeek(team.leagueId);
    const [schemes] = await Promise.all([
      prisma.teamScheme.findMany({
        where: { teamId },
        orderBy: [{ unit: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
      }),
    ]);
    const lineupReadiness = buildLineupReadiness(players);
    const medical = team.coaches.find((c) => c.role === 'MEDICAL');
    const healCost = healCostFor(medical);
    const healAction = (() => {
      if (week === null) return { available: false, reason: 'Season over', cost: healCost, usedThisWeek: false, specialty: medical?.developmentSpecialty ?? null };
      if (!medical)      return { available: false, reason: 'Hire medical staff', cost: healCost, usedThisWeek: false, specialty: null };
      if (team.healWeek >= week) return { available: false, reason: 'Used this week', cost: healCost, usedThisWeek: true, specialty: medical.developmentSpecialty };
      if (team.money < healCost) return { available: false, reason: 'Not enough cash', cost: healCost, usedThisWeek: false, specialty: medical.developmentSpecialty };
      return { available: true, reason: null as string | null, cost: healCost, usedThisWeek: false, specialty: medical.developmentSpecialty };
    })();

    res.json({
      team: {
        id:            team.id,
        name:          team.name,
        offenseRating: team.offenseRating,
        defenseRating: team.defenseRating,
        offenseStyle:  team.offenseStyle,
        defenseStyle:  team.defenseStyle,
        tempo:         team.tempo,
        offensivePhilosophy: team.offensivePhilosophy,
        morale:        team.morale,
        salaryCap:     150_000_000,
        salaryUsed,
        injuries:      injuryReport.length,
        healAction,
        coaches:       team.coaches.sort((a, b) => coachRoleOrder(a.role) - coachRoleOrder(b.role)).map((coach) => ({
          id: coach.id,
          name: coach.name,
          role: coach.role,
          philosophy: coach.philosophy,
          developmentSpecialty: coach.developmentSpecialty,
          aggression: coach.aggression,
          moraleImpact: coach.moraleImpact,
          preferredTempo: coach.preferredTempo,
          reputation: coach.reputation,
          careerWins: coach.careerWins,
          careerLosses: coach.careerLosses,
          titles: coach.titles,
          hotSeat: coach.hotSeat,
          yearsWithTeam: coach.yearsWithTeam,
          age: coach.age,
        })),
      },
      injuryReport,
      lineupReadiness,
      schemes: schemes.map(schemePayload),
      playTemplates: {
        offense: templatesForUnit('offense'),
        defense: templatesForUnit('defense'),
      },
      groups: POSITION_GROUPS.map((group) => ({
        key:     group.key,
        label:   group.label,
        players: enriched
          .filter((player) => group.positions.includes(player.position))
          .sort((a, b) => (a.depthOrder ?? 999) - (b.depthOrder ?? 999) || b.overall - a.overall),
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

app.patch('/api/team/:teamId/depth-chart', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { playerIds } = req.body as { playerIds?: string[] };
    if (!Array.isArray(playerIds) || playerIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'playerIds is required' });
    }

    const players = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, position: true },
    });
    const byId = new Map(players.map((player) => [player.id, player]));
    const grouped: Record<string, string[]> = {};
    for (const playerId of playerIds) {
      const player = byId.get(playerId);
      if (!player) return res.status(400).json({ error: 'Depth chart contains a player outside this team' });
      grouped[player.position] = [...(grouped[player.position] ?? []), playerId];
    }

    const updates = Object.entries(grouped).flatMap(([, ids]) =>
      ids.map((id, index) => prisma.player.update({ where: { id }, data: { depthOrder: index } }))
    );
    await prisma.$transaction(updates);
    res.json({ ok: true });
  } catch (e) { next(e); }
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
      playTemplates: unit ? templatesForUnit(unit) : PLAY_TEMPLATES,
    });
  } catch (e) { next(e); }
});

app.post('/api/team/:teamId/schemes', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const unit = normalizeSchemeUnit(req.body?.unit);
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : null;
    if (!unit || !name) return res.status(400).json({ error: 'unit and name are required' });
    const plays = normalizePlayIds(unit, req.body?.plays);
    if (plays.length !== 9) return res.status(400).json({ error: 'Scheme must contain 9 valid plays' });

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
    if (Array.isArray(req.body?.plays)) data.plays = normalizePlayIds(unit, req.body.plays) as any;
    if (typeof req.body?.isDefault === 'boolean') data.isDefault = req.body.isDefault;
    const scheme = await prisma.teamScheme.update({ where: { id: schemeId }, data });
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
// Free-agent staff pool. Coaches are intentionally card-like: philosophy,
// development specialty, reputation, and cost are the decision surface.
app.get('/api/coaches/market', async (req, res, next) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    await ensureCoachCandidates();

    const [team, candidates] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId }, include: { coaches: true } }),
      prisma.coach.findMany({
        where: { teamId: null },
        orderBy: [{ reputation: 'desc' }, { age: 'asc' }],
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
      prisma.team.findUnique({ where: { id: teamId }, include: { coaches: true } }),
      prisma.coach.findUnique({ where: { id: coachId } }),
    ]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!incoming || incoming.teamId) return res.status(404).json({ error: 'Coach candidate not available' });

    const cost = coachCost(incoming);
    if (team.money < cost) return res.status(400).json({ error: 'Not enough cash to hire this coach' });

    const outgoing = team.coaches.find((coach) => coach.role === incoming.role);
    await prisma.$transaction([
      prisma.team.update({ where: { id: teamId }, data: { money: { decrement: cost } } }),
      ...(outgoing ? [prisma.coach.update({
        where: { id: outgoing.id },
        data: {
          teamId: null,
          yearsWithTeam: 0,
          hotSeat: Math.max(10, Math.round(outgoing.hotSeat * 0.6)),
        },
      })] : []),
      prisma.coach.update({
        where: { id: incoming.id },
        data: {
          teamId,
          yearsWithTeam: 1,
          hotSeat: Math.max(8, Math.round(incoming.hotSeat * 0.5)),
        },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST /api/team/:teamId/train ────────────────────────
//
// Two modes: STRENGTH lifts overall, CONDITIONING grants weeks of injury
// resistance. Trainer's developmentSpecialty matching the player's group
// upgrades the bonus in either mode.
type TrainMode = 'STRENGTH' | 'CONDITIONING';
app.post('/api/team/:teamId/train', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { playerId, mode } = req.body as { playerId?: string; mode?: TrainMode };
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });
    const trainMode: TrainMode = mode === 'CONDITIONING' ? 'CONDITIONING' : 'STRENGTH';

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { coaches: true } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const trainer = team.coaches.find((c) => c.role === 'TRAINER');
    if (!trainer) return res.status(409).json({ error: 'Hire a Trainer first' });

    const week = await currentRegularSeasonWeek(team.leagueId);
    if (week === null) return res.status(409).json({ error: 'No regular-season weeks remaining' });
    if (team.trainWeek >= week) return res.status(409).json({ error: 'Training already used this week' });

    if (team.money < TRAIN_COST) return res.status(409).json({ error: 'Not enough cash' });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.teamId !== teamId) return res.status(404).json({ error: 'Player not found on your team' });

    const specialtyMatch = trainer.developmentSpecialty === devGroup(player.position);

    if (trainMode === 'STRENGTH') {
      const delta = specialtyMatch ? 2 : 1;
      const newOverall = Math.min(player.potential, player.overall + delta);
      const actualDelta = newOverall - player.overall;
      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { overall: newOverall } }),
        prisma.team.update({ where: { id: teamId }, data: { money: { decrement: TRAIN_COST }, trainWeek: week } }),
      ]);
      return res.json({
        ok: true,
        mode: 'STRENGTH',
        cost: TRAIN_COST,
        player: { id: player.id, name: player.name, position: player.position, overall: newOverall, delta: actualDelta },
        atPotential: newOverall >= player.potential,
        specialtyMatch,
      });
    }

    const weeksAdded = specialtyMatch ? 4 : 3;
    const newConditioning = player.conditioning + weeksAdded;
    await prisma.$transaction([
      prisma.player.update({ where: { id: player.id }, data: { conditioning: newConditioning } }),
      prisma.team.update({ where: { id: teamId }, data: { money: { decrement: TRAIN_COST }, trainWeek: week } }),
    ]);
    res.json({
      ok: true,
      mode: 'CONDITIONING',
      cost: TRAIN_COST,
      player: { id: player.id, name: player.name, position: player.position, conditioning: newConditioning, weeksAdded },
      specialtyMatch,
    });
  } catch (e) { next(e); }
});

// ─── POST /api/team/:teamId/heal ─────────────────────────
//
// Use the Medical staff slot to advance a player's recovery one tier.
app.post('/api/team/:teamId/heal', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { playerId } = req.body as { playerId?: string };
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { coaches: true } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const medical = team.coaches.find((c) => c.role === 'MEDICAL');
    if (!medical) return res.status(409).json({ error: 'Hire a Medical staff member first' });

    const week = await currentRegularSeasonWeek(team.leagueId);
    if (week === null) return res.status(409).json({ error: 'No regular-season weeks remaining' });
    if (team.healWeek >= week) return res.status(409).json({ error: 'Medical already used this week' });

    const cost = healCostFor(medical);
    if (team.money < cost) return res.status(409).json({ error: 'Not enough cash' });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.teamId !== teamId) return res.status(404).json({ error: 'Player not found on your team' });
    if (player.injuryStatus === 'HEALTHY') return res.status(409).json({ error: 'Player is already healthy' });

    const next = downgradeInjury(player.injuryStatus, player.injuryWeeks);

    await prisma.$transaction([
      prisma.player.update({
        where: { id: player.id },
        data: { injuryStatus: next.status, injuryWeeks: next.weeks, injuryType: next.type },
      }),
      prisma.team.update({ where: { id: teamId }, data: { money: { decrement: cost }, healWeek: week } }),
    ]);

    res.json({
      ok: true,
      cost,
      player: { id: player.id, name: player.name, position: player.position, status: next.status, weeks: next.weeks },
    });
  } catch (e) { next(e); }
});

// ─── POST /api/team/:teamId/recruit ──────────────────────
//
// Use the Recruitment slot to surface 3 fresh listings biased by specialty.
app.post('/api/team/:teamId/recruit', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { coaches: true } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const scout = team.coaches.find((c) => c.role === 'RECRUITMENT');
    if (!scout) return res.status(409).json({ error: 'Hire a Recruitment scout first' });

    const week = await currentRegularSeasonWeek(team.leagueId);
    if (week === null) return res.status(409).json({ error: 'No regular-season weeks remaining' });
    if (team.recruitWeek >= week) return res.status(409).json({ error: 'Recruitment already used this week' });

    if (team.money < RECRUIT_COST) return res.status(409).json({ error: 'Not enough cash' });

    const candidates = await pickRecruitmentTargets(teamId, scout.developmentSpecialty);
    if (candidates.length === 0) return res.status(409).json({ error: 'No targets available right now' });

    const sample: Array<{ id: string; name: string; position: string; overall: number; age: number; teamName: string }> = [];
    for (const { team: sourceTeam, player } of candidates.slice(0, 3)) {
      const askingPrice = Math.round(playerMarketValue(player) * 0.92 / 100_000) * 100_000;
      await prisma.transferListing.upsert({
        where: { playerId: player.id },
        create: { playerId: player.id, sellerTeamId: sourceTeam.id, askingPrice },
        update: { status: 'ACTIVE', askingPrice },
      });
      sample.push({
        id: player.id, name: player.name, position: player.position,
        overall: player.overall, age: player.age, teamName: sourceTeam.name,
      });
    }

    await prisma.team.update({ where: { id: teamId }, data: { money: { decrement: RECRUIT_COST }, recruitWeek: week } });

    res.json({ ok: true, cost: RECRUIT_COST, specialty: scout.developmentSpecialty, listings: sample });
  } catch (e) { next(e); }
});

async function pickRecruitmentTargets(userTeamId: string, specialty: string) {
  const teams = await prisma.team.findMany({
    where: { id: { not: userTeamId } },
    include: { players: { where: { transferListing: null } } },
    take: 14,
  });
  const all = teams.flatMap((team) => team.players.map((player) => ({ team, player })));

  const score = (player: { age: number; overall: number; potential: number }) => {
    if (specialty === 'College') {
      return (player.age <= 24 ? 50 : 0) + Math.max(0, player.potential - player.overall) * 1.2 + player.overall * 0.4;
    }
    if (specialty === 'Pro') {
      return (player.age >= 25 && player.age <= 30 ? 30 : 0) + player.overall * 1.2;
    }
    return Math.random() * 80 + player.overall * 0.5;
  };

  return all
    .filter(({ player }) => player.overall >= 60)
    .sort((a, b) => score(b.player) - score(a.player))
    .slice(0, 6);
}

// ─── GET /api/market ─────────────────────────────────────
//
// Card-based transfer market. Creates a small AI listing pool when the market
// is thin so the screen always has story hooks.
app.get('/api/market', async (req, res, next) => {
  try {
    const userTeamId = req.query.teamId as string | undefined;
    if (!userTeamId) return res.status(400).json({ error: 'teamId is required' });

    await ensureMarketListings(userTeamId);
    await ensureIncomingOffers(userTeamId);

    const [userTeam, listings, offers] = await Promise.all([
      prisma.team.findUnique({ where: { id: userTeamId }, include: { players: true } }),
      prisma.transferListing.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: { player: true, sellerTeam: true },
        take: 40,
      }),
      prisma.transferOffer.findMany({
        where: { status: 'PENDING', listing: { sellerTeamId: userTeamId, status: 'ACTIVE' } },
        include: { buyerTeam: true, listing: { include: { player: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!userTeam) return res.status(404).json({ error: 'Team not found' });

    const salaryUsed = userTeam.players.reduce((sum, player) => sum + player.salary, 0);
    const salaryCap = 150_000_000;

    res.json({
      team: {
        id: userTeam.id,
        name: userTeam.name,
        money: userTeam.money,
        salaryCap,
        salaryUsed,
        capSpace: salaryCap - salaryUsed,
      },
      listings: listings.map((listing) => ({
        id: listing.id,
        askingPrice: listing.askingPrice,
        sellerTeam: {
          id: listing.sellerTeam.id,
          name: listing.sellerTeam.name,
          offenseStyle: listing.sellerTeam.offenseStyle,
          defenseStyle: listing.sellerTeam.defenseStyle,
          tempo: listing.sellerTeam.tempo,
        },
        player: marketPlayer(listing.player, listing.sellerTeam),
        canBuy: listing.sellerTeamId !== userTeamId &&
          userTeam.money >= listing.askingPrice &&
          salaryUsed + listing.player.salary <= salaryCap,
      })),
      incomingOffers: offers.map((offer) => ({
        id: offer.id,
        amount: offer.amount,
        buyerTeam: {
          id: offer.buyerTeam.id,
          name: offer.buyerTeam.name,
          offenseStyle: offer.buyerTeam.offenseStyle,
          defenseStyle: offer.buyerTeam.defenseStyle,
          tempo: offer.buyerTeam.tempo,
        },
        player: marketPlayer(offer.listing.player, userTeam),
      })),
    });
  } catch (e) { next(e); }
});

// ─── POST /api/market/list ───────────────────────────────
//
// List one of your players. Asking price is derived by valuation for now.
app.post('/api/market/list', async (req, res, next) => {
  try {
    const { teamId, playerId } = req.body as { teamId?: string; playerId?: string };
    if (!teamId || !playerId) return res.status(400).json({ error: 'teamId and playerId are required' });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.teamId !== teamId) return res.status(404).json({ error: 'Player not found on your team' });

    const listing = await prisma.transferListing.upsert({
      where: { playerId },
      create: {
        playerId,
        sellerTeamId: teamId,
        askingPrice: playerMarketValue(player),
      },
      update: {
        status: 'ACTIVE',
        sellerTeamId: teamId,
        askingPrice: playerMarketValue(player),
      },
    });
    res.json(listing);
  } catch (e) { next(e); }
});

// ─── DELETE /api/market/:listingId ───────────────────────
//
// Delist your player / reject market interest.
app.delete('/api/market/:listingId', async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    const listing = await prisma.transferListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerTeamId !== teamId) return res.status(404).json({ error: 'Listing not found for your team' });
    await prisma.transferListing.delete({ where: { id: listingId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST /api/market/:listingId/buy ─────────────────────
//
// Simple buy-now transaction. No negotiation yet.
app.post('/api/market/:listingId/buy', async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { buyerTeamId } = req.body as { buyerTeamId?: string };
    if (!buyerTeamId) return res.status(400).json({ error: 'buyerTeamId is required' });

    const listing = await prisma.transferListing.findUnique({
      where: { id: listingId },
      include: { player: true, sellerTeam: true },
    });
    if (!listing || listing.status !== 'ACTIVE') return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerTeamId === buyerTeamId) return res.status(400).json({ error: 'Cannot buy your own player' });

    const buyer = await prisma.team.findUnique({ where: { id: buyerTeamId }, include: { players: true } });
    if (!buyer) return res.status(404).json({ error: 'Buyer not found' });
    const salaryUsed = buyer.players.reduce((sum, player) => sum + player.salary, 0);
    if (buyer.money < listing.askingPrice) return res.status(400).json({ error: 'Not enough cash' });
    if (salaryUsed + listing.player.salary > 150_000_000) return res.status(400).json({ error: 'Salary cap exceeded' });

    const season = await currentSeasonNumber();
    await prisma.$transaction([
      prisma.team.update({ where: { id: buyerTeamId }, data: { money: { decrement: listing.askingPrice } } }),
      prisma.team.update({ where: { id: listing.sellerTeamId }, data: { money: { increment: listing.askingPrice } } }),
      prisma.player.update({ where: { id: listing.playerId }, data: { teamId: buyerTeamId, morale: Math.min(100, listing.player.morale + 4) } }),
      prisma.tradeHistory.create({
        data: {
          season,
          playerId: listing.playerId,
          playerName: listing.player.name,
          fromTeamId: listing.sellerTeamId,
          fromTeamName: listing.sellerTeam.name,
          toTeamId: buyerTeamId,
          toTeamName: buyer.name,
          fee: listing.askingPrice,
          story: `${buyer.name} bought ${listing.player.name} from ${listing.sellerTeam.name}.`,
        },
      }),
      prisma.transferOffer.deleteMany({ where: { listingId: listing.id } }),
      prisma.transferListing.delete({ where: { id: listing.id } }),
    ]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST /api/market/offers/:offerId/accept ─────────────
app.post('/api/market/offers/:offerId/accept', async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    const offer = await prisma.transferOffer.findUnique({
      where: { id: offerId },
      include: { buyerTeam: true, listing: { include: { player: true, sellerTeam: true } } },
    });
    if (!offer || offer.status !== 'PENDING' || offer.listing.sellerTeamId !== teamId) {
      return res.status(404).json({ error: 'Offer not found for your team' });
    }

    const season = await currentSeasonNumber();
    await prisma.$transaction([
      prisma.team.update({ where: { id: offer.buyerTeamId }, data: { money: { decrement: offer.amount } } }),
      prisma.team.update({ where: { id: offer.listing.sellerTeamId }, data: { money: { increment: offer.amount } } }),
      prisma.player.update({ where: { id: offer.listing.playerId }, data: { teamId: offer.buyerTeamId, morale: Math.min(100, offer.listing.player.morale + 3) } }),
      prisma.tradeHistory.create({
        data: {
          season,
          playerId: offer.listing.playerId,
          playerName: offer.listing.player.name,
          fromTeamId: offer.listing.sellerTeamId,
          fromTeamName: offer.listing.sellerTeam.name,
          toTeamId: offer.buyerTeamId,
          toTeamName: offer.buyerTeam.name,
          fee: offer.amount,
          story: `${offer.listing.sellerTeam.name} accepted ${offer.buyerTeam.name}'s offer for ${offer.listing.player.name}.`,
        },
      }),
      prisma.transferOffer.deleteMany({ where: { listingId: offer.listingId } }),
      prisma.transferListing.delete({ where: { id: offer.listingId } }),
    ]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── GET /api/history/:teamId ────────────────────────────
//
// Long-term memory for the league world: champions, team finishes, awards,
// and major market moves.
app.get('/api/history/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const [teamHistory, leagueHistory, trades] = await Promise.all([
      prisma.teamSeasonHistory.findMany({
        where: { teamId },
        orderBy: { season: 'desc' },
        take: 12,
      }),
      prisma.leagueSeasonHistory.findMany({
        orderBy: [{ season: 'desc' }, { tier: 'asc' }],
        take: 18,
      }),
      prisma.tradeHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      teamHistory,
      leagueHistory,
      trades,
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

// ─── POST /api/market/offers/:offerId/reject ─────────────
app.post('/api/market/offers/:offerId/reject', async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    const offer = await prisma.transferOffer.findUnique({ where: { id: offerId }, include: { listing: true } });
    if (!offer || offer.listing.sellerTeamId !== teamId) return res.status(404).json({ error: 'Offer not found for your team' });
    await prisma.transferOffer.delete({ where: { id: offerId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
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
        homeTeam: { include: { players: true, coaches: true } },
        awayTeam: { include: { players: true, coaches: true } },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const isUserHome = userTeamId === match.homeTeamId;
    const myTeam     = isUserHome ? match.homeTeam : match.awayTeam;
    const opp        = isUserHome ? match.awayTeam : match.homeTeam;

    const myProfile: TeamMatchProfile = {
      id:            myTeam.id,
      name:          myTeam.name,
      offenseRating: myTeam.offenseRating,
      defenseRating: myTeam.defenseRating,
      morale:        myTeam.morale,
      offenseStyle:  myTeam.offenseStyle,
      offensivePhilosophy: myTeam.offensivePhilosophy,
      defenseStyle:  myTeam.defenseStyle,
      tempo:         myTeam.tempo,
      coaches:       myTeam.coaches,
      players:       startersFromDepth(sortByDepth(myTeam.players)),
    };

    const oppProfile: TeamMatchProfile = {
      id:            opp.id,
      name:          opp.name,
      offenseRating: opp.offenseRating,
      defenseRating: opp.defenseRating,
      morale:        opp.morale,
      offenseStyle:  opp.offenseStyle,
      offensivePhilosophy: opp.offensivePhilosophy,
      defenseStyle:  opp.defenseStyle,
      tempo:         opp.tempo,
      coaches:       opp.coaches,
      players:       startersFromDepth(sortByDepth(opp.players)),
    };

    const recommendation = recommendGameplan(myProfile, oppProfile);
    const oppGroups      = computePositionGroups(startersFromDepth(sortByDepth(opp.players)));
    await ensureDefaultSchemes(myTeam.id);
    const mySchemes = await prisma.teamScheme.findMany({
      where: { teamId: myTeam.id },
      orderBy: [{ unit: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    const lineupReadiness = buildLineupReadiness(sortByDepth(myTeam.players));

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
        offenseStyle:  myTeam.offenseStyle,
        offensivePhilosophy: myTeam.offensivePhilosophy,
        defenseStyle:  myTeam.defenseStyle,
        tempo:         myTeam.tempo,
        offenseRating: myTeam.offenseRating,
        defenseRating: myTeam.defenseRating,
      },
      opponent: {
        id:            opp.id,
        name:          opp.name,
        offenseStyle:  opp.offenseStyle,
        offensivePhilosophy: opp.offensivePhilosophy,
        defenseStyle:  opp.defenseStyle,
        tempo:         opp.tempo,
        offenseRating: opp.offenseRating,
        defenseRating: opp.defenseRating,
        morale:        opp.morale,
        groups:        oppGroups,
      },
      recommendation,
      lineupReadiness,
      schemes: mySchemes.map(schemePayload),
      playTemplates: {
        offense: templatesForUnit('offense'),
        defense: templatesForUnit('defense'),
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
    offenseSchemeId: offense?.id ?? null,
    defenseSchemeId: defense?.id ?? null,
    offenseSchemeName: offense?.name,
    defenseSchemeName: defense?.name,
    offensivePlays: normalizePlayIds('offense', offense?.plays),
    defensivePlays: normalizePlayIds('defense', defense?.plays),
    tempoOverride: 'STANDARD',
  };
  return normalizeGameplan(raw, { offenseStyle: 'BALANCED', defenseStyle: 'BALANCED', tempo: 'NORMAL' });
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
      homeGameplan: normalizeGameplan(match.homeGameplan, match.homeTeam),
      awayGameplan: normalizeGameplan(match.awayGameplan, match.awayTeam),
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
          coaches: true,
          players: true,
        },
      }),
      prisma.league.findUnique({ where: { id: leagueId } }),
    ]);
    const standings = computeStandings(played, teams.map((t) => ({ id: t.id, name: t.name })));
    const styleByTeam = new Map(teams.map((t) => [t.id, {
      offenseStyle: t.offenseStyle,
      defenseStyle: t.defenseStyle,
      tempo:        t.tempo,
      coaches: t.coaches
        .filter((coach) => ['HEAD_COACH', 'OC', 'DC'].includes(coach.role))
        .map((coach) => ({
          id: coach.id,
          name: coach.name,
          role: coach.role,
          philosophy: coach.philosophy,
          reputation: coach.reputation,
        })),
      topPlayers: [...t.players]
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 3)
        .map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          overall: player.overall,
          age: player.age,
        })),
    }]));
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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
