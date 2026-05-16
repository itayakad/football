// Shared library of every play in the game. Teams pick 9 offensive + 9
// defensive plays from these lists. The category distribution within a team's
// 9-play loadout drives playcalling tendency (not raw strength).

export type OffensiveCategory = 'RUNNING' | 'SHORT_PASS' | 'MIDDLE_PASS' | 'LONG_PASS';
export type DefensiveCategory = 'ZONE' | 'BLITZ' | 'ZONE_BLITZ' | 'MAN';
export type PlayCategory = OffensiveCategory | DefensiveCategory;
export type PlayUnit = 'offense' | 'defense';

// Stable slot identifiers — resolved against a roster at sim time. Each team
// gets one player mapped to each slot (best at the position, ranked by overall).
export type PlayerSlot =
  | 'QB' | 'RB' | 'WR' | 'TE'
  | 'T' | 'G' | 'C'
  | 'EDGE1' | 'EDGE2' | 'DT1' | 'DT2'
  | 'MLB' | 'WLB' | 'SLB'
  | 'CB1' | 'CB2' | 'NCB' | 'FS' | 'SS';

export interface OffensivePlay {
  id: string;
  name: string;
  unit: 'offense';
  category: OffensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export interface DefensivePlay {
  id: string;
  name: string;
  unit: 'defense';
  category: DefensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export type Play = OffensivePlay | DefensivePlay;

// UI border color per category — drives instant visual recognition in the playbook.
export const CATEGORY_COLOR: Record<PlayCategory, string> = {
  RUNNING:     '#22C55E', // green
  SHORT_PASS:  '#38BDF8', // sky blue
  MIDDLE_PASS: '#FACC15', // amber
  LONG_PASS:   '#F97316', // orange
  ZONE:        '#3B82F6', // blue
  BLITZ:       '#EF4444', // red
  ZONE_BLITZ:  '#A855F7', // purple
  MAN:         '#14B8A6', // teal
};

export const CATEGORY_LABEL: Record<PlayCategory, string> = {
  RUNNING:     'Running',
  SHORT_PASS:  'Short Pass',
  MIDDLE_PASS: 'Middle Pass',
  LONG_PASS:   'Long Pass',
  ZONE:        'Zone',
  BLITZ:       'Blitz',
  ZONE_BLITZ:  'Zone Blitz',
  MAN:         'Man',
};

export const OFFENSIVE_CATEGORIES: OffensiveCategory[] = ['RUNNING', 'SHORT_PASS', 'MIDDLE_PASS', 'LONG_PASS'];
export const DEFENSIVE_CATEGORIES: DefensiveCategory[] = ['ZONE', 'BLITZ', 'ZONE_BLITZ', 'MAN'];

// ── Matchup matrix ────────────────────────────────────────
//                 ZONE  BLITZ  ZONE_BLITZ  MAN
//  RUNNING         0     +1      -1         0
//  SHORT_PASS      0      0      +1        -1
//  MIDDLE_PASS    +1     -1       0         0
//  LONG_PASS      -1      0       0        +1
export const MATCHUP_MATRIX: Record<OffensiveCategory, Record<DefensiveCategory, -1 | 0 | 1>> = {
  RUNNING:     { ZONE: 0,  BLITZ: 1,  ZONE_BLITZ: -1, MAN: 0  },
  SHORT_PASS:  { ZONE: 0,  BLITZ: 0,  ZONE_BLITZ: 1,  MAN: -1 },
  MIDDLE_PASS: { ZONE: 1,  BLITZ: -1, ZONE_BLITZ: 0,  MAN: 0  },
  LONG_PASS:   { ZONE: -1, BLITZ: 0,  ZONE_BLITZ: 0,  MAN: 1  },
};

export const MATCHUP_MULTIPLIER = { favorable: 1.25, neutral: 1.0, unfavorable: 0.75 } as const;

export function offensiveMatchupMod(off: OffensiveCategory, def: DefensiveCategory): number {
  const v = MATCHUP_MATRIX[off][def];
  return v === 1 ? MATCHUP_MULTIPLIER.favorable : v === -1 ? MATCHUP_MULTIPLIER.unfavorable : MATCHUP_MULTIPLIER.neutral;
}

export function defensiveMatchupMod(off: OffensiveCategory, def: DefensiveCategory): number {
  const v = MATCHUP_MATRIX[off][def];
  // Defense favored when offense is at -1 in matrix (def category counters offense).
  return v === -1 ? MATCHUP_MULTIPLIER.favorable : v === 1 ? MATCHUP_MULTIPLIER.unfavorable : MATCHUP_MULTIPLIER.neutral;
}

// ── Play library ──────────────────────────────────────────

const o = (id: string, name: string, category: OffensiveCategory, keySlots: [PlayerSlot, PlayerSlot, PlayerSlot]): OffensivePlay => ({
  id, name, unit: 'offense', category, keySlots,
});

const d = (id: string, name: string, category: DefensiveCategory, keySlots: [PlayerSlot, PlayerSlot, PlayerSlot]): DefensivePlay => ({
  id, name, unit: 'defense', category, keySlots,
});

export const OFFENSIVE_PLAYS: OffensivePlay[] = [
  // RUNNING (6) — RB + OL slots dominate base strength
  o('inside_zone',    'Inside Zone',    'RUNNING', ['RB',  'G', 'C']),
  o('outside_zone',   'Outside Zone',   'RUNNING', ['RB',  'T', 'G']),
  o('power',          'Power',          'RUNNING', ['RB',  'G', 'T']),
  o('counter',        'Counter',        'RUNNING', ['RB',  'G', 'T']),
  o('lead_iso',       'Lead Iso',       'RUNNING', ['RB',  'C', 'G']),
  o('toss_sweep',     'Toss Sweep',     'RUNNING', ['RB',  'T', 'WR']),

  // SHORT PASS (6) — QB + underneath route runners
  o('slants',         'Slants',         'SHORT_PASS', ['QB', 'WR', 'WR']),
  o('stick',          'Stick',          'SHORT_PASS', ['QB', 'TE', 'WR']),
  o('mesh',           'Mesh',           'SHORT_PASS', ['QB', 'WR', 'WR']),
  o('quick_out',      'Quick Out',      'SHORT_PASS', ['QB', 'WR', 'WR']),
  o('bubble_screen',  'Bubble Screen',  'SHORT_PASS', ['QB', 'WR', 'G']),
  o('hitch',          'Hitch',          'SHORT_PASS', ['QB', 'WR', 'TE']),

  // MIDDLE PASS (6) — QB + intermediate threats
  o('levels',         'Levels',         'MIDDLE_PASS', ['QB', 'WR', 'TE']),
  o('y_cross',        'Y-Cross',        'MIDDLE_PASS', ['QB', 'TE', 'WR']),
  o('drive',          'Drive',          'MIDDLE_PASS', ['QB', 'WR', 'WR']),
  o('curl_flat',      'Curl Flat',      'MIDDLE_PASS', ['QB', 'WR', 'RB']),
  o('pa_boot',        'PA Boot',        'MIDDLE_PASS', ['QB', 'TE', 'RB']),
  o('snag',           'Snag',           'MIDDLE_PASS', ['QB', 'WR', 'WR']),

  // LONG PASS (6) — QB + deep threats + protection
  o('four_verticals', 'Four Verticals', 'LONG_PASS', ['QB', 'WR', 'T']),
  o('post_wheel',     'Post-Wheel',     'LONG_PASS', ['QB', 'WR', 'RB']),
  o('sail',           'Sail',           'LONG_PASS', ['QB', 'WR', 'TE']),
  o('air_six',        'Air Six',        'LONG_PASS', ['QB', 'WR', 'T']),
  o('pa_crossers',    'PA Crossers',    'LONG_PASS', ['QB', 'WR', 'WR']),
  o('take_shot',      'Take Shot',      'LONG_PASS', ['QB', 'WR', 'WR']),
];

export const DEFENSIVE_PLAYS: DefensivePlay[] = [
  // ZONE (6) — safeties + linebackers
  d('cover_2',         'Cover 2',         'ZONE', ['FS',  'SS',  'MLB']),
  d('cover_3',         'Cover 3',         'ZONE', ['FS',  'MLB', 'CB1']),
  d('cover_4',         'Cover 4 Quarters','ZONE', ['FS',  'SS',  'CB1']),
  d('cover_6',         'Cover 6',         'ZONE', ['FS',  'SS',  'CB2']),
  d('tampa_2',         'Tampa 2',         'ZONE', ['FS',  'MLB', 'SS']),
  d('cover_3_cloud',   'Cover 3 Cloud',   'ZONE', ['CB1', 'FS',  'MLB']),

  // BLITZ (6) — pure pressure
  d('edge_blitz',      'Edge Blitz',      'BLITZ', ['EDGE1', 'EDGE2', 'MLB']),
  d('inside_blitz',    'Inside Blitz',    'BLITZ', ['DT1',   'MLB',   'WLB']),
  d('safety_blitz',    'Safety Blitz',    'BLITZ', ['SS',    'MLB',   'EDGE1']),
  d('cover_0_blitz',   'Cover 0 Blitz',   'BLITZ', ['MLB',   'EDGE1', 'CB1']),
  d('slot_blitz',      'Slot Blitz',      'BLITZ', ['NCB',   'MLB',   'EDGE1']),
  d('double_a_gap',    'Double-A Gap',    'BLITZ', ['MLB',   'WLB',   'DT1']),

  // ZONE BLITZ (6) — pressure with zone drop
  d('fire_zone',       'Fire Zone',       'ZONE_BLITZ', ['MLB', 'EDGE1', 'FS']),
  d('ncaa_blitz',      'NCAA Blitz',      'ZONE_BLITZ', ['WLB', 'EDGE2', 'SS']),
  d('cross_dog',       'Cross Dog',       'ZONE_BLITZ', ['MLB', 'WLB',   'DT1']),
  d('five_under',      'Five Under',      'ZONE_BLITZ', ['NCB', 'MLB',   'FS']),
  d('three_deep_pres', 'Three-Deep Pressure', 'ZONE_BLITZ', ['EDGE1', 'MLB', 'CB1']),
  d('sim_pressure',    'Sim Pressure',    'ZONE_BLITZ', ['WLB', 'DT1',   'FS']),

  // MAN (6) — coverage-first
  d('cover_1',         'Cover 1',         'MAN', ['CB1', 'CB2', 'FS']),
  d('cover_1_robber',  'Cover 1 Robber',  'MAN', ['CB1', 'SS',  'MLB']),
  d('cover_2_man',     'Cover 2 Man',     'MAN', ['CB1', 'CB2', 'FS']),
  d('cover_0_man',     'Cover 0 Man',     'MAN', ['CB1', 'CB2', 'MLB']),
  d('match_man',       'Match Man',       'MAN', ['NCB', 'CB1', 'MLB']),
  d('press_man',       'Press Man',       'MAN', ['CB1', 'CB2', 'EDGE1']),
];

export const ALL_PLAYS: Play[] = [...OFFENSIVE_PLAYS, ...DEFENSIVE_PLAYS];

const PLAY_BY_ID = new Map<string, Play>(ALL_PLAYS.map((p) => [p.id, p]));

export function playById(id: string): Play | undefined {
  return PLAY_BY_ID.get(id);
}

export function offensivePlayById(id: string): OffensivePlay | undefined {
  const p = PLAY_BY_ID.get(id);
  return p?.unit === 'offense' ? p : undefined;
}

export function defensivePlayById(id: string): DefensivePlay | undefined {
  const p = PLAY_BY_ID.get(id);
  return p?.unit === 'defense' ? p : undefined;
}

export function playsForUnit(unit: PlayUnit): Play[] {
  return unit === 'offense' ? OFFENSIVE_PLAYS : DEFENSIVE_PLAYS;
}

// Coerce arbitrary input into exactly 9 valid play IDs of the given unit,
// padding with defaults if needed.
export function normalizePlayLoadout(unit: PlayUnit, raw: unknown): string[] {
  const lib = playsForUnit(unit);
  const validIds = new Set(lib.map((p) => p.id));
  const incoming = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of incoming) {
    if (typeof id !== 'string' || !validIds.has(id) || seen.has(id)) continue;
    out.push(id);
    seen.add(id);
    if (out.length === 9) break;
  }
  // Pad with library defaults if user supplied fewer than 9.
  for (const p of lib) {
    if (out.length === 9) break;
    if (!seen.has(p.id)) { out.push(p.id); seen.add(p.id); }
  }
  return out;
}

// Default 9-play loadout: balanced category distribution (2-2-3-2 / 2-2-3-2).
export function defaultLoadout(unit: PlayUnit): string[] {
  const cats: PlayCategory[] = unit === 'offense'
    ? ['RUNNING', 'SHORT_PASS', 'MIDDLE_PASS', 'LONG_PASS']
    : ['ZONE', 'BLITZ', 'ZONE_BLITZ', 'MAN'];
  const distribution = [3, 2, 2, 2]; // 9 total
  const lib = playsForUnit(unit);
  const out: string[] = [];
  cats.forEach((cat, idx) => {
    const fromCat = lib.filter((p) => p.category === cat).slice(0, distribution[idx]);
    out.push(...fromCat.map((p) => p.id));
  });
  return out;
}

export function categoryCounts(unit: PlayUnit, playIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of playIds) {
    const p = PLAY_BY_ID.get(id);
    if (!p || p.unit !== unit) continue;
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}
