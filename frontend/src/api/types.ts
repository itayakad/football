// TypeScript types matching backend API responses.
// Kept in sync manually for now — once we add a shared package, these will move there.

export type OffenseStyle  = 'RUN_HEAVY'  | 'BALANCED' | 'PASS_HEAVY';
export type DefenseStyle  = 'AGGRESSIVE' | 'BALANCED' | 'PREVENT';
export type Tempo         = 'SLOW'       | 'NORMAL'   | 'FAST';

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
export type SchemeUnit = 'offense' | 'defense';

export type PlayFamily =
  | 'RUN_MIDDLE'
  | 'RUN_WIDE'
  | 'QUICK_PASS'
  | 'INTERMEDIATE_PASS'
  | 'DEEP_PASS'
  | 'PLAY_ACTION'
  | 'MISDIRECTION'
  | 'ZONE_COVERAGE'
  | 'MAN_COVERAGE'
  | 'BLITZ'
  | 'RUN_FIT'
  | 'CONTAIN';

export interface DiagramPath {
  label: string;
  color: string;
  points: Array<[number, number]>;
}

export interface PlayTemplate {
  id: string;
  unit: SchemeUnit;
  name: string;
  family: PlayFamily;
  tags: string[];
  diagram: DiagramPath[];
}

export interface TeamScheme {
  id: string;
  unit: SchemeUnit;
  name: string;
  plays: string[];
  playTemplates: PlayTemplate[];
  isDefault: boolean;
}

export interface LineupBlocker {
  playerId: string;
  name: string;
  position: string;
  status: string;
  message: string;
}

export interface LineupReadiness {
  blocked: boolean;
  blockers: LineupBlocker[];
  warnings: LineupBlocker[];
}

export interface Gameplan {
  offensiveConcepts: [OffensiveConcept, OffensiveConcept, OffensiveConcept];
  defensiveCounters: [DefensiveCounter, DefensiveCounter, DefensiveCounter];
  tempoOverride: TempoOverride;
  offenseSchemeId?: string | null;
  defenseSchemeId?: string | null;
  offensivePlays?: string[];
  defensivePlays?: string[];
  offenseSchemeName?: string;
  defenseSchemeName?: string;
}

export interface MeResponse {
  id:       string;
  name:     string;
  leagueId: string;
}

export interface RecentForm {
  streak:      { type: 'W' | 'L' | 'T' | 'NONE'; count: number };
  lastResults: Array<'W' | 'L' | 'T'>;
}

export interface NewsItem {
  headline:   string;
  summary:    string;
  category:   'BLOWOUT' | 'UPSET' | 'THRILLER' | 'STANDINGS' | 'STREAK' | 'COACH' | 'PLAYER';
  week:       number;
  leagueName?: string;
  sourceName?: string;
}

export interface DashboardResponse {
  team: {
    id:            string;
    name:          string;
    offenseStyle:  OffenseStyle;
    offensivePhilosophy: OffensivePhilosophy;
    defenseStyle:  DefenseStyle;
    tempo:         Tempo;
    offenseRating: number;
    defenseRating: number;
    morale:        number;
    leagueName:    string;
    leagueTier:    number;
  };
  nextMatch: {
    id:     string;
    week:   number;
    isHome: boolean;
    opponent: {
      id:           string;
      name:         string;
      offenseStyle: OffenseStyle;
      defenseStyle: DefenseStyle;
      tempo:        Tempo;
      morale:       number;
    };
  } | null;
  recentResult: {
    id:           string;
    week:         number;
    opponentName: string;
    myScore:      number;
    theirScore:   number;
    result:       'W' | 'L' | 'T';
  } | null;
  standingsPosition: {
    rank:   number | null;
    total:  number;
    wins:   number;
    losses: number;
    ties:   number;
  };
  recentForm: RecentForm;
  news:       NewsItem[];
  staffActions: StaffActionsState;
  lineupReadiness: LineupReadiness;
}

