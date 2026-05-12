import { SimulateResponse } from '../api/types';

// Module-scoped result cache for the matchday flow:
// MatchPreview → simulates → stashes here → MatchSim & Postgame read it.
// Avoids passing a heavy object through navigation params.
//
// When auth/multiple matches arrive, this becomes a proper TanStack
// query cache entry keyed by matchId.
let last: SimulateResponse | null = null;

export const lastSim = {
  set(r: SimulateResponse) { last = r; },
  get():  SimulateResponse | null { return last; },
  clear() { last = null; },
};
