# Backup and restore drill

Covers the managed Postgres behind Cresavo for the pilot. Provider-neutral: the
steps use `pg_dump`, `pg_restore` and `psql`, and the point-in-time notes
describe what any managed provider offers. Everything here uses invented names
and placeholders; no password, URL or key belongs in this file, in Git or in a
log. The pilot gate item is in
[QUALITY_SECURITY](../QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer):
"Automated backups with a tested restore". It is only ticked when a row in the
[drill log](#drill-log) below says the drill passed.

## What is in the database

The salon documents (`tenant_state.doc`, which may hold journal entries and
therefore health data), the audit log (`tenant_action`), the idempotency keys,
the effect outbox (`tenant_effect`, including queued e-mails), owner accounts
and sessions, and the legacy booking tables. Treat every dump as personal data:
encrypt it, restrict who can read it, and delete it on schedule.

Not in the database, so not in any backup: `SESSION_SECRET`,
`STUDIO_STORE_HMAC_SECRET`, provider keys and the login passwords of the
database roles. Keep them in the secret store with their own recovery path.
Losing `SESSION_SECRET` signs everyone out; losing the HMAC secret only breaks
replay of idempotency keys younger than 24 hours (see the
[incident runbook](INCIDENT_RUNBOOK.md#key-rotation)). Neither loses data.

## Targets

The maintainer confirms these before the first real customer. Until then they
are placeholders, and the drill measures what is achievable.

| Target | Value | Meaning |
| --- | --- | --- |
| RPO (recovery point objective) | `<TBD, e.g. 15 minutes>` | The most booking data we accept to lose. Evidence is the recovered point of a drill, measured [as below](#measure-the-recovered-point-rpo), not the provider's advertised window and not the age of the newest row. |
| RTO (recovery time objective) | `<TBD, e.g. 2 hours>` | Time from the decision to restore until bookings work again. The drill's measured time is the evidence. |
| Backup retention | `<TBD, at most 30 days>` | [STUDIO_STORE](../design/STUDIO_STORE.md) keeps backups at most 30 days so that erased customers leave them in bounded time. |
| Drill frequency | `<TBD, e.g. quarterly and after every major migration>` | |

## What to have in place

1. **Provider backups with point-in-time recovery.** Enable the managed
   provider's continuous archiving (WAL) or its daily snapshot plus WAL. Note the
   retention window; it must not exceed the retention target above. Check, do
   not assume, that the provider restores into a new instance rather than over
   the running one, and that it tells you the recovery position it reached (see
   the RPO measurement).
2. **A logical dump as a second, provider-independent copy**, at least daily:

   ```bash
   # PGPASSWORD or ~/.pgpass supplies the password; never pass it on the command line.
   pg_dump --format=custom --no-owner --no-privileges \
     --file "cresavo-$(date -u +%Y%m%dT%H%M%SZ).dump" \
     "postgresql://<dump_login>@<host>:5432/<database>?sslmode=require"
   ```

   Use a `pg_dump` at least as new as the server. Encrypt the file before it
   leaves the machine, store it in a different account or region than the
   database, and delete it after the retention period. The dump login needs
   `SELECT` on everything, so it is its own role, not one of the application's.
3. **Alerting** when a backup is missing or older than the RPO. A backup nobody
   notices failing is not a backup.

## Restore into a separate database

Never restore over production first. Restore into a new, empty database (a new
managed instance, or a new database on a scratch server), prove it, and only
then decide whether to cut over.

1. **Pick the point.** Point-in-time: choose a timestamp just before the
   incident, in UTC, and ask the provider to restore to a new instance at that
   time. Logical: choose the newest dump older than the incident. Note the
   incident time (UTC) in the drill log.
2. **Create the empty target** (skip for a provider restore):

   ```bash
   createdb --host <scratch-host> --username <admin_login> cresavo_restore_drill
   ```

   The name must not be one the application is configured for. The test suites
   refuse databases not ending in `_test` or `_demo`; do not weaken that guard
   to run them here.
3. **Keep the target closed until step 5 is done.** A restore without
   privileges recreates the `SECURITY DEFINER` function `erase_subject` owned by
   the restoring login and executable by `PUBLIC`, until the grants files run.
   Until then only the admin login may connect: no application, sweeper or
   support login exists on the target, and the network rule admits the operator
   only.
4. **Restore the dump:**

   ```bash
   pg_restore --host <scratch-host> --username <admin_login> --dbname cresavo_restore_drill \
     --no-owner --exit-on-error --jobs 4 cresavo-<timestamp>.dump
   ```

   The dump was taken with `--no-owner --no-privileges`, so the restoring login
   owns the objects and no grants came along. That is intended: the roles are
   created fresh in the next step, and a dump that named roles missing on the
   target would fail.
5. **Recreate the roles, grants and logins**, in the order in the header of
   [`prisma/grants/roles.sql`](../../prisma/grants/roles.sql): `roles.sql`,
   `studio-store.sql`, `erase-subject.sql` (with the ownership-transfer
   steps the header gives when the admin login is not a superuser), then the
   three logins with `\password`. A provider restore may keep ACLs, but run the
   files anyway: they are idempotent, and they replace the `PUBLIC` function
   privilege with the intended one. Only then let the application connect.
6. **Verify** (next section), then open the target.
7. **Time it.** Write the start and end into the drill log. RTO is measured
   from the decision to restore until the application serves bookings, so for a
   real incident add the cutover steps below.

## Verify the restore

All of these must pass; any failure fails the drill.

1. **Effective privileges of the real logins are right.** Both return no rows:

   ```bash
   psql --host <scratch-host> --username <admin_login> --dbname cresavo_restore_drill \
     -v app_role=<app login> -f prisma/grants/verify-studio-store.sql
   psql --host <scratch-host> --username <admin_login> --dbname cresavo_restore_drill \
     -v app_login=<app login> -v sweeper_login=<sweeper login> -v support_login=<support login> \
     -f prisma/grants/verify-roles.sql
   ```

   They follow membership and `PUBLIC`, so they also catch the restored
   function being open to everyone, or a grant that reached a login another
   way. Run them again after a second run of `roles.sql`.
2. **The schema matches the code:** with `DATABASE_URL` pointing at the restored
   database (as the schema owner), `npx prisma migrate status` reports that the
   database schema is up to date. Never run `migrate dev` or `migrate reset`
   here.
3. **The data is plausible.**

   ```sql
   SELECT kind, count(*) AS tenants FROM tenant_state GROUP BY kind;
   SELECT count(*) AS accounts FROM owner_account;
   SELECT status, count(*) FROM tenant_effect GROUP BY status;
   ```

   For each tenant, `tenant_state.version` should equal the highest
   `resulting_version` in `tenant_action`:

   ```sql
   SELECT s.tenant_id, s.version, max(a.resulting_version) AS audited
   FROM tenant_state s LEFT JOIN tenant_action a USING (tenant_id)
   GROUP BY s.tenant_id, s.version
   HAVING s.version <> coalesce(max(a.resulting_version), 0);
   ```

   A listed row is either a demo or sandbox tenant whose audit rows were swept
   on purpose, or a real inconsistency; explain each one in the log. The age of
   the newest row says nothing about data loss: a quiet salon has an old
   `updated_at` after a perfect restore.
4. **The application works against it.** Start a scratch copy of the
   application in the mode production uses, with:
   - `DATABASE_URL` for the app login on the restored database;
   - `STUDIO_STORE_HMAC_SECRET`: a throwaway value of at least 32 characters
     (without it even the owner calendar read fails);
   - `RATE_LIMIT_STORE=postgres` and `BOOKING_RUNTIME` as in production
     (owner routes answer 503 in production mode without the shared store);
   - `OWNER_ACCOUNTS_ENABLED=1`, `PUBLIC_BOOKING_LIVE=0`, `CONCEPT_CONNECTIONS_LIVE`
     empty (nothing real is sent) and a throwaway `SESSION_SECRET` (everyone is
     signed out, which is fine).

   Sign in as a synthetic owner, open the calendar and read one booking. Never
   point a scratch application that has live provider keys at restored data:
   queued e-mails in `tenant_effect` would be sent again.
5. **The sweeper works** under its own role: `DATABASE_URL` for the sweeper
   login, then `npm run store:sweep`. It prints JSON counts. The first run after
   a restore also applies retention to what the backup brought back.

### Measure the recovered point (RPO)

The recovered point is the newest moment the restored database reflects. The gap
between it and the incident time is the data lost. Take it from the restore
itself, never from the data:

- **Point-in-time restore:** the timestamp the provider reports as reached, or,
  on a server you run, `SELECT pg_last_xact_replay_timestamp();` right after
  recovery (and the replay LSN, `pg_last_wal_replay_lsn()`). Record the target
  you asked for as well; a recovery that stopped earlier because WAL was missing
  is a failed drill.
- **Logical dump:** the snapshot time of the dump: `pg_restore --list
  cresavo-<timestamp>.dump | head` prints `Archive created at`.
- **Known marker:** for a drill, write down `now()` and `pg_current_wal_lsn()`
  from the live source at the moment you choose as the target, and confirm the
  restored server's replay position reached at least that LSN. This proves the
  chosen point was honoured without writing customer data.

Write the incident time, the recovered point and their difference into the drill
log.

## Things a restored database gets wrong

- **Queued and delivered e-mails.** The restored outbox is as it was at the
  chosen point. Messages sent after that point appear pending and would be sent
  again by a live deliverer. Before any deliverer runs, list the rows with
  `status = 'pending'` and `kind = 'message'` and cancel those whose message was
  already sent. See the
  [uncertain e-mail state](INCIDENT_RUNBOOK.md#uncertain-e-mail-outbox-state).
- **Erasures made after the backup.** A restore can bring back a customer who
  was erased later. Keep the list of erasure requests since the restore point
  (from the requests themselves, not from the database) and repeat each one:

  ```bash
  # DATABASE_URL: the app login; STUDIO_STORE_HMAC_SECRET: the real one. Prints counts only.
  npm run store:erase -- <tenantId> <customerId>
  ```

  This runs the owner studio's erasure (`PostgresStudioStore.eraseSubject` with
  the `erase_subject` function, the only route the append-only application role
  has; `customer/erase` as a plain action is refused on purpose). It sends
  nothing and is safe to repeat. Backups older than the retention target must be
  gone for this to stay bounded.
- **Roles and secrets.** Login passwords and application secrets are not in the
  backup. Restore them from the secret store and set `STUDIO_STORE_HMAC_SECRET`
  to its previous value (a different value only affects replays inside 24
  hours).
- **Bookings made in the gap.** Bookings between the recovered point and the
  incident are gone from the database. Ask the salons to re-enter them; the
  confirmation e-mails in the mail provider's log are the source.

## Real restore: cutover

1. Declare an incident ([runbook](INCIDENT_RUNBOOK.md)) and **stop every writer
   and deliverer**, not only the two feature flags. The flags leave the legacy
   `/api/bookings`, the admin and `/api/v1` routes, pairing and the cron jobs
   running, and the web workers deliver e-mail after each commit. Use the
   [hard stop](INCIDENT_RUNBOOK.md#hard-stop): the application, sweeper and
   `effects:drain` logins are made `NOLOGIN` and their sessions ended, so nothing
   can write whatever is deployed. Wait until `pg_stat_activity` shows no session
   of those logins.
2. Restore into a new database and verify as above. Keep the damaged database
   untouched for forensics until the incident is closed.
3. Reconcile the restored outbox (pending messages, above) and repeat the
   erasures since the recovered point **before** any deliverer runs.
4. Point `DATABASE_URL` of the application, the sweeper and `effects:drain` at
   the new database (its logins are fresh), redeploy, and check `/` and a
   synthetic owner sign-in.
5. Start the writers and deliverers back in this order: web with the flags still
   off, then `effects:drain` and the sweeper; then the flags one at a time (owner
   accounts, public booking, live connections), checking after each.
6. Write the post-incident review, the measured RTO and the actual data loss
   into the [drill log](#drill-log) as a real-restore row.

## Drill log

Add one row per drill or real restore, newest last. The example row is invented
and is removed when the first real drill is logged.

| Date (UTC) | Kind | Backup used | Incident / target time | Recovered point | Gap (RPO) | Duration (RTO) | Both verify scripts empty | `migrate status` clean | App smoke test | Result | Run by | Follow-ups |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<example>` 2026-01-15 | PITR | provider, WAL to 09:58 | 10:00 | 09:58:12 (replay LSN checked) | 1 min 48 s | 38 min | yes | yes | owner sign-in, one booking read | pass | `<name>` | `<issue link>` |
| | | | | | | | | | | | | |
