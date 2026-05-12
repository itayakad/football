import type { MatchSimResult } from '../simulation/matchEngine';

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
  name:         string;
  offenseStyle: string;
  defenseStyle: string;
  topPlayers:   TopPlayer[];  // top N by overall (caller decides N; ~5-10 is fine)
}

// ─── Public API ──────────────────────────────────────────────
export function generateMatchFeed(
  home: TeamSnapshot,
  away: TeamSnapshot,
  result: MatchSimResult,
): FeedEvent[] {
  const events: FeedEvent[] = [];
  let homeRun = 0, awayRun = 0;
  let possession: 'home' | 'away' = 'away';

  events.push({
    quarter:   1,
    type:      'KICKOFF',
    text:      `${home.name} kicks off. ${away.name} returns it out to start the game.`,
    homeScore: 0,
    awayScore: 0,
    possessionTeam: 'away',
  });

  for (let q = 1; q <= 4; q++) {
    if (q === 3) {
      possession = 'home';
      events.push({
        quarter: q,
        type: 'KICKOFF',
        text: `${away.name} kicks off to open the second half. ${home.name} starts with possession.`,
        homeScore: homeRun,
        awayScore: awayRun,
        possessionTeam: 'home',
      });
    }

    const scoring = result.scoringDrives.filter((d) => d.quarter === q);
    const minDrives = Math.max(3, scoring.length + 1 + Math.floor(Math.random() * 2));
    let driveCount = 0;
    let scoringIndex = 0;

    while (scoringIndex < scoring.length || driveCount < minDrives) {
      const nextScore = scoring[scoringIndex];
      const shouldScore = nextScore != null && (
        nextScore.points === 2 ? nextScore.team === otherSide(possession) : nextScore.team === possession
      );
      const drive = shouldScore ? nextScore : null;
      const offenseSide = possession;
      const defenseSide = otherSide(offenseSide);
      const offense = offenseSide === 'home' ? home : away;
      const defense = defenseSide === 'home' ? home : away;

      const setupCount = shouldScore
        ? drive!.points === 2 ? 1 : 2 + Math.floor(Math.random() * 3)
        : Math.random() < 0.35 ? 2 : 1;

      for (let s = 0; s < setupCount; s++) {
        events.push({
          quarter:   q,
          type:      'PLAY',
          text:      setupPlayText(offense, defense),
          homeScore: homeRun,
          awayScore: awayRun,
          possessionTeam: offenseSide,
        });
      }

      if (shouldScore) {
        const pts = drive!.points;
        if (drive!.team === 'home') homeRun += pts;
        else                        awayRun += pts;
        events.push({
          quarter:     q,
          type:        'SCORE',
          text:        scoringText(offense, defense, pts),
          homeScore:   homeRun,
          awayScore:   awayRun,
          points:      pts,
          scoringTeam: drive!.team,
          possessionTeam: drive!.team,
        });
        scoringIndex++;
        possession = drive!.points === 2 ? drive!.team : otherSide(drive!.team);
      } else {
        const kind: 'PUNT' | 'TURNOVER' = Math.random() < 0.78 ? 'PUNT' : 'TURNOVER';
        events.push({
          quarter:   q,
          type:      kind,
          text:      kind === 'PUNT' ? puntText(offense) : turnoverText(offense, defense),
          homeScore: homeRun,
          awayScore: awayRun,
          possessionTeam: offenseSide,
        });
        possession = defenseSide;
      }
      driveCount++;
    }

    if (q === 2) {
      events.push({
        quarter:   2,
        type:      'HALFTIME',
        text:      `Halftime — ${home.name} ${homeRun}, ${away.name} ${awayRun}.`,
        homeScore: homeRun,
        awayScore: awayRun,
      });
    }
  }

  events.push({
    quarter:   4,
    type:      'FINAL',
    text:      `FINAL — ${home.name} ${homeRun}, ${away.name} ${awayRun}.`,
    homeScore: homeRun,
    awayScore: awayRun,
  });

  return events;
}

function otherSide(side: 'home' | 'away'): 'home' | 'away' {
  return side === 'home' ? 'away' : 'home';
}

