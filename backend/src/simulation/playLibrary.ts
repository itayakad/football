// Shared library of every play in the game. Teams pick 9 offensive + 9
// defensive plays from these lists. The category distribution within a team's
// 9-play loadout drives playcalling tendency (not raw strength).

export type OffensiveCategory = 'RUNNING' | 'SHORT_PASS' | 'MIDDLE_PASS' | 'LONG_PASS';
export type DefensiveCategory = 'ZONE' | 'BLITZ' | 'ZONE_BLITZ' | 'MAN';
export type PlayCategory = OffensiveCategory | DefensiveCategory;
export type PlayUnit = 'offense' | 'defense';

// Stable slot identifiers — resolved against a roster at sim time. Each team
// gets one player mapped to each slot (best at the position, ranked by overall).
export type PlayerSlot =
  | 'QB' | 'RB' | 'WR' | 'TE'
  | 'T' | 'G' | 'C'
  | 'EDGE1' | 'EDGE2' | 'DT1' | 'DT2'
  | 'MLB' | 'WLB' | 'SLB'
  | 'CB1' | 'CB2' | 'NCB' | 'FS' | 'SS';

export interface OffensivePlay {
  id: string;
  name: string;
  unit: 'offense';
  category: OffensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export interface DefensivePlay {
  id: string;
  name: string;
  unit: 'defense';
  category: DefensiveCategory;
  keySlots: [PlayerSlot, PlayerSlot, PlayerSlot];
}

export type Play = OffensivePlay | DefensivePlay;

// UI border color per category — drives instant visual recognition in the playbook.
export const CATEGORY_COLOR: Record<PlayCategory, string> = {
  RUNNING:     '#22C55E', // green
  SHORT_PASS:  '#38BDF8', // sky blue
  MIDDLE_PASS: '#FACC15', // amber
  LONG_PASS:   '#F97316', // orange
  ZONE:        '#3B82F6', // blue
  BLITZ:       '#EF4444', // red
  ZONE_BLITZ:  '#A855F7', // purple
  MAN:         '#14B8A6', // teal
};

export const CATEGORY_LABEL: Record<PlayCategory, string> = {
  RUNNING:     'Running',
  SHORT_PASS:  'Short Pass',
  MIDDLE_PASS: 'Middle Pass',
  LONG_PASS:   'Long Pass',
  ZONE:        'Zone',
  BLITZ:       'Blitz',
  ZONE_BLITZ:  'Zone Blitz',
  MAN:         'Man',
};

export const OFFENSIVE_CATEGORIES: OffensiveCategory[] = ['RUNNING', 'SHORT_PASS', 'MIDDLE_PASS', 'LONG_PASS'];
export const DEFENSIVE_CATEGORIES: DefensiveCategory[] = ['ZONE', 'BLITZ', 'ZONE_BLITZ', 'MAN'];

// ── Matchup matrix ────────────────────────────────────────
//                 ZONE  BLITZ  ZONE_BLITZ  MAN
//  RUNNING         0     +1      -1         0
//  SHORT_PASS      0      0      +1        -1
//  MIDDLE_PASS    +1     -1       0         0
//  LONG_PASS      -1      0       0        +1
export const MATCHUP_MATRIX: Record<OffensiveCategory, Record<DefensiveCategory, -1 | 0 | 1>> = {
  RUNNING:     { ZONE: 0,  BLITZ: 1,  ZONE_BLITZ: -1, MAN: 0  },
  SHORT_PASS:  { ZONE: 0,  BLITZ: 0,  ZONE_BLITZ: 1,  MAN: -1 },
  MIDDLE_PASS: { ZONE: 1,  BLITZ: -1, ZONE_BLITZ: 0,  MAN: 0  },
  LONG_PASS:   { ZONE: -1, BLITZ: 0,  ZONE_BLITZ: 0,  MAN: 1  },
};

export const MATCHUP_MULTIPLIER = { favorable: 1.25, neutral: 1.0, unfavorable: 0.75 } as const;

export function offensiveMatchupMod(off: OffensiveCategory, def: DefensiveCategory): number {
  const v = MATCHUP_MATRIX[off][def];
  return v === 1 ? MATCHUP_MULTIPLIER.favorable : v === -1 ? MATCHUP_MULTIPLIER.unfavorable : MATCHUP_MULTIPLIER.neutral;
}

export function defensiveMatchupMod(off: OffensiveCategory, def: DefensiveCategory): number {
  const v = MATCHUP_MATRIX[off][def];
  // Defense favored when offense is at -1 in matrix (def category counters offense).
  return v === -1 ? MATCHUP_MULTIPLIER.favorable : v === 1 ? MATCHUP_MULTIPLIER.unfavorable : MATCHUP_MULTIPLIER.neutral;
}

// ── Play library ──────────────────────────────────────────
//
// The catalog lives in the Play table (Prisma model). Call loadPlayCatalog()
// once at process boot — every sync accessor below reads from the cache it
// populates and throws if it's missing.

let _offensivePlays: OffensivePlay[] | null = null;
let _defensivePlays: DefensivePlay[] | null = null;
let _allPlays: Play[] | null = null;
let _playById: Map<string, Play> | null = null;

interface PrismaPlayClient {
  play: {
    findMany: (args: { orderBy?: { sortOrder?: 'asc' | 'desc' } }) => Promise<Array<{
      id: string;
      unit: string;
      name: string;
      category: string;
      keySlots: unknown;
      sortOrder: number;
    }>>;
  };
}

export async function loadPlayCatalog(prisma: PrismaPlayClient): Promise<void> {
  const rows = await prisma.play.findMany({ orderBy: { sortOrder: 'asc' } });
  const offense: OffensivePlay[] = [];
  const defense: DefensivePlay[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.keySlots) || row.keySlots.length !== 3) {
      throw new Error(`Play ${row.id} has invalid keySlots: ${JSON.stringify(row.keySlots)}`);
    }
    const slots = row.keySlots as [PlayerSlot, PlayerSlot, PlayerSlot];
    if (row.unit === 'offense') {
      offense.push({ id: row.id, unit: 'offense', name: row.name, category: row.category as OffensiveCategory, keySlots: slots });
    } else if (row.unit === 'defense') {
      defense.push({ id: row.id, unit: 'defense', name: row.name, category: row.category as DefensiveCategory, keySlots: slots });
    } else {
      throw new Error(`Play ${row.id} has invalid unit: ${row.unit}`);
    }
  }
  _offensivePlays = offense;
  _defensivePlays = defense;
  _allPlays = [...offense, ...defense];
  _playById = new Map(_allPlays.map((p) => [p.id, p]));
}

