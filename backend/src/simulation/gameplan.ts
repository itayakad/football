import type { PositionGroups } from './positionGroups';
import { playTemplateById } from './playTemplates';

export type OffensiveConcept =
  | 'MESH'
  | 'FOUR_VERTICALS'
  | 'FLOOD'
  | 'LEVELS'
  | 'SLANTS_FLATS'
  | 'PA_CROSSERS'
  | 'HB_STRETCH'
  | 'POWER_RUN'
  | 'COUNTER';

export type DefensiveCounter =
  | 'ZONE_MATCH'
  | 'ROBBER_COVERAGE'
  | 'DEEP_QUARTERS'
  | 'MAN_BLITZ'
  | 'CONTAIN_EDGES'
  | 'FORCE_UNDERNEATH'
  | 'STACKED_FRONT'
  | 'RUN_BLITZ'
  | 'COVER_2_SHELL';

export type OffensivePhilosophy =
  | 'WEST_COAST'
  | 'VERTICAL_SPREAD'
  | 'SMASHMOUTH'
  | 'RPO_HEAVY'
  | 'QUICK_GAME'
  | 'PLAY_ACTION_HEAVY';

export type TempoOverride = 'SLOW_DOWN' | 'STANDARD' | 'PUSH_TEMPO';

export type ConceptSet = [OffensiveConcept, OffensiveConcept, OffensiveConcept];
export type CounterSet = [DefensiveCounter, DefensiveCounter, DefensiveCounter];

export interface Gameplan {
  offensiveConcepts: ConceptSet;
  defensiveCounters: CounterSet;
  tempoOverride: TempoOverride;
  offenseSchemeId?: string | null;
  defenseSchemeId?: string | null;
  offensivePlays?: string[];
  defensivePlays?: string[];
  offenseSchemeName?: string;
  defenseSchemeName?: string;
}

export interface ConceptEffect {
  scoringMod: number;
  varianceMod: number;
  explanations: string[];
  topInteraction: string;
}

export interface ConceptTeamProfile {
  offenseStyle: string;
  defenseStyle: string;
  tempo: string;
  morale?: number;
  offensivePhilosophy?: string | null;
  coaches?: Array<{
    role: string;
    philosophy: string;
    reputation: number;
    aggression?: number;
    developmentSpecialty?: string;
    preferredTempo?: string;
  }>;
}

export const OFFENSIVE_CONCEPTS: OffensiveConcept[] = [
  'MESH',
  'FOUR_VERTICALS',
  'FLOOD',
  'LEVELS',
  'SLANTS_FLATS',
  'PA_CROSSERS',
  'HB_STRETCH',
  'POWER_RUN',
  'COUNTER',
];

export const DEFENSIVE_COUNTERS: DefensiveCounter[] = [
  'ZONE_MATCH',
  'ROBBER_COVERAGE',
  'DEEP_QUARTERS',
  'MAN_BLITZ',
  'CONTAIN_EDGES',
  'FORCE_UNDERNEATH',
  'STACKED_FRONT',
  'RUN_BLITZ',
  'COVER_2_SHELL',
];

export const OFFENSIVE_PHILOSOPHIES: OffensivePhilosophy[] = [
  'WEST_COAST',
  'VERTICAL_SPREAD',
  'SMASHMOUTH',
  'RPO_HEAVY',
  'QUICK_GAME',
  'PLAY_ACTION_HEAVY',
];

export const TEMPO_OVERRIDES: TempoOverride[] = ['SLOW_DOWN', 'STANDARD', 'PUSH_TEMPO'];

export const DEFAULT_GAMEPLAN: Gameplan = {
  offensiveConcepts: ['MESH', 'LEVELS', 'HB_STRETCH'],
  defensiveCounters: ['ZONE_MATCH', 'FORCE_UNDERNEATH', 'STACKED_FRONT'],
  tempoOverride: 'STANDARD',
};

export const PHILOSOPHY_BY_STYLE: Record<string, OffensivePhilosophy> = {
  PASS_HEAVY: 'VERTICAL_SPREAD',
  RUN_HEAVY: 'SMASHMOUTH',
  BALANCED: 'WEST_COAST',
};

const WEIGHTS = [0.5, 0.3, 0.2] as const;

