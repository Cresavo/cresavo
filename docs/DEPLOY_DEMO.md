# Deploying the Cresavo demo (Vercel)

The concept demo (`/studio`, `/boka/salong-eko`, and
`/api/concept/*`) runs as a plain Next.js app on Vercel without a database or
secrets. Demo state lives in each visitor's browser; AI tasks run their
built-in rules unless a provider key is configured. The public instance is
<https://demo.cresavo.com>; `cresavo.com` shows the coming-soon page.

- `vercel.json` runs `scripts/vercel-build.sh`, which builds with a dummy
  `DATABASE_URL` (Prisma client generation only),
  `NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1` and
  `NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com` set inside the script (so a
  project environment variable does not override it). Vercel rejects a
  `buildCommand` longer than 256 characters before any build log exists, so
  keep build steps in the script (`tests/vercel-config.test.ts` checks this).
  To deploy your own copy, import the repository as a Vercel project and change
  the product domain in the script to a domain you control; do not present
  your copy as Cresavo ([TRADEMARK.md](../TRADEMARK.md)).
- Environment: `CONCEPT_AI_STORE_DIR=/tmp/concept-ai` (serverless file system is
  read-only elsewhere). Leave `CONCEPT_KEY_SECRET` unset: own-key storage stays
  off. `CONCEPT_MCP_TOKEN` unset means the MCP endpoint rejects all calls in
  production, which is intended for the public demo.
- Addresses: `NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN` is the domain business
  subdomains hang under (default `book.example`; needs a wildcard DNS record and
  wildcard domain on the Vercel project). Own domains are simulation-only,
  even with `CONCEPT_DOMAINS_ENABLED=1` and Vercel credentials. Live changes
  require server-side owner authentication and business-to-domain ownership
  checks (issue #14). The server resolves fixture domains from
  `src/concept/page/directory.ts`.
- AI task requests use rules by default, including requests from the studio.
  A writable deployment can use a configured provider through
  `/api/concept/ai/[task]` only with the matching `Origin`, a server-configured
  `CONCEPT_MCP_TOKEN` as a bearer token, and a verified client address from
  the supported server wrapper or trusted Vercel ingress. Each address can
  make eight provider calls per minute per process, and each process at most
  200 provider calls per day. Every provider call caps the answer at 2,048
  output tokens.
- Not for real customers: see issue #14 and `docs/QUALITY_SECURITY.md`.

The receptionist test-call budget is 40 calls per 24-hour window. When
`DATABASE_URL` is configured, Postgres shares the budget across workers and
restarts. Without a database, the budget is per process and resets on restart;
it is not a deployment-wide spending limit. Database errors refuse the call.

## Cost safety

Nothing a visitor does may run up a bill. The code limits what it can:

- No public request reaches a paid API. AI providers need the owner token
  above; SMS, email, payment and calendar adapters stay simulated on the public
  demo; own-domain changes are simulation-only.
- The proxy skips static files (build output, images, fonts, media), so only
  pages and API routes count as function invocations.
- The Inbox polls `/api/concept/proposals` every 60 s on the public demo (every
  15 s elsewhere), and only while the tab is visible.
- Pairing (`ASSISTANT_PAIRING=1`) keeps its limits in Postgres: 180 anonymous
  requests per minute per address and 3,000 per minute in total.
- Cron jobs are secret-gated and run once a day.

Code limits do not cap a bill. Set these in the Vercel dashboard for the team
and for every Cresavo project (`booking-lab-landing-demo`, `cresavo-gateway`,
`cresavo-sandbox`):

1. **Spend Management** (Pro: **Settings → Billing → Spend Management**): set a
   monthly amount and turn on **Pause production deployments** when it is
   reached. On Hobby, usage stops at the plan's limits instead of being billed.
2. **Firewall → Rate limiting** **(verify)**: add a rule for `/api/*`, for
   example 120 requests per minute per IP, with the action **Deny**. Blocked
   requests do not reach a function.
3. **Firewall → Attack Challenge Mode**: turn it on during abnormal traffic.
4. **Marketplace stores** (Postgres, Redis): choose plans advertised as free
   with no payment method, which stop at quota. Spend Management does not cover
   them.
5. **Provider keys**: give every AI or messaging provider key its own monthly
   budget or hard limit in that provider's console. Leave keys unset on the
   public demo.

The earlier engine previews used `Dockerfile.vercel` with the container
runtime. That setup is retired for now (it predates `next.config.ts`); the
engine needs a deployment plan before the [pilot](ROADMAP.md#pilot-readiness).
