import { DefensiveIdentity, OffensiveIdentity, TeamIdentity } from '../api/types';

const TEAM_ARCHETYPES: Record<OffensiveIdentity, Record<DefensiveIdentity, string>> = {
  VERTICAL: {
    PRESSURE:   'Blitz Punishers',
    MAN_HEAVY:  'Matchup Killers',
    ZONE_HEAVY: 'Coverage Breakers',
    BALANCED:   'Downfield Authority',
  },

  RUN_HEAVY: {
    PRESSURE:   'Trench Kings',
    MAN_HEAVY:  'Body Blow',
    ZONE_HEAVY: 'Clock Burners',
    BALANCED:   'Ground Empire',
  },

  PASS_HEAVY: {
    PRESSURE:   'Pressure Cookers',
    MAN_HEAVY:  'Route Runners',
    ZONE_HEAVY: 'Zone Shredders',
    BALANCED:   'Air Supremacy',
  },

  BALANCED: {
    PRESSURE:   'Controlled Chaos',
    MAN_HEAVY:  'Counterpunch',
    ZONE_HEAVY: 'Field Dictators',
    BALANCED:   'Total Control',
  },
};

export function teamArchetypeLabel(identity: TeamIdentity): string {
  return TEAM_ARCHETYPES[identity.offense][identity.defense];
}
