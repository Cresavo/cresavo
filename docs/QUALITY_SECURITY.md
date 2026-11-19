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
| CodeQL (`codeql.yml`) → `Analyze (javascript-typescript)`, `Analyze (actions)` | PRs to `main`, pushes to `main`, Mondays, manual | **Security** → **Code scanning**, and as PR annotations | Not yet. Planned: required status checks and a code scanning results rule in the **Protect main** ruleset (see below) |
| Dependency review (`dependency-review.yml`) → `Dependency review (high/critical gate)` | Every PR to `main` | Job summary of the PR check | Fails on new or changed dependencies (runtime and development) with a high or critical advisory. Not yet a required check |
| Secret scan (`secret-scan.yml`) → `Gitleaks (full history)` | PRs, pushes to `main`, manual | Job log (matches are redacted) | Yes, required by **Protect main** |
| GitHub secret scanning and push protection | Every push (repository setting) | **Security** → **Secret scanning** | Push protection rejects a push with a recognised token |
| Weekly dependency audit (`dependency-audit.yml`) | Mondays, manual | Job summary | No; a failed run is fixed before new features |
| OpenSSF Scorecard (`scorecard.yml`) | Pushes to `main`, Mondays, manual | **Security** → **Code scanning** (tool Scorecard) | No. Its SARIF upload is not a CodeQL analysis |
| Dependabot (`dependabot.yml`) | Weekly | Pull requests | No |

`Verify POC` → `E2E dev / proxy 0` is also required by **Protect main**
(ruleset 27584925). The CodeQL and Dependency review checks are not required
yet; the maintainer adds them in the order in the
[launch checklist](LAUNCH_CHECKLIST.md#right-after-publishing), step 10.

Dependency review reads the dependency graph through the GitHub API. On PR #65
it failed with `403 Forbidden`; the cause is not established yet. A disabled
**Dependency graph** setting is one possible cause to verify; token
permissions and API limits can also return 403. The workflow keeps its
minimal permissions (`contents: read`) until there is evidence that another
fix is needed.

CodeQL uses an advanced workflow, so CodeQL *default setup* in the repository
settings must stay off. Successful `Analyze` jobs show that the CodeQL
analysis ran and uploaded results; they do not show that it found nothing.
Whether findings block merge depends on a required code scanning results
check. GitHub supports that through a ruleset or through branch protection.
The chosen solution here is a **Require code scanning results** rule in
**Protect main** (tool CodeQL, security alerts high or higher, alerts
errors). Until it is enabled, findings are reported but do not block merge.

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
- [ ] Real authentication for owners/staff with MFA, secure sessions,
      password reset and account lockout.
- [ ] Tenant isolation enforced in the database (row-level security or
      equivalent) and covered by tests that try to read another tenant.
- [ ] Roles and permissions (owner, staff, support with time-limited access).
- [ ] Rate limiting on public endpoints (booking, login, AI).
- [ ] Encryption at rest for journal entries and other sensitive fields.
- [ ] Secret scanning and code scanning (e.g. GitHub secret scanning and
      CodeQL) enabled; no high/critical dependency findings.
- [ ] Security headers (CSP, HSTS, frame-ancestors) and CSRF/origin checks.
- [ ] External penetration test or at least an independent review.

Privacy (GDPR)
- [ ] Data processing agreement template for salons (they are controller,
      we are processor) and a list of sub-processors (hosting, SMS, AI).
- [ ] Journal entries may be health data (special category): DPIA done,
      access restricted and logged, retention rules set.
- [ ] Customer rights: export, correction, deletion, implemented and tested.
- [ ] AI providers: data processing terms in place, no training on customer
      data, EU processing where possible; personal data minimised in prompts.
- [ ] Retention and deletion jobs running and tested.

Operations
- [ ] Automated backups with a tested restore (documented restore drill).
- [ ] Error tracking and alerting to phone; status page.
- [ ] Structured logs with request id, retention defined.
- [ ] Runbook for incidents, including personal data breach notification
      (72 hours to the supervisory authority).
- [ ] Load test of booking and calendar for expected peak.

Quality
- [ ] Critical journeys covered end-to-end: customer books, reschedules,
      cancels; owner moves, cancels, writes journal; AI proposal approved.
- [ ] Accessibility check (WCAG 2.2 AA) on customer booking and core owner views.
- [ ] Test coverage reported in CI for domain and permissions code.

The [roadmap](ROADMAP.md#pilot-readiness) tracks pilot readiness.
