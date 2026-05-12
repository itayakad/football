import 'dotenv/config';
import { prisma } from './db';
import { generateRoundRobin } from './simulation/scheduleGenerator';

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
const MEDICAL_SPECIALTIES = ['Soft Tissue', 'Orthopedic', 'Recovery'];
const RECRUITMENT_SPECIALTIES = ['College', 'Pro', 'International'];

// ─── League Config ────────────────────────────────────────

const LEAGUES = [
  { name: 'Premier Division', tier: 1 },
  { name: 'First Division',   tier: 2 },
  { name: 'Second Division',  tier: 3 },
];

// Each team has a distinct philosophical identity — not just ratings.
// This is what makes games feel different from each other.
//
// Identity combos create narrative archetypes:
//   PASS_HEAVY + AGGRESSIVE + FAST  = "Gunslinger" — explosive, volatile, high stakes
//   RUN_HEAVY  + AGGRESSIVE + SLOW  = "Smashmouth" — physical, low scoring, grinds you down
//   BALANCED   + PREVENT   + NORMAL = "Ball control" — methodical, minimizes mistakes
//   PASS_HEAVY + PREVENT   + FAST   = "Air raid meets bend-don't-break"
//
const TEAMS_BY_TIER: Record<number, Array<{
  name: string;
  offense: number;
  defense: number;
  offenseStyle: string;
  defenseStyle: string;
  tempo: string;
}>> = {
  1: [
    { name: 'New York Titans',    offense: 88, defense: 82, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' }, // Complete team
    { name: 'Los Angeles Wolves', offense: 83, defense: 79, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED',   tempo: 'FAST'   }, // Hollywood air raid
    { name: 'Chicago Storm',      offense: 78, defense: 85, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'SLOW'   }, // Smashmouth identity
    { name: 'Dallas Vanguard',    offense: 85, defense: 75, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE', tempo: 'FAST'   }, // Gunslinger — volatile
    { name: 'Miami Thunder',      offense: 76, defense: 78, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT',    tempo: 'FAST'   }, // Spread + bend-don't-break
    { name: 'Seattle Falcons',    offense: 80, defense: 83, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT',    tempo: 'NORMAL' }, // Conservative, wins ugly
    { name: 'Boston Monarchs',    offense: 74, defense: 80, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED',   tempo: 'SLOW'   }, // Clock-eating grinders
    { name: 'Denver Pioneers',    offense: 79, defense: 76, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' }, // Solid two-way team
    { name: 'Philadelphia Liberty', offense: 81, defense: 79, offenseStyle: 'BALANCED',   defenseStyle: 'BALANCED',   tempo: 'NORMAL' }, // Well-rounded contender
    { name: 'Pittsburgh Iron',     offense: 74, defense: 86, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'SLOW'   }, // Old-school heavy
  ],
  2: [
    { name: 'Atlanta Blaze',      offense: 73, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE', tempo: 'FAST'   }, // High-risk, high-reward
    { name: 'Houston Force',      offense: 68, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' }, // Power football
    { name: 'Phoenix Fury',       offense: 70, defense: 65, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED',   tempo: 'FAST'   }, // Desert air attack
    { name: 'Portland Surge',     offense: 65, defense: 71, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT',    tempo: 'SLOW'   }, // Defensive grinders
    { name: 'Nashville Vipers',   offense: 67, defense: 69, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED',   tempo: 'SLOW'   }, // Old-school ground game
    { name: 'Kansas Stallions',   offense: 72, defense: 67, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' }, // Press defense identity
    { name: 'Tampa Barracudas',   offense: 64, defense: 71, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT',    tempo: 'NORMAL' }, // Air raid + prevent
    { name: 'San Diego Aviators', offense: 71, defense: 66, offenseStyle: 'BALANCED',   defenseStyle: 'BALANCED',   tempo: 'FAST'   }, // Well-rounded up-tempo
    { name: 'Detroit Motors',     offense: 70, defense: 68, offenseStyle: 'PASS_HEAVY', defenseStyle: 'AGGRESSIVE', tempo: 'FAST'   }, // Modern, gritty
    { name: 'Cleveland Anchors',  offense: 65, defense: 73, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'PREVENT',    tempo: 'SLOW'   }, // Defense-first grinders
  ],
  3: [
    { name: 'Columbus Crushers',    offense: 62, defense: 57, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'SLOW'   },
    { name: 'Birmingham Bulls',     offense: 55, defense: 62, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED',   tempo: 'SLOW'   },
    { name: 'Raleigh Rockets',      offense: 58, defense: 55, offenseStyle: 'BALANCED',   defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' },
    { name: 'Sacramento Strikers',  offense: 61, defense: 59, offenseStyle: 'PASS_HEAVY', defenseStyle: 'PREVENT',    tempo: 'FAST'   },
    { name: 'Louisville Lightning', offense: 54, defense: 58, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED',   tempo: 'FAST'   },
    { name: 'Omaha Outlaws',        offense: 57, defense: 56, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' },
    { name: 'Tulsa Tigers',         offense: 60, defense: 54, offenseStyle: 'BALANCED',   defenseStyle: 'PREVENT',    tempo: 'NORMAL' },
    { name: 'Albuquerque Arsenal',  offense: 53, defense: 60, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'BALANCED',   tempo: 'SLOW'   },
    { name: 'Memphis Mules',        offense: 56, defense: 59, offenseStyle: 'RUN_HEAVY',  defenseStyle: 'AGGRESSIVE', tempo: 'NORMAL' },
    { name: 'Saint Louis Sentinels',offense: 60, defense: 56, offenseStyle: 'PASS_HEAVY', defenseStyle: 'BALANCED',   tempo: 'FAST'   },
  ],
};

// 38 players per team. Mirrors a compressed 53-man NFL roster (no special teams).
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
  { position: 'S',   count: 2 },
]; // total = 38

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

// Age curve: young players are rawer, veterans are settled.
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
            tempo:         c.tempo as any,
            money:         150_000_000,
            morale:        70,
          },
        })
      )
    );
    teams.forEach((t) => allTeamMeta.push({ id: t.id, leagueId: league.id, tier: league.tier }));
  }
  console.log(`  ✓ ${allTeamMeta.length} teams`);

  const teamsForCoaches = await prisma.team.findMany();
  await prisma.coach.createMany({
    data: teamsForCoaches.flatMap((team) => buildCoachStaff(team.id, team.offenseStyle, team.defenseStyle, team.tempo)),
  });
  console.log(`  ✓ ${teamsForCoaches.length * 6} staff`);

  const playerData: Array<{
    name: string; position: string; overall: number;
    potential: number; age: number; morale: number; fatigue: number; teamId: string;
    salary: number; contractYearsLeft: number; extensionEligible: boolean;
  }> = [];

  for (const team of allTeamMeta) {
    for (const { position, count } of POSITION_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        const age     = randomInt(21, 35);
        const overall = generateOverall(age, team.tier);
        playerData.push({
          name:      randomName(),
          position,
          overall,
          potential: generatePotential(age, overall),
          age,
          morale:    randomInt(60, 85),
          fatigue:   0,
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

export function buildCoachStaff(teamId: string, offenseStyle: string, defenseStyle: string, tempo: string) {
  const offensiveSpecialty = offenseStyle === 'PASS_HEAVY' ? 'QB' : offenseStyle === 'RUN_HEAVY' ? 'OL' : randomElement(['QB', 'Skill', 'OL']);
  const defensiveSpecialty = defenseStyle === 'PREVENT' ? 'Secondary' : defenseStyle === 'AGGRESSIVE' ? randomElement(['DL', 'LB']) : randomElement(['LB', 'Secondary']);
  return [
    {
      name: randomCoachName(),
      role: 'HEAD_COACH',
      philosophy: offenseStyle === 'RUN_HEAVY' ? 'Old-School Builder' : offenseStyle === 'PASS_HEAVY' ? 'Modern Shot-Caller' : 'Program Stabilizer',
      developmentSpecialty: randomElement(DEVELOPMENT_SPECIALTIES),
      aggression: defenseStyle === 'AGGRESSIVE' ? randomInt(70, 92) : randomInt(35, 70),
      moraleImpact: randomInt(-2, 8),
      preferredTempo: tempo as any,
      reputation: randomInt(45, 78),
      hotSeat: randomInt(12, 35),
      age: randomInt(39, 64),
      teamId,
    },
    {
      name: randomCoachName(),
      role: 'OC',
      philosophy: offenseStyle === 'PASS_HEAVY' ? 'Vertical Architect' : offenseStyle === 'RUN_HEAVY' ? 'Ground Game Designer' : 'Balanced Playcaller',
      developmentSpecialty: offensiveSpecialty,
      aggression: offenseStyle === 'PASS_HEAVY' ? randomInt(65, 92) : randomInt(30, 68),
      moraleImpact: randomInt(-1, 5),
      preferredTempo: tempo as any,
      reputation: randomInt(38, 72),
      hotSeat: randomInt(8, 28),
      age: randomInt(34, 58),
      teamId,
    },
    {
      name: randomCoachName(),
      role: 'DC',
      philosophy: defenseStyle === 'AGGRESSIVE' ? 'Pressure Merchant' : defenseStyle === 'PREVENT' ? 'Coverage Professor' : 'Flexible Defender',
      developmentSpecialty: defensiveSpecialty,
      aggression: defenseStyle === 'AGGRESSIVE' ? randomInt(72, 95) : randomInt(28, 66),
      moraleImpact: randomInt(-1, 5),
      preferredTempo: tempo as any,
      reputation: randomInt(38, 72),
      hotSeat: randomInt(8, 28),
      age: randomInt(34, 60),
      teamId,
    },
    {
      name: randomCoachName(),
      role: 'TRAINER',
      philosophy: randomElement(['Strength Coach', 'Skill Developer', 'Speed Specialist', 'Veteran Refiner']),
      developmentSpecialty: randomElement(DEVELOPMENT_SPECIALTIES),
      aggression: randomInt(30, 60),
      moraleImpact: randomInt(0, 6),
      preferredTempo: tempo as any,
      reputation: randomInt(35, 70),
      hotSeat: randomInt(5, 22),
      age: randomInt(32, 58),
      teamId,
    },
    {
      name: randomCoachName(),
      role: 'MEDICAL',
      philosophy: randomElement(['Preventive Specialist', 'Surgical Lead', 'Recovery Architect']),
      developmentSpecialty: randomElement(MEDICAL_SPECIALTIES),
      aggression: randomInt(20, 45),
      moraleImpact: randomInt(0, 4),
      preferredTempo: tempo as any,
      reputation: randomInt(40, 72),
      hotSeat: randomInt(5, 20),
      age: randomInt(36, 60),
      teamId,
    },
    {
      name: randomCoachName(),
      role: 'RECRUITMENT',
      philosophy: randomElement(['College Pipeline', 'Free Agent Hunter', 'International Scout']),
      developmentSpecialty: randomElement(RECRUITMENT_SPECIALTIES),
      aggression: randomInt(35, 70),
      moraleImpact: randomInt(-1, 3),
      preferredTempo: tempo as any,
      reputation: randomInt(38, 72),
      hotSeat: randomInt(5, 22),
      age: randomInt(33, 58),
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
  await prisma.transferOffer.deleteMany();
  await prisma.transferListing.deleteMany();
  await prisma.tradeHistory.deleteMany();
  await prisma.retirementHistory.deleteMany();
  await prisma.teamSeasonHistory.deleteMany();
  await prisma.leagueSeasonHistory.deleteMany();
  await prisma.seasonHistory.deleteMany();
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
