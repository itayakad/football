import { prisma } from '../db';
import { simulateMatch, TeamMatchProfile } from './matchEngine';
import { computeStandings, TeamRecord } from './standings';
import { chooseAIGameplan } from './aiCoach';

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
const MORALE_SWING   = 5;

export async function simulateSeason(): Promise<LeagueResult[]> {
  const leagues = await prisma.league.findMany({
    include: { teams: true },
    orderBy: { tier: 'asc' },
  });

  const allMatchResults: MatchResultRecord[] = [];

  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    // Load matches with full team + player data.
    // Players needed for position group calculations (OL vs front seven, etc.)
    const weekMatches = await prisma.match.findMany({
      where: { week, played: false },
      include: {
        homeTeam: { include: { players: true, coaches: true } },
        awayTeam: { include: { players: true, coaches: true } },
      },
    });

    // Snapshot morale at start of week — games within the same week don't
    // affect each other. Win streaks compound week-over-week, not game-over-game.
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
        id:            match.homeTeamId,
        name:          match.homeTeam.name,
        offenseRating: match.homeTeam.offenseRating,
        defenseRating: match.homeTeam.defenseRating,
        morale:        match.homeTeam.morale,
        offenseStyle:  match.homeTeam.offenseStyle,
        offensivePhilosophy: match.homeTeam.offensivePhilosophy,
        defenseStyle:  match.homeTeam.defenseStyle,
        tempo:         match.homeTeam.tempo,
        coaches:       match.homeTeam.coaches,
        players:       match.homeTeam.players,
      };

      const away: TeamMatchProfile = {
        id:            match.awayTeamId,
        name:          match.awayTeam.name,
        offenseRating: match.awayTeam.offenseRating,
        defenseRating: match.awayTeam.defenseRating,
        morale:        match.awayTeam.morale,
        offenseStyle:  match.awayTeam.offenseStyle,
        offensivePhilosophy: match.awayTeam.offensivePhilosophy,
        defenseStyle:  match.awayTeam.defenseStyle,
        tempo:         match.awayTeam.tempo,
        coaches:       match.awayTeam.coaches,
        players:       match.awayTeam.players,
      };

      // AI coach picks gameplans for both sides based on the matchup.
      // (User-controlled teams will later be able to override this pre-match.)
      const homeGameplan = chooseAIGameplan(home, away);
      const awayGameplan = chooseAIGameplan(away, home);

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

    // Persist scores + gameplans
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

    // Compute morale deltas from this week's outcomes
    const moraleDeltas = new Map<string, number>();
    for (const r of weekResults) {
      if (r.homeScore > r.awayScore) {
        moraleDeltas.set(r.homeTeamId, (moraleDeltas.get(r.homeTeamId) ?? 0) + MORALE_SWING);
        moraleDeltas.set(r.awayTeamId, (moraleDeltas.get(r.awayTeamId) ?? 0) - MORALE_SWING);
      } else if (r.awayScore > r.homeScore) {
        moraleDeltas.set(r.awayTeamId, (moraleDeltas.get(r.awayTeamId) ?? 0) + MORALE_SWING);
        moraleDeltas.set(r.homeTeamId, (moraleDeltas.get(r.homeTeamId) ?? 0) - MORALE_SWING);
      }
    }

    if (moraleDeltas.size > 0) {
      const teamIds = [...moraleDeltas.keys()];
      const current = await prisma.team.findMany({
        where:  { id: { in: teamIds } },
        select: { id: true, morale: true },
      });

      await Promise.all(
        current.map((team) => {
          const delta     = moraleDeltas.get(team.id) ?? 0;
          const newMorale = Math.max(0, Math.min(100, team.morale + delta));
          return prisma.team.update({ where: { id: team.id }, data: { morale: newMorale } });
        })
      );
    }

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

  // Final standings per league
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
