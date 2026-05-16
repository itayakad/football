import 'dotenv/config';
import { prisma } from './db';
import { generateRoundRobin } from './simulation/scheduleGenerator';
import { DEFENSIVE_PLAYS, OFFENSIVE_PLAYS, PlayCategory } from './simulation/playLibrary';
import {
  pickDCPhilosophy,
  pickHeadCoachPhilosophy,
  pickOCPhilosophy,
} from './simulation/coachPhilosophy';
import { deriveTeamIdentity, TeamIdentity } from './simulation/teamIdentity';

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
const DEVELOPMENT_SPECIALTIES = ['QB', 'Skill', 'OL', 'DL', 'LB', 'Secondary'];

// ─── League Config ────────────────────────────────────────

const LEAGUES = [
  { name: 'Premier Division', tier: 1 },
  { name: 'First Division',   tier: 2 },
  { name: 'Second Division',  tier: 3 },
];

// Each team has a distinct philosophical identity — not just ratings.
// This is what makes games feel different from each other.
//
const TEAMS_BY_TIER: Record<number, Array<{
  name: string;
  offense: number;
  defense: number;
  offenseStyle: string;
  defenseStyle: string;
}>> = {
  1: [
    { name: 'New York Titans',    offense: 88, defense: 82, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' }, // Complete team
    { name: 'Los Angeles Wolves', offense: 83, defense: 79, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   }, // Hollywood air raid
    { name: 'Chicago Storm',      offense: 78, defense: 85, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' }, // Smashmouth identity
    { name: 'Dallas Vanguard',    offense: 85, defense: 75, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' }, // Gunslinger
    { name: 'Miami Thunder',      offense: 76, defense: 78, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT'    }, // Spread + bend-don't-break
    { name: 'Seattle Falcons',    offense: 80, defense: 83, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT'    }, // Conservative, wins ugly
    { name: 'Boston Monarchs',    offense: 74, defense: 80, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   }, // Clock-eating grinders
    { name: 'Denver Pioneers',    offense: 79, defense: 76, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' }, // Solid two-way team
    { name: 'Philadelphia Liberty', offense: 81, defense: 79, offenseStyle: 'BALANCED',   defenseStyle: 'BALANCED'   }, // Well-rounded contender
    { name: 'Pittsburgh Iron',     offense: 74, defense: 86, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' }, // Old-school heavy
  ],
  2: [
    { name: 'Atlanta Blaze',      offense: 73, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' }, // High-risk, high-reward
    { name: 'Houston Force',      offense: 68, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE' }, // Power football
    { name: 'Phoenix Fury',       offense: 70, defense: 65, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED'   }, // Desert air attack
    { name: 'Portland Surge',     offense: 65, defense: 71, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT'    }, // Defensive grinders
    { name: 'Nashville Vipers',   offense: 67, defense: 69, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED'   }, // Old-school ground game
    { name: 'Kansas Stallions',   offense: 72, defense: 67, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE' }, // Press defense identity
    { name: 'Tampa Barracudas',   offense: 64, defense: 71, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT'    }, // Air raid + prevent
    { name: 'San Diego Aviators', offense: 71, defense: 66, offenseStyle: 'BALANCED',   defenseStyle: 'BALANCED'   }, // Well-rounded
    { name: 'Detroit Motors',     offense: 70, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE' }, // Modern, gritty
    { name: 'Cleveland Anchors',  offense: 65, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'PREVENT'    }, // Defense-first grinders
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

// Formation minimums plus at least one backup at every position.
// This is the current roster safety rule until cutting/offseason roster management
// gets a fuller contract.
const STARTER_COUNTS_BY_POSITION: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  OL: 5,
  DE: 2,
  DT: 2,
  LB: 3,
  CB: 3,
  S:  2,
};

// 39 players per team. Mirrors a compressed 53-man NFL roster (no special teams).
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

function randomCoachName(): string {
  return `${randomElement(COACH_FIRST_NAMES)} ${randomElement(COACH_LAST_NAMES)}`;
}

function coachSalary(role: string, reputation: number, titles = 0): number {
  const rolePremium = role === 'HEAD_COACH' ? 1.8 : 1.0;
  return Math.round((1_500_000 + reputation * reputation * 2_200 * rolePremium + titles * 850_000) / 100_000) * 100_000;
}

// Age curve: young players are rawer, veterans are settled.
// Split an overall into two stored stats (high/low) such that their average
// reconstructs the overall. Variance is randomized so two 70-OVR players don't
// look identical on the card.
export function splitOverallIntoStats(overall: number): { statHigh: number; statLow: number } {
  const delta = randomInt(0, 6);
  const statHigh = Math.max(35, Math.min(99, overall + delta));
  const statLow  = Math.max(35, Math.min(99, overall - delta));
  return { statHigh, statLow };
}

export function generateOverall(age: number, tier: number): number {
  const [min, max]: [number, number] = tier === 1 ? [74, 92] : tier === 2 ? [62, 80] : [50, 68];
  const base = randomInt(min, max);
  const agePenalty =
    age <= 23 ? randomInt(8, 15) :   // still raw
    age <= 26 ? randomInt(3, 7)  :   // approaching prime
    age <= 30 ? 0                :   // prime
                randomInt(3, 10);    // declining
  return Math.max(30, Math.min(99, base - agePenalty));
}

// Young players have upside; veterans are what they are.
export function generatePotential(age: number, overall: number): number {
  const upside =
    age <= 23 ? randomInt(15, 28) :
    age <= 27 ? randomInt(5, 14)  :
    age <= 30 ? randomInt(2, 8)   :
                0;
  return Math.max(overall, Math.min(99, overall + upside));
}

export function generateSalary(overall: number, age: number): number {
  const agePremium = age >= 27 && age <= 31 ? 250_000 : age >= 32 ? -150_000 : 0;
  return Math.max(700_000, Math.round((350_000 + overall * overall * 420 + agePremium) / 100_000) * 100_000);
}

// ─── Seed ─────────────────────────────────────────────────

export async function seedWorld(): Promise<void> {
  const leagues = await Promise.all(
    LEAGUES.map((l) => prisma.league.create({ data: l }))
  );
  console.log(`  ✓ ${leagues.length} leagues`);

  const allTeamMeta: Array<{ id: string; leagueId: string; tier: number }> = [];

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
    teams.forEach((t) => allTeamMeta.push({ id: t.id, leagueId: league.id, tier: league.tier }));
  }
  console.log(`  ✓ ${allTeamMeta.length} teams`);

  const teamsForCoaches = await prisma.team.findMany();
  await prisma.coach.createMany({
    data: teamsForCoaches.flatMap((team) => buildCoachStaff(team.id, team.offenseStyle, team.defenseStyle, deriveTeamIdentity(team))),
  });
  console.log(`  ✓ ${teamsForCoaches.length * 3} staff`);

  const playerData: Array<{
    name: string; position: string; overall: number;
    statHigh: number; statLow: number;
    potential: number; age: number; teamId: string;
    salary: number; contractYearsLeft: number; extensionEligible: boolean;
  }> = [];

  for (const team of allTeamMeta) {
    for (const { position, count } of POSITION_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        const age     = randomInt(21, 35);
        const overall = generateOverall(age, team.tier);
        const { statHigh, statLow } = splitOverallIntoStats(overall);
        playerData.push({
          name:      randomName(),
          position,
          overall:   Math.round((statHigh + statLow) / 2),
          statHigh,
          statLow,
          potential: generatePotential(age, overall),
          age,
          teamId:    team.id,
          salary:    generateSalary(overall, age),
          contractYearsLeft: randomInt(1, 4),
          extensionEligible: age >= 27 || overall >= 82,
        });
      }
    }
  }

  await prisma.player.createMany({ data: playerData });
  console.log(`  ✓ ${playerData.length} players`);

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

function clampRating(value: number): number {
  return Math.max(35, Math.min(99, value));
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

export function buildCoachStaff(teamId: string, offenseStyle: string, defenseStyle: string, identity?: TeamIdentity) {
  const offensiveSpecialty = offenseStyle === 'PASS_HEAVY' ? 'QB' : offenseStyle === 'RUN_HEAVY' ? 'OL' : randomElement(['QB', 'Skill', 'OL']);
  const defensiveSpecialty = defenseStyle === 'PREVENT' ? 'Secondary' : defenseStyle === 'AGGRESSIVE' ? randomElement(['DL', 'LB']) : randomElement(['LB', 'Secondary']);
  const hcOvr = randomInt(50, 82);
  const ocOvr = randomInt(45, 78);
  const dcOvr = randomInt(45, 78);
  return [
    (() => {
      const hcOffense = clampRating(hcOvr + (offenseStyle === 'PASS_HEAVY' || offenseStyle === 'RUN_HEAVY' ? randomInt(2, 8) : randomInt(-2, 5)));
      const hcDefense = clampRating(hcOvr + (defenseStyle === 'AGGRESSIVE' || defenseStyle === 'PREVENT' ? randomInt(2, 8) : randomInt(-2, 5)));
      const developmentRating = Math.round((hcOffense + hcDefense) / 2);
      const role = 'HEAD_COACH';
      const reputation = randomInt(45, 78);
      return {
        name: randomCoachName(),
        role,
        philosophy: pickHeadCoachPhilosophy(hcOffense, hcDefense),
        developmentSpecialty: randomElement(DEVELOPMENT_SPECIALTIES),
        aggression: defenseStyle === 'AGGRESSIVE' ? randomInt(70, 92) : randomInt(35, 70),
        reputation,
        overall: Math.round((hcOffense + hcDefense) / 2),
        offenseRating: hcOffense,
        defenseRating: hcDefense,
        developmentRating,
        salary: coachSalary(role, reputation),
        contractYearsLeft: 4,
        contractTotalYears: 4,
        contractTotalCost: coachSalary(role, reputation) * 4,
        hotSeat: randomInt(12, 35),
        age: randomInt(39, 64),
        teamId,
      };
    })(),
    (() => {
      // OC: offenseRating = pass scheming, defenseRating = run scheming
      const passScheming = clampRating(ocOvr + randomInt(-8, 12));
      const runScheming  = clampRating(ocOvr + randomInt(-8, 12));
      const developmentRating = clampRating(Math.round((passScheming + runScheming) / 2) + randomInt(-4, 4));
      const role = 'OC';
      const reputation = randomInt(38, 72);
      return {
        name: randomCoachName(),
        role,
        philosophy: pickOCPhilosophy(passScheming, runScheming),
        developmentSpecialty: offensiveSpecialty,
        aggression: offenseStyle === 'PASS_HEAVY' ? randomInt(65, 92) : randomInt(30, 68),
        reputation,
        overall: Math.round((passScheming + runScheming + developmentRating) / 3),
        offenseRating: passScheming,
        defenseRating: runScheming,
        developmentRating,
        salary: coachSalary(role, reputation),
        contractYearsLeft: 3,
        contractTotalYears: 3,
        contractTotalCost: coachSalary(role, reputation) * 3,
        hotSeat: randomInt(8, 28),
        age: randomInt(34, 58),
        teamId,
      };
    })(),
    (() => {
      // DC: offenseRating = run defense, defenseRating = pass defense
      const runDefense  = clampRating(dcOvr + randomInt(-8, 12));
      const passDefense = clampRating(dcOvr + randomInt(-8, 12));
      const developmentRating = clampRating(Math.round((runDefense + passDefense) / 2) + randomInt(-4, 4));
      const role = 'DC';
      const reputation = randomInt(38, 72);
      return {
        name: randomCoachName(),
        role,
        philosophy: pickDCPhilosophy(runDefense, passDefense),
        developmentSpecialty: defensiveSpecialty,
        aggression: defenseStyle === 'AGGRESSIVE' ? randomInt(72, 95) : randomInt(28, 66),
        reputation,
        overall: Math.round((runDefense + passDefense + developmentRating) / 3),
        offenseRating: runDefense,
        defenseRating: passDefense,
        developmentRating,
        salary: coachSalary(role, reputation),
        contractYearsLeft: 3,
        contractTotalYears: 3,
        contractTotalCost: coachSalary(role, reputation) * 3,
        hotSeat: randomInt(8, 28),
        age: randomInt(34, 60),
        teamId,
      };
    })(),
  ];
}

export function philosophyForStyle(offenseStyle: string): string {
  if (offenseStyle === 'PASS_HEAVY') return 'VERTICAL_SPREAD';
  if (offenseStyle === 'RUN_HEAVY') return 'SMASHMOUTH';
  return 'WEST_COAST';
}

async function clearAndSeed() {
  await prisma.transferOffer.deleteMany();
  await prisma.transferListing.deleteMany();
  await prisma.tradeHistory.deleteMany();
  await prisma.retirementHistory.deleteMany();
  await prisma.teamSeasonHistory.deleteMany();
  await prisma.leagueSeasonHistory.deleteMany();
  await prisma.seasonHistory.deleteMany();
  await prisma.teamScheme.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
  await seedWorld();
}

if (require.main === module) {
  clearAndSeed()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
