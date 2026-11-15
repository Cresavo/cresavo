# Agentprov 1 · runnable contract proof

Synthetic only. Local coordinator + two separate child processes: standalone
fetch REST and the official MCP SDK's Streamable HTTP client. Neither child
receives database access. This proves transport interoperability, **not** that
Codex, Grok or another personal assistant independently completed the flow.
Kinds/names in `/live` are operator labels, not cryptographic attestation.

## Local prerequisites and commands

Node 22.23+; PostgreSQL with `btree_gist`; no Docker or `.env` required.
Supply `DATABASE_URL` and `SESSION_SECRET` through an operator-controlled
process environment; never paste them in chat, URLs, shell history or reports.
Use a **new, isolated, loopback** database ending `_test` or `_demo`.
The existing DB guard refuses hosted connections, including Neon.

```sh
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
npm run build
```

For local production serving, set `PORT` to 3217, `BOOKING_RUNTIME` to `local`,
`RATE_LIMIT_STORE` to `postgres`, `TRUST_PROXY_IP` to `0`, and then `npm start`.
Use the same test database and session secret in both terminal processes.
The real socket/proxy wrapper remains the only supported web entry point.
Do not substitute `next start` or bypass ingress identity checks.

```sh
# Second terminal, same operator-supplied DB/session configuration:
npm run agent:proof
```

Optional `AGENTPROV_BASE_URL` must be a loopback HTTP URL. Default:
`http://127.0.0.1:3217`. There is no cloud/bypass option. Coordinator requires
the server to use the **same database**; wrong target fails assertions.

## Acceptance steps and expected evidence

1. Operator creates two temporary clients and separate narrowly bounded,
   one-use mandates. Origin is `synthetic-operator` plus the printed run id.
   Keys remain in memory/child environments; stdout contains no credentials.
2. Both transports read services. REST creates a booking (`201`, id, confirmed
   status), repeats it (`200`, same id), then reads status.
3. HTTP-MCP cannot read REST's booking or replay it using REST's mandate.
   MCP then creates/repeats/reads its own booking. REST cannot read MCP's.
4. Separate mandates authorise both clients to contest one slot concurrently.
   Exactly one wins; loser receives `slot_unavailable` (REST `409`, or MCP
   `isError=true`). Coordinator also counts the resulting database row.
5. Trusted operator rotates REST's key. Old key gets `401`; new key retains
   status access and idempotency result. No new client identity is created.
6. No customer profiles are created. `finally` removes **only this run's**
   links, bookings/events, grants, keys and clients. No global/truncate reset.

If the process is forcibly killed, use its printed run id explicitly:

```sh
npm run agent:proof -- --reset-run agentprov-<printed-uuid>
```

Reset is local/test-DB guarded; no nightly reset. Existing unrelated rows stay.
Do not use these synthetic deletion helpers on a real business database.

Integration adds 20 same-key retries, foreign/expired/revoked/fabricated grants,
changed payload, SQL overlap self-join and a forced link constraint violation:
the booking, BookingEvent and link must all roll back, then the same grant can
be retried successfully. Tests assert current credential/client inside writes.

## Mandate semantics and limitations

`issueSyntheticMandate` is a trusted **operator database capability**, not an
agent tool. Treatment/provider/business/client, inclusive start / exclusive end
window, maximum current treatment price in minor SEK, expiry, revocation,
origin and operator reference are stored server-side. The complete treatment
must fit; the internal staff buffer is not sold as treatment time. Successful
link creation consumes the one-use grant in the same transaction as Booking.
Mandates are locked before availability/insertion. `confirmed` remains a
compatibility acknowledgement; changing payload cannot manufacture authority.

Retry checks original payload, stable owner and mandate id. It is a read of an
already committed outcome, so subsequent mandate expiry/revocation does not
destroy its idempotent receipt. Revoked keys/inactive clients are still denied.
Use GET status for the current state; creation retries preserve original time
snapshots after a later admin move. New writes need an unused valid grant.

Historical links keep null mandateId; status remains accessible to their stable
owner, but old creation retries without a recorded mandate are refused. This
intentional sandbox contract change needs client updates before any rollout.
Historical migrations and exclusion constraint are unchanged. Existing orphan
links make the additive migration fail rather than being deleted/reassigned.

Name/email still live on Booking. No register/profile lookup is introduced.
Neither this synthetic mandate nor an API key verifies real customer approval.
Existing cancel functionality is preserved; this proof adds no new cancellation
or rescheduling mandate model. Real-customer identity, deletion/retention,
commercial terms and trustworthy consent capture remain separate pilot gates.

Legacy `agent-demo.mts`/`agent-mcp-smoke.mts` predate grants: use this acceptance
runner instead. They are not evidence of passing the new creation contract.
Cloud steps and explicit approval gates: [preview checklist](AGENTPROV_1_PREVIEW.md).
