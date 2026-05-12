export interface TeamRecord {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

export interface PlayedMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamEntry {
  id: string;
  name: string;
}

export function computeStandings(matches: PlayedMatch[], teams: TeamEntry[]): TeamRecord[] {
  const records = new Map<string, TeamRecord>();

  for (const team of teams) {
    records.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    });
  }

  for (const match of matches) {
    const home = records.get(match.homeTeamId);
    const away = records.get(match.awayTeamId);
    if (!home || !away) continue;

    home.pointsFor += match.homeScore;
    home.pointsAgainst += match.awayScore;
    away.pointsFor += match.awayScore;
    away.pointsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.wins++;
      away.losses++;
    } else if (match.awayScore > match.homeScore) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }
  }

  return [...records.values()]
    .map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.diff - a.diff;
    });
}
