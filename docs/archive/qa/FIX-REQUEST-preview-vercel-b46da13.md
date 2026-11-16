# Fix request: preview b46da13 (round 1 of 2)

## Blocker PV-QA-1 (Medium, DEPLOY-CONFIG)

**Problem.** `.vercelignore` uses `**` followed by `!src/**`, `!scripts/**`, `!prisma/**`, `!docs/DEPENDENCY_REVIEW.md` and so on.

**Cause.** Vercel CLI's file collector skips any directory that matches an ignore rule and never descends into it. The collector is `@vercel/client` 18.11.2 (`buildFileTree`), which uses ignore 4.0.6 and a recursive readdir. `src`, `scripts`, `prisma` and `docs` all match `**`, so nothing inside them is collected.

**Reproduction.** Run offline on the candidate tree (both CRLF and LF):

```js
require("@vercel/client/dist/utils")
  .buildFileTree(dir, { isDirectory: true, prebuilt: false }, () => {})
```

It returns only 15 top-level files. `src/`, `scripts/`, `prisma/` and `docs/DEPENDENCY_REVIEW.md` are missing. Plain git semantics give the same result. A CLI deploy would therefore build `Dockerfile.vercel` without the application code. No secret leaks: `.env` stays excluded.

**Required change.**

1. Rewrite `.vercelignore` as a root-anchored allowlist that re-includes the directories themselves:

   ```
   /*
   !/Dockerfile.vercel
   !/.dockerignore
   !/vercel.json
   !/package.json
   !/package-lock.json
   !/prisma.config.ts
   !/prisma
   !/src
   !/scripts
   !/public
   !/next.config.ts
   !/next-env.d.ts
   !/tsconfig.json
   !/postcss.config.*
   !/tailwind.config.*
   !/LICENSE
   !/THIRD_PARTY_NOTICES.md
   !/README.md
   !/docs
   /docs/*
   !/docs/DEPENDENCY_REVIEW.md
   !/.env.example
   .env
   .env.*
   !/.env.example
   ```

   With this draft, QA's scratch run returned 93 files: 0 `.env*` files, 0 `tests/` files, and `src/`, `scripts/`, `prisma/` and `docs/DEPENDENCY_REVIEW.md` present.
2. Optionally align `.dockerignore` to the same anchored style.
3. Add an automated check that runs the Vercel collector, or an equivalent ignore-4.x walk that skips ignored directories, against the repository. It must assert that `src/app/**`, `scripts/server.mjs` and `prisma/migrations/**` are included, and that `.env*` (except `.env.example`), `tests/**` and other `docs/**` files are excluded.
4. Do not change product code, package files or migrations for this fix.

## Non-blocking backlog (do not fix in this round unless trivial)

- **PV-QA-2:** the refund in `postgres-rate-limit.ts` runs outside the advisory lock, which causes a lost update. It is conservative.
- **PV-QA-3:** the wrapper does not validate `RATE_LIMIT_STORE` (local mode) or `SESSION_SECRET` (vercel mode) at startup. Requests later fail with 500.
- **PV-QA-4:** at 10000 rows, the oldest active bucket is evicted. This is a known design property.
- **PV-QA-5:** E2E teardown leaves 30 `RateLimitBucket` rows per database. The cap test assumes an empty table.
- **PV-QA-6:** in the Vercel project, confirm `PORT=3000` and that the `x-real-ip` header is always present. This is an operational check.

## Re-check QA will run

- Repeat the `buildFileTree` file list.
- Confirm that package, lock and migrations are byte-identical.
- Run lint, tsc, unit and integration.
- Repeat the no-DB build and prune, then start the wrapper.
