import { computePositionGroups } from './positionGroups';
import {
  getStyleMatchup,
  getTempoBonus,
  getPositionMatchupBonus,
  getMoraleWeight,
  getClockDrain,
  getDefensePenaltyTax,
  getFatigueAdjustedScoringMod,
  rollCoverageBust,
} from './styleModifiers';
import {
  Gameplan,
  DEFAULT_GAMEPLAN,
  normalizeGameplan,
  normalizeOffensivePhilosophy,
  evaluateConceptPlan,
  schemeScoreFromPlays,
  applyTempoOverride,
} from './gameplan';
import { generateMatchNarrative } from './matchNarrative';

export interface PlayerProfile {
  name: string;
  position: string;
  overall: number;
  fatigue?: number;
  injuryStatus?: string;
  injuryWeeks?: number;
}

export interface TeamMatchProfile {
  id: string;
  name: string;
  offenseRating: number;
  defenseRating: number;
  morale: number;
  offenseStyle: string;
  defenseStyle: string;
  tempo: string;
  offensivePhilosophy?: string | null;
  coaches?: Array<{
    role: string;
    philosophy: string;
    reputation: number;
    aggression?: number;
    developmentSpecialty?: string;
    preferredTempo?: string;
  }>;
  players: PlayerProfile[];
}

export interface ScoringDrive {
  team:    'home' | 'away';
  points:  number;  // 7, 3, 6, 8, or 2
  quarter: number;  // 1..4
}

export interface MatchSimResult {
  homeScore:     number;
  awayScore:     number;
  quarterScores: Array<[number, number]>;
  scoringDrives: ScoringDrive[];
  narrative:     string;
  keyMatchup:    string;
}

