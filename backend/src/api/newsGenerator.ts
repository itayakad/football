import { prisma } from '../db';

export interface NewsItem {
  headline: string;
  summary:  string;
  category: 'BLOWOUT' | 'UPSET' | 'THRILLER' | 'STANDINGS' | 'STREAK' | 'COACH' | 'PLAYER';
  week:     number;
  leagueName?: string;
  sourceName?: string;
}

type NewsDraft = NewsItem & { sourceTeamName: string; score?: number };

const SOURCE_SUFFIXES = ['Guardian', 'Tribune', 'Ledger', 'Herald', 'Post'];
const NEWS_TEXT_LIMIT = 90;

// Generate a small, narrative-flavored news feed from recent played matches.
// Emphasizes "alive world" feel inside the user's current league.
//
// Categories chosen to mirror real sports news beats:
//   BLOWOUT  — dominant performance (diff >= 17)
//   UPSET    — lower-rated team beats higher-rated
//   THRILLER — close game (diff <= 4) with high total score
//   STREAK   — team on a 4+ game win/loss run
//   STANDINGS— division leader / clear race story
//   COACH    — hot seats, weak starts, philosophy questions
//   PLAYER   — contract tension, role pressure during losing skids
//
export async function generateNewsFeed(limit = 3, leagueId?: string): Promise<NewsItem[]> {
  const leagueFilter = leagueId ? { leagueId } : {};
  const matches = await prisma.match.findMany({
    where:   { played: true, ...leagueFilter },
    orderBy: { week: 'desc' },
    take:    40, // pull recent slice to find newsworthy events
    include: {
      homeTeam: { include: { league: true } },
      awayTeam: true,
    },
  });

  if (matches.length === 0) return generatePreseasonNews(limit, leagueId);

  // Sort options into pools
  const items: NewsDraft[] = [];
  const used = new Set<string>(); // dedupe by matchId so we don't headline the same game twice

  const latestWeek = Math.max(...matches.map((m) => m.week));

  const coachItems = await findCoachPressureStories(leagueId, latestWeek);
  items.push(...coachItems);

  const playerItems = await findPlayerTensionStories(leagueId, latestWeek);
  items.push(...playerItems);

  // 1. Most lopsided recent blowout
  const blowout = [...matches]
    .filter((m) => Math.abs(m.homeScore - m.awayScore) >= 17)
    .sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0];
  if (blowout) {
    const homeWon  = blowout.homeScore > blowout.awayScore;
    const winner   = homeWon ? blowout.homeTeam : blowout.awayTeam;
    const loser    = homeWon ? blowout.awayTeam : blowout.homeTeam;
    const ws       = Math.max(blowout.homeScore, blowout.awayScore);
    const ls       = Math.min(blowout.homeScore, blowout.awayScore);
    items.push(withSource({
      headline:   `${winner.name} crush ${loser.name} ${ws}–${ls}`,
      summary:    `Statement performance in Week ${blowout.week}. ${loser.name} had no answers.`,
      category:   'BLOWOUT',
      week:       blowout.week,
      leagueName: blowout.homeTeam.league.name,
    }, loser.name, leagueId));
    used.add(blowout.id);
  }

  // 2. Best upset — lower offense+defense rating sum beats higher
  const upset = [...matches]
    .filter((m) => !used.has(m.id))
    .map((m) => {
      const homeRating = m.homeTeam.offenseRating + m.homeTeam.defenseRating;
      const awayRating = m.awayTeam.offenseRating + m.awayTeam.defenseRating;
      const homeWon    = m.homeScore > m.awayScore;
      const winnerRating = homeWon ? homeRating : awayRating;
      const loserRating  = homeWon ? awayRating : homeRating;
      const ratingGap    = loserRating - winnerRating; // positive when underdog won
      return { m, homeWon, ratingGap };
    })
    .filter((x) => x.ratingGap >= 12 && x.m.homeScore !== x.m.awayScore)
    .sort((a, b) => b.ratingGap - a.ratingGap)[0];
  if (upset) {
    const winner = upset.homeWon ? upset.m.homeTeam : upset.m.awayTeam;
    const loser  = upset.homeWon ? upset.m.awayTeam : upset.m.homeTeam;
    const ws     = Math.max(upset.m.homeScore, upset.m.awayScore);
    const ls     = Math.min(upset.m.homeScore, upset.m.awayScore);
    items.push(withSource({
      headline:   `Stunner: ${winner.name} upset ${loser.name} ${ws}–${ls}`,
      summary:    `${winner.name} pulled off the surprise of Week ${upset.m.week}.`,
      category:   'UPSET',
      week:       upset.m.week,
      leagueName: upset.m.homeTeam.league.name,
    }, winner.name, leagueId));
    used.add(upset.m.id);
  }

  // 3. Thriller — close, high-scoring
  const thriller = [...matches]
    .filter((m) => !used.has(m.id))
    .filter((m) => Math.abs(m.homeScore - m.awayScore) <= 4 && m.homeScore + m.awayScore >= 40)
    .sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];
  if (thriller) {
    const homeWon = thriller.homeScore > thriller.awayScore;
    const winner  = homeWon ? thriller.homeTeam : thriller.awayTeam;
    const loser   = homeWon ? thriller.awayTeam : thriller.homeTeam;
    const ws      = Math.max(thriller.homeScore, thriller.awayScore);
    const ls      = Math.min(thriller.homeScore, thriller.awayScore);
    items.push(withSource({
      headline:   `${winner.name} edge ${loser.name} ${ws}–${ls}`,
      summary:    `Instant classic in Week ${thriller.week} — game came down to the wire.`,
      category:   'THRILLER',
      week:       thriller.week,
      leagueName: thriller.homeTeam.league.name,
    }, winner.name, leagueId));
    used.add(thriller.id);
  }

  // 4. Streak watch — find a team currently on a 4+ game W or L streak
  const streakItem = await findStreakStory(leagueId);
  if (streakItem) items.push(streakItem);

  const tradeItem = await findTradeStory(leagueId);
  if (tradeItem) items.push(tradeItem);

  // Sort by week desc (newest first), trim to limit
  const weeklyPool = items
    .sort((a, b) => b.week - a.week || newsPriority(b.category) - newsPriority(a.category))
    .slice(0, 5);

  return pickWeeklySelection(weeklyPool, latestWeek, leagueId, limit);
}

