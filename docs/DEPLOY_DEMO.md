# Deploying the Cresavo demo (Vercel)

The concept demo (`/studio`, `/boka/salong-eko`, the demo landing and
`/api/concept/*`) runs as a plain Next.js app on Vercel without a database or
secrets. Demo state lives in each visitor's browser; AI tasks run their
built-in rules unless a provider key is configured. The public instance is
<https://demo.cresavo.com>; `cresavo.com` shows the coming-soon page.

- `vercel.json` builds with a dummy `DATABASE_URL` (Prisma client generation
  only), `NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1` and
  `NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com` set inside `buildCommand`
  (so a project environment variable does not override it). To deploy your
  own copy, import the repository as a Vercel project and change that value in
  `vercel.json` to a domain you control; do not present your copy as Cresavo
  ([TRADEMARK.md](../TRADEMARK.md)).
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
  make eight provider calls per minute per process.
- Not for real customers: see issue #14 and `docs/QUALITY_SECURITY.md`.

The earlier engine previews used `Dockerfile.vercel` with the container
runtime. That setup is retired for now (it predates `next.config.ts`); the
engine needs a fresh deploy plan in goal 11.
