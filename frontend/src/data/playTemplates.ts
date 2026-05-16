import { PlayCategory, PlayTemplate, SchemeUnit } from '../api/types';

const CATEGORY_COLOR: Record<PlayCategory, string> = {
  RUNNING: '#22C55E',
  SHORT_PASS: '#38BDF8',
  MIDDLE_PASS: '#FACC15',
  LONG_PASS: '#F97316',
  ZONE: '#3B82F6',
  BLITZ: '#EF4444',
  ZONE_BLITZ: '#A855F7',
  MAN: '#14B8A6',
};

const CATEGORY_LABEL: Record<PlayCategory, string> = {
  RUNNING: 'Running',
  SHORT_PASS: 'Short Pass',
  MIDDLE_PASS: 'Middle Pass',
  LONG_PASS: 'Long Pass',
  ZONE: 'Zone',
  BLITZ: 'Blitz',
  ZONE_BLITZ: 'Zone Blitz',
  MAN: 'Man',
};

const offense = (id: string, name: string, category: PlayCategory, keySlots: string[]): PlayTemplate =>
  play(id, 'offense', name, category, keySlots);

const defense = (id: string, name: string, category: PlayCategory, keySlots: string[]): PlayTemplate =>
  play(id, 'defense', name, category, keySlots);

export const OFFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  offense('inside_zone', 'Inside Zone', 'RUNNING', ['RB', 'G', 'C']),
  offense('outside_zone', 'Outside Zone', 'RUNNING', ['RB', 'T', 'G']),
  offense('power', 'Power', 'RUNNING', ['RB', 'G', 'T']),
  offense('counter', 'Counter', 'RUNNING', ['RB', 'G', 'T']),
  offense('lead_iso', 'Lead Iso', 'RUNNING', ['RB', 'C', 'G']),
  offense('toss_sweep', 'Toss Sweep', 'RUNNING', ['RB', 'T', 'WR']),
  offense('slants', 'Slants', 'SHORT_PASS', ['QB', 'WR', 'WR']),
  offense('stick', 'Stick', 'SHORT_PASS', ['QB', 'TE', 'WR']),
  offense('mesh', 'Mesh', 'SHORT_PASS', ['QB', 'WR', 'WR']),
  offense('quick_out', 'Quick Out', 'SHORT_PASS', ['QB', 'WR', 'WR']),
  offense('bubble_screen', 'Bubble Screen', 'SHORT_PASS', ['QB', 'WR', 'G']),
  offense('hitch', 'Hitch', 'SHORT_PASS', ['QB', 'WR', 'TE']),
  offense('levels', 'Levels', 'MIDDLE_PASS', ['QB', 'WR', 'TE']),
  offense('y_cross', 'Y-Cross', 'MIDDLE_PASS', ['QB', 'TE', 'WR']),
  offense('drive', 'Drive', 'MIDDLE_PASS', ['QB', 'WR', 'WR']),
  offense('curl_flat', 'Curl Flat', 'MIDDLE_PASS', ['QB', 'WR', 'RB']),
  offense('pa_boot', 'PA Boot', 'MIDDLE_PASS', ['QB', 'TE', 'RB']),
  offense('snag', 'Snag', 'MIDDLE_PASS', ['QB', 'WR', 'WR']),
  offense('four_verticals', 'Four Verticals', 'LONG_PASS', ['QB', 'WR', 'T']),
  offense('post_wheel', 'Post-Wheel', 'LONG_PASS', ['QB', 'WR', 'RB']),
  offense('sail', 'Sail', 'LONG_PASS', ['QB', 'WR', 'TE']),
  offense('air_six', 'Air Six', 'LONG_PASS', ['QB', 'WR', 'T']),
  offense('pa_crossers', 'PA Crossers', 'LONG_PASS', ['QB', 'WR', 'WR']),
  offense('take_shot', 'Take Shot', 'LONG_PASS', ['QB', 'WR', 'WR']),
];

export const DEFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  defense('cover_2', 'Cover 2', 'ZONE', ['FS', 'SS', 'MLB']),
  defense('cover_3', 'Cover 3', 'ZONE', ['FS', 'MLB', 'CB1']),
  defense('cover_4', 'Cover 4 Quarters', 'ZONE', ['FS', 'SS', 'CB1']),
  defense('cover_6', 'Cover 6', 'ZONE', ['FS', 'SS', 'CB2']),
  defense('tampa_2', 'Tampa 2', 'ZONE', ['FS', 'MLB', 'SS']),
  defense('cover_3_cloud', 'Cover 3 Cloud', 'ZONE', ['CB1', 'FS', 'MLB']),
  defense('edge_blitz', 'Edge Blitz', 'BLITZ', ['EDGE1', 'EDGE2', 'MLB']),
  defense('inside_blitz', 'Inside Blitz', 'BLITZ', ['DT1', 'MLB', 'WLB']),
  defense('safety_blitz', 'Safety Blitz', 'BLITZ', ['SS', 'MLB', 'EDGE1']),
  defense('cover_0_blitz', 'Cover 0 Blitz', 'BLITZ', ['MLB', 'EDGE1', 'CB1']),
  defense('slot_blitz', 'Slot Blitz', 'BLITZ', ['NCB', 'MLB', 'EDGE1']),
  defense('double_a_gap', 'Double-A Gap', 'BLITZ', ['MLB', 'WLB', 'DT1']),
  defense('fire_zone', 'Fire Zone', 'ZONE_BLITZ', ['MLB', 'EDGE1', 'FS']),
  defense('ncaa_blitz', 'NCAA Blitz', 'ZONE_BLITZ', ['WLB', 'EDGE2', 'SS']),
  defense('cross_dog', 'Cross Dog', 'ZONE_BLITZ', ['MLB', 'WLB', 'DT1']),
  defense('five_under', 'Five Under', 'ZONE_BLITZ', ['NCB', 'MLB', 'FS']),
  defense('three_deep_pres', 'Three-Deep Pressure', 'ZONE_BLITZ', ['EDGE1', 'MLB', 'CB1']),
  defense('sim_pressure', 'Sim Pressure', 'ZONE_BLITZ', ['WLB', 'DT1', 'FS']),
  defense('cover_1', 'Cover 1', 'MAN', ['CB1', 'CB2', 'FS']),
  defense('cover_1_robber', 'Cover 1 Robber', 'MAN', ['CB1', 'SS', 'MLB']),
  defense('cover_2_man', 'Cover 2 Man', 'MAN', ['CB1', 'CB2', 'FS']),
  defense('cover_0_man', 'Cover 0 Man', 'MAN', ['CB1', 'CB2', 'MLB']),
  defense('match_man', 'Match Man', 'MAN', ['NCB', 'CB1', 'MLB']),
  defense('press_man', 'Press Man', 'MAN', ['CB1', 'CB2', 'EDGE1']),
];

export const PLAY_TEMPLATES = [...OFFENSE_PLAY_TEMPLATES, ...DEFENSE_PLAY_TEMPLATES];

export function templatesForUnit(unit: SchemeUnit): PlayTemplate[] {
  return unit === 'offense' ? OFFENSE_PLAY_TEMPLATES : DEFENSE_PLAY_TEMPLATES;
}

export function playById(id: string): PlayTemplate | undefined {
  return PLAY_TEMPLATES.find((playTemplate) => playTemplate.id === id);
}

function play(id: string, unit: SchemeUnit, name: string, category: PlayCategory, keySlots: string[]): PlayTemplate {
  return {
    id,
    unit,
    name,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    categoryColor: CATEGORY_COLOR[category],
    keySlots,
    tags: keySlots,
    diagram: [],
  };
}
