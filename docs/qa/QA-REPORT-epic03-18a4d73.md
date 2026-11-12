# QA report: Booking Lab SE Epic 03 (dependency security, Prisma 7), independent review

Reviewer: Booking Lab QA (Grok Bot). 2026-11-12, 02:06–02:25 Europe/Stockholm (CET). Read-only, box only.
- **Run folder:** `/workspace/qa/booking-lab-se/run-18a4d73/`; paths below are relative to it.
- **Database:** own embedded PostgreSQL 18.6 on 127.0.0.1:**55531**, server `timezone=Europe/Stockholm` (non-UTC on purpose). DBs `booking_e3_test` and `booking_e3up_test` (upgrade copy).
- **Node TZ:** matrix ran with `TZ=Europe/Stockholm`; one extra unit + integration pass ran with `TZ=America/New_York`.
- **Isolation:** synthetic data only. Codex's DB 55448/55449, work repo and `.env` were not touched. Nothing was run on the PC. No product code changes, project dependency changes, commits or pushes.

## Verdict
**Epic 03 PASS: the Prisma 7.10.1 upgrade can be accepted as a local POC change. No FIX-REQUEST.**
- The upgrade is functionally clean: all suites pass, the upgrade path keeps data, the UTC session holds, and concurrency stays correct.
- Full audit went from 3 high / 7 moderate to **0 high / 7 moderate**; prod audit is 0. The remaining 7 moderate (minimatch via typescript-eslint) are blocked upstream, as the plan anticipates (E03-3 "blocked").
- One new observation needs honest wording but no code fix: **E03-QA-1**, an intermittent deadlock in the deliberate lock-bypassing DB test.
- **Pilot remains NO-GO**, for the known blockers:
  - 7 moderate audit findings
  - EPL-2.0 elkjs in the production install tree (distribution check)
  - individual admin accounts / MFA
  - GDPR lifecycle
  - real TLS / proxy and process isolation
- External CI: NOT RUN (no push).

## 1. Revision
- **Archive:** `src/booking-lab-epic03-18a4d73.zip`
  - sha256 `f18d8bb21354dfb9cd99b21161750df37bf72ad81f9bb5b4ca04f4398d9f6f9a` = F18D8BB2…F6F9A ✓.
  - ZIP comment `18a4d736bd5435ed8d856ae87843cadcf237cfcc` ✓.
- **Diff vs my cad997b tree** (CRLF-normalised, `logs/tree-diff-cad997b-18a4d73.txt`) matches the PC's per-commit list exactly.
  - **Code/config:** package.json, package-lock.json, `prisma.config.ts` (new), `prisma/schema.prisma` (−1 line `url = env("DATABASE_URL")`), `prisma/seed.ts`, `scripts/database.mjs` (new), `scripts/record-demo.mjs`, `scripts/test-cleanup.mjs`, `src/lib/db.ts`, `src/lib/domain.ts`, vitest.config.ts.
  - **Tests:** booking-errors, database (unit + integration new), e2e cleanup.probe / fixtures / flow.
  - **Docs:** AGENTS.md, THIRD_PARTY_NOTICES.md, `docs/*` (incl. new EPIC_03_PLAN, DEPENDENCY_REVIEW, EPIC_03_LICENSE_INVENTORY, MORNING_REPORT, `qa/QA-REPORT-epic02-cad997b.md`).
  - `.env.example`, `.gitignore` and LICENSE differ only by CRLF.
- **Unchanged:** `prisma/migrations/` (all 3), `src/mcp/`, `src/app/` (all routes/API), `src/lib/*` except db.ts / domain.ts.
- **domain.ts diff:** only the SQLSTATE extraction in `insertBooking`'s catch (`meta.driverAdapterError.cause.originalCode`, falling back to `meta.code`). Same raw INSERT, same 3 codes (23P01/40P01/40001), same advisory-lock order.
- **Not verifiable here:** the per-commit split (the PC git history you relayed is consistent with the tree). Codex's newer docs-only commit 1e33c65.

