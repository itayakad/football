import {
  defensivePlayById,
  defensiveMatchupMod,
  DefensiveCategory,
  DefensivePlay,
  MATCHUP_MULTIPLIER,
  offensiveMatchupMod,
  offensivePlayById,
  OffensiveCategory,
  OffensivePlay,
  Play,
  PlayerSlot,
  playById,
} from './playLibrary';
import { Gameplan, defaultGameplan, normalizeGameplan } from './gameplan';

// ── Public types ──────────────────────────────────────────

export interface PlayerProfile {
  id?: string;
  name: string;
  position: string;
  overall: number;
}

export interface CoachProfile {
  position: string;         // 'HC' | 'OC' | 'DC'
  overall?: number;
  stat1?: number;           // HC: offense | OC: pass scheming | DC: run defense
  stat2?: number;           // HC: defense | OC: run scheming  | DC: pass defense
}

export interface TeamMatchProfile {
  id: string;
  name: string;
  players: PlayerProfile[];
  coaches?: CoachProfile[];
  offensivePlays?: string[];
  defensivePlays?: string[];
}

export type ResultLabel =
  | 'GREAT_DEFENSE'
  | 'DEFENSIVE_STOP'
  | 'NEUTRAL'
  | 'OFFENSIVE_GAIN'
  | 'GREAT_OFFENSE';

export interface PlayEvent {
  drive: number;
  quarter: number;
  offenseSide: 'home' | 'away';
  offensePlayId: string;
  defensePlayId: string;
  offenseCategory: OffensiveCategory;
  defenseCategory: DefensiveCategory;
  down: number;
  distance: number;
  yardLine: number; // 0-100, offense's perspective (own goal = 0, opp goal = 100)
  offWinProb: number;
  offenseWon: boolean;
  resultLabel: ResultLabel;
  yards: number;
  calculation?: PlayCalculation;
  highlightPlayer?: { name: string; position: string; overall: number };
  scoringEvent?: 'TD' | 'DEFENSIVE_TD' | 'SAFETY' | 'TURNOVER' | 'FUMBLE' | 'INT' | 'FG_GOOD' | 'FG_MISS' | 'PUNT' | 'TURNOVER_ON_DOWNS';
}

export interface PlayCalculation {
  offBaseRaw: number;
  defBaseRaw: number;
  offHomeBonus: number;
  defHomeBonus: number;
  offBase: number;
  defBase: number;
  offMatchup: number;
  defMatchup: number;
  ocOverall: number;
  dcOverall: number;
  ocMod: number;
  dcMod: number;
  offFinal: number;
  defFinal: number;
  offWinProb: number;
  roll: number;
  severity: number;
}

export interface DriveOutcome {
  side: 'home' | 'away';
  drive: number;
  quarter: number;
  startYardLine: number;
  endYardLine: number;
  result: 'TD' | 'FG' | 'PUNT' | 'TURNOVER' | 'TURNOVER_ON_DOWNS' | 'DEFENSIVE_TD' | 'SAFETY' | 'MISSED_FG';
  scoringSide?: 'home' | 'away';
  points: number;
  plays: PlayEvent[];
}

export interface ScoringDrive {
  team: 'home' | 'away';
  points: number;
  quarter: number;
}

export interface MatchSimResult {
  homeScore: number;
  awayScore: number;
  quarterScores: Array<[number, number]>;
  scoringDrives: ScoringDrive[];
  drives: DriveOutcome[];
  plays: PlayEvent[];
  narrative: string;
  keyMatchup: string;
}

// ── Configuration ─────────────────────────────────────────

const HOME_FIELD_PLAY_BONUS = 1.5; // small additive shove to home offense play strengths
const TOTAL_DRIVES = 16;           // 2 drives per team per quarter
const QUARTER_BREAKPOINTS = [4, 8, 12, 16]; // drive index < this => quarter

// HC RNG distribution lookup (offensive OVR -> {optimal, neutral, poor} weights).
// 50 OVR ≈ 20/50/30, 100 OVR ≈ 80/15/5. Linear with clamps in between.
function hcPickWeights(ovr: number): { optimal: number; neutral: number; poor: number } {
  const optimal = clamp(0.20 + (ovr - 50) * 0.012, 0.20, 0.80);
  const poor    = clamp(0.30 - (ovr - 50) * 0.005, 0.05, 0.30);
  const neutral = clamp(1 - optimal - poor, 0, 1);
  return { optimal, neutral, poor };
}

// ── Roster slot resolution ────────────────────────────────

type SlotMap = Record<PlayerSlot, PlayerProfile | null>;

const POSITION_TO_SLOTS: Array<{ position: string; slots: PlayerSlot[] }> = [
  { position: 'QB', slots: ['QB'] },
  { position: 'RB', slots: ['RB'] },
  { position: 'WR', slots: ['WR'] },
  { position: 'TE', slots: ['TE'] },
  { position: 'OL', slots: ['T', 'G', 'C'] },
  { position: 'DE', slots: ['EDGE1', 'EDGE2'] },
  { position: 'DT', slots: ['DT1', 'DT2'] },
  { position: 'LB', slots: ['MLB', 'WLB', 'SLB'] },
  { position: 'CB', slots: ['CB1', 'CB2', 'NCB'] },
  { position: 'S',  slots: ['FS', 'SS'] },
];

