# Customer consent channel in split mode (staging)

A booking proposed by an AI agent becomes bookable only after the customer approves
the exact terms on the salon's own HTTPS page. In split mode the agent talks to the
gateway, the salon delivers the approval link through a separate channel, and the
agent never sees the link. This document covers the `staging-inbox` channel: a fixed
fictional customer with a private test inbox. It is a staging tool, not real customer
identification or message delivery.

The Swedish contract for the split salon is in [GATEWAY_SPLIT.md](GATEWAY_SPLIT.md).

## Addresses

| Role | Setting | Planned address (documentation only) |
| --- | --- | --- |
| Agent REST and MCP entry (gateway) | `BOOKING_PUBLIC_ORIGIN` on the salon, `GATEWAY_PUBLIC_ORIGIN` on the gateway | `https://gateway.cresavo.com` |
| Customer approval page (salon) | `BOOKING_CONSENT_ORIGIN` on the salon | `https://salon-demo.cresavo.com` |

Nothing in the code defaults to these addresses. Hosting and DNS are not set up.
When the channel is enabled, the salon serves its own pages (consent page, owner
calendar, the API the gateway calls) on the consent host. Without the channel, host
routing is unchanged.

## Configuration

The salon refuses to start, and the request handlers fail closed, unless every
condition holds:

- `BOOKING_CONSENT_DELIVERY=staging-inbox`. Without it nothing changes. The local
  `separate-lab` and legacy lab channels keep their behaviour and guards.
- Split mode: `BOOKING_SERVICE_ROLE=salon` with a valid `GATEWAY_SERVICE_TOKEN`.
- `BOOKING_CONSENT_ORIGIN` is a bare `https://` origin: no path, query, fragment or
  credentials. Plain HTTP is refused, including on loopback.
- `BOOKING_PUBLIC_ORIGIN` is a bare `https://` origin different from the consent origin.
- Not combined with the public read-only fixture mode (`PUBLIC_READONLY=1`), the SMS
  lab (`BOOKING_SMS_OTP_LAB=1`), the local consent lab (`BOOKING_CONSENT_LAB=1`) or a
  lab inbox directory (`BOOKING_CONSENT_INBOX_DIR`).

`BOOKING_CONSENT_TTL_SECONDS` (1 to 900, default 600) sets how long a proposal can be
approved. The proposal never outlives its start time.

## Flow

1. The agent calls `create_proposal` (MCP) or `POST /api/v1/proposals` (REST) through
   the gateway. The salon validates service, version and staff, snapshots the terms
   and, in the same database transaction, writes one `ConsentInboxMessage`:
   proposal ID, recipient ID, the link, `createdAt`, `consumedAt`.
2. The response contains the proposal (ID, status `pending`, terms, expiry),
   `approvalRequired: true` and `approvalDelivery: "separate-staging-customer"`.
   It contains no link, secret, recipient or inbox detail.
3. The link is `${BOOKING_CONSENT_ORIGIN}/consent/<proposalId>#<secret>`. The secret
   is 32 random bytes in the fragment, which browsers do not send in requests,
   `Referer` headers or server logs. The salon stores only its SHA-256 digest on the
   proposal. The inbox row holds the full link for the test operator.
4. The customer opens the link. Rendering the page reads nothing and changes nothing.
   The page moves the secret into memory, removes it from the address bar and posts a
   `view` request. It shows the salon name and location, service, staff, date and time
   in the salon's time zone, the time zone, duration, price, currency and the time the
   proposal expires. Opening the page approves nothing.
5. Approve or Decline posts the secret and the displayed `proposalHash` to
   `/consent/<id>/decision` on the consent origin. The hash covers business, agent
   client, service, staff, location, schedule, start, duration, price and currency. The
   salon locks the proposal row, re-derives the hash from the stored snapshot and
   compares it. Approval creates a mandate for exactly those terms, marks the proposal
   approved and marks the inbox message consumed, in one transaction. Decline marks the
   proposal declined and the message consumed, with no mandate.
6. The agent reads `get_proposal`. An approved proposal includes `mandateId`.
7. The agent books with the mandate, the fixed fictional contact and an idempotency
   key. The salon re-checks the mandate, the approved proposal link, the current
   service price and duration against the hash, the contact binding, single use and
   slot availability inside the booking transaction. The same key returns the same
   booking ID.

## Threat model notes

