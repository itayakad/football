import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile } from './matchEngine';
import { computeStandings, TeamRecord } from './standings';
import { chooseAIGameplan } from './aiCoach';
import { normalizePlayLoadout } from './playLibrary';

export interface MatchResultRecord {
  week: number;
  leagueId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  narrative: string;
  keyMatchup: string;
  quarterScores: Array<[number, number]>;
}

export interface LeagueResult {
  leagueId: string;
  leagueName: string;
  tier: number;
  standings: TeamRecord[];
  matchResults: MatchResultRecord[];
}

const TOTAL_WEEKS    = 14;

export async function simulateSeason(): Promise<LeagueResult[]> {
  const leagues = await prisma.league.findMany({
    include: { teams: true },
    orderBy: { tier: 'asc' },
  });

  const allMatchResults: MatchResultRecord[] = [];

  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    const weekMatches = await prisma.match.findMany({
      where: { week, played: false },
      include: {
        homeTeam: { include: { players: true, coaches: true } },
        awayTeam: { include: { players: true, coaches: true } },
      },
    });

    type WeekResult = {
      matchId: string;
      leagueId: string;
      homeTeamId: string;
      awayTeamId: string;
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
      homeGameplan: import('./gameplan').Gameplan;
      awayGameplan: import('./gameplan').Gameplan;
      narrative: string;
      keyMatchup: string;
      quarterScores: Array<[number, number]>;
    };

    const weekResults: WeekResult[] = weekMatches.map((match) => {
      const home: TeamMatchProfile = {
        id:       match.homeTeamId,
        name:     match.homeTeam.name,
        coaches:  match.homeTeam.coaches,
        players:  match.homeTeam.players,
        offensivePlays: normalizePlayLoadout('offense', match.homeTeam.offensivePlays),
        defensivePlays: normalizePlayLoadout('defense', match.homeTeam.defensivePlays),
      };

      const away: TeamMatchProfile = {
        id:       match.awayTeamId,
        name:     match.awayTeam.name,
        coaches:  match.awayTeam.coaches,
        players:  match.awayTeam.players,
        offensivePlays: normalizePlayLoadout('offense', match.awayTeam.offensivePlays),
        defensivePlays: normalizePlayLoadout('defense', match.awayTeam.defensivePlays),
      };

      const homeGameplan = chooseAIGameplan(home);
      const awayGameplan = chooseAIGameplan(away);

      const result = simulateMatch(home, away, week, homeGameplan, awayGameplan);

      return {
        matchId:       match.id,
        leagueId:      match.leagueId,
        homeTeamId:    match.homeTeamId,
        awayTeamId:    match.awayTeamId,
        homeTeamName:  match.homeTeam.name,
        awayTeamName:  match.awayTeam.name,
        homeScore:     result.homeScore,
        awayScore:     result.awayScore,
        homeGameplan,
        awayGameplan,
        narrative:     result.narrative,
        keyMatchup:    result.keyMatchup,
        quarterScores: result.quarterScores,
      };
    });

    await Promise.all(
      weekResults.map((r) =>
        prisma.match.update({
          where: { id: r.matchId },
          data:  {
            homeScore:    r.homeScore,
            awayScore:    r.awayScore,
            played:       true,
            homeGameplan: r.homeGameplan as any,
            awayGameplan: r.awayGameplan as any,
          },
        })
      )
    );

    for (const r of weekResults) {
      allMatchResults.push({
        week,
        leagueId:      r.leagueId,
        homeTeamName:  r.homeTeamName,
        awayTeamName:  r.awayTeamName,
        homeScore:     r.homeScore,
        awayScore:     r.awayScore,
        narrative:     r.narrative,
        keyMatchup:    r.keyMatchup,
        quarterScores: r.quarterScores,
      });
    }

    const wk = String(week).padStart(2, ' ');
    process.stdout.write(`  Week ${wk}/${TOTAL_WEEKS}... done (${weekMatches.length} games)\n`);
  }

  const results: LeagueResult[] = [];
  for (const league of leagues) {
    const played = await prisma.match.findMany({
      where: { leagueId: league.id, played: true },
    });

    const standings = computeStandings(
      played,
      league.teams.map((t) => ({ id: t.id, name: t.name }))
    );

    results.push({
      leagueId:     league.id,
      leagueName:   league.name,
      tier:         league.tier,
      standings,
      matchResults: allMatchResults.filter((m) => m.leagueId === league.id),
    });
  }

  return results;
}
