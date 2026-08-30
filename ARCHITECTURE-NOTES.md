# GFFL 2.0 — Architecture Notes

Quick reference on collaborators, hosting decisions, and caching.

---

## Adding a collaborator

You need the person's GitHub username.

- **GitHub UI:** repo → **Settings → Collaborators → Add people** → enter their username → they get an email invite.
- **CLI:**
  ```
  gh api -X PUT repos/chris-st-g/GFFL/collaborators/THEIR_USERNAME -f permission=push
  ```
  Permission levels: `pull` = read-only, `push` = read/write (commit + push), `admin` = full control.

---

## Why we left Apps Script's frontend for GitHub Pages

Apps Script serves the app inside a sandboxed iframe wrapper, which added load latency,
produced an ugly/fragile URL, and blocked niceties like a real iOS home-screen icon.
GitHub Pages serves the same built HTML as a plain, fast static site (clean URL, instant
first paint, custom icon) while still calling the Apps Script backend as a JSON API — so
we kept the backend and only swapped how the UI is delivered.

---

## Why the Cloudflare Worker didn't work

The Worker edge cache added an extra network hop plus a cold-cache miss and delivered **no**
perceptible speedup, because the client already hides latency with localStorage + background
refresh — so there was nothing left to accelerate. Worse, its write-through caching served
stale pick data and dropped a pick, making it a net regression, so it was retired.

---

## Cache state & ESPN ping frequency

Three cache layers. ESPN is only ever hit **on-demand** — there is no cron/background poller.

**1. Server-side ESPN cache (the important one)** — `v2-backend/ESPN.gs` (`getWeeklyMatchups`)
- Base game data is cached in Apps Script's `CacheService` under a key per
  `season / seasonType / week`, with a **120-second TTL**.
- **One fetch serves everyone** — all four conferences, all family members, and score-on-open
  share that single cached payload. Bonuses and kickoff-locks are layered on in-memory each
  call (cheap, no fetch).
- **ESPN is pinged at most once every ~2 minutes per active week**, no matter how many people
  are using the app at once. If nobody's using it, it's pinged **zero** times.
- The only forced-fresh fetch is the admin **"score now"** button (`noCache`); score-on-open
  deliberately uses the cache.

**2. Client session cache** — `STATE.confData` holds a conference's game/pick data for the
session so switching between people is instant (no round-trip).

**3. Browser localStorage** — the last league snapshot paints the home screen immediately on
open, then a background refresh updates it.

**Realistic ping rate:** during active use of the current week, the ceiling is ~30 ESPN
calls/hour (once per 2 min); in practice far fewer, and essentially none when idle. Live
scores ride that same cached fetch — there are **no extra ESPN calls** for scores/status/winners.
