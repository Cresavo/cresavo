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
When the channel is enabled, the salon serves only the paths it needs on the consent
host: the consent page and its decision endpoint (`/consent/*`), the owner's login and
calendar (`/admin`, `/admin/*`, `/api/admin/*`, `/api/availability`), the API the
gateway calls (`/api/v1/*`), the language choice (`/api/locale`) and static assets
(`/_next/*`, `/favicon.ico`, `/brand/*`, `/robots.txt`). Every other path on that host
answers `404`, and the owner pages there hide their link to the customer booking page and
offer the administrator login instead of the demo sign-in, whose endpoint the host does not serve. The
consent and owner pages there link no web app manifest: the studio's `/manifest.webmanifest`
is not served on that host. Without the channel, host routing is unchanged.

## Configuration

The salon refuses to start, and the request handlers fail closed, unless every
condition holds. If `staging-inbox` is asked for but the configuration is invalid at request
time (for example settings loaded after the start check), every consent path answers 404 and
the decision endpoint refuses; nothing falls back to the lab form. The lab form itself is served
only with the local lab switched on (`BOOKING_CONSENT_LAB=1`, not on Vercel), the only setting
in which its decisions can be accepted; otherwise, for example for a link left over after the
staging channel was switched off, every consent path is not found.

- `BOOKING_CONSENT_DELIVERY=staging-inbox`. Without it nothing changes. The local
  `separate-lab` and legacy lab channels keep their behaviour and guards.
- Split mode: `BOOKING_SERVICE_ROLE=salon` with a valid `GATEWAY_SERVICE_TOKEN`.
- `BOOKING_CONSENT_ORIGIN` is a bare `https://` origin: no path, query, fragment,
  credentials or trailing dot on the host name. The string is checked as written, before URL
  parsing could resolve it, so `https://host/x/..`, `/./` or `%2e%2e` are refused rather than
  shortened to the host root; only an optional port and one trailing slash are accepted. Plain HTTP is refused, including on loopback.
- `BOOKING_PUBLIC_ORIGIN` is a bare `https://` origin on a different host name from the
  consent origin. A different port on the same host is refused: cookies are scoped by
  host, not port, so the owner's `booking_admin` session cookie would also reach the
  gateway.
- `SESSION_SECRET` of at least 32 characters: the inbox key is derived from it. Without a
  usable one the salon refuses to start instead of rolling back every proposal.
- No `DEBUG` setting: Prisma's debug output prints each query with its arguments, which
  would include the approval link written to the inbox. Database errors on the inbox write
  are replaced by a static code and never logged.
- Not combined with the public read-only fixture mode (`PUBLIC_READONLY=1`), the SMS
  lab (`BOOKING_SMS_OTP_LAB=1`), the local consent lab (`BOOKING_CONSENT_LAB=1`) or a
  lab inbox directory (`BOOKING_CONSENT_INBOX_DIR`).

`BOOKING_CONSENT_TTL_SECONDS` (1 to 900, default 600) sets how long a proposal can be
approved. The proposal never outlives its start time.

## Flow

1. The agent calls `create_proposal` (MCP) or `POST /api/v1/proposals` (REST) through
   the gateway. The salon validates service, version and staff, snapshots the terms
   and, in the same database transaction, writes one `ConsentInboxMessage`:
   proposal ID, recipient ID, the sealed link, `createdAt`, `consumedAt`.
2. The response contains the proposal (ID, status `pending`, terms, expiry),
   `approvalRequired: true` and `approvalDelivery: "separate-staging-customer"`.
   It contains no link, secret, recipient or inbox detail.
