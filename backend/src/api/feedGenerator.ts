import type { MatchSimResult, PlayEvent } from '../simulation/matchEngine';

export interface FeedEvent {
  quarter:    number;
  clock:      string;
  text:       string;
  detail?:    string;  // optional player-level description shown below the bold header
  homeScore:  number;
  awayScore:  number;
  type:       'KICKOFF' | 'SCORE' | 'TURNOVER' | 'PUNT' | 'PLAY' | 'HALFTIME' | 'FINAL';
  points?:    number;
  scoringTeam?: 'home' | 'away';
  possessionTeam?: 'home' | 'away';
  down?: number;
  distance?: number;
  yardLine?: number;
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
    clock: '15:00',
    type: 'KICKOFF',
    text: `${snap(home, away, firstKicker).name} kicks off. ${snap(home, away, firstReceiver).name} returns it to start the game.`,
    homeScore: 0,
    awayScore: 0,
    possessionTeam: firstReceiver,
    yardLine: 25,
  });

  for (const drive of result.drives) {
    const off = snap(home, away, drive.side);
    const def = snap(home, away, otherSide(drive.side));

    for (const play of drive.plays) {
      // Special-action events get their own lines below — skip generic play text for them.
      // TD, SAFETY, INT, and FUMBLE plays are absorbed into their respective banners so they don't appear twice.
      if (
        play.scoringEvent === 'FG_GOOD' ||
        play.scoringEvent === 'FG_MISS' ||
        play.scoringEvent === 'PUNT'    ||
        play.scoringEvent === 'TD'      ||
        play.scoringEvent === 'SAFETY'  ||
        play.scoringEvent === 'INT'     ||
        play.scoringEvent === 'FUMBLE'
      ) continue;
      const text = playText(off, def, play);
      events.push({
        quarter: play.quarter,
        clock: clockForPlay(play.quarter, play.drive, play.down),
        type: 'PLAY',
        text,
        homeScore: homeRun,
        awayScore: awayRun,
        possessionTeam: drive.side,
        down: play.down,
        distance: play.distance,
        yardLine: play.yardLine,
      });
    }

    // Drive resolution event
    if (drive.result === 'TD') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      const scoringPlay = drive.plays[drive.plays.length - 1];
      const detail = scoringPlay ? playText(off, def, scoringPlay) : undefined;
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'SCORE', points: drive.points,
        text: 'TOUCHDOWN!',
        detail,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
        yardLine: 100,
      });
    } else if (drive.result === 'FG') {
      const yards = 100 - drive.endYardLine + 17;
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'SCORE', points: drive.points,
        text: 'FIELD GOAL!',
        detail: `${off.name} converts from ${Math.round(yards)} yards out.`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
        yardLine: drive.endYardLine,
      });
    } else if (drive.result === 'MISSED_FG') {
      const yards = 100 - drive.endYardLine + 17;
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'PLAY',
        text: `${off.name}'s ${Math.round(yards)}-yard field goal attempt is NO GOOD.`,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
        yardLine: drive.endYardLine,
      });
    } else if (drive.result === 'DEFENSIVE_TD') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'SCORE', points: drive.points,
        text: 'PICK SIX!',
        detail: `${def.name} takes it the distance!`,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
        yardLine: drive.endYardLine,
      });
    } else if (drive.result === 'SAFETY') {
      homeRun += drive.scoringSide === 'home' ? drive.points : 0;
      awayRun += drive.scoringSide === 'away' ? drive.points : 0;
      const safetyPlay = drive.plays[drive.plays.length - 1];
      const safetyDetail = safetyPlay ? playText(off, def, safetyPlay) : `${def.name} forces the takedown in the end zone — two points.`;
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'SCORE', points: drive.points,
        text: 'SAFETY!',
        detail: safetyDetail,
        homeScore: homeRun, awayScore: awayRun,
        scoringTeam: drive.scoringSide!, possessionTeam: drive.scoringSide!,
        yardLine: 0,
      });
    } else if (drive.result === 'PUNT') {
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'PUNT',
        text: `${off.name} punts.`,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
        yardLine: drive.endYardLine,
      });
    } else if (drive.result === 'TURNOVER' || drive.result === 'TURNOVER_ON_DOWNS') {
      const last = drive.plays[drive.plays.length - 1];
      const kind = last?.scoringEvent;
      let bannerText: string;
      let detail: string | undefined;
      if (kind === 'INT' && last) {
        bannerText = 'INTERCEPTION!';
        detail = playText(off, def, last);  // e.g. "M. Baker intercepts it."
      } else if (kind === 'FUMBLE' && last) {
        bannerText = 'FUMBLE!';
        detail = playText(off, def, last);  // e.g. "D. Taylor forces the fumble."
      } else {
        bannerText = `${off.name} turns it over on downs. ${def.name} takes over.`;
      }
      events.push({
        quarter: drive.quarter, clock: clockForDriveEnd(drive), type: 'TURNOVER',
        text: bannerText,
        detail,
        homeScore: homeRun, awayScore: awayRun,
        possessionTeam: drive.side,
        yardLine: drive.endYardLine,
      });
    }

    if (!halftimeFired && drive.quarter >= 2) {
      // Fire halftime after the last drive of Q2.
      const nextDriveQuarter = result.drives[result.drives.indexOf(drive) + 1]?.quarter;
      if (!nextDriveQuarter || nextDriveQuarter >= 3) {
        events.push({
          quarter: 2, clock: '00:00', type: 'HALFTIME',
          text: `Halftime — ${home.name} ${homeRun}, ${away.name} ${awayRun}.`,
          homeScore: homeRun, awayScore: awayRun,
        });
        halftimeFired = true;
      }
    }
  }

  events.push({
    quarter: 4, clock: '00:00', type: 'FINAL',
    text: `FINAL — ${home.name} ${result.homeScore}, ${away.name} ${result.awayScore}.`,
    homeScore: result.homeScore, awayScore: result.awayScore,
  });

  return events;
}

