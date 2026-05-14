import 'dotenv/config';
import { prisma } from './db';
import { seedWorld } from './seed';
import { simulateSeason } from './simulation/seasonSimulator';

const N_SEASONS = parseInt(process.argv[2] ?? '10', 10);

// ─── Snapshot Types ───────────────────────────────────────

interface TeamSeasonStats {
  name: string;
  tier: number;
  offenseStyle: string;
  defenseStyle: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionTitle: boolean;
}

interface SeasonAgg {
  season: number;
  teams: TeamSeasonStats[];
  totalGames: number;
  homeWins: number;
  awayWins: number;
  ties: number;
  totalPoints: number;
  championsByTier: Record<number, string>;
}

// ─── Capture ──────────────────────────────────────────────

async function clearDatabase() {
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
}

async function runSeason(seasonNum: number): Promise<SeasonAgg> {
  await clearDatabase();
  await seedWorld();
  const results = await simulateSeason();

  // Pull team metadata so we can attach style/tier to each standing row
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, offenseStyle: true, defenseStyle: true, leagueId: true },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const leagues = await prisma.league.findMany();
  const tierByLeague = new Map(leagues.map((l) => [l.id, l.tier]));

  const teamStats: TeamSeasonStats[] = [];
  const championsByTier: Record<number, string> = {};
  let homeWins = 0, awayWins = 0, ties = 0, totalPoints = 0, totalGames = 0;

  for (const league of results) {
    const champion = league.standings[0];
    championsByTier[league.tier] = teamById.get(champion.teamId)?.name ?? '?';

    for (const standing of league.standings) {
      const team = teamById.get(standing.teamId);
      if (!team) continue;
      teamStats.push({
        name: team.name,
        tier: tierByLeague.get(team.leagueId) ?? 0,
        offenseStyle: team.offenseStyle,
        defenseStyle: team.defenseStyle,
        wins: standing.wins,
        losses: standing.losses,
        ties: standing.ties,
        pointsFor: standing.pointsFor,
        pointsAgainst: standing.pointsAgainst,
        divisionTitle: standing.teamId === champion.teamId,
      });
    }

    for (const m of league.matchResults) {
      totalGames++;
      totalPoints += m.homeScore + m.awayScore;
      if      (m.homeScore > m.awayScore) homeWins++;
      else if (m.awayScore > m.homeScore) awayWins++;
      else                                ties++;
    }
  }

  return { season: seasonNum, teams: teamStats, totalGames, homeWins, awayWins, ties, totalPoints, championsByTier };
}

// ─── Display Helpers ──────────────────────────────────────

const THICK = '═'.repeat(72);
const LINE  = '─'.repeat(72);

function pad(s: string | number, w: number, align: 'l' | 'r' = 'r'): string {
  const str = String(s);
  return align === 'l' ? str.padEnd(w) : str.padStart(w);
}

function styleAbbr(off: string, def: string): string {
  const o = off === 'PASS_HEAVY' ? 'PAS' : off === 'RUN_HEAVY' ? 'RUN' : 'BAL';
  const d = def === 'AGGRESSIVE' ? 'AGG' : def === 'PREVENT' ? 'PRV' : 'BAL';
  return `${o}/${d}`;
}

function pct(num: number, denom: number): string {
  return denom === 0 ? '0.0%' : `${((num / denom) * 100).toFixed(1)}%`;
}

// ─── Aggregate Report ─────────────────────────────────────

