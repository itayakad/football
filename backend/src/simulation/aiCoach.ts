import { Gameplan, defaultGameplan, normalizeGameplan } from './gameplan';
import { categoryCounts, CATEGORY_LABEL, OffensiveCategory, DefensiveCategory } from './playLibrary';

// Coaches no longer pick weekly "concepts/counters". The team's identity IS its
// 9-play loadout — the AI just returns that loadout. The previously-rich
// matchup advisor now describes the team's category distribution instead.

interface CoachableTeam {
  name?: string;
  offensivePlays?: string[];
  defensivePlays?: string[];
}

export interface CoachRecommendation {
  gameplan: Gameplan;
  reasoning: {
    offensive: string;
    defensive: string;
    offensiveDistribution: Array<{ category: OffensiveCategory; count: number; label: string }>;
    defensiveDistribution: Array<{ category: DefensiveCategory; count: number; label: string }>;
  };
}

export function chooseAIGameplan(team: CoachableTeam): Gameplan {
  const defaults = defaultGameplan();
  return normalizeGameplan({
    offensivePlays: team.offensivePlays ?? defaults.offensivePlays,
    defensivePlays: team.defensivePlays ?? defaults.defensivePlays,
  });
}

export function recommendGameplan(team: CoachableTeam): CoachRecommendation {
  const gameplan = chooseAIGameplan(team);

  const offCats = categoryCounts('offense', gameplan.offensivePlays);
  const defCats = categoryCounts('defense', gameplan.defensivePlays);

  const offDist: Array<{ category: OffensiveCategory; count: number; label: string }> =
    (['RUNNING', 'SHORT_PASS', 'MIDDLE_PASS', 'LONG_PASS'] as OffensiveCategory[])
      .map((category) => ({ category, count: offCats[category] ?? 0, label: CATEGORY_LABEL[category] }))
      .filter((entry) => entry.count > 0);

  const defDist: Array<{ category: DefensiveCategory; count: number; label: string }> =
    (['ZONE', 'BLITZ', 'ZONE_BLITZ', 'MAN'] as DefensiveCategory[])
      .map((category) => ({ category, count: defCats[category] ?? 0, label: CATEGORY_LABEL[category] }))
      .filter((entry) => entry.count > 0);

  const offSummary = offDist.length
    ? offDist.map((d) => `${d.count}× ${d.label}`).join(', ')
    : 'Balanced offensive call sheet.';
  const defSummary = defDist.length
    ? defDist.map((d) => `${d.count}× ${d.label}`).join(', ')
    : 'Balanced defensive call sheet.';

  return {
    gameplan,
    reasoning: {
      offensive: offSummary,
      defensive: defSummary,
      offensiveDistribution: offDist,
      defensiveDistribution: defDist,
    },
  };
}
