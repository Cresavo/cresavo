# FIX REQUEST · Agentprov 2 · bcae82b · QA2-bcae82b-01

Source report: QA-REPORT-agentprov2-bcae82b.md. Tree under review: bcae82b (product rev 17ce75bb92f2d5c14b3cc017d7343d99b6f918bd). Base e890b69 stays frozen. At most two fix rounds.

Constraints: no push/PR/merge/deploy, no accounts or paid services, no .env or secrets, synthetic data only, do not weaken or delete existing tests, do not touch historical migrations.

## Blocker

### AP2-QA-1 (Medium) · OpenAPI schema missing from the packaged runtime; /api/v1/openapi returns 500

Evidence:
- .vercelignore:23-25 and .dockerignore:23-25 exclude everything under docs/ except docs/DEPENDENCY_REVIEW.md, so docs/agent-api-v1.openapi.yaml is not uploaded and is not in the Docker build context.
- The Dockerfile.vercel runtime stage (lines 25-33) copies no docs/.
- src/app/api/v1/openapi/route.ts:5 reads docs/agent-api-v1.openapi.yaml from process.cwd() at request time.
- vercel.json uses "framework": "container", so next.config.ts outputFileTracingIncludes (NFT) does not decide what ends up in the image.
- QA simulation: previewFiles → build → Dockerfile-like runtime layout → npm start. /api/v1/openapi returned 500 with ENOENT; with the yaml added it returned 200. The USP profile (discovery.ts:23) and llms.txt advertise this URL.
- tests/agent-discovery.test.ts:49 reads from the source tree, so it cannot catch this.

Required change (pick one):
1. Re-include the file in packaging: add !/docs/agent-api-v1.openapi.yaml to both .vercelignore and .dockerignore, and copy it into the runtime stage, e.g. COPY --from=build --chown=node:node /app/docs/agent-api-v1.openapi.yaml ./docs/agent-api-v1.openapi.yaml.
2. Or remove the runtime file read: embed the schema at build time, e.g. as a generated or imported module, so the route has no dependency on docs/ at runtime.

Acceptance criteria:
- A1: previewFiles(repo root) includes docs/agent-api-v1.openapi.yaml, or option 2 is used and no runtime route reads from docs/. This is asserted in tests/preview-files.test.ts or a new test.
- A2: A test or static check asserts that every runtime file a route reads is present in the Dockerfile.vercel runtime stage. At minimum it greps the COPY lines for the OpenAPI path, or confirms option 2.
- A3: In a packaged-layout smoke run, GET /api/v1/openapi returns 200 with Content-Type application/yaml; charset=utf-8 and a body containing "openapi: 3.1.0". The smoke run is files from previewFiles, then build, then runtime-stage file set only, then npm start on loopback. Do not claim a Docker test unless Docker was actually run.
- A4: Unchanged: lint, tsc and build pass, unit 166/166 (plus new tests), integration 139/139, and the metadata routes still never reflect Host, X-Forwarded-* or Origin.
- A5: Update docs/VERIFICATION.md so the NFT line no longer implies packaging proof (see AP2-QA-2).

## Backlog (not blocking the local POC; fix if cheap)

- AP2-QA-2 (Low): docs/VERIFICATION.md:29-30 overstates "NFT includes OpenAPI" as packaging evidence. Reword it and reference the A1–A3 tests.
- AP2-QA-3 (Low): discovery.ts:9 silently publishes http://127.0.0.1:PORT when BOOKING_PUBLIC_ORIGIN is missing outside vercel mode, including NODE_ENV=production. Require an explicit origin in production, or at least log a startup warning. Add a test.
- AP2-QA-4 (Info): the mandate_place CHECK only validates lengths. Consider CHECK ("scheduleId" = 'staff-schedule:' || "staffId") as a NEW migration while the place model is 1:1 with staff. Never edit historical migrations.
- AP2-QA-6 (Info): document the deliberate choices: no CORS on discovery, a Vary header that includes Next router headers on cacheable metadata, and the schema routes returning 200 when the origin config is invalid.
- AP2-QA-7 (Info): the unit suite does not catch per-alias scope or the usp_services_get business filter. Integration does. Consider a fast in-process test.

## Re-test plan (QA)

1. Packaging simulation as in report section 7.3, both the negative and the positive run.
2. Targeted unit tests, full unit, integration agent-usp, full integration, lint, tsc, build.
3. Curl matrix and the HTTP MCP probe (75 checks) as regression.
