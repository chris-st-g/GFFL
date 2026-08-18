# GFFL 2.0 — separate backend + GitHub Pages frontend

An **isolated** experiment, fully separate from the production GFFL app (its own
Apps Script project **and** its own Google Sheet). Safe to trash.

## Architecture
- **Backend** (`../v2-backend/`) — a clone of the GFFL Apps Script app plus a JSON
  API (`apiDispatch_` / `doPost`, route `?action=api&fn=NAME&args=[...]`). It owns
  its own spreadsheet (created by `?action=setup`).
- **Frontend** (`../docs/`) — a static site on GitHub Pages. Built from the backend
  HTML by `build.js`, which inlines the `<?!= include ?>` templates and injects a
  `fetch`-based `google.script.run` shim so the same UI code talks to the API.

## Key IDs / URLs
| Thing | Value |
|---|---|
| Apps Script project (GFFL 2.0) | scriptId `1l5FGTAmgLKUTQt-oLzzEvrsGEsKZbqtUSw3KoEZeqvC7f8KHNl6Scj49` |
| Editor | https://script.google.com/home/projects/1l5FGTAmgLKUTQt-oLzzEvrsGEsKZbqtUSw3KoEZeqvC7f8KHNl6Scj49/edit |
| Web app `/exec` (API) | https://script.google.com/macros/s/AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw/exec |
| deploymentId | `AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw` |
| GitHub Pages site | https://chris-st-g.github.io/GFFL/ (branch `gffl-2.0`, `/docs`) |

## First-time backend setup (owner, one time)
1. Open the editor (link above) → run `setupSheet` once → **authorize** the scopes.
2. Run `setAdminPassword('yourPassword')` to set the commissioner password.
3. Visit `…/exec?action=setup` to create the sheet tabs + seed the sample league.

## Rebuild / redeploy
```
# Backend (from repo root):
cd v2-backend && clasp push --force \
  && clasp deploy --deploymentId AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw --description "..."

# Frontend (from repo root): rebuild docs/ then commit + push (Pages auto-deploys)
node v2-frontend/build.js
git add docs && git commit -m "rebuild pages" && git push
```

If the API endpoint ever changes, update `API_URL` in `build.js` and rebuild.
