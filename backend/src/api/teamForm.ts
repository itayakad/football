import { prisma } from '../db';

export interface RecentForm {
  streak:      { type: 'W' | 'L' | 'T' | 'NONE'; count: number };
  lastResults: Array<'W' | 'L' | 'T'>; // most recent first
}

// Compute a team's recent form from their played matches.
// Used by the dashboard ("you're on a 4-game win streak") and match preview
// ("opponent has lost 3 straight"). Drives the emotional-continuity layer.
export async function computeRecentForm(teamId: string, limit = 5): Promise<RecentForm> {
  const matches = await prisma.match.findMany({
    where: {
      played: true,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { week: 'desc' },
    take:    limit,
  });

  const results: Array<'W' | 'L' | 'T'> = matches.map((m) => {
    const myScore   = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
    const theirScore = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
    if (myScore > theirScore) return 'W';
    if (myScore < theirScore) return 'L';
    return 'T';
  });

  // Streak = consecutive same-result from most recent
  if (results.length === 0) return { streak: { type: 'NONE', count: 0 }, lastResults: [] };

  const streakType = results[0];
  let streakCount  = 0;
  for (const r of results) {
    if (r === streakType) streakCount++;
    else break;
  }

  return { streak: { type: streakType, count: streakCount }, lastResults: results };
}
