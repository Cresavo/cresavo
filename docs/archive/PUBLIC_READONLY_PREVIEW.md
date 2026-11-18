# Public read-only preview · 2026-11-15

Local work on `codex/public-readonly-preview`, based on `e890b69`.

**Commit blocked:** `git commit -m "Add database-free public read-only preview and landing sketch"`
returned exit 128: `Author identity unknown` / `fatal: unable to auto-detect email address`.
No identity was configured or invented. There is no new commit SHA; HEAD remains
`e890b69`. The complete 66-file diff is staged and available with `git diff --cached`.
After configuring the intended identity, the user can run the commit command above.
The staged changes include the previously copied landing sketch
(user-provided origin: `4ce532e`); its copy, styles, assets and unpublished-sketch
wording were not edited in this task. That source commit is not present in this
repository object store, so a hash comparison against it was unavailable.
No push, PR, merge, rebase, deployment, database provisioning or external service.

## Configuration and behaviour

Set **`PUBLIC_READONLY=1` in the process environment before starting/building**.
Only the exact value `1` enables it. `.env.example` documents the opt-in, default `0`.
No actual environment/secret file was read, created or edited during this work.

The public preview uses fictional Fotvård (60 min, 65000 öre), Massage (30 min,
45000 öre), Anna (weekdays 09–17) and Erik (weekdays 10–16). Availability uses the
existing Stockholm scheduling engine, half-hour starts and 60-day window, including
weekends and past-time filtering. There are no fixture customer or booking records,
and no fixture campaigns. No contact data, accounts, keys or mandates are required.
The booking page displays a bilingual read-only notice and disables contact fields
and submission. The landing remains at `/landing` and `/en/landing`; `/` is the demo.

| Surface | Public read-only result |
| --- | --- |
| `/`, `/product`, `/landing`, `/en/landing` | Fixture demo/product or unchanged landing sketch |
| GET `/api/services`, `/api/staff`, `/api/availability` | Synthetic fixtures; normal query parameters |
| GET `/api/v1/services`, `/api/v1/availability` | Fixtures without an API key; `business=demo` defaults when omitted; existing range validation |
| GET `/api/v1/bookings/:id` | 404; no fixture booking is exposed |
| `/live`, `/api/v1/live`, `/admin`, `/admin/*`, `/api/admin/*` | HTTP 403 before rendering/handler work |
| POST `/api/locale` | Existing locale-cookie flow allowed |
| All other POST/PUT/PATCH/DELETE, including customer/agent bookings, cancel, admin login/logout/publish/data export/removal and demo session | HTTP 403 before authentication, request parsing or database access |
| HTTP-MCP `/api/v1/mcp` | Entire endpoint disabled: 403, including GET/DELETE |
| Basic local stdio MCP | Only fixture services and availability remain registered; admin/workspace writes absent |
| Direct domain, agent, key issue/rotate/revoke, mandate issue, session and card-write helpers | Shared guard throws safe DomainError 403; MCP maps the refusal to its error result |

The HTTP proxy is a broad guard, with direct route guards and library guards as
additional boundaries. Admin layout/live page also refuse direct rendering with
Next's 404 fallback; normal HTTP requests are stopped earlier with the tested 403.
Existing admin/product links are retained and lead to blocked pages in this mode.

`src/lib/db.ts` does not construct or reuse a Prisma/pg client in this mode. Every
shared DB access refuses, and `createDatabaseClient` independently refuses even an
explicit URL. **A present DATABASE_URL is never used in this mode.** The same holds
when `RATE_LIMIT_STORE=postgres` is present: preview limits use bounded process
memory. Local MCP subprocess configuration carries the read-only flag.