3. The link is `${BOOKING_CONSENT_ORIGIN}/consent/<proposalId>#<secret>`. The secret
   is 32 random bytes in the fragment, which browsers do not send in requests,
   `Referer` headers or server logs. The salon stores only its SHA-256 digest on the
   proposal. The inbox row holds the link only sealed (AES-256-GCM, bound to the proposal ID,
   with a key derived from the salon's `SESSION_SECRET` that the database never sees); the
   test operator opens it with the same secret. PostgreSQL therefore never receives the link:
   not in bind values (logged with `log_statement`, or on error when
   `log_parameter_max_length_on_error` is non-zero, which any session may set), not in rows,
   and not in error details such as "Failing row contains (...)", which the default
   `log_min_error_statement = error` writes to the server log. No particular server logging
   configuration is required for the secret to stay out of the log. Rotating it makes undelivered
   links unreadable for the operator; the proposals then simply expire.
   Displayed times include seconds whenever the instant has any, so a short-lived proposal
   never shows a deadline that appears to have passed.
4. The customer opens the link. The page has a form only on the exact consent origin (host
   and port); on any other alias or port of the deployment `/consent/...` is not found, before
   any alias redirect (a redirect would carry the fragment along), and the browser
   also compares its own origin before it reads the secret, so the secret is never sent
   anywhere else. Rendering the page reads nothing and changes nothing.
   The page moves the secret into memory, removes it from the address bar and posts a
   `view` request. It shows the salon name and location, service, staff, date and time
   in the salon's time zone, the time zone, duration, price, currency and the time the
   proposal expires. A local time that occurs twice (the hour repeated when clocks go back)
   is shown with its UTC offset, for example `02:30 (UTC+01:00)`, so the two instants never
   read the same. Opening the page approves nothing.
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
| Replay of a used link | The proposal must be pending under a row lock. A decided link answers `409` with `state: "used"` and the recorded `decision` (`approved` or `declined`), so a customer whose response was lost can tell which; it carries no terms, mandate ID or authority, and a wrong secret learns nothing. It grants nothing. The inbox message can be consumed once. |
| Late approval | An expired proposal answers `410` with `state: "expired"`, no mandate. The mandate itself expires with the proposal. |
| Terms change after approval | The booking re-derives the hash from current price and duration. A changed price is `mandate_denied`; a changed version is `stale_service`. |
| Slot taken after approval | The booking engine's overlap protection answers `slot_unavailable`. |
| Cross-site or agent-driven decision | The decision endpoint requires `Origin` equal to the configured consent origin, JSON, a body under 2 KiB and no `Authorization` or `X-API-Key`. |
| Guessing or hammering the decision endpoint | At most 60 requests per client address and 20 per proposal in 15 minutes (`429 consent_rate_limited`), in the same store as the other limits (`RATE_LIMIT_STORE=postgres` across processes). The address limit is checked first. A proposal bucket is created only for a staging proposal that exists, so made-up IDs never take space in the store shared with the login and booking limits. |
| Customer told "nothing was approved" after an approval was saved | Only the salon's own JSON refusal (`403 consent_denied`, `409`/`410` `consent_denied` with a state, `429 consent_rate_limited`) says nothing was approved or changed; the same status with any other body (an intermediary's page) does not. A failed view, such as a refresh after a decision, says only that the status could not be checked. After an unknown outcome or a rate limit the secret stays in memory and "Check status again" reads the salon's state with it (after the salon's `Retry-After`), showing the recorded approval or decline without approving anything. A recorded approval is reported as history only: its mandate may since have expired or been used for the booking. Every request from the page has a 20-second deadline that covers the response body; past it, a decision is an unknown outcome, never a refusal. Reads and decisions share one request order: a read started while a decision is in flight waits for it, and only the latest request may change the page. A lost response, a server error (`500 consent_unavailable`) or an intermediary's error after Approve or Decline shows an unknown outcome and asks the customer to open the link again to see its status. |
| Customer told "approved" when the salon did not approve | Success is shown only for a JSON body whose `status` is the chosen decision. Redirects are refused (`redirect: "error"`); any other 2xx is an unknown outcome. Terms are rendered only after every shown and approved field of the view response has been validated, with one currency for the amount and times only with an explicit zone (`Z` or an offset). |
| Owner session reaching the gateway | Consent and gateway must use different host names. The consent host serves only the listed paths. |
| Failed delivery | The inbox write is in the proposal transaction. If it fails, no proposal exists, no mandate can follow and the agent gets `503 consent_delivery_unavailable` (the gateway reports `503 provider_unavailable`). |
| Mixing channels | A staging proposal is not decidable while the salon runs a lab channel, and lab proposals are not decidable while staging runs. The stored channel binds the mandate and contact even after a configuration change. A proposal's delivery profile cannot change once the proposal exists (a database trigger), so a delivered link can never end up on a proposal another decision path treats as unbound. |

