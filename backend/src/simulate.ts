import 'dotenv/config';
import { prisma } from './db';
import { seedWorld } from './seed';
import { simulateSeason, LeagueResult, MatchResultRecord } from './simulation/seasonSimulator';
import { TeamRecord } from './simulation/standings';

// ─── Display helpers ──────────────────────────────────────

const THICK = '═'.repeat(64);
const LINE  = '─'.repeat(64);

function pad(s: string | number, width: number, align: 'left' | 'right' = 'right'): string {
  const str = String(s);
  return align === 'left' ? str.padEnd(width) : str.padStart(width);
}

// Wrap text to a given width with a leading indent
function wrap(text: string, width: number, indent: string): string {
  const words  = text.split(' ');
  const lines: string[] = [];
  let current  = indent;

  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = indent + word;
    } else {
      current = current === indent ? indent + word : current + ' ' + word;
    }
  }
  if (current !== indent) lines.push(current);
  return lines.join('\n');
}

function styleAbbr(off: string, def: string): string {
  const o = off === 'PASS_HEAVY' ? 'PAS' : off === 'RUN_HEAVY' ? 'RUN' : 'BAL';
  const d = def === 'AGGRESSIVE' ? 'AGG' : def === 'PREVENT' ? 'PRV' : 'BAL';
  return `${o}/${d}`;
}

// ─── Output sections ──────────────────────────────────────

function printHeader(): void {
  console.log('\n' + THICK);
  console.log('  FOOTBALL UNIVERSE SIMULATOR — Season 2024');
  console.log(THICK);
}

async function printLeague(result: LeagueResult): Promise<void> {
  // Fetch team styles for the identity column
  const teamIds = result.standings.map((s) => s.teamId);
  const teams   = await prisma.team.findMany({
    where:  { id: { in: teamIds } },
    select: { id: true, offenseStyle: true, defenseStyle: true },
  });
  const styleMap = new Map(teams.map((t) => [t.id, t]));

  console.log(`\n  ${result.leagueName.toUpperCase()} — Tier ${result.tier}`);
  console.log('  ' + LINE);
  console.log(
    '  ' +
    pad('Rank', 4) + '  ' +
    pad('Team',           22, 'left') +
    pad('W',  4) + pad('L',  4) +
    pad('PF', 6) + pad('PA', 6) +
    pad('DIFF', 7) +
    pad('STYLE', 8)
  );
  console.log('  ' + LINE);

  result.standings.forEach((team: TeamRecord, i: number) => {
    const diff  = (team.diff >= 0 ? '+' : '') + team.diff;
    const style = styleMap.get(team.teamId);
    const abbr  = style ? styleAbbr(style.offenseStyle, style.defenseStyle) : '   —';
    console.log(
      '  ' +
      pad(i + 1, 4) + '  ' +
      pad(team.teamName,       22, 'left') +
      pad(team.wins,           4) +
      pad(team.losses,         4) +
      pad(team.pointsFor,      6) +
      pad(team.pointsAgainst,  6) +
      pad(diff,                7) +
      pad(abbr,                8)
    );
  });

  console.log('  ' + LINE);
  const champ  = result.standings[0];
  const cStyle = styleMap.get(champ.teamId);
  const cAbbr  = cStyle ? `[${cStyle.offenseStyle.replace('_', '-')} offense]` : '';
  console.log(`  Champion: ${champ.teamName}  ${cAbbr}`);
}

function printHighlightGame(label: string, match: MatchResultRecord, leagueName: string): void {
  console.log(`\n  ${label}`);
  console.log(
    `  ${match.homeTeamName} ${match.homeScore} — ${match.awayScore} ${match.awayTeamName}` +
    `  (Week ${match.week}, ${leagueName})`
  );

  // Quarter score line
  const qLine = match.quarterScores
    .map(([h, a], i) => `Q${i + 1}: ${h}-${a}`)
    .join('  |  ');
  console.log(`  ${qLine}`);

  console.log(`  [${match.keyMatchup}]`);
  console.log(wrap(match.narrative, 72, '  '));
}

function printHighlights(results: LeagueResult[]): void {
  const all: MatchResultRecord[] = results.flatMap((r) => r.matchResults);
  if (all.length === 0) return;

  // Build lookup for league names
  const leagueById = new Map(results.map((r) => [r.leagueId, r.leagueName]));

  const highest = all.reduce((m, c) => c.homeScore + c.awayScore > m.homeScore + m.awayScore ? c : m);
  const blowout = all.reduce((m, c) => Math.abs(c.homeScore - c.awayScore) > Math.abs(m.homeScore - m.awayScore) ? c : m);
  const closest = all.reduce((m, c) => {
    const cd = Math.abs(c.homeScore - c.awayScore);
    const md = Math.abs(m.homeScore - m.awayScore);
    return cd < md ? c : m;
  });

  const awayWins  = all.filter((m) => m.awayScore > m.homeScore).length;
  const upsetPct  = Math.round((awayWins / all.length) * 100);

  // Best team across all leagues
  const bestTeam = results
    .flatMap((r) => r.standings)
    .reduce((m, c) => c.wins > m.wins || (c.wins === m.wins && c.diff > m.diff) ? c : m);

  console.log('\n' + THICK);
  console.log('  SEASON HIGHLIGHTS');
  console.log(THICK);

  printHighlightGame(
    'BIGGEST BLOWOUT',
    blowout,
    leagueById.get(blowout.leagueId) ?? ''
  );

  printHighlightGame(
    'HIGHEST SCORING GAME',
    highest,
    leagueById.get(highest.leagueId) ?? ''
  );

  printHighlightGame(
    'CLOSEST GAME',
    closest,
    leagueById.get(closest.leagueId) ?? ''
  );

  console.log(`\n  Away win rate: ${upsetPct}% ` +
    `(home field working: ${upsetPct < 50 ? 'yes' : 'check engine'})`);

  console.log(
    `\n  Best record: ${bestTeam.teamName}  ` +
    `(${bestTeam.wins}-${bestTeam.losses}, ` +
    `${bestTeam.diff >= 0 ? '+' : ''}${bestTeam.diff} point diff)`
  );

  console.log('\n' + THICK + '\n');
}

// ─── Main ─────────────────────────────────────────────────

async function clearDatabase(): Promise<void> {
  await prisma.match.deleteMany();
  await prisma.personnel.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
}

async function main(): Promise<void> {
  printHeader();

  console.log('\n[1/3] Seeding world...');
  await clearDatabase();
  await seedWorld();

  console.log('\n[2/3] Simulating 14-week season...');
  const results = await simulateSeason();

  console.log('\n[3/3] Final Standings');
  for (const result of results) {
    await printLeague(result);
  }

  printHighlights(results);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