Vercel preview may start without DATABASE_URL or a Postgres limiter. Runtime policy
and the Next instrumentation hook create a missing SESSION_SECRET only in memory,
without logging it. Runtime/ingress/trust-proxy validation still applies. Restart
the process when changing mode. Without the flag, normal authentication, Postgres,
rate limits, mandates, locks, atomic transactions and migrations remain in place;
Vercel still requires DATABASE_URL, Postgres rate limits and a valid session secret.

## Files

- Preserved landing: `src/pages/landing.tsx`, `src/pages/en/landing.tsx`,
  `src/pages/landing.module.css`, `src/components/landing/Landing.tsx`,
  `public/landing/`, `scripts/capture-landing.mjs`, `docs/LANDING_REPORT.md`.
- Guard/fixtures/startup: `src/lib/public-readonly.ts`, `public-fixtures.ts`,
  `db.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `scripts/database.mjs`,
  `scripts/client-address.mjs`, `.env.example`.
- Direct API guards: customer booking, agent create/cancel/live and every admin
  route, plus demo session; HTTP-MCP is guarded in its shared handler.
- Shared library guards/reads: domain, workspace-config/write, booking-mutations,
  customers/customer-data, capacity, admin-accounts, auth/demo-access/rate-limit,
  agent-api bookings/keys/mandates/mcp/v1, local MCP server/environment and card
  booking/recovery helpers.
- UI: home, booking form, admin layout and live page. `next-env.d.ts` gained
  Next's generated navigation compatibility reference because Pages/App coexist.
- Tests: `tests/public-readonly.test.ts` (41 cases). This report and current
  PROJECT_STATUS/HANDOFF/VERIFICATION summaries document this branch separately.

## Verification

Final `npm run lint` output (exit 0):

```text
> booking-lab-se@0.1.0 lint
> eslint .
```

Final `npx tsc --noEmit`: exit 0, no output.

Final `npm test` result excerpt, verbatim (exit 0; flag unset for the existing tests):

```text
 Test Files  27 passed (27)
      Tests  195 passed (195)
   Start at  08:58:57
   Duration  5.25s (tests 78%, import 17%, transform 4%, worker 1%)
```

154 existing tests plus 41 new tests. New tests explicitly remove DATABASE_URL and
SESSION_SECRET; mock the DB constructor to fail any unexpected construction; call
all exported API mutations/admin handlers directly; verify the proxy and page
fallbacks; invoke registered MCP create/cancel callbacks; exercise domain/key/
mandate/card helpers; load home/product and fixture API reads; verify runtime
policy opt-in/off. Reads are repeated with a synthetic unused loopback URL and a
Postgres limiter setting. The real database factory's refusal is also tested.

Production build: PASS, exit 0, using this command, without a database or server:

```sh
env -u DATABASE_URL -u SESSION_SECRET PUBLIC_READONLY=1 BOOKING_RUNTIME=vercel VERCEL=1 RATE_LIMIT_STORE=memory NEXT_TELEMETRY_DISABLED=1 npm run build
```

The normal Next environment-file candidates were absent. Both landing routes,
all App routes and the proxy compiled. Final build excerpt (verbatim):

```text
✓ Compiled successfully in 931ms
  Running TypeScript ...
  Finished TypeScript in 4.7s ...
```

No server was started or port bound.
Earlier runs found a DB proxy/spy compatibility regression (8 old tests), local
TypeScript typing errors and one lint naming error; all were corrected without
weakening existing tests. The final unit/lint/types checks above passed.

## Not verified / residual limits

No running HTTP/browser smoke, visual screenshot comparison, integration/E2E,
physical mobile, external QA, audit, CI, Vercel deployment or cloud DB was run.
The production build and direct handler/proxy tests are local evidence, not a
hosted perimeter or browser acceptance test. No live booking, client registration,
customer consent, customer processing or customer communications are supported.
Public reads still consume compute; the process-memory limiter is not a global
anti-abuse service. There is no database exposure when the flag is set even if a
URL is present; accidental omission of the flag re-enables the ordinary product
path, so keep it explicitly configured for any later preview deployment.
