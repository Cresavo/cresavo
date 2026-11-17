# Deploying the Flerdo demo (Vercel preview)

The concept demo (`/studio`, `/boka/salong-eko`, `/landing`, `/api/concept/*`)
runs as a plain Next.js app on Vercel without a database or secrets. Demo state
lives in each visitor's browser; AI tasks run their built-in rules unless a
provider key is configured.

- Project: `flerdo-demo` (Vercel team "<redacted-vercel-user>'s projects"),
  connected to this repository, deploying branch `concept/ai-native-demo`.
- Protection: Vercel Authentication on all deployments. Only people with
  access to the Vercel team (or a time-limited share link) can open it.
- `vercel.json` builds with a dummy `DATABASE_URL` (Prisma client generation
  only) and redirects `/` to `/landing`, because the engine's root page needs
  PostgreSQL.
- Environment: `CONCEPT_AI_STORE_DIR=/tmp/concept-ai` (serverless file system is
  read-only elsewhere). Leave `CONCEPT_KEY_SECRET` unset: own-key storage stays
  off. `CONCEPT_MCP_TOKEN` unset means the MCP endpoint rejects all calls in
  production, which is intended for this preview.
- Addresses: `NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN` is the domain business subdomains
  hang under (default `book.example`; needs a wildcard DNS record and wildcard
  domain on the Vercel project). Own domains stay simulated unless
  `CONCEPT_DOMAINS_ENABLED=1` plus `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` and
  `VERCEL_TEAM_ID` are set; the endpoint has no login yet (issue #14), so keep it
  off until real authentication exists. The demo keeps each page in its owner's
  browser, so only the fixture domain in `src/concept/page/directory.ts` resolves
  on the server.
- Not for real customers: see issue #14 and `docs/QUALITY_SECURITY.md`.

The earlier engine previews used `Dockerfile.vercel` with the container
runtime. That setup is retired for now (it predates `next.config.ts`); the
engine needs a fresh deploy plan in goal 11.
