import {
  categoryCounts,
  DefensiveCategory,
  OffensiveCategory,
  normalizePlayLoadout,
} from './playLibrary';

export type OffensiveIdentity = 'VERTICAL' | 'RUN_HEAVY' | 'PASS_HEAVY' | 'BALANCED';
export type DefensiveIdentity = 'PRESSURE' | 'MAN_HEAVY' | 'ZONE_HEAVY' | 'BALANCED';

export interface TeamIdentity {
  offense: OffensiveIdentity;
  defense: DefensiveIdentity;
}

export function deriveTeamIdentity(team: { offensivePlays?: unknown; defensivePlays?: unknown }): TeamIdentity {
  return {
    offense: deriveOffensiveIdentity(normalizePlayLoadout('offense', team.offensivePlays)),
    defense: deriveDefensiveIdentity(normalizePlayLoadout('defense', team.defensivePlays)),
  };
}

export function deriveOffensiveIdentity(playIds: string[]): OffensiveIdentity {
  const counts = categoryCounts('offense', playIds) as Partial<Record<OffensiveCategory, number>>;
  const running = counts.RUNNING ?? 0;
  const shortPass = counts.SHORT_PASS ?? 0;
  const middlePass = counts.MIDDLE_PASS ?? 0;
  const longPass = counts.LONG_PASS ?? 0;
  const totalPass = shortPass + middlePass + longPass;

  if (longPass >= 4) return 'VERTICAL';
  if (running >= 4) return 'RUN_HEAVY';
  if (totalPass >= 7 || (totalPass >= 6 && running <= 2)) return 'PASS_HEAVY';
  return 'BALANCED';
}

export function deriveDefensiveIdentity(playIds: string[]): DefensiveIdentity {
  const counts = categoryCounts('defense', playIds) as Partial<Record<DefensiveCategory, number>>;
  const zone = counts.ZONE ?? 0;
  const blitz = counts.BLITZ ?? 0;
  const zoneBlitz = counts.ZONE_BLITZ ?? 0;
  const man = counts.MAN ?? 0;

  if (blitz + zoneBlitz >= 5) return 'PRESSURE';
  if (man >= 4) return 'MAN_HEAVY';
  if (zone >= 4) return 'ZONE_HEAVY';
  return 'BALANCED';
}
