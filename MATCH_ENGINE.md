# MATCH_ENGINE.md

How a single match is simulated, end to end. Source of truth: `backend/src/simulation/matchEngine.ts` (+ `playLibrary.ts`, `gameplan.ts`, `aiCoach.ts`, `standings.ts`). Everything below is derived from that code, not from any older design notes.

---

## 1. Entry point

```
simulateMatch(home, away, week, homeGameplan, awayGameplan): MatchSimResult
```

Inputs:

- **`TeamMatchProfile`** — `{ id, name, players, coaches?, offensivePlays?, defensivePlays? }`. The caller (`simulateOne.ts` / `seasonSimulator.ts`) pulls personnel from Prisma, splits coaches from players via `isCoachPosition`, and passes everything in.
- **`Gameplan`** — `{ offensivePlays: string[9], defensivePlays: string[9] }`. Either the user’s submitted gameplan (only for the user’s team, only via `POST /api/match/:matchId/simulate`) or `chooseAIGameplan(team)` which just normalizes the team’s saved 9-play loadouts.

Output: `MatchSimResult` containing `homeScore`, `awayScore`, `quarterScores`, `scoringDrives`, `drives` (full drive-by-drive log), `plays` (every play event), and a `narrative` + `keyMatchup` string.

The winner is whichever score is higher. There is no separate "winner" field — `standings.ts:computeStandings()` reads `homeScore` vs `awayScore` to tally W/L/T:

```ts
if (match.homeScore > match.awayScore)      home.wins++,  away.losses++;
else if (match.awayScore > match.homeScore) away.wins++,  home.losses++;
else                                        home.ties++,  away.ties++;
```

Ties only happen if regulation **and** the OT tiebreaker both stall — see §7.

---

## 2. Team context (`buildContext`)

Before any drives run, each team is converted into a `TeamCtx`:

- **`slots: SlotMap`** — `buildSlotMap(players)` takes the roster and ranks players within each position by `overall`, then assigns the top N into stable slot IDs (`QB`, `RB`, `WR`, `T/G/C`, `EDGE1/2`, `DT1/2`, `MLB/WLB/SLB`, `CB1/2/NCB`, `FS/SS`). Empty slots fall back to a flat **55 OVR**.
- **`offense` / `defense`** — the 9 playbook entries resolved from gameplan IDs.
- **`offenseCategoryCounts` / `defenseCategoryCounts`** — how many of the 9 plays fall in each category. (Used for *opponent-aware* candidate scoring, not for raw play frequency — see §4.)
- **`coach: { hcOverall, hcOffense, hcDefense, ocOverall, dcOverall }`** — HC has split `stat1` (offense) / `stat2` (defense); OC/DC use their overall. Missing coaches default to 60.

---

## 3. The 22-drive shell

```ts
const TOTAL_DRIVES = 22;                       // ~11 per team
const QUARTER_BREAKPOINTS = [5, 11, 16, 22];   // driveIdx < bp ⇒ quarter
```

So drives 0–4 are Q1, 5–10 are Q2, 11–15 are Q3, 16–21 are Q4.

Match flow:

1. **Coin flip** — `Math.random() < 0.5` decides who receives the kickoff and gets drive 0. The other team gets drive 1. Drives strictly alternate **only after scores/turnovers**, never automatically.
2. For each drive `i = 0..21`: `simulateDrive(offCtx, defCtx, i, nextStart, quarter)`.
3. After each drive, possession + next starting field position are set by the drive result:

| Drive result | New possession | New `nextStart` (offense yardline 0–100) |
|---|---|---|
| `TD`, `FG`, `DEFENSIVE_TD` | flips | 25 |
| `SAFETY` | flips (team that gave it up free-kicks) | 40 |
| `PUNT` | flips | `clamp(100 − endYL − 30 − rand(0..11), 5, 80)` |
| `MISSED_FG` | flips | `max(20, 100 − endYL)` |
| `TURNOVER` / `TURNOVER_ON_DOWNS` | flips | `clamp(100 − endYL, 5, 95)` |

