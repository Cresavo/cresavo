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
| RPO (recovery point objective) | `<TBD, e.g. 15 minutes>` | The most booking data we accept to lose. Set by the provider's point-in-time window, not by nightly dumps. |
| RTO (recovery time objective) | `<TBD, e.g. 2 hours>` | Time from the decision to restore until bookings work again. The drill's measured time is the evidence. |
| Backup retention | `<TBD, at most 30 days>` | [STUDIO_STORE](../design/STUDIO_STORE.md) keeps backups at most 30 days so that erased customers leave them in bounded time. |
| Drill frequency | `<TBD, e.g. quarterly and after every major migration>` | |

## What to have in place

1. **Provider backups with point-in-time recovery.** Enable the managed
   provider's continuous archiving (WAL) or its daily snapshot plus WAL. Note the
   retention window; it must not exceed the retention target above. Check, do
   not assume, that the provider restores into a new instance rather than over
   the running one.
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
   `SELECT` on everything, so it is its own role, not `cresavo_app`.
3. **Alerting** when a backup is missing or older than the RPO. A backup nobody
   notices failing is not a backup.

## Restore into a separate database

Never restore over production first. Restore into a new, empty database (a new
managed instance, or a new database on a scratch server), prove it, and only
then decide whether to cut over.

1. **Pick the point.** Point-in-time: choose a timestamp just before the
   incident, in UTC, and ask the provider to restore to a new instance at that
   time. Logical: choose the newest dump older than the incident.
2. **Create the empty target** (skip for a provider restore):

   ```bash
   createdb --host <scratch-host> --username <admin_login> cresavo_restore_drill
   ```

   The name must not be one the application is configured for. The test suites
   refuse databases not ending in `_test` or `_demo`; do not weaken that guard
   to run them here.
3. **Restore the dump:**

   ```bash
   pg_restore --host <scratch-host> --username <admin_login> --dbname cresavo_restore_drill \
     --no-owner --exit-on-error --jobs 4 cresavo-<timestamp>.dump
   ```

   The dump was taken with `--no-owner --no-privileges`, so the restoring login
   owns the objects and no grants came along. That is intended: the roles are
   created fresh in the next step, and a dump that named roles missing on the
   target would fail.
4. **Recreate the roles and grants**, in the order given in the header of
   [`prisma/grants/roles.sql`](../../prisma/grants/roles.sql): `roles.sql`,
   `studio-store.sql`, `erase-subject.sql`, then `roles.sql` once more. A
   provider restore keeps the grants, but run the files anyway: they are
   idempotent.
5. **Verify** (next section).
6. **Time it.** Write the start and end into the drill log. RTO is measured
   from the decision to restore until the application serves bookings, so for a
   real incident add the cutover steps below.

## Verify the restore

All of these must pass; any failure fails the drill.

1. **The grants check returns no rows:**

   ```bash
   psql --host <scratch-host> --username <admin_login> --dbname cresavo_restore_drill \
     -v app_role=cresavo_app -f prisma/grants/verify-studio-store.sql
   ```

   Every row is a problem (the application role could change the audit log, owns
   a table, or is a superuser).
2. **The schema matches the code:** with `DATABASE_URL` pointing at the restored
   database (as the schema owner), `npx prisma migrate status` reports that the
   database schema is up to date. Never run `migrate dev` or `migrate reset`
   here.
3. **The data is plausible and recent:**

   ```sql
   SELECT kind, count(*) AS tenants, max(updated_at) AS newest_change FROM tenant_state GROUP BY kind;
   SELECT max(at) AS newest_audit_row FROM tenant_action;
   SELECT count(*) AS accounts FROM owner_account;
   SELECT status, count(*) FROM tenant_effect GROUP BY status;
   ```

   Compare `newest_change` with the chosen point: the gap is the data lost, and
   must be inside the RPO. For each tenant, `tenant_state.version` should equal
   the highest `resulting_version` in `tenant_action`:

   ```sql
   SELECT s.tenant_id, s.version, max(a.resulting_version) AS audited
   FROM tenant_state s LEFT JOIN tenant_action a USING (tenant_id)
   GROUP BY s.tenant_id, s.version
   HAVING s.version <> coalesce(max(a.resulting_version), 0);
   ```

   A listed row is either a demo or sandbox tenant whose audit rows were swept
   on purpose, or a real inconsistency; explain each one in the log.
4. **The application works against it.** Start a scratch copy of the
   application with `DATABASE_URL` for a login of `cresavo_app` on the restored
   database, `OWNER_ACCOUNTS_ENABLED=1`, `PUBLIC_BOOKING_LIVE=0`,
   `CONCEPT_CONNECTIONS_LIVE` empty (so nothing real is sent) and a throwaway
   `SESSION_SECRET` (everyone is signed out, which is fine). Sign in as a
   synthetic owner, open the calendar and read one booking. Never point a
   scratch application that has live provider keys at restored data: queued
   e-mails in `tenant_effect` would be sent again.
5. **The sweeper works** under its own role: `DATABASE_URL` for a login of
   `cresavo_sweeper`, then `npm run store:sweep`. It prints JSON counts.

## Things a restored database gets wrong

- **Queued and delivered e-mails.** The restored outbox is as it was at the
  chosen point. Messages sent after that point appear pending and would be sent
  again by a live deliverer. Before live e-mail is turned back on, review the
  rows with `status = 'pending'` and `kind = 'message'` and cancel those whose
  message was already sent. See the
  [uncertain e-mail state](INCIDENT_RUNBOOK.md#uncertain-e-mail-outbox-state).
- **Erasures made after the backup.** A restore can bring back a customer who
  was erased later. Keep the list of erasure requests since the restore point
  (from the requests themselves, not from the database) and run each again
  through `customer/erase`. Backups older than the retention target must be
  gone for this to stay bounded.
- **Roles and secrets.** Login passwords and application secrets are not in the
  backup. Restore them from the secret store and set `STUDIO_STORE_HMAC_SECRET`
  to its previous value (a different value only affects replays inside 24
  hours).
- **Bookings made in the gap.** Bookings between the restore point and the
  incident are gone from the database. Ask the salons to re-enter them; the
  confirmation e-mails in the mail provider's log are the source.

## Real restore: cutover

1. Declare an incident ([runbook](INCIDENT_RUNBOOK.md)) and stop writes first by
   switching `PUBLIC_BOOKING_LIVE` and `OWNER_ACCOUNTS_ENABLED` off, so the
   state does not keep moving.
2. Restore into a new database and verify as above. Keep the damaged database
   untouched for forensics until the incident is closed.
3. Point `DATABASE_URL` of the application, the sweeper and `effects:drain` at
   the new database, redeploy, and check `/` and a synthetic owner sign-in.
4. Turn the flags back on one at a time (owner accounts, then public booking,
   then live connections), checking after each.
5. Write the post-incident review, the measured RTO and the actual data loss
   into the [drill log](#drill-log) as a real-restore row.

## Drill log

Add one row per drill or real restore, newest last. The example row is invented
and is removed when the first real drill is logged.

| Date (UTC) | Kind | Backup used (age) | Restored into | Duration (RTO) | Data gap (RPO) | `verify-studio-store.sql` empty | `migrate status` clean | App smoke test | Result | Run by | Follow-ups |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<example>` 2026-01-15 | logical dump | nightly, 7 h | scratch instance `drill-a` | 38 min | 7 h | yes | yes | owner sign-in, one booking read | pass | `<name>` | `<issue link>` |
| | | | | | | | | | | | |
