import type { MatchSimResult, PlayEvent, DriveOutcome } from '../simulation/matchEngine';
import { CATEGORY_LABEL, playById } from '../simulation/playLibrary';

export interface FeedEvent {
  quarter:    number;
  text:       string;
  homeScore:  number;
  awayScore:  number;
  type:       'KICKOFF' | 'SCORE' | 'TURNOVER' | 'PUNT' | 'PLAY' | 'HALFTIME' | 'FINAL';
  points?:    number;
  scoringTeam?: 'home' | 'away';
  possessionTeam?: 'home' | 'away';
}

export interface TopPlayer {
  name:     string;
  position: string;
  overall:  number;
}

export interface TeamSnapshot {
  name:       string;
  side:       'home' | 'away';
  topPlayers: TopPlayer[];
}

// Build a play-by-play feed directly from the simulation log. Each PlayEvent
// becomes one or more lines; drive endings produce SCORE/PUNT/TURNOVER events.
export function generateMatchFeed(
  home: TeamSnapshot,
  away: TeamSnapshot,
  result: MatchSimResult,
): FeedEvent[] {
  const events: FeedEvent[] = [];
  let homeRun = 0;
  let awayRun = 0;
  let halftimeFired = false;

  const firstOffense = result.drives[0]?.side ?? 'away';
  const firstReceiver = firstOffense;
  const firstKicker = otherSide(firstReceiver);
  events.push({
    quarter: 1,
    type: 'KICKOFF',
    text: `${snap(home, away, firstKicker).name} kicks off. ${snap(home, away, firstReceiver).name} returns it to start the game.`,
    homeScore: 0,
    awayScore: 0,
    possessionTeam: firstReceiver,
  });

  for (const drive of result.drives) {
    const off = snap(home, away, drive.side);
    const def = snap(home, away, otherSide(drive.side));

    for (const play of drive.plays) {
      // Special-action events (FG, punt) get their own lines below — skip generic play text for them.
      if (play.scoringEvent === 'FG_GOOD' || play.scoringEvent === 'FG_MISS' || play.scoringEvent === 'PUNT') continue;
      const text = playText(off, def, play);
      events.push({
        quarter: play.quarter,
        type: 'PLAY',
        text,
        homeScore: homeRun,
        awayScore: awayRun,
        possessionTeam: drive.side,
      });
    }

    // Drive resolution event
    if (drive.result === 'TD') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, type: 'SCORE', points: drive.points,
        text: `${off.name} finds the end zone — TOUCHDOWN!`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
      });
    } else if (drive.result === 'FG') {
      const yards = 100 - drive.endYardLine + 17;
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, type: 'SCORE', points: drive.points,
        text: `${off.name} settles for three from ${Math.round(yards)} out. Field goal is good.`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
      });
    } else if (drive.result === 'MISSED_FG') {
      const yards = 100 - drive.endYardLine + 17;
      events.push({
        quarter: drive.quarter, type: 'PLAY',
        text: `${off.name}'s ${Math.round(yards)}-yard field goal attempt is NO GOOD.`,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
      });
    } else if (drive.result === 'DEFENSIVE_TD') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, type: 'SCORE', points: drive.points,
        text: `INTERCEPTED AND RETURNED FOR A TOUCHDOWN — ${def.name} takes it the distance!`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
      });
    } else if (drive.result === 'SAFETY') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, type: 'SCORE', points: drive.points,
        text: `SAFETY! ${def.name} forces the takedown in the end zone — two points.`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
      });
    } else if (drive.result === 'PUNT') {
      events.push({
        quarter: drive.quarter, type: 'PUNT',
        text: `${off.name} punts.`,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
      });
    } else if (drive.result === 'TURNOVER' || drive.result === 'TURNOVER_ON_DOWNS') {
      const last = drive.plays[drive.plays.length - 1];
      const kind = last?.scoringEvent;
      const text =
        kind === 'INT' ? `INTERCEPTION! ${def.name} comes down with it. ${def.name} ball.`
        : kind === 'FUMBLE' ? `FUMBLE! ${def.name} recovers it. ${def.name} ball.`
        : `${off.name} turns it over on downs. ${def.name} takes over.`;
      events.push({
        quarter: drive.quarter, type: 'TURNOVER', text,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
      });
    }

    if (!halftimeFired && drive.quarter >= 2) {
      // Fire halftime after the last drive of Q2.
      const nextDriveQuarter = result.drives[result.drives.indexOf(drive) + 1]?.quarter;
      if (!nextDriveQuarter || nextDriveQuarter >= 3) {
        events.push({
          quarter: 2, type: 'HALFTIME',
          text: `Halftime — ${home.name} ${homeRun}, ${away.name} ${awayRun}.`,
          homeScore: homeRun, awayScore: awayRun,
        });
        halftimeFired = true;
      }
    }
  }

  events.push({
    quarter: 4, type: 'FINAL',
    text: `FINAL — ${home.name} ${result.homeScore}, ${away.name} ${result.awayScore}.`,
    homeScore: result.homeScore, awayScore: result.awayScore,
  });

  return events;
}

