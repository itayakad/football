import {
  defaultLoadout,
  normalizePlayLoadout,
  playById,
  PlayUnit,
} from './playLibrary';

// The new "gameplan" is just the team's 9-play offensive and 9-play defensive
// loadouts. Team identity is determined entirely by which plays they carry.
export interface Gameplan {
  offensivePlays: string[]; // exactly 9 valid offensive play IDs
  defensivePlays: string[]; // exactly 9 valid defensive play IDs
}

// Lazy because defaultLoadout() reads from the DB-backed play catalog, which
// isn't populated until loadPlayCatalog() runs at process boot. Top-level
// evaluation would run before that and throw.
export function defaultGameplan(): Gameplan {
  return {
    offensivePlays: defaultLoadout('offense'),
    defensivePlays: defaultLoadout('defense'),
  };
}

export function normalizeGameplan(raw: unknown): Gameplan {
  if (!raw || typeof raw !== 'object') return defaultGameplan();
  const value = raw as Record<string, unknown>;
  return {
    offensivePlays: normalizePlayLoadout('offense', value.offensivePlays),
    defensivePlays: normalizePlayLoadout('defense', value.defensivePlays),
  };
}

// Validate that a user-submitted gameplan only references real plays for the
// correct unit. Returns null if valid, or a human-readable error string.
export function validateGameplan(gameplan: Gameplan): string | null {
  if (!isLoadoutOfNine(gameplan.offensivePlays, 'offense')) return 'Offensive playbook must be exactly 9 unique offensive plays.';
  if (!isLoadoutOfNine(gameplan.defensivePlays, 'defense')) return 'Defensive playbook must be exactly 9 unique defensive plays.';
  return null;
}

function isLoadoutOfNine(ids: string[], unit: PlayUnit): boolean {
  if (!Array.isArray(ids) || ids.length !== 9) return false;
  const seen = new Set<string>();
  for (const id of ids) {
    const p = playById(id);
    if (!p || p.unit !== unit) return false;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
