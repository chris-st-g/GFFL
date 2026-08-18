# CLAUDE.md — Graham Family Football League

---

## READ THIS FIRST (Session Start Protocol)

1. Read this file fully before touching any code
2. Check the **Current Status** section at the bottom — it describes where we left off
3. Never read or display values from PropertiesService — treat them as write-only from Claude's perspective
4. After any code change, follow the **Deployment Process** below — changes do not go live automatically

---

## Project Overview

- **What it is:** Family fantasy football league tracker. Each family member (a "Grahamchise") picks one NFL team per week and earns points based on that team's win record relative to its opponent.
- **Backend:** Google Apps Script (`.gs` files) — handles all logic, sheet reads/writes, ESPN API calls
- **Frontend:** HTML/CSS/JS served by Apps Script via `HtmlService` — single-page app with 4 tabs
- **Database:** Google Sheets — 4 tabs (Config, Players, Picks, BonusPoints)
- **Scores:** ESPN public API — no API key required
- **Hosting:** Google Apps Script web app — free, no server needed

---

## File Map

All source files live under `src/` — clasp is configured to push from that directory.

| File | Purpose |
|---|---|
| `src/Code.gs` | Web app entry point — `doGet()`, `include()`, `getLeagueData()`, setup route |
| `src/ESPN.gs` | Fetches NFL matchups from ESPN public API — `getWeeklyMatchups()` |
| `src/Scoring.gs` | All scoring logic — `classifyGame()`, `resolvePickPoints()`, `resolvePickResult()`, `isGraceBowlWeek()` |
| `src/Sheets.gs` | All Sheets read/write — Config, Players, Picks, BonusPoints, `scoreWeekPicks()` |
| `src/Picks.gs` | Pick submission and pick page data — `submitPick()`, `getPickPageData()` |
| `src/Standings.gs` | Calculates and returns league standings — `getStandings()` |
| `src/Admin.gs` | Commissioner panel — login, set week, add bonus points, trigger scoring |
| `src/Setup.gs` | One-time setup — `setupSheet()`, `seedTestPlayers()`, `seedRandomPicks()`, `migrateAddResultColumn()` |
| `src/Index.html` | SPA shell — 4 tabs: Picks, Standings, Games, Admin |
| `src/Styles.html` | All CSS — included into Index.html via `<?!= include('Styles') ?>` |
| `src/Scripts.html` | All frontend JS — included into Index.html via `<?!= include('Scripts') ?>` |
| `src/appsscript.json` | Apps Script manifest — OAuth scopes, webapp config |

---

## Sheet Structure

**Config** — key/value league settings

| Column | Value |
|---|---|
| Key | e.g. `CurrentWeek`, `Season` |
| Value | e.g. `6`, `2025` |

**Players** — one row per Grahamchise

| Column | Value |
|---|---|
| PlayerID | Auto-incrementing integer |
| Name | Player display name |

**Picks** — one row per weekly pick

| Column | Value |
|---|---|
| PickID | Auto-incrementing integer |
| Season | e.g. `2025` |
| Week | e.g. `6` |
| PlayerName | Must match a name in Players tab |
| TeamAbbr | NFL team abbreviation, e.g. `KC` |
| PointsEarned | Blank until scored, then 0–3 |
| Timestamp | ISO string |
| Result | `W`, `L`, `T`, or blank if pending |

**BonusPoints** — commissioner-applied bonuses

| Column | Value |
|---|---|
| BonusID | Auto-incrementing integer |
| Season | e.g. `2025` |
| Week | Week number, or blank for season-level bonus |
| PlayerName | Must match a name in Players tab |
| Points | Number of bonus points |
| Reason | Text description |
| Timestamp | ISO string |

---

## Scoring Rules

| Weeks | Rule | Points |
|---|---|---|
| 1–3 | **Regular** — all games | Both teams: 1 pt |
| 4–18 | **Deuce** — equal win records | Both teams: 2 pts |
| 4–18 | **Trey** — win records differ by exactly 1 | Underdog: 3 pts, Favorite: 1 pt |
| 4–18 | **Regular** — win records differ by 2+ | Both teams: 1 pt |

- **Ties** earn **half** the pick's point value (Deuce tie = 1, Trey 3-side tie = 1.5, Trey 1-side tie = 0.5)
- **Grace Bowl** = weeks 16–18. Same scoring rules, different UI label only
- Win records are looked up from ESPN at game time (not season totals)

---

## Secrets Rules — STRICT