export interface StaffActionEntry {
  available:    boolean;
  reason:       string | null;
  cost:         number;
  usedThisWeek: boolean;
  specialty:    string | null;
}

export interface StaffActionsState {
  currentWeek: number | null;
  train:       StaffActionEntry;
  recruit:     StaffActionEntry;
}

export type TrainMode = 'STRENGTH' | 'CONDITIONING';

export type TrainResponse =
  | {
      ok:             true;
      mode:           'STRENGTH';
      cost:           number;
      player:         { id: string; name: string; position: string; overall: number; delta: number };
      atPotential:    boolean;
      specialtyMatch: boolean;
    }
  | {
      ok:             true;
      mode:           'CONDITIONING';
      cost:           number;
      player:         { id: string; name: string; position: string; conditioning: number; weeksAdded: number };
      specialtyMatch: boolean;
    };

export interface HealResponse {
  ok:     true;
  cost:   number;
  player: { id: string; name: string; position: string; status: string; weeks: number };
}

export interface RecruitResponse {
  ok:        true;
  cost:      number;
  specialty: string;
  listings:  Array<{ id: string; name: string; position: string; overall: number; age: number; teamName: string }>;
}

export interface PositionGroups {
  qb:             number;
  skillPositions: number;
  oLine:          number;
  frontSeven:     number;
  secondary:      number;
}

export interface CoachRecommendation {
  gameplan: Gameplan;
  reasoning: {
    offensive: string;
    defensive: string;
    tempo:     string;
    offensiveConcepts: Array<{ concept: OffensiveConcept; reason: string }>;
    defensiveCounters: Array<{ counter: DefensiveCounter; reason: string }>;
  };
}

export interface MatchPreviewResponse {
  matchId: string;
  week:    number;
  isHome:  boolean;
  myForm:  RecentForm;
  oppForm: RecentForm;
  myTeam: {
    id:            string;
    name:          string;
    offenseStyle:  OffenseStyle;
    offensivePhilosophy: OffensivePhilosophy;
    defenseStyle:  DefenseStyle;
    tempo:         Tempo;
    offenseRating: number;
    defenseRating: number;
  };
  opponent: {
    id:            string;
    name:          string;
    offenseStyle:  OffenseStyle;
    offensivePhilosophy: OffensivePhilosophy;
    defenseStyle:  DefenseStyle;
    tempo:         Tempo;
    offenseRating: number;
    defenseRating: number;
    morale:        number;
    groups:        PositionGroups;
  };
  recommendation: CoachRecommendation;
  lineupReadiness: LineupReadiness;
  schemes: TeamScheme[];
  playTemplates: {
    offense: PlayTemplate[];
    defense: PlayTemplate[];
  };
}

export interface LeagueStandingsResponse {
  league: {
    id:   string;
    name: string;
    tier: number;
  } | null;
  standings: Array<{
    teamId:        string;
    teamName:      string;
    wins:          number;
    losses:        number;
    ties:          number;
    pointsFor:     number;
    pointsAgainst: number;
    diff:          number;
    offenseStyle:  OffenseStyle;
    defenseStyle:  DefenseStyle;
    tempo:         Tempo;
    coaches: Array<{
      id:         string;
      name:       string;
      role:       'HEAD_COACH' | 'OC' | 'DC';
      philosophy: string;
      reputation: number;
    }>;
    topPlayers: Array<{
      id:       string;
      name:     string;
      position: string;
      overall:  number;
      age:      number;
    }>;
  }>;
}

export interface RosterPlayer {
  id:            string;
  name:          string;
  position:      string;
  overall:       number;
  potential:     number;
  age:           number;
  morale:        number;
  fatigue:       number;
  conditioning:  number;
  depthOrder:    number;
  archetype:     string;
  traits:        string[];
  attributes:    Record<string, number>;
  yearsWithClub: number;
  contract: {
    yearsLeft:          number;
    salary:             number;
    extensionEligible:  boolean;
  };
  injury: {
    status: 'HEALTHY' | 'QUESTIONABLE' | 'MINOR' | 'MULTI_WEEK';
    type:   string | null;
    weeks:  number;
  };
  schemeFit: {
    label:  'Excellent Fit' | 'Solid Fit' | 'Development Fit';
    detail: string;
  };
}

