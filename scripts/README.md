# scripts/

Utility scripts for GFFL development and deployment.

| Script | What it does |
|---|---|
| `deploy.sh` | Runs `clasp push --force` and reminds you to create a new deployment version |

## Usage

```bash
bash scripts/deploy.sh
```

## Rules

- Scripts are wrappers around manual steps — they do not replace the Apps Script editor where required
- No secrets or credentials in any script file
- All PropertiesService keys are documented in `.env.tpl` at the repo root
