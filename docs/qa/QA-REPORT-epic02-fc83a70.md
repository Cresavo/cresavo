# QA report: Booking Lab SE Epic 02, first targeted review (E02-1 – E02-3)

Reviewer: Booking Lab QA (Grok Bot), 2026-11-12, approx. 00:45–01:00 Europe/Stockholm (CET). Read-only. Everything ran on the box in `/workspace/qa/booking-lab-se/run-fc83a70/`; nothing was run on Niclas's PC. Own embedded PostgreSQL 18.6 on 127.0.0.1:**55501** (`pgdata/`, DB `booking_rfc_test`), synthetic data only. Paths below are relative to the run folder.

## Verdict
- **Continue Epic 02 (E02-4 → E02-6): GO.** E02-1, E02-2 and E02-3 meet their acceptance criteria in my tests, with one minor deviation in the error contract (E02-QA-1). I found no data-integrity, authorisation, privacy or concurrency defect.
- **Blockers:** none for continuing. E02-QA-1 should be fixed before the E02-6 final gate (it literally deviates from "Fel fångas av samma sanering"). It is low risk and the fix is small.
- Pilot remains NO-GO (unchanged Epic 01 blockers; out of scope here).

## 1. Scope and revision
- Frozen revision **fc83a70611baf111fc665cb465d53fde2918a45d**, base **02edeaffddb3c932a56062e53b80c238abf3402e**. Source: `src/booking-lab-fc83a70.zip` (zip comment = `fc83a70611baf111fc665cb465d53fde2918a45d`, i.e. `git archive` of that commit). Files were CRLF (Windows autocrlf); I normalised them to LF in `norm/tree` → scratch copy `work/`.
- Cross-check (`xcheck/`, my dc15023 clone + GitHub read-only fetch). `02edeaf` is a local commit that is not on GitHub. The patch file is UTF-8-BOM + CRLF + PowerShell/CP437 mojibake in non-ASCII lines, so `git am` / `git apply` could not apply it byte-exactly. Results:
  - Every ASCII line added by the patch is present in the zip. The 3 new files match the patch line-by-line (non-ASCII lines skipped) (`logs/patch-vs-zip.log`).
  - Code delta dc15023 → fc83a70 (`logs/code-diff-dc15023-to-fc83a70.diff`) contains only the patch's code changes (domain.ts exports, src/mcp/booking.ts, environment.ts, server.ts, 2 test files). `scripts/`, `prisma/`, `package.json` and `package-lock.json` are identical to dc15023. So 02edeaf differs from dc15023 only in docs.
- Read: AGENTS.md, docs/EPIC_02_PLAN.md, docs/EPIC_02_STEP3_RESULTS.md, docs/NIGHT_WORK.md.
- Not in scope / not run: full E2E matrix, demo, test client (E02-5), unchanged Epic 01 areas.

## 2. Commands run (VERIFIED, `logs/summary.log`)
| Step | Result | Log |
|---|---|---|
| `npm ci` | exit 0, 462 packages, `10 vulnerabilities (7 moderate, 3 high)` | `npm-ci.log` |
| `npx prisma generate`, `npm run db:migrate` (3 migrations), `npm run db:seed` | exit 0 | `prisma-generate.log`, `migrate.log`, `seed.log` |
| `npm run lint` / `npx tsc --noEmit` | exit 0 / exit 0 | `lint.log`, `tsc.log` |
| `npm test` | **40/40** (6 files) | `unit.log` |
| `npm run test:integration -- tests/integration/mcp-booking.test.ts` | **8/8** (4.87 s) | `integration-mcp-booking.log` |
| `npm run test:integration` (full) | **26/26** ×3 runs | `integration-full.log`, `integration-full-2.log`, `-3.log` |
| `npm run build` | exit 0 (used for the web server in the mixed probe) | `build.log` |
| `npm audit --json` | 3 high, 7 moderate. Unchanged; lockfile identical to dc15023, so no licence scan. | `audit.log` |
| DB after everything | 0 Booking / 0 Campaign / 0 AdminSession; **0 "deadlock detected"** in `pg.log` for the whole run | `final-db-counts.log` |

## 3. Per-area results
Probes drive the real `src/mcp/server.ts` over stdio with the SDK client (`probes/mcplib.mjs` and `p1…p4*.mjs`). I passed explicit env vars (PATH, DATABASE_URL, NODE_ENV=test, synthetic SESSION_SECRET).