async function generatePreseasonNews(limit: number, leagueId: string | undefined): Promise<NewsItem[]> {
  const teams = await prisma.team.findMany({
    where: leagueId ? { leagueId } : undefined,
    include: {
      league: true,
      coaches: true,
      players: true,
    },
  });

  if (teams.length === 0) return [];

  const week = 1;
  const items: NewsDraft[] = [];
  const titleFavorite = [...teams]
    .sort((a, b) => (b.offenseRating + b.defenseRating) - (a.offenseRating + a.defenseRating))[0];

  if (titleFavorite) {
    items.push(withSource({
      headline: `${titleFavorite.name} set the Week 1 standard`,
      summary: `${titleFavorite.league.name}'s top-rated roster opens as the team to chase.`,
      category: 'STANDINGS',
      week,
      leagueName: titleFavorite.league.name,
    }, titleFavorite.name, leagueId));
  }

  const identityCoach = teams
    .flatMap((team) => team.coaches
      .filter((coach) => coach.role === 'OC' || coach.role === 'DC')
      .map((coach) => ({ team, coach })))
    .sort((a, b) => b.coach.reputation - a.coach.reputation)[0];

  if (identityCoach) {
    const side = identityCoach.coach.role === 'OC' ? 'offense' : 'defense';
    items.push(withSource({
      headline: `${identityCoach.team.name} lean into ${identityCoach.coach.philosophy}`,
      summary: `${identityCoach.coach.name}'s ${side} gives them a clear Week 1 identity.`,
      category: 'COACH',
      week,
      leagueName: identityCoach.team.league.name,
    }, identityCoach.team.name, leagueId));
  }

  const playerWatch = teams
    .flatMap((team) => team.players.map((player) => ({ team, player })))
    .sort((a, b) => {
      const contractScore = Number(b.player.contractYearsLeft === 1) - Number(a.player.contractYearsLeft === 1);
      return contractScore || b.player.overall - a.player.overall;
    })[0];

  if (playerWatch) {
    const contractNote = playerWatch.player.contractYearsLeft === 1
      ? 'with a contract call looming'
      : 'with expectations climbing';
    items.push(withSource({
      headline: `${playerWatch.player.name} headlines Week 1 watch list`,
      summary: `${playerWatch.team.name}'s ${playerWatch.player.overall}-rated ${playerWatch.player.position} opens ${contractNote}.`,
      category: 'PLAYER',
      week,
      leagueName: playerWatch.team.league.name,
    }, playerWatch.team.name, leagueId));
  }

  if (items.length < limit) {
    const opener = await prisma.match.findFirst({
      where: leagueId ? { leagueId, week: 1 } : { week: 1 },
      include: { homeTeam: { include: { league: true } }, awayTeam: true },
      orderBy: { id: 'asc' },
    });

    if (opener) {
      items.push(withSource({
        headline: `${opener.homeTeam.name} host ${opener.awayTeam.name} in Week 1 opener`,
        summary: `The schedule starts with an early tone-setter in ${opener.homeTeam.league.name}.`,
        category: 'STANDINGS',
        week,
        leagueName: opener.homeTeam.league.name,
      }, opener.homeTeam.name, leagueId));
    }
  }

  return pickWeeklySelection(items, week, leagueId, limit);
}

