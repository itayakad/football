// TypeScript types matching backend API responses.
// Kept in sync manually for now — once we add a shared package, these will move there.

export type OffenseStyle  = 'RUN_HEAVY'  | 'BALANCED' | 'PASS_HEAVY';
export type DefenseStyle  = 'AGGRESSIVE' | 'BALANCED' | 'PREVENT';
export type OffensiveIdentity = 'VERTICAL' | 'RUN_HEAVY' | 'PASS_HEAVY' | 'BALANCED';
export type DefensiveIdentity = 'PRESSURE' | 'MAN_HEAVY' | 'ZONE_HEAVY' | 'BALANCED';

export interface TeamIdentity {
  offense: OffensiveIdentity;
  defense: DefensiveIdentity;
}

export type OffensivePhilosophy =
  | 'WEST_COAST'
  | 'VERTICAL_SPREAD'
  | 'SMASHMOUTH'
  | 'RPO_HEAVY'
  | 'QUICK_GAME'
  | 'PLAY_ACTION_HEAVY';

export type SchemeUnit = 'offense' | 'defense';
export type OffensiveCategory = 'RUNNING' | 'SHORT_PASS' | 'MIDDLE_PASS' | 'LONG_PASS';
export type DefensiveCategory = 'ZONE' | 'BLITZ' | 'ZONE_BLITZ' | 'MAN';
export type PlayCategory = OffensiveCategory | DefensiveCategory;

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
  category: PlayCategory;
  categoryLabel: string;
  categoryColor: string;
  keySlots: string[];
  family?: PlayFamily;
  tags?: string[];
  diagram?: DiagramPath[];
}

export interface TeamScheme {
  id: string;
  unit: SchemeUnit;
  name: string;
  plays: string[];
  playTemplates: PlayTemplate[];
  isDefault: boolean;
}

export interface Gameplan {
  offensivePlays: string[];
  defensivePlays: string[];
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
    identity:      TeamIdentity;
    offensivePhilosophy: OffensivePhilosophy;
    offenseRating: number;
    defenseRating: number;
    leagueName:    string;
    leagueTier:    number;
  };
  nextMatch: {
    id:         string;
    week:       number;
    totalWeeks: number;
    isHome:     boolean;
    opponent: {
      id:           string;
      name:         string;
      identity:     TeamIdentity;
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
    offensiveDistribution: Array<{ category: OffensiveCategory; count: number; label: string }>;
    defensiveDistribution: Array<{ category: DefensiveCategory; count: number; label: string }>;
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
    identity:      TeamIdentity;
    offensivePhilosophy: OffensivePhilosophy;
    offenseRating: number;
    defenseRating: number;
  };
  opponent: {
    id:            string;
    name:          string;
    identity:      TeamIdentity;
    offensivePhilosophy: OffensivePhilosophy;
    offenseRating: number;
    defenseRating: number;
    groups:        PositionGroups;
  };
  recommendation: CoachRecommendation;
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
    identity:      TeamIdentity;
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
  depthOrder:    number;
  archetype:     string;
  attributes:    Record<string, number>;
  yearsWithClub: number;
  contract: {
    yearsLeft:          number;
    salary:             number;
    extensionEligible:  boolean;
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
    identity:      TeamIdentity;
    offensivePhilosophy: OffensivePhilosophy;
    salaryCap:     number;
    salaryUsed:    number;
    coaches: Array<{
      id:                   string;
      name:                 string;
      role:                 'HEAD_COACH' | 'OC' | 'DC';
      philosophy:           string;
      developmentSpecialty: string;
      aggression:           number;
      reputation:           number;
      overall:              number;
      offenseRating:        number;
      defenseRating:        number;
      careerWins:           number;
      careerLosses:         number;
      titles:               number;
      hotSeat:              number;
      yearsWithTeam:        number;
      age:                  number;
    }>;
  };
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
    reputation:           number;
    overall:              number;
    offenseRating:        number;
    defenseRating:        number;
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
  archetype: string;
  value:     number;
  story:     string;
  contract: {
    yearsLeft:         number;
    salary:            number;
    extensionEligible: boolean;
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
      identity:     TeamIdentity;
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
      identity:     TeamIdentity;
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
  clock:     string;
  text:      string;
  detail?:   string;
  homeScore: number;
  awayScore: number;
  type:      'KICKOFF' | 'SCORE' | 'TURNOVER' | 'PUNT' | 'PLAY' | 'HALFTIME' | 'FINAL';
  points?:   number;
  scoringTeam?: 'home' | 'away';
  possessionTeam?: 'home' | 'away';
  down?: number;
  distance?: number;
  yardLine?: number;
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
  seasonAdvance: OffseasonResponse | null;
}