Not covered: the customer's identity. Whoever holds the link can decide. The test
operator, and anyone with read access to the salon database, can read the inbox. The
secret has 256 bits of entropy; the rate limits bound load, not guessing.

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
| `STAGING_PG_ADMIN_URL` | `postgresql://booking:booking@127.0.0.1:5432/postgres` | Loopback role that creates and drops the run's database. Credentials only in the user info: a query parameter such as `password`, `passfile`, `sslpassword`, `user` or `service` is refused. |
| `STAGING_GATEWAY_HOST` | `gateway.cresavo.test` | Gateway host name, resolved to loopback for this run only. |
| `STAGING_SALON_HOST` | `salon-demo.cresavo.test` | Consent and salon host name, resolved to loopback for this run only. |
| `STAGING_GATEWAY_REVISION` | from `gateway.json` | Override the pinned gateway revision. |
| `STAGING_CHROMIUM_PATH` | Playwright default | Chromium executable when the installed browser differs from the pinned Playwright version. |
| `STAGING_DEBUG` | unset | `1` adds a sanitized failure message to each `FAIL` line. |

Without `--skip-build`, the runner copies the working tree (tracked and untracked, not
ignored, files) into its temporary directory, links `node_modules` there with hard links
(a copy when the file system does not allow them), and builds and serves the salon from
that copy. The repository's own `.next` is not touched. Pass `--skip-build` to serve the
repository's existing production build instead, after `npm run build`.

The runner:

1. Creates a private temporary directory, a uniquely named `*_test` database, migrates
   and seeds it.
2. Without `--skip-build`, builds the salon in a copy of the working tree inside the
   temporary directory.
3. Exports the pinned gateway revision into the temporary directory and installs its
   production dependencies there. The checkout itself is not modified.
4. Issues a throwaway CA and one certificate per host name, valid for one day, with the
   host name in its subjectAltName (the common name is a fixed short label, so host names
   longer than 64 characters work). Keys stay in the temporary directory.
5. Starts the split salon and the gateway on loopback, each behind its own TLS proxy.
   The gateway runs in remote mode (`GATEWAY_ALLOW_REMOTE=1`, HTTPS salon origin, one
   trusted proxy hop) and receives no database URL, session secret or inbox access.
6. Runs an MCP SDK client in its own process, given only the gateway origin and its agent
   key (checked: no database URL, session secret, service token or salon origin). It runs as
   the operator's OS user on the same machine, so this is configuration and API separation,
   not operating-system isolation: the checks show what the API exposes to an agent, not that
   a process on this machine could not reach the database.
7. Uses a separate Chromium instance as the customer and another as the owner. The
   test operator reads the link from the database inbox.