function withSource(item: NewsItem, sourceTeamName: string, leagueId: string | undefined): NewsDraft {
  const sourceName = sourceNameForTeam(sourceTeamName, item.week, leagueId, item.category);
  return { ...item, sourceName, sourceTeamName };
}

function sourceNameForTeam(teamName: string, week: number, leagueId: string | undefined, category: NewsItem['category']): string {
  const town = townFromTeamName(teamName);
  const activeSuffixes = activeSourceSuffixes(week, leagueId);
  const suffix = activeSuffixes[stableIndex(`${teamName}:${category}:${week}`, activeSuffixes.length)];
  return `${town} ${suffix}`;
}

function activeSourceSuffixes(week: number, leagueId: string | undefined): string[] {
  const start = stableIndex(`${leagueId ?? 'all'}:${week}:sources`, SOURCE_SUFFIXES.length);
  return [0, 1, 2].map((offset) => SOURCE_SUFFIXES[(start + offset) % SOURCE_SUFFIXES.length]);
}

function townFromTeamName(teamName: string): string {
  const parts = teamName.trim().split(/\s+/);
  return parts.length <= 1 ? teamName : parts.slice(0, -1).join(' ');
}

function stableIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % modulo;
}

function pickWeeklySelection(items: NewsDraft[], week: number, leagueId: string | undefined, limit: number): NewsItem[] {
  const selected = [...items]
    .sort((a, b) => stableIndex(`${leagueId ?? 'all'}:${week}:${a.headline}`, 10_000) - stableIndex(`${leagueId ?? 'all'}:${week}:${b.headline}`, 10_000))
    .slice(0, limit)
    .map((item, index) => assignUniqueSource(item, index, week, leagueId));

  return selected
    .sort((a, b) => b.week - a.week || newsPriority(b.category) - newsPriority(a.category))
    .map(stripDraftFields);
}

function assignUniqueSource(item: NewsDraft, index: number, week: number, leagueId: string | undefined): NewsDraft {
  const town = townFromTeamName(item.sourceTeamName);
  const activeSuffixes = activeSourceSuffixes(week, leagueId);
  const suffix = activeSuffixes[index % activeSuffixes.length];
  return { ...item, sourceName: `${town} ${suffix}` };
}

function stripDraftFields(item: NewsDraft): NewsItem {
  const { sourceTeamName: _sourceTeamName, score: _score, ...newsItem } = item;
  return {
    ...newsItem,
    headline: limitNewsText(newsItem.headline),
    summary:  limitNewsText(newsItem.summary),
  };
}

