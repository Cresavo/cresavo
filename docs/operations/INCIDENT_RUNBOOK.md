# Incident runbook

For the pilot. Short on purpose: in an incident you read the severity table,
the first steps and the one section you need. Names, phone numbers and
provider logins are not in this file; they live in the on-call sheet kept
outside Git (`<on-call sheet location, TBD by the maintainer>`). Never paste a
secret, a customer's details or a database URL into an issue, a chat or this
file. The pilot gate item is in
[QUALITY_SECURITY](../QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer).

## Severity levels

| Level | What it looks like | Response | Examples |
| --- | --- | --- | --- |
| **SEV1** | Personal data exposed or possibly exposed; double bookings or lost bookings at scale; the service is down for all salons; a secret leaked. | Start now, day or night. Contain first, then investigate. Maintainer decides on the breach notice. | Leaked `SESSION_SECRET`; a salon can read another salon's data; the database is gone; e-mails sent to the wrong people. |
| **SEV2** | One salon or one feature is broken, with no data exposure and a workaround. | Same day. | Calendar fails for one salon; e-mails not leaving; owner sign-in broken. |
| **SEV3** | Cosmetic, or an issue that affects nobody right now. | Normal backlog (GitHub issue labelled `finding`). | Wrong wording in a confirmation e-mail. |

When unsure, take the higher level and lower it later.

## First steps (every incident)

1. **Note the time** (UTC) and open an incident record: a private issue or the
   incident log, with the severity, who is on it and a running timeline. Facts
   only, no personal data.
