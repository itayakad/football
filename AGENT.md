# AGENT.md

Context for AI agents working on this codebase. Read once, refer back as needed.

---

## What this is

A **mobile-first online American football management game**. Users own fictional franchises, build rosters, set tactics, simulate matches. Inspired by Top Eleven, Football Manager, NFL franchise mode, and Sleeper's UI.

The product hierarchy in priority order:
1. **Simulation depth** — outcomes must reflect tactics, not just team ratings
2. **Tactical agency** — user pre-game choices meaningfully shift outcomes
3. **Matchday emotion** — live text feed, score ticking up, narrative payoff
4. **Premium mobile UX** — dark matte, large type, one decision per screen

The user is explicit: **do NOT overengineer, do NOT build microservices, do NOT add auth or polish before gameplay feels right.**

---

## Repo layout

```
football-manager/
├── backend/    Node 20 + TypeScript + Express + Prisma + PostgreSQL (Supabase)
├── frontend/   Expo SDK 54 + React Native 0.81 + React Navigation 7 + TanStack Query
└── shared/     Reserved for shared types (currently empty)
```

---

## Run commands

### Backend (`cd backend`)

| Command | What it does |
|---|---|
| `npm run seed` | Clear DB + reseed (3 leagues, 24 teams, 960 players, 168 fixtures) |
| `npm run simulate` | Seed + simulate full 14-week season + print standings & highlights |
| `npm run sim:multi 5` | Run N seasons, print aggregate balance report (use this to verify any tuning change) |
| `npm run api` | Express HTTP server on `:3001` |
| `npm run api:dev` | Same, with nodemon hot reload |
| `npx prisma migrate dev --name <name>` | Run a new migration after schema changes |
| `npx prisma studio` | DB GUI |

### Frontend (`cd frontend`)

| Command | What it does |
|---|---|
| `npm start` | Expo dev server (press `i` for iOS sim, `w` for web) |
| `npm run ios` / `android` / `web` | Direct platform launch |
| `npx tsc --noEmit` | Type-check without emitting |

### Full matchday flow (testing)

```bash
# Terminal 1
cd backend && npm run seed && npm run api

# Terminal 2
cd frontend && npm start
```

The user's team is hardcoded as **Dallas Vanguard**. Override with `USER_TEAM_NAME=...` before `npm run api`.

---

## Architecture

### Match engine — `backend/src/simulation/`

Core file: `matchEngine.ts`. The score calculation has 7 stacked layers:

1. **Base** — team rating differential + style-weighted morale + home field bonus
2. **Style matchup** — `STYLE_MATCHUP[offStyle][defStyle]` table in `styleModifiers.ts` (3×3 cells, each with `scoringMod` + `varianceMod`)
3. **Clock drain** — opponent's offensive style steals possessions (RUN_HEAVY drains 2pts, PASS_HEAVY gives 0.5pt back)
4. **Tempo** — `getTempoBonus(myTempo, oppTempo)`, can be overridden by gameplan
5. **Position groups** — `OL vs front 7`, `skill vs secondary`, `QB quality` — derived from `Player.overall`s
6. **Gameplan adjustments** — user-pickable offensive/defensive focus + tempo override
7. **Variance** — gaussian std scales with style × focus × opponent's defensive focus

Plus post-calculation:
- **AGG fatigue** — AGG defense's scoringMod decays from week 7 onward (`getFatigueAdjustedScoringMod`)
- **AGG penalty tax** — flat +1.0 to opponent score for AGG defense (PI / roughing)
- **Coverage bust events** — rare per-game roll, AGG defenses give up explosive plays
- **OT tiebreaker** — when regulation ends tied, weighted coin-flip on offense + morale

### Team identity (per-team enums)

```
offenseStyle  ∈ { RUN_HEAVY, BALANCED, PASS_HEAVY }
defenseStyle  ∈ { AGGRESSIVE, BALANCED, PREVENT }
tempo         ∈ { SLOW, NORMAL, FAST }
```

Hand-assigned in `backend/src/seed.ts` to give each team a distinct narrative archetype.

### Gameplans (user agency layer)

```
offensiveFocus ∈ { ATTACK_DEEP, BALANCED, QUICK_PASSING, ESTABLISH_RUN }
defensiveFocus ∈ { STOP_RUN, BALANCED, PREVENT_DEEP, BLITZ_HEAVY }
tempoOverride  ∈ { SLOW_DOWN, STANDARD, PUSH_TEMPO }
```

Stored as `Json` on `Match.homeGameplan` / `Match.awayGameplan`. AI teams have gameplans chosen by `chooseAIGameplan(team, opponent)` in `aiCoach.ts`. Users can override their team's gameplan pre-match — `recommendGameplan()` returns gameplan + reasoning for the in-app advisor.

### Backend HTTP API — `backend/src/api/`

| Endpoint | Purpose |
|---|---|
| `GET /api/me` | Returns the hardcoded user's team id |
| `GET /api/dashboard/:teamId` | Home screen data (team, next match, standings, recent result) |
| `GET /api/match/:matchId/preview?userTeamId=…` | Opponent profile + AI coach recommendation |
| `POST /api/match/:matchId/simulate` | Single-match sim with user gameplan, returns result + ~25 feed events |
| `GET /api/match/:matchId` | Read-only match record |
| `GET /api/league/:leagueId/standings` | Full league table |

