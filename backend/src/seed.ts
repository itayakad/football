import 'dotenv/config';
import { prisma } from './db';
import { generateRoundRobin } from './simulation/scheduleGenerator';
import { DEFENSIVE_PLAYS, OFFENSIVE_PLAYS, PlayCategory } from './simulation/playLibrary';

// ─── Name Data ────────────────────────────────────────────

const FIRST_NAMES = [
  'Marcus', 'Darius', 'Jordan', 'Tyler', 'Chris', 'Mike', 'James', 'Aaron',
  'Josh', 'Derek', 'Kevin', 'Anthony', 'Ryan', 'David', 'Will', 'Jason',
  'Brandon', 'Travis', 'Malik', 'Justin', 'Cam', 'Lamar', 'Patrick', 'Baker',
  'Trevor', 'Tua', 'Zach', 'Davis', 'Sam', 'DJ', 'Cooper', 'Davante',
  'Stefon', 'Tyreek', 'George', 'Tony', 'Robert', 'Alvin', 'Derrick', 'Nick',
  'Christian', 'Austin', 'Carson', 'Jalen', 'Trey', 'Deebo', 'Jonathan', 'Amon',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Smith', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore',
  'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Garcia',
  'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall',
  'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott',
  'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez',
  'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins',
  'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy',
];

const COACH_FIRST_NAMES = ['Frank', 'Marty', 'Calvin', 'Shane', 'Victor', 'Eli', 'Grant', 'Wes', 'Nolan', 'Ray', 'DeMarcus', 'Cole'];
const COACH_LAST_NAMES = ['Hayes', 'Bennett', 'Porter', 'Hughes', 'Walsh', 'Foster', 'Carver', 'Brooks', 'Madden', 'Sullivan', 'Pierce', 'Graves'];

// ─── League Config ────────────────────────────────────────

const LEAGUES = [
  { name: 'Premier Division', tier: 1 },
  { name: 'First Division',   tier: 2 },
  { name: 'Second Division',  tier: 3 },
];

