import { DefensiveIdentity, OffensiveIdentity } from './teamIdentity';

// ── OC Philosophies ──────────────────────────────────────────
// Driven by the ratio of pass scheming (offenseRating) vs run scheming (defenseRating).
// 5 tiers × 2 variants = 10 unique philosophies.

export type OCLean = 'VERY_PASS' | 'PASS' | 'BALANCED' | 'RUN' | 'VERY_RUN';

export const OC_PHILOSOPHIES: Record<OCLean, readonly [string, string]> = {
  VERY_PASS: ['Air Raid Maestro', 'Vertical Architect'],
  PASS:      ['Route Chemist', 'Downfield Creator'],
  BALANCED:  ['Tempo Mixer', 'Balance Builder'],
  RUN:       ['Ground Game Designer', 'Trench Conductor'],
  VERY_RUN:  ['Smashmouth Specialist', 'Power Run Guru'],
};

export function ocLeanFromRatings(passScheming: number, runScheming: number): OCLean {
  const diff = passScheming - runScheming;
  if (diff >= 15) return 'VERY_PASS';
  if (diff >= 5)  return 'PASS';
  if (diff > -5)  return 'BALANCED';
  if (diff > -15) return 'RUN';
  return 'VERY_RUN';
}

export function pickOCPhilosophy(passScheming: number, runScheming: number): string {
  const lean = ocLeanFromRatings(passScheming, runScheming);
  return pick(OC_PHILOSOPHIES[lean]);
}

// ── DC Philosophies ──────────────────────────────────────────
// Driven by the ratio of run defense (offenseRating) vs pass defense (defenseRating).
// 5 tiers × 2 variants = 10 unique philosophies.

export type DCLean = 'VERY_RUN_D' | 'RUN_D' | 'BALANCED' | 'PASS_D' | 'VERY_PASS_D';

export const DC_PHILOSOPHIES: Record<DCLean, readonly [string, string]> = {
  VERY_RUN_D:  ['Run Stuffer', 'Gap Destroyer'],
  RUN_D:       ['Front Seven Anchor', 'Downhill Stopper'],
  BALANCED:    ['Adjustment Artist', 'Two-Level Organizer'],
  PASS_D:      ['Coverage Sculptor', 'Shell Master'],
  VERY_PASS_D: ['Blitz Designer', 'Chaos Coordinator'],
};

export function dcLeanFromRatings(runDefense: number, passDefense: number): DCLean {
  const diff = runDefense - passDefense;
  if (diff >= 15) return 'VERY_RUN_D';
  if (diff >= 5)  return 'RUN_D';
  if (diff > -5)  return 'BALANCED';
  if (diff > -15) return 'PASS_D';
  return 'VERY_PASS_D';
}

export function pickDCPhilosophy(runDefense: number, passDefense: number): string {
  const lean = dcLeanFromRatings(runDefense, passDefense);
  return pick(DC_PHILOSOPHIES[lean]);
}

// ── HC Philosophies ──────────────────────────────────────────
// Driven by the spread between offenseRating and defenseRating.
// 5 tiers × 2 variants = 10 unique philosophies.

export type HeadCoachLean = 'VERY_OFFENSE' | 'OFFENSE' | 'BALANCED' | 'DEFENSE' | 'VERY_DEFENSE';

export const HEAD_COACH_PHILOSOPHIES: Record<HeadCoachLean, readonly [string, string]> = {
  VERY_OFFENSE: ['Aerial Mastermind', 'Offensive Visionary'],
  OFFENSE:      ['Modern Shot-Caller', 'Tempo Strategist'],
  BALANCED:     ['Program Stabilizer', 'Two-Way General'],
  DEFENSE:      ['Old-School Builder', 'Trench Warrior'],
  VERY_DEFENSE: ['Defensive Tactician', 'Stonewall Strategist'],
};

export function headCoachLeanFromRatings(offenseRating: number, defenseRating: number): HeadCoachLean {
  const diff = offenseRating - defenseRating;
  if (diff >= 15) return 'VERY_OFFENSE';
  if (diff >= 5)  return 'OFFENSE';
  if (diff > -5)  return 'BALANCED';
  if (diff > -15) return 'DEFENSE';
  return 'VERY_DEFENSE';
}

export function pickHeadCoachPhilosophy(offenseRating: number, defenseRating: number): string {
  const lean = headCoachLeanFromRatings(offenseRating, defenseRating);
  return pick(HEAD_COACH_PHILOSOPHIES[lean]);
}

