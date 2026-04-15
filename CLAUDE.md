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

| File | Purpose |
|---|---|
| `Code.gs` | Web app entry point — `doGet()`, `include()`, `getLeagueData()`, setup route |
| `ESPN.gs` | Fetches NFL matchups from ESPN public API — `getWeeklyMatchups()` |
| `Scoring.gs` | All scoring logic — `classifyGame()`, `resolvePickPoints()`, `resolvePickResult()`, `isGraceBowlWeek()` |
| `Sheets.gs` | All Sheets read/write — Config, Players, Picks, BonusPoints, `scoreWeekPicks()` |
| `Picks.gs` | Pick submission and pick page data — `submitPick()`, `getPickPageData()` |
| `Standings.gs` | Calculates and returns league standings — `getStandings()` |
| `Admin.gs` | Commissioner panel — login, set week, add bonus points, trigger scoring |
| `Setup.gs` | One-time setup — `setupSheet()`, `seedTestPlayers()`, `seedRandomPicks()`, `migrateAddResultColumn()` |
| `Index.html` | SPA shell — 4 tabs: Picks, Standings, Games, Admin |
| `Styles.html` | All CSS — included into Index.html via `<?!= include('Styles') ?>` |
| `Scripts.html` | All frontend JS — included into Index.html via `<?!= include('Scripts') ?>` |
| `appsscript.json` | Apps Script manifest — OAuth scopes, webapp config |

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

- **Ties** count as a win — picker earns full point value
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

**After any code change, both steps are required:**

1. Push to Apps Script:
   ```
   export PATH="/c/Program Files/nodejs:/c/Users/chris/AppData/Roaming/npm:$PATH" && clasp push --force
   ```

2. Create a new deployment version (required for changes to go live):
   - Open the Apps Script editor
   - Deploy → Manage deployments → click the pencil icon → New version → Deploy
   - The same URL is preserved — **never create a new deployment, only new versions**

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

*Last updated: 2026-04-14*

- All code built and pushed to GitHub
- App is deployed at the live URL above
- **Known issue:** Web app has had `google.script.run` completion problems — a 20s timeout and explicit OAuth scopes were added to debug
- **Pending:** Admin password not yet set — run `setAdminPassword('yourPassword')` from the Apps Script editor
- **Pending:** Player names are still placeholders (Player1–Player25) until real names are added via the Admin panel
- **Planned:** Halo Bowl / playoff feature after regular season is stable
