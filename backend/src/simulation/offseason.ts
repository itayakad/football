import { prisma } from '../db';
import { generateRoundRobin } from './scheduleGenerator';
import { finalizeCurrentSeason } from './seasonHistory';
import { computeLeagueAwards, LeagueAwards } from './awards';
import { runLeaguePlayoffs, LeaguePlayoffBracket } from './playoffs';
import {
  isCoachPosition,
  offenseStyleForOC,
  defenseStyleForDC,
} from './personnel';
import { clampRating, personnelSalary, randomCoachName, randomName, splitIntoStats } from '../seed';

interface Movement {
  teamId: string;
  teamName: string;
  fromTier: number;
  toTier: number;
  type: 'PROMOTED' | 'RELEGATED';
}

interface LeagueAwardsPayload {
  leagueId:   string;
  leagueName: string;
  tier:       number;
  awards:     LeagueAwards;
}

interface Retirement {
  playerName: string;
  teamName: string;
  age: number;
  overall: number;
}

interface Progression {
  improved: number;
  declined: number;
  freeAgentsListed: number;
}

interface CoachMove {
  teamName: string;
  position: string;
  outgoingName: string;
  incomingName: string;
  reason: 'FIRED' | 'RETIRED';
}

export interface OffseasonResult {
  season: number;
  champions: Array<{ leagueName: string; tier: number; championTeamName: string; mvpPlayerName: string | null }>;
  movements: Movement[];
  retirements: Retirement[];
  progression: Progression;
  coachMoves: CoachMove[];
  awards: LeagueAwardsPayload[];
  playoffs: LeaguePlayoffBracket[];
  nextSeasonWeekCount: number;
}

export async function advanceOffseason(): Promise<OffseasonResult> {
  const archived = await finalizeCurrentSeason();
  const season = archived.season;

  const leagues = await prisma.league.findMany({ orderBy: { tier: 'asc' } });
  const leagueByTier = new Map(leagues.map((league) => [league.tier, league]));

  const awards = await computeAndStoreAwards(season, leagues);
  const playoffs = await runAndStorePlayoffs(season, leagues);

  const latestTeamHistories = await prisma.teamSeasonHistory.findMany({
    where: { season },
    orderBy: [{ tier: 'asc' }, { rank: 'asc' }],
  });

  const movements = await applyPromotionRelegation(latestTeamHistories, leagueByTier);
  await updateCoachRecords(latestTeamHistories);
  const retirements = await applyPlayerLifecycle(season);
  const progression = await advanceContracts();
  const coachMoves = await applyCoachMovement();
  await applyCoachIdentityToTeams();
  const nextSeasonWeekCount = await rebuildSchedule();

  const playoffChampionByLeague = new Map(playoffs.map((bracket) => [bracket.leagueId, bracket]));
  const champions = archived.leagues.map((league) => {
    const bracket = playoffChampionByLeague.get(league.leagueId);
    return {
      leagueName: league.leagueName,
      tier: league.tier,
      championTeamName: bracket?.championTeamName ?? league.championTeamName,
      mvpPlayerName: league.mvpPlayerName,
    };
  });

  return {
    season,
    champions,
    movements,
    retirements,
    progression,
    coachMoves,
    awards,
    playoffs,
    nextSeasonWeekCount,
  };
}

async function computeAndStoreAwards(
  season: number,
  leagues: Array<{ id: string; name: string; tier: number }>,
): Promise<LeagueAwardsPayload[]> {
  const payloads: LeagueAwardsPayload[] = [];
  for (const league of leagues) {
    const awards = await computeLeagueAwards(season, league.id);
    await prisma.leagueSeasonHistory.update({
      where: { season_leagueId: { season, leagueId: league.id } },
      data: { awards: awards as any },
    });
    payloads.push({ leagueId: league.id, leagueName: league.name, tier: league.tier, awards });
  }
  return payloads;
}

async function runAndStorePlayoffs(
  season: number,
  leagues: Array<{ id: string; name: string; tier: number }>,
): Promise<LeaguePlayoffBracket[]> {
  const brackets: LeaguePlayoffBracket[] = [];
  for (const league of leagues) {
    const bracket = await runLeaguePlayoffs(season, league.id, league.name);
    await prisma.leagueSeasonHistory.update({
      where: { season_leagueId: { season, leagueId: league.id } },
      data: {
        playoffBracket: bracket as any,
        championTeamId: bracket.championTeamId ?? undefined,
        championTeamName: bracket.championTeamName ?? undefined,
      },
    });
    if (bracket.championTeamId) {
      await prisma.teamSeasonHistory.updateMany({
        where: { season, teamId: bracket.championTeamId },
        data: { resultLabel: 'Champion' },
      });
    }
    brackets.push(bracket);
  }
  return brackets;
}

