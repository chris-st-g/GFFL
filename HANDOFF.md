# 📋 GFFL 2.0 — Session Handoff

_Last updated: 2026-08-24_

Paste this file (or its contents) into a new session to pick up cleanly. `CLAUDE.md`
and Claude's saved memory also auto-load, so a new session starts with full context.

## What this is
Family fantasy **pick'em** app (GFFL). Mobile-first, ESPN-style navy/red/white UI. Two pieces:
- **Backend:** Google Apps Script project (`v2-backend/*.gs` + `*.html`) with its own Google
  Sheet. Exposes a JSON API. Managed via `clasp` from `v2-backend/`.
- **Frontend the family uses:** static **GitHub Pages** site — `docs/index.html`, served at
  **https://chris-st-g.github.io/GFFL/**. Built by `node v2-frontend/build.js` from the same
  `v2-backend/*.html` sources (inlines `include()`s + injects a `google.script.run`→`fetch` shim).

Legacy **1.0** (the `src/` directory) is retiring — do not deploy there.

## Deployment (one deployment)
- **Apps Script scriptId:** `1l5FGTAmgLKUTQt-oLzzEvrsGEsKZbqtUSw3KoEZeqvC7f8KHNl6Scj49`
- **Editor:** https://script.google.com/home/projects/1l5FGTAmgLKUTQt-oLzzEvrsGEsKZbqtUSw3KoEZeqvC7f8KHNl6Scj49/edit
- **deploymentId** `AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw` — currently **@20**
- **/exec (JSON API):** https://script.google.com/macros/s/AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw/exec

### After a code change (checklist)
1. Edit sources in `v2-backend/`.
2. `cd v2-backend && clasp push --force` (HEAD only).
3. `clasp deploy --deploymentId AKfycbyd… --description "..."` (publishes a new version at the same URL).
4. If any `.html` changed: `node v2-frontend/build.js`, then commit `docs/index.html` (Pages serves it).
5. New frontend-callable backend fn? Add to `apiFunctions_()` in `Code.gs` **and** the `FN` list in `v2-frontend/build.js`.

Commissioner password is stored hashed in PropertiesService (`setAdminPassword()`) — not in the repo.

## Owner routes (no login — security note)
`?action=` routes run before auth and drive the local Claude skills: `bonusadmin`,
`rosteradmin`, `pickadmin` (plus `setup`/`livetest`). **Intentionally unauthenticated during
testing — re-lock before wider rollout** (route key hashed in PropertiesService).

## Built & working
- **Home menu:** Make Your Picks · This Week's Games (view-only) · Leaderboard · Alma Cup · Newsletter.
- **Pick flow:** conference → name (Family | Division toggle) → games; tap-to-Confirm (optimistic);
  per-game kickoff lock (+ grace buffer); live scores/winner; re-pick via "See Everyone's Picks";
  sort by time / Deuce-Trey-first.
- **This Week's Games:** view-only game board (all matchups, live scores, winners) with
  "Go Make a Pick" / "Leaderboard" buttons.
- **Scoring:** flat Weeks 1–3, Deuce/Trey (WINS only) Weeks 4–18, tie = half. **Score-on-open**
  (`getStandings` auto-scores the active week, gated + cached); admin "score now" forces fresh.
  **Missed week = loss only after that week's last game locks** (`weekPicksClosed_`).
- **Standings:** conference → division; per-conf Rookie race; **"All Grahamchises"** per-conference
  expand toggle (top-2 ⇄ full division lists).
- **Bonuses:** per-team, LEAGUE or per-chapter (`GameTeamBonuses`). Rare per-player bonuses via route only.
- **Alma Cup** (survival streak) with per-conference resolution + commissioner override.
- **Roster:** real — 76 grahamchises across Mt. Washington, Louisville, St. Gertrude, St. George
  (St. George has families; any chapter can). Family stored in the Players sheet.
- **Automatic Week:** reads live NFL week/season/type from ESPN; `resolveAutoWeek_` rolls past a
  fully-final week. **No fake/demo data** — app always shows real ESPN data.
- **Performance:** base-games CacheService (~120s, one ESPN fetch/week for all conferences),
  background prefetch, client-side conference cache, LockService on pick writes.

## Current live state
- Following the real NFL slate — **2026 Preseason**, currently around Week 3.
- Score-on-open is live; standings self-update whenever anyone opens the app.

## Next / open threads
- **Re-lock owner routes** before wider rollout.
- **Retire legacy 1.0** (`src/`).
- **Phase 2 tournaments:** Grace Bowl bracket + Halo Bowl (qualifiers = Grace Bowl champ + Alma Cup
  + per-conference Rookie of the Year).
- **Newsletters** tab (Drive PDFs, browsable by year/week).

## Key technical notes
- ESPN: use `cdn.espn.com/core` — `site.api.espn.com` **403s** from Apps Script.
- `clasp push` updates HEAD only; deployments stay pinned until re-deployed.
- Live scores ride the existing cached fetch — no extra ESPN calls.
- Local Claude skills (GFFL-roster / GFFL-picks / GFFL-bonus) live under `.claude/` (gitignored).
- File map + rules: see `CLAUDE.md`.
