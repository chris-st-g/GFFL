# GFFL — Private Newsletters: Build Plan

Goal: let the family read newsletters in the app, gated by **one shared family
password** (typed once per device, then cached), with the source files kept **truly
private** — never exposed as a public/leakable URL.

## Security model (the core idea)
- Newsletters live in a **private Google Drive folder** — owned by the GFFL Google
  account, shared with **nobody**. No "anyone with the link" sharing.
- The **Apps Script backend runs as the owner**, so it's the *only* thing that can read
  those files. The browser never sees a Drive URL.
- Access is gated by a **password hash** in PropertiesService (same pattern as the
  commissioner password — the real password is never in code or the repo).
- On success the backend issues a **signed, expiring token** the device caches in
  `localStorage`. So the password is entered **once per device** (~30-day expiry).
- The token is **stateless/signed** (HMAC of the expiry + a server secret), so **any
  number of devices** can be logged in at once — unlike the single-session admin token.

This is genuinely private (files are never shared), not just obscure (no leakable link).

## Data / storage
- One Drive folder; PDFs named by convention: `YYYY-WW - Title.pdf`
  (e.g. `2026-04 - Week 4 Recap.pdf`). Backend parses name → `{season, week, title}`.
- Folder ID stored in PropertiesService `NEWSLETTER_FOLDER_ID` (not in code).
- No new sheet needed — the folder listing *is* the index.

## PropertiesService keys (all write-only from Claude's side)
| Key | What |
|---|---|
| `NEWSLETTER_FOLDER_ID` | The private Drive folder's ID |
| `NEWSLETTER_PASSWORD_HASH` | SHA-256 of the family password (set via `setNewsletterPassword()`) |
| `NEWSLETTER_TOKEN_SECRET` | Random secret used to sign/verify device tokens |

## Backend — new `v2-backend/Newsletter.gs`
- `setNewsletterPassword(pw)` — one-time, run from editor; stores the hash.
- `newsletterLogin(password)` → `{ok, token, expiry}` | `{ok:false}`.
  - Compares `hashPassword(password)` to `NEWSLETTER_PASSWORD_HASH`.
  - Token = `expiryMs + "." + hmacHex(secret, expiryMs)`; ~30-day expiry.
- `validateNewsletterToken_(token)` — recomputes the HMAC, checks not expired.
- `getNewsletterList(token)` → `{ok, items:[{id, season, week, title, date}]}` |
  `{ok:false, needAuth:true}`. Metadata only — no file bytes.
- `getNewsletter(token, fileId)` → `{ok, name, mime, dataBase64}`.
  - **Guard:** verify `fileId`'s parent is `NEWSLETTER_FOLDER_ID` so a valid token can't
    be used to pull arbitrary Drive files by ID.
  - Returns the PDF bytes base64-encoded.

## Manifest / scope
- Add `https://www.googleapis.com/auth/drive.readonly` to `appsscript.json`.
- **One-time re-authorization** required after this (adding a scope always is).

## Wiring
- Add `newsletterLogin`, `getNewsletterList`, `getNewsletter` to `apiFunctions_()`
  in `Code.gs` **and** the `FN` list in `v2-frontend/build.js`.
- **Recommended:** send the password via **POST** (not GET) so it isn't left in URLs /
  execution logs. Minor addition to the fetch shim in `build.js` (login uses POST; the
  rest can stay GET). Low effort, worth it.

## Frontend — `Index.html` / `Scripts.html` (Newsletter tab already exists)
- On open: read `gffl_news_token` from `localStorage`.
  - Valid & unexpired → call `getNewsletterList(token)` → render list.
  - Missing / expired / rejected → show **password prompt** ("Remember on this device"
    checked by default).
- Password prompt → `newsletterLogin` → store token → load list.
- List: grouped by season/year; each row taps into the viewer.
- Viewer: base64 → **Blob** → `URL.createObjectURL` → open in `<iframe>` (or a new tab).
  Blob URLs render PDFs more reliably than data URIs, especially on iOS.

## Honest caveats
- **Shared password = family-grade security.** One secret; anyone given it (or who reads
  a device's `localStorage`) can view all newsletters. Fine for a family league; not
  per-person auditable. Rotating = call `setNewsletterPassword()` again (invalidates
  nothing automatically — bump `NEWSLETTER_TOKEN_SECRET` to force re-login everywhere).
- **PDF size:** base64 inflates ~33%; keep newsletters modest (< ~10 MB) to stay well
  inside Apps Script response limits. Compress scans.
- **Not related to the owner-route issue** — those `?action=` admin routes still need a
  route key before rollout; that's separate from this.

## One-time setup checklist
1. Create the private Drive folder; copy its ID.
2. From the Apps Script editor set the three PropertiesService keys
   (`setNewsletterPassword("…")`, folder ID, random token secret).
3. Add the Drive scope; re-authorize the app.
4. Drop a test PDF in the folder named `2026-04 - Week 4 Recap.pdf`.
5. Deploy backend (`clasp push` + `deploy`), rebuild `docs/` (`node v2-frontend/build.js`),
   commit, test on a phone.

## Phasing
- **Phase 1 (this plan):** password gate + list + in-app PDF viewer.
- **Phase 2 (later):** browse-by-year archive UI, download button, optional offline caching
  of already-viewed PDFs, per-person passwords if ever needed.
