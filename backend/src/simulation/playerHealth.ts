import { Gameplan, applyTempoOverride, normalizeGameplan } from './gameplan';

export type InjuryStatus = 'HEALTHY' | 'QUESTIONABLE' | 'MINOR' | 'MULTI_WEEK';

export interface HealthPlayer {
  id: string;
  name: string;
  position: string;
  overall: number;
  fatigue: number;
  injuryStatus?: string;
  injuryWeeks?: number;
  conditioning?: number;
}

export interface HealthTeam {
  id: string;
  offenseStyle: string;
  defenseStyle: string;
  tempo: string;
  players: HealthPlayer[];
}

export interface PlayerHealthUpdate {
  playerId: string;
  fatigue: number;
  injuryStatus: InjuryStatus;
  injuryType: string | null;
  injuryWeeks: number;
  conditioning: number;
}

const STARTER_COUNTS: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  OL: 5,
  DE: 2,
  DT: 2,
  LB: 3,
  CB: 2,
  S:  2,
};

const INJURY_TYPES = [
  'Hamstring Tightness',
  'Shoulder Knock',
  'Ankle Sprain',
  'Knee Soreness',
  'Rib Bruise',
  'Back Tightness',
];

export function effectiveOverall(player: Pick<HealthPlayer, 'overall' | 'fatigue' | 'injuryStatus' | 'injuryWeeks'>): number {
  const fatiguePenalty = player.fatigue >= 80 ? 8 : player.fatigue >= 60 ? 5 : player.fatigue >= 40 ? 2 : 0;
  const injuryPenalty =
    player.injuryStatus === 'MULTI_WEEK' && (player.injuryWeeks ?? 0) > 0 ? 18 :
    player.injuryStatus === 'MINOR' ? 8 :
    player.injuryStatus === 'QUESTIONABLE' ? 4 :
    0;
  return Math.max(35, player.overall - fatiguePenalty - injuryPenalty);
}

export function buildHealthAdjustedPlayers(players: HealthPlayer[]): HealthPlayer[] {
  return players.map((player) => ({
    ...player,
    overall: effectiveOverall(player),
  }));
}

export function isLikelyStarter(player: HealthPlayer, teamPlayers: HealthPlayer[]): boolean {
  const count = STARTER_COUNTS[player.position] ?? 0;
  if (count === 0) return false;
  const positionDepth = teamPlayers
    .filter((candidate) => candidate.position === player.position)
    .sort((a, b) => effectiveOverall(b) - effectiveOverall(a));
  return positionDepth.slice(0, count).some((starter) => starter.id === player.id);
}

export function buildPostMatchHealthUpdates(team: HealthTeam, gameplan: Gameplan): PlayerHealthUpdate[] {
  gameplan = normalizeGameplan(gameplan, team);
  const effectiveTempo = applyTempoOverride(team.tempo, gameplan.tempoOverride);
  return team.players.map((player) => {
    const starter = isLikelyStarter(player, team.players);
    const existingWeeks = player.injuryWeeks ?? 0;
    let injuryStatus = normalizeInjuryStatus(player.injuryStatus);
    let injuryWeeks = Math.max(0, existingWeeks - 1);
    let injuryType: string | null = injuryWeeks > 0 ? null : null;
    const conditioning = Math.max(0, (player.conditioning ?? 0) - 1);

    if (injuryWeeks === 0 && injuryStatus === 'MULTI_WEEK') injuryStatus = 'MINOR';
    if (!starter) {
      return {
        playerId: player.id,
        fatigue: Math.max(0, player.fatigue - 7),
        injuryStatus: injuryWeeks > 0 ? injuryStatus : 'HEALTHY',
        injuryType,
        injuryWeeks,
        conditioning,
      };
    }

    const tempoLoad = effectiveTempo === 'FAST' ? 5 : effectiveTempo === 'SLOW' ? 1 : 3;
    const offensiveLoad = gameplan.offensiveConcepts.some((concept) => ['FOUR_VERTICALS', 'POWER_RUN', 'HB_STRETCH'].includes(concept)) ? 2 : 0;
    const defensiveLoad = gameplan.defensiveCounters.some((counter) => counter === 'MAN_BLITZ' || counter === 'RUN_BLITZ') || team.defenseStyle === 'AGGRESSIVE' ? 3 : 0;
    const positionLoad = ['RB', 'WR', 'LB', 'CB', 'DE'].includes(player.position) ? 2 : 1;
    const recovery = injuryStatus === 'MINOR' || injuryStatus === 'QUESTIONABLE' ? 1 : 0;
    const fatigue = Math.max(0, Math.min(100, player.fatigue + tempoLoad + offensiveLoad + defensiveLoad + positionLoad - recovery));

    const baseChance =
      0.006 +
      fatigue * 0.00035 +
      (effectiveTempo === 'FAST' ? 0.008 : 0) +
      (gameplan.defensiveCounters.some((counter) => counter === 'MAN_BLITZ' || counter === 'RUN_BLITZ') ? 0.006 : 0) +
      (player.position === 'RB' ? 0.006 : 0) +
      (injuryStatus === 'MINOR' ? 0.018 : 0);
    const injuryChance = (player.conditioning ?? 0) > 0 ? baseChance * 0.4 : baseChance;

    if (Math.random() < injuryChance) {
      const severityRoll = Math.random();
      injuryType = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];
      if (injuryStatus === 'MINOR' && severityRoll < 0.34) {
        injuryStatus = 'MULTI_WEEK';
        injuryWeeks = 2 + Math.floor(Math.random() * 3);
      } else if (severityRoll < 0.58) {
        injuryStatus = 'QUESTIONABLE';
        injuryWeeks = 0;
      } else if (severityRoll < 0.88) {
        injuryStatus = 'MINOR';
        injuryWeeks = 0;
      } else {
        injuryStatus = 'MULTI_WEEK';
        injuryWeeks = 2 + Math.floor(Math.random() * 3);
      }
    } else if (injuryWeeks === 0 && fatigue >= 78) {
      injuryStatus = 'QUESTIONABLE';
      injuryType = 'Wear and Tear';
    } else if (injuryWeeks === 0 && injuryStatus !== 'MINOR') {
      injuryStatus = 'HEALTHY';
    }

    return {
      playerId: player.id,
      fatigue,
      injuryStatus,
      injuryType,
      injuryWeeks,
      conditioning,
    };
  });
}

function normalizeInjuryStatus(status?: string): InjuryStatus {
  if (status === 'QUESTIONABLE' || status === 'MINOR' || status === 'MULTI_WEEK') return status;
  return 'HEALTHY';
}