function buildSlotMap(players: PlayerProfile[]): SlotMap {
  const map: Partial<SlotMap> = {};
  for (const group of POSITION_TO_SLOTS) {
    const sorted = players
      .filter((p) => p.position === group.position)
      .map((p) => ({ player: p, score: p.overall }))
      .sort((a, b) => b.score - a.score);
    group.slots.forEach((slot, i) => {
      map[slot] = sorted[i]?.player ?? null;
    });
  }
  return map as SlotMap;
}

function slotRating(slot: PlayerSlot, slots: SlotMap): number {
  const p = slots[slot];
  if (!p) return 55; // sensible league-floor fallback if a slot is empty
  return p.overall;
}

function basePlayStrength(play: Play, slots: SlotMap): number {
  return play.keySlots.reduce((sum, slot) => sum + slotRating(slot, slots), 0) / 3;
}

function highlightForPlay(play: Play, slots: SlotMap): PlayEvent['highlightPlayer'] {
  const candidates = play.keySlots
    .map((slot) => slots[slot])
    .filter((player): player is PlayerProfile => !!player)
    .sort((a, b) => b.overall - a.overall);
  const player = candidates[0];
  return player ? { name: player.name, position: player.position, overall: player.overall } : undefined;
}

// ── Coach helpers ─────────────────────────────────────────

interface CoachOVRs {
  hcOverall: number;
  hcOffense: number;
  hcDefense: number;
  ocOverall: number;
  dcOverall: number;
}

function extractCoachOVRs(coaches?: CoachProfile[]): CoachOVRs {
  const hc = coaches?.find((c) => c.position === 'HC');
  const oc = coaches?.find((c) => c.position === 'OC');
  const dc = coaches?.find((c) => c.position === 'DC');
  return {
    hcOverall: coachOverall(hc),
    hcOffense: hc?.stat1 ?? hc?.overall ?? 60,
    hcDefense: hc?.stat2 ?? hc?.overall ?? 60,
    ocOverall: coachOverall(oc),
    dcOverall: coachOverall(dc),
  };
}

function coachOverall(coach?: CoachProfile): number {
  if (!coach) return 60;
  if (typeof coach.overall === 'number') return coach.overall;
  const s1 = coach.stat1 ?? 60;
  const s2 = coach.stat2 ?? 60;
  return Math.round((s1 + s2) / 2);
}

// ── Per-team match context ────────────────────────────────

interface TeamCtx {
  name: string;
  side: 'home' | 'away';
  isHome: boolean;
  slots: SlotMap;
  offense: OffensivePlay[];
  defense: DefensivePlay[];
  offenseCategoryCounts: Record<OffensiveCategory, number>;
  defenseCategoryCounts: Record<DefensiveCategory, number>;
  coach: CoachOVRs;
}

function buildContext(team: TeamMatchProfile, gameplan: Gameplan, side: 'home' | 'away'): TeamCtx {
  const slots = buildSlotMap(team.players);
  const offense = gameplan.offensivePlays
    .map((id) => offensivePlayById(id))
    .filter((p): p is OffensivePlay => !!p);
  const defense = gameplan.defensivePlays
    .map((id) => defensivePlayById(id))
    .filter((p): p is DefensivePlay => !!p);

  const offenseCategoryCounts: Record<OffensiveCategory, number> = { RUNNING: 0, SHORT_PASS: 0, MIDDLE_PASS: 0, LONG_PASS: 0 };
  for (const p of offense) offenseCategoryCounts[p.category]++;
  const defenseCategoryCounts: Record<DefensiveCategory, number> = { ZONE: 0, BLITZ: 0, ZONE_BLITZ: 0, MAN: 0 };
  for (const p of defense) defenseCategoryCounts[p.category]++;

  return {
    name: team.name,
    side,
    isHome: side === 'home',
    slots,
    offense,
    defense,
    offenseCategoryCounts,
    defenseCategoryCounts,
    coach: extractCoachOVRs(team.coaches),
  };
}

// ── Play selection ────────────────────────────────────────

// Score an offensive play's expected matchup vs the defense's category mix.
function evaluateOffensiveCandidate(play: OffensivePlay, off: TeamCtx, def: TeamCtx): number {
  const base = basePlayStrength(play, off.slots);
  let matchupAvg = 0;
  let total = 0;
  for (const cat of Object.keys(def.defenseCategoryCounts) as DefensiveCategory[]) {
    const w = def.defenseCategoryCounts[cat];
    if (w === 0) continue;
    matchupAvg += offensiveMatchupMod(play.category, cat) * w;
    total += w;
  }
  matchupAvg /= total || 1;
  return base * matchupAvg;
}

// Score a defensive play's expected matchup vs the offense's category mix.
function evaluateDefensiveCandidate(play: DefensivePlay, off: TeamCtx, def: TeamCtx): number {
  const base = basePlayStrength(play, def.slots);
  let matchupAvg = 0;
  let total = 0;
  for (const cat of Object.keys(off.offenseCategoryCounts) as OffensiveCategory[]) {
    const w = off.offenseCategoryCounts[cat];
    if (w === 0) continue;
    matchupAvg += defensiveMatchupMod(cat, play.category) * w;
    total += w;
  }
  matchupAvg /= total || 1;
  return base * matchupAvg;
}