export const CONCEPT_MATCHUP_MATRIX: Record<OffensiveConcept, Record<DefensiveCounter, number>> = {
  MESH: {
    ZONE_MATCH: -1.1,
    ROBBER_COVERAGE: -0.9,
    DEEP_QUARTERS: 0.5,
    MAN_BLITZ: 1.6,
    CONTAIN_EDGES: 0.2,
    FORCE_UNDERNEATH: -0.4,
    STACKED_FRONT: 0.3,
    RUN_BLITZ: 1.2,
    COVER_2_SHELL: 0.7,
  },
  FOUR_VERTICALS: {
    ZONE_MATCH: -0.2,
    ROBBER_COVERAGE: 0.3,
    DEEP_QUARTERS: -1.5,
    MAN_BLITZ: -0.8,
    CONTAIN_EDGES: 0.1,
    FORCE_UNDERNEATH: 1.2,
    STACKED_FRONT: 0.5,
    RUN_BLITZ: 0.4,
    COVER_2_SHELL: 1.4,
  },
  FLOOD: {
    ZONE_MATCH: 0.2,
    ROBBER_COVERAGE: 0.4,
    DEEP_QUARTERS: 0.8,
    MAN_BLITZ: -0.2,
    CONTAIN_EDGES: 0.3,
    FORCE_UNDERNEATH: 0.5,
    STACKED_FRONT: 0.1,
    RUN_BLITZ: 0.2,
    COVER_2_SHELL: -0.8,
  },
  LEVELS: {
    ZONE_MATCH: -0.3,
    ROBBER_COVERAGE: -0.4,
    DEEP_QUARTERS: 0.8,
    MAN_BLITZ: 0.5,
    CONTAIN_EDGES: 0.1,
    FORCE_UNDERNEATH: -0.2,
    STACKED_FRONT: 0.2,
    RUN_BLITZ: 0.5,
    COVER_2_SHELL: 0.6,
  },
  SLANTS_FLATS: {
    ZONE_MATCH: -0.7,
    ROBBER_COVERAGE: -0.6,
    DEEP_QUARTERS: 0.7,
    MAN_BLITZ: 1.2,
    CONTAIN_EDGES: 0.3,
    FORCE_UNDERNEATH: -0.3,
    STACKED_FRONT: 0.4,
    RUN_BLITZ: 1.0,
    COVER_2_SHELL: 0.5,
  },
  PA_CROSSERS: {
    ZONE_MATCH: 0.1,
    ROBBER_COVERAGE: -0.5,
    DEEP_QUARTERS: 0.3,
    MAN_BLITZ: -0.7,
    CONTAIN_EDGES: -0.2,
    FORCE_UNDERNEATH: 1.0,
    STACKED_FRONT: 1.1,
    RUN_BLITZ: 0.6,
    COVER_2_SHELL: 0.4,
  },
  HB_STRETCH: {
    ZONE_MATCH: 0.3,
    ROBBER_COVERAGE: 0.2,
    DEEP_QUARTERS: 0.7,
    MAN_BLITZ: 0.4,
    CONTAIN_EDGES: -1.3,
    FORCE_UNDERNEATH: 0.5,
    STACKED_FRONT: -0.8,
    RUN_BLITZ: -0.7,
    COVER_2_SHELL: 1.0,
  },
  POWER_RUN: {
    ZONE_MATCH: 0.4,
    ROBBER_COVERAGE: 0.2,
    DEEP_QUARTERS: 1.1,
    MAN_BLITZ: 0.2,
    CONTAIN_EDGES: 0.3,
    FORCE_UNDERNEATH: 0.6,
    STACKED_FRONT: -1.4,
    RUN_BLITZ: -1.2,
    COVER_2_SHELL: 1.3,
  },
  COUNTER: {
    ZONE_MATCH: 0.2,
    ROBBER_COVERAGE: 0.1,
    DEEP_QUARTERS: 0.8,
    MAN_BLITZ: 0.5,
    CONTAIN_EDGES: -0.5,
    FORCE_UNDERNEATH: 0.6,
    STACKED_FRONT: -0.6,
    RUN_BLITZ: 0.7,
    COVER_2_SHELL: 1.0,
  },
};

