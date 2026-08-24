# CLAUDE.md — Graham Family Football League (GFFL 2.0)

---

## READ THIS FIRST (Session Start Protocol)

1. Read this file fully before touching any code.
2. Read **HANDOFF.md** for where we left off (current week/season, live status, open threads).
3. Never read or display values from `PropertiesService` — treat them as write-only from Claude's perspective.
4. After any code change, follow the **Deployment Process** below — changes do not go live automatically.
5. **GFFL 2.0 lives in `v2-backend/` + `v2-frontend/` + `docs/`.** The old `src/` directory is **legacy 1.0 and is retiring** — do not edit or deploy it.

---

## Project Overview

- **What it is:** Family fantasy pick'em. Each family member (a "Grahamchise") picks one NFL team per week and earns points based on that team's win record relative to its opponent.
- **Backend:** Google Apps Script (`v2-backend/*.gs`) — all logic, Sheet reads/writes, ESPN calls. Exposes a JSON API via `doGet`/`doPost` (`?action=api&fn=NAME&args=[...]`).
- **Frontend (what the family uses):** a static **GitHub Pages** site — `docs/index.html`, served at **https://chris-st-g.github.io/GFFL/**. It is *built* from the same `v2-backend/*.html` sources by `node v2-frontend/build.js`, which inlines the `<?!= include() ?>` templates and injects a shim that reimplements `google.script.run` on top of `fetch()` so the identical frontend code talks to the Apps Script JSON API cross-origin.
- **Database:** Google Sheets (its OWN sheet, created by `setupSheet()`) — tabs: Config, Players, Picks, BonusPoints, GameTeamBonuses.
- **Scores:** ESPN public API — no key required.

```
v2-backend/*.gs,*.html   →  clasp push/deploy  →  Apps Script web app (JSON API at /exec)
v2-backend/*.html        →  node v2-frontend/build.js  →  docs/index.html  →  GitHub Pages (family app)
```

---

## File Map

Source lives under `v2-backend/` — clasp pushes from there (`v2-backend/.clasp.json`, gitignored).

| File | Purpose |
|---|---|
| `v2-backend/Code.gs` | Entry points — `doGet()`/`doPost()`, `apiDispatch_()`, `apiFunctions_()` whitelist, `getLeagueData()`, `include()`, owner `?action=` routes |
| `v2-backend/ESPN.gs` | ESPN fetch — `getWeeklyMatchups()`, active week/season/type (`espnCurrent`, `resolveAutoWeek_`), `weekLabel()` |
| `v2-backend/Scoring.gs` | Scoring logic — `classifyGame()`, `resolvePickPoints()`, `resolvePickResult()`, `isGraceBowlWeek()` |
| `v2-backend/Sheets.gs` | All Sheets read/write — Players/Picks/Bonuses, `scoreWeekPicks()`, `autoScoreOnOpen_()`, rename/family/division helpers |
| `v2-backend/Picks.gs` | Pick submission + pick-page data — `submitPick()`, `getConferencePickData()`, lock helpers (`isLockedForPicking_`, `weekPicksClosed_`) |
| `v2-backend/Standings.gs` | Standings aggregation — `getStandings()` (score-on-open + per-week missed-loss logic) |
| `v2-backend/Alma.gs` | Alma Cup survival streak — `getAlmaCup()`, `setAlmaWinner()` |
| `v2-backend/Admin.gs` | Commissioner panel — login/token, set week, bonuses, `triggerWeekScoring()` |
| `v2-backend/Setup.gs` | Setup + migrations + **owner routes** (`runBonusAdminRoute`/`runRosterAdminRoute`/`runPickAdminRoute`), `LEAGUE_STRUCTURE`/family helpers |
| `v2-backend/Index.html` | SPA shell + view sections |
| `v2-backend/Styles.html` | All CSS (`<?!= include('Styles') ?>`) |
| `v2-backend/Scripts.html` | All frontend JS (`<?!= include('Scripts') ?>`) |
| `v2-backend/*Data.html` | Embedded data-URI images (Logo, Tiger, Alma, Trophy) + `AppleIcon.html` |
| `v2-backend/appsscript.json` | Manifest — OAuth scopes, webapp config |
| `v2-frontend/build.js` | Builds `docs/index.html` from the `v2-backend/*.html` sources (google.script.run→fetch shim). Its `FN` list must match `apiFunctions_()` |
| `docs/index.html` | The built GitHub Pages app (commit after building) |

