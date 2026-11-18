# Cresavo QA routine

This is a repeatable routine for regular QA rounds of the concept demo. It is built on the scripts from the 18 November 2026 round (`qa/`) and is designed for a private repository where every GitHub Actions minute costs money.

> The tool comparison comes from my own knowledge (cut-off mid-2026). I had no web access in this session, so I checked no current prices, quotas or versions. Check the free-tier numbers below before you rely on them.

## 1. Recommended stack

| Need | Tool | Why |
|---|---|---|
| Regression of flows, hosts and navigation | **Playwright** (already a dev dependency). Today the scripts are plain Node in `qa/`. Later they become `@playwright/test` specs with `trace: "retain-on-failure"`. | Free, already used by `tests/concept-e2e`. A trace gives DOM, network and console for each failure, so a failed CI run can be debugged without rerunning it. |
| Accessibility | **axe-core** run in the page. Use `@axe-core/playwright` once the scripts are specs. | It found 0 violations today, which makes it a cheap guard against regressions. It runs inside the same browser session, so it needs no extra service. |
| Links | **The project's own crawler** (`qa/crawl.mjs`) | The studio renders on the client and keeps state in localStorage. Generic link checkers (linkinator, lychee) fetch HTML without running JavaScript, so they miss the studio's links. |
| Visual regressions | **Playwright `toHaveScreenshot`**, on about 15 key screens, nightly only | Free, and the baselines live in the repo. The data is relative to today's date, so tests must fix the clock (`page.clock.setFixedTime`) and seed `createDemoState(<fixed date>)`. Otherwise every screenshot differs every day. |
| Exploratory review | **Codex CLI (gpt-6.2-sol) or Claude Code with a QA prompt**, run on a developer machine | It found 15 real problems today that the scripted checks did not catch. It runs on a subscription, not on Actions minutes. A person triages the findings, and every confirmed one becomes a regression check. |
| Production host routing | **A small curl smoke job after each production deploy** (or Checkly, see below) | H1 and M1 only appear on the real domains. Preview deployments are `*.vercel.app`, which resolves as "app", so previews cannot test host routing. |
| Performance | **Lighthouse CI**, on demand or monthly, for `cresavo.com`, `demo.cresavo.com/landing` and `/boka/salong-eko` | Only the public sites need performance budgets. Running it on every PR costs minutes for little gain. |

**Not recommended for now:**

- **Percy** and **BrowserStack** visual testing: paid beyond small free tiers, and `toHaveScreenshot` covers the need.
- **Chromatic**: built around Storybook, which this repo does not use.
- **Checkly**: optional. Its free hobby tier would give monitoring from outside every few minutes. The curl job in §4 is enough until launch.
- **BrowserStack** for real-device iOS Safari: add it only if iPhone users report problems. First, add a Playwright **WebKit** project to the nightly run for free.
- **Playwright MCP**: an alternative to Codex or Claude writing their own Playwright scripts. The quality is similar. Use whichever agent the owner already pays for.

## 2. Cadence and CI cost

| When | What | Where | Approx. time |
|---|---|---|---|
| **Every PR** that touches `src/**`, `scripts/**`, `package*.json` or `qa/**` (use path filters; cancel superseded runs) | Build as production, then `hosts`, `flows` and `crawl` (owner only), plus the existing unit tests | GitHub Actions, Chromium only | about 6–8 min (npm ci 1, build 2, scripts 3) |
| **Nightly** (cron, only if the branch changed that day) | Full `run-all` (`hosts`, `crawl` owner and staff, `nav` at 390/1280/dark, `flows`, `axe`, `tints`, `verify-findings`), then `toHaveScreenshot` and the WebKit project | GitHub Actions | about 15–18 min |
| **Before each production deploy** (promote) | The nightly run on the commit being promoted, if it has not already run | Actions (`workflow_dispatch`) | as nightly |
| **After each production deploy** | `qa/prod-smoke.sh` (§4) against the real domains | Actions on the `deployment_status` event, or Checkly | under 1 min |
| **Weekly, and before a milestone or demo for a customer** | Exploratory agent round (Codex or Claude), then triage, then new regression checks | Developer machine | 45–60 min of agent time |
| **Monthly or before launch** | Lighthouse CI on the 3 public pages | Locally or `workflow_dispatch` | 3 min |

