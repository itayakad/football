export type SchemeUnit = 'offense' | 'defense';

export type PlayFamily =
  | 'RUN_MIDDLE'
  | 'RUN_WIDE'
  | 'QUICK_PASS'
  | 'INTERMEDIATE_PASS'
  | 'DEEP_PASS'
  | 'PLAY_ACTION'
  | 'MISDIRECTION'
  | 'ZONE_COVERAGE'
  | 'MAN_COVERAGE'
  | 'BLITZ'
  | 'RUN_FIT'
  | 'CONTAIN';

export interface DiagramPath {
  label: string;
  color: string;
  points: Array<[number, number]>;
}

export interface PlayTemplate {
  id: string;
  unit: SchemeUnit;
  name: string;
  family: PlayFamily;
  tags: string[];
  diagram: DiagramPath[];
}

export const OFFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  offense('mesh', 'Mesh', 'QUICK_PASS', ['quick', 'middle', 'underneath'], [
    path('WR', '#38BDF8', [[12, 72], [38, 48], [72, 48]]),
    path('TE', '#FACC15', [[88, 72], [62, 50], [28, 50]]),
    path('RB', '#22C55E', [[50, 78], [45, 64], [35, 58]]),
  ]),
  offense('four_verticals', 'Four Verticals', 'DEEP_PASS', ['deep', 'vertical', 'shot'], [
    path('X', '#38BDF8', [[14, 76], [14, 34], [18, 12]]),
    path('Z', '#38BDF8', [[86, 76], [86, 34], [82, 12]]),
    path('Y', '#FACC15', [[38, 76], [38, 28], [42, 10]]),
    path('F', '#FACC15', [[62, 76], [62, 28], [58, 10]]),
  ]),
  offense('flood', 'Flood', 'INTERMEDIATE_PASS', ['zone', 'sideline', 'levels'], [
    path('Go', '#38BDF8', [[84, 76], [84, 24], [78, 12]]),
    path('Out', '#FACC15', [[56, 76], [62, 50], [82, 50]]),
    path('Flat', '#22C55E', [[46, 78], [62, 66], [84, 66]]),
  ]),
  offense('levels', 'Levels', 'INTERMEDIATE_PASS', ['middle', 'rhythm'], [
    path('Dig', '#38BDF8', [[18, 76], [26, 46], [72, 46]]),
    path('Sit', '#FACC15', [[52, 76], [52, 56], [48, 54]]),
    path('Drive', '#22C55E', [[82, 76], [68, 60], [32, 60]]),
  ]),
  offense('slants_flats', 'Slants Flats', 'QUICK_PASS', ['quick', 'edge', 'underneath'], [
    path('Slant', '#38BDF8', [[18, 76], [38, 58], [54, 54]]),
    path('Flat', '#22C55E', [[42, 78], [28, 68], [12, 66]]),
    path('Slant', '#FACC15', [[82, 76], [62, 58], [46, 54]]),
  ]),
  offense('pa_crossers', 'PA Crossers', 'PLAY_ACTION', ['play_action', 'crossing', 'deep'], [
    path('Run fake', '#A3E635', [[50, 82], [45, 70], [50, 62]]),
    path('Crosser', '#38BDF8', [[18, 76], [34, 48], [78, 42]]),
    path('Over', '#FACC15', [[82, 76], [64, 42], [20, 34]]),
  ]),
  offense('hb_stretch', 'HB Stretch', 'RUN_WIDE', ['wide_run', 'edge', 'outside_zone'], [
    path('HB', '#22C55E', [[50, 82], [58, 72], [78, 64], [92, 58]]),
    path('OL', '#FACC15', [[38, 70], [54, 66], [72, 62]]),
  ]),
  offense('power_run', 'Power Run', 'RUN_MIDDLE', ['inside_run', 'power', 'physical'], [
    path('HB', '#22C55E', [[50, 82], [48, 70], [48, 54]]),
    path('Pull', '#FACC15', [[36, 72], [48, 66], [58, 56]]),
  ]),
  offense('counter', 'Counter', 'MISDIRECTION', ['inside_run', 'misdirection'], [
    path('False step', '#A3E635', [[50, 82], [58, 76], [52, 70], [38, 56]]),
    path('Pull', '#FACC15', [[66, 72], [52, 66], [38, 58]]),
  ]),
];