---

## Sheet Structure

**Config** — key/value settings (`CurrentWeek`, `Season`, `AutoWeek`, `PickGraceMinutes`, …).

**Players** — one row per Grahamchise. **Name is the join key** (Picks/BonusPoints reference players by name — a rename must cascade).

| PlayerID | Name | Conference | Division | IsRookie | Family |
|---|---|---|---|---|---|

**Picks** — one row per weekly pick (at most one per player per week).

| PickID | Season | Week | PlayerName | TeamAbbr | PointsEarned | Timestamp | Result |
|---|---|---|---|---|---|---|---|

`PointsEarned` blank until scored; `Result` = `W`/`L`/`T` or blank.

**BonusPoints** — commissioner per-player bonuses (rare).

| BonusId | Season | Week | PlayerName | Points | Reason | Timestamp |
|---|---|---|---|---|---|---|

**GameTeamBonuses** — per-team bonus points, scoped LEAGUE or per-chapter (additive to a game's base value).

| Season | Week | Scope | GameId | TeamAbbr | Bonus | Timestamp |
|---|---|---|---|---|---|---|

---

## Scoring Rules

| Weeks | Rule | Points |
|---|---|---|
| 1–3 | **Flat** — all games (`EARLY_FLAT_WEEKS=3`) | Both teams: 1 pt |
| 4–18 | **Deuce** — equal WIN records | Both teams: 2 pts |
| 4–18 | **Trey** — win records differ by exactly 1 | Underdog: 3 pts, Favorite: 1 pt |
| 4–18 | **Regular** — win records differ by 2+ | Both teams: 1 pt |

- Deuce/Trey are computed on **WINS ONLY**. Win records are looked up from ESPN at game time.
- **Ties** earn **half** the pick's point value (Deuce tie = 1, Trey 3-side tie = 1.5, Trey 1-side tie = 0.5).
- **Standings total = pick points + player bonuses.** Record (W/L/T) comes from each pick's `Result`.
- **A missed week counts as a Loss only once that week's pick window has fully closed** — i.e. its LAST game passes kickoff + grace (`weekPicksClosed_`). You are never charged a loss while you can still pick the week's final game. Applied per-week in `getStandings` (`closedWeeks`).
- **Scoring is automatic (score-on-open):** `getStandings` runs `autoScoreOnOpen_()` on every load — gated (no ESPN call if the active week has no unscored picks) and uses the shared cached matchups. The admin "score now" button (`scoreWeekPicks(...,useCache=false)`) forces a fresh ESPN read.
- **Grace Bowl** = weeks 16–18 — same scoring, different UI label. Preseason labels via `weekLabel()`.

---

## Secrets Rules — STRICT

- **NEVER** read, print, log, or display values retrieved from `PropertiesService`.
- **NEVER** store IDs, keys, or credentials as string literals in any `.gs` file.
- All config values are stored via `PropertiesService.getScriptProperties()`; reference as `getProperty('KEY')` only.
- The commissioner password is stored **hashed** (`ADMIN_PASSWORD_HASH`, set via `setAdminPassword()`) — never keep the plaintext in the repo.
- If a literal API key or credential appears in a file, flag it immediately and do not display it.

**PropertiesService keys:** `SHEET_ID`, `ADMIN_PASSWORD_HASH`, `ADMIN_TOKEN`, `ADMIN_EXPIRY`.

---

## Owner routes (`?action=`) — unauthenticated (testing)

These run in `doGet()` **before** any password check and drive the local Claude skills:
`bonusadmin`, `rosteradmin`, `pickadmin`, plus `setup`/`livetest`. They can edit/wipe data with just the URL. The in-app admin panel is unaffected (still password-gated via `validateToken`).

**Decision:** intentionally left open during the testing phase. **Re-lock before wider rollout** (planned: a route key hashed in PropertiesService, required on all write routes). See memory `project_gffl_route_auth`.

---

## Google Apps Script Rules

- All backend logic in `.gs`; frontend HTML/CSS/JS in `.html`.
- Call ESPN server-side (`UrlFetchApp.fetch()`), never from the browser.
- Use `SpreadsheetApp` — never hardcode sheet data.
- **New backend function callable from the frontend?** Add it to `apiFunctions_()` in `Code.gs` **and** the `FN` list in `v2-frontend/build.js`.
- `.clasp.json` is gitignored — contains the script ID; never commit.

---

## ESPN API

- No key required. **Use `cdn.espn.com/core`** — `site.api.espn.com` **403s** from Google's servers.
- All calls go through `ESPN.gs` — `getWeeklyMatchups(week, season, conference, seasonType, noCache)`. Live scores/status/winner are already in the cached payload — no extra calls.
- Base games are cached (~120s) so one ESPN fetch serves all conferences/viewers.

---

## Deployment Process

**Claude publishes all deployments via clasp — no manual editor steps.** Path prefix:
```
export PATH="/c/Program Files/nodejs:/c/Users/chris/AppData/Roaming/npm:$PATH"
```

There is **ONE** GFFL 2.0 deployment (the URL the Pages frontend + everyone uses). Always re-publish that existing deployment — never create a new one.

**After a code change:**

1. Push to Apps Script HEAD (from `v2-backend/`):
   ```
   cd v2-backend && clasp push --force
   ```
2. Publish a new version at the same URL:
   ```
   clasp deploy --deploymentId AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw --description "<what changed>"
   ```
   (`clasp push` alone only updates HEAD; deployments stay pinned until re-deployed. Output `Deployed <id> @N` — N is the new version.)
3. **If any `.html` changed**, rebuild the family frontend and commit it:
   ```
   node v2-frontend/build.js      # regenerates docs/index.html
   ```
   Commit `docs/index.html` (GitHub Pages serves it). Pure `.gs` changes don't need a rebuild.

**JSON API base (/exec):**
`https://script.google.com/macros/s/AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw/exec`

---

## Git Rules

- Single branch: **`main`** (default). Commit in small, working increments with clear messages.
- Commit/push only when the user asks.
- GitHub Pages serves `main/docs` — after an `.html` change, rebuild `docs/` and commit it in the same change.
- Never commit secrets, IDs, or credentials. `.clasp.json`, `node_modules/`, `.claude/`, `.wrangler/` are gitignored.

---

## Key URLs

| Resource | URL |
|---|---|
| Live app (family) | https://chris-st-g.github.io/GFFL/ |
| JSON API (/exec) | https://script.google.com/macros/s/AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw/exec |
| Apps Script editor | https://script.google.com/home/projects/1l5FGTAmgLKUTQt-oLzzEvrsGEsKZbqtUSw3KoEZeqvC7f8KHNl6Scj49/edit |
| GitHub repo | https://github.com/chris-st-g/GFFL |

The GFFL 2.0 Google Sheet ID lives in `PropertiesService.SHEET_ID` (do not print it); open it from the Apps Script project if needed.

---

## Local Claude skills

Under `.claude/skills/` (gitignored, local-only): **GFFL-roster** (edit players), **GFFL-picks** (edit picks/points/score), **GFFL-bonus** (team/player bonuses). Each drives the matching `?action=` owner route.

---

## Current Status

See **HANDOFF.md** for the live snapshot (current week/season, deployment version, open threads). At last update: real roster loaded (Mt. Washington, Louisville, St. Gertrude, St. George; St. George has families), no fake/demo data, Automatic Week supported, score-on-open live.

### Pending / next
- **Re-lock the owner `?action=` routes** before wider rollout.
- Retire legacy 1.0 (`src/`).
- **Phase 2:** Grace Bowl tournament + Halo Bowl bracket (qualifiers: Grace Bowl champ + Alma Cup + per-conf Rookie of the Year).
- Newsletters tab (Drive PDFs, browsable by year/week).