**Cost estimate:** 40 PRs × 7 min + 22 nightly runs × 17 min + 10 deploys × 1 min ≈ **670 Linux minutes per month**. Private repos on the Free plan include, as I remember it, 2,000 minutes per month (3,000 on Pro or Team), with overage on Linux at about $0.008 per minute. That fits comfortably, but check the current numbers.

**Ways to keep the cost down:**
- `concurrency: { group: qa-${{ github.ref }}, cancel-in-progress: true }`.
- Path filters.
- Cache `~/.npm`, `~/.cache/ms-playwright` and `.next/cache`.
- Install only Chromium on PRs (`npx playwright install --with-deps chromium`).
- Skip the nightly run when nothing has merged since the last green run.
- Never run on macOS or Windows runners, which cost 10× and 2× as much.

## 3. Exact commands (local or CI)

```bash
# 0. once per machine
npm ci
npx prisma generate
npx playwright install chromium        # skip in sandboxes that already have /opt/pw-browsers
npm i -D axe-core                      # or set QA_AXE=/path/to/axe.min.js

# 1. build exactly like vercel.json
DATABASE_URL=postgresql://build@127.0.0.1:1/build_test \
NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1 NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com \
NEXT_TELEMETRY_DISABLED=1 npx next build

# 2. serve it like the public demo (separate terminal or background)
PORT=3100 PUBLIC_READONLY=1 BOOKING_RUNTIME=local \
NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1 NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com \
DATABASE_URL=postgresql://build@127.0.0.1:1/build_test node scripts/server.mjs   # prints BOOKING_SERVER_READY
# optional, to match production: BOOKING_PUBLIC_ORIGIN=https://demo.cresavo.com (discovery links, finding L8)

# 3. run everything (≈10 min), or name scripts: hosts crawl nav flows axe tints
node --import tsx qa/run-all.mjs
node --import tsx qa/run-all.mjs hosts flows crawl     # PR subset
node --import tsx qa/verify-findings.mjs               # re-check the open findings of the last round

# results: qa/out/summary.md, qa/out/*.json, qa/out/shots/*.png
```

**Environment knobs:**
- `QA_PORT` (default 3100).
- `QA_PRODUCT_DOMAIN` (default `cresavo.com`).
- `QA_CHROMIUM`, a browser binary. The default is Playwright's own, with a fallback to `/opt/pw-browsers/chromium-*`.
- `QA_AXE`.
- `QA_OUT`.
- `QA_CRAWL_MAX`.
- `QA_TINT_LIMIT`.

No DNS or `/etc/hosts` change is needed. `lib.mjs` maps `cresavo.com`, `*.cresavo.com`, `boka.salong-eko.example` and an unknown host to the local port with Chromium's `--host-resolver-rules`. It also marks those http origins as secure so that the browser behaves as it does on https (Sec-Fetch headers, the clipboard).

### Exploratory round with Codex

```bash
codex login status
# prompt: qa-out/codex/PROMPT.md (adjust the date/focus); it writes only to qa-codex/
codex exec -m gpt-6.2-sol --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true --skip-git-repo-check \
  "$(cat qa/exploratory-prompt.md)" < /dev/null > qa-codex/run.log 2>&1
```

- The `< /dev/null` is required. Without it, `codex exec` waits on stdin when started in the background.
- The sandbox reached `127.0.0.1:3100` with these flags.
- Then reproduce each finding: add a check to `qa/verify-findings.mjs`, mark it confirmed or not reproducible, and move confirmed checks into the regression scripts once fixed.

## 4. Post-deploy production smoke (`qa/prod-smoke.sh`, to add)

```bash
#!/usr/bin/env bash
set -euo pipefail
fail=0; check(){ if ! eval "$2"; then echo "FAIL $1"; fail=1; else echo "ok   $1"; fi; }
apex=$(curl -sS -D - https://cresavo.com/ -o /tmp/apex.html)
check "apex 200"                 '[[ "$apex" == *" 200"* ]]'
check "apex indexable"           '! grep -qi "^x-robots-tag" <<<"$apex"'                     # finding M1
check "apex demo link absolute"  'grep -q "href=\"https://demo.cresavo.com/\"" /tmp/apex.html' # finding H1
check "demo landing"             'curl -sS https://demo.cresavo.com/ | grep -q "booking and customers"'
check "tenant page"              'curl -sS https://salong-eko.cresavo.com/ | grep -q "<title>Book online"'
check "tenant isolation"         'curl -sS https://salong-eko.cresavo.com/studio | grep -q "No booking page here"'
check "discovery docs"           '[[ $(curl -s -o /dev/null -w "%{http_code}" https://demo.cresavo.com/api/concept/usp) == 200 ]]' # L8
exit $fail
```

