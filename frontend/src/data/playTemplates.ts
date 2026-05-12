import { PlayTemplate, SchemeUnit } from '../api/types';

export const OFFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  play('mesh', 'offense', 'Mesh', 'QUICK_PASS', ['quick', 'middle', 'underneath'], [['WR', '#38BDF8', [[12, 72], [38, 48], [72, 48]]], ['TE', '#FACC15', [[88, 72], [62, 50], [28, 50]]], ['RB', '#22C55E', [[50, 78], [45, 64], [35, 58]]]]),
  play('four_verticals', 'offense', 'Four Verticals', 'DEEP_PASS', ['deep', 'vertical', 'shot'], [['X', '#38BDF8', [[14, 76], [14, 34], [18, 12]]], ['Z', '#38BDF8', [[86, 76], [86, 34], [82, 12]]], ['Y', '#FACC15', [[38, 76], [38, 28], [42, 10]]], ['F', '#FACC15', [[62, 76], [62, 28], [58, 10]]]]),
  play('flood', 'offense', 'Flood', 'INTERMEDIATE_PASS', ['zone', 'sideline', 'levels'], [['Go', '#38BDF8', [[84, 76], [84, 24], [78, 12]]], ['Out', '#FACC15', [[56, 76], [62, 50], [82, 50]]], ['Flat', '#22C55E', [[46, 78], [62, 66], [84, 66]]]]),
  play('levels', 'offense', 'Levels', 'INTERMEDIATE_PASS', ['middle', 'rhythm'], [['Dig', '#38BDF8', [[18, 76], [26, 46], [72, 46]]], ['Sit', '#FACC15', [[52, 76], [52, 56], [48, 54]]], ['Drive', '#22C55E', [[82, 76], [68, 60], [32, 60]]]]),
  play('slants_flats', 'offense', 'Slants Flats', 'QUICK_PASS', ['quick', 'edge', 'underneath'], [['Slant', '#38BDF8', [[18, 76], [38, 58], [54, 54]]], ['Flat', '#22C55E', [[42, 78], [28, 68], [12, 66]]], ['Slant', '#FACC15', [[82, 76], [62, 58], [46, 54]]]]),
  play('pa_crossers', 'offense', 'PA Crossers', 'PLAY_ACTION', ['play_action', 'crossing', 'deep'], [['Fake', '#A3E635', [[50, 82], [45, 70], [50, 62]]], ['Cross', '#38BDF8', [[18, 76], [34, 48], [78, 42]]], ['Over', '#FACC15', [[82, 76], [64, 42], [20, 34]]]]),
  play('hb_stretch', 'offense', 'HB Stretch', 'RUN_WIDE', ['wide_run', 'edge', 'outside_zone'], [['HB', '#22C55E', [[50, 82], [58, 72], [78, 64], [92, 58]]], ['OL', '#FACC15', [[38, 70], [54, 66], [72, 62]]]]),
  play('power_run', 'offense', 'Power Run', 'RUN_MIDDLE', ['inside_run', 'power', 'physical'], [['HB', '#22C55E', [[50, 82], [48, 70], [48, 54]]], ['Pull', '#FACC15', [[36, 72], [48, 66], [58, 56]]]]),
  play('counter', 'offense', 'Counter', 'MISDIRECTION', ['inside_run', 'misdirection'], [['Step', '#A3E635', [[50, 82], [58, 76], [52, 70], [38, 56]]], ['Pull', '#FACC15', [[66, 72], [52, 66], [38, 58]]]]),
];

