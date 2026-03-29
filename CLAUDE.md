# GFFL — Graham Family Football League
## Project Rules for Claude

---

## Secrets — STRICT RULES
- NEVER read, print, log, or display values retrieved from PropertiesService
- NEVER suggest storing IDs, keys, or credentials as string literals in code
- ALL config values are stored via `PropertiesService.getScriptProperties()`
- Reference values in code as `getProperty('KEY_NAME')` only — never the value itself
- If you ever see a literal API key or credential in a file, flag it immediately and do NOT display it

## Google Apps Script Rules
- All backend logic lives in `.gs` files
- Frontend (HTML/CSS/JS) lives in `.html` files served via `HtmlService`
- Use `SpreadsheetApp` to read/write Google Sheets — never hardcode sheet data
- Always fetch external APIs (ESPN) server-side from Apps Script, never from the browser

## ESPN API
- Use the public ESPN API — no API key required
- NFL scoreboard: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- Use `UrlFetchApp.fetch()` in Apps Script to call this

## Git Rules
- `.clasp.json` is gitignored (contains the script ID — treat as sensitive)
- `node_modules/` is gitignored
- Commit in small, working increments with clear messages
- Never commit secrets, IDs, or credentials

## Project Overview
- **Name:** Graham Family Football League (GFFL)
- **Data source:** Google Sheets (family league spreadsheet)
- **Backend:** Google Apps Script
- **Hosting:** Google Apps Script web app (free)
- **Scores:** ESPN public API (no auth required)
- **Repo:** https://github.com/chris-st-g/GFFL
