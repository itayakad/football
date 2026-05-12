interface PlayerEntry {
  name: string;
  position: string;
  overall: number;
}

interface NarrativeParams {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeOffStyle: string;
  awayOffStyle: string;
  homeDefStyle: string;
  awayDefStyle: string;
  homeOffPhilosophy?: string;
  awayOffPhilosophy?: string;
  homePlayers: PlayerEntry[];
  awayPlayers: PlayerEntry[];
  homeConcepts?: [string, string, string];
  awayConcepts?: [string, string, string];
  homeCounters?: [string, string, string];
  awayCounters?: [string, string, string];
  homeTacticalNote?: string;
  awayTacticalNote?: string;
}

export interface NarrativeResult {
  summary: string;
  keyMatchup: string;
}

// ─── Helpers ──────────────────────────────────────────────

function bestAt(players: PlayerEntry[], ...positions: string[]): PlayerEntry | null {
  return (
    players
      .filter((p) => positions.includes(p.position))
      .sort((a, b) => b.overall - a.overall)[0] ?? null
  );
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1];
}

// Rough contextual "stat lines" — generated to enrich narrative, not persisted
function estimateTDs(score: number): number {
  return Math.max(0, Math.round(score / 7));
}

function estimatePassYards(score: number, offStyle: string): number {
  const base = offStyle === 'PASS_HEAVY' ? 13.5 : offStyle === 'BALANCED' ? 10 : 7;
  return Math.round(score * base + (Math.random() - 0.5) * 45);
}

function estimateRushYards(score: number, offStyle: string): number {
  const base = offStyle === 'RUN_HEAVY' ? 11 : offStyle === 'BALANCED' ? 8 : 5;
  return Math.round(score * base + (Math.random() - 0.5) * 30);
}

// ─── Template Library ─────────────────────────────────────

type ScenarioFn = (params: {
  winner: string; loser: string;
  winScore: number; loseScore: number;
  scoreStr: string;
  winPlayers: PlayerEntry[];
  loseTeamName: string;
  winOffStyle: string;
  winDefStyle: string;
}) => { summary: string; keyMatchup: string };

