# Incident runbook

For the pilot. Short on purpose: in an incident you read the severity table,
the first steps and the one section you need. Names, phone numbers and
provider logins are not in this file; they live in the on-call sheet kept
outside Git (`<on-call sheet location, TBD by the maintainer>`). Never paste a
secret, a customer's details or a database URL into an issue, a chat or this
file. The pilot gate item is in
[QUALITY_SECURITY](../QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer).
How incidents are noticed (error reports, alerts, uptime checks) is in
[MONITORING](MONITORING.md).

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

The four flags, and the e-mail pause below them, are environment variables read at runtime. On a Vercel-style
host a changed variable applies to new deployments, so redeploy after changing
it. Each is reversible. **None of them is a stop**: they narrow what the owner
studio and the public pages do, and leave other writers running (see the
[hard stop](#hard-stop) when writes must end).

| Flag | Off value | What stops | What keeps running | Watch out |
| --- | --- | --- | --- | --- |
| `PUBLIC_BOOKING_LIVE` | `0` or unset | `/api/public/*` answers 404 on a writable deployment (`src/lib/public-http.ts`), and the public booking pages are served from the demo's browser state instead of a salon's data (`src/lib/public-booking.ts`). | The owner studio and owner sign-in; the legacy `/api/bookings`, `/api/availability`, `/api/admin/*`, `/api/v1`, `/api/waitlist` and pairing routes; every cron job; delivery already queued. | Confirmation e-mails for bookings made through the public page are held, not dropped: the message sink returns `deferred` and they send when the flag is back (no attempt is used up). A customer who opens the page during the outage sees the demo, not an error; say so on the status page. |
| `OWNER_ACCOUNTS_ENABLED` | `0` or unset | Every `/api/owner/*` route answers 404 (`src/lib/owner-http.ts`), so owners cannot sign in or change anything, and public booking stops too, because it needs both flags. | Same as above: legacy routes, admin, `/api/v1`, pairing, the cron jobs and the deliverers. Stored sessions are not deleted. | The strongest of the four, for a suspected cross-tenant read or a broken session check. Password-reset links stop working too. It does not stop the `/api/admin/*` or `/api/v1` writers. |
| `CONCEPT_CONNECTIONS_LIVE` | empty or `0` | Every connection (e-mail, SMS, payments, ...) is simulated, including owner password-reset e-mails (`src/concept/connections/server/config.ts`). | Everything else. | Whether a message is "live" is fixed when the store stages it (`record.live`). **Messages staged while this is off are permanently simulated: they never send, even after the flag is back.** Find them with `SELECT tenant_id, seq, n FROM tenant_effect WHERE kind = 'message' AND payload->>'live' = 'false'` over the outage window and have the salons follow up by hand. Messages already staged as live wait: the sink raises `EMAIL_NOT_CONFIGURED`, the outbox retries with exponential backoff (2 s doubling, capped at 1 hour) and gives up after 10 attempts, roughly 17 minutes, after which the rows are `failed` (reopen them with [`effects:reconcile retry`](#reconciling-the-e-mail-outbox)). **To hold e-mail for longer, use `CONCEPT_EMAIL_PAUSED=1` instead**, unless anything real must stop at once. |
| `CONCEPT_EMAIL_PROVIDER` | empty or `simulated` | Only the e-mail port: it resolves to the simulator; SMS and the other ports are unaffected. | Everything else. | The same two effects as the row above, for e-mail only: new messages are simulated for good, queued live ones fail after about 17 minutes. For a provider outage or a wrong setting, prefer `CONCEPT_EMAIL_PAUSED=1`; use `CONCEPT_CONNECTIONS_LIVE` when anything real must stop. |
| `CONCEPT_EMAIL_PAUSED` | `1` (empty or `0` delivers) | E-mail delivery only: no deliverer claims an e-mail row, neither the `effects:drain` poller nor the drain a web worker runs after each commit, so nothing is sent (`src/concept/store/effect-outbox.ts`). | Booking, and the staging of e-mails exactly as before: a message staged during the pause is still live or simulated as the other flags say. SMS, payments and the other effects are delivered as usual. | **The flag to use when e-mail must wait**: due rows stay `pending`, use no attempt and never become `failed`, however long the pause lasts. Unset it and the next drain sends them, oldest first, each under its own idempotency key. Set it on the web app **and** the `effects:drain` cron. A row claimed in the second before the switch waits too (`deferred`); one whose provider call had already started finishes that call. Owner password-reset e-mails do not go through the outbox and are not paused. |

Other switches:

- `PUBLIC_READONLY=1` is the public demo's mode, not an incident switch. It
  makes the main database client refuse to start, so owner routes fail rather
  than turn read-only, and pairing (when enabled) still uses its own
  `PAIRING_DATABASE_URL`. Do not use it on the pilot deployment.
- A stuck or misbehaving e-mail deliverer: set `CONCEPT_EMAIL_PAUSED=1` on the
  web app and the cron job, which stops every deliverer claiming e-mail.
  Stopping only the `npm run effects:drain` cron job is not enough: web
  workers also deliver right after each commit. The [hard stop](#hard-stop)
  stops every writer.
- The cron job of `npm run store:sweep` can be paused at any time; it only
  deletes or redacts rows that retention says may go.

### Hard stop

When writes must end (a restore, a cross-tenant leak, a runaway deliverer),
stop the processes and remove the database logins' ability to connect, so
nothing can write whatever is deployed. As the schema owner:

```sql
ALTER ROLE <app login>     NOLOGIN;
ALTER ROLE <sweeper login> NOLOGIN;
-- plus the login of effects:drain and of any other writer, e.g. the admin CLI's
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE usename IN ('<app login>', '<sweeper login>') AND pid <> pg_backend_pid();
SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;   -- wait for no row of those logins
```

Also scale the web processes and cron jobs to zero, so they do not log failures
in a loop. Undo with `ALTER ROLE <login> LOGIN`. In-flight work finishes or
rolls back when its session ends; a message whose provider call was in flight
may be [uncertain](#uncertain-e-mail-outbox-state).

### Containing one account

Raising an owner's `credential_version` ends its current sessions, but the same
password opens a new one at once, so it does not contain a compromised account.
Set the account inactive, as the schema owner, and then raise the version:

```sql
UPDATE owner_account SET active = false, credential_version = credential_version + 1 WHERE id = '<account id>';
```

Reset links do not work for an inactive account. To restore access, set
`active = true`, have the owner reset the password straight away through a
verified route, and watch the sign-ins.

A password reset does not turn two-step sign-in off. An owner who lost both
the authenticator and every recovery code can only be let back in by an
operator, as the schema owner, after verifying who they are through a channel
other than the account's e-mail:

```sql
BEGIN;
UPDATE owner_account SET totp_secret_enc = NULL, totp_pending_enc = NULL, totp_pending_expires_at = NULL,
  totp_enabled_at = NULL, totp_last_step = NULL, credential_version = credential_version + 1 WHERE id = '<account id>';
DELETE FROM owner_recovery_code WHERE account_id = '<account id>';
COMMIT;
```

The owner then signs in with the password and sets two-step sign-in up again.

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
- **Pending two-step sign-ins** (5 minutes): an owner between the password and
  the code starts again with the password.
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
- The pairing IP budgets (`src/concept/pairing/http.ts`) and the local MCP
  recovery values (`src/mcp/time-card/recovery.ts`).

It does **not** invalidate pairing: the pairing cookie and the assistant's access
and refresh tokens are stored and checked as unkeyed digests
(`src/concept/pairing`), so they stay valid after rotation. If an assistant
pairing may be compromised, revoke the grants explicitly (delete the affected
`PairGrantToken` and `PairGrant` rows through the pairing tooling, or end the
workspace) and tell the owner to pair again.

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

### `OWNER_MFA_KEY`

Deploy order: a build from before two-step sign-in ignores it, signs enrolled
owners in with the password alone and accepts every session. Finish rolling
out (no older worker left) before owners turn it on, and never roll back to
such a build while any `owner_account.totp_enabled_at` is set. Sessions opened
by an older worker lack `owner_session.mfa_verified_at` and are refused by the
current build.


Encrypts every owner's authenticator secret (AES-256-GCM, stored as
`v1:<iv>:<tag>:<ciphertext>` in `owner_account.totp_secret_enc`) and, through a
key derived from it, keys the recovery-code hashes (`owner_recovery_code`).
**There is no re-encryption yet: a new value makes every stored secret and
recovery code unreadable.** After a rotation, every owner with two-step sign-in
gets "not configured" (503) at the code step, cannot turn it off or get new
codes, and cannot sign in. Nothing is skipped: no one gets in without the
second step. Accounts without two-step sign-in are unaffected.

- Rotate only after a leak of the key *together with* the database, since
  either alone reveals nothing. Plan it with the owners: after deploying the
  new value, clear two-step sign-in for each enrolled account with the SQL in
  [containing one account](#containing-one-account) and ask them to set it up
  again.
- If the key is lost or removed by mistake, put the old value back: the
  stored secrets work again at once.
- Follow-up (not built): accept the old key next to the new one and
  re-encrypt on use, using the `v1:` prefix for a `v2:` format.
- Removing `OWNER_MFA_KEY` is not an off switch for two-step sign-in: it locks
  every enrolled owner out. `OWNER_MFA_REQUIRED` can be set back to `0` at any
  time; it only stops making two-step sign-in mandatory.

### Other secrets

Provider keys (`RESEND_API_KEY`, `POSTMARK_SERVER_TOKEN`, payment and
accounting keys): create the new key at the provider, deploy it, revoke the
old one, then check the provider's log for use of the old key during the
incident window. **E-mail credentials:** the message sink fingerprints the
account from the last characters of the credentials
(`src/concept/connections/server/registry.ts`). A new Resend key for the same
provider account gets a different fingerprint, so a message already
`dispatched` under the old key is no longer repeated and becomes `failed` with
reason `uncertain`. Rotate when no row is in flight (`SELECT count(*) FROM
tenant_effect WHERE status = 'pending' AND payload #>> '{delivery,dispatched}' =
'true'` returns 0), or reconcile those rows as
[below](#uncertain-e-mail-outbox-state). 

Database login passwords: `\password <login>` in `psql` (it prompts and sends
only a hash; an SQL `PASSWORD '...'` literal lands in shell history and the
server log), update the secret store, redeploy; the group roles have no
passwords. When a person's support access ends, `REVOKE cresavo_support FROM
<login>` and terminate its sessions; `VALID UNTIL` only stops new password
logins.

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

Failed rows are terminal; the deliverer never claims them again. A person
reconciles them with [`npm run effects:reconcile`](#reconciling-the-e-mail-outbox).

**Find them** with `npm run effects:reconcile -- list`, or in SQL (as the schema
owner or another role that may read `payload`; the support role cannot, by
design):

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
   salon's booking, not in the outbox row; the list shows its domain). The
   row's `id` is the idempotency key sent with the request.
2. **Sent:** `effects:reconcile -- mark-sent <id> --tenant <tenant> --apply`
   and note it in the incident record.
3. **Not sent:** `effects:reconcile -- mark-failed <id> --tenant <tenant> --apply`.
   Then either tell the salon, who sends the confirmation or cancellation by
   hand or contacts the customer (for a cancellation it is the more important
   message), or, if a second copy reaching the customer is acceptable, resend
   it with `retry <id> --tenant <tenant> --force-maybe-duplicate --apply`.
4. Count the rows and find the cause: provider outage, a deploy mid-send, or
   a limit such as the 23-hour window. If the cause is repeating, raise it as a
   SEV2.

## Reconciling the e-mail outbox

`npm run effects:reconcile` (`scripts/reconcile-effects.mts`) reopens or
settles `failed` e-mail rows by hand. Run it with `DATABASE_URL` of a login
that may read and update `tenant_effect` (the schema owner; the support role
cannot). **It changes nothing without `--apply`**: a dry run prints what would
happen. Every action names its tenant with `--tenant`, and an id of another
tenant is refused.

```sh
npm run effects:reconcile -- list [--tenant <tenant>]
npm run effects:reconcile -- retry <id...> --tenant <tenant> [--force-maybe-duplicate] [--apply]
npm run effects:reconcile -- mark-sent <id...> --tenant <tenant> [--apply]
npm run effects:reconcile -- mark-failed <id...> --tenant <tenant> [--apply]
```

- **`list`** shows every `failed` effect per tenant, with its id, kind
  (`email/confirmation`, ...), `failed` or `uncertain`, age, attempts, the last
  error code (`EMAIL_NOT_CONFIGURED` for a row that ran out of attempts while
  the connection was off, or the failure's reason), whether a request may have
  left (`dispatched`) and the recipient as `***@domain`. It never prints a
  message body or an address.
- **`retry`** puts a `failed` e-mail back to `pending` with its attempts reset;
  the next drain sends it. It resends what the first attempt froze: the same
  message, booking link, sender and reply-to, under the same idempotency key,
  even if the salon has changed its name or address since. It is refused for a
  row that may have left (`dispatched`, which every `uncertain` row is) unless
  `--force-maybe-duplicate` is given; that drops the marker and accepts that
  the customer may get the message twice. Use this after an outage that
  outlasted the 10 attempts, once the cause is fixed.
- **`mark-sent`** settles an `uncertain` row the provider's log shows as sent:
  it becomes `delivered`.
- **`mark-failed`** settles an `uncertain` row the provider's log shows as not
  sent: it stays `failed` with reason `not_sent`, and keeps its marker, so a
  later `retry` still needs the force flag.

Each id is decided and changed in its own transaction under the row's lock. A
row a deliverer still holds, an erased or cancelled row and anything that is
not an e-mail are refused. Running the same command again changes nothing
(`unchanged`). Each id prints one JSON line (`event: "effect_reconcile"`, actor
from `--actor` or the shell user, action, tenant, effect id, dry run, outcome,
reason): that line is the audit record, because the tenant's own audit log
(`tenant_action`) holds the studio's changes only. Copy the lines into the
incident record. The exit code is 1 when any id was refused.

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