export const DEFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  defense('zone_match', 'Zone Match', 'ZONE_COVERAGE', ['zone', 'match', 'crossers'], [
    path('Hook', '#38BDF8', [[28, 42], [28, 28], [42, 24]]),
    path('Hook', '#38BDF8', [[72, 42], [72, 28], [58, 24]]),
    path('Safety', '#FACC15', [[50, 24], [50, 10]]),
  ]),
  defense('robber_coverage', 'Robber Coverage', 'MAN_COVERAGE', ['robber', 'middle', 'man'], [
    path('Robber', '#FACC15', [[50, 30], [50, 46], [42, 52]]),
    path('Man', '#38BDF8', [[20, 36], [20, 58]]),
    path('Man', '#38BDF8', [[80, 36], [80, 58]]),
  ]),
  defense('deep_quarters', 'Deep Quarters', 'ZONE_COVERAGE', ['deep', 'quarters', 'shell'], [
    path('Q1', '#38BDF8', [[15, 34], [15, 12], [32, 12]]),
    path('Q2', '#38BDF8', [[38, 30], [38, 10], [50, 10]]),
    path('Q3', '#38BDF8', [[62, 30], [62, 10], [50, 10]]),
    path('Q4', '#38BDF8', [[85, 34], [85, 12], [68, 12]]),
  ]),
  defense('man_blitz', 'Man Blitz', 'BLITZ', ['man', 'pressure', 'blitz'], [
    path('Edge', '#EF4444', [[32, 42], [42, 62], [48, 74]]),
    path('LB', '#EF4444', [[58, 42], [54, 62], [50, 74]]),
    path('Man', '#38BDF8', [[20, 34], [18, 60]]),
  ]),
  defense('contain_edges', 'Contain Edges', 'CONTAIN', ['edge', 'contain', 'wide_run'], [
    path('Edge', '#F97316', [[18, 50], [10, 62], [8, 76]]),
    path('Edge', '#F97316', [[82, 50], [90, 62], [92, 76]]),
    path('Spill', '#FACC15', [[50, 48], [50, 66]]),
  ]),
  defense('force_underneath', 'Force Underneath', 'ZONE_COVERAGE', ['underneath', 'soft', 'limit_explosive'], [
    path('Cloud', '#38BDF8', [[18, 34], [22, 20], [44, 22]]),
    path('Cloud', '#38BDF8', [[82, 34], [78, 20], [56, 22]]),
    path('Hook', '#FACC15', [[50, 42], [50, 54]]),
  ]),
  defense('stacked_front', 'Stacked Front', 'RUN_FIT', ['inside_run', 'front', 'box'], [
    path('A gap', '#EF4444', [[44, 42], [44, 64]]),
    path('A gap', '#EF4444', [[56, 42], [56, 64]]),
    path('Safety fit', '#FACC15', [[50, 30], [50, 52]]),
  ]),
  defense('run_blitz', 'Run Blitz', 'BLITZ', ['run_fit', 'pressure', 'inside_run'], [
    path('Mike', '#EF4444', [[50, 38], [48, 58], [48, 74]]),
    path('Will', '#EF4444', [[38, 42], [42, 60], [46, 70]]),
    path('Sam', '#EF4444', [[62, 42], [58, 60], [54, 70]]),
  ]),
  defense('cover_2_shell', 'Cover 2 Shell', 'ZONE_COVERAGE', ['two_high', 'sideline', 'shell'], [
    path('Half', '#38BDF8', [[28, 30], [24, 12], [48, 10]]),
    path('Half', '#38BDF8', [[72, 30], [76, 12], [52, 10]]),
    path('Flat', '#FACC15', [[16, 44], [12, 56]]),
    path('Flat', '#FACC15', [[84, 44], [88, 56]]),
  ]),
];

export const PLAY_TEMPLATES = [...OFFENSE_PLAY_TEMPLATES, ...DEFENSE_PLAY_TEMPLATES];

export function templatesForUnit(unit: SchemeUnit): PlayTemplate[] {
  return unit === 'offense' ? OFFENSE_PLAY_TEMPLATES : DEFENSE_PLAY_TEMPLATES;
}

export function defaultPlaysForUnit(unit: SchemeUnit): string[] {
  return templatesForUnit(unit).slice(0, 9).map((play) => play.id);
}

export function normalizeSchemeUnit(value: unknown): SchemeUnit | null {
  return value === 'offense' || value === 'defense' ? value : null;
}

export function normalizePlayIds(unit: SchemeUnit, value: unknown): string[] {
  const valid = new Set(templatesForUnit(unit).map((play) => play.id));
  const incoming = Array.isArray(value) ? value : [];
  const ids: string[] = [];
  for (const item of incoming) {
    if (typeof item === 'string' && valid.has(item) && !ids.includes(item)) ids.push(item);
  }
  for (const fallback of defaultPlaysForUnit(unit)) {
    if (!ids.includes(fallback)) ids.push(fallback);
  }
  return ids.slice(0, 9);
}

export function playTemplateById(id: string): PlayTemplate | undefined {
  return PLAY_TEMPLATES.find((play) => play.id === id);
}

function offense(id: string, name: string, family: PlayFamily, tags: string[], diagram: DiagramPath[]): PlayTemplate {
  return { id, name, unit: 'offense', family, tags, diagram };
}

function defense(id: string, name: string, family: PlayFamily, tags: string[], diagram: DiagramPath[]): PlayTemplate {
  return { id, name, unit: 'defense', family, tags, diagram };
}

function path(label: string, color: string, points: Array<[number, number]>): DiagramPath {
  return { label, color, points };
}