Note: the engine assumes alternating possession after every drive type listed — there are no consecutive same-team drives.

4. **Overtime** — if `homeScore === awayScore` after 22 drives:
   - One sudden-death possession each, in coin-flip order (`Math.random() < 0.55` → home first, else away first). First TD ends OT.
   - If still tied, a **hard tiebreaker** awards 3 points: `Math.random() < 0.55` → home wins, else away. So the home team has a slight built-in OT edge (~55% in both layers).

---

## 4. Per-drive simulation (`simulateDrive`)

State: `yardLine`, `down`, `distance`. Initial: `down=1, distance=10, yardLine=nextStart`.

Loop, each iteration:

### 4a. 4th-down decision

```
if (down === 4):
  yardsToGoal = 100 − yardLine
  fgKickDistance = yardsToGoal + 17   // snap + holder

  if yardsToGoal <= 4 and rand() < 0.35:   // 35% goal-line gamble — fall through
    go for it
  elif fgKickDistance <= 60:               // attempt FG
    rollFGSuccess() → FG_GOOD (drive ends, +3) or FG_MISS (drive ends, 0)
  elif yardsToGoal > 50 or distance > 5:   // punt
    drive ends, 0 points
  else:                                    // short-yardage 4th down → go for it
    fall through to play resolution
```

`rollFGSuccess(distance)` step function:

| Kick distance | P(make) |
|---|---|
| ≤25 | 0.96 |
| ≤35 | 0.90 |
| ≤42 | 0.82 |
| ≤48 | 0.70 |
| ≤53 | 0.55 |
| ≤58 | 0.35 |
| >58 | 0.18 |

### 4b. Play call

```ts
const offPlay = pickOffensivePlay(off, def);
const defPlay = pickDefensivePlay(off, def);
const res = resolvePlay(offPlay, defPlay, off, def);
```

Play picking is a 3-stage process per side:

1. **Sample 3 candidates** from the team’s 9-play loadout (`sampleCandidates`) — uniform random without replacement. *This is where loadout composition matters*: if a team carries 6 blitzes out of 9 defensive plays, blitzes will dominate the 3-candidate sample purely on frequency.
2. **Score** each candidate (`evaluateOffensiveCandidate` / `evaluateDefensiveCandidate`):
   `score = basePlayStrength(play, slots) × averageMatchupMod against the opponent's category distribution`.
3. **HC weighted pick** (`hcWeightedPick`) — sort candidates best→worst, pick by HC OVR-derived weights:
   - `optimal = clamp(0.20 + (ovr−50)·0.012, 0.20, 0.80)` → P(pick best)
   - `poor = clamp(0.30 − (ovr−50)·0.005, 0.05, 0.30)` → P(pick worst)
   - `neutral = 1 − optimal − poor` → P(pick middle)

   So a 100-OVR HC picks the best candidate ~80% of the time; a 50-OVR HC picks the best only 20% and picks the worst 30%.

### 4c. Play resolution (`resolvePlay`)

This is the math heart of the engine.

```
offBaseRaw  = avg(overall of the 3 keySlots for offPlay)
defBaseRaw  = avg(overall of the 3 keySlots for defPlay)

offHomeBonus = isHomeOff ? +1.5 : 0     // small additive shove to home offense
defHomeBonus = isHomeDef ? +1.5 : 0

offBase = offBaseRaw + offHomeBonus
defBase = defBaseRaw + defHomeBonus

offMatchup = offensiveMatchupMod(offCat, defCat)   // 1.25 / 1.0 / 0.75
defMatchup = defensiveMatchupMod(offCat, defCat)   // 1.25 / 1.0 / 0.75

ocMod = 1 + (ocOverall − 50) / 100      // 0.50 .. 1.50
dcMod = 1 + (dcOverall − 50) / 100

offFinal = offBase × offMatchup × ocMod
defFinal = defBase × defMatchup × dcMod

offWinProb = offFinal / (offFinal + defFinal)
offenseWon = Math.random() < offWinProb
```

