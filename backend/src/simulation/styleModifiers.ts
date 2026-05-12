import type { PositionGroups } from './positionGroups';

export type OffenseStyle = 'RUN_HEAVY' | 'BALANCED' | 'PASS_HEAVY';
export type DefenseStyle = 'AGGRESSIVE' | 'BALANCED' | 'PREVENT';
export type Tempo        = 'SLOW' | 'NORMAL' | 'FAST';

export interface StyleEffect {
  scoringMod:  number; // expected points added/removed from the offense's total
  varianceMod: number; // multiplier on gaussian std dev (1.0 = baseline)
}

// ─── Tactical Matchup Table ───────────────────────────────
//
// Each cell = what happens to the OFFENSE in this scheme clash.
// Positive scoringMod = offense benefits. Negative = defense shuts them down.
// varianceMod > 1 = "boom or bust". < 1 = predictable, controlled game.
//
//                   AGGRESSIVE     BALANCED     PREVENT
//  RUN_HEAVY:     Bursts vs chaos | Grind war  | Run gashes soft D
//  BALANCED:      Pressure flips  | Even game  | Methodical edge
//  PASS_HEAVY:    Boom or bust    | Air attack | Deep ball killed
//
// 2026-05-07 rebalance:
//   - PASS_HEAVY nerfed across the board (scoring -1, variance up vs pressure)
//   - RUN_HEAVY buffed (scoring +0.5 across, lower variance, higher floor)
//   - PREVENT made more punishing vs PASS_HEAVY, lower variance everywhere
//   - AGGRESSIVE made more volatile (sacks/turnovers/busted coverages)
//
const STYLE_MATCHUP: Record<OffenseStyle, Record<DefenseStyle, StyleEffect>> = {
  RUN_HEAVY: {
    AGGRESSIVE: { scoringMod: -1.0, varianceMod: 0.85 }, // aggressive can disrupt, but RBs still pop runs
    BALANCED:   { scoringMod:  0.5, varianceMod: 0.70 }, // grinding identity, very consistent
    PREVENT:    { scoringMod:  3.5, varianceMod: 0.65 }, // run gashes prevent — free, predictable yards
  },
  BALANCED: {
    AGGRESSIVE: { scoringMod: -1.0, varianceMod: 1.15 }, // pressure forces mistakes
    BALANCED:   { scoringMod:  0.0, varianceMod: 1.00 }, // clean neutrality
    PREVENT:    { scoringMod:  1.0, varianceMod: 0.85 }, // balanced offense exploits prevent
  },
  PASS_HEAVY: {
    AGGRESSIVE: { scoringMod: -1.0, varianceMod: 1.50 }, // sacks AND turnovers AND big plays — extreme swing
    BALANCED:   { scoringMod:  0.5, varianceMod: 1.30 }, // slight pass advantage, still volatile
    PREVENT:    { scoringMod: -3.5, varianceMod: 0.95 }, // prevent kills the deep ball completely
  },
};

export function getStyleMatchup(offStyle: string, defStyle: string): StyleEffect {
  return STYLE_MATCHUP[offStyle as OffenseStyle]?.[defStyle as DefenseStyle]
    ?? { scoringMod: 0, varianceMod: 1 };
}

// ─── Defensive Costs ──────────────────────────────────────
//
// Aggressive schemes don't come for free in real football:
//   - Penalty tax (per game): pass interference, roughing, illegal contact.
//     AGG defenses give the offense free yards every game, no exceptions.
//   - Late-season fatigue: AGG defenders take more snaps and more hits.
//     By weeks 12-14, opposing offenses have film and the secondary is banged up.
//     The scheme's scoring suppression decays toward zero down the stretch.
//
// These two layers offset AGG's structural -1.0 scoringMod advantage so the
// dominant defensive style doesn't auto-win 80% of titles.
//

const DEFENSE_PENALTY_TAX: Record<DefenseStyle, number> = {
  AGGRESSIVE: 1.0,  // PI / roughing / illegal contact — costs you every game
  BALANCED:   0.0,
  PREVENT:    0.2,  // occasional excessive contact flag
};

export function getDefensePenaltyTax(defStyle: string): number {
  return DEFENSE_PENALTY_TAX[defStyle as DefenseStyle] ?? 0;
}

// AGG defenses wear down across the season. Up to 65% of their scoring
// suppression evaporates by week 14 — the late-season collapse narrative.
export function getFatigueAdjustedScoringMod(
  scoringMod: number,
  defStyle: string,
  week: number,
): number {
  if (defStyle !== 'AGGRESSIVE') return scoringMod;
  const fatigueFactor = Math.max(0, (week - 7) / 7); // 0 weeks 1-7 → 1.0 by week 14
  return scoringMod * (1 - fatigueFactor * 0.65);
}

