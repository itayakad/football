import { DefensiveIdentity, OffensiveIdentity } from './teamIdentity';

export const OFFENSIVE_COACH_PHILOSOPHIES: Record<OffensiveIdentity, readonly [string, string]> = {
  VERTICAL:   ['Vertical Architect', 'Downfield Creator'],
  PASS_HEAVY: ['Air Raid Maestro', 'Route Chemist'],
  RUN_HEAVY:  ['Ground Game Designer', 'Trench Conductor'],
  BALANCED:   ['Tempo Mixer', 'Balance Builder'],
};

export const DEFENSIVE_COACH_PHILOSOPHIES: Record<DefensiveIdentity, readonly [string, string]> = {
  PRESSURE:   ['Blitz Designer', 'Chaos Coordinator'],
  MAN_HEAVY:  ['Island Sculptor', 'Matchup Eraser'],
  ZONE_HEAVY: ['Coverage Sculptor', 'Shell Master'],
  BALANCED:   ['Adjustment Artist', 'Two-Level Organizer'],
};

// Head-coach philosophies are picked from 5 buckets based on the spread between
// offenseRating and defenseRating. Two name variants per bucket.
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

export const OFFENSIVE_IDENTITIES: OffensiveIdentity[] = ['VERTICAL', 'PASS_HEAVY', 'RUN_HEAVY', 'BALANCED'];
export const DEFENSIVE_IDENTITIES: DefensiveIdentity[] = ['PRESSURE', 'MAN_HEAVY', 'ZONE_HEAVY', 'BALANCED'];

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function pickOffensiveCoachPhilosophy(identity: OffensiveIdentity): string {
  return pick(OFFENSIVE_COACH_PHILOSOPHIES[identity]);
}

export function pickDefensiveCoachPhilosophy(identity: DefensiveIdentity): string {
  return pick(DEFENSIVE_COACH_PHILOSOPHIES[identity]);
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

export function offenseStyleForCoachPhilosophy(philosophy: string): 'PASS_HEAVY' | 'RUN_HEAVY' | 'BALANCED' | null {
  const identity = offensiveIdentityForCoachPhilosophy(philosophy);
  if (identity === 'VERTICAL' || identity === 'PASS_HEAVY') return 'PASS_HEAVY';
  if (identity === 'RUN_HEAVY') return 'RUN_HEAVY';
  if (identity === 'BALANCED') return 'BALANCED';
  return null;
}

export function defenseStyleForCoachPhilosophy(philosophy: string): 'AGGRESSIVE' | 'PREVENT' | 'BALANCED' | null {
  const identity = defensiveIdentityForCoachPhilosophy(philosophy);
  if (identity === 'PRESSURE') return 'AGGRESSIVE';
  if (identity === 'ZONE_HEAVY') return 'PREVENT';
  if (identity === 'MAN_HEAVY' || identity === 'BALANCED') return 'BALANCED';
  return null;
}

function offensiveIdentityForCoachPhilosophy(philosophy: string): OffensiveIdentity | null {
  for (const identity of OFFENSIVE_IDENTITIES) {
    if (OFFENSIVE_COACH_PHILOSOPHIES[identity].includes(philosophy)) return identity;
  }
  if (philosophy.includes('Ground')) return 'RUN_HEAVY';
  if (philosophy.includes('Vertical')) return 'VERTICAL';
  if (philosophy.includes('Balanced')) return 'BALANCED';
  return null;
}

function defensiveIdentityForCoachPhilosophy(philosophy: string): DefensiveIdentity | null {
  for (const identity of DEFENSIVE_IDENTITIES) {
    if (DEFENSIVE_COACH_PHILOSOPHIES[identity].includes(philosophy)) return identity;
  }
  if (philosophy.includes('Pressure')) return 'PRESSURE';
  if (philosophy.includes('Coverage')) return 'ZONE_HEAVY';
  if (philosophy.includes('Flexible')) return 'BALANCED';
  return null;
}