// Box-Muller gaussian for score variance.
// Produces realistic fat-tailed distribution:
// most games cluster near expected, occasional blowouts/nail-biters.
function gaussianRandom(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export function simulateMatch(
  home: TeamMatchProfile,
  away: TeamMatchProfile,
  week: number = 1,
  homeGameplan: Gameplan = DEFAULT_GAMEPLAN,
  awayGameplan: Gameplan = DEFAULT_GAMEPLAN,
): MatchSimResult {
  homeGameplan = normalizeGameplan(homeGameplan, home);
  awayGameplan = normalizeGameplan(awayGameplan, away);
  // ── Layer 1: Unit-level matchup advantages ───────────────
  // Position groups create the "film room" advantage that tactics leverage.
  const homeGroups = computePositionGroups(home.players);
  const awayGroups = computePositionGroups(away.players);

  // ── Layer 2: Base expected score ─────────────────────────
  // Team rating differential + style-weighted morale + home field.
  // PASS_HEAVY teams swing harder with morale (QB rhythm dependent).
  // RUN_HEAVY teams grind regardless.
  const HOME_FIELD_BONUS = 4;     // 2026-05-07: bumped from 3 — was washing out below 50% home wins
  const BASE_SCORE       = 19.5;  // 2026-05-07: nudged from 19 toward 20, slight scoring rebound
  const VARIANCE_STD     = 6;

  const homeMoraleWeight = getMoraleWeight(home.offenseStyle);
  const awayMoraleWeight = getMoraleWeight(away.offenseStyle);

  const homeNet = home.offenseRating - away.defenseRating + (home.morale - 50) * homeMoraleWeight + HOME_FIELD_BONUS;
  const awayNet = away.offenseRating - home.defenseRating + (away.morale - 50) * awayMoraleWeight;

  let homeExpected = BASE_SCORE + homeNet * 0.2;
  let awayExpected = BASE_SCORE + awayNet * 0.2;

  // ── Layer 3: Tactical identity ───────────────────────────
  // Scheme matchup shifts scoring expectations and variance.
  // e.g. PASS_HEAVY vs AGGRESSIVE = high variance on both sides.
  // e.g. RUN_HEAVY vs PREVENT     = run team gets free yards, tight distribution.
  //
  // AGG defenses' scoringMod decays through the season (late-season fatigue):
  // full effect weeks 1-7, up to 50% nerf by week 14.
  const homeStyleEffect = getStyleMatchup(home.offenseStyle, away.defenseStyle);
  const awayStyleEffect = getStyleMatchup(away.offenseStyle, home.defenseStyle);

  homeExpected += getFatigueAdjustedScoringMod(homeStyleEffect.scoringMod, away.defenseStyle, week);
  awayExpected += getFatigueAdjustedScoringMod(awayStyleEffect.scoringMod, home.defenseStyle, week);

  // Penalty tax — AGG defenses give the opposing offense free yards every game
  // via PI / roughing / illegal contact. Always-on structural cost of aggression.
  homeExpected += getDefensePenaltyTax(away.defenseStyle);
  awayExpected += getDefensePenaltyTax(home.defenseStyle);

  // ── Layer 4: Clock drain ─────────────────────────────────
  // Opponent's offensive style drains my possessions.
  // RUN_HEAVY opponent → fewer possessions for me → lower scoring.
  // PASS_HEAVY opponent → quick scores → ball back to me faster.
  homeExpected -= getClockDrain(away.offenseStyle);
  awayExpected -= getClockDrain(home.offenseStyle);

  // ── Layer 5: Tempo (gameplan-overridable) ────────────────
  // Tempo override lets a team play faster or slower than their identity
  // for this specific game (e.g. an up-tempo team slowing down to protect a lead).
  const homeEffectiveTempo = applyTempoOverride(home.tempo, homeGameplan.tempoOverride);
  const awayEffectiveTempo = applyTempoOverride(away.tempo, awayGameplan.tempoOverride);
  homeExpected += getTempoBonus(homeEffectiveTempo, awayEffectiveTempo);
  awayExpected += getTempoBonus(awayEffectiveTempo, homeEffectiveTempo);

  // ── Layer 6: Position group matchups ─────────────────────
  // OL vs front seven, skill vs secondary, QB quality.
  // These create the "elite pass rush destroys a weak OL" moments.
  homeExpected += getPositionMatchupBonus(homeGroups, awayGroups, home.offenseStyle);
  awayExpected += getPositionMatchupBonus(awayGroups, homeGroups, away.offenseStyle);

  // ── Layer 7: Concept/counter gameplan adjustments ───────
  // Each offense brings three concepts. Each defense brings three counters.
  // The weighted matrix turns that abstract weekly plan into points and risk.
  const homeConceptEffect = evaluateConceptPlan(
    home,
    away,
    homeGroups,
    awayGroups,
    homeGameplan.offensiveConcepts,
    awayGameplan.defensiveCounters,
  );
  const awayConceptEffect = evaluateConceptPlan(
    away,
    home,
    awayGroups,
    homeGroups,
    awayGameplan.offensiveConcepts,
    homeGameplan.defensiveCounters,
  );

  homeExpected += homeConceptEffect.scoringMod;
  awayExpected += awayConceptEffect.scoringMod;
  homeExpected += schemeScoreFromPlays(homeGameplan.offensivePlays ?? [], 'offense');
  awayExpected += schemeScoreFromPlays(awayGameplan.offensivePlays ?? [], 'offense');

  // Compose variance multipliers across all sources for each side
  const homeVarianceFactor = homeStyleEffect.varianceMod * homeConceptEffect.varianceMod;
  const awayVarianceFactor = awayStyleEffect.varianceMod * awayConceptEffect.varianceMod;

  // ── Score generation ─────────────────────────────────────
  // Variance scales with style + offensive focus + opposing defensive focus.
  let homeScore = Math.max(0, Math.round(homeExpected + gaussianRandom(0, VARIANCE_STD * homeVarianceFactor)));
  let awayScore = Math.max(0, Math.round(awayExpected + gaussianRandom(0, VARIANCE_STD * awayVarianceFactor)));

  // ── Coverage bust events ─────────────────────────────────
  // Rare per-game roll: AGG defenses give up an unscripted explosive play.
  // Hurts the AGG team only. Run before OT so a bust can decide a regulation tie.
  const homeDefBust = rollCoverageBust(home.defenseStyle, away.offenseStyle);
  const awayDefBust = rollCoverageBust(away.defenseStyle, home.offenseStyle);
  if (homeDefBust.triggered) awayScore += homeDefBust.points;
  if (awayDefBust.triggered) homeScore += awayDefBust.points;

  // ── OT tiebreaker ─────────────────────────────────────────
  // When regulation ends tied, "play OT": one drive each, weighted coin-flip.
  // The team with higher offense + morale wins more often, but upsets happen.
  // Tied games resolve to a 3-point win (field goal in OT) for the winner.
  if (homeScore === awayScore) {
    const homeOTPower = home.offenseRating + home.morale * 0.3 + 5; // home gets ball first / crowd
    const awayOTPower = away.offenseRating + away.morale * 0.3;
    const homeWinProb = homeOTPower / (homeOTPower + awayOTPower);
    if (Math.random() < homeWinProb) homeScore += 3;
    else                              awayScore += 3;
  }

  // ── Quantize to football-valid totals ─────────────────────
  // Snap weird scores (1, 4) to nearest valid composition of {7,3,6,8,2}.
  homeScore = quantizeFootballScore(homeScore);
  awayScore = quantizeFootballScore(awayScore);
  if (homeScore === awayScore) {
    if (Math.random() < 0.5) homeScore += 3;
    else                     awayScore += 3;
  }

  // ── Plan scoring drives + quarter breakdown ───────────────
  const { drives: scoringDrives, quarterScores } = planScoringDrives(homeScore, awayScore);

  // ── Narrative ─────────────────────────────────────────────
  const { summary: narrative, keyMatchup } = generateMatchNarrative({
    homeTeamName: home.name,
    awayTeamName: away.name,
    homeScore,
    awayScore,
    homeOffStyle: home.offenseStyle,
    awayOffStyle: away.offenseStyle,
    homeDefStyle: home.defenseStyle,
    awayDefStyle: away.defenseStyle,
    homeOffPhilosophy: normalizeOffensivePhilosophy(home.offensivePhilosophy, home.offenseStyle),
    awayOffPhilosophy: normalizeOffensivePhilosophy(away.offensivePhilosophy, away.offenseStyle),
    homePlayers:  home.players,
    awayPlayers:  away.players,
    homeConcepts: homeGameplan.offensiveConcepts,
    awayConcepts: awayGameplan.offensiveConcepts,
    homeCounters: homeGameplan.defensiveCounters,
    awayCounters: awayGameplan.defensiveCounters,
    homeTacticalNote: homeConceptEffect.topInteraction,
    awayTacticalNote: awayConceptEffect.topInteraction,
  });

  return { homeScore, awayScore, quarterScores, scoringDrives, narrative, keyMatchup };
}

// ─── Football-realistic score plumbing ───────────────────────
//
// Total scores must be reachable by a sum of {7, 3, 6, 8, 2}. The set of
// invalid totals is just {1, 4} — quantize those.
function quantizeFootballScore(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 0;
  if (n === 4) return 3;
  return n;
}

// Decompose a team total into a list of scoring plays. Most plays are TDs (7)
// and FGs (3). A given team has a small chance of one missed-XP TD (6) or one
// safety (2). 2-point conversion (8) is also rare. Caller shouldn't pass 1 or 4.
function decomposeFootballScore(total: number): number[] {
  if (total <= 0) return [];
  let r = total;
  const out: number[] = [];

  // Per-team rare event probabilities.
  const wantSafety   = r >= 2 && Math.random() < 0.025;  // ~1 in 20 games (combined ~5%)
  const wantMissedXP = Math.random() < 0.05;              // ~1 in 10 games (combined ~10%)
  const want2Pt      = Math.random() < 0.06;

  if (wantSafety) { out.push(2); r -= 2; }

  let usedMissedXP = false;
  let used2Pt = false;
  while (r >= 6) {
    if (wantMissedXP && !usedMissedXP) {
      out.push(6); r -= 6; usedMissedXP = true; continue;
    }
    if (want2Pt && !used2Pt && r >= 8) {
      out.push(8); r -= 8; used2Pt = true; continue;
    }
    if (r >= 7) { out.push(7); r -= 7; }
    else        { out.push(6); r -= 6; usedMissedXP = true; }
  }

  while (r >= 3) { out.push(3); r -= 3; }

  if (r === 2) out.push(2);  // didn't roll the safety bit but total had a 2 in it

  return out;
}

const QUARTER_WEIGHTS = [0.18, 0.30, 0.20, 0.32];  // bias to Q2 / Q4

function pickQuarter(): number {
  let r = Math.random();
  for (let i = 0; i < QUARTER_WEIGHTS.length; i++) {
    r -= QUARTER_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 4;
}

function planScoringDrives(homeScore: number, awayScore: number): {
  drives: ScoringDrive[];
  quarterScores: Array<[number, number]>;
} {
  const homePlays = decomposeFootballScore(homeScore);
  const awayPlays = decomposeFootballScore(awayScore);

  const drives: ScoringDrive[] = [];
  for (const points of homePlays) drives.push({ team: 'home', points, quarter: pickQuarter() });
  for (const points of awayPlays) drives.push({ team: 'away', points, quarter: pickQuarter() });
  drives.sort((a, b) => a.quarter - b.quarter);

  const homeByQ = [0, 0, 0, 0];
  const awayByQ = [0, 0, 0, 0];
  for (const d of drives) {
    if (d.team === 'home') homeByQ[d.quarter - 1] += d.points;
    else                   awayByQ[d.quarter - 1] += d.points;
  }

  const quarterScores: Array<[number, number]> = [
    [homeByQ[0], awayByQ[0]],
    [homeByQ[1], awayByQ[1]],
    [homeByQ[2], awayByQ[2]],
    [homeByQ[3], awayByQ[3]],
  ];

  return { drives, quarterScores };
}