const PHILOSOPHY_FIT: Record<OffensivePhilosophy, Partial<Record<OffensiveConcept, number>>> = {
  WEST_COAST: { MESH: 0.8, LEVELS: 0.5, SLANTS_FLATS: 0.6, FLOOD: 0.3, FOUR_VERTICALS: -0.4 },
  VERTICAL_SPREAD: { FOUR_VERTICALS: 0.9, FLOOD: 0.5, LEVELS: 0.4, MESH: 0.2, POWER_RUN: -0.7 },
  SMASHMOUTH: { POWER_RUN: 0.9, COUNTER: 0.7, HB_STRETCH: 0.4, PA_CROSSERS: 0.3, FOUR_VERTICALS: -0.8 },
  RPO_HEAVY: { SLANTS_FLATS: 0.8, HB_STRETCH: 0.5, MESH: 0.4, COUNTER: 0.4, FOUR_VERTICALS: -0.2 },
  QUICK_GAME: { MESH: 0.8, SLANTS_FLATS: 0.8, LEVELS: 0.5, PA_CROSSERS: -0.2, POWER_RUN: -0.4 },
  PLAY_ACTION_HEAVY: { PA_CROSSERS: 0.9, POWER_RUN: 0.5, COUNTER: 0.5, FLOOD: 0.5, FOUR_VERTICALS: 0.2 },
};

export function normalizeOffensivePhilosophy(value: unknown, fallbackStyle: string = 'BALANCED'): OffensivePhilosophy {
  if (typeof value === 'string' && OFFENSIVE_PHILOSOPHIES.includes(value as OffensivePhilosophy)) {
    return value as OffensivePhilosophy;
  }
  return PHILOSOPHY_BY_STYLE[fallbackStyle] ?? 'WEST_COAST';
}

export function normalizeGameplan(raw: unknown, team?: Pick<ConceptTeamProfile, 'offenseStyle' | 'defenseStyle' | 'tempo'>): Gameplan {
  if (!raw || typeof raw !== 'object') return defaultGameplanForTeam(team);
  const value = raw as Record<string, unknown>;
  const tempoOverride = normalizeTempoOverride(value.tempoOverride);
  const offensivePlays = normalizePlayIdsFromPlan('offense', value.offensivePlays);
  const defensivePlays = normalizePlayIdsFromPlan('defense', value.defensivePlays);

  if (offensivePlays.length > 0 || defensivePlays.length > 0) {
    const fallback = defaultGameplanForTeam(team);
    return {
      offensiveConcepts: conceptsFromPlays(offensivePlays, fallback.offensiveConcepts),
      defensiveCounters: countersFromPlays(defensivePlays, fallback.defensiveCounters),
      tempoOverride,
      offenseSchemeId: stringOrNull(value.offenseSchemeId),
      defenseSchemeId: stringOrNull(value.defenseSchemeId),
      offensivePlays,
      defensivePlays,
      offenseSchemeName: typeof value.offenseSchemeName === 'string' ? value.offenseSchemeName : undefined,
      defenseSchemeName: typeof value.defenseSchemeName === 'string' ? value.defenseSchemeName : undefined,
    };
  }

  if (Array.isArray(value.offensiveConcepts) || Array.isArray(value.defensiveCounters)) {
    return {
      offensiveConcepts: normalizeConceptSet(value.offensiveConcepts, defaultConceptsForStyle(team?.offenseStyle ?? 'BALANCED')),
      defensiveCounters: normalizeCounterSet(value.defensiveCounters, defaultCountersForStyle(team?.defenseStyle ?? 'BALANCED')),
      tempoOverride,
      offenseSchemeId: stringOrNull(value.offenseSchemeId),
      defenseSchemeId: stringOrNull(value.defenseSchemeId),
    };
  }

  return {
    offensiveConcepts: conceptsFromLegacyFocus(value.offensiveFocus, team?.offenseStyle ?? 'BALANCED'),
    defensiveCounters: countersFromLegacyFocus(value.defensiveFocus, team?.defenseStyle ?? 'BALANCED'),
    tempoOverride,
  };
}

export function schemeScoreFromPlays(playIds: string[], unit: 'offense' | 'defense'): number {
  const templates = playIds.map((id) => playTemplateById(id)).filter((play) => play?.unit === unit);
  if (templates.length === 0) return 0;
  const diversity = new Set(templates.map((play) => play!.family)).size;
  return Math.min(1.5, diversity * 0.18);
}