// Pick one of {best, mid, worst} from a sorted candidate list based on HC OVR.
function hcWeightedPick<T>(sorted: T[], hcOvr: number): T {
  const { optimal, neutral } = hcPickWeights(hcOvr);
  const r = Math.random();
  if (r < optimal) return sorted[0] ?? sorted[sorted.length - 1];
  if (r < optimal + neutral) return sorted[1] ?? sorted[0];
  return sorted[2] ?? sorted[sorted.length - 1];
}

// Sample 3 unique candidates from a 9-play loadout, weighted by category frequency.
// This is the layer where a 6-blitz defense skews toward blitzes — not raw strength.
function sampleCandidates<T extends Play>(plays: T[]): T[] {
  if (plays.length <= 3) return plays.slice();
  const pool = plays.slice();
  const out: T[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function pickOffensivePlay(off: TeamCtx, def: TeamCtx): OffensivePlay {
  const candidates = sampleCandidates(off.offense);
  const scored = candidates
    .map((play) => ({ play, score: evaluateOffensiveCandidate(play, off, def) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.play);
  return hcWeightedPick(scored, off.coach.hcOffense);
}

function pickDefensivePlay(off: TeamCtx, def: TeamCtx): DefensivePlay {
  const candidates = sampleCandidates(def.defense);
  const scored = candidates
    .map((play) => ({ play, score: evaluateDefensiveCandidate(play, off, def) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.play);
  return hcWeightedPick(scored, def.coach.hcDefense);
}

// ── Play resolution ───────────────────────────────────────

function gaussian(mean: number, std: number): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

interface PlayResolution {
  offWinProb: number;
  offenseWon: boolean;
  yards: number;
  resultLabel: ResultLabel;
  calculation: PlayCalculation;
  scoringEvent?: PlayEvent['scoringEvent'];
}

function resolvePlay(
  offPlay: OffensivePlay,
  defPlay: DefensivePlay,
  off: TeamCtx,
  def: TeamCtx,
): PlayResolution {
  const offBaseRaw = basePlayStrength(offPlay, off.slots);
  const defBaseRaw = basePlayStrength(defPlay, def.slots);
  const offHomeBonus = off.isHome ? HOME_FIELD_PLAY_BONUS : 0;
  const defHomeBonus = def.isHome ? HOME_FIELD_PLAY_BONUS : 0;
  const offBase = offBaseRaw + offHomeBonus;
  const defBase = defBaseRaw + defHomeBonus;

  const offMatchup = offensiveMatchupMod(offPlay.category, defPlay.category);
  const defMatchup = defensiveMatchupMod(offPlay.category, defPlay.category);

  const ocMod = 1 + (off.coach.ocOverall - 50) / 100;
  const dcMod = 1 + (def.coach.dcOverall - 50) / 100;

  const offFinal = offBase * offMatchup * ocMod;
  const defFinal = defBase * defMatchup * dcMod;

  const offWinProb = offFinal / (offFinal + defFinal);
  const roll = Math.random();
  const offenseWon = roll < offWinProb;

  // Severity: bell curve shifted toward the winner. Margin amplifies the shift.
  const margin = Math.abs(offWinProb - 0.5) * 2; // 0..1
  const shiftMagnitude = 0.8 + margin * 1.2;     // 0.8..2.0
  const baseShift = offenseWon ? +shiftMagnitude : -shiftMagnitude;
  const severity = gaussian(baseShift, 0.9);

  return mapSeverityToOutcome(severity, offPlay, defPlay, offWinProb, offenseWon, {
    offBaseRaw,
    defBaseRaw,
    offHomeBonus,
    defHomeBonus,
    offBase,
    defBase,
    offMatchup,
    defMatchup,
    ocOverall: off.coach.ocOverall,
    dcOverall: def.coach.dcOverall,
    ocMod,
    dcMod,
    offFinal,
    defFinal,
    offWinProb,
    roll,
    severity,
  });
}

function mapSeverityToOutcome(
  severity: number,
  offPlay: OffensivePlay,
  defPlay: DefensivePlay,
  offWinProb: number,
  offenseWon: boolean,
  calculation: PlayCalculation,
): PlayResolution {
  let yards: number;
  let label: ResultLabel;
  let scoringEvent: PlayEvent['scoringEvent'] | undefined;

  if (severity > 2.0) {
    label = 'GREAT_OFFENSE';
    yards = 20 + Math.random() * 45;       // explosive 20-65 yard chunks
  } else if (severity > 0.5) {
    label = 'OFFENSIVE_GAIN';
    yards = 4 + Math.random() * 11;         // 4-15
  } else if (severity > -0.5) {
    label = 'NEUTRAL';
    yards = -1 + Math.random() * 6;         // -1..5
  } else if (severity > -2.0) {
    label = 'DEFENSIVE_STOP';
    yards = -3 + Math.random() * 4;         // -3..1
  } else {
    label = 'GREAT_DEFENSE';
    yards = -9 + Math.random() * 5;         // -9..-4 (TFLs, sacks)
    // Turnover roll when the defense thoroughly wins. Pass plays bias toward INTs.
    const isPass = offPlay.category !== 'RUNNING';
    const turnoverP = 0.18 + Math.min(0.22, (Math.abs(severity) - 2) * 0.18);
    if (Math.random() < turnoverP) {
      // Pick six / scoop-and-score: small chance when defense dominates.
      const defTdP = isPass ? 0.12 : 0.05;
      if (Math.random() < defTdP) scoringEvent = 'DEFENSIVE_TD';
      else scoringEvent = isPass ? 'INT' : 'FUMBLE';
    }
  }

  // Coverage of pass-play floor: incompletions land at 0 yards rather than negative.
  if (offPlay.category !== 'RUNNING' && yards < 0 && label === 'DEFENSIVE_STOP') {
    yards = Math.random() < 0.6 ? 0 : yards;
  }

  return {
    offWinProb,
    offenseWon,
    yards: Math.round(yards),
    resultLabel: label,
    calculation,
    scoringEvent,
  };
}

// ── Drive simulation ──────────────────────────────────────

function simulateDrive(
  off: TeamCtx,
  def: TeamCtx,
  driveIdx: number,
  startYardLine: number,
  quarter: number,
): DriveOutcome {
  let yardLine = startYardLine;
  let down = 1;
  let distance = 10;
  const plays: PlayEvent[] = [];
  const startLine = yardLine;

  while (true) {
    // 4th down decision: FG if within range, otherwise punt (or rare go-for-it).
    if (down === 4) {
      const yardsToGoal = 100 - yardLine;
      const fgKickDistance = yardsToGoal + 17; // snap+holder distance
      if (yardsToGoal <= 4 && Math.random() < 0.35) {
        // Goal-line gamble — fall through to play
      } else if (fgKickDistance <= 60) {
        const fgGood = rollFGSuccess(fgKickDistance);
        const event: PlayEvent = blankPlayEvent({
          drive: driveIdx, quarter, offenseSide: off.side,
          offensePlayId: '__fg__', defensePlayId: '__fg_block__',
          offenseCategory: 'RUNNING', defenseCategory: 'ZONE',
          down, distance, yardLine,
          offWinProb: 0.5, offenseWon: fgGood, resultLabel: fgGood ? 'OFFENSIVE_GAIN' : 'DEFENSIVE_STOP',
          yards: 0, scoringEvent: fgGood ? 'FG_GOOD' : 'FG_MISS',
        });
        plays.push(event);
        if (fgGood) {
          return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'FG', scoringSide: off.side, points: 3, plays };
        }
        return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'MISSED_FG', points: 0, plays };
      } else if (yardsToGoal > 50 || distance > 5) {
        // Punt
        const event: PlayEvent = blankPlayEvent({
          drive: driveIdx, quarter, offenseSide: off.side,
          offensePlayId: '__punt__', defensePlayId: '__punt_return__',
          offenseCategory: 'RUNNING', defenseCategory: 'ZONE',
          down, distance, yardLine,
          offWinProb: 0.5, offenseWon: true, resultLabel: 'NEUTRAL',
          yards: 0, scoringEvent: 'PUNT',
        });
        plays.push(event);
        return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'PUNT', points: 0, plays };
      }
      // Otherwise: go for it — fall through to play resolution.
    }

    // Run a play.
    const offPlay = pickOffensivePlay(off, def);
    const defPlay = pickDefensivePlay(off, def);
    const res = resolvePlay(offPlay, defPlay, off, def);

    let scoringEvent = res.scoringEvent;
    let appliedYards = res.yards;

    // Cap upside to remaining yardage on long gains.
    if (yardLine + appliedYards > 100) appliedYards = 100 - yardLine;

    plays.push({
      drive: driveIdx, quarter,
      offenseSide: off.side,
      offensePlayId: offPlay.id, defensePlayId: defPlay.id,
      offenseCategory: offPlay.category, defenseCategory: defPlay.category,
      down, distance, yardLine,
      offWinProb: res.offWinProb, offenseWon: res.offenseWon,
      resultLabel: res.resultLabel,
      yards: appliedYards,
      calculation: res.calculation,
      highlightPlayer: highlightForPlay(res.offenseWon ? offPlay : defPlay, res.offenseWon ? off.slots : def.slots),
      scoringEvent,
    });

    if (scoringEvent === 'DEFENSIVE_TD') {
      return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'DEFENSIVE_TD', scoringSide: def.side, points: 7, plays };
    }
    if (scoringEvent === 'INT' || scoringEvent === 'FUMBLE') {
      return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'TURNOVER', points: 0, plays };
    }

    yardLine += appliedYards;

    // Safety: pinned in own end zone for a loss.
    if (yardLine < 0) {
      // Flip the last play's scoring event for clarity
      plays[plays.length - 1].scoringEvent = 'SAFETY';
      return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: 0, result: 'SAFETY', scoringSide: def.side, points: 2, plays };
    }

    // Touchdown.
    if (yardLine >= 100) {
      plays[plays.length - 1].scoringEvent = 'TD';
      return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: 100, result: 'TD', scoringSide: off.side, points: 7, plays };
    }

    distance -= appliedYards;
    if (distance <= 0) {
      down = 1;
      distance = 10;
    } else {
      down++;
      if (down > 4) {
        // Failed go-for-it: turnover on downs.
        plays[plays.length - 1].scoringEvent = 'TURNOVER_ON_DOWNS';
        return { side: off.side, drive: driveIdx, quarter, startYardLine: startLine, endYardLine: yardLine, result: 'TURNOVER_ON_DOWNS', points: 0, plays };
      }
    }
  }
}

