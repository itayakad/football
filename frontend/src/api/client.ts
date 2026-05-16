import {
  MeResponse, DashboardResponse, MatchPreviewResponse, SimulateResponse, Gameplan,
  LeagueStandingsResponse, RosterResponse, MarketResponse, HistoryResponse,
  OffseasonResponse, CoachMarketResponse, PlayerFreeAgentResponse,
  OffensivePhilosophy,
  SchemeUnit, TeamScheme,
} from './types';

// For iOS Simulator + web: localhost works.
// For Android emulator: use 10.0.2.2:3001 instead.
// For physical device: use the Mac's LAN IP (e.g. 192.168.x.x:3001).
export const API_BASE = 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  me: () =>
    request<MeResponse>('/api/me'),

  dashboard: (teamId: string) =>
    request<DashboardResponse>(`/api/dashboard/${teamId}`),

  matchPreview: (matchId: string, userTeamId: string) =>
    request<MatchPreviewResponse>(`/api/match/${matchId}/preview?userTeamId=${userTeamId}`),

  simulate: (matchId: string, userTeamId: string, gameplan: Gameplan) =>
    request<SimulateResponse>(`/api/match/${matchId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ userTeamId, gameplan }),
    }),

  simulateWithSchemes: (matchId: string, userTeamId: string, offenseSchemeId: string, defenseSchemeId: string) =>
    request<SimulateResponse>(`/api/match/${matchId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ userTeamId, offenseSchemeId, defenseSchemeId }),
    }),

  leagueStandings: (leagueId: string) =>
    request<LeagueStandingsResponse>(`/api/league/${leagueId}/standings`),

  roster: (teamId: string) =>
    request<RosterResponse>(`/api/team/${teamId}/roster`),

  updateOffensivePhilosophy: (teamId: string, offensivePhilosophy: OffensivePhilosophy) =>
    request<{ id: string; offensivePhilosophy: OffensivePhilosophy }>(`/api/team/${teamId}/philosophy`, {
      method: 'PATCH',
      body: JSON.stringify({ offensivePhilosophy }),
    }),

  updateDepthChart: (teamId: string, playerIds: string[]) =>
    request<{ ok: true }>(`/api/team/${teamId}/depth-chart`, {
      method: 'PATCH',
      body: JSON.stringify({ playerIds }),
    }),

  schemes: (teamId: string, unit?: SchemeUnit) =>
    request<{ schemes: TeamScheme[] }>(`/api/team/${teamId}/schemes${unit ? `?unit=${unit}` : ''}`),

  createScheme: (teamId: string, unit: SchemeUnit, name: string, plays: string[]) =>
    request<TeamScheme>(`/api/team/${teamId}/schemes`, {
      method: 'POST',
      body: JSON.stringify({ unit, name, plays }),
    }),

  updateScheme: (teamId: string, schemeId: string, updates: { name?: string; plays?: string[]; isDefault?: boolean }) =>
    request<TeamScheme>(`/api/team/${teamId}/schemes/${schemeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteScheme: (teamId: string, schemeId: string) =>
    request<{ ok: true }>(`/api/team/${teamId}/schemes/${schemeId}`, {
      method: 'DELETE',
    }),

  coachMarket: (teamId: string) =>
    request<CoachMarketResponse>(`/api/coaches/market?teamId=${teamId}`),

  hireCoach: (teamId: string, coachId: string) =>
    request<{ ok: true }>(`/api/coaches/${coachId}/hire`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  market: (teamId: string) =>
    request<MarketResponse>(`/api/market?teamId=${teamId}`),

  playerFreeAgents: (teamId: string, position: string, limit = 5) =>
    request<PlayerFreeAgentResponse>(`/api/players/free-agents?teamId=${teamId}&position=${encodeURIComponent(position)}&limit=${limit}`),

  signFreeAgent: (teamId: string, playerId: string) =>
    request<{ ok: true }>(`/api/players/free-agents/${playerId}/sign`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  listPlayer: (teamId: string, playerId: string) =>
    request<{ id: string }>('/api/market/list', {
      method: 'POST',
      body: JSON.stringify({ teamId, playerId }),
    }),

  buyListing: (listingId: string, buyerTeamId: string) =>
    request<{ ok: true }>(`/api/market/${listingId}/buy`, {
      method: 'POST',
      body: JSON.stringify({ buyerTeamId }),
    }),

  delistPlayer: (listingId: string, teamId: string) =>
    request<{ ok: true }>(`/api/market/${listingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ teamId }),
    }),

  acceptOffer: (offerId: string, teamId: string) =>
    request<{ ok: true }>(`/api/market/offers/${offerId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  rejectOffer: (offerId: string, teamId: string) =>
    request<{ ok: true }>(`/api/market/offers/${offerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  history: (teamId: string) =>
    request<HistoryResponse>(`/api/history/${teamId}`),

  finalizeSeason: () =>
    request<{ season: number }>('/api/season/finalize', { method: 'POST' }),

  advanceOffseason: () =>
    request<OffseasonResponse>('/api/offseason/advance', { method: 'POST' }),
};
