# Open-source launch checklist (goal 13)

Status 2026-11-17: in-repo rename and front door done. Publishing waits for
Niclas. Agents never create repositories, change visibility or touch GitHub
settings. Name and structure: [BRAND.md](BRAND.md).

## Done in the repo

- [x] Product renamed from Booking Lab to Flerdo in user-facing text (landing
      `/`, root layout title, `/product`, `/live`, admin header, A2A agent card
      name, concept UI). Command box placeholder is "Ask Flerdo… what would you
      like to do?". Demo business stays "Salong Eko".
- [x] README (what, why, screenshots, quick start), LICENSE (AGPL-3.0).
- [x] `CONTRIBUTING.md` (English), `CODE_OF_CONDUCT.md` (Contributor Covenant
      2.1, contact `conduct@flerdo.com`), `SECURITY.md`.
- [x] Issue forms (`bug.yml`, `feature.yml`, `config.yml`) and
      `.github/pull_request_template.md`.
- [x] Draft individual and entity CLA: [legal/CLA.md](legal/CLA.md)
      (not usable before lawyer review).
- [x] First pattern scan of full history for both repos, 2026-11-16: no keys.
- [x] Fixtures are synthetic, avatars generated, demo data clearly fictional.

## Still to do in the repo (agents, before publishing)

- [ ] Run gitleaks or trufflehog over full history of the tree to be published
      and add it to CI (CI workflow changes were out of scope for this pass).
- [ ] Move or delete internal docs from the published tree: `docs/history/`,
      `docs/qa/`, old `EPIC_*`, plan and report docs, Swedish `DEMO.md`,
      `docs/verification/`, personal paths and names beyond the copyright line.
      Keep a short English `docs/` that matches the code.
- [ ] Add OpenSSF Scorecard workflow and Dependabot config (needs workflow
      changes, so done when Niclas agrees).
- [ ] Fresh-clone check: clone, `npm ci`, lint, tsc, test, build, ai:eval.
- [ ] Rename the engine identifiers (see "Deliberately left" below) in one
      pass at monorepo time.

## Needs Niclas

- [ ] GitHub org `flerdo` and repo `flerdo/flerdo` (new public repo, fresh
      short history squashed from the cleaned tree; current repo stays private
      as the archive).
- [ ] Domains: flerdo.com (+ flerdo.app, flerdo.se, flerdo.ai).
- [ ] npm scope `@flerdo`.
- [ ] Trademark search (EUIPO TMview, classes 9 and 42).
- [ ] Lawyer review of [legal/CLA.md](legal/CLA.md) (and the AGPL extension
      exception question for proprietary add-ons, plus the contact addresses
      `conduct@flerdo.com` and a security contact).
- [ ] Enable on the public repo: secret scanning with push protection, CodeQL
      code scanning, Dependabot alerts and updates, private vulnerability
      reporting (SECURITY.md assumes it).
- [ ] Branch protection on `main` (pull request and green CI required).
- [ ] Install the CLA Assistant GitHub app with the reviewed CLA text.
- [ ] Final approval, then flip visibility / publish. Agents do not do this.

## Monorepo move plan (next step)

Target `flerdo/flerdo`:

- `apps/web`: this repo (studio, customer pages, API, concept demo).
- `packages/gateway`: from booking-lab-gateway (REST, MCP, A2A, USP).
- `packages/ai`: tasks, router, evals (today `src/concept/ai` and
  `scripts/ai-eval.mts`).
- `docs/`: cleaned English docs.

Steps: (1) clean the tree per the list above; (2) set up npm workspaces and
one CI; (3) move with `git mv` so blame survives, then squash into the new
repo; (4) rename package names to `@flerdo/*` and engine identifiers; (5) one
changelog and release; (6) archive `booking-lab-se` and `booking-lab-gateway`
as private. Paid integration service stays private as `flerdo/connect`.

## Deliberately left as "Booking Lab" (rename at monorepo time)

- `package.json` name and `package-lock.json`; plugin folder
  `plugins/booking-lab-time-card` and its manifest.
- Engine identifiers and descriptions: `src/lib/agent-api/*` (`/api/v1`,
  discovery text, OpenRPC title), `src/mcp/*` (MCP server names, owner/time
  card UI titles), `src/lib/postgres-rate-limit.ts`, A2A auth realm
  `booking-lab-local-demo`.
- Customer data export download filename `booking-lab-kunddata-del-*.json`
  (admin engine UI, Swedish) and the iCalendar `PRODID`.
- Scripts and integration pairing (`scripts/integration/*`, `record-demo.mjs`,
  `capture-landing.mjs`, `agent-mcp-smoke.mts`), Dockerfile, `.gitignore`.
- Tests that assert engine identifiers (`tests/agent-*`, `tests/integration/*`,
  `tests/time-card-ui/*`).
- Historical and engine docs: `docs/history`, `docs/qa`, `docs/verification`,
  EPIC and plan docs, reports, `DEMO.md`, `HANDOFF.md`, `GATEWAY_SPLIT.md`,
  `WORKPLAN.md`, `PROJECT_STATUS.md`, `PRODUCT_ROADMAP.md`, `DATA_FLOWS.md`,
  `docs/concept/CODEX_GOAL_NIGHT1.md`, and repo names in `docs/goals`.
- The Swedish half of the old `/product`, `/live` and admin pages is Swedish
  copy for the engine demo; only the brand word changed there.