async function applyPromotionRelegation(
  histories: Array<{ teamId: string; teamName: string; tier: number; rank: number }>,
  leagueByTier: Map<number, { id: string; tier: number }>,
): Promise<Movement[]> {
  const movements: Movement[] = [];
  const updates: Array<{ teamId: string; leagueId: string; movement: Movement }> = [];

  for (const tier of [2, 3]) {
    const targetLeague = leagueByTier.get(tier - 1);
    if (!targetLeague) continue;
    const promoted = histories.filter((row) => row.tier === tier && row.rank <= 3);
    for (const team of promoted) {
      const movement: Movement = { teamId: team.teamId, teamName: team.teamName, fromTier: tier, toTier: tier - 1, type: 'PROMOTED' };
      updates.push({ teamId: team.teamId, leagueId: targetLeague.id, movement });
    }
  }

  for (const tier of [1, 2]) {
    const targetLeague = leagueByTier.get(tier + 1);
    if (!targetLeague) continue;
    const tierRows = histories.filter((row) => row.tier === tier).sort((a, b) => b.rank - a.rank);
    const relegated = tierRows.slice(0, 3);
    for (const team of relegated) {
      const movement: Movement = { teamId: team.teamId, teamName: team.teamName, fromTier: tier, toTier: tier + 1, type: 'RELEGATED' };
      updates.push({ teamId: team.teamId, leagueId: targetLeague.id, movement });
    }
  }

  for (const update of updates) {
    const promoted = update.movement.type === 'PROMOTED';
    await prisma.team.update({
      where: { id: update.teamId },
      data: {
        leagueId: update.leagueId,
        money: { increment: promoted ? 18_000_000 : -12_000_000 },
      },
    });
    movements.push(update.movement);
  }

  return movements;
}

// Players age and retire on age thresholds. No progression / decline; players
// keep their seeded ratings until they retire.
async function applyPlayerLifecycle(season: number): Promise<Retirement[]> {
  const players = await prisma.personnel.findMany({
    where: { teamId: { not: null }, position: { notIn: ['HC', 'OC', 'DC'] } },
    include: { team: true },
  });
  const retirements: Retirement[] = [];

  for (const player of players) {
    if (!player.team || !player.teamId) continue;
    const newAge = player.age + 1;
    const shouldRetire =
      newAge >= 37 ||
      (newAge >= 35 && player.overall < 72);

    if (shouldRetire) {
      const story = `${player.name} retired after ${newAge - 21} pro seasons with ${player.team.name}.`;
      await prisma.retirementHistory.create({
        data: {
          season,
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          teamName: player.team.name,
          age: newAge,
          overall: player.overall,
          story,
        },
      });
      await prisma.personnel.delete({ where: { id: player.id } });
      await createRookie(player.teamId, player.position);
      retirements.push({ playerName: player.name, teamName: player.team.name, age: newAge, overall: player.overall });
      continue;
    }

    await prisma.personnel.update({
      where: { id: player.id },
      data: { age: newAge },
    });
  }

  return retirements;
}

// Just decrement contract years for everyone still under contract. No
// progression / extension UI / market listing — stripped down.
async function advanceContracts(): Promise<Progression> {
  const rows = await prisma.personnel.findMany({
    where: { teamId: { not: null } },
    select: { id: true, contractYearsLeft: true },
  });
  for (const row of rows) {
    const yearsLeft = Math.max(0, row.contractYearsLeft - 1);
    await prisma.personnel.update({
      where: { id: row.id },
      data: { contractYearsLeft: yearsLeft },
    });
  }
  return { improved: 0, declined: 0, freeAgentsListed: 0 };
}