export function defaultGameplanForTeam(team?: Pick<ConceptTeamProfile, 'offenseStyle' | 'defenseStyle' | 'tempo'>): Gameplan {
  return {
    offensiveConcepts: defaultConceptsForStyle(team?.offenseStyle ?? 'BALANCED'),
    defensiveCounters: defaultCountersForStyle(team?.defenseStyle ?? 'BALANCED'),
    tempoOverride:
      team?.tempo === 'FAST' ? 'PUSH_TEMPO' :
      team?.tempo === 'SLOW' ? 'SLOW_DOWN' :
      'STANDARD',
  };
}

export function evaluateConceptPlan(
  team: ConceptTeamProfile,
  opponent: ConceptTeamProfile,
  ownGroups: PositionGroups,
  oppGroups: PositionGroups,
  offensiveConcepts: ConceptSet,
  defensiveCounters: CounterSet,
): ConceptEffect {
  const weightedConceptScore = offensiveConcepts.reduce((sum, concept, conceptIndex) => {
    const conceptWeight = WEIGHTS[conceptIndex];
    const counterScore = defensiveCounters.reduce((counterSum, counter, counterIndex) => {
      return counterSum + CONCEPT_MATCHUP_MATRIX[concept][counter] * WEIGHTS[counterIndex];
    }, 0);
    return sum + counterScore * conceptWeight;
  }, 0);

  const philosophy = normalizeOffensivePhilosophy(team.offensivePhilosophy, team.offenseStyle);
  const philosophyFit = offensiveConcepts.reduce((sum, concept, index) => {
    return sum + (PHILOSOPHY_FIT[philosophy][concept] ?? 0) * WEIGHTS[index];
  }, 0);
  const rosterFit = offensiveConcepts.reduce((sum, concept, index) => {
    return sum + conceptRosterFit(concept, ownGroups, oppGroups) * WEIGHTS[index];
  }, 0);
  const coachFit = offensiveConcepts.reduce((sum, concept, index) => {
    return sum + conceptCoachFit(concept, team) * WEIGHTS[index];
  }, 0);
  const defensiveIdentityFit = defensiveCounters.reduce((sum, counter, index) => {
    return sum + counterIdentityFit(counter, opponent.offenseStyle) * WEIGHTS[index];
  }, 0);
  const moraleFit = ((team.morale ?? 70) - 70) / 100;

  const scoringMod = weightedConceptScore + philosophyFit + rosterFit + coachFit + defensiveIdentityFit + moraleFit;
  const varianceMod = clamp(
    1 +
      offensiveConcepts.reduce((sum, concept, index) => sum + conceptVariance(concept) * WEIGHTS[index], 0) +
      defensiveCounters.reduce((sum, counter, index) => sum + counterVariance(counter) * WEIGHTS[index], 0),
    0.78,
    1.32,
  );

  const primaryConcept = offensiveConcepts[0];
  const primaryCounter = defensiveCounters[0];
  const primaryScore = CONCEPT_MATCHUP_MATRIX[primaryConcept][primaryCounter];

  return {
    scoringMod,
    varianceMod,
    explanations: [
      `${labelFor(primaryConcept)} vs ${labelFor(primaryCounter)} ${primaryScore >= 0 ? 'creates leverage' : 'runs into resistance'}.`,
      `${labelFor(philosophy)} fit ${philosophyFit >= 0 ? 'supports' : 'stretches'} the weekly call sheet.`,
      rosterFit >= 0 ? `Roster groups fit the chosen concepts.` : `Roster fit is a concern for these concepts.`,
    ],
    topInteraction: `${labelFor(primaryConcept)} vs ${labelFor(primaryCounter)}`,
  };
}

export function scoreOffensiveConcept(
  concept: OffensiveConcept,
  team: ConceptTeamProfile,
  opponent: ConceptTeamProfile,
  ownGroups: PositionGroups,
  oppGroups: PositionGroups,
): number {
  const philosophy = normalizeOffensivePhilosophy(team.offensivePhilosophy, team.offenseStyle);
  const averageCounterScore = DEFENSIVE_COUNTERS.reduce((sum, counter) => {
    return sum + CONCEPT_MATCHUP_MATRIX[concept][counter] * likelyCounterWeight(counter, opponent);
  }, 0);
  return averageCounterScore +
    (PHILOSOPHY_FIT[philosophy][concept] ?? 0) +
    conceptRosterFit(concept, ownGroups, oppGroups) +
    conceptCoachFit(concept, team);
}

