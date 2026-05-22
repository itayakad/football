// Canonical fixture data for the Play table. Edit this file to add or change
// plays in the catalog, then run `npm run seed` to upsert into the DB. The
// runtime catalog lives in the DB — this file is consulted only by seed.ts.

import type {
  DefensiveCategory,
  OffensiveCategory,
  PlayerSlot,
} from './playLibrary';

export interface OffensivePlaySeed {
  id: string;
  name: string;
  unit: 'offense';
  category: OffensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export interface DefensivePlaySeed {
  id: string;
  name: string;
  unit: 'defense';
  category: DefensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export type PlaySeed = OffensivePlaySeed | DefensivePlaySeed;

const o = (id: string, name: string, category: OffensiveCategory, keySlots: [PlayerSlot, PlayerSlot, PlayerSlot]): OffensivePlaySeed => ({
  id, name, unit: 'offense', category, keySlots,
});

const d = (id: string, name: string, category: DefensiveCategory, keySlots: [PlayerSlot, PlayerSlot, PlayerSlot]): DefensivePlaySeed => ({
  id, name, unit: 'defense', category, keySlots,
});

export const OFFENSIVE_PLAY_SEED: OffensivePlaySeed[] = [
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
  o('four_verticals', 'Four Verts',     'LONG_PASS', ['QB', 'WR', 'T']),
  o('post_wheel',     'Post-Wheel',     'LONG_PASS', ['QB', 'WR', 'RB']),
  o('sail',           'Sail',           'LONG_PASS', ['QB', 'WR', 'TE']),
  o('air_six',        'Air Six',        'LONG_PASS', ['QB', 'WR', 'T']),
  o('pa_crossers',    'PA Crossers',    'LONG_PASS', ['QB', 'WR', 'WR']),
  o('take_shot',      'Take Shot',      'LONG_PASS', ['QB', 'WR', 'WR']),
];

export const DEFENSIVE_PLAY_SEED: DefensivePlaySeed[] = [
  // ZONE (6) — safeties + linebackers
  d('cover_2',         'Cover 2',             'ZONE', ['FS',  'SS',  'MLB']),
  d('cover_3',         'Cover 3',             'ZONE', ['FS',  'MLB', 'CB1']),
  d('cover_4',         'Cover 4 Quarters',    'ZONE', ['FS',  'SS',  'CB1']),
  d('cover_6',         'Cover 6',             'ZONE', ['FS',  'SS',  'CB2']),
  d('tampa_2',         'Tampa 2',             'ZONE', ['FS',  'MLB', 'SS']),
  d('cover_3_cloud',   'Cover 3 Cloud',       'ZONE', ['CB1', 'FS',  'MLB']),

  // BLITZ (6) — pure pressure
  d('edge_blitz',      'Edge Blitz',          'BLITZ', ['EDGE1', 'EDGE2', 'MLB']),
  d('inside_blitz',    'Inside Blitz',        'BLITZ', ['DT1',   'MLB',   'WLB']),
  d('safety_blitz',    'Safety Blitz',        'BLITZ', ['SS',    'MLB',   'EDGE1']),
  d('cover_0_blitz',   'Cover 0 Blitz',       'BLITZ', ['MLB',   'EDGE1', 'CB1']),
  d('slot_blitz',      'Slot Blitz',          'BLITZ', ['NCB',   'MLB',   'EDGE1']),
  d('double_a_gap',    'Double-A Gap',        'BLITZ', ['MLB',   'WLB',   'DT1']),

  // ZONE BLITZ (6) — pressure with zone drop
  d('fire_zone',       'Fire Zone',           'ZONE_BLITZ', ['MLB', 'EDGE1', 'FS']),
  d('ncaa_blitz',      'NCAA Blitz',          'ZONE_BLITZ', ['WLB', 'EDGE2', 'SS']),
  d('cross_dog',       'Cross Dog',           'ZONE_BLITZ', ['MLB', 'WLB',   'DT1']),
  d('five_under',      'Five Under',          'ZONE_BLITZ', ['NCB', 'MLB',   'FS']),
  d('three_deep_pres', 'Three-Deep Pressure', 'ZONE_BLITZ', ['EDGE1', 'MLB', 'CB1']),
  d('sim_pressure',    'Sim Pressure',        'ZONE_BLITZ', ['WLB', 'DT1',   'FS']),

  // MAN (6) — coverage-first
  d('cover_1',         'Cover 1',             'MAN', ['CB1', 'CB2', 'FS']),
  d('cover_1_robber',  'Cover 1 Robber',      'MAN', ['CB1', 'SS',  'MLB']),
  d('cover_2_man',     'Cover 2 Man',         'MAN', ['CB1', 'CB2', 'FS']),
  d('cover_0_man',     'Cover 0 Man',         'MAN', ['CB1', 'CB2', 'MLB']),
  d('match_man',       'Match Man',           'MAN', ['NCB', 'CB1', 'MLB']),
  d('press_man',       'Press Man',           'MAN', ['CB1', 'CB2', 'EDGE1']),
];

export const ALL_PLAY_SEED: PlaySeed[] = [...OFFENSIVE_PLAY_SEED, ...DEFENSIVE_PLAY_SEED];
