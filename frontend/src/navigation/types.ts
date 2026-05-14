// Type-safe navigation params for the root stack.
export type RootStackParamList = {
  Home:             undefined;
  Team:             undefined;
  League:           undefined;
  MatchPreview:     { matchId: string };
  MatchSim:         { matchId: string; userTeamId: string };
  Postgame:         { result: import('../api/types').SimulateResponse; userTeamId: string };
  ChooseScheme:     { unit: import('../api/types').SchemeUnit; mode?: 'team' | 'pregame'; matchId?: string };
  SeasonAwards:    { offseason: import('../api/types').OffseasonResponse; userTeamId: string };
  SeasonTransition: { offseason: import('../api/types').OffseasonResponse; userTeamId: string };
  PlayoffBracket:  { offseason: import('../api/types').OffseasonResponse; userTeamId: string };
};