| Area | Status | Evidence |
|---|---|---|
| **E02-1 strict input** | **VERIFIED** | `logs/probe-p1-flags-validation.log`. Published inputSchema: `additionalProperties:false`, all 6 fields required. Rejected with 0 DB rows: unknown keys `clientAddress`, `clientKey`, `channel`, `idempotencyKey`; `confirmed` false / "true" / missing; `clientRequestId` missing / "" / 65 chars / space / unicode / number; `serviceId` number / "" / unknown; name 1 char / 81 chars / whitespace; email other domain / subdomain / invalid / `a@evil.com#@example.test`; start without offset / date only / 2027-02-30 / number; past time, Sunday, 08:30, 17:00, 09:15 misaligned, year 9999, +120 days (domain → "Tiden är inte tillgänglig"); `null` and `{}` arguments. Accepted (as intended): `Z` instant, millisecond form, `+05:00` same instant, `@EXAMPLE.TEST` (stored lower-case), instruction-like and newline names. A JSON `"__proto__"` key is dropped by the JSON-RPC layer before validation (the schema itself rejects it; no prototype pollution) (`logs/probe-env-proto.log`). Existing HTTP input unchanged: web bookings worked normally (§ mixed probe). |
| **E02-2 flags / least privilege** | **VERIFIED** | Neither flag → tools `list_services, get_availability`. `--admin` → plus `list_bookings, create_campaign_draft`, **no `create_booking`**; direct `tools/call create_booking` → "Tool create_booking not found", 0 rows. `--allow-bookings` alone → exit 1 `MCP_BOOKING_CONFIG_INVALID`, empty stdout. Both flags (either order) → `create_booking` listed and works. Short secret → exit 1. `--allow-bookings=1` → not enabled. `--ADMIN --allow-bookings` → exit 1. Secret truly absent (process env unset and not in `.env`) → exit 1 (`logs/probe-secret-missing.log`). See E02-QA-2 for the `.env` subtlety. |
| **Server-determined channel cap** | **VERIFIED** | `logs/probe-p2-idem-caps.log`, `probe-p2b-caps.log`. Channel identity is the constant `mcp:local-booking-channel:v1` → HMAC clientKey; there is no input field for it (unknown keys rejected). 6 bookings with distinct emails → 5 OK + 429; **a new MCP process is still at 429**; DB shows 5 channel bookings today. Replay of key #1 with the same payload after the cap → OK, same id. Retry of the rejected 6th → still 429. Email cap: `qa.cap+1/+2/+3@` OK, base address → 429. Process-local rate bucket: 30 calls then 429 within one process; a new process resets that bucket, but not the DB day cap (documented POC behaviour). Changing SESSION_SECRET yields a new channel identity (Info). |
| **E02-3 same domain engine** | **VERIFIED (code + behaviour)** | `create_booking` → `createBooking(v, v.clientRequestId, MCP_BOOKING_CLIENT)`. Same path as HTTP: rate limit, client/email caps, staff/day advisory lock, availability, `insertBooking` with the exclusion constraint. Raw insert is not called from the tool. MCP and web bookings contend correctly (below). |
| **E02-3 idempotency** | **VERIFIED** | Same key + payload twice → same id; from a **new MCP process** → same id. Same key with changed name or changed start → "Bokningsnyckeln har redan använts med andra uppgifter.", 0 new rows. 20 parallel calls with the same new key → 20 OK, **1 distinct id, 1 row**. Key scoping across channels: see E02-QA-3. |
| **E02-3 minimisation / privacy** | **VERIFIED** | Success payload = `{id, serviceId, startsAt, endsAt}` only. `list_bookings` rows = `{id, startsAt, endsAt, service{id,name}}`: no email, no name, no injected text. MCP server stderr was empty across all probes (no PII, no secret). The web server logged only static `BOOKING_INTERNAL_ERROR` during a harness mistake (see § 6), nothing else. |
| **Concurrency, MCP only** | **VERIFIED** | `logs/probe-p3-concurrency.log`: 30 rounds × 20 parallel same slot and 30 rounds × 20 parallel overlapping 60/30, each round split over **2 separate MCP processes**. 60 OK (exactly 1 per round), 1140 × "Tiden är inte tillgänglig", 0 thrown/500, 0 overlaps after every round, max round 292 ms, 0 deadlocks. |
| **Concurrency, mixed web + MCP** | **VERIFIED** | `logs/probe-p4-mixed.log`, `probe-p4b-mixed-delayed.log`: production web server (`npm run start`) + MCP, 10 HTTP (distinct client IPs) + 10 MCP per round, overlapping 60/30. **160 rounds / 3200 calls**: exactly 1 winner every round (web 30+30+30+19+2+0+39 / MCP 1+0+0+1+18+20+1 depending on the web delay), losers web `400 "Tiden är inte tillgänglig"` / MCP isError same text, **0 HTTP 500, 0 `BOOKING_INTERNAL_ERROR`, 0 deadlocks, 0 overlaps**. |
| Prompt/tool injection | **VERIFIED, low exposure** | Tool descriptions are static. Customer free text (names) is never returned to the model by any MCP tool (list/create are minimised). The only model-reflected client strings are unknown key names in SDK validation errors (E02-QA-1). |
| Error leakage | **Partially**: see E02-QA-1 | Domain errors go through `safeFailure` (static Swedish texts). The DB-down case is covered by Codex's test (not re-run by me). |

