import { prisma } from '../db';
import { generateRoundRobin } from './scheduleGenerator';
import { finalizeCurrentSeason } from './seasonHistory';
import { computeLeagueAwards, LeagueAwards } from './awards';
import { runLeaguePlayoffs, LeaguePlayoffBracket } from './playoffs';

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
  role: string;
  outgoingName: string;
  incomingName: string;
  reason: 'FIRED' | 'RETIRED' | 'POACHED';
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

const FIRST_NAMES = ['Marcus', 'Darius', 'Jordan', 'Tyler', 'Chris', 'Mike', 'James', 'Aaron', 'Josh', 'Derek', 'Malik', 'Jalen'];
const LAST_NAMES = ['Johnson', 'Williams', 'Smith', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Jackson', 'Reed', 'Hall', 'Morgan'];

export async function advanceOffseason(): Promise<OffseasonResult> {
  const archived = await finalizeCurrentSeason();
  const season = archived.season;

  const leagues = await prisma.league.findMany({ orderBy: { tier: 'asc' } });
  const leagueByTier = new Map(leagues.map((league) => [league.tier, league]));

  const awards = await computeAndStoreAwards(season, leagues);
  const playoffs = await runAndStorePlayoffs(season, leagues);

  // Fetched after playoffs so resultLabel reflects the playoff champion.
  const latestTeamHistories = await prisma.teamSeasonHistory.findMany({
    where: { season },
    orderBy: [{ tier: 'asc' }, { rank: 'asc' }],
  });

  const movements = await applyPromotionRelegation(latestTeamHistories, leagueByTier);
  await updateCoachRecords(latestTeamHistories);
  const retirements = await applyPlayerLifecycle(season);
  const progression = await applyProgressionAndContracts();
  const coachMoves = await applyCoachMovement(latestTeamHistories);
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
        morale: promoted ? { increment: 6 } : { decrement: 8 },
      },
    });
    movements.push(update.movement);
  }

  await clampTeamMorale();
  return movements;
}

async function applyPlayerLifecycle(season: number): Promise<Retirement[]> {
  const players = await prisma.player.findMany({ include: { team: true } });
  const retirements: Retirement[] = [];

  for (const player of players) {
    const newAge = player.age + 1;
    const shouldRetire =
      newAge >= 37 ||
      (newAge >= 35 && player.overall < 72) ||
      (newAge >= 34 && player.injuryStatus === 'MULTI_WEEK');

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
      await prisma.transferOffer.deleteMany({ where: { listing: { playerId: player.id } } });
      await prisma.transferListing.deleteMany({ where: { playerId: player.id } });
      await prisma.player.delete({ where: { id: player.id } });
      await createRookie(player.teamId, player.position);
      retirements.push({ playerName: player.name, teamName: player.team.name, age: newAge, overall: player.overall });
      continue;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        age: newAge,
        fatigue: 0,
        injuryStatus: 'HEALTHY',
        injuryType: null,
        injuryWeeks: 0,
        morale: Math.round(player.morale * 0.55 + 70 * 0.45),
      },
    });
  }

  return retirements;
}

async function applyProgressionAndContracts(): Promise<Progression> {
  const players = await prisma.player.findMany({ include: { team: { include: { coaches: true } } } });
  let improved = 0;
  let declined = 0;
  let freeAgentsListed = 0;

  for (const player of players) {
    const staff = player.team.coaches;
    const specialtyBoost = staff.some((coach) => coach.developmentSpecialty === playerDevelopmentGroup(player.position)) ? 1 : 0;
    const moraleImpact = Math.round(staff.reduce((sum, coach) => sum + coach.moraleImpact, 0) / Math.max(1, staff.length));
    const growth =
      player.age <= 23 ? 2 :
      player.age <= 26 ? 1 :
      player.age >= 32 ? -2 :
      player.age >= 30 ? -1 :
      0;
    const moraleNudge = player.morale + moraleImpact >= 78 ? 1 : player.morale + moraleImpact <= 55 ? -1 : 0;
    const delta = Math.max(-4, Math.min(4, growth + moraleNudge + (player.age <= 26 ? specialtyBoost : 0)));
    const overall = Math.max(35, Math.min(player.potential, player.overall + delta));
    if (overall > player.overall) improved++;
    if (overall < player.overall) declined++;

    const yearsLeft = Math.max(0, player.contractYearsLeft - 1);
    const shouldList = yearsLeft === 0 && player.overall >= 72;
    await prisma.player.update({
      where: { id: player.id },
      data: {
        overall,
        contractYearsLeft: shouldList ? 1 : yearsLeft,
        extensionEligible: shouldList || player.age >= 27 || overall >= 82,
      },
    });

    if (shouldList) {
      await prisma.transferListing.upsert({
        where: { playerId: player.id },
        create: {
          playerId: player.id,
          sellerTeamId: player.teamId,
          askingPrice: Math.round((overall * overall * 19_000 + player.salary * 1.5) / 100_000) * 100_000,
        },
        update: { status: 'ACTIVE' },
      });
      freeAgentsListed++;
    }
  }

  return { improved, declined, freeAgentsListed };
}