function printAggregate(snapshots: SeasonAgg[]): void {
  const N = snapshots.length;
  const allTeamSeasons = snapshots.flatMap((s) => s.teams);

  // ─── Headline numbers ──
  const totalGames  = snapshots.reduce((a, s) => a + s.totalGames, 0);
  const totalHomeW  = snapshots.reduce((a, s) => a + s.homeWins, 0);
  const totalAwayW  = snapshots.reduce((a, s) => a + s.awayWins, 0);
  const totalTies   = snapshots.reduce((a, s) => a + s.ties, 0);
  const totalPoints = snapshots.reduce((a, s) => a + s.totalPoints, 0);
  const avgPPG      = totalPoints / (totalGames * 2);

  console.log('\n' + THICK);
  console.log(`  AGGREGATE REPORT — ${N} SEASONS (${totalGames} games)`);
  console.log(THICK);

  console.log('\n  GLOBAL SCORING & HOME FIELD');
  console.log(`    Avg PPG per team:    ${avgPPG.toFixed(2)}`);
  console.log(`    Home win rate:       ${pct(totalHomeW, totalGames)}`);
  console.log(`    Away win rate:       ${pct(totalAwayW, totalGames)}`);
  console.log(`    Tie rate:            ${pct(totalTies,  totalGames)}`);

  // ─── Division titles by offensive style ──
  const titlesByOffStyle: Record<string, number> = { RUN_HEAVY: 0, BALANCED: 0, PASS_HEAVY: 0 };
  const titlesByDefStyle: Record<string, number> = { AGGRESSIVE: 0, BALANCED: 0, PREVENT: 0 };
  for (const t of allTeamSeasons) {
    if (t.divisionTitle) {
      titlesByOffStyle[t.offenseStyle]++;
      titlesByDefStyle[t.defenseStyle]++;
    }
  }
  const totalTitles = N * 3; // 3 leagues per season

  console.log('\n  DIVISION TITLES BY OFFENSE STYLE');
  for (const [style, count] of Object.entries(titlesByOffStyle).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(style, 12, 'l')}  ${pad(count, 3)}  (${pct(count, totalTitles)})`);
  }

  console.log('\n  DIVISION TITLES BY DEFENSE STYLE');
  for (const [style, count] of Object.entries(titlesByDefStyle).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(style, 12, 'l')}  ${pad(count, 3)}  (${pct(count, totalTitles)})`);
  }

  // ─── Avg wins by style × tier ──
  // This is the key view: is PASS_HEAVY actually collapsing in lower tiers?
  console.log('\n  AVG WINS BY OFFENSE STYLE × TIER');
  console.log(`    ${pad('Style', 12, 'l')}  ${pad('Tier 1', 8)}  ${pad('Tier 2', 8)}  ${pad('Tier 3', 8)}  ${pad('Overall', 9)}`);
  console.log(`    ${LINE.slice(4)}`);

  for (const style of ['RUN_HEAVY', 'BALANCED', 'PASS_HEAVY']) {
    const row = [1, 2, 3].map((tier) => {
      const matching = allTeamSeasons.filter((t) => t.offenseStyle === style && t.tier === tier);
      if (matching.length === 0) return '   —';
      const avg = matching.reduce((a, t) => a + t.wins, 0) / matching.length;
      return avg.toFixed(2);
    });
    const overall = allTeamSeasons.filter((t) => t.offenseStyle === style);
    const overallAvg = overall.reduce((a, t) => a + t.wins, 0) / overall.length;
    console.log(`    ${pad(style, 12, 'l')}  ${pad(row[0], 8)}  ${pad(row[1], 8)}  ${pad(row[2], 8)}  ${pad(overallAvg.toFixed(2), 9)}`);
  }

  // ─── Avg PPG by style ──
  console.log('\n  AVG PPG BY OFFENSE STYLE (offensive output)');
  for (const style of ['RUN_HEAVY', 'BALANCED', 'PASS_HEAVY']) {
    const matching = allTeamSeasons.filter((t) => t.offenseStyle === style);
    const avgPF = matching.reduce((a, t) => a + t.pointsFor, 0) / matching.length / 14; // 14 games
    console.log(`    ${pad(style, 12, 'l')}  ${avgPF.toFixed(2)} ppg`);
  }

  // ─── Per-team table ──
  type TeamAgg = {
    name: string; tier: number; off: string; def: string;
    avgWins: number; titles: number; seasons: number;
  };
  const byName = new Map<string, TeamAgg>();
  for (const t of allTeamSeasons) {
    if (!byName.has(t.name)) {
      byName.set(t.name, { name: t.name, tier: t.tier, off: t.offenseStyle, def: t.defenseStyle, avgWins: 0, titles: 0, seasons: 0 });
    }
    const agg = byName.get(t.name)!;
    agg.avgWins += t.wins;
    if (t.divisionTitle) agg.titles++;
    agg.seasons++;
  }
  for (const t of byName.values()) t.avgWins /= t.seasons;

  console.log('\n  PER-TEAM AVERAGES (sorted by avg wins, descending)');
  console.log(`    ${pad('Team', 22, 'l')}  ${pad('T', 2)}  ${pad('Style', 8, 'l')}  ${pad('AvgW', 6)}  ${pad('Titles', 7)}`);
  console.log(`    ${LINE.slice(4)}`);
  const sorted = [...byName.values()].sort((a, b) => b.avgWins - a.avgWins);
  for (const t of sorted) {
    console.log(
      `    ${pad(t.name, 22, 'l')}  ${pad(t.tier, 2)}  ${pad(styleAbbr(t.off, t.def), 8, 'l')}  ${pad(t.avgWins.toFixed(2), 6)}  ${pad(t.titles, 7)}`
    );
  }

  // ─── Champions by tier ──
  console.log('\n  CHAMPIONS BY TIER (across all seasons)');
  for (const tier of [1, 2, 3]) {
    const champs: Record<string, number> = {};
    for (const s of snapshots) {
      const champ = s.championsByTier[tier];
      if (champ) champs[champ] = (champs[champ] ?? 0) + 1;
    }
    const tierName = tier === 1 ? 'Premier Division' : tier === 2 ? 'First Division' : 'Second Division';
    const list = Object.entries(champs).sort((a, b) => b[1] - a[1]);
    console.log(`    ${tierName}:`);
    for (const [name, count] of list) {
      console.log(`      ${pad(count, 3)}× ${name}`);
    }
  }

  console.log('\n' + THICK + '\n');
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('\n' + THICK);
  console.log(`  MULTI-SEASON AGGREGATOR — running ${N_SEASONS} seasons`);
  console.log(THICK);

  const snapshots: SeasonAgg[] = [];

  for (let i = 1; i <= N_SEASONS; i++) {
    process.stdout.write(`\n  Season ${i}/${N_SEASONS}... `);
    const start = Date.now();
    const snap = await runSeason(i);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    snapshots.push(snap);

    const champStrs = Object.entries(snap.championsByTier)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([tier, name]) => `T${tier}: ${name}`)
      .join(' | ');
    process.stdout.write(`done in ${elapsed}s  →  ${champStrs}\n`);
  }

  printAggregate(snapshots);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