function limitNewsText(value: string): string {
  if (value.length <= NEWS_TEXT_LIMIT) return value;
  return value.slice(0, NEWS_TEXT_LIMIT).trimEnd();
}

function newsPriority(category: NewsItem['category']): number {
  switch (category) {
    case 'COACH': return 6;
    case 'PLAYER': return 5;
    case 'STREAK': return 4;
    case 'UPSET': return 3;
    case 'THRILLER': return 2;
    case 'BLOWOUT': return 1;
    case 'STANDINGS': return 0;
  }
}

async function findCoachPressureStories(leagueId: string | undefined, currentWeek: number): Promise<NewsDraft[]> {
  const coaches = await prisma.coach.findMany({
    where: { role: 'HEAD_COACH', teamId: { not: null }, team: leagueId ? { leagueId } : undefined },
    include: { team: { include: { league: true } } },
  });

  const stories: NewsDraft[] = [];

  for (const coach of coaches) {
    if (!coach.team) continue;
    const form = await teamFormSnapshot(coach.team.id);
    const weakStart = currentWeek <= 5 && form.played >= 3 && form.losses >= form.wins + 2;
    const losingRun = form.streakType === 'L' && form.streak >= 3;
    const hotSeat = coach.hotSeat >= 62;
    if (!weakStart && !losingRun && !hotSeat) continue;

    const record = `${form.wins}-${form.losses}${form.ties ? `-${form.ties}` : ''}`;
    const headline = weakStart
      ? `${coach.name} faces questions after ${coach.team.name}'s ${record} start`
      : losingRun
        ? `${coach.team.name} skid puts ${coach.name} on the hot seat`
        : `${coach.name}'s seat heating up at ${coach.team.name}`;
    const summary = weakStart
      ? `${coach.team.name} expected a cleaner start, and the ${coach.philosophy} approach is already being picked apart.`
      : losingRun
        ? `${coach.team.name} have dropped ${form.streak} straight, raising pressure on a staff built around ${coach.philosophy}.`
        : `${coach.hotSeat}/100 hot-seat pressure has turned every weekly decision into a referendum on ${coach.philosophy}.`;

    stories.push({
      ...withSource({
        headline,
        summary,
        category: 'COACH',
        week: currentWeek,
        leagueName: coach.team.league.name,
      }, coach.team.name, leagueId),
      score:
        coach.hotSeat + form.losses * 8 + (losingRun ? 20 : 0) + (weakStart ? 24 : 0),
    });
  }

  return stories.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 2);
}

async function findPlayerTensionStories(leagueId: string | undefined, currentWeek: number): Promise<NewsDraft[]> {
  const players = await prisma.player.findMany({
    where: {
      team: leagueId ? { leagueId } : undefined,
      contractYearsLeft: 1,
      overall: { gte: 78 },
    },
    include: { team: { include: { league: true } } },
  });

  const stories: NewsDraft[] = [];

  for (const player of players) {
    if (!player.team) continue;
    const form = await teamFormSnapshot(player.team.id);
    const losingTeam = form.streakType === 'L' && form.streak >= 2;
    const contractTension = player.contractYearsLeft === 1 && player.overall >= 78;

    let headline: string;
    let summary: string;

    if (losingTeam) {
      headline = `${player.name} pressed for response as ${player.team.name} skid grows`;
      summary = `The ${player.position} is under the microscope while ${player.team.name} fight a ${form.streak}-game losing run.`;
    } else if (contractTension) {
      headline = `${player.name} contract watch intensifies`;
      summary = `${player.team.name} have a decision coming on the ${player.overall}-rated ${player.position}, who is entering a final contract year.`;
    } else {
      headline = `${player.name} searching for spark at ${player.team.name}`;
      summary = `Coaches want more from the ${player.overall}-rated ${player.position} as ${player.team.name} look to find rhythm.`;
    }

    stories.push({
      ...withSource({
        headline,
        summary,
        category: 'PLAYER',
        week: currentWeek,
        leagueName: player.team.league.name,
      }, player.team.name, leagueId),
      score:
        (contractTension ? 24 : 0) +
        (losingTeam ? 16 : 0) +
        Math.max(0, player.overall - 75),
    });
  }

  return stories.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 2);
}