async function updateCoachRecords(histories: Array<{ teamId: string; rank: number; wins: number; losses: number; resultLabel: string }>): Promise<void> {
  for (const row of histories) {
    const hotSeatDelta =
      row.resultLabel === 'Champion' ? -22 :
      row.resultLabel === 'Promoted' ? -16 :
      row.resultLabel === 'Top Seed' ? -14 :
      row.resultLabel === 'Playoff Appearance' ? -8 :
      row.resultLabel === 'Relegation Danger' ? 22 :
      row.resultLabel === 'Bottom Tier' ? 10 :
      row.losses > row.wins ? 12 :
      -3;
    await prisma.coach.updateMany({
      where: { teamId: row.teamId },
      data: {
        careerWins: { increment: row.wins },
        careerLosses: { increment: row.losses },
        titles: { increment: row.resultLabel === 'Champion' ? 1 : 0 },
        hotSeat: { increment: hotSeatDelta },
        yearsWithTeam: { increment: 1 },
        age: { increment: 1 },
      },
    });
  }

  const coaches = await prisma.coach.findMany({ select: { id: true, hotSeat: true, reputation: true } });
  await Promise.all(coaches.map((coach) =>
    prisma.coach.update({
      where: { id: coach.id },
      data: {
        hotSeat: Math.max(0, Math.min(100, coach.hotSeat)),
        reputation: Math.max(25, Math.min(99, coach.reputation + (coach.hotSeat < 20 ? 2 : coach.hotSeat > 75 ? -2 : 0))),
      },
    })
  ));
}

async function applyCoachMovement(histories: Array<{ teamId: string; teamName: string; resultLabel: string; wins: number; losses: number }>): Promise<CoachMove[]> {
  const teams = await prisma.team.findMany({ include: { coaches: true } });
  const historyByTeam = new Map(histories.map((row) => [row.teamId, row]));
  const moves: CoachMove[] = [];

  for (const team of teams) {
    const history = historyByTeam.get(team.id);
    for (const coach of team.coaches) {
      const shouldRetire = coach.age >= 67 && coach.reputation >= 70;
      const shouldFire = coach.role === 'HEAD_COACH' && coach.hotSeat >= 78;
      const shouldPoach = coach.role !== 'HEAD_COACH' && coach.reputation >= 76 && history?.resultLabel !== 'Relegation Danger';
      if (!shouldRetire && !shouldFire && !shouldPoach) continue;

      const reason: CoachMove['reason'] = shouldRetire ? 'RETIRED' : shouldFire ? 'FIRED' : 'POACHED';
      const replacement = buildReplacementCoach(team.id, coach.role, team.offenseStyle, team.defenseStyle, team.tempo);
      await prisma.coach.delete({ where: { id: coach.id } });
      const incoming = await prisma.coach.create({ data: replacement as any });
      moves.push({
        teamName: team.name,
        role: coach.role,
        outgoingName: coach.name,
        incomingName: incoming.name,
        reason,
      });
    }
  }

  return moves;
}

async function applyCoachIdentityToTeams(): Promise<void> {
  const teams = await prisma.team.findMany({ include: { coaches: true } });
  for (const team of teams) {
    const hc = team.coaches.find((coach) => coach.role === 'HEAD_COACH');
    const oc = team.coaches.find((coach) => coach.role === 'OC');
    const dc = team.coaches.find((coach) => coach.role === 'DC');
    const offenseStyle =
      oc?.philosophy.includes('Vertical') ? 'PASS_HEAVY' :
      oc?.philosophy.includes('Ground') ? 'RUN_HEAVY' :
      team.offenseStyle;
    const defenseStyle =
      dc?.philosophy.includes('Pressure') ? 'AGGRESSIVE' :
      dc?.philosophy.includes('Coverage') ? 'PREVENT' :
      team.defenseStyle;
    await prisma.team.update({
      where: { id: team.id },
      data: {
        offenseStyle: offenseStyle as any,
        defenseStyle: defenseStyle as any,
        tempo: hc?.preferredTempo ?? team.tempo,
      },
    });
  }
}

