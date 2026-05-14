import { prisma } from '../db';

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL'];
const DEFENSE_POSITIONS = ['DE', 'DT', 'LB', 'CB', 'S'];

export interface PlayerAward {
  playerId:   string;
  playerName: string;
  teamName:   string;
  position:   string;
  overall:    number;
  age:        number;
}

export interface CoachAward {
  coachId:   string;
  coachName: string;
  teamName:  string;
  wins:      number;
  losses:    number;
}

export interface LeagueAwards {
  mvp:    PlayerAward | null;
  opoy:   PlayerAward | null;
  dpoy:   PlayerAward | null;
  roty:   PlayerAward | null;
  hcoty:  CoachAward | null;
}

interface ScoredPlayer {
  player: {
    id: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
    age: number;
  };
  teamName: string;
  teamRank: number;
  score: number;
}

export async function computeLeagueAwards(season: number, leagueId: string): Promise<LeagueAwards> {
  const histories = await prisma.teamSeasonHistory.findMany({
    where: { season, team: { leagueId } },
    orderBy: { rank: 'asc' },
    include: { team: { include: { players: true, coaches: true } } },
  });

  if (histories.length === 0) {
    return { mvp: null, opoy: null, dpoy: null, roty: null, hcoty: null };
  }

  const totalTeams = histories.length;
  const scored: ScoredPlayer[] = histories.flatMap((row) =>
    row.team.players.map((player) => ({
      player,
      teamName: row.teamName,
      teamRank: row.rank,
      score: scorePlayer(player, row.rank, totalTeams),
    }))
  );

  const mvp = pickTop(scored, () => true);
  const opoy = pickTop(scored, (p) => OFFENSE_POSITIONS.includes(p.player.position));
  const dpoy = pickTop(scored, (p) => DEFENSE_POSITIONS.includes(p.player.position));
  const roty = pickTop(scored, (p) => p.player.age <= 22);

  const bestTeam = histories[0];
  const hc = bestTeam.team.coaches.find((coach) => coach.role === 'HEAD_COACH');
  const hcoty: CoachAward | null = hc ? {
    coachId:   hc.id,
    coachName: hc.name,
    teamName:  bestTeam.teamName,
    wins:      bestTeam.wins,
    losses:    bestTeam.losses,
  } : null;

  return { mvp, opoy, dpoy, roty, hcoty };
}

function scorePlayer(
  player: { overall: number; potential: number; position: string },
  teamRank: number,
  totalTeams: number,
): number {
  const positionalBoost =
    player.position === 'QB' ? 8 :
    ['WR', 'RB', 'DE', 'CB'].includes(player.position) ? 4 :
    0;
  const teamBonus = (totalTeams + 1 - teamRank) * 2;
  const upside = Math.max(0, player.potential - player.overall) * 0.35;
  return player.overall * 1.8 + upside + positionalBoost + teamBonus;
}

function pickTop(scored: ScoredPlayer[], filter: (p: ScoredPlayer) => boolean): PlayerAward | null {
  const eligible = scored.filter(filter);
  if (eligible.length === 0) return null;
  const top = eligible.sort((a, b) => b.score - a.score)[0];
  return {
    playerId:   top.player.id,
    playerName: top.player.name,
    teamName:   top.teamName,
    position:   top.player.position,
    overall:    top.player.overall,
    age:        top.player.age,
  };
}