8. Checks: proposal creates no booking or mandate; the page shows every term and
   opening it approves nothing; approval; the agent reads status and books; replay
   with the same key returns the same booking ID; the owner logs in over HTTPS and opens
   exactly that booking ID from the authenticated calendar; already-used link; decline;
   reopening the link in the same tab (a fragment-only navigation) reads the proposal
   again and strips the secret; a declined or approved link, opened again, names that
   decision; an approval whose response is lost after the salon saved it shows an unknown
   outcome, and "Check status again" then shows the approval; expired link; changed price; slot taken; through the API (the gateway, or the salon with an agent key) an agent has no
   route to the inbox, the decision endpoint (probed with `POST`, as the page sends it) or
   the salon's own API; no link or secret appears in the agent's
   transcript (the complete MCP results, every content block) or in any process output.
   Process output is kept in full, per stream, and scanned again, with the agent
   transcript, after every process (agent included) has closed its streams, so a secret
   printed early, during shutdown, or registered only after it was printed, is still
   found. The owner's session cookie is registered before the owner's browser context
   closes, also when that journey fails. The output budget counts UTF-8 bytes. If output
   exceeds 64 MiB (agent stdout included, counted before it is split into lines), or a stream stays open 15 seconds after its process was stopped, the
   check fails rather than pass on a part. A malformed line from the agent fails the
   pending request with a static code; it never escapes the runner's cleanup. Any uncaught
   error prints a static code and still cleans up. Every child runs in its own process
   group, which shutdown signals as a whole; at the deadline the runner also closes its side
   of the pipes so nothing left behind keeps it running. An install or build step that
   reaches its deadline fails at once, a TLS listener or port probe that cannot bind fails, and an operator request whose response is cut off,
   takes longer than 20 seconds in total or exceeds 4 MiB fails with a static code, so neither can hold up cleanup.

   The runner refuses to start with diagnostic settings that would print URLs, including
   approval links, from this process outside its sanitizer: `DEBUG`, `DEBUG_FILE`,
   `PWDEBUG`, `NODE_DEBUG`, or `NODE_OPTIONS` with `--inspect` or tracing flags. Use
   `STAGING_DEBUG=1` for sanitized failure reasons. These checks are the runner's first import,
   so they run before Playwright (which opens `DEBUG_FILE` as it loads) or Prisma is evaluated;
   Playwright is loaded only after them. Option names are compared as Node reads
   them (`--tls_keylog` is `--tls-keylog`), and a `NODE_OPTIONS` with any quote or backslash
   is refused outright. Beyond that, `NODE_OPTIONS` and the runner's own Node flags may hold
   only allowlisted options: the CA choices `--use-openssl-ca`,
   `--use-bundled-ca`, `--use-system-ca`, `--max-old-space-size`, `--enable-source-maps`,
   `--no-warnings`, `--no-deprecation` and the type-stripping switch. Anything else (reports,
   heap snapshots, diagnostic directories, `--require`, a future option) is refused with
   `STAGING_NODE_OPTION_REFUSED`. The only preload accepted is the tsx loader, given on the
   runner's command line exactly as `npm run test:staging-consent` passes it (`--import tsx`):
   any other `--import`, `--loader` or `--require`, and any `--import` in `NODE_OPTIONS`, runs
   code before the preflight and is refused the same way. Every child (salon, gateway, agent, build steps, browsers) gets a
   closed environment built by the runner, never its own, and the runner refuses to start a
   child whose environment names `NODE_OPTIONS`, `DEBUG`, `NODE_DEBUG` or `SSLKEYLOGFILE`. It also refuses settings that would make
   Playwright drive a browser elsewhere and send approval links off the machine: any
   `SELENIUM_REMOTE_*` or `PW_TEST_CONNECT_*` variable, `PW_CHROMIUM_ATTACH_TO_OTHER` and
   `PW_TEST_REUSE_CONTEXT`. The check runs in preflight and again before every browser launch.
   TLS key logging is refused too: `SSLKEYLOGFILE`, and `--tls-keylog` in `NODE_OPTIONS` or the
   runner's own Node flags.

   The customer and owner browsers can reach only the salon's host and TLS port. Chromium maps
   exactly that host and port to loopback and everything else (other hosts, IP literals, other
   ports of the salon host, redirect targets) to "not found" (`--host-rules`), and each browser context also aborts any request outside the salon origin.
   A check navigates to a loopback listener by IP, to `localhost`, to the gateway and through a
   redirect from the salon origin (to another host and to the salon host on another port), and
   confirms none of them was reached.

   Env files (`.env`, `.env.local`, `.env.production`, `.env.development` and their
   `.local` forms) are refused in the repository and the gateway checkout at the start, and
   checked again, there and in the build copy and gateway export, right before every step,
   server and the agent start: Prisma and Next.js would load one created during the run.
   Right after creating its database the runner checks, with the same role, that creating
   that name again is recognised as "already exists" (the ordinary integration suite does not
   need `CREATEDB`). A signal during setup waits for a database creation in flight before
   deciding what to drop, and drops it only if this run may have created it (a name that already existed
   is never dropped). Once shutdown has begun no new child process starts. The runner, not
   Playwright, handles SIGINT, SIGTERM and SIGHUP (a closed terminal), and runs the same
   full cleanup for each. A browser launch still pending when a signal arrives is waited for
   and its browser closed; none starts after cleanup has begun. Every browser is closed even if another fails to; a
   browser that will not close is reported as `FAIL BROWSERS_CLOSED` and fails the run. Every
   preflight check reports a static code only, never the value it rejected. The exit status is 1 from the start and becomes 0 only after cleanup
   completed and every check passed; a cleanup that throws is reported as `FAIL CLEANUP`. An uncaught error or rejection is reported
   as `FAIL UNCAUGHT_ERROR` and ends the run through the same cleanup and a non-zero exit, even
   when the main flow is waiting on something that will now never settle.
   The four loopback ports (two servers, two TLS proxies) are chosen together, so they are
   always distinct. When a server or step exits, whatever is left of its process group is
   stopped as well. A database password shorter than 8 characters is checked only where a
   credential stands (in a URL, or as `password=...`), and the run prints a `NOTE` saying so.