async function rebuildSchedule(): Promise<number> {
  await prisma.transferOffer.deleteMany({ where: { listing: { status: { not: 'ACTIVE' } } } });
  await prisma.match.deleteMany();
  await prisma.team.updateMany({ data: { trainWeek: 0, healWeek: 0, recruitWeek: 0 } });

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

async function clampTeamMorale(): Promise<void> {
  const teams = await prisma.team.findMany({ select: { id: true, morale: true } });
  await Promise.all(teams.map((team) =>
    prisma.team.update({ where: { id: team.id }, data: { morale: Math.max(0, Math.min(100, team.morale)) } })
  ));
}

async function createRookie(teamId: string, position: string): Promise<void> {
  const base = ['QB', 'WR', 'CB', 'DE'].includes(position) ? 60 : 57;
  const overall = base + Math.floor(Math.random() * 8);
  const potential = Math.min(92, overall + 10 + Math.floor(Math.random() * 14));
  await prisma.player.create({
    data: {
      name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
      position,
      overall,
      potential,
      age: 21,
      morale: 70,
      fatigue: 0,
      salary: Math.round((700_000 + overall * overall * 260) / 100_000) * 100_000,
      contractYearsLeft: 3,
      extensionEligible: false,
      teamId,
    },
  });
}

function playerDevelopmentGroup(position: string): string {
  if (position === 'QB') return 'QB';
  if (['RB', 'WR', 'TE'].includes(position)) return 'Skill';
  if (position === 'OL') return 'OL';
  if (['DE', 'DT'].includes(position)) return 'DL';
  if (position === 'LB') return 'LB';
  if (['CB', 'S'].includes(position)) return 'Secondary';
  return 'Skill';
}

function buildReplacementCoach(teamId: string, role: string, offenseStyle: string, defenseStyle: string, tempo: string) {
  const medicalSpecialties = ['Soft Tissue', 'Orthopedic', 'Recovery'];
  const recruitmentSpecialties = ['College', 'Pro', 'International'];
  const specialty =
    role === 'OC' ? (offenseStyle === 'PASS_HEAVY' ? 'QB' : offenseStyle === 'RUN_HEAVY' ? 'OL' : 'Skill') :
    role === 'DC' ? (defenseStyle === 'PREVENT' ? 'Secondary' : defenseStyle === 'AGGRESSIVE' ? 'DL' : 'LB') :
    role === 'MEDICAL' ? medicalSpecialties[Math.floor(Math.random() * medicalSpecialties.length)] :
    role === 'RECRUITMENT' ? recruitmentSpecialties[Math.floor(Math.random() * recruitmentSpecialties.length)] :
    ['QB', 'Skill', 'OL', 'DL', 'LB', 'Secondary'][Math.floor(Math.random() * 6)];
  const trainerPhilosophies = ['Strength Coach', 'Skill Developer', 'Speed Specialist', 'Veteran Refiner'];
  const medicalPhilosophies = ['Preventive Specialist', 'Surgical Lead', 'Recovery Architect'];
  const recruitmentPhilosophies = ['College Pipeline', 'Free Agent Hunter', 'International Scout'];
  return {
    name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
    role,
    philosophy:
      role === 'OC' && offenseStyle === 'PASS_HEAVY' ? 'Vertical Architect' :
      role === 'OC' && offenseStyle === 'RUN_HEAVY' ? 'Ground Game Designer' :
      role === 'DC' && defenseStyle === 'AGGRESSIVE' ? 'Pressure Merchant' :
      role === 'DC' && defenseStyle === 'PREVENT' ? 'Coverage Professor' :
      role === 'HEAD_COACH' ? 'Program Stabilizer' :
      role === 'TRAINER' ? trainerPhilosophies[Math.floor(Math.random() * trainerPhilosophies.length)] :
      role === 'MEDICAL' ? medicalPhilosophies[Math.floor(Math.random() * medicalPhilosophies.length)] :
      role === 'RECRUITMENT' ? recruitmentPhilosophies[Math.floor(Math.random() * recruitmentPhilosophies.length)] :
      'Balanced Playcaller',
    developmentSpecialty: specialty,
    aggression: defenseStyle === 'AGGRESSIVE' ? 76 : offenseStyle === 'PASS_HEAVY' ? 70 : 52,
    moraleImpact: Math.floor(Math.random() * 8) - 1,
    preferredTempo: tempo as any,
    reputation: 42 + Math.floor(Math.random() * 24),
    hotSeat: 18 + Math.floor(Math.random() * 18),
    yearsWithTeam: 1,
    age: 34 + Math.floor(Math.random() * 22),
    teamId,
  };
}
