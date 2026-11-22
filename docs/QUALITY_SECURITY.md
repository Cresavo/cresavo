# Quality and security baseline

The demo is allowed to be a demo. This file defines what must be true before
**real customers** use the product, and which habits we keep from day one so
we never have to retrofit them. See the [privacy and security overview](PRIVACY_SECURITY.md) and
[data flows](DATA_FLOWS.md) for the current implementation.

## From day one (applies to all code now, including the demo)

- **Tests where logic lives.** Parsers, store actions, AI task schemas,
  booking rules, permissions: unit tests (vitest). Database rules:
  integration tests against a separate `_test` database. Key user journeys:
  Playwright end-to-end at 390 px and 1280 px.
- **CI is the gate.** `.github/workflows/verify.yml` runs lint, typecheck,
  unit, integration, build and e2e on every push. Red CI is fixed before new
  features. The security checks are listed [below](#security-checks).
- **No secrets in Git.** Keys only in `.env` / the host's secret store.
  Never log keys, customer contact data, journal text or AI prompts with
  personal data.
- **Server decides.** Validate all input on the server (zod). Never trust
  ids, prices, roles or "confirmed" flags from the client.
- **AI only proposes.** Agents (internal or external via MCP/A2A) create
  proposals; a human approves, unless the owner explicitly enabled
  auto-approve for that action type. Tools are allow-listed per role. Treat
  all text from customers, web pages and AI output as untrusted (prompt
  injection): it can never grant permissions or trigger writes by itself.
- **Everything is logged.** Every change records who (human/AI/integration),
  what, before/after and a request id. This is both support and audit trail.
- **Synthetic data only** until the pilot gate below is passed.

## Security checks

| Check (workflow → check name) | Runs | Results | Blocks merge? |
|---|---|---|---|
| CodeQL (`codeql.yml`) → `Analyze (javascript-typescript)`, `Analyze (actions)` | PRs to `main`, pushes to `main`, Mondays, manual | **Security** → **Code scanning**, and as PR annotations | Yes: both jobs are required, and new CodeQL alerts (security high or higher, or errors) block merge through **Protect main** |
| Dependency review (`dependency-review.yml`) → `Dependency review (high/critical gate)` | Every PR to `main` | Job summary of the PR check | Fails on new or changed dependencies (runtime and development) with a high or critical advisory. Required by **Protect main** |
| Secret scan (`secret-scan.yml`) → `Gitleaks (full history)` | PRs, pushes to `main`, manual | Job log (matches are redacted) | Yes, required by **Protect main** |
| GitHub secret scanning and push protection | Every push (repository setting) | **Security** → **Secret scanning** | Push protection rejects a push with a recognised token |
| Weekly dependency audit (`dependency-audit.yml`) | Mondays, manual | Job summary | No; a failed run is fixed before new features |
| OpenSSF Scorecard (`scorecard.yml`) | Pushes to `main`, Mondays, manual | **Security** → **Code scanning** (tool Scorecard) | No. Its SARIF upload is not a CodeQL analysis |
| Dependabot (`dependabot.yml`) | Weekly | Pull requests | No |

**Protect main** (ruleset 27584925) requires a pull request, blocks deletion
and force pushes, requires five status checks (`E2E dev / proxy 0` from
Verify POC, `Gitleaks (full history)`, `Dependency review (high/critical
gate)`, `Analyze (javascript-typescript)` and `Analyze (actions)`), and
requires CodeQL code scanning results. Set up on 2026-11-19; see the
[launch checklist](LAUNCH_CHECKLIST.md#right-after-publishing), step 10.

Dependency review reads the dependency graph through the GitHub API, so the
repository's **Dependency graph** setting must be on (confirmed on
2026-11-19). On PR #65 the first runs failed with `403 Forbidden`; after the
setting was confirmed on, a re-run of the same commit passed. Whether the
setting was off before is not known. If a 403 comes back, check that setting
first, then token permissions and API limits. The workflow keeps its minimal
permissions (`contents: read`).

CodeQL uses an advanced workflow, so CodeQL *default setup* in the repository
settings must stay off. Successful `Analyze` jobs show that the CodeQL
analysis ran and uploaded results; they do not show that it found nothing.
Findings block merge through the **Require code scanning results** rule in
**Protect main** (tool CodeQL, security alerts high or higher, alerts
errors). GitHub also supports this through branch protection; the ruleset is
the chosen solution here. The rule judges alerts in the pull request's
changes; existing alerts on `main` are listed under **Security** →
**Code scanning** and handled as below.

Handling a finding:

- **Code scanning alert:** fix it in a PR that references the alert. Dismiss
  it as a false positive or "won't fix" only with a written reason in the
  alert; never weaken queries or rules to get green.
- **Dependency review failure:** upgrade to the patched version shown in the
  summary, or choose another package. An exception (`allow-ghsas`) needs a
  documented reason and a follow-up issue.
- **Secret alert or push-protection block:** never paste the value into an
  issue or PR. Treat the secret as exposed: revoke or rotate it at the
  provider, then remove it from the code. Bypassing push protection is only
  for verified test values and needs a reason.

## Pilot gate: before the first real customer

Security
- [x] Owner accounts: secure sessions (HttpOnly, `Secure` in production,
      `SameSite=Strict`, 12-hour idle and 14-day absolute timeout, "sign out
      everywhere"), password reset (30-minute single-use signed link, all
      sessions ended) and account lockout (5 failures in 15 minutes, doubling
      lock up to 8 hours, one generic answer). Behind `OWNER_ACCOUNTS_ENABLED`.
- [x] MFA for owners: two-step sign-in (TOTP with ten single-use recovery
      codes), secret encrypted under `OWNER_MFA_KEY`, codes single-use under
      races, wrong codes in the same lock-out as passwords, and
      `OWNER_MFA_REQUIRED=1` to make it mandatory for the pilot.
- [ ] Real authentication for staff (still open).
- [ ] Tenant isolation enforced in the database (row-level security or
      equivalent) and covered by tests that try to read another tenant.
      The tests exist (`tests/integration/tenant-isolation.test.ts`: owner
      routes, public booking links, the store and its sweeps, each against a
      second salon). Still open: enforcement in the database itself (RLS or
      equivalent). Today isolation rests on the application's `tenant_id`
      conditions, which these tests guard.
- [ ] Roles and permissions (owner, staff, support with time-limited access).
- [x] Rate limiting on public endpoints (booking, login, AI). Audited
      2026-11-22: every public or demo route under `/api` (not `/admin`,
      `/api/v1`) that writes data, sends mail or can cost money is limited,
      listed below. The key is the verified client address (`waitlistClientKey`
      / `clientIp`: the platform's `x-real-ip` on Vercel, otherwise the signed
      wrapper's address; callers behind no verified address share one bucket).
      Limits marked "store" use `src/lib/rate-limit.ts` (shared Postgres table
      when `RATE_LIMIT_STORE=postgres`, required on Vercel, else per process);
      "process" limits count in one server process only.

      | Route | Limit | Key | Abuse it stops |
      |---|---|---|---|
      | `owner/login`, `demo/session` | 5 per 15 min, plus account lock-out (store) | address, typed e-mail | password guessing |
      | `owner/signup` | 5 per 15 min (store) | address | account and salon rows |
      | `owner/password/reset-request` | 5 per 15 min, plus 3 mails per 15 min per mailbox (store) | address, mailbox | reset mail sends |
      | `owner/password/reset` | 10 per 15 min (store) | address | token guessing |
      | `public/salons/[slug]` GET, `.../bookings/[id]` POST (view) | 120 per 15 min (store) | address | DB reads |
      | `public/salons/[slug]/bookings`, `.../[id]/cancel`, `.../[id]/move` | 10 per 15 min (store), and 60 writes per hour per salon (store) | address; salon | booking writes, mail |
      | `bookings` (legacy engine) | 30 per 15 min (store), plus idempotency | address | booking writes |
      | `concept/ai/[task]` | provider calls need the server bearer token and same origin, then 8 per min per address and 200 per day per instance (process); the rules fallback costs no money | address; instance | paid AI calls |
      | `concept/ai` PUT/DELETE, `concept/proposals` DELETE, `concept/proposals/[id]` POST | 30 per min (process), added 2026-11-22 | address | disk and demo-state writes |
      | `concept/poster` | 120 per min (process) | address | CPU |
      | `concept/mcp` | 120 per min after the bearer check (process) | token hash | demo tool calls |
      | `concept/a2a` | 300 per min (process) | one shared key | read-only calls |
      | `waitlist` | 5 per 10 min (process); also limit it in the firewall when a real provider is set | address | waiting-list writes |
      | `pairing/*` | 180 per min per address and 3000 per min overall (database) | address; global | pairing rows |
      | `sandbox/pair`, `sandbox/phone*` | 3 pairings per day per address; 128 requests per phone session (database) | address; session | sandbox rows |

      Left without an application limit, on purpose: cheap read-only GETs
      (`availability`, `services`, `staff`, `concept/help`, `usp`,
      `a2a/agent-card.json`, `protocols`, `connections`, `calendar`,
      `proposals` GET, the signed calendar feed) and `locale` (sets a cookie).
      `concept/connections/webhooks/*` answers 404 unless a live adapter
      verifies the signature, with a 256 KB body cap; `sandbox/phone/redeem`
      only reads until a 256-bit link token matches; `pairing/sweep` and
      `sandbox/reset` need the cron secret; `owner/me`, `logout*`, `salon*`
      need an owner session. Edge limits for the read-only routes are the
      firewall rule in [DEPLOY_DEMO](DEPLOY_DEMO.md); the application does not
      replace it. Not done: a shared store for the "process" limits (needs
      Postgres on the public demo, which has none).
- [x] Owner studio changes (`/api/owner/salon/actions`) validated field by
      field per action type, not only by an allowlist of action types.
- [ ] Encryption at rest for journal entries and other sensitive fields.
- [x] Secret scanning and code scanning (e.g. GitHub secret scanning and
      CodeQL) enabled; no high/critical dependency findings.
- [x] Security headers (CSP with nonce, HSTS in production, `frame-ancestors`
      and `X-Frame-Options`, Referrer-Policy, Permissions-Policy, nosniff),
      asserted per route class in `tests/security-headers.test.ts`, and
      same-origin checks on owner writes.
- [ ] External penetration test or at least an independent review.

Privacy (GDPR)
- [ ] Data processing agreement template for salons (they are controller,
      we are processor) and a list of sub-processors (hosting, SMS, AI).
      Drafts: [DPA_TEMPLATE](legal/DPA_TEMPLATE.md),
      [SUBPROCESSORS](legal/SUBPROCESSORS.md). They need legal review.
- [ ] Journal entries may be health data (special category): DPIA done,
      access restricted and logged, retention rules set. Code: reads are
      logged (who, when, which customer, never content) and visible to the
      owner, and the owner sets a review period. Open: the DPIA is a draft
      ([DPIA_JOURNAL](legal/DPIA_JOURNAL.md)), access is not restricted on the
      server, and journals still travel to the browser with the whole salon, so
      the log relies on the studio reporting each read.
- [x] Customer rights: export, correction, deletion, implemented and tested.
      (Studio, per customer: JSON and spreadsheet export, every personal field
      editable, permanent erasure with a confirmation. Legal sign-off on what
      is kept for bookkeeping is separate.)
- [ ] AI providers: data processing terms in place, no training on customer
      data, EU processing where possible; personal data minimised in prompts.
- [ ] Retention and deletion jobs running and tested. Code and tests are
      done (`npm run store:sweep`, "Customers due for review"); the periods in
      `src/concept/privacy/retention.ts` still need the salon's or a lawyer's
      confirmation, and an operator must schedule the sweep.

Operations
- [ ] Automated backups with a tested restore (documented restore drill:
      [BACKUP_RESTORE](operations/BACKUP_RESTORE.md); tick when its drill log
      has a passing row and the maintainer has confirmed RPO and RTO).
- [ ] Least-privilege database roles in place for app, sweeper and support
      (`prisma/grants/roles.sql`, with `studio-store.sql` and `erase-subject.sql`;
      `verify-studio-store.sql` and `verify-roles.sql` return no rows for the real logins).
- [ ] Error tracking and alerting to phone; status page.
- [ ] Structured logs with request id, retention defined.
- [ ] Runbook for incidents, including personal data breach notification
      (72 hours to the supervisory authority):
      [INCIDENT_RUNBOOK](operations/INCIDENT_RUNBOOK.md). Written; the breach
      section is a placeholder until legal has approved it.
- [ ] Load test of booking and calendar for expected peak.

Quality
- [ ] Critical journeys covered end-to-end: customer books, reschedules,
      cancels; owner moves, cancels, writes journal; AI proposal approved.
- [ ] Accessibility check (WCAG 2.2 AA) on customer booking and core owner views.
- [ ] Test coverage reported in CI for domain and permissions code.

The [roadmap](ROADMAP.md#pilot-readiness) tracks pilot readiness.