function rollFGSuccess(distance: number): boolean {
  // Realistic-ish accuracy curve: ~95% from 20, ~85% from 40, ~60% from 50, ~30% from 58+
  const p =
    distance <= 25 ? 0.96 :
    distance <= 35 ? 0.90 :
    distance <= 42 ? 0.82 :
    distance <= 48 ? 0.70 :
    distance <= 53 ? 0.55 :
    distance <= 58 ? 0.35 :
                      0.18;
  return Math.random() < p;
}

function blankPlayEvent(partial: Partial<PlayEvent>): PlayEvent {
  return {
    drive: 0, quarter: 1, offenseSide: 'home',
    offensePlayId: '', defensePlayId: '',
    offenseCategory: 'RUNNING', defenseCategory: 'ZONE',
    down: 1, distance: 10, yardLine: 25,
    offWinProb: 0.5, offenseWon: false, resultLabel: 'NEUTRAL',
    yards: 0,
    ...partial,
  };
}

// ── Interactive match state ───────────────────────────────

export type InteractiveAction =
  | { type: 'PLAY'; playId: string }
  | { type: 'PUNT' }
  | { type: 'FIELD_GOAL' }
  | { type: 'GO_FOR_IT' };

export interface InteractiveMatchState {
  version: 1;
  status: 'ACTIVE' | 'FINAL';
  homeScore: number;
  awayScore: number;
  quarterScores: Array<[number, number]>;
  possession: 'home' | 'away';
  drive: number;
  down: number;
  distance: number;
  yardLine: number;
  overtime: boolean;
  overtimePossessions: number;
  sequence: number;
}

