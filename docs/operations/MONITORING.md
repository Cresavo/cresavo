# Monitoring

For the pilot. Everything here is **off until the operator configures it**: with
no environment variable set the app sends nothing anywhere and only writes
structured log lines to its own output. This page is the setup guide; the pilot
gate item stays open until the alerts below exist and one of them has been
tested end to end (see the
[pilot gate](../QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer)).
When an alert fires, follow the [incident runbook](INCIDENT_RUNBOOK.md).

## Environment variables

| Variable | Default | Effect |
| --- | --- | --- |
| `ERROR_REPORT_DSN` | unset | A Sentry-compatible DSN (`https://<key>@<host>/<project>`). Unset or malformed: error reporting is off and nothing is sent. `http` is accepted for `localhost` only. |
| `ERROR_REPORT_SAMPLE_RATE` | `1` | Share of unexpected errors that are sent, `0` to `1`. An invalid value counts as `1`. |
| `HEALTH_CHECK_DB` | unset | `1` makes `GET /api/health` also run `SELECT 1` (1.5 s timeout). |

The release in each report is the `version` in `package.json`; the environment
is `VERCEL_ENV` or else `NODE_ENV`.

## Logs

Server events are one JSON line each, written by `src/lib/log.ts`:
`level`, `event` (a fixed code such as `BOOKING_INTERNAL_ERROR`), `time`, and
only these optional fields: `requestId`, `route`, `method`, `provider`,
`reason`, `code`, `task`, `tool`, `errorName`, `status`, `durationMs`. Each field
has a strict shape and a value that does not fit is dropped. Free text, e-mail
addresses, phone numbers, names, tokens, cookies and bodies cannot be logged.
Warnings and errors go to stderr. `/api/concept/*` also writes one `request`
line per call (`src/concept/server/logger.ts`).

Event codes you may want to filter on: `BOOKING_INTERNAL_ERROR` (an unexpected
failure behind a booking, owner or public route, or a page's data),
`REQUEST_ERROR` (an error Next.js caught that no route handled),
`CONCEPT_ROUTE_ERROR`, `CONCEPT_AI_TASK_FAILED`, `OWNER_RESET_EMAIL_NOT_SENT`,
`BOOKING_EMAIL_WAITING`. The `/api/v1`, `/admin`, MCP and pairing code keeps its
own existing log lines.

Where the logs go and how long they are kept is a hosting decision (the pilot
gate has a separate item for log retention). Choose an EU region there too.

## What an error report contains

Sent only when `ERROR_REPORT_DSN` is set, once per unexpected error, for:
unexpected 500s turned into the generic answer by `safeFailure`
(`src/lib/errors.ts`, which the owner, public and legacy routes use), errors
Next.js catches itself (`onRequestError` in `src/instrumentation.ts`) and
unexpected failures of the concept routes.

Sent:

- the error's class name (for example `TypeError`) and the event code;
- the stack as file paths, line numbers, column numbers and function names (the
  working directory is cut off the path, and a query string on a path is removed);
- the route pattern where it is known (`/api/public/salons/[slug]`, never the real URL);
- the release, the environment, a timestamp and a random event id.

Never sent: the error message or cause, request bodies, headers, cookies, query
strings, URLs, e-mail addresses, names, phone numbers, IP addresses, user ids or
any customer, booking or salon data. The report is built from the list above,
not filtered from the original, and `tests/error-report.test.ts` checks it.

Reports are fire-and-forget with a 2-second timeout: a monitoring outage never
slows or fails a request. On a serverless host a report may be lost if the
function freezes before it is sent; that is accepted. 4xx answers (validation,
rate limits, domain errors) are not reported.

## EU hosting: you pick the region

The app does not choose where reports go; the DSN does. Use only an EU
destination:

- **Sentry SaaS:** create the organisation with the EU data region (data stays
  in Frankfurt; the DSN host ends in `.de.sentry.io`). The region cannot be
  changed afterwards.
- **A compatible service you host in the EU:** GlitchTip or Bugsink accept the
  same DSN. Host it in an EU region and keep its database in the EU.

Whichever you choose: sign a data processing agreement with the provider, add it
to the sub-processor list ([`docs/legal/SUBPROCESSORS.md`](../legal/SUBPROCESSORS.md)), switch on "Prevent storing of IP
addresses" in the project's security settings (the app sends no IP, but the
service sees the connection), and set a short retention for events.

Setup: create a project (platform Node.js), copy its DSN into the secret store
as `ERROR_REPORT_DSN` (the DSN is a write-only key but keep it out of Git), set
`ERROR_REPORT_SAMPLE_RATE` if volume is high, deploy. Then provoke one test
error on a staging deployment and check that it arrives with no message.

## Alerts to create

Alert to a phone (push or SMS) for the first four, not only to e-mail. These are
settings in your error tracker, log tool or host; none is created by the app.

1. **5xx rate.** The share of responses with status 5xx above, say, 2% over 5
   minutes (the host's metrics or a log query on `status >= 500`), and any
   spike of new issues in the error tracker.
2. **`BOOKING_INTERNAL_ERROR`.** Any occurrence alerts: it is an unexpected
   failure behind a booking, owner or public route. In the error tracker, an
   alert on the tag `event_code:BOOKING_INTERNAL_ERROR`; in a log tool, on
   `event = "BOOKING_INTERNAL_ERROR"`.
3. **Outbox `uncertain` and `failed` messages.** A scheduled query (every 5
   to 15 minutes, as the schema owner or a role that may read `payload`; the
   support role can only count by status) that alerts when a count is above
   zero. The queries are from the
   [incident runbook](INCIDENT_RUNBOOK.md#uncertain-e-mail-outbox-state):

   ```sql
   -- uncertain or failed booking e-mails, by reason
   SELECT payload->'delivery'->>'reason' AS reason, count(*)
   FROM tenant_effect
   WHERE kind = 'message' AND status = 'failed'
   GROUP BY 1;

   -- support role, counts only
   SELECT tenant_id, status, count(*) FROM tenant_effect GROUP BY 1, 2;
   ```

   Alert on any `uncertain` row, and on a rising `failed` count. Also watch for
   rows stuck in `pending` for long (the deliverer is not running).
4. **Health check failures.** See below.
5. **Quiet but useful:** a drop to zero in the daily number of bookings on a
   business day, and the `OWNER_RESET_EMAIL_NOT_SENT` and `BOOKING_EMAIL_WAITING`
   events, which mean e-mail is not leaving.

## Uptime monitoring of `/api/health`

`GET /api/health` returns `{"ok":true,"version":"<release>"}` with status 200.
It is cheap, never cached, and reveals no configuration. It is a liveness
probe for an uptime monitor, not a status page.

- Point an uptime monitor (an EU-hosted one, or your host's) at
  `https://<your host>/api/health` every minute, alert after 2 failures in a
  row to a phone, and expect `"ok":true` in the body.
- Set `HEALTH_CHECK_DB=1` to make it also run `SELECT 1` against the database
  with a 1.5-second timeout. It then answers `503` with `{"ok":false,...}` when
  the database does not respond. Leave it off if you only want a process check;
  with it on, each probe costs one connection from the pool.
- A health check cannot see a broken booking flow. Keep the alerts above, and
  run the booking journey by hand after each deployment.

A public status page for customers is a separate item in the pilot gate and is
not built here.
