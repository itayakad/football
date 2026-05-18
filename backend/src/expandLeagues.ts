import 'dotenv/config';
import { prisma } from './db';
import {
  TEAMS_BY_TIER,
  POSITION_DISTRIBUTION,
  buildPersonnelStaff,
  philosophyForStyle,
  randomInt,
  randomName,
  generateOverall,
  splitIntoStats,
  personnelSalary,
} from './seed';
import { generateRoundRobin } from './simulation/scheduleGenerator';

// Idempotent migration: bring every league up to its full team count without
// wiping rosters or season history. The current season's match rows are dropped
// and regenerated for the new team count, so any in-progress regular-season
// standings reset.
async function expandLeagues(): Promise<void> {
  // Special teams (K/P) were removed from the roster model. Clean any existing
  // K/P personnel so the DB matches the new POSITION_DISTRIBUTION.
  await prisma.personnel.deleteMany({ where: { position: { in: ['K', 'P'] } } });

  const leagues = await prisma.league.findMany({
    include: { teams: true },
    orderBy: { tier: 'asc' },
  });

  for (const league of leagues) {
    const wantedConfigs = TEAMS_BY_TIER[league.tier] ?? [];
    const existingNames = new Set(league.teams.map((t) => t.name));
    const missing = wantedConfigs.filter((c) => !existingNames.has(c.name));

    if (missing.length === 0) {
      console.log(`  • ${league.name}: already has ${league.teams.length} teams`);
      continue;
    }

    console.log(`  + ${league.name}: adding ${missing.length} team(s) (${missing.map((m) => m.name).join(', ')})`);

    for (const config of missing) {
      const team = await prisma.team.create({
        data: {
          name:                config.name,
          leagueId:            league.id,
          offenseRating:       config.offense,
          defenseRating:       config.defense,
          offenseStyle:        config.offenseStyle as any,
          offensivePhilosophy: philosophyForStyle(config.offenseStyle) as any,
          defenseStyle:        config.defenseStyle as any,
          money:               150_000_000,
        },
      });

      const personnel: Array<{
        name: string; position: string; overall: number;
        stat1: number; stat2: number;
        age: number; teamId: string;
        salary: number; contractYearsLeft: number; yearsWithTeam: number;
      }> = [];

      personnel.push(...buildPersonnelStaff(team.id, team.offenseStyle, team.defenseStyle));

      for (const { position, count } of POSITION_DISTRIBUTION) {
        for (let i = 0; i < count; i++) {
          const age = randomInt(21, 35);
          const overall = generateOverall(age, league.tier);
          const { stat1, stat2 } = splitIntoStats(overall);
          personnel.push({
            name:              randomName(),
            position,
            overall:           Math.round((stat1 + stat2) / 2),
            stat1,
            stat2,
            age,
            teamId:            team.id,
            salary:            personnelSalary(position, overall, age),
            contractYearsLeft: randomInt(1, 4),
            yearsWithTeam:     1,
          });
        }
      }
      await prisma.personnel.createMany({ data: personnel });
    }
  }

  console.log(`  • rebuilding schedules`);
  await prisma.match.deleteMany();

  const leaguesAfter = await prisma.league.findMany({
    include: { teams: true },
    orderBy: { tier: 'asc' },
  });

  let totalFixtures = 0;
  let weekCount = 0;
  for (const league of leaguesAfter) {
    if (league.teams.length % 2 !== 0) {
      console.warn(`  ! ${league.name} has ${league.teams.length} teams (odd count) — skipping schedule`);
      continue;
    }
    const fixtures = generateRoundRobin(league.teams.map((t) => t.id));
    weekCount = Math.max(weekCount, ...fixtures.map((f) => f.week));
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
    totalFixtures += fixtures.length;
  }

  console.log(`  ✓ ${totalFixtures} fixtures across ${weekCount} weeks`);
}

if (require.main === module) {
  expandLeagues()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