export interface RosterResponse {
  team: {
    id:            string;
    name:          string;
    offenseRating: number;
    defenseRating: number;
    morale:        number;
    offenseStyle:  OffenseStyle;
    offensivePhilosophy: OffensivePhilosophy;
    defenseStyle:  DefenseStyle;
    tempo:         Tempo;
    salaryCap:     number;
    salaryUsed:    number;
    injuries:      number;
    healAction:    StaffActionEntry;
    coaches: Array<{
      id:                   string;
      name:                 string;
      role:                 'HEAD_COACH' | 'OC' | 'DC' | 'TRAINER' | 'MEDICAL' | 'RECRUITMENT';
      philosophy:           string;
      developmentSpecialty: string;
      aggression:           number;
      moraleImpact:         number;
      preferredTempo:       Tempo;
      reputation:           number;
      careerWins:           number;
      careerLosses:         number;
      titles:               number;
      hotSeat:              number;
      yearsWithTeam:        number;
      age:                  number;
    }>;
  };
  injuryReport: Array<{
    playerId: string;
    name:     string;
    position: string;
    status:   'QUESTIONABLE' | 'MINOR' | 'MULTI_WEEK';
    type:     string | null;
    weeks:    number;
  }>;
  lineupReadiness: LineupReadiness;
  schemes: TeamScheme[];
  playTemplates: {
    offense: PlayTemplate[];
    defense: PlayTemplate[];
  };
  groups: Array<{
    key:     string;
    label:   string;
    players: RosterPlayer[];
  }>;
}

export interface CoachMarketResponse {
  team: {
    id: string;
    money: number;
  };
  candidates: Array<{
    id:                   string;
    name:                 string;
    role:                 'HEAD_COACH' | 'OC' | 'DC';
    philosophy:           string;
    developmentSpecialty: string;
    aggression:           number;
    moraleImpact:         number;
    preferredTempo:       Tempo;
    reputation:           number;
    careerWins:           number;
    careerLosses:         number;
    titles:               number;
    hotSeat:              number;
    yearsWithTeam:        number;
    age:                  number;
    cost:                 number;
    story:                string;
    canHire:              boolean;
  }>;
}

export interface MarketPlayer {
  id:        string;
  name:      string;
  position:  string;
  overall:   number;
  potential: number;
  age:       number;
  morale:    number;
  fatigue:   number;
  archetype: string;
  value:     number;
  story:     string;
  contract: {
    yearsLeft:         number;
    salary:            number;
    extensionEligible: boolean;
  };
  injury: {
    status: 'HEALTHY' | 'QUESTIONABLE' | 'MINOR' | 'MULTI_WEEK';
    type:   string | null;
    weeks:  number;
  };
}

export interface MarketResponse {
  team: {
    id:         string;
    name:       string;
    money:      number;
    salaryCap:  number;
    salaryUsed: number;
    capSpace:   number;
  };
  listings: Array<{
    id:          string;
    askingPrice: number;
    sellerTeam: {
      id:           string;
      name:         string;
      offenseStyle: OffenseStyle;
      defenseStyle: DefenseStyle;
      tempo:        Tempo;
    };
    player: MarketPlayer;
    canBuy: boolean;
  }>;
  incomingOffers: Array<{
    id:     string;
    amount: number;
    buyerTeam: {
      id:           string;
      name:         string;
      offenseStyle: OffenseStyle;
      defenseStyle: DefenseStyle;
      tempo:        Tempo;
    };
    player: MarketPlayer;
  }>;
}