## 5. What to commit, and where

| Path in the repo | Content | Notes |
|---|---|---|
| `qa/lib.mjs`, `qa/pages.mjs` | Shared launch, host mapping, collectors, page list | As delivered |
| `qa/hosts.mjs`, `qa/crawl.mjs`, `qa/nav.mjs`, `qa/flows.mjs`, `qa/axe.mjs`, `qa/tints.mjs`, `qa/run-all.mjs` | Regression scripts | As delivered. `flows.mjs` and `run-all.mjs` need `--import tsx` (already a dev dependency). |
| `qa/verify-findings.mjs` | One check per open finding | Remove a check, or move it into `flows`/`hosts`, when its fix lands. Several checks currently expect REPRO. |
| `qa/exploratory-prompt.md` | Copy of `qa-out/codex/PROMPT.md` | Update the focus per round |
| `qa/prod-smoke.sh` | §4 | New |
| `.gitignore` | `qa/out/`, `qa-codex/` | Results are artefacts, not source |
| `package.json` | `"qa": "node --import tsx qa/run-all.mjs"`, `"qa:serve": "…server command from §3…"`, devDependency `axe-core` | |
| `.github/workflows/qa.yml` | PR, nightly and dispatch jobs (§6) | |
| later: `playwright.qa.config.ts` + `tests/qa-e2e/*.spec.ts` | Port `flows`, `hosts` and `nav` to `@playwright/test` with traces, `toHaveScreenshot` and a WebKit project, using a `webServer` that builds and serves as in §3 | Same pattern as `playwright.concept.config.ts`, but against the production build on port 3100 with `launchOptions.args` for host-resolver-rules |

Do not commit `qa/out/shots`. Upload them as a workflow artefact with `if: failure()` and `retention-days: 7` to save storage.

## 6. Workflow sketch (`.github/workflows/qa.yml`)

```yaml
name: qa
on:
  pull_request: { paths: ["src/**", "scripts/**", "qa/**", "package*.json", "next.config.ts"] }
  schedule: [{ cron: "17 2 * * *" }]   # nightly, 03:17 Stockholm (winter)
  workflow_dispatch: {}
concurrency: { group: "qa-${{ github.ref }}", cancel-in-progress: true }
jobs:
  qa:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      DATABASE_URL: postgresql://build@127.0.0.1:1/build_test
      NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO: "1"
      NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN: cresavo.com
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - uses: actions/cache@v4
        with: { path: "~/.cache/ms-playwright\n.next/cache", key: "pw-${{ hashFiles('package-lock.json') }}" }
      - run: npm ci && npx prisma generate && npx playwright install --with-deps chromium
      - run: npx next build
      - run: PORT=3100 PUBLIC_READONLY=1 BOOKING_RUNTIME=local node scripts/server.mjs & npx wait-on -t 60000 http://127.0.0.1:3100/landing
      - run: node --import tsx qa/run-all.mjs ${{ github.event_name == 'pull_request' && 'hosts flows crawl' || '' }}
      - if: always()
        run: cat qa/out/summary.md >> "$GITHUB_STEP_SUMMARY"
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: qa-out, path: qa/out, retention-days: 7 }
```

`wait-on` is not in the repo. Either add it as a dev dependency or replace that step with a short curl loop.

## 7. Triage rules for every round

1. Reproduce every finding, whether it came from scripts, an agent or a person, in a clean browser context before filing it. Mark it **confirmed** or **not reproducible**, and add the reason (test artifact, by design, or depends on time of day).
2. Severity: **High** means it blocks a core task or the public site's main path. **Medium** means wrong or stale information, data loss, or misleading copy. **Low** means polish.
3. Every confirmed finding gets a check in `qa/verify-findings.mjs` (expects REPRO). When it is fixed, the check is inverted and moved into the regression script for its area.
4. Keep the agent prompt focused on the areas that changed since the last round, plus one rotating "first-time owner" journey.