2. **Contain before you diagnose.** If bookings or personal data could still be
   affected, switch off the risky feature first
   ([below](#switching-features-off)); it is reversible, a leak is not.
3. **Preserve evidence.** Do not delete rows, restart the database or rotate
   everything at once before copying what you need (logs, the affected rows'
   ids, the deployment id). Rotation destroys information as well as access.
4. **Find the scope.** Which salons, which tenants (`tenant_id`), which time
   window, which data. The audit log (`tenant_action`: actor, source, `at`,
   `resulting_version`) and the outbox state answer most of this. The support
   role (`cresavo_support`, see [`prisma/grants/roles.sql`](../../prisma/grants/roles.sql))
   can read them without seeing documents or payloads.
5. **Fix, verify, restore the flags one at a time**, then write a short review
   (what happened, how it was found, what changes so it cannot repeat) and file
   the follow-ups.
6. **Personal data involved?** Go to [data breach](#personal-data-breach) at
   once; the 72 hours start when we become aware, not when the fix is done.

## Switching features off

All four are environment variables read at runtime. On a Vercel-style host a
changed variable applies to new deployments, so redeploy after changing it.
Each is reversible; turning it back on does not lose anything unless noted.

| Flag | Off value | What stops | What keeps working | Watch out |
| --- | --- | --- | --- | --- |
| `PUBLIC_BOOKING_LIVE` | `0` or unset | The public booking pages and `/api/public/*` serve the browser-state demo instead of a salon's data (`src/lib/public-booking.ts`). New customer bookings stop. | Owner studio, existing bookings, owner sign-in. | Confirmation e-mails for bookings made through the public page are held, not dropped: the message sink returns `deferred` and they send when the flag is back (no attempt is used up). A customer who books during the outage sees the demo, not an error; say so on the status page. |
| `OWNER_ACCOUNTS_ENABLED` | `0` or unset | Every `/api/owner/*` route answers 404 (`src/lib/owner-http.ts`), so owners cannot sign in or change anything; public booking also stops, because it needs both flags. | The marketing site and the demo. | The strongest switch: use it for a suspected cross-tenant read or a broken session check. Stored sessions are not deleted; they work again when the flag returns. Password-reset links stop working too. |
| `CONCEPT_CONNECTIONS_LIVE` | empty or `0` | Every connection (e-mail, SMS, payments, ...) is simulated: nothing real leaves, including owner password-reset e-mails (`src/concept/connections/server/config.ts`). | Everything else. | Booking e-mails that were staged for a real send are not sent as simulated: the sink raises `EMAIL_NOT_CONFIGURED` and the outbox retries with exponential backoff (2 s doubling, capped at 1 hour) and gives up after 10 attempts. That is roughly 17 minutes of retries; after that the rows are `failed`, not pending. Keep the switch-off short, or accept that those e-mails need the [manual follow-up](#uncertain-e-mail-outbox-state). |
| `CONCEPT_EMAIL_PROVIDER` | empty or `simulated` | Only the e-mail port: it resolves to the simulator, SMS and the other ports are unaffected. | Everything else. | Same retry limits as the line above. Use it when the e-mail provider is the problem; use `CONCEPT_CONNECTIONS_LIVE` when anything real must stop. |

Other switches:

- `PUBLIC_READONLY=1` is the public demo's mode, not an incident switch: it
  disables database access in that process (`createDatabaseClient` refuses),
  so owner routes fail instead of going read-only. Do not use it on the pilot
  deployment.
- A stuck deliverer: stop the `npm run effects:drain` cron job. Pending rows
  wait; nothing is lost.
- The cron job of `npm run store:sweep` can be paused at any time; it only
  deletes expired rows.
- A single owner account can be locked by raising its `credential_version`
  (all of its sessions end) or setting `active = false`, as the schema owner.

## Key rotation

Rotation is for a leak or a departure, or on schedule. Generate the new value
with a password manager or `openssl rand -hex 32` (at least 32 characters is
enforced), store it in the secret store, deploy, and delete the old value.
Never write a secret into Git, a ticket or a log.

### `SESSION_SECRET`

Used as an HMAC key by several features. Rotating it invalidates:

- **Owner sessions** (`src/lib/owner-session.ts`): the cookie signature no longer
  verifies, so every owner is signed out. This is also the "sign out
  everyone" action after a leak.
- **Admin sessions** (`src/lib/auth.ts`) and the legacy engine's keyed values
  (client keys and e-mail cap keys stored on bookings, `src/lib/domain.ts`):
  admins sign in again; budgets keyed by the old values start over.
- **Password-reset links** (30 minutes): outstanding links stop working; owners
  request a new one.
- **Booking links in e-mails already sent** (`src/lib/booking-token.ts`): the
  customer's "manage my booking" link in a sent confirmation stops working.
  Customers must be told to contact the salon, or the salon cancels and rebooks
  for them. Plan for this before rotating in business hours.
- **Public form tokens** (`src/lib/public-issued-at.ts`): forms open in a browser
  at that moment fail once and reload.
- **Rate-limit and owner-guard keys** (`src/lib/postgres-rate-limit.ts`,
  `src/lib/owner-guard-store.ts`): the keys are HMACs of the identity, so all
  counters and **owner lock-outs start over**. After a suspected credential-stuffing
  attack, rotating also frees an attacker's locked-out guesses; rotate
  and then watch the sign-in rate.
- Pairing keys (`src/concept/pairing/http.ts`) and the local MCP recovery
  values (`src/mcp/time-card/recovery.ts`).

It does **not** touch data at rest: nothing in the database is encrypted with
it, so there is nothing to migrate. All web instances must get the new value in
one deployment, or some will reject cookies the others set.

### `STUDIO_STORE_HMAC_SECRET`

Used only for the idempotency fingerprints of `tenant_idempotency`
(`src/concept/store/postgres-studio-store.ts`). Rotating it invalidates
nothing else: no session, no link, no stored document. The one effect: an
idempotency key younger than 24 hours (`IDEMPOTENCY_TTL_MS`) that is retried
after the rotation no longer matches its stored fingerprint and is answered
`idempotency-mismatch` instead of being replayed. The booking is not duplicated;
the client sees an error for that retry and must check the state. Rotate in a
quiet period, or accept that. There is no two-key overlap; the old value is
only needed again if the rotation is rolled back.

### Other secrets

Provider keys (`RESEND_API_KEY`, `POSTMARK_SERVER_TOKEN`, payment and
accounting keys): create the new key at the provider, deploy it, revoke the
old one, then check the provider's log for use of the old key during the
incident window. Database login passwords: `ALTER ROLE <login> PASSWORD ...`
interactively with `psql` (it prompts; never put the password on the command
line), update the secret store, redeploy; the group roles have no passwords.

## Uncertain e-mail outbox state

Booking e-mails are rows of `tenant_effect` (`kind = 'message'`) delivered by
`src/lib/message-sink.ts`. For a real send, the sink first commits a
`dispatched` marker on the row, then calls the provider with the row's id as the
idempotency key. If the provider call times out, the network drops, or the
provider is unavailable, the message may or may not have left. What happens next:

- **Retried safely.** If the provider is Resend, the account is unchanged and
  the first attempt was less than 23 hours ago, the same request is repeated
  under the same key: the provider answers with the first result instead of
  sending twice.
- **Marked uncertain.** In every other case (another provider, a different
  account, a row older than that window, or a row written before the message was
  frozen), the row becomes `failed` with `delivery.reason = 'uncertain'`.
  It is never retried, because a second send could reach the customer twice.
- Other final failures carry their own reason: a bad address, an unverified
  sender domain, or `reconcile` when the provider says the key was reused with a
  different body.

Failed rows are terminal; the deliverer never claims them again, and there is no
tool yet to reopen one. A person reconciles them.

**Find them** (as the schema owner or another role that may read `payload`; the
support role cannot, by design):

```sql
SELECT tenant_id, seq, n, id, attempts,
       payload->'delivery'->>'reason'   AS reason,
       payload->'delivery'->>'provider' AS provider,
       payload->'delivery'->>'firstAttemptAt' AS first_attempt_ms
FROM tenant_effect
WHERE kind = 'message' AND status = 'failed'
ORDER BY tenant_id, seq, n;
```

The support role can still count them and see time and attempts:
`SELECT tenant_id, status, count(*) FROM tenant_effect GROUP BY 1, 2`.

**Reconcile each `uncertain` row:**

1. Open the e-mail provider's sent log for the window around the first attempt
   and look for a message to the customer's address (the address is in the
   salon's booking, not in the outbox row). The row's `id` is the idempotency key
   sent with the request.
2. **Sent:** nothing to do except noting it in the incident record.
3. **Not sent:** do not reuse the old row. Tell the salon, who sends the
   confirmation or cancellation by hand or contacts the customer. For a
   cancellation it is the more important message.
4. Count the rows and find the cause: provider outage, a deploy mid-send, or
   a limit such as the 23-hour window. If the cause is repeating, raise it as a
   SEV2.

**Pending rows that should not send** (after a restore or when live e-mail has
to be switched on again): list `status = 'pending'` rows and decide per row.
An erased customer's pending messages are already `cancelled` by
`erase_subject`. Anything else can be cancelled by the schema owner with
`UPDATE tenant_effect SET status = 'cancelled' WHERE id = '<id>' AND status = 'pending'`;
check first that nobody holds the row (`leased_until` in the past).

## Personal data breach

> **Placeholder for legal.** The text below is a working outline, not legal
> advice. The maintainer and counsel replace it with the approved procedure
> before the first real customer (open question for the pilot gate).

Under the GDPR (Articles 33 and 34) a personal data breach must be reported to
the supervisory authority without undue delay and, where feasible, within 72
hours of becoming aware of it, unless it is unlikely to result in a risk to
people. Salons are the controllers and Cresavo is their processor: a processor
informs the controller without undue delay, and the controller decides on the
notice to the authority and to the people affected. The data processing
agreement must state our own time limit for telling a salon
(`<TBD by legal, e.g. 24 hours>`).

1. **Start the clock.** Record the time we became aware (UTC) in the incident
   record. Contain as in [first steps](#first-steps-every-incident).
2. **Assess** (with the maintainer, the same day): what data (names, contact
   details, booking history, journal entries or other health data), whose, how
   many people and salons, how it was exposed, whether it was read, whether the
   data was encrypted or already public, and whether it is still exposed.
   Journal entries may be health data: treat any exposure of those as high risk.
3. **Tell the affected salons** (the controllers) with what we know and what we
   do not yet know, the contact for questions and the measures taken. Phased
   notices are allowed: initial first, details later.
4. **Notify the supervisory authority** (`<authority and its form, TBD by legal;
   for a Swedish controller, the Swedish Authority for Privacy Protection>`)
   within 72 hours, or document the reasons for the delay. The controller files;
   we supply the facts. If it is not a reportable breach, record why in the
   incident record anyway (Article 33(5)).
5. **Tell the people affected** when the risk to them is high, in plain
   language, with what happened, what it means for them, what we did and what
   they can do.
6. **Close:** root cause, the fix, the secrets rotated, the data deleted or
   restored, and the follow-ups. Keep the record for the retention period the
   legal text sets (`<TBD>`).

Contacts and templates for the notices: `<TBD by legal; kept outside Git>`.