function clockForPlay(quarter: number, driveIdx: number, down: number): string {
  const quarterStartDrive = quarter === 1 ? 0 : quarter === 2 ? 4 : quarter === 3 ? 8 : 12;
  const drivesInQuarter = 4;
  const driveOffset = Math.max(0, driveIdx - quarterStartDrive);
  const baseSeconds = Math.max(0, 15 * 60 - Math.floor((driveOffset / drivesInQuarter) * 15 * 60));
  const seconds = Math.max(0, baseSeconds - (down - 1) * 32);
  return formatClock(seconds);
}

function clockForDriveEnd(drive: { quarter: number; drive: number; plays: PlayEvent[] }): string {
  const last = drive.plays[drive.plays.length - 1];
  if (last) return clockForPlay(last.quarter, last.drive, last.down);
  return clockForPlay(drive.quarter, drive.drive, 4);
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function snap(home: TeamSnapshot, away: TeamSnapshot, side: 'home' | 'away'): TeamSnapshot {
  return side === 'home' ? home : away;
}

function otherSide(s: 'home' | 'away'): 'home' | 'away' {
  return s === 'home' ? 'away' : 'home';
}

function playText(off: TeamSnapshot, def: TeamSnapshot, play: PlayEvent): string {
  const player = play.highlightPlayer;
  const name = player ? shortName(player.name) : play.offenseWon ? off.name : def.name;

  if (play.scoringEvent === 'TD') {
    return `${name} scores from ${Math.max(1, play.yards)} yards out.`;
  }
  if (play.scoringEvent === 'INT') {
    return `${name} intercepts it.`;
  }
  if (play.scoringEvent === 'FUMBLE') {
    return `${name} forces the fumble.`;
  }
  if (play.scoringEvent === 'TURNOVER_ON_DOWNS') {
    return `${name} makes the stop on downs.`;
  }
  if (play.scoringEvent === 'SAFETY') {
    return `${name} forces a safety.`;
  }

  if (play.offenseWon) {
    if (play.offenseCategory === 'RUNNING') return `${name} runs for ${Math.max(0, play.yards)}.`;
    if (play.offenseCategory === 'SHORT_PASS') return `${name} works underneath for ${Math.max(0, play.yards)}.`;
    if (play.offenseCategory === 'MIDDLE_PASS') return `${name} finds space for ${Math.max(0, play.yards)}.`;
    return `${name} wins deep for ${Math.max(0, play.yards)}.`;
  }
  if (play.yards < 0) return `${name} drops it for ${Math.abs(play.yards)} yard loss.`;
  if (play.yards === 0) return `${name} shuts it down.`;
  return `${name} limits it to ${play.yards}.`;
}

function shortName(name: string): string {
  const [first, ...rest] = name.split(' ');
  return `${first.charAt(0)}. ${rest.join(' ') || first}`.trim();
}
