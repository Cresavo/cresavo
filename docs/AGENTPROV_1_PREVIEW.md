# Private Vercel + Neon preview · preparation only

No accounts, resources, secrets, deployment or remote changes were made by
this task. This is a proposed checklist, not evidence of a running preview.
Niclas must approve exact project, DB/region, access and costs before execution.
Do not reuse the older preview's credentials or DB implicitly.

## Environment variable names

| Name | Purpose / operator action after approval |
| --- | --- |
| `DATABASE_URL` | Preview-only Neon Postgres connection; TLS required, separate database ending `_demo`. Current Prisma/pg adapter retained. |
| `SESSION_SECRET` | Fresh protected random secret, at least 32 characters. Never source/client code or report. |
| `ADMIN_SESSION_VERSION` | Global existing web-session revocation version. |
| `BOOKING_RUNTIME` | `vercel`; preserve existing wrapper ingress trust model. |
| `RATE_LIMIT_STORE` | `postgres`, never process-local memory in Vercel. |
| `TRUST_PROXY_IP` | `0` or unset in this explicit Vercel mode. |
| `VERCEL`, `VERCEL_ENV` | Platform supplied; do not fake them to bypass checks. Preview environment required. |
| `PORT` | Platform supplied where the existing container/wrapper deployment expects it. |
| `NEXT_TELEMETRY_DISABLED` | Disable optional build telemetry. |

`BOOKING_ADDRESS_SECRET` is generated internally by the server wrapper; do not
configure/copy it. Do not enable local MCP-card/A2A/demo-login flags or add
`NEXT_PUBLIC_` secrets. Existing ordinary admin authentication stays enabled.
Agent keys are separate from Vercel protection and admin sessions. Provision
only the two named synthetic clients after approval; no public key issuer.

## Before any deployment

1. Freeze SHA and compare with Windows shared-policy branch. No blind rebase.
2. Approve existing-project reuse versus separate preview project, Neon region,
   synthetic database and current provider cost/quotas. This document approves
   no spend and makes no claim about plan entitlement or runtime availability.
3. Preserve current `vercel.json`, Dockerfile and `scripts/server.mjs` wrapper.
   Existing `framework: container` configuration must be supported by the
   approved project. Do not silently replace it with Next Functions or remove
   socket/proxy security to get a build running. Stop for a separate decision
   if the selected runtime cannot preserve this model. No local Docker needed.
4. Configure protection for **all** project deployments/aliases and HTML,
   assets, admin, REST and MCP before access. No public exceptions, share-link
   publishing, origin exposure or automation bypass provisioning in this task.
   Verify anonymous requests cannot reach any of them. Application bearer auth
   remains necessary as the second boundary for agent traffic.
5. Niclas/operator sets secret values directly in the approved platform or
   process environment. Never pull `.env`, use shell `set -x`, print URLs/tokens,
   or send these to Grok. Run `node scripts/preview-preflight.mjs` **in the
   approved environment**: validates configuration shape only, not protection.

## Migrate, seed, verify (commands for the approved operator)

Use a session/direct Neon connection for migrations, supplied temporarily as
`DATABASE_URL` by the secret manager. A separate direct-URL variable is not
implemented in this repo. Use the approved pooled/direct application connection
after migration. Never run integration/E2E against Neon: the local guard stays.

```sh
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run build
```

Apply all historical migrations plus `20261115010000_agent_contract`; no reset,
`db push`, rewritten histories or dropped data. `btree_gist` extension permission
is required by the original exclusion migration. Seed uses upsert and inserts
the two synthetic services/staff only; it is not a customer-data import.

After separately approved deploy: verify exact SHA, protection for every URL,
TLS, proxy attribution/rate isolation, normal admin login/logout, same-engine
booking/conflict/retry/status, restart persistence, and backup/restore using
only this preview DB. A Vercel login page alone proves no application flow.
Machine access through Vercel protection still needs an approved mechanism;
do not punch public holes for HTTP-MCP or share a browser cookie with agents.
The local proof runner intentionally refuses cloud targets.

Rollback: preserve a DB backup before migration, do not promote the new code
until checks pass. This additive schema can remain during code rollback; old
code cannot create keys without clientId, so old gateway key provisioning and
unmandated writes must stay disabled. A real rollback plan needs an approved
maintenance window and a tested backup, not destructive down SQL.

## Sources consulted, 2026-11-15

[Neon Prisma guide](https://neon.com/docs/guides/prisma) and
[Vercel deployment protection](https://vercel.com/docs/deployment-protection).
Provider guidance informs the checklist; actual account settings, all-domain
coverage, spend and deployed behaviour have **not** been verified here.