export interface HistoryResponse {
  teamHistory: Array<{
    id:            string;
    season:        number;
    teamName:      string;
    leagueName:    string;
    tier:          number;
    rank:          number;
    wins:          number;
    losses:        number;
    ties:          number;
    pointsFor:     number;
    pointsAgainst: number;
    diff:          number;
    resultLabel:   string;
  }>;
  leagueHistory: Array<{
    id:               string;
    season:           number;
    leagueName:       string;
    tier:             number;
    championTeamName: string;
    mvpPlayerName:    string | null;
    mvpTeamName:      string | null;
    biggestGame:      string | null;
  }>;
  trades: Array<{
    id:           string;
    season:       number;
    playerName:   string;
    fromTeamName: string;
    toTeamName:   string;
    fee:          number;
    story:        string;
  }>;
}

export interface PlayerAward {
  playerId:   string;
  playerName: string;
  teamName:   string;
  position:   string;
  overall:    number;
  age:        number;
}

export interface CoachAward {
  coachId:   string;
  coachName: string;
  teamName:  string;
  wins:      number;
  losses:    number;
}

export interface LeagueAwards {
  mvp:    PlayerAward | null;
  opoy:   PlayerAward | null;
  dpoy:   PlayerAward | null;
  roty:   PlayerAward | null;
  hcoty:  CoachAward | null;
}

export interface LeagueAwardsPayload {
  leagueId:   string;
  leagueName: string;
  tier:       number;
  awards:     LeagueAwards;
}

export type PlayoffRound = 'WILD_CARD' | 'SEMI' | 'FINAL';

export interface PlayoffSeed {
  rank:     number;
  teamId:   string;
  teamName: string;
  record:   string;
}

export interface PlayoffMatchOutcome {
  matchId:      string;
  round:        PlayoffRound;
  homeTeamId:   string;
  homeTeamName: string;
  homeSeed:     number;
  awayTeamId:   string;
  awayTeamName: string;
  awaySeed:     number;
  homeScore:    number;
  awayScore:    number;
  winnerTeamId: string;
}

export interface LeaguePlayoffBracket {
  leagueId:         string;
  leagueName:       string;
  seeds:            PlayoffSeed[];
  wildCard:         PlayoffMatchOutcome[];
  semi:             PlayoffMatchOutcome[];
  final:            PlayoffMatchOutcome | null;
  championTeamId:   string | null;
  championTeamName: string | null;
}

export interface OffseasonResponse {
  season: number;
  champions: Array<{ leagueName: string; tier: number; championTeamName: string; mvpPlayerName: string | null }>;
  movements: Array<{ teamId: string; teamName: string; fromTier: number; toTier: number; type: 'PROMOTED' | 'RELEGATED' }>;
  retirements: Array<{ playerName: string; teamName: string; age: number; overall: number }>;
  progression: {
    improved: number;
    declined: number;
    freeAgentsListed: number;
  };
  coachMoves: Array<{
    teamName: string;
    role: string;
    outgoingName: string;
    incomingName: string;
    reason: 'FIRED' | 'RETIRED' | 'POACHED';
  }>;
  awards:   LeagueAwardsPayload[];
  playoffs: LeaguePlayoffBracket[];
  nextSeasonWeekCount: number;
}

export interface FeedEvent {
  quarter:   number;
  text:      string;
  homeScore: number;
  awayScore: number;
  type:      'KICKOFF' | 'SCORE' | 'TURNOVER' | 'PUNT' | 'PLAY' | 'HALFTIME' | 'FINAL';
  points?:   number;
  scoringTeam?: 'home' | 'away';
  possessionTeam?: 'home' | 'away';
}

export interface SimulateResponse {
  matchId:       string;
  homeScore:     number;
  awayScore:     number;
  homeTeamName:  string;
  awayTeamName:  string;
  homeGameplan:  Gameplan;
  awayGameplan:  Gameplan;
  narrative:     string;
  keyMatchup:    string;
  quarterScores: Array<[number, number]>;
  events:        FeedEvent[];
  moraleChange:  { home: number; away: number };
  injuryReport:  Array<{ playerId: string; playerName: string; teamId: string; status: string; type: string | null; weeks: number }>;
  seasonAdvance: OffseasonResponse | null;
}
