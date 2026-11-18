# Quality and security baseline

The demo is allowed to be a demo. This file defines what must be true before
**real customers** use the product, and which habits we keep from day one so
we never have to retrofit them. Detailed legacy analysis lives in
`docs/PRIVACY_SECURITY.md` and `docs/DATA_FLOWS.md`.

## From day one (applies to all code now, including the demo)

- **Tests where logic lives.** Parsers, store actions, AI task schemas,
  booking rules, permissions: unit tests (vitest). Database rules:
  integration tests against a separate `_test` database. Key user journeys:
  Playwright end-to-end at 390 px and 1280 px.
- **CI is the gate.** `.github/workflows/verify.yml` runs lint, typecheck,
  unit, integration, build and e2e on every push. Red CI is fixed before new
  features. Dependency audit runs weekly (`dependency-audit.yml`).
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

The pilot gate is tracked as goal 12 in `docs/goals/QUEUE.md`.