export function scoreDefensiveCounter(
  counter: DefensiveCounter,
  opponent: ConceptTeamProfile,
  opponentGroups: PositionGroups,
): number {
  const likelyConceptScore = OFFENSIVE_CONCEPTS.reduce((sum, concept) => {
    return sum - CONCEPT_MATCHUP_MATRIX[concept][counter] * likelyConceptWeight(concept, opponent, opponentGroups);
  }, 0);
  return likelyConceptScore + counterIdentityFit(counter, opponent.offenseStyle);
}

export function applyTempoOverride(baseTempo: string, override: TempoOverride): string {
  switch (override) {
    case 'SLOW_DOWN': return 'SLOW';
    case 'PUSH_TEMPO': return 'FAST';
    case 'STANDARD':
    default: return baseTempo;
  }
}

export function labelFor(value: string): string {
  const special: Record<string, string> = {
    RPO_HEAVY: 'RPO Heavy',
    PA_CROSSERS: 'PA Crossers',
    HB_STRETCH: 'HB Stretch',
    COVER_2_SHELL: 'Cover 2 Shell',
  };
  return special[value] ?? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeConceptSet(value: unknown, fallback: ConceptSet): ConceptSet {
  const selected = Array.isArray(value)
    ? value.filter((item): item is OffensiveConcept => typeof item === 'string' && OFFENSIVE_CONCEPTS.includes(item as OffensiveConcept))
    : [];
  return fillUnique(selected, fallback, OFFENSIVE_CONCEPTS) as ConceptSet;
}

function normalizeCounterSet(value: unknown, fallback: CounterSet): CounterSet {
  const selected = Array.isArray(value)
    ? value.filter((item): item is DefensiveCounter => typeof item === 'string' && DEFENSIVE_COUNTERS.includes(item as DefensiveCounter))
    : [];
  return fillUnique(selected, fallback, DEFENSIVE_COUNTERS) as CounterSet;
}

function fillUnique<T extends string>(selected: T[], fallback: [T, T, T], universe: T[]): [T, T, T] {
  const out: T[] = [];
  for (const item of selected) if (!out.includes(item)) out.push(item);
  for (const item of fallback) if (!out.includes(item)) out.push(item);
  for (const item of universe) if (!out.includes(item)) out.push(item);
  return [out[0], out[1], out[2]];
}

function normalizeTempoOverride(value: unknown): TempoOverride {
  return typeof value === 'string' && TEMPO_OVERRIDES.includes(value as TempoOverride)
    ? value as TempoOverride
    : 'STANDARD';
}

function normalizePlayIdsFromPlan(unit: 'offense' | 'defense', value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || ids.includes(item)) continue;
    const template = playTemplateById(item);
    if (template?.unit === unit) ids.push(item);
  }
  return ids.slice(0, 9);
}

function stringOrNull(value: unknown): string | null | undefined {
  return typeof value === 'string' ? value : value === null ? null : undefined;
}

function conceptsFromPlays(playIds: string[], fallback: ConceptSet): ConceptSet {
  const mapped = playIds
    .map((id): OffensiveConcept | null => {
      switch (id) {
        case 'mesh': return 'MESH';
        case 'four_verticals': return 'FOUR_VERTICALS';
        case 'flood': return 'FLOOD';
        case 'levels': return 'LEVELS';
        case 'slants_flats': return 'SLANTS_FLATS';
        case 'pa_crossers': return 'PA_CROSSERS';
        case 'hb_stretch': return 'HB_STRETCH';
        case 'power_run': return 'POWER_RUN';
        case 'counter': return 'COUNTER';
        default: return null;
      }
    })
    .filter((value): value is OffensiveConcept => !!value);
  return fillUnique(mapped, fallback, OFFENSIVE_CONCEPTS) as ConceptSet;
}

