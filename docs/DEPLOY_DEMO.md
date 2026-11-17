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
- Not for real customers: see issue #14 and `docs/QUALITY_SECURITY.md`.

The earlier engine previews used `Dockerfile.vercel` with the container
runtime. That setup is retired for now (it predates `next.config.ts`); the
engine needs a fresh deploy plan in goal 11.