// ── Identity helpers ─────────────────────────────────────────

export const OFFENSIVE_IDENTITIES: OffensiveIdentity[] = ['VERTICAL', 'PASS_HEAVY', 'RUN_HEAVY', 'BALANCED'];
export const DEFENSIVE_IDENTITIES: DefensiveIdentity[] = ['PRESSURE', 'MAN_HEAVY', 'ZONE_HEAVY', 'BALANCED'];

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

// Legacy helpers kept for backward compat with offseason team identity sync.
export function pickOffensiveCoachPhilosophy(identity: OffensiveIdentity): string {
  // Map identity → lean, then pick
  const lean: OCLean =
    identity === 'VERTICAL' ? 'VERY_PASS' :
    identity === 'PASS_HEAVY' ? 'PASS' :
    identity === 'RUN_HEAVY' ? 'RUN' :
    'BALANCED';
  return pick(OC_PHILOSOPHIES[lean]);
}

export function pickDefensiveCoachPhilosophy(identity: DefensiveIdentity): string {
  const lean: DCLean =
    identity === 'PRESSURE' ? 'VERY_PASS_D' :
    identity === 'MAN_HEAVY' ? 'PASS_D' :
    identity === 'ZONE_HEAVY' ? 'RUN_D' :
    'BALANCED';
  return pick(DC_PHILOSOPHIES[lean]);
}

export function randomOffensiveIdentity(): OffensiveIdentity {
  return pick(OFFENSIVE_IDENTITIES);
}

export function randomDefensiveIdentity(): DefensiveIdentity {
  return pick(DEFENSIVE_IDENTITIES);
}

export function offensiveIdentityForStyle(style: string): OffensiveIdentity {
  if (style === 'PASS_HEAVY') return 'PASS_HEAVY';
  if (style === 'RUN_HEAVY') return 'RUN_HEAVY';
  return 'BALANCED';
}

export function defensiveIdentityForStyle(style: string): DefensiveIdentity {
  if (style === 'AGGRESSIVE') return 'PRESSURE';
  if (style === 'PREVENT') return 'ZONE_HEAVY';
  return 'BALANCED';
}

// ── All OC/DC philosophy names (for reverse lookup) ──────────

const ALL_OC_PHILOSOPHIES = Object.values(OC_PHILOSOPHIES).flat();
const ALL_DC_PHILOSOPHIES = Object.values(DC_PHILOSOPHIES).flat();

export function offenseStyleForCoachPhilosophy(philosophy: string): 'PASS_HEAVY' | 'RUN_HEAVY' | 'BALANCED' | null {
  for (const [lean, names] of Object.entries(OC_PHILOSOPHIES) as Array<[OCLean, readonly [string, string]]>) {
    if (names.includes(philosophy)) {
      if (lean === 'VERY_PASS' || lean === 'PASS') return 'PASS_HEAVY';
      if (lean === 'VERY_RUN' || lean === 'RUN') return 'RUN_HEAVY';
      return 'BALANCED';
    }
  }
  // Legacy fallback
  if (philosophy.includes('Ground') || philosophy.includes('Smash') || philosophy.includes('Power')) return 'RUN_HEAVY';
  if (philosophy.includes('Vertical') || philosophy.includes('Air') || philosophy.includes('Route')) return 'PASS_HEAVY';
  if (philosophy.includes('Balance') || philosophy.includes('Tempo')) return 'BALANCED';
  return null;
}

export function defenseStyleForCoachPhilosophy(philosophy: string): 'AGGRESSIVE' | 'PREVENT' | 'BALANCED' | null {
  for (const [lean, names] of Object.entries(DC_PHILOSOPHIES) as Array<[DCLean, readonly [string, string]]>) {
    if (names.includes(philosophy)) {
      if (lean === 'VERY_PASS_D') return 'AGGRESSIVE';
      if (lean === 'VERY_RUN_D' || lean === 'RUN_D') return 'PREVENT';
      if (lean === 'PASS_D') return 'BALANCED';
      return 'BALANCED';
    }
  }
  // Legacy fallback
  if (philosophy.includes('Blitz') || philosophy.includes('Chaos') || philosophy.includes('Pressure')) return 'AGGRESSIVE';
  if (philosophy.includes('Coverage') || philosophy.includes('Shell') || philosophy.includes('Zone')) return 'PREVENT';
  if (philosophy.includes('Adjustment') || philosophy.includes('Flexible')) return 'BALANCED';
  return null;
}