## 2. Matrix (my runs, `logs/summary.log`)
| Step | Result | Codex claim |
|---|---|---|
| npm ci (clean) | PASS: `added 569 packages, audited 570`, `7 moderate` | 568. **Not a contradiction:** platform-specific optional package; same +1 Linux/Windows offset as before (462 vs 461). |
| prisma generate / `npm run db:migrate` (3) / seed | PASS. Migrate prints "Loaded Prisma config from prisma.config.ts", 3 found, all applied. | ✓ |
| lint / tsc / tsc after suite | PASS / PASS / PASS | ✓ |
| unit | **51/51** (8 files); again **51/51 with TZ=America/New_York** | 51 ✓ |
| integration | **31/31 ×3** (15/17/16 s) with server TZ Stockholm; **31/31** once more with TZ=America/New_York | 31 ×3 ✓ |
| E2E dev proxy 0 / 1 | **12/12** (25.3 s) / **12/12** (22.6 s) | ✓ |
| build | PASS | ✓ |
| E2E prod proxy 0 / 1 | **12/12** (16.0 s) / **12/12** (15.9 s) | ✓ |
| cleanup probe | `REMAINING_SYNTHETIC_ROWS=0; PASS` | ✓ |
| DB after matrix | 0 / 0 / 0, 0 overlaps, `pg_stat_database.deadlocks=0`, session TimeZone=UTC | ✓ (but see E03-QA-1 for later runs) |
| npm audit (full) | **exit 1: 0 critical / 0 high / 7 moderate**. All 7 are minimatch 7.0.0–11.0.0 via @typescript-eslint/* (6.16.0–8.72.2) and typescript-eslint ≤8.72.2. | ✓ |
| npm audit --omit=dev | **exit 0: 0** | ✓ |

## 3. Plan criteria / requested items
| Item | Status | Evidence |
|---|---|---|
| E03-1/2: matching versions | **PASS** | `npm ls`: prisma, @prisma/client, @prisma/adapter-pg, @prisma/config, @prisma/engines all **7.10.1**, exact pins in package.json; deepmerge-ts 8.0.2 (`logs/npm-ls.log`) |
| Same SQL / migrations / fields / API / MCP / lock order | **PASS** | §1 diff. Schema only lost the datasource URL. Published MCP `create_booking` schema byte-identical to fc83a70. |
| Pool max 5 / timeout 5 s | **PASS** | `scripts/database.mjs`: `max:5, connectionTimeoutMillis:5000, idleTimeoutMillis:10000`. 8 parallel transactions used exactly **5** backends (`logs/probe-tz-session.log`). No pool timeouts or 500s under load (§4). |
| UTC session, reliable per connection | **PASS** | `options=-c timezone=UTC` is appended to the URL, so it goes into the startup packet of every new pooled connection. Server default Europe/Stockholm → every app connection `UTC`. After `pg_terminate_backend` of all 5 pooled backends, the new backends are also UTC. A URL that itself requests `-c timezone=Europe/Stockholm` still ends up UTC (later `-c` wins). **Negative control** (same adapter without the option, scratch only): session Europe/Stockholm and a Date parameter for 2027-10-31T01:30Z **shifted −2 h**; the product factory shifted **0 h**. So the fix is necessary and effective. |
| Explicit env, no `.env` leakage | **PASS** | Runtime: `createDatabaseClient` needs an explicit `DATABASE_URL` and throws static `DATABASE_CONFIG_INVALID` (stack, no URL/password; canary password not echoed). CLI: `prisma.config.ts` uses `process.loadEnvFile` only if `.env` exists, and **exported vars win** (migrate with exported URL went to `booking_e3up_test` although `.env` pointed elsewhere). **E02-QA-2 now resolved:** importing db/booking without `--env-file` leaves `SESSION_SECRET` and `ADMIN_PASSWORD` undefined, and `--admin --allow-bookings` without an exported secret exits 1 `MCP_BOOKING_CONFIG_INVALID` even with the secret in `.env` (`logs/probe-q2-env.log`). No secrets printed by any script. |
| v7 SQLSTATE mapping | **PASS** | Overlap via HTTP → 400 "Tiden är inte tillgänglig"; via MCP → isError with the same text (thousands of losers, 0 × 500). Idempotency conflict → 409 "Bokningsnyckeln har redan använts med andra uppgifter." (6/6 runs, web and MCP). This 409 comes from the advisory lock + existing-key check (`domain.ts:193`), not a 23505 mapping; no 23505 path exists or is needed. Unit/integration cover the structured code and "other error not hidden". Observed v7 shape: `P2010/P2039` with `meta.driverAdapterError.cause.originalCode`. |
| E03-4: upgrade path | **PASS** | `logs/upgrade-old-phase.log`, `upgrade-new-phase.log`. Prisma **6.19.3** (cad997b tree) migrated and seeded `booking_e3up_test`, then wrote 10 bookings around all four DST transitions 2026/2027 plus normal days, 1 campaign and 1 session. Prisma **7** `migrate deploy` → "No pending migrations". Under Node TZ Stockholm, New York and UTC: all 10 bookings identical via ORM **and** raw `extract(epoch)` (start/end/createdAt/fields); campaign and session intact; ORM update across autumn 2027 DST kept the epoch; 4 new v7 writes ORM == raw. **Rollback read:** Prisma 6 reads the v7 writes with identical instants. All fixtures removed. |
| DST | **PASS** | As above, plus Codex's integration DST/ORM/raw test (passes ×4 incl. NY). Server TZ non-UTC throughout. |
| Conflict / idempotency / concurrency (E03-4) | **PASS** (product path) | See §4. |
| E03-3 minimatch | **PASS as "blocked upstream", claim accurate** | Stable typescript-eslint 8.72.2 / typescript-estree 8.72.2 require `minimatch ^10.2.2` (10.2.6 installed); eslint-config-next 16.4.6 is latest. New fact: **canary 8.72.3-alpha.8 (published 2026-11-11 18:05 CET) depends on `^11.0.1`**, so a fix is coming but is prerelease only (excluded by the plan). No override, no lint rules removed. |
| Licenses (E03-1/6) | **PASS with known distribution blocker** | Own scan of installed `package.json` licenses (`logs/license-scan.log`): **full tree 569 pkgs** = MIT 449, Apache-2.0 53, ISC 42, BSD-2 8, BSD-3 4, MPL-2.0 3, Unlicense 2, LGPL-3.0-or-later 1, EPL-2.0 1, others permissive; **no GPL/AGPL, no non-commercial, no UNKNOWN**. New vs cad997b: only **elkjs EPL-2.0** and @visx/vendor "MIT and ISC". LGPL libvips and MPL axe-core/lightningcss are pre-existing and documented. **Prod tree** (`npm ci --omit=dev` in scratch): 189 pkgs incl. LGPL libvips and **EPL-2.0 elkjs** (E03-QA-2). |
| Inventory doc accuracy | **PASS (exact)** | Lockfile delta cad997b → 18a4d73 = **112 added + 17 changed = 129**, 5 removed. Matches all **129** inventory rows one-to-one; **0** version/license mismatches (`logs/inventory-check.log`). Note: `effect` goes 3.21.0 → 3.20.0 (a downgrade, harmless). |
| elkjs not in Next output | **PASS** | `.next`: 0 files mention elkjs/studio-core; **12** `*.nft.json` traces reference only @prisma/client, client-runtime-utils and pg*, with **0** refs to the prisma CLI / @prisma/engines / studio / dev / elkjs. |
| MCP after the client change | **PASS** | `logs/probe-q1-validation.log`: 32/32 static "Kontrollera uppgifterna" + isError cases, 0 writes. Positive `create_booking` OK (minimised keys). Same known E02-QA-4/5 behaviour. stderr empty. |
| E03-5 audits with exit codes | **PASS** | §2 |
| E03-6 rollback | **PASS (data side)** | Prisma 6 reads v7 data unchanged; migrations identical, so rollback is code + lock + npm ci. |

## 4. Concurrency, pool and contention (production server :3300, TZ Stockholm)
- **MCP-only** (`probe-q3`): 30 same-slot + 30 overlap rounds × 20 on 2 MCP processes → 60 OK / 1,140 "Tiden är inte tillgänglig", 0 bad rounds, max 375 ms, stderr empty.
- **Mixed web + MCP** (`probe-q4`): **220 rounds / 4,400 calls**, web delay 0/10/25/40/60/90/150/250/400 ms. Exactly **1 winner every round** (web 169, MCP 51), **0 overlaps, 0 HTTP 500**, losers 400 / isError with the static text. Cross-channel idempotency (E02-QA-3 behaviour) reproduced 9×.
- **Pool stress** (`probe-q5`):

  | Burst | Result |
  |---|---|
  | 60 web on distinct slots | 60× 201, p50 384 ms, max 504 ms |
  | 120 web on distinct slots | 120× 201, p50 389 ms, max 592 ms |
  | 100 web + 40 MCP on one slot | 1× 201, 99× 400, 40× MCP "Tiden är inte tillgänglig", 1 row, 710 ms |

  **0 pool timeouts, 0 × 500.**
- **Deadlocks:** 0 in all product-path probes. The only deadlocks are E03-QA-1.

## 5. Codex claims
- **Confirmed:**
  - Prisma / client / adapter-pg 7.10.1; pool 5 / 5 s; UTC session; explicit CLI env
  - v7 structured SQLSTATE mapping; no migration / field / lock-order / API / MCP contract change
  - unit 51/51; integration 31/31 ×3; E2E 12/12 in all four modes; lint / tsc / build; cleanup
  - audit full exit 1 (7 moderate / 0 high); prod exit 0 (0)
  - minimatch: no stable upstream fix; elkjs EPL-2.0 documented with no AGPL claim; inventory of 129 entries
  - upgrade copy PASS (also reproduced with real Prisma 6 → 7, not a template copy)
- **Nuanced:** "568 packages" vs my 569 (platform, as before). ".nft.json 10 files" vs my 12 (count differs by platform/build, conclusion identical: 0 refs).
- **Contradicted (partly):** "final aggregates … deadlock = 0" is true for my matrix aggregate too, but not reliable: 4 deadlocks in later runs of the same suite/test, see E03-QA-1.
- **Unverifiable:** Codex's timings, its 55448/55449 DBs, commit 1e33c65, the per-commit split.

## 6. Findings
| ID | Severity | Label | Summary |
|---|---|---|---|
| E03-QA-1 | Low | IDEA (test/doc hardening; not a product regression) | Intermittent PostgreSQL deadlock in the deliberate lock-bypassing direct-ORM exclusion test under Prisma 7 |
| E03-QA-2 | Medium (distribution) | **Known pilot/distribution blocker**, documented | Production install tree (`--omit=dev`) contains Prisma CLI/Studio incl. EPL-2.0 elkjs |
| E03-QA-3 | Info | IDEA | minimatch fix exists only in typescript-eslint canary (8.72.3-alpha.8 → minimatch ^11.0.1) |
| E03-QA-4 | Info | IDEA | First query after server-side connection drop fails once (P2039) before the pool reconnects |
| E03-QA-5 | Info | IDEA | MCP writes are slower to start: web wins mixed races up to ~90 ms head start (previously ~60 ms) |

**E03-QA-1: intermittent deadlock in the direct exclusion test.**
- **Repro:** `node --env-file=.env ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts tests/integration/booking.test.ts -t "två samtidiga direkta"`, 20 times against my DB:
  - **Prisma 7 (18a4d73): 20/20 PASS, but 3 `deadlock detected` in pg.log.**
  - Same test from the cad997b tree (Prisma 6.19.3), same DB: **20/20 PASS, 0 deadlocks**.
  - In the full suite it appeared once (during the extra TZ=America/New_York integration pass); my 3 Stockholm-TZ suite runs had 0. pg.log total = 4, all on `INSERT INTO "Booking"` "while checking exclusion constraint" (`logs/probe-direct-exclusion-deadlock.log`, `pg.log`).
- **Cause:** two concurrent ORM `booking.create` calls on the same range **without** the domain's advisory locks. PostgreSQL exclusion checks can deadlock in that case and abort one transaction with 40P01. The test still passes because exactly one insert is rejected and the DB invariant holds. Prisma 7's adapter evidently runs the two inserts more truly in parallel.
- **Product path unaffected:** `createBooking` takes the staff/day advisory lock first and maps 40P01 to "Tiden är inte tillgänglig". 0 deadlocks in 220 mixed + 60 MCP rounds + stress.
- **Criterion:** the old DoD and Codex's VERIFICATION report "0 deadlocks" for the suite; that is not reliably reproducible now. No E03 acceptance criterion is broken: E03-4 requires "utan överlapp/serverfel", and both are 0.
- **Fix direction (docs/test only, optional for the one allowed round):** state in VERIFICATION that the direct-write DB test may log an expected 40P01. Optionally assert the rejected reason ∈ {23P01, 40P01}, and keep "0 deadlocks" as a gate only for product-path stress probes. Do not change product locking.

**E03-QA-2: production install tree includes Prisma CLI/Studio and EPL-2.0 elkjs.**
- **Repro:** scratch `npm ci --omit=dev --ignore-scripts` → 189 packages incl. `prisma`, `@prisma/studio-core`, `elkjs 0.11.1 (EPL-2.0)`. Lockfile marks them `devOptional` (optional peer of @prisma/client).
  - `--omit=dev --omit=peer` changes nothing.
  - `--omit=dev --omit=optional` removes them (52 pkgs) but also drops the platform binaries (`@img/sharp-linux-x64`, `@next/swc-*`).
- **Mitigation evidence:** Next build traces don't include them (§3).
- **Documentation:** Codex's DEPENDENCY_REVIEW and THIRD_PARTY_NOTICES already say this explicitly and claim no AGPL compatibility. Correct, so not a contradiction.
- **Fix direction:** before any distribution, define the artefact (e.g. traced standalone output only) and verify that elkjs is excluded or EPL obligations are met. Pilot-level item.

**E03-QA-3:** the plan forbids prereleases, so the "blocked upstream" status is correct. Re-check when typescript-eslint >8.72.2 is stable; it should clear all 7 moderate findings without an override.

**E03-QA-4:** after I terminated the 5 pooled backends, the next transaction failed once with `P2039`; then 5 new UTC backends served normally. That is standard pg-pool behaviour (in-flight web requests would get 500 "Ett fel inträffade" during a DB restart). Optional: document it, or add a single retry for connection-terminated errors outside transactions.

**E03-QA-5:** in cad997b, MCP won mixed races once the web side had ≥60 ms of delay; now web wins up to 90 ms and MCP only from ~150 ms. This is likely the new per-process adapter pool warm-up. No correctness impact. Info only.

**Unchanged from Epic 02 (re-observed):** E02-QA-4 (`__proto__` silently dropped) and E02-QA-5 (non-object `arguments` → SDK protocol error). **E02-QA-2 is now effectively resolved** by Prisma 7's lack of `.env` autoload (verified above). It is still not OS process isolation, as the docs say.

## 7. Missing tests (suggestions, not blocking)
1. Deadlock-tolerant assertion / documentation for the direct exclusion test (E03-QA-1).
2. A unit test that a URL with an existing `options` (e.g. search_path) keeps it and still gets UTC (I verified the timezone-override case manually).
3. A pool-recovery test after a server-side connection drop (E03-QA-4).

## 8. Housekeeping
- **Stopped:** web server :3300; Playwright servers :3000 (auto); all MCP / vitest children; PostgreSQL 55531 (`server stopped`).
- **State check:** 0 remaining processes; no listeners on 3000/3300/55531. Final `booking_e3_test` 0/0/0, 0 overlaps (the `deadlocks` counter = 4, explained in E03-QA-1). `booking_e3up_test` fixtures deleted.
- **Scratch:** the prod-install scratch node_modules was removed. The cad997b tree was used only read-only, as the Prisma 6 baseline.
- **Other:** no commits, pushes, merges, PRs, GitHub writes, deploys or demo. No Codex `.env` / cookies / secrets read; only my synthetic `.env`. Temporary tooling: npm view / npm ls only (no license-checker install; own scanner script). Nothing on the PC.