function countersFromPlays(playIds: string[], fallback: CounterSet): CounterSet {
  const mapped = playIds
    .map((id): DefensiveCounter | null => {
      switch (id) {
        case 'zone_match': return 'ZONE_MATCH';
        case 'robber_coverage': return 'ROBBER_COVERAGE';
        case 'deep_quarters': return 'DEEP_QUARTERS';
        case 'man_blitz': return 'MAN_BLITZ';
        case 'contain_edges': return 'CONTAIN_EDGES';
        case 'force_underneath': return 'FORCE_UNDERNEATH';
        case 'stacked_front': return 'STACKED_FRONT';
        case 'run_blitz': return 'RUN_BLITZ';
        case 'cover_2_shell': return 'COVER_2_SHELL';
        default: return null;
      }
    })
    .filter((value): value is DefensiveCounter => !!value);
  return fillUnique(mapped, fallback, DEFENSIVE_COUNTERS) as CounterSet;
}

function defaultConceptsForStyle(style: string): ConceptSet {
  if (style === 'PASS_HEAVY') return ['FOUR_VERTICALS', 'FLOOD', 'MESH'];
  if (style === 'RUN_HEAVY') return ['POWER_RUN', 'COUNTER', 'PA_CROSSERS'];
  return DEFAULT_GAMEPLAN.offensiveConcepts;
}

function defaultCountersForStyle(style: string): CounterSet {
  if (style === 'AGGRESSIVE') return ['MAN_BLITZ', 'RUN_BLITZ', 'ROBBER_COVERAGE'];
  if (style === 'PREVENT') return ['DEEP_QUARTERS', 'COVER_2_SHELL', 'FORCE_UNDERNEATH'];
  return DEFAULT_GAMEPLAN.defensiveCounters;
}

function conceptsFromLegacyFocus(value: unknown, style: string): ConceptSet {
  switch (value) {
    case 'ATTACK_DEEP': return ['FOUR_VERTICALS', 'FLOOD', 'PA_CROSSERS'];
    case 'QUICK_PASSING': return ['MESH', 'SLANTS_FLATS', 'LEVELS'];
    case 'ESTABLISH_RUN': return ['POWER_RUN', 'HB_STRETCH', 'COUNTER'];
    case 'BALANCED':
    default: return defaultConceptsForStyle(style);
  }
}

function countersFromLegacyFocus(value: unknown, style: string): CounterSet {
  switch (value) {
    case 'STOP_RUN': return ['STACKED_FRONT', 'RUN_BLITZ', 'CONTAIN_EDGES'];
    case 'PREVENT_DEEP': return ['DEEP_QUARTERS', 'COVER_2_SHELL', 'FORCE_UNDERNEATH'];
    case 'BLITZ_HEAVY': return ['MAN_BLITZ', 'ROBBER_COVERAGE', 'RUN_BLITZ'];
    case 'BALANCED':
    default: return defaultCountersForStyle(style);
  }
}

function conceptRosterFit(concept: OffensiveConcept, own: PositionGroups, opp: PositionGroups): number {
  switch (concept) {
    case 'FOUR_VERTICALS':
      return ((own.qb - 70) / 10) * 0.35 + ((own.skillPositions - 70) / 10) * 0.35 + ((70 - opp.secondary) / 10) * 0.45 + ((own.oLine - opp.frontSeven) / 10) * 0.25;
    case 'MESH':
    case 'SLANTS_FLATS':
    case 'LEVELS':
      return ((own.qb - 70) / 10) * 0.25 + ((own.skillPositions - 70) / 10) * 0.25 + ((opp.frontSeven - 70) / 10) * 0.15;
    case 'FLOOD':
    case 'PA_CROSSERS':
      return ((own.qb - 70) / 10) * 0.25 + ((own.skillPositions - 70) / 10) * 0.35 + ((70 - opp.secondary) / 10) * 0.25;
    case 'HB_STRETCH':
    case 'POWER_RUN':
    case 'COUNTER':
      return ((own.oLine - 70) / 10) * 0.35 + ((own.skillPositions - 70) / 10) * 0.2 + ((70 - opp.frontSeven) / 10) * 0.45;
  }
}