Single-match simulator (`simulateOne.ts`) is separate from the season runner (`seasonSimulator.ts`). The live text feed (`feedGenerator.ts`) is synthesized post-hoc from quarter scores — there's no per-event simulation.

### Frontend — `frontend/src/`

```
api/         client.ts (fetch wrapper) + types.ts (mirrors backend response types)
theme/       colors, typography, spacing — dark matte palette
components/  Card, Button, Pill (with style-identity color map), ScreenContainer, SectionLabel
navigation/  RootNavigator (bottom tabs + modal stack), types
screens/     HomeScreen, MatchPreviewScreen, MatchSimScreen, PostgameScreen, TeamScreen, LeagueScreen, MatchTabScreen
state/       userTeam (resolves via /api/me), lastSim (module-scope cache for the matchday flow)
```

Navigation:
- **Bottom tabs**: Home / Team / League / Match
- **Modal stack**: `MatchPreview → MatchSim → Postgame`
- Tap next-match card on Home → opens MatchPreview as a modal

The MatchSim screen reveals feed events at 1.4s intervals (2.2s halftime pause), score ticks up in the sticky header. After all events fire, a "View Recap" button transitions to Postgame.

Sim results pass through `frontend/src/state/lastSim.ts` (module-scope) rather than navigation params — avoids serializing a 25-event payload through React Navigation.

---

## Conventions

- **TypeScript strict mode** in both projects
- **No emoji** in code or UI unless explicitly requested
- **Comments are rare** — only when WHY is non-obvious. Don't write WHAT comments
- **Edit before create** — prefer modifying existing files over scaffolding new ones
- **No premature abstraction** — three similar lines beats a config-driven helper
- **Don't validate impossibilities** — internal code can trust internal code; only validate at system boundaries (HTTP, user input)
- **Don't reference the current task in code** — file comments shouldn't say "added for the X feature"; that belongs in commits/PRs

---

## Gotchas

- **DB connection**: backend/.env has `DATABASE_URL` pointing at Supabase. Don't commit secrets
- **Prisma migrations** required after every `schema.prisma` change. Run `npx prisma migrate dev --name <thing>`. The client regenerates automatically; if types look stale, `npx prisma generate`
- **Re-seeding clears the DB**. Safe to run repeatedly. The simulate.ts and multiSeason.ts scripts both clear before running
- **Network from Expo**:
  - iOS Simulator + web: `localhost:3001` works
  - Android emulator: change `API_BASE` in `frontend/src/api/client.ts` to `http://10.0.2.2:3001`
  - Physical device: use the Mac's LAN IP (e.g. `http://192.168.1.50:3001`)
- **`Match.homeGameplan` / `awayGameplan` are JSON columns** — Prisma typing requires `as any` when writing
- **Don't simulate matches twice** — the API returns `409` if the match has `played: true`. Re-seed if you need to re-test
- **Background API processes hold port 3001** — kill with `lsof -ti :3001 | xargs kill -9` if you see `EADDRINUSE`
- **Yard estimates in narratives are pure flavor** — they overshoot reality (700+ yard games happen). Tune in `matchNarrative.ts` if it bugs you, but they're not persisted as stats

---

## Balance state (current targets)

The match engine has been tuned across many iterations. After running `npm run sim:multi 5`, expect roughly:

| Metric | Target |
|---|---|
| AGG defense title share | ~50% (was 80% pre-tuning) |
| BAL / PRV defense titles | ~30% / ~15% |
| RUN / BAL / PASS offense titles | each above 25% (no style auto-loses) |
| Avg PPG per team | ~20 |
| Home win rate | 51-56% |
| Tie rate | <1% (OT tiebreaker handles it) |

**All tunable constants live in `backend/src/simulation/styleModifiers.ts` and `backend/src/simulation/gameplan.ts`.** When tuning: change one knob, run `npm run sim:multi 5`, compare against these targets. Don't rely on a single 14-game season — too noisy.

---

## What's built vs deferred

### Built
- Full match engine (7-layer + post-calc)
- Single-match + full-season simulators
- Hand-tuned 24-team identity universe across 3 league tiers
- AI coach with reasoning for the in-app advisor
- HTTP API
- Mobile vertical slice: Home → MatchPreview → MatchSim → Postgame

### Deferred (next phases, in user's stated priority order)
1. Halftime in-game adjustments
2. Coach entities (persistent staff with skills affecting development/morale/scheme bonuses)
3. Season history / records / awards
4. Team screen (roster, depth chart) — placeholder for now
5. Full league standings table — placeholder
6. Trade market / free agency
7. Rookie draft
8. Promotion / relegation logic
9. Auth + multi-user shared world

**Don't pull from this list without asking.** The user moves one phase at a time and verifies between phases.

---

## Working with the user

The user is a product-focused technical founder. Patterns to expect:

- They give detailed specs with explicit constraints ("DO NOT do X")
- They prefer **terse responses** with concrete file paths and line numbers
- They expect **verification between phases** — running `sim:multi`, smoke-testing endpoints, type-checking
- They're sharp about balance and game feel — bring numerical evidence, not vibes
- They reframe problems often (e.g. "model AGG's costs, don't nerf its rewards") — when they reframe, **listen and adopt the new framing**, don't argue from the old one

Default mode: build → verify → report results → ask what direction next.