async function updateCoachRecords(
  histories: Array<{ teamId: string; resultLabel: string; wins: number; losses: number }>,
): Promise<void> {
  for (const row of histories) {
    await prisma.personnel.updateMany({
      where: { teamId: row.teamId, position: { in: ['HC', 'OC', 'DC'] } },
      data: {
        careerWins: { increment: row.wins },
        careerLosses: { increment: row.losses },
        titles: { increment: row.resultLabel === 'Champion' ? 1 : 0 },
        yearsWithTeam: { increment: 1 },
        age: { increment: 1 },
      },
    });
  }
}

async function applyCoachMovement(): Promise<CoachMove[]> {
  const teams = await prisma.team.findMany({ include: { personnel: true } });
  const moves: CoachMove[] = [];

  for (const team of teams) {
    const coaches = team.personnel.filter((p) => isCoachPosition(p.position));
    for (const coach of coaches) {
      const shouldRetire = coach.age >= 67 && coach.overall >= 70;
      if (!shouldRetire) continue;

      const replacement = buildReplacementCoach(team.id, coach.position, team.offenseStyle, team.defenseStyle);
      await prisma.personnel.delete({ where: { id: coach.id } });
      const incoming = await prisma.personnel.create({ data: replacement });
      moves.push({
        teamName: team.name,
        position: coach.position,
        outgoingName: coach.name,
        incomingName: incoming.name,
        reason: 'RETIRED',
      });
    }
  }

  return moves;
}

async function applyCoachIdentityToTeams(): Promise<void> {
  const teams = await prisma.team.findMany({ include: { personnel: true } });
  for (const team of teams) {
    const oc = team.personnel.find((p) => p.position === 'OC');
    const dc = team.personnel.find((p) => p.position === 'DC');
    const offenseStyle = oc ? offenseStyleForOC(oc.stat1, oc.stat2) : team.offenseStyle;
    const defenseStyle = dc ? defenseStyleForDC(dc.stat1, dc.stat2) : team.defenseStyle;
    await prisma.team.update({
      where: { id: team.id },
      data: {
        offenseStyle: offenseStyle as any,
        defenseStyle: defenseStyle as any,
      },
    });
  }
}

async function rebuildSchedule(): Promise<number> {
  await prisma.match.deleteMany();

  const leagues = await prisma.league.findMany({
    include: { teams: true },
    orderBy: { tier: 'asc' },
  });
  let weekCount = 0;

  for (const league of leagues) {
    const fixtures = generateRoundRobin(league.teams.map((team) => team.id));
    weekCount = Math.max(weekCount, ...fixtures.map((fixture) => fixture.week));
    await prisma.match.createMany({
      data: fixtures.map((fixture) => ({
        homeTeamId: fixture.homeId,
        awayTeamId: fixture.awayId,
        week: fixture.week,
        leagueId: league.id,
        homeScore: 0,
        awayScore: 0,
        played: false,
      })),
    });
  }

  return weekCount;
}

async function createRookie(teamId: string, position: string): Promise<void> {
  const base = ['QB', 'WR', 'CB', 'DE'].includes(position) ? 60 : 57;
  const overall = base + Math.floor(Math.random() * 8);
  const { stat1, stat2 } = splitIntoStats(overall);
  const age = 21;
  await prisma.personnel.create({
    data: {
      name: randomName(),
      position,
      stat1,
      stat2,
      overall: Math.round((stat1 + stat2) / 2),
      age,
      salary: personnelSalary(position, overall, age),
      contractYearsLeft: 3,
      yearsWithTeam: 1,
      teamId,
    },
  });
}

function buildReplacementCoach(teamId: string, position: string, offenseStyle: string, defenseStyle: string) {
  const baseRating = 50 + Math.floor(Math.random() * 20);
  const stat1 = clampRating(baseRating + (offenseStyle === 'PASS_HEAVY' || offenseStyle === 'RUN_HEAVY' ? 3 : 0) + Math.floor(Math.random() * 20) - 8);
  const stat2 = clampRating(baseRating + (defenseStyle === 'AGGRESSIVE' || defenseStyle === 'PREVENT' ? 3 : 0) + Math.floor(Math.random() * 20) - 8);
  const overall = Math.round((stat1 + stat2) / 2);
  const age = 34 + Math.floor(Math.random() * 22);
  const years = position === 'HC' ? 4 : 3;
  return {
    name: randomCoachName(),
    position,
    overall,
    stat1,
    stat2,
    age,
    salary: personnelSalary(position, overall, age),
    contractYearsLeft: years,
    yearsWithTeam: 1,
    teamId,
  };
}