// ─── Coverage Bust Events ─────────────────────────────────
//
// AGG defenses occasionally give up an unscripted big play — a corner
// cheating the line and getting beat deep, or a safety biting on play action.
// Rare per-game roll. Doesn't help the AGG team, only hurts them.
//
// Probability scales with opposing offense style: PASS_HEAVY teams take more
// shots downfield and exploit busts the most.
//
const BUST_PROB_BY_OPP: Record<OffenseStyle, number> = {
  PASS_HEAVY: 0.12, // deep ball over the top — AGG's worst nightmare
  BALANCED:   0.08,
  RUN_HEAVY:  0.05, // backbreaker run when corners crash the box
};

export interface BustEvent {
  triggered: boolean;
  points: number;
}

export function rollCoverageBust(defStyle: string, oppOffStyle: string): BustEvent {
  if (defStyle !== 'AGGRESSIVE') return { triggered: false, points: 0 };
  const prob = BUST_PROB_BY_OPP[oppOffStyle as OffenseStyle] ?? 0.08;
  if (Math.random() >= prob) return { triggered: false, points: 0 };
  // 6-10 points — TD with extra-point variance
  const points = 6 + Math.floor(Math.random() * 5);
  return { triggered: true, points };
}

// ─── Clock Drain ──────────────────────────────────────────
//
// How much each offensive style steals possessions from the opponent.
// Applied to OPPONENT's expected score (not the team running the style).
//
//   RUN_HEAVY  drains 2 pts from opponent (clock-eating ground game)
//   BALANCED   drains 0.5 pts (mild clock control)
//   PASS_HEAVY *gives* 0.5 pts back (quick scores = ball back faster)
//
const OFFENSIVE_CLOCK_DRAIN: Record<OffenseStyle, number> = {
  RUN_HEAVY:   2.0,
  BALANCED:    0.5,
  PASS_HEAVY: -0.5,
};

export function getClockDrain(offStyle: string): number {
  return OFFENSIVE_CLOCK_DRAIN[offStyle as OffenseStyle] ?? 0;
}

// ─── Morale Sensitivity ───────────────────────────────────
//
// Different offensive identities are more or less momentum-dependent.
// PASS_HEAVY teams ride/sink with QB rhythm and confidence.
// RUN_HEAVY teams grind regardless of how things are going.
//
// Weight is multiplied by (morale - 50), so:
//   PASS_HEAVY: ±6.5 pt swing across the morale range
//   BALANCED:   ±5.0 pt swing
//   RUN_HEAVY:  ±3.5 pt swing
//
const MORALE_WEIGHT: Record<OffenseStyle, number> = {
  PASS_HEAVY: 0.11,  // 2026-05-07: dropped from 0.13 — death-spiral was too punishing in low tiers
  BALANCED:   0.10,
  RUN_HEAVY:  0.07,
};

export function getMoraleWeight(offStyle: string): number {
  return MORALE_WEIGHT[offStyle as OffenseStyle] ?? 0.10;
}

// ─── Tempo ────────────────────────────────────────────────
//
// Controls pace of the game. FAST teams push possessions up for both sides.
// SLOW teams grind clock, reducing scoring for both.
// Own tempo has 1.5x weight; opponent's tempo is "contagious" (0.4x).
//
const TEMPO_VALUE: Record<Tempo, number> = { SLOW: -1, NORMAL: 0, FAST: 1 };

export function getTempoBonus(myTempo: string, opponentTempo: string): number {
  const mine   = TEMPO_VALUE[myTempo as Tempo]       ?? 0;
  const theirs = TEMPO_VALUE[opponentTempo as Tempo] ?? 0;
  return mine * 1.5 + theirs * 0.4;
}

// ─── Position Group Matchups ──────────────────────────────
//
// The "film room" layer. Three key matchups shift expected scoring:
//
//   OL vs Front Seven:  protects the QB and opens run lanes
//   Skill vs Secondary: receiver quality vs coverage quality
//   QB quality:         elite QBs widen the gap in pass-heavy systems
//
// Typical contribution: ±3-5 points each, bounded by realistic rating spreads.
//
export function getPositionMatchupBonus(
  oGroups: Pick<PositionGroups, 'qb' | 'skillPositions' | 'oLine'>,
  dGroups: Pick<PositionGroups, 'frontSeven' | 'secondary'>,
  offStyle: string,
): number {
  // Normalize differences to ≈ -1.0 to +1.0 range (typical spread is ±20 pts)
  const lineVsFront   = (oGroups.oLine           - dGroups.frontSeven) / 20;
  const skillVsCovery = (oGroups.skillPositions  - dGroups.secondary)  / 20;
  const qbEdge        = (oGroups.qb              - 70)                 / 25; // 70 = league avg

  switch (offStyle as OffenseStyle) {
    case 'RUN_HEAVY':
      // OL vs front seven is everything. Skill/secondary barely matter.
      return lineVsFront * 3.5 + skillVsCovery * 0.5 + qbEdge * 0.3;
    case 'PASS_HEAVY':
      // Elite receivers kill weak secondaries. Pass rush kills weak OL.
      // Star QBs unlock the full ceiling.
      return lineVsFront * 1.5 + skillVsCovery * 3.0 + qbEdge * 2.0;
    case 'BALANCED':
    default:
      return lineVsFront * 2.0 + skillVsCovery * 2.0 + qbEdge * 1.2;
  }
}