function conceptCoachFit(concept: OffensiveConcept, team: ConceptTeamProfile): number {
  const oc = team.coaches?.find((coach) => coach.role === 'OC');
  const hc = team.coaches?.find((coach) => coach.role === 'HEAD_COACH');
  const coach = oc ?? hc;
  if (!coach) return 0;

  const reputation = (coach.reputation - 60) / 100;
  const philosophy = coach.philosophy.toLowerCase();
  const specialty = coach.developmentSpecialty?.toLowerCase() ?? '';
  const passConcept = ['MESH', 'FOUR_VERTICALS', 'FLOOD', 'LEVELS', 'SLANTS_FLATS', 'PA_CROSSERS'].includes(concept);
  const runConcept = ['HB_STRETCH', 'POWER_RUN', 'COUNTER'].includes(concept);
  let fit = reputation;
  if (passConcept && (philosophy.includes('vertical') || philosophy.includes('playcaller') || specialty === 'qb')) fit += 0.35;
  if (runConcept && (philosophy.includes('ground') || philosophy.includes('old-school') || specialty === 'ol')) fit += 0.35;
  if (concept === 'PA_CROSSERS' && philosophy.includes('ground')) fit += 0.2;
  return clamp(fit, -0.4, 0.7);
}

function counterIdentityFit(counter: DefensiveCounter, opponentOffStyle: string): number {
  if (opponentOffStyle === 'RUN_HEAVY' && ['STACKED_FRONT', 'RUN_BLITZ', 'CONTAIN_EDGES'].includes(counter)) return 0.5;
  if (opponentOffStyle === 'PASS_HEAVY' && ['DEEP_QUARTERS', 'ROBBER_COVERAGE', 'ZONE_MATCH', 'COVER_2_SHELL'].includes(counter)) return 0.45;
  if (opponentOffStyle === 'BALANCED' && ['ZONE_MATCH', 'FORCE_UNDERNEATH', 'ROBBER_COVERAGE'].includes(counter)) return 0.25;
  return 0;
}

function conceptVariance(concept: OffensiveConcept): number {
  if (concept === 'FOUR_VERTICALS' || concept === 'PA_CROSSERS') return 0.18;
  if (concept === 'POWER_RUN' || concept === 'HB_STRETCH') return -0.08;
  if (concept === 'MESH' || concept === 'SLANTS_FLATS') return -0.05;
  return 0;
}

function counterVariance(counter: DefensiveCounter): number {
  if (counter === 'MAN_BLITZ' || counter === 'RUN_BLITZ') return 0.14;
  if (counter === 'DEEP_QUARTERS' || counter === 'FORCE_UNDERNEATH') return -0.08;
  return 0;
}

function likelyCounterWeight(counter: DefensiveCounter, opponent: ConceptTeamProfile): number {
  const base = 1 / DEFENSIVE_COUNTERS.length;
  return base + (
    opponent.defenseStyle === 'AGGRESSIVE' && ['MAN_BLITZ', 'RUN_BLITZ', 'ROBBER_COVERAGE'].includes(counter) ? 0.08 :
    opponent.defenseStyle === 'PREVENT' && ['DEEP_QUARTERS', 'COVER_2_SHELL', 'FORCE_UNDERNEATH'].includes(counter) ? 0.08 :
    opponent.defenseStyle === 'BALANCED' && ['ZONE_MATCH', 'ROBBER_COVERAGE', 'STACKED_FRONT'].includes(counter) ? 0.05 :
    0
  );
}

function likelyConceptWeight(concept: OffensiveConcept, opponent: ConceptTeamProfile, opponentGroups: PositionGroups): number {
  const philosophy = normalizeOffensivePhilosophy(opponent.offensivePhilosophy, opponent.offenseStyle);
  const styleBias =
    opponent.offenseStyle === 'PASS_HEAVY' && ['FOUR_VERTICALS', 'FLOOD', 'MESH', 'LEVELS'].includes(concept) ? 0.08 :
    opponent.offenseStyle === 'RUN_HEAVY' && ['POWER_RUN', 'HB_STRETCH', 'COUNTER', 'PA_CROSSERS'].includes(concept) ? 0.08 :
    0;
  const rosterBias =
    opponentGroups.oLine > opponentGroups.qb && ['POWER_RUN', 'COUNTER'].includes(concept) ? 0.04 :
    opponentGroups.qb > opponentGroups.oLine && ['MESH', 'FOUR_VERTICALS'].includes(concept) ? 0.04 :
    0;
  return (1 / OFFENSIVE_CONCEPTS.length) + styleBias + rosterBias + ((PHILOSOPHY_FIT[philosophy][concept] ?? 0) * 0.03);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