function requireCatalog<T>(value: T | null): T {
  if (value == null) {
    throw new Error('Play catalog not loaded — call loadPlayCatalog(prisma) at process boot before using play library helpers.');
  }
  return value;
}

export function playById(id: string): Play | undefined {
  return requireCatalog(_playById).get(id);
}

export function offensivePlayById(id: string): OffensivePlay | undefined {
  const p = requireCatalog(_playById).get(id);
  return p?.unit === 'offense' ? p : undefined;
}

export function defensivePlayById(id: string): DefensivePlay | undefined {
  const p = requireCatalog(_playById).get(id);
  return p?.unit === 'defense' ? p : undefined;
}

export function playsForUnit(unit: PlayUnit): Play[] {
  return unit === 'offense' ? requireCatalog(_offensivePlays) : requireCatalog(_defensivePlays);
}

export function allPlays(): Play[] {
  return requireCatalog(_allPlays);
}

// Coerce arbitrary input into exactly 9 valid play IDs of the given unit,
// padding with defaults if needed.
export function normalizePlayLoadout(unit: PlayUnit, raw: unknown): string[] {
  const lib = playsForUnit(unit);
  const validIds = new Set(lib.map((p) => p.id));
  const incoming = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of incoming) {
    if (typeof id !== 'string' || !validIds.has(id) || seen.has(id)) continue;
    out.push(id);
    seen.add(id);
    if (out.length === 9) break;
  }
  // Pad with library defaults if user supplied fewer than 9.
  for (const p of lib) {
    if (out.length === 9) break;
    if (!seen.has(p.id)) { out.push(p.id); seen.add(p.id); }
  }
  return out;
}

// Default 9-play loadout: balanced category distribution (2-2-3-2 / 2-2-3-2).
export function defaultLoadout(unit: PlayUnit): string[] {
  const cats: PlayCategory[] = unit === 'offense'
    ? ['RUNNING', 'SHORT_PASS', 'MIDDLE_PASS', 'LONG_PASS']
    : ['ZONE', 'BLITZ', 'ZONE_BLITZ', 'MAN'];
  const distribution = [3, 2, 2, 2]; // 9 total
  const lib = playsForUnit(unit);
  const out: string[] = [];
  cats.forEach((cat, idx) => {
    const fromCat = lib.filter((p) => p.category === cat).slice(0, distribution[idx]);
    out.push(...fromCat.map((p) => p.id));
  });
  return out;
}

export function categoryCounts(unit: PlayUnit, playIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const byId = requireCatalog(_playById);
  for (const id of playIds) {
    const p = byId.get(id);
    if (!p || p.unit !== unit) continue;
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}
