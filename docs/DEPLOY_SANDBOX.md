# Deploy the fictional agent booking sandbox

The Cresavo sandbox runs in split mode on `sandbox.cresavo.com`. Its public
agent endpoint is the separate [Cresavo gateway](https://github.com/Cresavo/gateway)
at `gateway.cresavo.com`. Its Swedish welcome page on the existing demo
deployment is `/let-ai-book` (English at `/let-ai-book/en`).
The landing page has no scripts or API calls. Publish its link after the live
sandbox check passes.

## Owner steps before any deployment

1. In the Pro team `niclasvestlund-3367s-projects`, create a dedicated project
   named `cresavo-sandbox` after approving cloud setup. Keep automatic Git
   deployments off. The checked-in `vercel.sandbox.json` belongs to that project
   only. The main `vercel.json` remains the configuration for the existing demo.
   Use a separate gateway project. The gateway uses its portable container and
   its [own shared limits](https://github.com/Cresavo/gateway/pull/9).
2. In **Storage → Create Database → Marketplace**, choose a dedicated
   PostgreSQL plan advertised as free, with no payment method and no paid
   overages. Confirm it stops at quota. Apply the same rule to the gateway's
   shared limit store. If the provider requires payment details, a usage
   upgrade, or paid compute, stop. Keep these resources disconnected from
   the existing demo and existing Cresavo projects.
3. Prepare an empty database as the migration owner. Use separate, fresh
   database logins for the provider and for Cron. Neither login should inherit
   the migration role or unrelated grants. Set the installation UUID using
   `scripts/sandbox/mark.sql` **before** `npm run db:migrate`. Apply
   `scripts/sandbox/runtime-grants.sql` with `runtime_role` after migration and
   `scripts/sandbox/reset.sql` with `reset_role` after that. These SQL files
   take `psql -v` arguments for the installation ID and role names. The
   installation UUID is configuration metadata, not a password. Use a
   secure local secret mechanism for database credentials. The application
   receives the provider login only, and Cron receives the reset login only.
   Keep the migration credential outside Vercel.
4. In each project's **Settings → Environment Variables**, configure
   **Production** only. Copy the sandbox project's ID from **Settings → General**
   and enable [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
   so runtime can verify its actual project ID and deployment environment.
   Store the shared service token only in the gateway and sandbox projects.
   Do not copy values across from the existing demo.
5. In **Team Settings → Billing → Spend Management**, add a **Project** budget
   for `cresavo-sandbox` and switch on **Pause production**. Set a low
   threshold within remaining included usage/credit before deployment. Apply
   the same check to the separate gateway project. Review any metered add-ons
   and retained deployment storage. Use project budgets rather than changing
   the team's pause setting.
6. After approving DNS and deployment separately, use the two projects'
   **Settings → Domains** to add `sandbox.cresavo.com` and `gateway.cresavo.com`.
   Follow the displayed DNS instructions if the nameservers do not handle it
   automatically. Deploy the approved revision to the sandbox project using
   the sandbox config explicitly:

   ```sh
   vercel deploy --prod --scope niclasvestlund-3367s-projects \
     --project cresavo-sandbox --local-config vercel.sandbox.json
   ```

   Verify that **Settings → Cron Jobs** shows only the intended sandbox reset,
   `/api/sandbox/reset` at 03:15 UTC. Keep the concept demo's Vercel settings
   and DNS separate. The repo change alone does not create a deployment.

## Sandbox production settings

| Setting | Value or purpose |
| --- | --- |
| `BOOKING_SANDBOX` | `1` in the sandbox project's Production environment. |
| `BOOKING_SANDBOX_PROJECT_ID` | The dedicated Vercel project's `prj_…` ID. The runtime requires an exact match with Vercel's own project ID. |
| `BOOKING_SANDBOX_DB_ID` | The UUID recorded by the dedicated database bootstrap. |
| `BOOKING_SANDBOX_ORIGIN` | `https://sandbox.cresavo.com` |
| `BOOKING_RUNTIME` | `vercel` |
| `BOOKING_SERVICE_ROLE` | `salon` |
| `BOOKING_PUBLIC_ORIGIN` | `https://gateway.cresavo.com` |
| `BOOKING_CONSENT_DELIVERY` | `sandbox-demo-phone` |
| `RATE_LIMIT_STORE` | `postgres` |
| `DATABASE_URL` | Sandbox provider login, with only the specified runtime grants. |
| `BOOKING_SANDBOX_RESET_DATABASE_URL` | Distinct sandbox reset login with only permission to invoke its reset routine. Prefer the direct TLS endpoint. |
| `SESSION_SECRET` | Dedicated random secret of at least 32 characters. |
| `BOOKING_SANDBOX_IP_KEY` | A separate secret, 32 random bytes encoded as lowercase hex. |
| `CRON_SECRET` | A separate 32-byte random, lowercase hex secret. Vercel supplies it in the Cron authorization header. |
| `GATEWAY_SERVICE_TOKEN` | One shared 32-byte random, lowercase hex secret for these two projects only. |

The gateway's `SALON_ORIGIN` is `https://sandbox.cresavo.com`. Use its existing
remote-mode and shared-limit settings. Never enable the consent/SMS/OAuth lab,
owner pairing, read-only product demo, or live providers in the sandbox project.
The sandbox recognizes only its custom domain for browser and provider
traffic. The reset endpoint also accepts the exact Vercel production hostname
so the scheduler can reach it, and always requires `CRON_SECRET`. The reset
SQL independently checks the actual reset login and database installation.
Do not enable scheduled jobs in preview environments.

## Limits and verification

The hosted provider admits up to **3 pairs per verified IP or IPv6 /64 per UTC
day**, **8 sessions per reset generation** and **20 bookings per session**,
subject to the existing stricter booking and contact limits. Each session also
has up to 256 agent-provider calls and 128 phone calls. That bounds admitted
provider and phone calls to 3,072 per generation, or about 95,300 in a
31-day month, before low incidental calls from pairing and Cron. The gateway
also retains its own per-IP limits. This is below the [Pro function invocation
allocation](https://vercel.com/pricing), which is shared with other projects.
Rejected traffic, CPU time and storage have their own usage implications.
[Pause production](https://vercel.com/docs/spend-management#pausing-projects)
is a backstop that can lag. It cannot enforce a zero-dollar cap or cover
Marketplace services. The owner accepted the residual Vercel usage risk.

The Linux CI job creates a fresh local PostgreSQL sandbox, runs
`provider:check -- --write`, verifies both database roles and reset, and runs
the gateway kit against an isolated HTTPS provider with Chromium. Take stock
of the actual passing output before merge. A hosted provider check is optional.

The hosted check uses the ordinary-key mode of [gateway PR #10](https://github.com/Cresavo/gateway/pull/10).
From its approved checkout:

```sh
SANDBOX_PROVIDER_ORIGIN=https://sandbox.cresavo.com npm run test:e2e -- \
  --gateway https://gateway.cresavo.com --adapter /absolute/path/to/Cresavo/scripts/sandbox/gateway-adapter.mjs
```

Only run against the approved fictional deployment. The adapter obtains a demo
key and opens the customer's phone in a different browser context. The test
proves the proposal requires approval, a retry returns the same booking, and
the exact booking appears in that customer's sandbox calendar.
Report sanitized PASS/FAIL output. The runner needs no service token.