const TEAMS_BY_TIER: Record<number, Array<{
  name: string;
  offense: number;
  defense: number;
  offenseStyle: string;
  defenseStyle: string;
}>> = {
  1: [
    { name: 'New York Titans',    offense: 88, defense: 82, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' },
    { name: 'Los Angeles Wolves', offense: 83, defense: 79, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   },
    { name: 'Chicago Storm',      offense: 78, defense: 85, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' },
    { name: 'Dallas Vanguard',    offense: 85, defense: 75, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' },
    { name: 'Miami Thunder',      offense: 76, defense: 78, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT'    },
    { name: 'Seattle Falcons',    offense: 80, defense: 83, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT'    },
    { name: 'Boston Monarchs',    offense: 74, defense: 80, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   },
    { name: 'Denver Pioneers',    offense: 79, defense: 76, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' },
    { name: 'Philadelphia Liberty', offense: 81, defense: 79, offenseStyle: 'BALANCED', defenseStyle: 'BALANCED'   },
    { name: 'Pittsburgh Iron',     offense: 74, defense: 86, offenseStyle: 'RUN_HEAVY', defenseStyle: 'AGGRESSIVE' },
  ],
  2: [
    { name: 'Atlanta Blaze',      offense: 73, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' },
    { name: 'Houston Force',      offense: 68, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' },
    { name: 'Phoenix Fury',       offense: 70, defense: 65, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   },
    { name: 'Portland Surge',     offense: 65, defense: 71, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT'    },
    { name: 'Nashville Vipers',   offense: 67, defense: 69, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   },
    { name: 'Kansas Stallions',   offense: 72, defense: 67, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' },
    { name: 'Tampa Barracudas',   offense: 64, defense: 71, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT'    },
    { name: 'San Diego Aviators', offense: 71, defense: 66, offenseStyle: 'BALANCED',   defenseStyle: 'BALANCED'   },
    { name: 'Detroit Motors',     offense: 70, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' },
    { name: 'Cleveland Anchors',  offense: 65, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'PREVENT'    },
  ],
  3: [
    { name: 'Columbus Crushers',    offense: 62, defense: 57, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' },
    { name: 'Birmingham Bulls',     offense: 55, defense: 62, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   },
    { name: 'Raleigh Rockets',      offense: 58, defense: 55, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' },
    { name: 'Sacramento Strikers',  offense: 61, defense: 59, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT'    },
    { name: 'Louisville Lightning', offense: 54, defense: 58, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   },
    { name: 'Omaha Outlaws',        offense: 57, defense: 56, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' },
    { name: 'Tulsa Tigers',         offense: 60, defense: 54, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT'    },
    { name: 'Albuquerque Arsenal',  offense: 53, defense: 60, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   },
    { name: 'Memphis Mules',        offense: 56, defense: 59, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' },
    { name: 'Saint Louis Sentinels',offense: 60, defense: 56, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   },
  ],
};

const STARTER_COUNTS_BY_POSITION: Record<string, number> = {
  QB: 1, RB: 2, WR: 2, TE: 1, OL: 5, DE: 2, DT: 2, LB: 3, CB: 3, S: 2,
};

// 39 players per team.
const POSITION_DISTRIBUTION = [
  { position: 'QB',  count: 2 },
  { position: 'RB',  count: 4 },
  { position: 'WR',  count: 5 },
  { position: 'TE',  count: 2 },
  { position: 'OL',  count: 7 },
  { position: 'DE',  count: 4 },
  { position: 'DT',  count: 3 },
  { position: 'LB',  count: 5 },
  { position: 'CB',  count: 4 },
  { position: 'S',   count: 3 },
]; // total = 39

for (const { position, count } of POSITION_DISTRIBUTION) {
  const minimum = (STARTER_COUNTS_BY_POSITION[position] ?? 1) + 1;
  if (count < minimum) {
    throw new Error(`POSITION_DISTRIBUTION requires at least ${minimum} ${position} players per team`);
  }
}

// ─── Helpers ──────────────────────────────────────────────

export { TEAMS_BY_TIER, POSITION_DISTRIBUTION };

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomName(): string {
  return `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`;
}

export function randomCoachName(): string {
  return `${randomElement(COACH_FIRST_NAMES)} ${randomElement(COACH_LAST_NAMES)}`;
}

export function clampRating(value: number): number {
  return Math.max(35, Math.min(99, value));
}

// Salary derivation (used only when generating new candidates; stored salary
// stays authoritative once written).
export function personnelSalary(position: string, overall: number, age = 27, titles = 0): number {
  if (position === 'HC') {
    return Math.round((1_500_000 + overall * overall * 2_200 * 1.8 + titles * 850_000) / 100_000) * 100_000;
  }
  if (position === 'OC' || position === 'DC') {
    return Math.round((1_500_000 + overall * overall * 2_200 + titles * 850_000) / 100_000) * 100_000;
  }
  // Player
  const agePremium = age >= 27 && age <= 31 ? 250_000 : age >= 32 ? -150_000 : 0;
  return Math.max(700_000, Math.round((350_000 + overall * overall * 420 + agePremium) / 100_000) * 100_000);
}

// Splits an overall into two stored stats. Diff sign is randomized so the
// archetype derivation can land on either stat1-dominant or stat2-dominant tiers.
export function splitIntoStats(overall: number): { stat1: number; stat2: number } {
  const delta = randomInt(0, 8);
  const flip = Math.random() < 0.5 ? 1 : -1;
  const stat1 = clampRating(overall + delta * flip);
  const stat2 = clampRating(overall - delta * flip);
  return { stat1, stat2 };
}

export function generateOverall(age: number, tier: number): number {
  const [min, max]: [number, number] = tier === 1 ? [74, 92] : tier === 2 ? [62, 80] : [50, 68];
  const base = randomInt(min, max);
  const agePenalty =
    age <= 23 ? randomInt(8, 15) :
    age <= 26 ? randomInt(3, 7)  :
    age <= 30 ? 0                :
                randomInt(3, 10);
  return Math.max(30, Math.min(99, base - agePenalty));
}

// ─── Seed ─────────────────────────────────────────────────

export async function seedWorld(): Promise<void> {
  const leagues = await Promise.all(
    LEAGUES.map((l) => prisma.league.create({ data: l }))
  );
  console.log(`  ✓ ${leagues.length} leagues`);

  const allTeamMeta: Array<{ id: string; leagueId: string; tier: number; offenseStyle: string; defenseStyle: string }> = [];

  for (const league of leagues) {
    const configs = TEAMS_BY_TIER[league.tier];
    const teams = await Promise.all(
      configs.map((c) =>
        prisma.team.create({
          data: {
            name:          c.name,
            leagueId:      league.id,
            offenseRating: c.offense,
            defenseRating: c.defense,
            offenseStyle:  c.offenseStyle as any,
            offensivePhilosophy: philosophyForStyle(c.offenseStyle) as any,
            defenseStyle:  c.defenseStyle as any,
            offensivePlays: offensiveLoadoutForStyle(c.offenseStyle) as any,
            defensivePlays: defensiveLoadoutForStyle(c.defenseStyle) as any,
            money:         150_000_000,
          },
        })
      )
    );
    teams.forEach((t, idx) => allTeamMeta.push({
      id: t.id,
      leagueId: league.id,
      tier: league.tier,
      offenseStyle: configs[idx].offenseStyle,
      defenseStyle: configs[idx].defenseStyle,
    }));
  }
  console.log(`  ✓ ${allTeamMeta.length} teams`);

  // Coaches (HC, OC, DC) + players (QB..S) all go into the same Personnel table.
  const personnelData: Array<{
    name: string;
    position: string;
    overall: number;
    stat1: number;
    stat2: number;
    age: number;
    salary: number;
    contractYearsLeft: number;
    yearsWithTeam: number;
    teamId: string;
  }> = [];

  for (const team of allTeamMeta) {
    personnelData.push(...buildPersonnelStaff(team.id, team.offenseStyle, team.defenseStyle));
    for (const { position, count } of POSITION_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        const age     = randomInt(21, 35);
        const overall = generateOverall(age, team.tier);
        const { stat1, stat2 } = splitIntoStats(overall);
        personnelData.push({
          name:    randomName(),
          position,
          overall: Math.round((stat1 + stat2) / 2),
          stat1,
          stat2,
          age,
          salary:  personnelSalary(position, overall, age),
          contractYearsLeft: randomInt(1, 4),
          yearsWithTeam: 1,
          teamId: team.id,
        });
      }
    }
  }

  await prisma.personnel.createMany({ data: personnelData });
  console.log(`  ✓ ${personnelData.length} personnel (coaches + players)`);

  let totalMatches = 0;
  for (const league of leagues) {
    const teamIds = allTeamMeta.filter((t) => t.leagueId === league.id).map((t) => t.id);
    const fixtures = generateRoundRobin(teamIds);

    await prisma.match.createMany({
      data: fixtures.map((f) => ({
        homeTeamId: f.homeId,
        awayTeamId: f.awayId,
        week:       f.week,
        leagueId:   league.id,
        homeScore:  0,
        awayScore:  0,
        played:     false,
      })),
    });

    totalMatches += fixtures.length;
  }

  console.log(`  ✓ ${totalMatches} matches scheduled`);
}

function loadoutByWeights<T extends { id: string; category: PlayCategory }>(
  plays: T[],
  weights: Array<[PlayCategory, number]>,
): string[] {
  const out: string[] = [];
  for (const [category, count] of weights) {
    out.push(...plays.filter((play) => play.category === category).slice(0, count).map((play) => play.id));
  }
  for (const play of plays) {
    if (out.length >= 9) break;
    if (!out.includes(play.id)) out.push(play.id);
  }
  return out.slice(0, 9);
}

function offensiveLoadoutForStyle(offenseStyle: string): string[] {
  if (offenseStyle === 'PASS_HEAVY') {
    return loadoutByWeights(OFFENSIVE_PLAYS, [['LONG_PASS', 3], ['MIDDLE_PASS', 3], ['SHORT_PASS', 2], ['RUNNING', 1]]);
  }
  if (offenseStyle === 'RUN_HEAVY') {
    return loadoutByWeights(OFFENSIVE_PLAYS, [['RUNNING', 5], ['MIDDLE_PASS', 2], ['SHORT_PASS', 1], ['LONG_PASS', 1]]);
  }
  return loadoutByWeights(OFFENSIVE_PLAYS, [['RUNNING', 3], ['SHORT_PASS', 2], ['MIDDLE_PASS', 2], ['LONG_PASS', 2]]);
}

function defensiveLoadoutForStyle(defenseStyle: string): string[] {
  if (defenseStyle === 'AGGRESSIVE') {
    return loadoutByWeights(DEFENSIVE_PLAYS, [['BLITZ', 4], ['ZONE_BLITZ', 3], ['MAN', 1], ['ZONE', 1]]);
  }
  if (defenseStyle === 'PREVENT') {
    return loadoutByWeights(DEFENSIVE_PLAYS, [['ZONE', 4], ['MAN', 3], ['ZONE_BLITZ', 1], ['BLITZ', 1]]);
  }
  return loadoutByWeights(DEFENSIVE_PLAYS, [['ZONE', 3], ['BLITZ', 2], ['ZONE_BLITZ', 2], ['MAN', 2]]);
}

// HC + OC + DC for a team. Coordinator stat1/stat2 semantics:
//   OC: stat1 = pass scheming, stat2 = run scheming
//   DC: stat1 = run defense,  stat2 = pass defense
export function buildPersonnelStaff(teamId: string, offenseStyle: string, defenseStyle: string) {
  const hcOvr = randomInt(50, 82);
  const ocOvr = randomInt(45, 78);
  const dcOvr = randomInt(45, 78);

  // HC
  const hcOffense = clampRating(hcOvr + (offenseStyle === 'PASS_HEAVY' || offenseStyle === 'RUN_HEAVY' ? randomInt(2, 8) : randomInt(-2, 5)));
  const hcDefense = clampRating(hcOvr + (defenseStyle === 'AGGRESSIVE' || defenseStyle === 'PREVENT' ? randomInt(2, 8) : randomInt(-2, 5)));
  const hcOverall = Math.round((hcOffense + hcDefense) / 2);
  const hcAge = randomInt(39, 64);

  // OC
  const ocStat1 = clampRating(ocOvr + randomInt(-8, 12));
  const ocStat2 = clampRating(ocOvr + randomInt(-8, 12));
  const ocOverall = Math.round((ocStat1 + ocStat2) / 2);
  const ocAge = randomInt(34, 58);

  // DC
  const dcStat1 = clampRating(dcOvr + randomInt(-8, 12));
  const dcStat2 = clampRating(dcOvr + randomInt(-8, 12));
  const dcOverall = Math.round((dcStat1 + dcStat2) / 2);
  const dcAge = randomInt(34, 60);

  return [
    {
      name: randomCoachName(),
      position: 'HC',
      overall: hcOverall,
      stat1: hcOffense,
      stat2: hcDefense,
      age: hcAge,
      salary: personnelSalary('HC', hcOverall, hcAge),
      contractYearsLeft: 4,
      yearsWithTeam: 1,
      teamId,
    },
    {
      name: randomCoachName(),
      position: 'OC',
      overall: ocOverall,
      stat1: ocStat1,
      stat2: ocStat2,
      age: ocAge,
      salary: personnelSalary('OC', ocOverall, ocAge),
      contractYearsLeft: 3,
      yearsWithTeam: 1,
      teamId,
    },
    {
      name: randomCoachName(),
      position: 'DC',
      overall: dcOverall,
      stat1: dcStat1,
      stat2: dcStat2,
      age: dcAge,
      salary: personnelSalary('DC', dcOverall, dcAge),
      contractYearsLeft: 3,
      yearsWithTeam: 1,
      teamId,
    },
  ];
}

export function philosophyForStyle(offenseStyle: string): string {
  if (offenseStyle === 'PASS_HEAVY') return 'VERTICAL_SPREAD';
  if (offenseStyle === 'RUN_HEAVY') return 'SMASHMOUTH';
  return 'WEST_COAST';
}

async function clearAndSeed() {
  await prisma.retirementHistory.deleteMany();
  await prisma.teamSeasonHistory.deleteMany();
  await prisma.leagueSeasonHistory.deleteMany();
  await prisma.seasonHistory.deleteMany();
  await prisma.teamScheme.deleteMany();
  await prisma.personnel.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
  await seedWorld();
}

if (require.main === module) {
  clearAndSeed()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