- **NEVER** read, print, log, or display values retrieved from `PropertiesService`
- **NEVER** store IDs, keys, or credentials as string literals in any `.gs` file
- All config values are stored via `PropertiesService.getScriptProperties()`
- Reference values in code as `getProperty('KEY_NAME')` only — never the actual value
- If a literal API key or credential appears in a file, flag it immediately and do not display it

**PropertiesService keys in use:**

| Key | What it stores |
|---|---|
| `SHEET_ID` | Google Sheet ID — set by `setupSheet()` |
| `ADMIN_PASSWORD_HASH` | SHA-256 hash of admin password — set by `setAdminPassword()` |
| `ADMIN_TOKEN` | Active session token — set on login |
| `ADMIN_EXPIRY` | Token expiry timestamp — set on login |

---

## Google Apps Script Rules

- All backend logic lives in `.gs` files — never in `Scripts.html`
- Frontend HTML/CSS/JS lives in `.html` files served via `HtmlService`
- Call external APIs (ESPN) server-side from `.gs` files using `UrlFetchApp.fetch()` — never from the browser
- Use `SpreadsheetApp` to read/write Sheets — never hardcode sheet data in code
- `.clasp.json` is gitignored — it contains the Apps Script project ID and should never be committed

---

## ESPN API

- No API key required — public endpoint
- NFL scoreboard: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- Add `?week=N&seasontype=2&dates=YEAR` for a specific week
- All calls go through `ESPN.gs` — `getWeeklyMatchups(week, season)` returns processed game data

---

## Deployment Process

**Claude creates and publishes all deployments via clasp — no manual editor steps.**

Path prefix for all clasp commands:
```
export PATH="/c/Program Files/nodejs:/c/Users/chris/AppData/Roaming/npm:$PATH"
```

**After any code change:**

1. Push code to Apps Script HEAD:
   ```
   clasp push --force
   ```

2. Publish a new version to a deployment (this is what makes the change live for that URL).
   `clasp deploy --deploymentId <ID>` re-publishes an **existing** deployment as a new
   version at the **same URL** — always pass `--deploymentId`, never create a new deployment.
   - **PREVIEW** (default target for all new work — deploy here without asking):
     ```
     clasp deploy --deploymentId AKfycbzng1z4gAOFZmc4QuCwhgcPHQu0ZoAmZKIwEuFGczZP6X6mCPP_mj_3UBCqYGMEyfMt --description "<what changed>"
     ```
   - **LIVE / testers** — only after the user explicitly approves promoting preview → live:
     ```
     clasp deploy --deploymentId AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I --description "<what changed>"
     ```

`clasp push` alone only updates HEAD — versioned deployments stay pinned until re-deployed
with `clasp deploy`. Note the output line `Deployed <id> @N` — N is the new version number.

**Live app URL:**
`https://script.google.com/macros/s/AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I/exec`

---

## Git Rules

- `.clasp.json` is gitignored — contains script ID, treat as sensitive
- `node_modules/` is gitignored
- Commit in small, working increments with clear messages
- Never commit secrets, IDs, or credentials

---

## Key URLs

| Resource | URL |
|---|---|
| Live app | https://script.google.com/macros/s/AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I/exec |
| Google Sheet | https://docs.google.com/spreadsheets/d/1Q0vsRVJLDZU37cHU1Ytlnt5I6nfs4mv8rQrznu85u0g/edit |
| Apps Script editor | https://script.google.com/home/projects/1ZPx2xknKYtcI43FLn2aHq--O6nRvFH4c55XaIDqYhWYWuVlCsULYXewX/edit |
| GitHub repo | https://github.com/chris-st-g/GFFL |

---

## Current Status

*Last updated: 2026-08-17*