export const DEFENSE_PLAY_TEMPLATES: PlayTemplate[] = [
  play('zone_match', 'defense', 'Zone Match', 'ZONE_COVERAGE', ['zone', 'match', 'crossers'], [['Hook', '#38BDF8', [[28, 42], [28, 28], [42, 24]]], ['Hook', '#38BDF8', [[72, 42], [72, 28], [58, 24]]], ['Safety', '#FACC15', [[50, 24], [50, 10]]]]),
  play('robber_coverage', 'defense', 'Robber Coverage', 'MAN_COVERAGE', ['robber', 'middle', 'man'], [['Robber', '#FACC15', [[50, 30], [50, 46], [42, 52]]], ['Man', '#38BDF8', [[20, 36], [20, 58]]], ['Man', '#38BDF8', [[80, 36], [80, 58]]]]),
  play('deep_quarters', 'defense', 'Deep Quarters', 'ZONE_COVERAGE', ['deep', 'quarters', 'shell'], [['Q1', '#38BDF8', [[15, 34], [15, 12], [32, 12]]], ['Q2', '#38BDF8', [[38, 30], [38, 10], [50, 10]]], ['Q3', '#38BDF8', [[62, 30], [62, 10], [50, 10]]], ['Q4', '#38BDF8', [[85, 34], [85, 12], [68, 12]]]]),
  play('man_blitz', 'defense', 'Man Blitz', 'BLITZ', ['man', 'pressure', 'blitz'], [['Edge', '#EF4444', [[32, 42], [42, 62], [48, 74]]], ['LB', '#EF4444', [[58, 42], [54, 62], [50, 74]]], ['Man', '#38BDF8', [[20, 34], [18, 60]]]]),
  play('contain_edges', 'defense', 'Contain Edges', 'CONTAIN', ['edge', 'contain', 'wide_run'], [['Edge', '#F97316', [[18, 50], [10, 62], [8, 76]]], ['Edge', '#F97316', [[82, 50], [90, 62], [92, 76]]], ['Spill', '#FACC15', [[50, 48], [50, 66]]]]),
  play('force_underneath', 'defense', 'Force Underneath', 'ZONE_COVERAGE', ['underneath', 'soft', 'limit_explosive'], [['Cloud', '#38BDF8', [[18, 34], [22, 20], [44, 22]]], ['Cloud', '#38BDF8', [[82, 34], [78, 20], [56, 22]]], ['Hook', '#FACC15', [[50, 42], [50, 54]]]]),
  play('stacked_front', 'defense', 'Stacked Front', 'RUN_FIT', ['inside_run', 'front', 'box'], [['A', '#EF4444', [[44, 42], [44, 64]]], ['A', '#EF4444', [[56, 42], [56, 64]]], ['Safety', '#FACC15', [[50, 30], [50, 52]]]]),
  play('run_blitz', 'defense', 'Run Blitz', 'BLITZ', ['run_fit', 'pressure', 'inside_run'], [['Mike', '#EF4444', [[50, 38], [48, 58], [48, 74]]], ['Will', '#EF4444', [[38, 42], [42, 60], [46, 70]]], ['Sam', '#EF4444', [[62, 42], [58, 60], [54, 70]]]]),
  play('cover_2_shell', 'defense', 'Cover 2 Shell', 'ZONE_COVERAGE', ['two_high', 'sideline', 'shell'], [['Half', '#38BDF8', [[28, 30], [24, 12], [48, 10]]], ['Half', '#38BDF8', [[72, 30], [76, 12], [52, 10]]], ['Flat', '#FACC15', [[16, 44], [12, 56]]], ['Flat', '#FACC15', [[84, 44], [88, 56]]]]),
];

export const PLAY_TEMPLATES = [...OFFENSE_PLAY_TEMPLATES, ...DEFENSE_PLAY_TEMPLATES];

export function templatesForUnit(unit: SchemeUnit): PlayTemplate[] {
  return unit === 'offense' ? OFFENSE_PLAY_TEMPLATES : DEFENSE_PLAY_TEMPLATES;
}

function play(
  id: string,
  unit: SchemeUnit,
  name: string,
  family: PlayTemplate['family'],
  tags: string[],
  raw: Array<[string, string, Array<[number, number]>]>,
): PlayTemplate {
  return {
    id,
    unit,
    name,
    family,
    tags,
    diagram: raw.map(([label, color, points]) => ({ label, color, points })),
  };
}
