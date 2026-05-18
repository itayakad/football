// Unified personnel helpers: stat labels, archetypes, deterministic id seed,
// and forward-lookup helpers for coordinator → team-style sync.
//
// Replaces the old coachPhilosophy.ts module and the inline playerArchetype
// table that used to live in server.ts.

export const COACH_POSITIONS = ['HC', 'OC', 'DC'] as const;
export const PLAYER_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S'] as const;
export const POSITIONS = [...COACH_POSITIONS, ...PLAYER_POSITIONS] as const;
export type Position = typeof POSITIONS[number];

export function isCoachPosition(position: string): boolean {
  return (COACH_POSITIONS as readonly string[]).includes(position);
}

// ── Position → [stat1Label, stat2Label]. Single source of truth for display.
export const STAT_LABELS: Record<string, [string, string]> = {
  HC: ['Offense', 'Defense'],
  OC: ['Pass Scheming', 'Run Scheming'],
  DC: ['Run Defense', 'Pass Defense'],
  QB: ['Accuracy', 'Strength'],
  RB: ['Speed', 'Strength'],
  WR: ['Speed', 'Hands'],
  TE: ['Hands', 'Blocking'],
  OL: ['Strength', 'Technique'],
  DE: ['Speed', 'Strength'],
  DT: ['Strength', 'Technique'],
  LB: ['Speed', 'Tackling'],
  CB: ['Speed', 'Coverage'],
  S:  ['Tackling', 'Coverage'],
};

export function statLabels(position: string): [string, string] {
  return STAT_LABELS[position] ?? ['Stat 1', 'Stat 2'];
}

// ── Archetype/philosophy names per position.
// 5 tiers per position × 2 variants per tier.
// Tier 0 = strongly stat1-dominant; tier 4 = strongly stat2-dominant.
export const ARCHETYPES: Record<string, readonly [string, string][]> = {
  HC: [
    ['Aerial Mastermind',   'Offensive Visionary'],
    ['Modern Shot-Caller',  'Tempo Strategist'],
    ['Program Stabilizer',  'Two-Way General'],
    ['Old-School Builder',  'Trench Warrior'],
    ['Defensive Tactician', 'Stonewall Strategist'],
  ],
  OC: [
    ['Air Raid Maestro',     'Vertical Architect'],
    ['Route Chemist',        'Downfield Creator'],
    ['Tempo Mixer',          'Balance Builder'],
    ['Ground Game Designer', 'Trench Conductor'],
    ['Smashmouth Specialist','Power Run Guru'],
  ],
  DC: [
    ['Run Stuffer',          'Gap Destroyer'],
    ['Front Seven Anchor',   'Downhill Stopper'],
    ['Adjustment Artist',    'Two-Level Organizer'],
    ['Coverage Sculptor',    'Shell Master'],
    ['Blitz Designer',       'Chaos Coordinator'],
  ],
  QB: [
    ['Precision Surgeon',    'Touch Passer'],
    ['Field General',        'Pocket Maestro'],
    ['Dual Threat',          'Complete Signal-Caller'],
    ['Gunslinger',           'Strong-Arm Playmaker'],
    ['Cannon Arm',           'Rocket Launcher'],
  ],
  RB: [
    ['Breakaway Burner',     'Jet Sweeper'],
    ['Elusive Back',         'Scatback'],
    ['All-Purpose Back',     'Complete Runner'],
    ['Power Runner',         'Downhill Hammer'],
    ['Bruiser',              'Workhorse'],
  ],
  WR: [
    ['Deep Threat',          'Burner'],
    ['Vertical Weapon',      'Field Stretcher'],
    ['Route Technician',     'Complete Receiver'],
    ['Possession Target',    'Sure Hands'],
    ['Chain Mover',          'Contested Catch King'],
  ],
  TE: [
    ['Seam Stretcher',       'Receiving Weapon'],
    ['Move Tight End',       'Red Zone Target'],
    ['Complete Tight End',   'Versatile Weapon'],
    ['Y-Tight End',          'In-Line Blocker'],
    ['Road Grader',          'Mauler'],
  ],
  OL: [
    ['Pancake Machine',      'Power Mauler'],
    ['Road Grader',          'Drive Blocker'],
    ['Complete Lineman',     'Anchor'],
    ['Pass Protector',       'Technician'],
    ['Wall Specialist',      'Finesse Blocker'],
  ],
  DE: [
    ['Speed Rusher',         'Edge Burner'],
    ['Bend Specialist',      'Edge Rusher'],
    ['Complete End',         'Versatile Edge'],
    ['Power End',            'Bull Rusher'],
    ['Run Stuffer',          'Anchor End'],
  ],
  DT: [
    ['Space Eater',          'Immovable Object'],
    ['Interior Anchor',      'Nose Tackle'],
    ['Two-Gap Defender',     'Complete Interior'],
    ['Disruptor',            'Penetrator'],
    ['Quick Twitch',         'Interior Menace'],
  ],
  LB: [
    ['Coverage Backer',      'Rangefinder'],
    ['Sideline-to-Sideline', 'Pursuit Specialist'],
    ['Complete Linebacker',  'Field General'],
    ['Downhill Thumper',     'Sure Tackler'],
    ['Run Stopper',          'Enforcer'],
  ],
  CB: [
    ['Press Specialist',     'Shutdown Speed'],
    ['Lockdown Corner',      'Trail Specialist'],
    ['Complete Corner',      'Versatile Cover Man'],
    ['Ball Hawk',            'Zone Reader'],
    ['Coverage Technician',  'Instinct Player'],
  ],
  S: [
    ['Box Safety',           'Enforcer'],
    ['Hard Hitter',          'Run Support'],
    ['Complete Safety',      'Two-Way Player'],
    ['Center Fielder',       'Playmaker'],
    ['Deep Safety',          'Ball Hawk'],
  ],
};

// Deterministic seed from id — same algorithm as the legacy playerSeed.
export function idSeed(id: string): number {
  return [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
}

// stat1-vs-stat2 spread → tier bucket. Same thresholds across positions.
export function archetypeTier(stat1: number, stat2: number): 0 | 1 | 2 | 3 | 4 {
  const diff = stat1 - stat2;
  if (diff >= 10) return 0;
  if (diff >= 3)  return 1;
  if (diff > -3)  return 2;
  if (diff > -10) return 3;
  return 4;
}

export function personnelArchetype(p: { id: string; position: string; stat1: number; stat2: number }): string {
  const table = ARCHETYPES[p.position];
  if (!table) return 'Balanced Contributor';
  const tier = archetypeTier(p.stat1, p.stat2);
  const variants = table[tier];
  return variants[idSeed(p.id) % variants.length];
}

// ── Forward-lookup helpers (replace old reverse-parsing of a stored string).
// Used by the offseason to nudge team style to match the coordinator's lean.
export function offenseStyleForOC(stat1: number, stat2: number): 'PASS_HEAVY' | 'RUN_HEAVY' | 'BALANCED' {
  const tier = archetypeTier(stat1, stat2);
  if (tier <= 1) return 'PASS_HEAVY';
  if (tier >= 3) return 'RUN_HEAVY';
  return 'BALANCED';
}

export function defenseStyleForDC(stat1: number, stat2: number): 'AGGRESSIVE' | 'PREVENT' | 'BALANCED' {
  const tier = archetypeTier(stat1, stat2);
  if (tier <= 1) return 'PREVENT';     // run-defense dominant
  if (tier === 4) return 'AGGRESSIVE'; // very pass-defense dominant
  return 'BALANCED';
}