function snap(home: TeamSnapshot, away: TeamSnapshot, side: 'home' | 'away'): TeamSnapshot {
  return side === 'home' ? home : away;
}

function otherSide(s: 'home' | 'away'): 'home' | 'away' {
  return s === 'home' ? 'away' : 'home';
}

function playText(off: TeamSnapshot, def: TeamSnapshot, play: PlayEvent): string {
  const offName = playNameById(play.offensePlayId);
  const defName = playNameById(play.defensePlayId);
  const downStr = downAndDistance(play.down, play.distance);

  if (play.scoringEvent === 'TD') {
    return `${downStr}: ${off.name} ${offName} for ${play.yards} — TOUCHDOWN!`;
  }
  if (play.scoringEvent === 'INT') {
    return `${downStr}: ${off.name} ${offName} — INTERCEPTED by ${def.name}.`;
  }
  if (play.scoringEvent === 'FUMBLE') {
    return `${downStr}: ${off.name} ${offName} — FUMBLE! ${def.name} recovers.`;
  }
  if (play.scoringEvent === 'TURNOVER_ON_DOWNS') {
    return `${downStr}: ${off.name} ${offName} stuffed. Turnover on downs.`;
  }
  if (play.scoringEvent === 'SAFETY') {
    return `${downStr}: ${off.name} pinned in the end zone — SAFETY.`;
  }

  switch (play.resultLabel) {
    case 'GREAT_OFFENSE':
      return `${downStr}: ${off.name} ${offName} explodes for ${play.yards} yards against ${defName}.`;
    case 'OFFENSIVE_GAIN':
      return `${downStr}: ${off.name} ${offName} picks up ${play.yards} on ${defName}.`;
    case 'NEUTRAL':
      return play.yards <= 0
        ? `${downStr}: ${off.name} ${offName} stuffed for no gain by ${def.name}.`
        : `${downStr}: ${off.name} ${offName} for ${play.yards}.`;
    case 'DEFENSIVE_STOP':
      return `${downStr}: ${def.name} ${defName} holds ${off.name} to ${play.yards} yards.`;
    case 'GREAT_DEFENSE':
      return `${downStr}: ${def.name} ${defName} blows up the play — ${play.yards} yard loss.`;
  }
}

function playNameById(id: string): string {
  const p = playById(id);
  return p?.name ?? CATEGORY_LABEL[(p as any)?.category as keyof typeof CATEGORY_LABEL] ?? 'play';
}

function downAndDistance(down: number, distance: number): string {
  const ord = down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th';
  if (distance >= 50) return `${ord} & long`;
  return `${ord} & ${Math.max(1, distance)}`;
}