## 4. Codex claims (EPIC_02_STEP3_RESULTS.md)
| Claim | Status |
|---|---|
| prisma generate, 3 migrations, seed PASS | **Confirmed** |
| lint, tsc PASS | **Confirmed** |
| `npm test` 40/40 | **Confirmed** (40/40) |
| MCP integration 8/8 | **Confirmed** (8/8; 4.87 s here vs 17.72 s reported) |
| Write denied without both flags; static negative starts | **Confirmed**, with the E02-QA-2 caveat (the test uses an explicit empty secret) |
| Admin query with masked email; minimised responses; strict validation | **Confirmed** (strictness yes; error text not via sanitisation, E02-QA-1) |
| Idempotency conflict; 20 parallel retries → 1 row | **Confirmed** |
| Mixed 30/60 domain/MCP → 1 winner, 0 overlaps | **Confirmed**, and extended with real HTTP + MCP (160 rounds) |
| Email cap / channel cap incl. process restart and replay after cap | **Confirmed** |
| Sanitised real DB connection error | **Not re-run** (UNVERIFIED by me) |
| "Full integration suite three times remains" | Ran by me: **3 × 26/26** |

## 5. Findings
| ID | Severity | Label | Summary |
|---|---|---|---|
| E02-QA-1 | Low | **BLOCKER for the E02-6 final gate only** (criterion deviation; not blocking E02-4/5) | Schema-validation errors bypass `safeFailure` |
| E02-QA-2 | Low | IDEA | Minimal MCP subprocess env is not effective: Prisma auto-loads the project `.env` |
| E02-QA-3 | Low | IDEA | Idempotency keys are shared across web and MCP channels |

**E02-QA-1: schema-validation errors bypass the shared sanitisation.**
- Breaks: E02-3 "*Fel fångas av samma sanering.*" and the decision "*Fel följer befintligt MCP-kontrakt med isError och säker statisk text.*"
- Repro (`probes/p1-flags-validation.mjs`, `logs/probe-p1-flags-validation.log`): start the server with `--admin --allow-bookings`, then call `create_booking` with a valid payload plus `"clientAddress":"198.51.100.1"` → `isError:true`, text `Input validation error: Invalid arguments for tool create_booking: Unrecognized key: "clientAddress"`. Other cases return English Zod texts with field names and the regex `/^[A-Za-z0-9_-]+$/`.
- Impact: no PII, secrets or SQL leaked; 0 rows written. But the text is not static and not Swedish. It reflects client-chosen key names verbatim back to the model (a self-reflection injection channel, low risk), and it bypasses the single error policy.
- Fix direction: register the tool with a permissive input schema (or wrap the handler) and run `mcpBookingSchema.safeParse` inside `reply()`, so failures map through `safeFailure` → "Kontrollera uppgifterna" (or one static MCP message). Keep publishing the strict JSON schema for clients if the SDK allows separating the advertised schema from validation. Add a test asserting the exact static text for an unknown key, a wrong type and `confirmed:false`.