const TEMPLATES: Record<string, Record<string, ScenarioFn>> = {
  // ── Blowout (diff ≥ 17) ──
  blowout: {
    PASS_HEAVY: ({ winner, loser, scoreStr, winPlayers }) => {
      const qb  = bestAt(winPlayers, 'QB');
      const wr  = bestAt(winPlayers, 'WR', 'TE');
      const tds = estimateTDs(0); // placeholder, not used here
      const yds = estimatePassYards(parseInt(scoreStr.split('–')[0]), 'PASS_HEAVY');
      void tds;
      return {
        keyMatchup: 'Passing attack dominant',
        summary:
          `${winner} made it look easy in a ${scoreStr} blowout. ` +
          `${qb ? lastName(qb.name) : 'The quarterback'} was clinical through the air, ` +
          `picking ${loser} apart for ${yds}+ yards${wr ? ` while ${lastName(wr.name)} created havoc in the secondary` : ''}. ` +
          `The ${loser} defense had no answer all afternoon.`,
      };
    },
    RUN_HEAVY: ({ winner, loser, scoreStr, winPlayers }) => {
      const rb = bestAt(winPlayers, 'RB');
      const yds = estimateRushYards(parseInt(scoreStr.split('–')[0]), 'RUN_HEAVY');
      return {
        keyMatchup: 'Ground game dominated',
        summary:
          `${winner} imposed their will in a brutal ${scoreStr} statement win. ` +
          `${rb ? lastName(rb.name) : 'The backfield'} carried the load on the ground — ${yds}+ yards, ` +
          `methodical drives, punishing clock control. ${loser} never found an answer for the physicality up front.`,
      };
    },
    BALANCED: ({ winner, loser, scoreStr, winPlayers }) => {
      const de = bestAt(winPlayers, 'DE', 'LB');
      return {
        keyMatchup: 'Complete team win',
        summary:
          `${winner} delivered a dominant ${scoreStr} performance that was never really in doubt. ` +
          `They executed on both sides of the ball — ${de ? `${lastName(de.name)} and the defense set the tone early` : 'the defense set the tone early'} ` +
          `and the offense converted every opportunity. ${loser} had no answers.`,
      };
    },
  },

  // ── Close game (diff ≤ 6) ──
  close: {
    PASS_HEAVY: ({ winner, loser, scoreStr, winPlayers, winDefStyle }) => {
      const qb = bestAt(winPlayers, 'QB');
      if (winDefStyle === 'AGGRESSIVE') {
        const de = bestAt(winPlayers, 'DE', 'LB');
        return {
          keyMatchup: 'QB clutch + defensive pressure',
          summary:
            `A classic in the making. ${winner} edged ${loser} ${scoreStr} in a game that came down to the wire. ` +
            `${qb ? lastName(qb.name) : 'The QB'} was sharp when it counted, ` +
            `and ${de ? lastName(de.name) : 'the pass rush'} delivered the game-sealing stop on the final drive.`,
        };
      }
      return {
        keyMatchup: 'QB clutch performance',
        summary:
          `${winner} and ${loser} went back and forth all game before ${winner} prevailed ${scoreStr}. ` +
          `${qb ? `${lastName(qb.name)} made the crucial plays late` : 'The offense made the crucial plays late'}, ` +
          `converting a critical third down to run out the clock.`,
      };
    },
    RUN_HEAVY: ({ winner, loser, scoreStr }) => ({
      keyMatchup: 'Ground game + clock control',
      summary:
        `${winner} ground out a gutsy ${scoreStr} win over ${loser}. The ball control offense kept the chains moving ` +
        `and wore the defense down over four quarters. Clock management was the difference — ${loser} never got the ball back to respond.`,
    }),
    BALANCED: ({ winner, loser, scoreStr, winDefStyle }) => {
      if (winDefStyle === 'AGGRESSIVE') {
        return {
          keyMatchup: 'Late defensive stand',
          summary:
            `Defense decided this one. ${winner} held on for a ${scoreStr} win with a clutch stop in the final minutes. ` +
            `${loser} drove into scoring position late, but the ${winner} front put on the pressure and forced a crucial incompletion.`,
        };
      }
      return {
        keyMatchup: 'Field position battle',
        summary:
          `${winner} and ${loser} played a tense, physical game that could have swung either way. ` +
          `${winner} came out on top ${scoreStr} — it hinged on field position and one opportunistic turnover that changed the momentum for good.`,
      };
    },
  },

  // ── Standard win (diff 7-16) ──
  standard: {
    PASS_HEAVY: ({ winner, loser, scoreStr, winPlayers }) => {
      const qb = bestAt(winPlayers, 'QB');
      const wr = bestAt(winPlayers, 'WR', 'TE');
      const yds = estimatePassYards(parseInt(scoreStr.split('–')[0]), 'PASS_HEAVY');
      return {
        keyMatchup: 'Passing game edge',
        summary:
          `${winner}'s passing attack proved the difference in a ${scoreStr} win over ${loser}. ` +
          `${qb ? `${lastName(qb.name)} finished with over ${yds} yards through the air` : `The QB had a strong game`}` +
          `${wr ? `, finding ${lastName(wr.name)} at key moments throughout` : ''}. ` +
          `${loser} couldn't match the efficiency.`,
      };
    },
    RUN_HEAVY: ({ winner, loser, scoreStr, winPlayers }) => {
      const rb = bestAt(winPlayers, 'RB');
      return {
        keyMatchup: 'Ground and pound',
        summary:
          `${winner} leaned on the run game and wore ${loser} down in a ${scoreStr} victory. ` +
          `${rb ? `${lastName(rb.name)} was the engine all day` : 'The rushing attack was the engine'}, ` +
          `with the offense controlling tempo and field position from the second quarter on.`,
      };
    },
    BALANCED: ({ winner, loser, scoreStr, winDefStyle }) => {
      if (winDefStyle === 'AGGRESSIVE') {
        return {
          keyMatchup: 'Defensive pressure',
          summary:
            `${winner}'s aggressive defense kept ${loser} uncomfortable all game, generating enough disruption to flip field position. ` +
            `The offense did just enough in a controlled ${scoreStr} win.`,
        };
      }
      if (winDefStyle === 'PREVENT') {
        return {
          keyMatchup: 'Ball control + prevention',
          summary:
            `${winner} managed the game effectively in a ${scoreStr} win over ${loser}. ` +
            `The offense controlled tempo while the prevent defense took away the explosive plays ${loser} needed to get back in it.`,
        };
      }
      return {
        keyMatchup: 'Balanced execution',
        summary:
          `A disciplined ${winner} team found a way to win ${scoreStr} against ${loser}. ` +
          `No single unit dominated, but ${winner} won the small battles — third downs, red zone efficiency, and special teams — that add up over four quarters.`,
      };
    },
  },
};

// ─── Main Narrative Generator ─────────────────────────────