9. Drops the database and deletes the temporary directory, also on failure.

Output is limited to static check codes, host names, revisions and counts. Every line
is sanitized: registered secrets are removed exactly, and anything shaped like a link
fragment, key, token, cookie or database URL is removed by pattern. The runner writes
no files outside its temporary directory.

### In CI

The `Staging consent channel` job in `.github/workflows/verify.yml` runs the same
runner only on `main`: pushes to `main` and manual runs (`workflow_dispatch`) started on
`main`. It never runs on pull request events, other branches or tags, so the private
gateway code and its read token are only ever used with merged code. A test pins this
condition (`tests/workflow-staging.test.ts`). It needs the repository secret
`GATEWAY_READ_TOKEN` (read-only access to the gateway repository contents); without it
the job reports a notice and skips. The token is used only by `actions/checkout`, which
does not persist it. The job uploads no artifacts.

## Open questions

Decided in this change:

- **Paths on the consent host.** Implemented: only the paths listed under Addresses.
  The owner's calendar stays on the consent host because the staging check opens the
  booking there; a separate owner host is a production decision.
- **Rate limit on the decision endpoint.** Implemented per client address and per
  proposal with the existing limiter. An agent knows its own proposal ID and could use
  up that proposal's 20 requests; this only blocks approval of its own proposal, which
  it could equally abandon.
- **CI trigger.** Implemented: only on `main`, for a push or a `workflow_dispatch` started on
  `main`; manual runs on other branches or tags are skipped.

Left open, with reasoning:

- **Real customer identity and delivery.** The channel proves separation of the agent
  from the approval, not who the customer is. A production channel needs a verified
  contact (email or SMS) and a delivery provider; that is a product and legal decision
  and needs a new cloud resource.
- **Inbox confidentiality.** The link is stored sealed in `ConsentInboxMessage`, so the
  database and its logs hold nothing usable; anyone with the salon's `SESSION_SECRET` and
  read access to the table can still open it. A production channel should store only what
  delivery needs and drop the sealed link once sent. Not changed here because the staging
  check reads the link from the inbox.
- **Owner admin on the customer host.** The owner login and calendar share the consent
  host. Its session cookie is host-only and never reaches the gateway (distinct host
  names are required), but a production deployment may want the owner on a separate
  host so a customer page and the owner session never share an origin.
- **Rate limit store.** With `RATE_LIMIT_STORE=memory` the limits are per process. The
  staging runner uses `postgres`. Requiring `postgres` whenever the channel is enabled
  would be a small change but also breaks single-process local runs; left to the
  production configuration review.
- **Hard-linked `node_modules` in the build copy.** The build does not modify installed
  packages, so hard links are safe for this runner; a step that rewrote files in
  `node_modules` in place would also change the repository's copy.