### Deployment strategy — TWO deployments (important)
- Claude publishes deployments with `clasp deploy --deploymentId <ID>` (see **Deployment Process** above). Deploy to PREVIEW freely; deploy to LIVE only with the user's explicit OK.
- **LIVE / testers** — deploymentId `AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I` — **@64** (freeze lifted 2026-08-17 for the shared live test). Still gate LIVE deploys on the user's OK.
- **PREVIEW / user** — deploymentId `AKfycbzng1z4gAOFZmc4QuCwhgcPHQu0ZoAmZKIwEuFGczZP6X6mCPP_mj_3UBCqYGMEyfMt` — **@63**, gets all new work for review. `clasp push` updates HEAD only; versioned deployments stay pinned until re-deployed. Both share the same Sheet + Config.
- **NO FAKE DATA (2026-08-17):** PreviewMode/Demo mode was fully removed — the app **always** shows real ESPN data (no simulated scores/times/odds, no toggle). `PreviewMode` Config is now inert (unread). `makeFakeOdds`, `PREVIEW_TIMES`, `adminSetPreviewMode`, and the Demo Mode admin card are gone.
- **LIVE TEST armed 2026-08-17:** `?action=livetest` route sets AutoWeek ON + zeroes points (clears picks+bonuses for the ESPN-detected season). App follows the real NFL slate — currently **2026 Preseason**. Season-type support: `espnCurrent()` captures `seasonType`, `getActiveSeasonType()` (1=pre/2=reg/3=post), `getWeeklyMatchups` defaults to it + includes it in the cache key. `resolveAutoWeek_()` rolls past a fully-final week to the next upcoming slate (ESPN's pointer lags). `weekLabel()` shows preseason as official numbering (ESPN wk N = "Preseason Wk N-1"; wk1 = "Hall of Fame"). End the test: turn Auto OFF in Admin.

### Built
- **Conferences (called "Chapters"):** Mt. Washington, Louisville, St. Gertrude, St. George. `LEAGUE_STRUCTURE` in `Sheets.gs`. Divisions still placeholder surnames; sample roster is throwaway.
- **Scoring:** Deuce/Trey on WINS ONLY, flat Weeks 1–3 (`EARLY_FLAT_WEEKS=3`), tie = HALF points; per-conference Rookie of Year.
- **Pick flow:** conference→name→games; tap-to-Confirm (optimistic, instant); per-game kickoff lock; started games shown greyed (final) / red-glow (live) with live scores + winner; re-pick from "See Everyone's Picks"; sort by time / Deuce-Trey-first.
- **Bonuses:** per-team, scoped LEAGUE or per-chapter (additive). `GameTeamBonuses` sheet. Admin editor = scope pills + stepper +/− + Confirm.
- **Alma Cup** (`Alma.gs`, 🔥 card): survival streak, per-conf resolution, `setAlmaWinner()` override.
- **Performance:** base-games CacheService (120s, one ESPN fetch/week for all conferences), background prefetch on open, client-side conference cache (`STATE.confData`), `LockService` on pick writes.
- **Logo:** real GFFL shield embedded as data-URI (`src/LogoData.html`, source `src/assets/gffl-logo.png`). Small/Large text toggle on home.
- **Home menu icons:** photo icons embedded as data-URIs — `src/TigerData.html` (`GFFL_TIGER`, Bengal tiger → "Make Your Picks") and `src/AlmaData.html` (`GFFL_ALMA`, Alma's photo → "Alma Cup", rounded-rect `.rect` so hair isn't cropped). Included in `Index.html`, applied in `Scripts.html` load handler, styled `.menu-icon-img`. Emoji fallbacks remain if the vars are absent.
- **Maverick (Gemini commissioner assistant): REMOVED from preview 2026-08-17** — free-tier Gemini timed out under load after ~2 requests. Code (`Gemini.gs`, `MaverickData.html`, admin card + `commissionerPlan`/`commissionerApply`, Hornet avatar `GFFL_MAVERICK`) was fully reverted; recoverable from git history if revisited with a paid key.
- **ESPN:** MUST use `cdn.espn.com/core` (site.api 403s from GAS). Live scores/status/winner already in the cached data — no extra calls.

### Go-live features (BUILT but gated off — only active when auto-week is ON)
- **Automatic Week** (Admin toggle) → reads live NFL week/season/type from ESPN (`getActiveWeek/Season/SeasonType`), rolls past a fully-final week (`resolveAutoWeek_`).
- **Picks-open window** (`getPicksOpenInfo`): next week visible-but-locked immediately after the prior week's last game; picks open **24h after that final game**; locks on real kickoffs; times in viewer TZ (default ET).
- **Demo mode: REMOVED** — app always uses real ESPN data (see NO FAKE DATA above).
- **iOS home-screen icon:** `src/AppleIcon.html` (`<link rel="apple-touch-icon">`, GFFL shield on white, 180×180) included in `Index.html` head. NOTE: Apps Script serves inside a sandbox iframe, so iOS may still fall back to a screenshot/letter — custom home-screen icons aren't guaranteed for raw Apps Script web apps.

### Pending / next
- Replace sample roster with **real names + division mapping** (user provides).
- **Go-live switch:** Admin → Automatic Week ON; set `PreviewMode` OFF; load real roster; promote preview→live. Optional: cache-warming cron (needs `script.scriptapp` scope re-added).
- **Phase 2:** Grace Bowl tournament + Halo Bowl bracket (qualifiers: Grace Bowl champ + Alma Cup + per-conf Rookie of Year).