Note: home-field is applied **to both teams when they’re on offense** at their stadium — the engine adds the bonus to whoever is currently on offense if `isHome`, and the same to whichever side is on defense if `isHome` (see `resolvePlay` lines 354–357). In practice only one side has `isHome=true`, so home offense gets +1.5 to offBase and home defense gets +1.5 to defBase.

### 4d. The matchup matrix

From `playLibrary.ts`:

```
                  ZONE   BLITZ   ZONE_BLITZ   MAN
  RUNNING          0     +1        -1          0
  SHORT_PASS       0      0        +1         -1
  MIDDLE_PASS     +1     -1         0          0
  LONG_PASS       -1      0         0         +1
```

- `+1` → **offense favorable** (offMatchup=1.25, defMatchup=0.75).
- `−1` → **defense favorable** (offMatchup=0.75, defMatchup=1.25).
- `0` → neutral (both = 1.0).

Plain-English reads:

| Offense | Beats | Loses to |
|---|---|---|
| RUNNING | BLITZ (blockers vs vacated gaps) | ZONE_BLITZ (extra hat in the box) |
| SHORT_PASS | ZONE_BLITZ (quick game beats soft drops) | MAN (sticky underneath coverage) |
| MIDDLE_PASS | ZONE (find the seams) | BLITZ (no time to develop) |
| LONG_PASS | MAN (1-on-1 wins) | ZONE (deep safeties) |

### 4e. Severity → yardage

The win/loss is just a bit; severity translates the magnitude of the win into a yardage outcome.

```
margin = abs(offWinProb − 0.5) × 2          // 0..1
shiftMagnitude = 0.8 + margin × 1.2         // 0.8..2.0
baseShift = offenseWon ? +shiftMagnitude : −shiftMagnitude
severity = gaussian(baseShift, std = 0.9)
```

Severity buckets:

| Severity | Label | Yards |
|---|---|---|
| > 2.0 | `GREAT_OFFENSE` | 20 + rand(0..45)  → 20–65 |
| 0.5 .. 2.0 | `OFFENSIVE_GAIN` | 4 + rand(0..11)  → 4–15 |
| −0.5 .. 0.5 | `NEUTRAL` | −1 + rand(0..6)  → −1..5 |
| −2.0 .. −0.5 | `DEFENSIVE_STOP` | −3 + rand(0..4)  → −3..1 |
| < −2.0 | `GREAT_DEFENSE` | −9 + rand(0..5)  → −9..−4 (sacks/TFLs) |

A pass play floored at `DEFENSIVE_STOP` with negative yards is rounded up to 0 with P=0.6 (incompletion model).

### 4f. Turnovers

Only fire from `GREAT_DEFENSE` (severity < −2). Probability:

```
turnoverP = 0.18 + min(0.22, (|severity| − 2) × 0.18)   // 0.18 floor → up to 0.40
isPass = offPlay.category !== 'RUNNING'

if rand() < turnoverP:
  defTdP = isPass ? 0.12 : 0.05               // pick-six / scoop-and-score
  if rand() < defTdP: scoringEvent = 'DEFENSIVE_TD'
  else:               scoringEvent = isPass ? 'INT' : 'FUMBLE'
```

A `DEFENSIVE_TD` ends the drive with `+7` to the defense. An `INT`/`FUMBLE` ends the drive as a `TURNOVER` with `0` points and the opponent gets the ball at the spot.

### 4g. Ending a drive

After yards are applied:

- `yardLine + appliedYards > 100` → cap at 100 → **TD**, +7, drive ends.
- `yardLine < 0` (pinned in own end zone on a loss) → **SAFETY**, +2 for defense, drive ends.
- Otherwise `distance -= appliedYards`:
  - `distance ≤ 0` → first down, reset to `down=1, distance=10`.
  - else → `down++`; if it would become 5, the play was a failed 4th-down go-for-it → `TURNOVER_ON_DOWNS`.

---

## 5. Worked example — single play

Setup:

- **Home offense** runs `four_verticals` (LONG_PASS, keySlots `[QB, WR, T]`). Player OVRs: QB 88, WR1 84, T 79 → `offBaseRaw = (88+84+79)/3 = 83.7`. Home field bonus +1.5 → `offBase = 85.2`.
- OC overall 70 → `ocMod = 1 + (70−50)/100 = 1.20`.
- **Away defense** counters with `cover_2` (ZONE, keySlots `[FS, SS, MLB]`). Player OVRs: FS 82, SS 78, MLB 80 → `defBaseRaw = 80.0`. Not home → `defBase = 80.0`.
- DC overall 60 → `dcMod = 1.10`.
- Matchup: LONG_PASS vs ZONE → matrix value −1 → `offMatchup = 0.75`, `defMatchup = 1.25`.

Compute:

```
offFinal = 85.2 × 0.75 × 1.20 = 76.68
defFinal = 80.0 × 1.25 × 1.10 = 110.00
offWinProb = 76.68 / (76.68 + 110.00) = 0.411
```

So the offense wins only 41% of the time on this snap — the matchup matrix flipped a +5 OVR + home-field edge into a defensive favorite.

Severity roll if the offense **loses** (rolls > 0.411):

```
margin = |0.411 − 0.5| × 2 = 0.178
shiftMagnitude = 0.8 + 0.178 × 1.2 ≈ 1.01
baseShift = −1.01
severity ~ Gaussian(−1.01, 0.9)        // most likely a DEFENSIVE_STOP
```

P(severity < −2.0) ≈ Φ((−2.0 − (−1.01))/0.9) ≈ Φ(−1.10) ≈ 13.5%, and inside that, P(turnover) ≈ 18–35%, of which 12% is a pick-six. So per snap there’s roughly a 1–2% chance of a DEFENSIVE_TD in this matchup.

---

## 6. Worked example — full drive

Initial: ball at own 25, Q1, 1st & 10. Same teams as above. Sketch of a representative drive:

| # | Down/Dist/YL | Off play | Def play | Win? | Sev | Result | Yards | After |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 & 10, 25 | `inside_zone` (RUN) | `inside_blitz` (BLITZ, +1 to off) | yes | 1.3 | OFFENSIVE_GAIN | +8 | 2 & 2, 33 |
| 2 | 2 & 2, 33 | `power` (RUN) | `cover_3` (ZONE, neutral) | yes | 0.7 | OFFENSIVE_GAIN | +5 | 1 & 10, 38 |
| 3 | 1 & 10, 38 | `y_cross` (MID) | `edge_blitz` (BLITZ, −1 to off) | no | −0.4 | NEUTRAL | +2 | 2 & 8, 40 |
| 4 | 2 & 8, 40 | `slants` (SHORT) | `cover_2_man` (MAN, −1 to off) | no | −1.6 | DEFENSIVE_STOP | 0 (pass floor) | 3 & 8, 40 |
| 5 | 3 & 8, 40 | `levels` (MID) | `tampa_2` (ZONE, +1 to off) | yes | 2.4 | GREAT_OFFENSE | +33 | 1 & 10, 73 |
| 6 | 1 & 10, 73 | `outside_zone` (RUN) | `cover_4` (ZONE, neutral) | yes | 0.9 | OFFENSIVE_GAIN | +6 | 2 & 4, 79 |
| 7 | 2 & 4, 79 | `four_verticals` (LONG) | `press_man` (MAN, +1 to off) | yes | 2.6 | GREAT_OFFENSE | TD (21 capped to goal) | **+7** |

That drive’s `DriveOutcome`:

```ts
{
  side: 'home', drive: 0, quarter: 1,
  startYardLine: 25, endYardLine: 100,
  result: 'TD', scoringSide: 'home', points: 7,
  plays: [/* 7 PlayEvents above */],
}
```

Possession flips, away starts next drive at the 25. Quarter scores update: `quarterScores[0] = [7, 0]`.

---

## 7. Overtime and winner determination

Regulation ends after drive 21. Then:

