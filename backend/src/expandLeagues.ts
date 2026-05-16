import 'dotenv/config';
import { prisma } from './db';
import {
  TEAMS_BY_TIER,
  POSITION_DISTRIBUTION,
  buildCoachStaff,
  philosophyForStyle,
  randomInt,
  randomName,
  generateOverall,
  generatePotential,
  generateSalary,
  splitOverallIntoStats,
} from './seed';
import { generateRoundRobin } from './simulation/scheduleGenerator';

// Idempotent migration: bring every league up to 10 teams without wiping
// players, coaches, transfers, or season history. The current season's match
// rows are dropped and regenerated for the new team count, so any in-progress
// regular-season standings reset.
async function expandLeagues(): Promise<void> {
  // Special teams (K/P) were removed from the roster model. Clean any existing
  // K/P players + their listings so the DB matches the new POSITION_DISTRIBUTION.
  const specialPlayerIds = (await prisma.player.findMany({
    where: { position: { in: ['K', 'P'] } },
    select: { id: true },
  })).map((p) => p.id);
  if (specialPlayerIds.length > 0) {
    await prisma.transferOffer.deleteMany({ where: { listing: { playerId: { in: specialPlayerIds } } } });
    await prisma.transferListing.deleteMany({ where: { playerId: { in: specialPlayerIds } } });
    await prisma.player.deleteMany({ where: { id: { in: specialPlayerIds } } });
    console.log(`  • removed ${specialPlayerIds.length} K/P players`);
  }

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

      await prisma.coach.createMany({
        data: buildCoachStaff(team.id, team.offenseStyle, team.defenseStyle),
      });

      const players: Array<{
        name: string; position: string; overall: number;
        statHigh: number; statLow: number;
        potential: number;
        age: number; teamId: string;
        salary: number; contractYearsLeft: number; extensionEligible: boolean;
      }> = [];
      for (const { position, count } of POSITION_DISTRIBUTION) {
        for (let i = 0; i < count; i++) {
          const age = randomInt(21, 35);
          const overall = generateOverall(age, league.tier);
          const { statHigh, statLow } = splitOverallIntoStats(overall);
          players.push({
            name:              randomName(),
            position,
            overall:           Math.round((statHigh + statLow) / 2),
            statHigh,
            statLow,
            potential:         generatePotential(age, overall),
            age,
            teamId:            team.id,
            salary:            generateSalary(overall, age),
            contractYearsLeft: randomInt(1, 4),
            extensionEligible: age >= 27 || overall >= 82,
          });
        }
      }
      await prisma.player.createMany({ data: players });
    }
  }

  // Rebuild fixtures for every league with the new team counts. Wipes the
  // current season's matches; finished playoff matches from a prior season
  // are already cleared via the offseason flow, so this only nukes regular-
  // season state. League histories / TeamSeasonHistory rows are untouched.
  console.log(`  • rebuilding schedules`);
  await prisma.transferOffer.deleteMany({ where: { listing: { status: { not: 'ACTIVE' } } } });
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
