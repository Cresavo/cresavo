# Public agent booking sandbox

Status: approved for implementation with the conditions below. Hosted
resources, DNS, deployment and merge each require the owner's separate approval.

## What the visitor can try

An assistant connects to the independent gateway at `gateway.cresavo.com`.
The gateway forwards the existing provider v1 requests to Cresavo in split mode
at `sandbox.cresavo.com`. The tester approves as a fictional customer on a
private demo phone and sees the resulting appointment in their sandbox calendar.
The hosted sandbox uses a dedicated database and is separate from the browser
demo at `demo.cresavo.com`. All seed data is fictional. The sandbox sends no SMS
or email, collects no contact details and runs no model calls.

The gateway keeps its generic provider contract. Cresavo owns the agents,
authorizations, proposals, customer channel, mandates and bookings. The public
demo link, phone, calendar and reset are Cresavo surfaces outside the provider
API. [Gateway PR #9](https://github.com/Cresavo/gateway/pull/9) supplies shared
limits for hosting its existing container and [PR #10](https://github.com/Cresavo/gateway/pull/10)
supplies the provider contract and verification tools. Neither requires a
sandbox-specific gateway capability. [Cresavo PR #80](https://github.com/Cresavo/cresavo/pull/80)
is a separate operator-only staging profile. Reuse exact-terms checks where
applicable and keep its delivery, access policy and data separate.

## Run only in a marked sandbox

Enable the new `sandbox-demo-phone` delivery profile only with every condition
below. A bad or incomplete configuration rejects startup where there is an
entry point and fails closed at the server-side route boundary on serverless
deployments. Recheck the active database inside every sandbox transaction.

- Require `BOOKING_SANDBOX=1`, `BOOKING_CONSENT_DELIVERY=sandbox-demo-phone`,
  split mode (`BOOKING_SERVICE_ROLE=salon` and the existing valid gateway service
  credential), and distinct, bare HTTPS provider and gateway origins.
- A sandbox-only bootstrap migration, explicitly selected by the operator,
  marks a fresh, dedicated database with a singleton installation UUID, an
  immutable sandbox marker and a schema revision. Refuse to mark a populated
  database or a database created on the ordinary migration path. Keep the
  marker separate from the mutable reset generation. Require a database whose
  marker and revision match the expected installation and code. Require the ordinary runtime to
  refuse a marked database. Configure the runtime DB role to read the marker
  and the migrator to own it. Refuse unmarked, foreign or incompatible
  databases even when the sandbox flag is set. A hostname or database name
  alone cannot establish that a database is safe to reset.
- Reject any configuration combining this profile with the existing consent,
  SMS or OAuth labs, staging inbox, ordinary owner/customer entry points,
  public read-only fixture mode, pairing or any live messaging or AI delivery.
  Use an explicit sandbox host/route allowlist. The existing
  `requireConsentLab()` and `separateCustomerChannel()` guards, including their
  loopback, test-DB and Vercel restrictions, remain unchanged. Call them only for
  their existing profiles. A sandbox request never falls back to a lab or
  normal provider mode.
- Keep runtime credentials restricted to the dedicated database. Do not share
  a production database, deployment, database role, gateway service identity
  or browser session. Require the exact configured origin for sandbox
  browser traffic and bind the sandbox credentials to its Vercel project.
  Previews receive neither the live sandbox credentials nor the reset job.

## Pairing, isolation and the demo phone

1. A same-origin browser POST on the sandbox issues an agent key and a private
   demo-phone link, shown once on a no-store page. The agent key uses the
   existing v1 credential format and the four booking-related v1 scopes.
   Each pair gets a new immutable client and a private sandbox session. Store
   only the existing lookup metadata and key digest, plus separate digests for
   the phone and browser session. All three credentials expire at most 24
   hours after issuance and earlier when the nightly reset revokes them.
   The visitor gives their assistant only the agent key.
2. Use an atomic Postgres admission counter for at most three pairs per verified
   client address per UTC day. Normalize the trusted ingress address, group
   IPv6 by /64 and store a keyed digest, never the raw address. An unverifiable
   address or unavailable quota store refuses issuance. Send `429` with
   `Retry-After` to an address over its limit. Apply low, shared per-key limits
   and bounded global admission/storage limits before growing state. Keep
   the existing provider and gateway controls in force.
3. Each session gets its own copy of the Salong Eko scheduling scope and seed.
   Resolve the one public sandbox business ID to the principal's server-owned
   internal business partition. Never accept an internal partition ID or a
   session ID as authority from a request. Keep the normal business parser
   and credential paths unchanged. The existing native provider and parts of
   the booking engine select `demo` directly. Use a sandbox-only provider
   adapter with transaction-aware, tenant-scoped persistence, reusing the
   engine's booking rules. Every catalogue and availability lookup, proposal,
   mandate, slot conflict, idempotency lookup, customer quota, audit write
   and calendar query uses the server-derived partition. Generate fresh
   service and staff IDs for each copy and reject foreign IDs at lookup and
   write boundaries. Cap each session at 20 test bookings or its existing
   lower limit. The calendar is a session-scoped, read-only view of actual
   persisted bookings.
4. Put a random single-use phone credential in the URL fragment, clear it
   immediately in the browser, and exchange it over same-origin HTTPS for
   a separate random server-tracked browser session. Use a host-only
   `Secure`, `HttpOnly`, `SameSite=Strict` cookie. Make exchange atomic,
   validate the exact origin and use a session-bound CSRF check for approval
   or decline. Reject agent/service credentials on customer routes. Use
   no-store responses, no referrers or third-party resources, and no request,
   credential or token logging for pairing and phone routes.
5. Write the pending proposal and its phone inbox entry in the same
   transaction. Bind both to the immutable sandbox generation, session,
   agent client and business. The inbox entry needs no approval bearer link.
   Only the authenticated, matching phone can list or act on the proposal.
   Agent REST/MCP responses carry the existing proposal/status data and
   subsequently a mandate ID, never the phone link, a customer credential or
   the browser session. A foreign or unavailable item reveals no existence
   information.
6. Display the exact service and version, staff, location, start, duration,
   price/currency and expiry. Opening the phone or proposal authorizes
   nothing. For a decision, lock the proposal and recheck its binding, pending
   state, customer session, expiry, shown hash and current terms. Approval,
   mandate creation and inbox consumption commit together. Decline, a stale
   view or repeated approval creates no mandate. The booking transaction
   still enforces the current-terms, scope, ownership, idempotency, single-use
   mandate and slot-conflict checks. Construct the contact server-side from
   a fixed fictional name and `@example.test` identity. Any contact supplied
   in the existing booking wire shape has no effect on persistence, quotas or
   authorization. Never accept a phone number or send an external message.

The agent key can initiate the ordinary proposal flow. The demo phone can
approve only that session's proposals and grants no agent or owner privilege.
A visitor can act as both roles in this demonstration. This proves the
separation of channels and exact-terms consent, not real customer identity.
It follows [ADR decisions 2 and 3](ARCHITECTURE_DECISIONS.md) by isolating
sessions and keeping owner access separate from public booking. Approvals
neither establish legal consent under decision 4 nor change the production
identity or OAuth requirements.

## Reset and spend limits

Run a nightly UTC Vercel Cron only on the sandbox project. Require the
dedicated `CRON_SECRET`, the sandbox flag and the matching DB marker. Limit
reset privileges to this sandbox. In one DB transaction, take the exclusive
generation lock, revoke every pair and session by advancing the generation,
remove transient rows and restore the versioned fictional seed. Every
data access path takes a compatible lock, then checks the database marker,
generation and credentials. Keep that check, provider/domain work and audit
writes on the same transaction and connection. The existing handler, booking
engine and audit transactions need a transaction-aware sandbox entry point.
No delayed callback or rejected request may write audit or effect rows into a
new generation. Make the job idempotent per scheduled UTC day, and ensure
rollback cannot leave a partially reset
database serving. Store the last successful reset in the database and refuse
sandbox activity if a reset is overdue. Expire quota rows by their own TTL.
In particular the reset cannot erase the current day's pair-issuance counters
or allow an address to exceed its daily allowance.

Use the new `cresavo-sandbox` project in `niclasvestlund-3367s-projects` and
separate deployment configuration so the existing demo keeps its own build,
routes, and scheduled jobs. The owner creates a dedicated Marketplace
Postgres on a plan confirmed free, without a payment method or automatic
paid overages. Enforce application quotas, cap data growth and stop serving on
quota or database failure. Set **Pause production** on the sandbox project
budget and check the separate gateway project's budget and shared-store
quota. Vercel evaluates [project budgets](https://vercel.com/docs/spend-management)
periodically, only pauses production deployments, and excludes Marketplace
charges. Retained build and function storage can also accrue charges after
pausing. Treat the pause as a backstop. It cannot establish zero overage on
its own. The owner accepts the small residual Vercel usage risk with the
hard in-app caps for three pairs per IP per UTC day, 20 bookings per session
and eight sessions per hosted reset generation. Verify Marketplace hard
quotas, deployment retention and available shared plan credit first. The
free-plan and no-payment-method rules for Marketplace remain strict.

Proposed new configuration:

| Setting | Purpose |
| --- | --- |
| `BOOKING_SANDBOX=1` | Explicit opt-in on the standalone sandbox project. |
| `BOOKING_SANDBOX_DB_ID` | Expected installation UUID from the sandbox bootstrap migration. |
| `BOOKING_SANDBOX_ORIGIN` | Exact sandbox HTTPS origin, separate from the gateway. |
| `BOOKING_SANDBOX_IP_KEY` | Dedicated secret for digesting verified IP quota keys. |
| `BOOKING_CONSENT_DELIVERY=sandbox-demo-phone` | New value for the existing delivery selector. |
| `CRON_SECRET` | Sandbox project secret for the Vercel Cron endpoint. |

Reuse `DATABASE_URL`, `BOOKING_RUNTIME`, `BOOKING_SERVICE_ROLE`,
`BOOKING_PUBLIC_ORIGIN` and `GATEWAY_SERVICE_TOKEN` with their existing
meanings. For hosted use, generate one sandbox-specific service token and
configure it only in the sandbox and gateway projects' secret settings.

## Verification and delivery order

- Build the provider profile and test refusal for missing/incorrect flags,
  an unmarked or wrong DB, incompatible profiles, expired or already redeemed
  phone links, foreign agents and sessions, and repeated or concurrent
  approval. Prove no booking before approval and no consent link, credential
  or customer contact in agent responses. Exercise existing profiles
  unchanged and verify that the sandbox cannot reach admin, owner or live
  delivery surfaces.
- Add self-service and nightly reset. In Postgres tests, make two
  simultaneous sessions book the same displayed slot independently and
  verify that foreign resource IDs or bookings are refused and calendars
  stay separate. Test credential expiry/revocation on every route, concurrent
  issuance and retry timing. Race reset against issuance and booking,
  including rejected requests and their audit writes. Exercise missing reset
  credentials and failed or repeated resets. Verify split-mode
  authentication and that the engine still rejects stale terms or taken
  slots. Show actual, sanitized test results.
- Run the gateway kit's `provider:check -- --write` in CI and against a
  local sandbox. A hosted run of the provider checker is optional. In the
  hosted sandbox, run the gateway kit's generic
  `npm run test:e2e -- --gateway <url> --adapter <file>` mode. It uses an
  ordinary sandbox agent key, with no gateway service token. Keep the
  adapter in Cresavo. Approval uses a separate browser context on the phone,
  and the calendar check matches the exact booking ID. Keep privileged
  fixture mutation scenarios local. Report local checks and hosted
  acceptance separately.
- Add the static “Let AI book” page in a later draft PR, with English source
  strings and a Swedish translation. It explains the assistant, demo phone and
  calendar, links to the sandbox and gateway, and makes no API calls. Leave
  the demo project's settings untouched.
  Main already pins the Prisma transitive `effect` dependency to 3.22.5
  in [ce57a71](https://github.com/Cresavo/cresavo/commit/ce57a71), above the
  [patched minimum](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
  Publish the final tested provider revision for the gateway pin.

Deliver four stacked draft PRs: provider isolation, pairing and demo phone,
nightly reset, and deployment configuration. An independent model reviews
the security-sensitive changes in each before merge. Fix or explain the
Windows test failures before any merge. Before hosted work, review the exact
resource, cost and deployment settings with the owner.
Provide a short owner checklist for the free database, secrets, project
budget, domain assignment and PR approval/merge when those steps apply.
