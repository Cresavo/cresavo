# The salon's contract with the standalone gateway

The salon (this repository) owns the database, times, staff, permissions,
mandates, bookings and the calendar. The gateway,
[`Cresavo/gateway`](https://github.com/Cresavo/gateway), owns the standalone public
REST/MCP entry for customers' agents and its tools. Both install their own
dependencies, and no code is imported between the checkouts.

## Names and repositories

| What | Name |
| --- | --- |
| Salon repository | [`Cresavo/cresavo`](https://github.com/Cresavo/cresavo), npm package `booking-lab-se` |
| Gateway repository | [`Cresavo/gateway`](https://github.com/Cresavo/gateway), public. The old address `niclasvestlund-YT/booking-lab-gateway` redirects to it. Its npm package is `cresavo-gateway` (`booking-lab-gateway` up to the pair-proof revision below) |
| Gateway revisions this repository tests | [`scripts/integration/pair.json`](../scripts/integration/pair.json), see [Pinned gateway revisions](#pinned-gateway-revisions) |
| Planned public addresses | `gateway.cresavo.com` (gateway), `sandbox.cresavo.com` (sandbox salon), see [DEPLOY_SANDBOX](DEPLOY_SANDBOX.md) |

## Agent entry points

| Entry point | Where | Who uses it | Status |
| --- | --- | --- | --- |
| Embedded HTTP MCP `/api/v1/mcp` | This repository | Customers' agents booking at Cresavo salons | The intended public entry ([ADR 7](design/ARCHITECTURE_DECISIONS.md)). Needs the gateway's transport controls and OAuth before public use. Returns 404 in split mode |
| Provider API `/api/v1` | This repository, `src/app/api/v1` | Direct clients; the gateway in split mode | Local and sandbox |
| Gateway REST v1 and MCP (`/api/v1/*`, `/api/v1/mcp`) | `Cresavo/gateway` | Other booking systems that implement the provider contract | Optional and not hosted for Cresavo |
| Owner MCP `/mcp/owner` | This repository, OAuth pairing | The owner's own assistant | Flag-controlled pairing preview, see [CONNECT_AI_ASSISTANT](CONNECT_AI_ASSISTANT.md) |
| Concept demo MCP `/api/concept/mcp` | This repository, shared demo bearer token | An assistant trying the in-memory Salong Eko copy on a local concept server | Local only; returns 403 on the public read-only demo |
| Local MCP server (stdio) | This repository, `npm run mcp` | A local assistant on the owner's machine | Local, against a disposable database |

## Split mode

Start the salon's normal server wrapper with `BOOKING_SERVICE_ROLE=salon`. The
embedded HTTP MCP route and its schema page then return 404. The older combined
mode remains for existing installations. Develop new gateway tools in the
gateway repository. In split mode, set `BOOKING_PUBLIC_ORIGIN` to the gateway's
address for discovery.

Provider API: services, availability, booking with an idempotency key, status,
cancellation and the existing lab proposals under `/api/v1`. `GET /api/v1/access`
authenticates the current agent and returns only the protocol version, provider
mode and scopes. The salon checks access to each operation or booking object
again. It keeps atomic mandate use and conflict protection even when the
connection to the gateway breaks.

## Customer consent: the one-time e-mail code

Customer consent has one profile (ADR 7, issue #187). A proposal gives the agent
`approvalRequired: true`, `approvalDelivery: "customer-email-code"` and a
`consentUrl` that carries no secret, so the link may be shown to the person,
also through an assistant. On that page the customer types their own address,
receives a six-digit code there and approves or declines with it: the link alone
decides nothing. A code lives 600 seconds, five wrong tries lock it, a new code
can be sent once a minute and at most five times per proposal. Only the
address's digest and a mask are stored. At booking, the customer's address must
be the one that returned the code, or the result is `mandate_denied`.
`get_proposal` repeats `consentUrl` while the proposal is pending, and asks an
MCP client on the 2026-07-28 protocol that declares URL elicitation on the
request to open the page for the person. Clients on the 2025 protocol always get
the ordinary answer: a stateless server cannot see what they declared at
`initialize`.

Consent runs only as a local lab (`BOOKING_CONSENT_LAB=1`): loopback origin, a
guarded `_test` database and no cloud marker. It accepts only `@example.test`
addresses and delivers to a process-local inbox. For a proof that runs the salon
in another process, the operator sets `BOOKING_CONSENT_INBOX_DIR` to a private
directory it created in the system temp folder (prefix `booking-consent-inbox-`,
mode 0700); the newest code for each proposal is written there as
`<proposalId>.json` (mode 0600). Treat the code as a one-time credential: no raw
receipts in Git, logs, model prompts or screenshots. The client must not have
the server's file access, not even through the same uid, and there is no HTTP or
MCP reader for the inbox. Real delivery through the e-mail outbox and real
customer identification remain open decisions.

The bearer approval link (`approvalUrl`), the separate synthetic channel and the
SMS code lab were removed in migration `20261125090000_email_code_only`. Older
rows keep their delivery and mandate values; no new row can use them.

## Run the acceptance proof locally

Prepare a new PostgreSQL database on loopback whose name ends in `_test`. Supply
`DATABASE_URL` and a separate temporary `SESSION_SECRET` (at least 32 characters)
to the salon and the proof's process in the usual secure way. An isolated
terminal for the gateway needs `SALON_ORIGIN`, `PORT` and a separate service
identity. Use Node 24.

Generate 32 cryptographically random bytes as 64 lowercase hex characters. Give
the same value as `GATEWAY_SERVICE_TOKEN` only to the two server processes. To
rotate, change the value and restart both. Agent clients and the proof
coordinator need only their ordinary permissions. Use loopback locally and TLS
for any future remote connection. In split mode, operational REST calls without
the service identity return 401, even with a valid agent key. The server refuses
to start if the role is misspelled, if only one of the two settings is present,
or if split mode is combined with the public read-only fixture view. Without
both settings the older combined mode applies. The protection covers the booking
operations and the access check. Discovery, OpenAPI and the synthetic demo flow
have their own access rules.

1. In the salon repository: `npm ci`, `npx playwright install chromium`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run build`.
2. In the salon terminal: set `PORT=3217`, `BOOKING_SERVICE_ROLE=salon` and
   `BOOKING_PUBLIC_ORIGIN=http://127.0.0.1:3218`. Start with `npm start`.
3. In the gateway repository: `npm ci`. Set `SALON_ORIGIN=http://127.0.0.1:3217` and `PORT=3218`, then run `npm start`.
4. In the salon's proof terminal: set `AGENTPROV_BASE_URL=http://127.0.0.1:3218`
   and `AGENTPROV_SALON_URL=http://127.0.0.1:3217`, then run `npm run agent:proof` against the same test database as the salon.
5. Expect ten PASS lines, including `SEPARATE_SALON_AUTHENTICATED_CALENDAR` and
   `TWO_TRANSPORTS_ONE_WINNER_ONE_CONTROLLED_CONFLICT`. The proof creates its own
   synthetic actors and checks a link to exactly the right booking id in the
   salon's signed-in calendar. A separate Chromium session then signs in through
   the form and clicks through to the same booking detail before cleanup.

The proof runs through two processes and real HTTP calls. The proof
coordinator's database access is used for the operator's synthetic mandates,
keys and cleanup. The gateway's booking path has no such access. A developer
running this locally verifies neither a cloud deployment, ChatGPT in an end
user's account, an external booking provider nor pilot operation.

## Configuration drift check

The access response contains `providerMode`. The salon returns `split` only
after the agentRoute check of both the service key and the agent key. The older
combined mode returns `standalone`. Before every operation, including REST
status and writes, the gateway requires `apiVersion: "v1"`,
`providerMode: "split"` and a scopes array in a successful access response. The
confirmation is not cached between calls. A missing or incorrect confirmation
gives 503 `provider_configuration_invalid` before the requested operation.
401/403 from authentication keep their status codes. Upgrade both servers
together.

The salon also refuses gateway-marked operations in combined mode, with a static
503 `provider_configuration_invalid`. That closes the window in which the server
restarts in the wrong mode between a successful access check and the operation.
MCP sub-steps within one incoming call reuse the same access answer, never
across calls. An ordinary operation therefore costs two entries in the salon's
existing call budget. The gateway replaces all provider 5xx responses with a
static 503 `provider_unavailable`. A disabled consent lab gives a controlled 403
even without a configured public origin.

A salon deliberately started in the older combined mode keeps its earlier
direct API access. Discovery remains reachable. The run is still a local
synthetic proof of concept.

Regression against a real misconfiguration: start an extra salon without both
split settings and an extra gateway that points to it. With a new separate local
test database and temporary process secrets, set `AGENTPROV_SALON_URL` to the
extra salon and `AGENTPROV_BASE_URL` to its gateway. Run
`node --import tsx scripts/agentprov/check-provider-mode.mts`. It verifies a
valid agent key, the standalone answer, nine refused gateway operations and an
unchanged booking count. The proof cleans up its own client and key. The
append-only audit history follows the existing storage rules.

## Pinned gateway revisions

[`scripts/integration/pair.json`](../scripts/integration/pair.json) is the only
place that pins gateway revisions. It holds two, on purpose:

| Field | Revision | Used by |
| --- | --- | --- |
| `gatewayRevision` | `1617de1` (2026-11-16) | `npm run test:pair`, the cross-repository pair proof |
| `sandboxGatewayRevision` | `4176c3d` (2026-11-20, gateway `main` with the provider kit and shared limits) | The sandbox jobs in `.github/workflows/verify.yml` |

The pair proof cannot move past `1617de1` yet. Gateway commit `c546bba`
(2026-11-19) added a per-client-IP limit of 5 booking creations per hour. The
pair proof makes more creations than that from loopback, including 20
concurrent attempts, so against gateway `main` it fails at
`HTTP_MCP_CREATE_RETRY_STATUS` with a 429.

The proof now starts the gateway with `GATEWAY_LOOPBACK_TEST_LIMITS=1`, which
older gateways ignore. A pending gateway change adds that setting: it raises the
limits only for a loopback-only gateway and refuses to start in remote mode, on
Vercel or with a shared limit store. Once it is merged, set `gatewayRevision` to
the merged commit and run the pair proof. Newer gateways also refuse every
direct cancel with 403; the proof accepts that or the older 404, and checks that
the booking stays confirmed.

Verified on 2026-11-20 against salon `8d166f6`: the pair proof passes on
`1617de1` and on the pending gateway change. The sandbox provider, phone, reset
and browser checks pass on `4176c3d`.

## Reproducible proof of a pinned revision pair

`gatewayRevision` in `pair.json` locks the gateway. The salon's revision and any
dirty working copy are reported at run time. CI requires clean working copies.
Check out the two repositories separately. No `.env` files may exist in the
proof checkouts. The proof does not read such files and loads no operator
secrets from them.

1. Install Node 24 and a local PostgreSQL. Create a new isolated database on
   loopback whose name ends in `_test`. Supply `DATABASE_URL` in the proof
   process's environment. Do not run against an existing demo or customer database.
2. Run `npm ci` in both repositories and `npx playwright install chromium` in the salon.
3. In the salon: `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`
   and `npm run build`. Supply a temporary `SESSION_SECRET` for these steps.
4. Set `GATEWAY_PATH` to the separate gateway checkout at the pinned revision
   (the default is `../gateway`). Run `npm run test:pair`. Do not start any
   servers manually for this proof.

The runner starts the salon's ordinary wrapper and the gateway with random
process secrets. The gateway's environment contains neither a database address
nor a session secret. Separate REST and real HTTP MCP SDK clients create
bookings. A signed-in Chromium session opens the same booking id in the salon's
calendar. A local test proxy outside the products drops an already saved
response, injects provider errors and restarts the salon between the access
check and the write. It also tries 20 concurrent attempts, a foreign client, a
revoked key, an outage and recovery. An SQL check requires zero overlaps. The
proof's own fixtures and processes are cleaned up even on failure. The
append-only history follows the existing storage rules. Delete the whole
isolated test database after the proof.

`test-results/integration-pair.json` contains only the revision pair, the dirty
flag, the time and static test codes. No keys, customer details or raw call logs.
The proof's clients are test scripts and the MCP SDK, not certified personal
assistants.

### Pair proof in CI (removed)

The manual CI pair run, which sent a Git bundle of the then-private gateway's
source to this repository's workflow as a dispatch input, was removed on
2026-11-18 before the repository went public: workflow inputs of a public
repository are not private. Run the pair proof locally with `npm run test:pair`.
The gateway is public now, so a CI pair job could fetch it directly, but it
would hit the gateway's create limits until the pin can move.

## Verified revision pair and compatibility · 2026-11-16

Salon product: `0a88ac27482aef377ecce86892b5bfbb897cc181`.
Gateway: `f9b8506cee3e3cd21bd279e01addf761cd3db1ed`, product `ab07b6c`.
Both were on the then-private branch `night/gateway-salon-integration`. Later
Markdown does not change the product revisions. The detailed verification
record and Grok's original report were not published with the repositories.

| Combination | Assessment |
| --- | --- |
| The pinned new revision pair | Verified locally with a clean install, separate processes and a new PostgreSQL; Grok reproduced the proof |
| New gateway + older salon | Not approved as a hardened combination; the salon lacks the operation's protection against a switch to standalone in the middle of a call |
| Older gateway + new salon | No new compatibility certification; the older gateway lacks the new 5xx sanitising and the request-local access sharing |
| New salon in standalone mode, direct client without the gateway header | The older contract is kept; no permission for public access or a pilot follows from it |

REST v1, the old MCP tool names and the mandate and idempotency contracts remain.
No migration files change. Upgrade and verify both processes as a pair.
Discovery and aliases are not certification against an external provider or assistant.

Grok reviewed the code and ran the pair proof. Its own audit probes confirmed
the counts and refusals. It made no further standalone comparison of the
calendar id or SQL overlap after the runner had cleaned up. Those two checks are
part of the automation that ran and must not be described as separate manual QA.

The older GS1-QA-2 finding about rate-limited logging when a service identity is
refused was not among that night's four findings and remains open.

## Optional proof with a real Codex client and synthetic customer approval

After the same local preparation, the operator can explicitly run:

```powershell
npm run test:pair -- --native-codex
```

It needs an already installed Codex CLI with an existing ChatGPT sign-in. It
uses the account's ordinary model quota. No API key, new service or automatic CI
model run is introduced. The flag is refused in CI before any services start.
Ordinary `test:pair` keeps its earlier behaviour.

The runner creates its own private temporary directory with the prefix
`booking-consent-inbox-`, gives its address only to the salon
(`BOOKING_CONSENT_INBOX_DIR`) and the test operator, and cleans it up in
`finally`. Neither the agent process nor the gateway receives the directory.

The proof starts a local consent lab in the salon, protected by the test
database guard. It then:

1. Codex reads services and availability through the gateway's real HTTP MCP.
   It chooses a massage with Anna on the next weekday, 30 minutes, at most
   450 SEK, and creates a proposal. The answer contains `approvalRequired=true`,
   `approvalDelivery=customer-email-code` and a `consentUrl` with no fragment or
   query. No booking or mandate may exist at that point.
2. A separate negative HTTP check requires `400 mandate_required` without a mandate.
3. An automated synthetic customer opens the consent link in Chromium and types
   their address. A decision without the code must give `403`. The customer
   sends the code, the operator reads it from the private inbox, outside HTTP
   and MCP, and the customer approves exactly the service, staff, location, time
   and price. HTTP attempts outside the approved time or with another customer
   address must give `403 mandate_denied`.
4. Codex gets the same business context and proposal id in a new client run,
   reads the approval and books. It repeats the same payload and key and reads
   the status. Requirements: two successful create calls, the same id, one
   booking row and the right mandate link. The customer is the synthetic
   `Syntetisk Kodkund`, `codex-customer@example.test`, the address that returned
   the code. Neither the code nor the inbox reaches the agent.
5. An ordinary individual admin sign-in and a calendar click open the same
   booking id. The proof's own keys are revoked before only its own fixtures
   are cleaned up.

This proves a real model-driven Codex CLI, not ChatGPT's mobile or web
interface. The customer approval is automated with an invented identity. It
does not prove real customer authentication, pilot readiness or that a human
clicked. POSIX requires a private directory (0700), and the code receipt is
written with 0600. Windows ACLs are not independently qualified; the test claims
no isolation from anyone who already has the server's file system or database
access. See the current identity assessment in [PRIVACY_SECURITY](PRIVACY_SECURITY.md).

The client gets a temporary business key in its process environment and only
six named MCP tools. The database address, session secret and service key are
not passed to the client. Shell tools, web search and external apps are
disabled. Tool approval covers only the explicit test list of that single run.
The server's authentication, scopes, customer mandates, idempotency and privacy
rules remain. No global Codex configuration or existing demo profile changes.

`test-results/native-codex/` contains a sanitised `evidence.json` and real
images of the approval and the booking detail. Keys, lab links and raw CLI
output are not saved. Bounded model notes are sanitised before saving. The CLI
runs with `--ephemeral`; that is no guarantee of OS isolation or of the model
provider's data retention. Use only synthetic catalogue and booking data.

Two separate client runs keep the approval outside the agent. The business id
must be kept between them: it is not currently part of the `get_proposal`
response. The agent should stop and ask if it is missing, not guess. REST and
MCP use the same domain logic. See `agent-api-v1.openapi.yaml`. Real recipients,
identification and delivery need a later decision, not new customer registers or
real messages in this proof.

See the official documentation for [Codex HTTP MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).
