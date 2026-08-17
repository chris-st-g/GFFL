# 📋 GFFL — Session Handoff

_Last updated: 2026-08-17_

Paste a link to this file (or its contents) into a new session to pick up cleanly.
CLAUDE.md and Claude's saved memory also auto-load, so a new session starts with full context.

## What this is
Family fantasy **pick'em** app (GFFL), fully rebuilt as a mobile-first Google Apps
Script web app. ESPN-style navy/red/white UI. Backend = `.gs` + Google Sheet;
frontend = HTML served by `HtmlService`. Managed via `clasp` from `src/`.

## Two deployments (important)
- **🟢 LIVE / testers** — `https://script.google.com/macros/s/AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I/exec`
  — **FROZEN at @43** while gathering tester feedback. Don't redeploy without the user's OK.
  deploymentId: `AKfycbwvKO87nAT8UUik1ZIPDRR-7fuTivQ9nr-5xntf__kBTRCBR1Wce0eVhGcefA1U5r8I`
- **🔵 PREVIEW / user** — `https://script.google.com/macros/s/AKfycbzng1z4gAOFZmc4QuCwhgcPHQu0ZoAmZKIwEuFGczZP6X6mCPP_mj_3UBCqYGMEyfMt/exec`
  — **@49**, has all the newest work. New changes go here first; promote to live on approval.
  deploymentId: `AKfycbzng1z4gAOFZmc4QuCwhgcPHQu0ZoAmZKIwEuFGczZP6X6mCPP_mj_3UBCqYGMEyfMt`
- Both share the same Sheet/Config. Commissioner password: **noodles** (change via `setAdminPassword()`).
- Promote preview → live: `clasp deploy --deploymentId <LIVE> --description "..."`.

## Currently in DEMO mode
Showing 2025 Week 6 with **fake game statuses + fake odds** (Config `PreviewMode=TRUE`) so
the pick UI is demoable. Real behavior (live week from ESPN, real odds, picks-open window)
is **built but gated off** until go-live.

## Built & working
- **Pick flow:** conference → name → games; tap-to-Confirm (optimistic, instant);
  per-game kickoff lock; started games shown greyed (final, red-glow=live) with live
  scores + winner; re-pick from "See Everyone's Picks"; sort by time / Deuce-Trey-first.
- **Chapters (conferences):** Mt. Washington, Louisville, St. Gertrude, St. George.
  Divisions still placeholder surnames; sample roster throwaway.
- **Scoring:** Deuce/Trey on WINS ONLY, flat Weeks 1–3, tie = HALF points; per-conf Rookie of Year.
- **Bonuses:** per-team, scoped LEAGUE or per-chapter (additive); stepper +/− + Confirm editor.
- **Alma Cup** (survival streak) with per-conference resolution + commissioner override.
- **Performance:** base-games CacheService (1 ESPN fetch/week for all conferences),
  background prefetch, client-side conference cache, LockService on pick writes.
- **Logo:** real GFFL shield embedded as data-URI; small/large text toggle.

## Go-live features (BUILT but gated off — active only when Automatic Week is ON)
- **Automatic Week** (Admin toggle) → reads live NFL week/season from ESPN.
- **Picks-open window:** next week visible-but-locked immediately after the prior week's
  last game; picks open **24h after that final game**; locks on real kickoffs; times in
  viewer TZ (default ET).

## Go-live checklist
1. Send **real roster** (names + which division/chapter).
2. Admin → **Automatic Week: ON**; set `PreviewMode` OFF.
3. Load real roster; **promote preview → live**.

## Open threads / next feature conversations
- **Real roster** load (divisions still placeholder surnames).
- **Phase 2 tournaments:** Grace Bowl bracket + Halo Bowl (qualifiers = Grace Bowl champ
  + Alma Cup + per-conference Rookie of the Year).
- **Newsletters** tab (Drive PDFs, browsable by year/week).
- **Live "Games" board** (ESPN provides real-time scores — data already fetched).
- **Cache-warming cron** for extra burst insurance (needs `script.scriptapp` scope re-added).
- Push repo to **GitHub** (currently committed locally only).

## Key technical notes
- ESPN: use `cdn.espn.com/core` — `site.api.espn.com` **403s** from Google's servers.
- `clasp push` updates HEAD only; versioned deployments stay pinned until re-deployed.
- Live scores use the existing cached fetch — **no extra ESPN calls** (~2-min refresh).
- File map + rules: see `CLAUDE.md`.