async function teamFormSnapshot(teamId: string): Promise<{ wins: number; losses: number; ties: number; played: number; streak: number; streakType: 'W' | 'L' | 'T' | 'NONE' }> {
  const matches = await prisma.match.findMany({
    where:   { played: true, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { week: 'desc' },
    take:    8,
  });

  let wins = 0;
  let losses = 0;
  let ties = 0;
  const results = matches.map((m) => {
    const my = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
    const theirs = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
    if (my > theirs) {
      wins++;
      return 'W' as const;
    }
    if (my < theirs) {
      losses++;
      return 'L' as const;
    }
    ties++;
    return 'T' as const;
  });

  const first: 'W' | 'L' | 'T' | 'NONE' = results[0] ?? 'NONE';
  let streak = 0;
  for (const result of results) {
    if (result === first) streak++;
    else break;
  }

  return { wins, losses, ties, played: matches.length, streak, streakType: first };
}

async function findTradeStory(leagueId: string | undefined): Promise<NewsDraft | null> {
  const leagueTeams = leagueId
    ? await prisma.team.findMany({ where: { leagueId }, select: { id: true } })
    : [];
  const teamIds = new Set(leagueTeams.map((team) => team.id));
  const trade = await prisma.tradeHistory.findFirst({
    where: leagueId
      ? { OR: [{ fromTeamId: { in: [...teamIds] } }, { toTeamId: { in: [...teamIds] } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
  });
  if (!trade) return null;

  return withSource({
    headline: `${trade.toTeamName} land ${trade.playerName}`,
    summary: `${trade.fromTeamName} moved ${trade.playerName} for $${(trade.fee / 1_000_000).toFixed(1)}M as the market keeps shifting.`,
    category: 'STANDINGS',
    week: 0,
  }, trade.toTeamName, leagueId);
}

async function findStreakStory(leagueId: string | undefined): Promise<NewsDraft | null> {
  const teams = await prisma.team.findMany({
    where: leagueId ? { leagueId } : undefined,
    include: { league: true },
  });

  let best: { team: typeof teams[number]; streak: number; type: 'W' | 'L' } | null = null;

  for (const team of teams) {
    const matches = await prisma.match.findMany({
      where:   { played: true, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      orderBy: { week: 'desc' },
      take:    8,
    });
    if (matches.length < 4) continue;

    const results = matches.map((m) => {
      const my   = m.homeTeamId === team.id ? m.homeScore : m.awayScore;
      const theirs = m.homeTeamId === team.id ? m.awayScore : m.homeScore;
      return my > theirs ? 'W' : my < theirs ? 'L' : 'T';
    });

    const first = results[0];
    if (first === 'T') continue;
    let count = 0;
    for (const r of results) {
      if (r === first) count++;
      else break;
    }

    if (count >= 4 && (!best || count > best.streak)) {
      best = { team, streak: count, type: first as 'W' | 'L' };
    }
  }

  if (!best) return null;

  const week = await prisma.match.findFirst({
    where:   { played: true },
    orderBy: { week: 'desc' },
    select:  { week: true },
  });

  if (best.type === 'W') {
    return withSource({
      headline:   `${best.team.name} on ${best.streak}-game win streak`,
      summary:    `${best.team.name} have caught fire in ${best.team.league.name}.`,
      category:   'STREAK',
      week:       week?.week ?? 0,
      leagueName: best.team.league.name,
    }, best.team.name, leagueId);
  }
  return withSource({
    headline:   `${best.team.name} drop ${best.streak} straight`,
    summary:    `Pressure mounting in ${best.team.league.name} — coaching seat heating up.`,
    category:   'STREAK',
    week:       week?.week ?? 0,
    leagueName: best.team.league.name,
  }, best.team.name, leagueId);
}
