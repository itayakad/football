# Football Game

Football Game is a full-stack American-football management sim with a pixel-art presentation. You take control of a club, shape its identity, build its roster and coaching staff, prepare weekly playbooks, and guide it through live matches, league standings, playoffs, and offseason progression.

The project is currently an active MVP/vertical slice: the core management and match loop are playable, while authentication, richer team artwork, and some long-term progression systems are still evolving.

## What you can do

- Manage a football club across a three-tier league pyramid.
- Review standings, recent form, upcoming opponents, and league news.
- Manage a 39-player roster plus head coach, offensive coordinator, and defensive coordinator.
- Inspect player ratings, attributes, contracts, salaries, ages, archetypes, and years with the club.
- Swap players between starter and bench roles.
- Change offensive philosophy and build separate nine-play offensive and defensive loadouts.
- Create, edit, delete, and select saved team schemes.
- Hire coaches and sign free-agent players.
- Scout upcoming opponents through matchup previews, ratings, personnel, schemes, and recommendations.
- Play matches interactively snap by snap, or let the coaching staff automate decisions.
- Review live possession, down, distance, field position, play calls, scores, and recent snap history.
- Read a generated play-by-play feed and tactical postgame summary.
- Finish seasons with league awards, playoff brackets, champions, promotion, relegation, retirements, contract progression, and coaching changes.

## Cool systems under the hood

### Playbook-driven team identity

Team identity is derived from the plays a team carries rather than from a fixed label. Offensive identities include Vertical, Run Heavy, Pass Heavy, and Balanced. Defensive identities include Pressure, Man Heavy, Zone Heavy, and Balanced.

Each team carries nine offensive and nine defensive plays. The match engine samples candidates from those loadouts, evaluates the matchup against the opponent’s calls, and lets coaching quality influence how often the best option is selected.

### Tactical matchup matrix

The engine models relationships between offensive and defensive categories:

- Running attacks can exploit aggressive blitzes.
- Quick passes can punish zone blitzes.
- Middle passes can find space against zone coverage.
- Deep passes are strongest against man coverage but vulnerable to zone.

Player ratings, positional slots, coordinator ratings, home-field advantage, play matchups, and controlled randomness all contribute to the result of a snap.

### Interactive matchday

Matches are played through a live state machine rather than a single instant result. Every decision advances the game state and exposes the current quarter, clock, possession, down, distance, field position, play calls, and snap log. Automation is available when you want the head coach to take over.

### Living league world

The seeded world contains Premier Division, First Division, and Second Division leagues. Teams play home-and-away regular-season schedules. The top six qualify for playoffs, with wild-card games, semifinals, and a final. At the end of a season, clubs can move between tiers and personnel can retire, progress through contracts, or be replaced.

### Pixel UI toolkit

The frontend includes a reusable pixel-art component layer built around the supplied art assets:

- `PixelButton`
- `OpponentPanel`
- `PixelImageFrame`
- `TeamBus`
- `PlayerHead`
- shared Press Start 2P typography

The home screen is assembled from dynamic React Native components rather than a single static image. The background, bus, panel, logo, menu tiles, icons, and player sprites remain separate layers so the UI can continue to grow.

## Tech stack

### Frontend

- React Native 0.81
- Expo SDK 54
- TypeScript
- React Navigation native stack
- TanStack React Query
- React Native Gesture Handler
- React Native Safe Area Context
- Expo Vector Icons
- Press Start 2P via `@expo-google-fonts/press-start-2p`
- iOS, Android, and web targets

### Backend

- Node.js
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- `ts-node` for development
- `nodemon` for API development

### Data and simulation

- Prisma migrations and relational models for leagues, teams, personnel, plays, matches, history, and live match state.
- A database-backed play catalog.
- Deterministic team/personnel helpers combined with randomized match outcomes.
- JSON-backed playbooks, gameplans, live state, season awards, and playoff brackets.

## Project structure