| Concern | Control |
| --- | --- |
| Agent reads or forwards the link | REST and MCP responses carry no link or secret. No route, tool or gateway path reads the inbox. Tests assert on serialized response bodies. |
| Agent picks the recipient | The recipient is a server constant (`staging-customer-v1`, `Staging Demo Customer`, `staging-customer@example.test`). The proposal schema is strict; extra recipient fields are rejected. A database check pins the recipient ID. Booking refuses any other contact. |
| Link leaks through logs or referrers | Secret in the fragment, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. Error bodies never echo the secret. |
| Replay of a used link | The proposal must be pending under a row lock. A decided link answers `409` with `state: "used"` and grants nothing. The inbox message can be consumed once. |
| Late approval | An expired proposal answers `410` with `state: "expired"`, no mandate. The mandate itself expires with the proposal. |
| Terms change after approval | The booking re-derives the hash from current price and duration. A changed price is `mandate_denied`; a changed version is `stale_service`. |
| Slot taken after approval | The booking engine's overlap protection answers `slot_unavailable`. |
| Cross-site or agent-driven decision | The decision endpoint requires `Origin` equal to the configured consent origin, JSON, a body under 2 KiB and no `Authorization` or `X-API-Key`. |
| Failed delivery | The inbox write is in the proposal transaction. If it fails, no proposal exists, no mandate can follow and the agent gets `503 consent_delivery_unavailable` (the gateway reports `503 provider_unavailable`). |
| Mixing channels | A staging proposal is not decidable while the salon runs a lab channel, and lab proposals are not decidable while staging runs. The stored channel binds the mandate and contact even after a configuration change. |

Not covered: the customer's identity. Whoever holds the link can decide. The test
operator, and anyone with read access to the salon database, can read the inbox. The
decision endpoint has no separate rate limit; the secret has 256 bits of entropy.

## Staging runner

`scripts/staging-consent/run.mts` runs the whole flow over HTTPS on one machine.

Requirements: Node 22.12 or later (CI uses 24), Git, OpenSSL, a local PostgreSQL 16
with a role that may create databases, Playwright Chromium, and a separate checkout of
the private gateway repository that contains the revision pinned in
`scripts/staging-consent/gateway.json`.

```sh
npm ci
npx prisma generate
GATEWAY_CHECKOUT=/path/outside/this/repo npm run test:staging-consent
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `GATEWAY_CHECKOUT` | required | Gateway checkout outside this repository. Only read with `git archive`. |
| `STAGING_PG_ADMIN_URL` | `postgresql://booking:booking@127.0.0.1:5432/postgres` | Loopback role that creates and drops the run's database. |
| `STAGING_GATEWAY_HOST` | `gateway.cresavo.test` | Gateway host name, resolved to loopback for this run only. |
| `STAGING_SALON_HOST` | `salon-demo.cresavo.test` | Consent and salon host name, resolved to loopback for this run only. |
| `STAGING_GATEWAY_REVISION` | from `gateway.json` | Override the pinned gateway revision. |
| `STAGING_CHROMIUM_PATH` | Playwright default | Chromium executable when the installed browser differs from the pinned Playwright version. |
| `STAGING_DEBUG` | unset | `1` adds a sanitized failure message to each `FAIL` line. |

Pass `--skip-build` after `npm run build` has produced a current production build.

The runner:

1. Creates a private temporary directory, a uniquely named `*_test` database, migrates
   and seeds it.
2. Exports the pinned gateway revision into the temporary directory and installs its
   production dependencies there. The checkout itself is not modified.
3. Issues a throwaway CA and one certificate per host name, valid for one day. Keys
   stay in the temporary directory.
4. Starts the split salon and the gateway on loopback, each behind its own TLS proxy.
   The gateway runs in remote mode (`GATEWAY_ALLOW_REMOTE=1`, HTTPS salon origin, one
   trusted proxy hop) and receives no database URL, session secret or inbox access.
5. Runs an MCP SDK client in its own process. It knows only the gateway origin and
   its agent key.
6. Uses a separate Chromium instance as the customer and another as the owner. The
   test operator reads the link from the database inbox.
7. Checks: proposal creates no booking or mandate; the page shows every term and
   opening it approves nothing; approval; the agent reads status and books; replay
   with the same key returns the same booking ID; the owner logs in over HTTPS and opens
   exactly that booking ID from the authenticated calendar; already-used link; decline;
   expired link; changed price; slot taken; the agent cannot reach the inbox, the
   decision endpoint or the salon directly; no link or secret appears in the agent's
   transcript or in any process output.
8. Drops the database and deletes the temporary directory, also on failure.

Output is limited to static check codes, host names, revisions and counts. Every line
is sanitized: registered secrets are removed exactly, and anything shaped like a link
fragment, key, token, cookie or database URL is removed by pattern. The runner writes
no files outside its temporary directory.

### In CI

The `Staging consent channel` job in `.github/workflows/verify.yml` runs the same
runner when the repository secret `GATEWAY_READ_TOKEN` (read-only access to the
gateway repository contents) is available to the workflow. Without it, or for pull
requests from forks, the job reports a notice and skips. The token is used only by
`actions/checkout`, which does not persist it. The job uploads no artifacts.
