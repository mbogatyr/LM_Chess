# Publish to Azure Static Web Apps via GitHub Actions — design

**Date:** 2026-07-20
**Status:** approved (short spec; light track — direct implementation, no separate plan doc)

## Goal

Publish the static Vite build of LM_Chess to **Azure Static Web Apps (SWA)**,
deployed automatically by **GitHub Actions** on every push to `main`, with PR
preview environments. Frontend-only static hosting — no backend, matching the
project's hard constraint.

## Decisions (confirmed)

- **Auth / wiring:** deployment token stored as a GitHub Actions secret; the
  workflow is authored by us and landed via a feature branch + PR (SWA created
  **disconnected**, i.e. not linked to the repo by Azure).
- **Azure resource:** resource group `neuro-chess-swa-rg` in **West Europe**;
  Static Web App **`neuro-chess`**, **Free** SKU.
- **Build:** the SWA deploy action builds via Oryx (`app_location: "/"`,
  `output_location: "dist"`); Vite is auto-detected. No `base` change (served
  from root). No `staticwebapp.config.json` — the app is a state-router SPA with
  no path-based routes (YAGNI).

## Steps

### 1. Azure (via the logged-in `az` CLI)

- `az group create -n neuro-chess-swa-rg -l westeurope`
- `az staticwebapp create -n neuro-chess -g neuro-chess-swa-rg -l westeurope --sku Free`
  (no `--source`/`--branch` — disconnected).
- Read the deployment token: `az staticwebapp secrets list -n neuro-chess -g neuro-chess-swa-rg --query "properties.apiKey" -o tsv`.
- Record the default hostname: `az staticwebapp show ... --query defaultHostname -o tsv`.

### 2. GitHub secret

- `gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN` with the token piped via stdin
  (never printed to the transcript/logs).

### 3. Workflow (feature branch + PR)

`.github/workflows/azure-swa.yml`:

- **Triggers:** `push` to `main`; `pull_request` (opened, synchronize,
  reopened, closed) targeting `main`.
- **Build-and-deploy job** (skip on PR `closed`): `actions/checkout@v4` (with
  `submodules: false`), then `Azure/static-web-apps-deploy@v1` with
  `azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}`,
  `repo_token: ${{ secrets.GITHUB_TOKEN }}` (for PR comments/preview envs),
  `action: "upload"`, `app_location: "/"`, `output_location: "dist"`.
- **Close-preview job** (only on PR `closed`): the same action with
  `action: "close"`.

The existing `ci.yml` (lint/format/typecheck/test/build gate) is untouched —
deployment is a separate workflow.

### 4. Verification

- After the workflow's first `main` run is green, fetch the site and confirm it
  serves the app (title/heading present). Confirm the deployment succeeded in
  the Actions run and the SWA `defaultHostname` responds 200.

### 5. Docs

- Update `CLAUDE.md` (remove "no deploy step yet"; note the SWA + workflow) and
  `README.md` (a short "Deployment" section + the LM Studio CORS note below).
- Record the live URL and setup in memory.

## Runtime note (documented, not a deploy blocker)

The deployed HTTPS page calls `http://localhost:1234` (LM Studio). Browsers
treat `http://localhost` as a potentially-trustworthy origin, so it is not
blocked as mixed content; but **LM Studio must send CORS headers**
(`Access-Control-Allow-Origin`) for the site's origin
(`https://<name>.azurestaticapps.net`). This is a per-user local setting; the
README will call it out.

## Out of scope

- Custom domain / TLS beyond the default `*.azurestaticapps.net`.
- OIDC federated deploy credentials (chose the deployment token).
- Standard SKU features (APIs, SLA, private endpoints).
- Any backend/serverless — the project is frontend-only by constraint.