export function generateMatchNarrative(params: NarrativeParams): NarrativeResult {
  const { homeScore, awayScore } = params;

  if (homeScore === awayScore) {
    return {
      keyMatchup: 'Stalemate',
      summary:
        `${params.homeTeamName} and ${params.awayTeamName} played to a ${homeScore}–${awayScore} draw. ` +
        `Both defenses were stout and neither offense could land a knockout blow when it mattered most.`,
    };
  }

  const homeWon = homeScore > awayScore;
  const winner      = homeWon ? params.homeTeamName : params.awayTeamName;
  const loser       = homeWon ? params.awayTeamName : params.homeTeamName;
  const winScore    = homeWon ? homeScore : awayScore;
  const loseScore   = homeWon ? awayScore : homeScore;
  const winOffStyle = homeWon ? params.homeOffStyle : params.awayOffStyle;
  const winDefStyle = homeWon ? params.homeDefStyle : params.awayDefStyle;
  const winPlayers  = homeWon ? params.homePlayers  : params.awayPlayers;
  const diff        = winScore - loseScore;
  const scoreStr    = `${winScore}–${loseScore}`;

  const scenario =
    diff >= 17 ? 'blowout' :
    diff <= 6  ? 'close'   :
                 'standard';

  // Normalize style key for lookup (use BALANCED as fallback)
  const styleKey = (winOffStyle in TEMPLATES[scenario]) ? winOffStyle : 'BALANCED';

  const result = TEMPLATES[scenario][styleKey]({
    winner, loser, winScore, loseScore, scoreStr,
    winPlayers, loseTeamName: loser, winOffStyle, winDefStyle,
  });

  const winConcepts = homeWon ? params.homeConcepts : params.awayConcepts;
  const loseCounters = homeWon ? params.awayCounters : params.homeCounters;
  const tacticalNote = homeWon ? params.homeTacticalNote : params.awayTacticalNote;
  if (diff >= 7) {
    const focusTag = conceptKeyMatchup(winConcepts?.[0], tacticalNote, scenario);
    if (focusTag) result.keyMatchup = focusTag;
  }

  if (winConcepts && loseCounters) {
    result.summary += ` Tactically, ${winner} leaned on ${formatList(winConcepts)} while ${loser} answered with ${formatList(loseCounters)}, making ${tacticalNote ?? `${labelFor(winConcepts[0])} vs ${labelFor(loseCounters[0])}`} the defining interaction.`;
  }

  return result;
}

function conceptKeyMatchup(
  concept: string | undefined,
  tacticalNote: string | undefined,
  scenario: 'blowout' | 'close' | 'standard',
): string | null {
  if (concept === 'FOUR_VERTICALS') return scenario === 'blowout' ? 'Vertical concept overwhelmed' : 'Vertical concept landed';
  if (concept === 'MESH' || concept === 'SLANTS_FLATS') return 'Underneath passing dictated terms';
  if (concept === 'POWER_RUN' || concept === 'HB_STRETCH' || concept === 'COUNTER') return scenario === 'blowout' ? 'Run concepts dominated' : 'Run concepts controlled';
  if (concept === 'PA_CROSSERS') return 'Play-action crossers created leverage';
  if (tacticalNote) return tacticalNote;
  return concept ? `${labelFor(concept)} led the plan` : null;
}

function formatList(values: [string, string, string]): string {
  return `${labelFor(values[0])}, ${labelFor(values[1])}, and ${labelFor(values[2])}`;
}

function labelFor(value: string): string {
  const special: Record<string, string> = {
    RPO_HEAVY: 'RPO Heavy',
    PA_CROSSERS: 'PA Crossers',
    HB_STRETCH: 'HB Stretch',
    COVER_2_SHELL: 'Cover 2 Shell',
  };
  return special[value] ?? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// ─── Quarter Score Distribution ───────────────────────────
//
// Splits a total score across 4 quarters with weighted randomness.
// Q2 and Q4 carry more scoring (late halves tend to be more open).
//
export function generateQuarterScores(
  homeTotal: number,
  awayTotal: number,
): Array<[number, number]> {
  function distribute(total: number): [number, number, number, number] {
    if (total === 0) return [0, 0, 0, 0];
    const weights = [
      Math.random() * 0.8 + 0.5,  // Q1: lighter
      Math.random() * 1.0 + 0.8,  // Q2: heavier (2-minute drill)
      Math.random() * 0.7 + 0.4,  // Q3: lighter
      Math.random() * 0.9 + 0.6,  // Q4: heavier (late scoring)
    ];
    const sum = weights.reduce((a, b) => a + b, 0);
    let rem = total;
    const qs = weights.map((w, i) => {
      if (i === 3) return Math.max(0, rem);
      const q = Math.round((w / sum) * total);
      rem -= q;
      return Math.max(0, q);
    }) as [number, number, number, number];
    return qs;
  }

  const hq = distribute(homeTotal);
  const aq = distribute(awayTotal);
  return ([0, 1, 2, 3] as const).map((i) => [hq[i], aq[i]] as [number, number]);
}
