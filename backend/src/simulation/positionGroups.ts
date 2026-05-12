export interface PositionGroups {
  qb: number;
  skillPositions: number;  // WR + TE + RB — weapons in the passing and rushing game
  oLine: number;           // OL — protection and run-blocking
  frontSeven: number;      // DE + DT + LB — defensive line and linebackers
  secondary: number;       // CB + S — pass coverage
}

interface PlayerLike {
  position: string;
  overall: number;
  fatigue?: number;
  injuryStatus?: string;
  injuryWeeks?: number;
}

function avg(values: number[]): number {
  if (values.length === 0) return 60; // league-average fallback if position missing
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computePositionGroups(players: PlayerLike[]): PositionGroups {
  const ratings = (positions: string[]) =>
    players.filter((p) => positions.includes(p.position)).map((p) => adjustedOverall(p));

  return {
    qb:             avg(ratings(['QB'])),
    skillPositions: avg(ratings(['WR', 'TE', 'RB'])),
    oLine:          avg(ratings(['OL'])),
    frontSeven:     avg(ratings(['DE', 'DT', 'LB'])),
    secondary:      avg(ratings(['CB', 'S'])),
  };
}

function adjustedOverall(player: PlayerLike): number {
  const fatigue = player.fatigue ?? 0;
  const fatiguePenalty = fatigue >= 80 ? 8 : fatigue >= 60 ? 5 : fatigue >= 40 ? 2 : 0;
  const injuryPenalty =
    player.injuryStatus === 'MULTI_WEEK' && (player.injuryWeeks ?? 0) > 0 ? 18 :
    player.injuryStatus === 'MINOR' ? 8 :
    player.injuryStatus === 'QUESTIONABLE' ? 4 :
    0;
  return Math.max(35, player.overall - fatiguePenalty - injuryPenalty);
}
