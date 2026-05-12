import { computePositionGroups, PositionGroups } from './positionGroups';
import {
  ConceptSet,
  CounterSet,
  DefensiveCounter,
  DEFENSIVE_COUNTERS,
  Gameplan,
  labelFor,
  OffensiveConcept,
  OFFENSIVE_CONCEPTS,
  scoreDefensiveCounter,
  scoreOffensiveConcept,
  TempoOverride,
} from './gameplan';

interface CoachableTeam {
  name?: string;
  offenseStyle: string;
  defenseStyle: string;
  tempo: string;
  offensivePhilosophy?: string | null;
  morale?: number;
  coaches?: Array<{
    role: string;
    philosophy: string;
    reputation: number;
    aggression?: number;
    developmentSpecialty?: string;
    preferredTempo?: string;
  }>;
  players: Array<{ position: string; overall: number; name?: string }>;
}

export interface CoachRecommendation {
  gameplan: Gameplan;
  reasoning: {
    offensive: string;
    defensive: string;
    tempo: string;
    offensiveConcepts: Array<{ concept: OffensiveConcept; reason: string }>;
    defensiveCounters: Array<{ counter: DefensiveCounter; reason: string }>;
  };
}

export function chooseAIGameplan(team: CoachableTeam, opponent: CoachableTeam): Gameplan {
  return recommendGameplan(team, opponent).gameplan;
}

export function recommendGameplan(team: CoachableTeam, opponent: CoachableTeam): CoachRecommendation {
  const ownGroups = computePositionGroups(team.players);
  const oppGroups = computePositionGroups(opponent.players);

  const offensiveConcepts = pickTopThree(OFFENSIVE_CONCEPTS, (concept) => {
    return scoreOffensiveConcept(concept, team, opponent, ownGroups, oppGroups);
  }) as ConceptSet;

  const defensiveCounters = pickTopThree(DEFENSIVE_COUNTERS, (counter) => {
    return scoreDefensiveCounter(counter, opponent, oppGroups) + defenseStyleBias(counter, team.defenseStyle);
  }) as CounterSet;

  const tempo: TempoOverride =
    team.tempo === 'FAST' ? 'PUSH_TEMPO' :
    team.tempo === 'SLOW' ? 'SLOW_DOWN' :
    'STANDARD';

  const offensiveConceptReasons = offensiveConcepts.map((concept) => ({
    concept,
    reason: explainConcept(concept, opponent, oppGroups),
  }));
  const defensiveCounterReasons = defensiveCounters.map((counter) => ({
    counter,
    reason: explainCounter(counter, opponent, oppGroups),
  }));

  return {
    gameplan: { offensiveConcepts, defensiveCounters, tempoOverride: tempo },
    reasoning: {
      offensive: offensiveConceptReasons.map((item) => `${labelFor(item.concept)}: ${item.reason}`).join(' '),
      defensive: defensiveCounterReasons.map((item) => `${labelFor(item.counter)}: ${item.reason}`).join(' '),
      tempo: explainTempo(tempo),
      offensiveConcepts: offensiveConceptReasons,
      defensiveCounters: defensiveCounterReasons,
    },
  };
}

function defenseStyleBias(counter: DefensiveCounter, defenseStyle: string): number {
  if (defenseStyle === 'AGGRESSIVE' && ['MAN_BLITZ', 'RUN_BLITZ', 'ROBBER_COVERAGE'].includes(counter)) return 0.35;
  if (defenseStyle === 'PREVENT' && ['DEEP_QUARTERS', 'COVER_2_SHELL', 'FORCE_UNDERNEATH'].includes(counter)) return 0.35;
  if (defenseStyle === 'BALANCED' && ['ZONE_MATCH', 'ROBBER_COVERAGE', 'STACKED_FRONT'].includes(counter)) return 0.2;
  return 0;
}

function explainConcept(concept: OffensiveConcept, opponent: CoachableTeam, oppGroups: PositionGroups): string {
  const oppName = opponent.name ?? 'opponent';
  switch (concept) {
    case 'MESH':
      return oppGroups.secondary < 70 ? `stresses ${oppName}'s underneath coverage.` : `creates quick answers against pressure.`;
    case 'FOUR_VERTICALS':
      return oppGroups.secondary < 72 ? `tests a vulnerable secondary vertically.` : `keeps safeties from crowding intermediate routes.`;
    case 'FLOOD':
      return `layers routes against zone looks and moves the launch point.`;
    case 'LEVELS':
      return `attacks linebacker depth and keeps the QB in rhythm.`;
    case 'SLANTS_FLATS':
      return opponent.defenseStyle === 'AGGRESSIVE' ? `punishes blitz leverage with fast throws.` : `forces clean open-field tackling.`;
    case 'PA_CROSSERS':
      return opponent.defenseStyle === 'PREVENT' ? `pulls soft coverage toward run action.` : `creates chunk windows behind linebackers.`;
    case 'HB_STRETCH':
      return oppGroups.frontSeven < 70 ? `makes a light front run sideline to sideline.` : `tests edge discipline.`;
    case 'POWER_RUN':
      return oppGroups.frontSeven < 70 ? `leans on a front-seven weakness.` : `keeps the game physical and low variance.`;
    case 'COUNTER':
      return `uses misdirection against pursuit and run blitzes.`;
  }
}

function explainCounter(counter: DefensiveCounter, opponent: CoachableTeam, oppGroups: PositionGroups): string {
  const oppName = opponent.name ?? 'opponent';
  switch (counter) {
    case 'ZONE_MATCH':
      return `handles crossers without giving up easy underneath leverage.`;
    case 'ROBBER_COVERAGE':
      return `closes the middle of the field against rhythm throws.`;
    case 'DEEP_QUARTERS':
      return `${oppName}'s explosive passing risk is capped.`;
    case 'MAN_BLITZ':
      return oppGroups.oLine < 70 ? `attacks a protection weakness.` : `forces quick decisions.`;
    case 'CONTAIN_EDGES':
      return `keeps perimeter runs and movement throws inside.`;
    case 'FORCE_UNDERNEATH':
      return `trades short completions for fewer explosives.`;
    case 'STACKED_FRONT':
      return `crowds run fits and play-action launch points.`;
    case 'RUN_BLITZ':
      return opponent.offenseStyle === 'RUN_HEAVY' ? `meets their run identity before it develops.` : `creates early-down disruption.`;
    case 'COVER_2_SHELL':
      return `protects wide areas and dares patient drives.`;
  }
}

function explainTempo(tempo: TempoOverride): string {
  switch (tempo) {
    case 'PUSH_TEMPO': return `Push tempo to increase possessions.`;
    case 'SLOW_DOWN': return `Slow it down and compress the game.`;
    case 'STANDARD':
    default: return `Stay at the team's normal pace.`;
  }
}

function pickTopThree<T>(options: T[], score: (opt: T) => number): [T, T, T] {
  const ranked = [...options].sort((a, b) => score(b) - score(a));
  return [ranked[0], ranked[1], ranked[2]];
}