```text
football-manager/
├── backend/
│   ├── prisma/                 Database schema and migrations
│   └── src/
│       ├── api/                Express routes and response generators
│       └── simulation/         Match engine, playbooks, standings, playoffs, offseason
├── frontend/
│   ├── assets/pixel/            Supplied pixel-art assets and compositing derivatives
│   └── src/
│       ├── api/                Typed API client and response types
│       ├── components/         Shared and pixel UI components
│       ├── navigation/         Root navigation
│       ├── screens/             Game screens
│       ├── state/               Lightweight client state
│       └── theme/               Colors, spacing, and typography
├── backend/MATCH_ENGINE.md     Detailed match-engine design reference
└── start.sh                    Local two-process development launcher
```

## Requirements

- Node.js 20+ recommended
- npm
- PostgreSQL
- `tmux` if using `start.sh`
- An available PostgreSQL database and a `DATABASE_URL` environment variable

## Quick start

Create a PostgreSQL database and configure the backend:

```bash
cd backend
touch .env
```

Set `DATABASE_URL` in `backend/.env`, for example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/football_manager"
```

Install dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Apply migrations and create the initial world:

```bash
cd backend
npm run db:deploy
npm run seed
```

Start the backend in one terminal:

```bash
cd backend
npm run api:dev
```

Start Expo in another terminal:

```bash
cd frontend
npm start
```

Then open the app in an iOS simulator, Android emulator, or web browser.

## One-command local startup

If `tmux` is installed and PostgreSQL is available, the repository includes:

```bash
./start.sh
```

This command:

1. Stops processes using ports `3001` and `8081`.
2. Applies database migrations.
3. Builds the backend.
4. Reseeds the world.
5. Starts the backend API on port `3001`.
6. Starts Expo in a second tmux pane.

Important: `npm run seed` clears and recreates the simulated world. Do not use `start.sh` when you need to preserve local game data.

## Useful commands

### Backend

```bash
npm run api:dev       # API with automatic restart
npm run api           # API once
npm run build         # Compile TypeScript
npm run seed          # Reset and reseed the game world
npm run seed:plays    # Rebuild the global play catalog
npm run sim:multi     # Run multi-season simulation tooling
npm run db:deploy     # Apply Prisma migrations
npm run db:studio     # Open Prisma Studio
```

### Frontend

```bash
npm start             # Expo development server
npm run ios           # Expo iOS target
npm run android       # Expo Android target
npm run web           # Expo web target
npx tsc --noEmit      # Type-check the frontend
npx expo export --platform web
```

## API overview

The frontend talks to the backend at `http://localhost:3001` by default.

Important route groups include:

- `/api/me` and `/api/dashboard/:teamId` for the home dashboard.
- `/api/team/:teamId/roster` for players, coaches, ratings, and contracts.
- `/api/team/:teamId/schemes` for saved playbooks.
- `/api/coaches/market` and `/api/players/free-agents` for personnel moves.
- `/api/match/:matchId/preview` for scouting and pregame setup.
- `/api/match/:matchId/live/*` for interactive match state and decisions.
- `/api/league/:leagueId/standings` for standings and playoff context.
- `/api/history/:teamId` and offseason routes for season progression.

For Android emulators, update the frontend API base from `localhost` to `10.0.2.2`. For a physical device, use the development machine’s LAN IP.

## Current development notes

- Authentication is not implemented yet; the backend selects the user team using `USER_TEAM_NAME`, defaulting to `Dallas Vanguard`.
- Team and opponent logo art is currently represented by the supplied generic pixel helmet/league assets.
- The home bus currently uses generic supplied player heads; the next visual upgrade is wiring it to top-player portraits.
- The detailed match-engine behavior is documented in [MATCH_ENGINE.md](backend/MATCH_ENGINE.md).
- There is currently no dedicated automated test suite; TypeScript checks, Expo bundling, and simulation tooling are the primary validation paths.

## Roadmap ideas

- Authentication and multiple save slots.
- Real team identities, logos, uniforms, and player portraits.
- Top-player bus portraits sourced from roster data.
- More stadium effects, home-field modifiers, and match presentation layers.
- Deeper player development and performance history.
- Persistent settings and user preferences.
- Automated simulation and API test coverage.