export interface InteractiveSnapResult {
  state: InteractiveMatchState;
  play: PlayEvent;
  action: InteractiveAction;
  final: boolean;
}

export function createInteractiveMatchState(): InteractiveMatchState {
  return {
    version: 1,
    status: 'ACTIVE',
    homeScore: 0,
    awayScore: 0,
    quarterScores: [[0, 0], [0, 0], [0, 0], [0, 0]],
    possession: Math.random() < 0.5 ? 'home' : 'away',
    drive: 0,
    down: 1,
    distance: 10,
    yardLine: 25,
    overtime: false,
    overtimePossessions: 0,
    sequence: 0,
  };
}

export function interactiveQuarter(state: InteractiveMatchState): number {
  return state.overtime ? 4 : quarterFromDrive(state.drive);
}

export function interactiveClock(state: InteractiveMatchState): string {
  if (state.status === 'FINAL') return '00:00';
  const quarter = interactiveQuarter(state);
  const quarterStartDrive = quarter === 1 ? 0 : quarter === 2 ? 4 : quarter === 3 ? 8 : 12;
  const drivesInQuarter = 4;
  const driveOffset = Math.max(0, state.drive - quarterStartDrive);
  const baseSeconds = Math.max(0, 15 * 60 - Math.floor((driveOffset / drivesInQuarter) * 15 * 60));
  const seconds = Math.max(0, baseSeconds - (state.down - 1) * 32);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function interactiveDecisionUnit(state: InteractiveMatchState): 'offense' | 'defense' {
  return state.possession === 'home' ? 'offense' : 'defense';
}

export function resolveInteractiveSnap(
  state: InteractiveMatchState,
  home: TeamMatchProfile,
  away: TeamMatchProfile,
  userSide: 'home' | 'away',
  requestedAction?: InteractiveAction,
): InteractiveSnapResult {
  if (state.status === 'FINAL') throw new Error('Match already finished');

  const homeCtx = buildContext(home, normalizeGameplan({
    offensivePlays: home.offensivePlays,
    defensivePlays: home.defensivePlays,
  }), 'home');
  const awayCtx = buildContext(away, normalizeGameplan({
    offensivePlays: away.offensivePlays,
    defensivePlays: away.defensivePlays,
  }), 'away');
  const off = state.possession === 'home' ? homeCtx : awayCtx;
  const def = state.possession === 'home' ? awayCtx : homeCtx;
  const userHasPossession = state.possession === userSide;
  const action = requestedAction ?? hcActionForSituation(state, off, def, userSide);

  if (state.down === 4 && action.type !== 'PLAY' && action.type !== 'GO_FOR_IT') {
    const play = action.type === 'FIELD_GOAL'
      ? resolveFieldGoal(state, off)
      : resolvePunt(state, off);
    return finishInteractiveSnap(state, play, action);
  }

  const selectedOffensePlay = userHasPossession && action.type === 'PLAY' && userSide === state.possession
    ? offensivePlayById(action.playId)
    : pickOffensivePlay(off, def);
  const selectedDefensePlay = !userHasPossession && action.type === 'PLAY'
    ? defensivePlayById(action.playId)
    : pickDefensivePlay(off, def);

  if (!selectedOffensePlay) throw new Error('Invalid offensive play');
  if (!selectedDefensePlay) throw new Error('Invalid defensive play');

  const resolution = resolvePlay(selectedOffensePlay, selectedDefensePlay, off, def);
  let appliedYards = resolution.yards;
  if (state.yardLine + appliedYards > 100) appliedYards = 100 - state.yardLine;

  const play = blankPlayEvent({
    drive: state.drive,
    quarter: interactiveQuarter(state),
    offenseSide: state.possession,
    offensePlayId: selectedOffensePlay.id,
    defensePlayId: selectedDefensePlay.id,
    offenseCategory: selectedOffensePlay.category,
    defenseCategory: selectedDefensePlay.category,
    down: state.down,
    distance: state.distance,
    yardLine: state.yardLine,
    offWinProb: resolution.offWinProb,
    offenseWon: resolution.offenseWon,
    resultLabel: resolution.resultLabel,
    yards: appliedYards,
    calculation: resolution.calculation,
    highlightPlayer: highlightForPlay(
      resolution.offenseWon ? selectedOffensePlay : selectedDefensePlay,
      resolution.offenseWon ? off.slots : def.slots,
    ),
    scoringEvent: resolution.scoringEvent,
  });

  if (play.scoringEvent === 'DEFENSIVE_TD' || play.scoringEvent === 'INT' || play.scoringEvent === 'FUMBLE') {
    return finishInteractiveSnap(state, play, action);
  }

  const nextYardLine = state.yardLine + appliedYards;
  if (nextYardLine < 0) {
    play.scoringEvent = 'SAFETY';
    return finishInteractiveSnap(state, play, action);
  }
  if (nextYardLine >= 100) {
    play.scoringEvent = 'TD';
    return finishInteractiveSnap(state, play, action);
  }

  const nextDistance = state.distance - appliedYards;
  if (nextDistance <= 0) {
    return finishInteractiveSnap(state, play, action, {
      possession: state.possession,
      down: 1,
      distance: 10,
      yardLine: nextYardLine,
    });
  }

  if (state.down === 4) {
    play.scoringEvent = 'TURNOVER_ON_DOWNS';
    return finishInteractiveSnap(state, play, action);
  }

  return finishInteractiveSnap(state, play, action, {
    possession: state.possession,
    down: state.down + 1,
    distance: Math.max(1, nextDistance),
    yardLine: nextYardLine,
  });
}

function hcActionForSituation(state: InteractiveMatchState, off: TeamCtx, def: TeamCtx, userSide: 'home' | 'away'): InteractiveAction {
  if (state.down === 4) {
    const yardsToGoal = 100 - state.yardLine;
    const kickDistance = yardsToGoal + 17;
    if (kickDistance <= 60) return { type: 'FIELD_GOAL' };
    if (yardsToGoal > 50 || state.distance > 5) return { type: 'PUNT' };
  }
  return userSide === state.possession
    ? { type: 'PLAY', playId: pickOffensivePlay(off, def).id }
    : { type: 'PLAY', playId: pickDefensivePlay(off, def).id };
}

function resolveFieldGoal(state: InteractiveMatchState, off: TeamCtx): PlayEvent {
  const kickDistance = 100 - state.yardLine + 17;
  const good = rollFGSuccess(kickDistance);
  return blankPlayEvent({
    drive: state.drive,
    quarter: interactiveQuarter(state),
    offenseSide: off.side,
    offensePlayId: '__fg__',
    defensePlayId: '__fg_block__',
    offenseCategory: 'RUNNING',
    defenseCategory: 'ZONE',
    down: state.down,
    distance: state.distance,
    yardLine: state.yardLine,
    offWinProb: 0.5,
    offenseWon: good,
    resultLabel: good ? 'OFFENSIVE_GAIN' : 'DEFENSIVE_STOP',
    yards: 0,
    scoringEvent: good ? 'FG_GOOD' : 'FG_MISS',
  });
}

function resolvePunt(state: InteractiveMatchState, off: TeamCtx): PlayEvent {
  return blankPlayEvent({
    drive: state.drive,
    quarter: interactiveQuarter(state),
    offenseSide: off.side,
    offensePlayId: '__punt__',
    defensePlayId: '__punt_return__',
    offenseCategory: 'RUNNING',
    defenseCategory: 'ZONE',
    down: state.down,
    distance: state.distance,
    yardLine: state.yardLine,
    offWinProb: 0.5,
    offenseWon: true,
    resultLabel: 'NEUTRAL',
    yards: 0,
    scoringEvent: 'PUNT',
  });
}

function finishInteractiveSnap(
  state: InteractiveMatchState,
  play: PlayEvent,
  action: InteractiveAction,
  continuation: Partial<InteractiveMatchState> = {},
): InteractiveSnapResult {
  const next: InteractiveMatchState = {
    ...state,
    ...continuation,
    sequence: state.sequence + 1,
    quarterScores: state.quarterScores.map((score) => [...score] as [number, number]),
  };

  if (play.scoringEvent === 'TD' || play.scoringEvent === 'FG_GOOD' || play.scoringEvent === 'DEFENSIVE_TD' || play.scoringEvent === 'SAFETY') {
    const points = play.scoringEvent === 'SAFETY' ? 2 : play.scoringEvent === 'FG_GOOD' ? 3 : 7;
    const scoringSide = play.scoringEvent === 'DEFENSIVE_TD' || play.scoringEvent === 'SAFETY'
      ? otherSide(play.offenseSide)
      : play.offenseSide;
    if (scoringSide === 'home') next.homeScore += points;
    else next.awayScore += points;
    next.quarterScores[interactiveQuarter(state) - 1][scoringSide === 'home' ? 0 : 1] += points;
    return endDrive(next, play, action, play.scoringEvent === 'SAFETY' ? 40 : 25);
  }

  if (play.scoringEvent === 'PUNT' || play.scoringEvent === 'FG_MISS' || play.scoringEvent === 'INT' || play.scoringEvent === 'FUMBLE' || play.scoringEvent === 'TURNOVER_ON_DOWNS') {
    const nextStart = play.scoringEvent === 'PUNT'
      ? clamp(100 - state.yardLine - 30 - Math.floor(Math.random() * 12), 5, 80)
      : play.scoringEvent === 'FG_MISS'
        ? Math.max(20, 100 - state.yardLine)
        : clamp(100 - state.yardLine, 5, 95);
    return endDrive(next, play, action, nextStart);
  }

  return { state: next, play, action, final: false };
}

function endDrive(
  state: InteractiveMatchState,
  play: PlayEvent,
  action: InteractiveAction,
  nextStart: number,
): InteractiveSnapResult {
  const completedDrives = state.drive + 1;
  const next = { ...state, drive: completedDrives, possession: otherSide(state.possession), down: 1, distance: 10, yardLine: nextStart };

  if (state.overtime) {
    next.overtimePossessions = state.overtimePossessions + 1;
    if (play.scoringEvent && ['TD', 'FG_GOOD', 'DEFENSIVE_TD', 'SAFETY'].includes(play.scoringEvent)) {
      next.status = 'FINAL';
    } else if (next.overtimePossessions >= 2) {
      if (next.homeScore === next.awayScore) {
        if (Math.random() < 0.55) next.homeScore += 3;
        else next.awayScore += 3;
      }
      next.status = 'FINAL';
    }
    return { state: next, play, action, final: next.status === 'FINAL' };
  }

  if (completedDrives >= TOTAL_DRIVES) {
    if (next.homeScore === next.awayScore) {
      next.overtime = true;
      next.overtimePossessions = 0;
      next.drive = TOTAL_DRIVES;
      next.possession = Math.random() < 0.5 ? 'home' : 'away';
      next.yardLine = 25;
    } else {
      next.status = 'FINAL';
    }
  }

  return { state: next, play, action, final: next.status === 'FINAL' };
}

// ── Match simulation ──────────────────────────────────────

export function simulateMatch(
  home: TeamMatchProfile,
  away: TeamMatchProfile,
  _week: number = 1,
  homeGameplan: Gameplan = defaultGameplan(),
  awayGameplan: Gameplan = defaultGameplan(),
): MatchSimResult {
  const homeGP = normalizeGameplan(homeGameplan);
  const awayGP = normalizeGameplan(awayGameplan);

  const homeCtx = buildContext(home, homeGP, 'home');
  const awayCtx = buildContext(away, awayGP, 'away');

  let homeScore = 0;
  let awayScore = 0;
  const quarterScores: Array<[number, number]> = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const drives: DriveOutcome[] = [];
  const allPlays: PlayEvent[] = [];

  // Coin flip decides who receives. Standard model: receiving team starts on offense.
  let possession: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
  let nextStart = 25;

  for (let i = 0; i < TOTAL_DRIVES; i++) {
    const quarter = quarterFromDrive(i);
    const off = possession === 'home' ? homeCtx : awayCtx;
    const def = possession === 'home' ? awayCtx : homeCtx;

    const drive = simulateDrive(off, def, i, nextStart, quarter);
    drives.push(drive);
    allPlays.push(...drive.plays);

    // Apply points to the right side.
    if (drive.points > 0 && drive.scoringSide) {
      if (drive.scoringSide === 'home') homeScore += drive.points;
      else                              awayScore += drive.points;
      quarterScores[quarter - 1][drive.scoringSide === 'home' ? 0 : 1] += drive.points;
    }

    // Next possession + starting field position.
    if (drive.result === 'TD' || drive.result === 'FG' || drive.result === 'DEFENSIVE_TD') {
      possession = otherSide(possession);
      nextStart = 25;
    } else if (drive.result === 'SAFETY') {
      // Team that gave up the safety free-kicks; opponent gets ball at ~40.
      possession = otherSide(possession);
      nextStart = 40;
    } else if (drive.result === 'PUNT') {
      possession = otherSide(possession);
      nextStart = clamp(100 - drive.endYardLine - 30 - Math.floor(Math.random() * 12), 5, 80);
    } else if (drive.result === 'MISSED_FG') {
      possession = otherSide(possession);
      nextStart = Math.max(20, 100 - drive.endYardLine);
    } else if (drive.result === 'TURNOVER' || drive.result === 'TURNOVER_ON_DOWNS') {
      possession = otherSide(possession);
      nextStart = clamp(100 - drive.endYardLine, 5, 95);
    }
  }

  // Overtime: if tied at the end of regulation, run a single sudden-death drive each.
  if (homeScore === awayScore) {
    const otQuarter = 4;
    const order: Array<'home' | 'away'> = Math.random() < 0.55 ? ['home', 'away'] : ['away', 'home'];
    for (const side of order) {
      if (homeScore !== awayScore) break;
      const off = side === 'home' ? homeCtx : awayCtx;
      const def = side === 'home' ? awayCtx : homeCtx;
      const drive = simulateDrive(off, def, TOTAL_DRIVES + order.indexOf(side), 25, otQuarter);
      drives.push(drive);
      allPlays.push(...drive.plays);
      if (drive.scoringSide && drive.points > 0) {
        if (drive.scoringSide === 'home') homeScore += drive.points;
        else                              awayScore += drive.points;
        quarterScores[otQuarter - 1][drive.scoringSide === 'home' ? 0 : 1] += drive.points;
      }
    }
    // Hard tiebreaker if both OT possessions stalled.
    if (homeScore === awayScore) {
      if (Math.random() < 0.55) homeScore += 3;
      else                      awayScore += 3;
      quarterScores[otQuarter - 1][homeScore > awayScore ? 0 : 1] += 3;
    }
  }

  const scoringDrives: ScoringDrive[] = drives
    .filter((d) => d.points > 0 && d.scoringSide)
    .map((d) => ({ team: d.scoringSide!, points: d.points, quarter: d.quarter }));

  const { narrative, keyMatchup } = buildNarrative(home, away, homeScore, awayScore, drives, allPlays);

  return {
    homeScore,
    awayScore,
    quarterScores,
    scoringDrives,
    drives,
    plays: allPlays,
    narrative,
    keyMatchup,
  };
}

function quarterFromDrive(driveIdx: number): number {
  for (let q = 0; q < QUARTER_BREAKPOINTS.length; q++) {
    if (driveIdx < QUARTER_BREAKPOINTS[q]) return q + 1;
  }
  return 4;
}

function otherSide(s: 'home' | 'away'): 'home' | 'away' {
  return s === 'home' ? 'away' : 'home';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Narrative ─────────────────────────────────────────────

function buildNarrative(
  home: TeamMatchProfile,
  away: TeamMatchProfile,
  homeScore: number,
  awayScore: number,
  drives: DriveOutcome[],
  plays: PlayEvent[],
): { narrative: string; keyMatchup: string } {
  const winnerHome = homeScore >= awayScore;
  const winnerName = winnerHome ? home.name : away.name;
  const loserName  = winnerHome ? away.name : home.name;
  const winnerScore = winnerHome ? homeScore : awayScore;
  const loserScore  = winnerHome ? awayScore : homeScore;
  const diff = winnerScore - loserScore;

  const tone = diff >= 17 ? 'blowout' : diff >= 8 ? 'comfortable' : diff <= 3 ? 'nail-biter' : 'tight';

  // Most-used categories tell the identity story.
  const winnerOffCat = topOffCategory(plays.filter((p) => p.offenseSide === (winnerHome ? 'home' : 'away')));
  const winnerDefCat = topDefCategoryAgainst(plays.filter((p) => p.offenseSide !== (winnerHome ? 'home' : 'away')));
  const offNote = offCategoryDescription(winnerOffCat);
  const defNote = defCategoryDescription(winnerDefCat);

  const summary =
    tone === 'blowout'
      ? `${winnerName} dominated ${loserName} ${winnerScore}-${loserScore}. ${offNote} ${defNote}`
      : tone === 'comfortable'
      ? `${winnerName} controlled ${loserName} ${winnerScore}-${loserScore}. ${offNote} ${defNote}`
      : tone === 'nail-biter'
      ? `${winnerName} edged ${loserName} ${winnerScore}-${loserScore} in a tight one. ${offNote} ${defNote}`
      : `${winnerName} beat ${loserName} ${winnerScore}-${loserScore}. ${offNote} ${defNote}`;

  const keyMatchup = `${winnerOffCat ? labelFor(winnerOffCat) : 'Mixed offense'} vs ${winnerDefCat ? labelFor(winnerDefCat) : 'mixed defense'}`;

  return { narrative: summary, keyMatchup };
}

function topOffCategory(plays: PlayEvent[]): OffensiveCategory | null {
  const counts: Record<string, number> = {};
  for (const p of plays) counts[p.offenseCategory] = (counts[p.offenseCategory] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as OffensiveCategory | null;
}

function topDefCategoryAgainst(plays: PlayEvent[]): DefensiveCategory | null {
  const counts: Record<string, number> = {};
  for (const p of plays) counts[p.defenseCategory] = (counts[p.defenseCategory] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as DefensiveCategory | null;
}

function offCategoryDescription(cat: OffensiveCategory | null): string {
  switch (cat) {
    case 'RUNNING':     return 'They leaned on the ground game.';
    case 'SHORT_PASS':  return 'They picked apart the underneath.';
    case 'MIDDLE_PASS': return 'They worked the intermediate windows.';
    case 'LONG_PASS':   return 'They took shots downfield.';
    default:            return '';
  }
}

function defCategoryDescription(cat: DefensiveCategory | null): string {
  switch (cat) {
    case 'ZONE':       return 'The defense played disciplined zone.';
    case 'BLITZ':      return 'The defense brought heat all afternoon.';
    case 'ZONE_BLITZ': return 'The defense disguised pressure out of zone shells.';
    case 'MAN':        return 'The defense locked up in man coverage.';
    default:           return '';
  }
}

function labelFor(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// Helper: re-export for callers that need to inspect a play by id (e.g. feed gen)
export { playById };