**E02-QA-2: the "minimal MCP subprocess env" is not effective; Prisma loads the project `.env`.**
- Related decision: "*Befintlig minimal subprocess-miljö ska inte ersättas av en kopia av hela miljön*"; "*saknad konfiguration ska neka start*".
- Repro (`logs/probe-env-proto.log`, `probe-secret-missing.log`, p1 case "both, no SESSION_SECRET"): start the server with cwd = project root, a `.env` containing `SESSION_SECRET`/`ADMIN_PASSWORD`, and env without them (`env -i PATH=… DATABASE_URL=…`). After the `@prisma/client` import, `process.env.SESSION_SECRET` and `ADMIN_PASSWORD` are defined, and `--admin --allow-bookings` starts (exit 0) and books. If `.env` lacks the secret, start is correctly refused (exit 1).
- Impact: no tool exposes env, so nothing leaks today. However `mcpEnvironment()` gives a false sense of isolation (the child gets every `.env` value), and Codex's negative test only covers an explicit `SESSION_SECRET=""`. This is pre-existing Prisma behaviour, not new in Epic 02.
- Fix direction: document it, or start the MCP child with a cwd that has no `.env`. Add a test with the secret unset and absent from `.env`.

**E02-QA-3: idempotency keys are shared across the web and MCP channels.**
- No criterion is broken (the plan requires same key/payload → same id).
- Repro (`logs/probe-p4-mixed.log` [X]): MCP books with `clientRequestId=K` → web `POST /api/bookings` with `Idempotency-Key: K` and the same payload → **201 with the MCP booking's id**; a different payload → 409. The reverse direction is also the same id; that row keeps the web clientKey and does not count against the MCP channel cap.
- Impact: keys are random UUIDs in practice, so this is low risk. It still couples channels, and anyone who knows a key plus the exact payload gets the booking id.
- Fix direction (Epic 02 backlog): namespace the stored key per channel (e.g. `mcp:` prefix) or include the channel/clientKey in the uniqueness, keeping current behaviour within a channel.

**Info (no action):**
- Changing `SESSION_SECRET` changes the MCP channel identity and its day cap (operator-controlled; stable with a stable secret as required).
- The rate bucket is process-local (resets per MCP process); the DB day cap persists.
- One misbehaving local agent can exhaust the shared channel (5/day, 30 attempts/15 min/process). This is a documented POC decision.
- Names accept newlines, control characters and instruction-like text. They are never returned through MCP; admin web rendering was not re-checked here.

## 6. Harness note (no product impact)
The first mixed web + MCP run returned 500 for all web calls. Cause: my own shell still exported a stale `DATABASE_URL` (port 55491, from the previous dc15023 session, DB stopped), which `node --env-file` does not override. I confirmed this with a scratch debug build (`debug/`, product code unchanged except a scratch-only log line). After `unset DATABASE_URL` the web server returned 200, and the run was repeated with valid results. The invalid run is kept as `logs/probe-p4-mixed-INVALID-stale-env.log`. All MCP probes always passed explicit env and were unaffected. No writes reached any other DB, because port 55491 was not running.

## 7. Missing tests (suggested)
1. Exact static error text for schema failures over stdio (E02-QA-1).
2. Booking mode with SESSION_SECRET unset in env *and* absent from `.env`, vs present only in `.env` (E02-QA-2).
3. Cross-channel idempotency key behaviour, documented or namespaced (E02-QA-3).
4. Real HTTP + MCP contention where MCP wins some rounds (Codex's mixed test uses domain calls, not HTTP).
5. A DST-boundary booking via MCP (e.g. first weekday after 2027-03-28 with `+01:00` vs `+02:00`). The schema accepts any offset and the instant is honoured; E02-5 asks for Stockholm display tests.

## 8. Housekeeping
- Web servers (3300, 3301) and all MCP child processes stopped; PostgreSQL 55501 stopped (`server stopped`); no listeners or processes remain. `pgdata`, `work/`, `debug/`, `xcheck/` and `rev/` are kept as scratch.
- Nothing committed, pushed, merged or deployed; no GitHub writes (one read-only `git fetch` into the scratch `xcheck/`). Nothing was run on or copied to the PC. Only my own synthetic `.env` files were used (no Codex `.env`, cookies or secrets). No demo, no full E2E.