```ts
if (homeScore === awayScore) {
  const order = Math.random() < 0.55 ? ['home', 'away'] : ['away', 'home'];
  for (const side of order) {
    if (homeScore !== awayScore) break;        // first score wins (sudden death)
    simulateDrive(...);
    apply points if any
  }
  if (homeScore === awayScore) {
    if (Math.random() < 0.55) homeScore += 3;  // hard tiebreaker
    else                      awayScore += 3;
  }
}
```

Caveat: the hard-tiebreaker block always runs if both OT possessions failed to score, so a “tie” cannot exit `simulateMatch`. That means `standings.ts` will tally a tie only if some upstream caller bypasses OT — under the current code path, every simulated match resolves to a winner.

The `narrative` is built from the differential:

- `diff ≥ 17` → blowout (`"dominated"`)
- `diff ≥ 8` → comfortable (`"controlled"`)
- `diff ≤ 3` → nail-biter (`"edged"`)
- else → tight (`"beat"`)

The `keyMatchup` string concatenates the winner’s most-used offensive category vs the most-used defensive category they faced (e.g. `"Middle Pass vs Zone"`).

---

## 8. End-to-end example — match outline

Hypothetical final: **Vanguard 27, Ironside 17**.

- Coin flip → Ironside receives. Drive 0 (Q1): Ironside, 25-yard start. Stalls at midfield → PUNT → Vanguard ball at ~22.
- Drive 1 (Q1): Vanguard scores TD as in §6 above → 7–0.
- Drives 2–4 (Q1): trade punts, Ironside FG (40-yarder, P=0.82) → 7–3 end Q1.
- Drives 5–10 (Q2): Ironside TD, two punts, Vanguard FG, Vanguard TD → 17–10 halftime banner fires before drive 11.
- Drives 11–15 (Q3): Vanguard adds a FG, defense forces an INT (GREAT_DEFENSE severity = −2.4, isPass → 0.12 def-TD roll missed → INT, drive ends 0 pts, Vanguard ball at spot) → 20–10.
- Drives 16–21 (Q4): Ironside scores TD on a `take_shot` LONG_PASS vs `cover_0_man` (favorable +1), Vanguard answers with a TD → 27–17.
- `homeScore !== awayScore` → no OT.
- `computeStandings` adds W for Vanguard, L for Ironside, PF/PA from the box score.

`quarterScores` = `[[7,3],[10,7],[3,0],[7,7]]` (sums to 27–17). `scoringDrives` lists each scoring drive with its quarter. `plays` contains every `PlayEvent` ever logged — the live feed (`feedGenerator.ts`) walks `drives` + `plays` and synthesizes per-play text (e.g. `"M. Baker intercepts it."`) without re-simulating anything.

---

## 9. Quick reference — knobs that move outcomes

| Knob | Where | What it shifts |
|---|---|---|
| Player OVR (3 keySlots / play) | rosters | Linear into `basePlayStrength` (sum/3) |
| Gameplan loadout (9 plays) | `Team.offensivePlays/defensivePlays` | Sets category distribution → biases candidate samples + opponent-aware play scoring |
| Matchup matrix | `playLibrary.ts` `MATCHUP_MATRIX` | ±25% multiplier on final strength |
| HC OVR | `CoachProfile.stat1/stat2` | Probability the best of 3 sampled plays gets called |
| OC / DC OVR | `CoachProfile.overall` | Multiplicative `ocMod`/`dcMod` (0.50–1.50) on final strength |
| Home field | engine constant `HOME_FIELD_PLAY_BONUS = 1.5` | Additive shove to home offBase and defBase |
| Severity std | engine constant `0.9` in `gaussian(baseShift, 0.9)` | Variance per play |
| FG curve | `rollFGSuccess` | Distance-based make % |
| Turnover floor / def-TD | `mapSeverityToOutcome` | 18% turnover floor on GREAT_DEFENSE, 12%/5% pass/run def-TD |

These are the levers to tune if balance reports (`npm run sim:multi N`) show systematic skew.