// ─── Player picking ─────────────────────────────────────────
function pickByPosition(team: TeamSnapshot, positions: string[]): TopPlayer | null {
  return team.topPlayers.find((p) => positions.includes(p.position)) ?? null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Setup play narration ───────────────────────────────────
function setupPlayText(off: TeamSnapshot, def: TeamSnapshot): string {
  const passWeight =
    off.offenseStyle === 'PASS_HEAVY' ? 0.72 :
    off.offenseStyle === 'RUN_HEAVY'  ? 0.30 :
    0.50;
  const isPass = Math.random() < passWeight;

  // Aggressive defense gets occasional disruption flavor on either play type.
  const aggressiveDef = def.defenseStyle === 'AGGRESSIVE' && Math.random() < 0.18;
  if (aggressiveDef) {
    const rusher = pickByPosition(def, ['DE', 'DT', 'LB']);
    const qb     = pickByPosition(off, ['QB']);
    if (rusher && qb) {
      return pickRandom([
        `Pressure! ${teamPlayer(def, rusher)} closes on ${teamPlayer(off, qb)} — incomplete.`,
        `${teamPlayer(def, rusher)} bursts off the edge, forces ${teamPlayer(off, qb)} to throw it away.`,
        `${teamPlayer(def, rusher)} disrupts the pocket and ${teamPlayer(off, qb)} has to scramble.`,
      ]);
    }
  }

  if (isPass) return passSetupText(off, def);
  return runSetupText(off, def);
}

function teamPlayer(team: TeamSnapshot, player: TopPlayer | null): string {
  return player ? `${team.name} ${player.position} ${player.name}` : team.name;
}

function passSetupText(off: TeamSnapshot, def: TeamSnapshot): string {
  const qb       = pickByPosition(off, ['QB']);
  const receiver = pickByPosition(off, ['WR']) ?? pickByPosition(off, ['TE']);
  const cb       = pickByPosition(def, ['CB', 'S']);
  const yards    = 4 + Math.floor(Math.random() * 24);
  const incomplete = Math.random() < 0.18;

  if (incomplete) {
    if (qb && cb) {
      return pickRandom([
        `${teamPlayer(off, qb)} has the pass batted down by ${teamPlayer(def, cb)}. Incomplete.`,
        `${teamPlayer(off, qb)} fires high — ${teamPlayer(def, cb)} blankets the play. Incomplete.`,
        `${teamPlayer(off, qb)} looks deep, no one open. Throws it away.`,
      ]);
    }
    return `Pass falls incomplete.`;
  }

  if (qb && receiver) {
    if (off.offenseStyle === 'PASS_HEAVY') {
      return pickRandom([
        `${teamPlayer(off, qb)} hits ${teamPlayer(off, receiver)} on a deep crosser for ${yards}.`,
        `${teamPlayer(off, qb)} drops back and finds ${teamPlayer(off, receiver)} for a ${yards}-yard gain.`,
        `${teamPlayer(off, qb)} airs it out to ${teamPlayer(off, receiver)} — ${yards} yards down the field.`,
      ]);
    }
    return pickRandom([
      `${teamPlayer(off, qb)} finds ${teamPlayer(off, receiver)} on a quick out for ${yards}.`,
      `${teamPlayer(off, qb)} to ${teamPlayer(off, receiver)} on a slant — ${yards} yards.`,
      `Short completion from ${teamPlayer(off, qb)} to ${teamPlayer(off, receiver)}, ${yards} yards.`,
    ]);
  }
  if (qb) return `${teamPlayer(off, qb)} threads it for a ${yards}-yard pickup.`;
  return `Pass complete for ${yards} yards.`;
}

function runSetupText(off: TeamSnapshot, def: TeamSnapshot): string {
  const rb     = pickByPosition(off, ['RB']);
  const ol     = pickByPosition(off, ['OL']);
  const tackler = pickByPosition(def, ['LB', 'S', 'DE']);
  const yards  = off.offenseStyle === 'RUN_HEAVY'
    ? 2 + Math.floor(Math.random() * 14)
    : 1 + Math.floor(Math.random() * 9);
  const stuffed = Math.random() < 0.15;

  if (stuffed && rb && tackler) {
    return pickRandom([
      `${teamPlayer(def, tackler)} meets ${teamPlayer(off, rb)} in the backfield. Loss of one.`,
      `${teamPlayer(off, rb)} stopped at the line by ${teamPlayer(def, tackler)}. No gain.`,
      `${teamPlayer(off, rb)} swallowed up by ${teamPlayer(def, tackler)} for a short loss.`,
    ]);
  }

  if (rb) {
    if (off.offenseStyle === 'RUN_HEAVY') {
      const olName = ol?.name ? `behind ${teamPlayer(off, ol)}` : 'behind the line';
      return pickRandom([
        `${teamPlayer(off, rb)} pounds it ${olName} for ${yards}.`,
        `${teamPlayer(off, rb)} grinds out ${yards} hard yards on the ground.`,
        `Hand-off to ${teamPlayer(off, rb)}, ${yards}-yard gain to move the chains.`,
      ]);
    }
    return pickRandom([
      `${teamPlayer(off, rb)} takes the carry for ${yards}.`,
      `${teamPlayer(off, rb)} bounces it outside — ${yards}-yard pickup.`,
      `${teamPlayer(off, rb)} finds the cutback for ${yards}.`,
    ]);
  }
  return `Rush for ${yards} yards.`;
}

// ─── Scoring narration ──────────────────────────────────────
function scoringText(off: TeamSnapshot, def: TeamSnapshot, points: number): string {
  if (points === 7) return tdWithXp(off);
  if (points === 6) return tdMissedXp(off);
  if (points === 8) return tdTwoPoint(off);
  if (points === 3) return fgText(off);
  if (points === 2) return safetyText(off, def);
  return `${off.name} adds ${points}.`;
}

function tdWithXp(off: TeamSnapshot): string {
  return `${tdSentence(off)} Extra point is good.`;
}

function tdMissedXp(off: TeamSnapshot): string {
  return `${tdSentence(off)} Extra point is NO GOOD! ${off.name} leaves one on the board.`;
}

function tdTwoPoint(off: TeamSnapshot): string {
  return `${tdSentence(off)} Two-point conversion is GOOD — eight on the drive.`;
}

function tdSentence(off: TeamSnapshot): string {
  const qb       = pickByPosition(off, ['QB']);
  const receiver = pickByPosition(off, ['WR']) ?? pickByPosition(off, ['TE']);
  const rb       = pickByPosition(off, ['RB']);
  const isPass   = (off.offenseStyle === 'PASS_HEAVY' && Math.random() < 0.78) ||
                   (off.offenseStyle === 'BALANCED' && Math.random() < 0.55) ||
                   (off.offenseStyle === 'RUN_HEAVY' && Math.random() < 0.32);

  if (isPass && qb && receiver) {
    return pickRandom([
      `${teamPlayer(off, qb)} finds ${teamPlayer(off, receiver)} in the end zone — TOUCHDOWN ${off.name}!`,
      `${teamPlayer(off, qb)} drops a dime to ${teamPlayer(off, receiver)} — TOUCHDOWN ${off.name}!`,
      `Long ball from ${teamPlayer(off, qb)} to ${teamPlayer(off, receiver)}. ${off.name} walks it in. TD!`,
    ]);
  }
  if (!isPass && rb) {
    return pickRandom([
      `${teamPlayer(off, rb)} pounds it in from short range — TOUCHDOWN ${off.name}!`,
      `${teamPlayer(off, rb)} breaks free, finishes it — TD ${off.name}!`,
      `Hand-off to ${teamPlayer(off, rb)}, into the end zone — TOUCHDOWN ${off.name}!`,
    ]);
  }
  return pickRandom([
    `${off.name} caps the drive — TOUCHDOWN!`,
    `${off.name} finishes in the red zone for the score.`,
  ]);
}

function fgText(off: TeamSnapshot): string {
  const yards = 28 + Math.floor(Math.random() * 24);
  return pickRandom([
    `${off.name} settles for three from ${yards} out.`,
    `${off.name} stalls in the red zone — ${yards}-yard FG is good.`,
    `${off.name} kicks the ${yards}-yard field goal.`,
  ]);
}

function safetyText(off: TeamSnapshot, def: TeamSnapshot): string {
  const rusher = pickByPosition(def, ['DE', 'DT', 'LB']);
  if (rusher) {
    return `Safety! ${teamPlayer(def, rusher)} drops the ball-carrier in the end zone — two points ${def.name}.`;
  }
  return `Safety! ${def.name} forces the takedown in the end zone — two points ${def.name}.`;
}

// ─── Filler narration ───────────────────────────────────────
function puntText(off: TeamSnapshot): string {
  return pickRandom([
    `${off.name}'s drive stalls. Punt team comes on.`,
    `${off.name} punts after a three-and-out.`,
    `Three-and-out for ${off.name}. They flip the field.`,
  ]);
}

function turnoverText(off: TeamSnapshot, def: TeamSnapshot): string {
  const qb       = pickByPosition(off, ['QB']);
  const defender = pickByPosition(def, ['CB', 'S', 'LB']);
  if (Math.random() < 0.55 && qb && defender) {
    return pickRandom([
      `INTERCEPTION! ${teamPlayer(def, defender)} jumps the route on ${teamPlayer(off, qb)}. ${def.name} ball.`,
      `${teamPlayer(off, qb)} airs it up — picked by ${teamPlayer(def, defender)}! ${def.name} takes over.`,
      `${teamPlayer(def, defender)} reads ${teamPlayer(off, qb)}'s eyes and snags the pick.`,
    ]);
  }
  if (defender) {
    return pickRandom([
      `Fumble! ${teamPlayer(def, defender)} forces it loose and ${def.name} recovers.`,
      `${teamPlayer(def, defender)} pops the ball free — ${def.name} ball.`,
    ]);
  }
  return `${def.name} forces the turnover! ${def.name} ball.`;
}
