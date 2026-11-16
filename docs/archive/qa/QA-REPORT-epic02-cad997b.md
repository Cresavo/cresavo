# QA report: Booking Lab SE Epic 02, final gate + re-check of fix round 1

Reviewer: Booking Lab QA (Grok Bot). 2026-11-12, 01:34–01:44 Europe/Stockholm (CET). Read-only, box only.
- Run folder: `/workspace/qa/booking-lab-se/run-cad997b/`; paths below are relative to it.
- Database: own embedded PostgreSQL 18.6 on 127.0.0.1:**55521**, DB `booking_rfc_test`. Synthetic data only.
- Nothing was run on Niclas's PC.
- Codex's DB 55448 and work repo were not used. No product code changes, commits, pushes or deploys.

## Verdict
- **Epic 02: PASS, can be closed as a local POC.** No open blocking findings.
- E02-QA-1 is fixed and verified. E02-QA-2 and E02-QA-3 are honestly documented, and QA-3 is tested and reproduced.
- E02-4, E02-5 and E02-6 meet their plan criteria in my own environment.
- **No FIX-REQUEST.** The new findings E02-QA-4…6 are Low/Info IDEAs; none breaks a criterion in a way that needs the last allowed fix round.
- **Pilot remains NO-GO**, for the known pilot blockers that Epic 02 does not address:
  - npm audit 3 high / 7 moderate
  - individual admin accounts / MFA
  - customer GDPR lifecycle
  - real TLS / proxy
  - process isolation (QA-2)
- External GitHub CI: **NOT RUN** (no push).

## 1. Revision confirmation
- **Archive:** `src/booking-lab-epic02-cad997b.zip`
  - sha256 `0b70b4386ce659f409c04ab0292846ae3a1273086b9ec51d544ba14e24d4601e`, which matches 0B70B438…4601E.
  - The ZIP comment is `cad997b9562e54b0cd6919277683f425fbacc389`.
  - Files are CRLF; I normalised them to LF in `norm/tree` before diffing.
  - The PowerShell patch was not used.
- **Tree diff vs my fc83a70 tree** (`logs/tree-diff-fc83a70-cad997b.txt`, `code-diff-src.diff`, `code-diff-tests.diff`, `code-diff-pwdemo.diff`):

  | Area | Change |
  |---|---|
  | Code | Only `src/mcp/booking.ts` (adds `mcpBookingToolSchema`), `src/mcp/server.ts` (uses it), `src/mcp/client.ts` (`--book` confirmation mode, no `--env-file` for child) |
  | Tests | `tests/e2e/flow.spec.ts` (+2 tests), new `tests/format.test.ts`, new `tests/integration/mcp-client.test.ts`, formatting + stricter assertions in `tests/integration/mcp-booking.test.ts` and `tests/mcp-booking.test.ts` |
  | Config | `playwright.demo.config.ts` (demo grep) |
  | Docs | Rest of the diff, plus new `docs/EPIC_02_QA_FOLLOWUP.md` and `docs/qa/*` |

- **Unchanged vs fc83a70:**
  - **package.json, package-lock.json, prisma/ (schema + 3 migrations), scripts/: identical.** No new deps or migrations.
  - `.env.example`, `.gitignore` and `LICENSE` differ only by CRLF.
  - `mcpBookingSchema` and the domain schema are unchanged, so the rules were not loosened.
- **Commit-level claim** ("7a65aee and cad997b are docs-only, code = 3cd633b"): **UNVERIFIABLE at commit level.** No Epic 02 git history is available to me (the branch is not on GitHub; my xcheck clone only has dc15023).
  - Tree-level it is **consistent**: the whole fc83a70→cad997b code delta is exactly what EPIC_02_QA_FOLLOWUP / HANDOFF attribute to c568b8a…3cd633b.
  - HANDOFF, PROJECT_STATUS and VERIFICATION point to 3cd633b (code) and 7a65aee (demo).

## 2. Full matrix (my runs, `logs/summary.log`, `matrix.sh`)
| Step | Result | Codex claim |
|---|---|---|
| npm ci | PASS, 462 packages, `10 vulnerabilities (7 moderate, 3 high)` | not run by Codex (states so honestly) |
| prisma generate / migrate deploy (3) / seed | PASS | ✓ |
| lint / tsc (+ tsc again after the suite) | PASS / PASS / PASS | ✓ |
| unit | **43/43**, 7 files | 43/43 ✓ |
| integration ×3 | **30/30, 30/30, 30/30** (~12 s each) | 30/30 ×3 ✓ |
| E2E dev, TRUST_PROXY_IP=0 / =1 | **12/12** (24.5 s) / **12/12** (21.9 s) | ✓ |
| build (production) | PASS, 8/8 static pages | ✓ |
| E2E prod, TRUST_PROXY_IP=0 / =1 | **12/12** (14.1 s) / **12/12** (14.6 s) | ✓ |
| cleanup probe | `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS` | ✓ |
| DB after matrix + all probes | Booking 0 / Campaign 0 / AdminSession 0 / overlaps 0 / `pg_stat_database.deadlocks` 0; **0 "deadlock detected"** in `pg.log` | ✓ |
| npm audit | **FAIL as expected: 3 high / 7 moderate / 0 critical** (unchanged baseline, not green) | ✓ |

- **pg.log ERROR lines:** the 13 lines are the intended negative tests (exclusion `booking_no_overlap`, `campaign_valid_dates`) plus one from my own counter query.
- **Counter query:** `db-count` returned rc=1 in the summary because "overlaps" is a reserved word in my SQL alias. I fixed the alias and reran it; it is not a product issue.

## 3. Per plan item / criterion
| Item | Criterion (plan) | Status | Evidence |
|---|---|---|---|
| **E02-QA-1 fix** | "Fel fångas av samma sanering" / "isError och säker statisk text" | **PASS** | `logs/probe-q1-validation.log` |
| QA-1: schema reuse | Strict schema still advertised | **PASS** | The published `inputSchema` is **byte-identical to fc83a70** (live listTools from both servers): `additionalProperties:false`, required = all 6 fields. `validate()` = `mcpBookingSchema.parse` → throws `safeFailure(e).message`. The SDK (2.4.0 `tools/call`) catches it and returns `createToolError(message)`. No SDK patch; node_modules come from the unchanged lockfile. |
| QA-1: SDK-client cases | Exact static text, 0 writes | **PASS 22/22** | Every case returned exactly `[{type:"text",text:"Kontrollera uppgifterna"}]` + isError, with **0 rows**: unknown keys (`clientAddress`, `channel`, unicode key `kundnamn✓`); wrong types; `confirmed` false / "true" / 1 / missing; 65-char / missing / `åäö` clientRequestId; other domain / suffix trick / IDN domain; 2027-02-30; no offset; nested object; `{$gte}` operator; array serviceId; 1,000,000-char name; `{}` |
| QA-1: raw JSON-RPC cases | — | **PASS 10/16; 6 outside the tool** | Exact static text + 0 rows for: arguments absent, `__proto__` supplying `confirmed`, `constructor.prototype`, `prototype`, `client\u0041ddress` escape, duplicate `confirmed` (true→false), 5 MB extra value (246 ms), 10,000 extra keys, 5,000-deep nesting in an extra key or in customerName. Exceptions: non-object `arguments` → SDK protocol error (E02-QA-5); own `__proto__` + valid → booked (E02-QA-4). After the pollution attempts, a call without `confirmed` is still rejected, so no prototype pollution. Positive control booked OK. MCP server stderr empty. |
| **E02-QA-2** | Documented, no false isolation claim | **PASS** | ARCHITECTURE §9 ("**Det är inte miljöisolering**"), DATA_FLOWS, PRIVACY_SECURITY. My probe: the server child's OS env during the `--book` prompt = `DATABASE_URL, HOME, NEXT_TELEMETRY_DISABLED, PATH, SESSION_SECRET` (no ADMIN_PASSWORD, no parent canaries `QA_CANARY_TOKEN`/`AWS_SECRET_ACCESS_KEY`). Prisma `.env` autoload remains as documented. |
| **E02-QA-3** | Shared namespace documented + tested | **PASS, reproduced 6×** | README ("Nycklar delar samma befintliga namnrymd som HTTP") and ARCHITECTURE. In each of my 6 mixed runs (`logs/probe-q4-mixed-web-mcp.log` [X]): MCP key K → HTTP `Idempotency-Key: K`, same payload → **201, same id**; changed payload → **409** "Bokningsnyckeln har redan använts med andra uppgifter."; reverse direction → same id. |
| **E02-4** | 20 identical keys → 1 row | **PASS** | Integration test (×3) |
| | Mixed HTTP/MCP 30/60 → exactly 1 winner, no 500 / overlap | **PASS** | Codex's new real-HTTP/MCP E2E test ran in all 4 modes × desktop/mobile (8 runs). My own probes, production server on :3300 (`probe-q4-mixed-web-mcp.log`): **160 rounds / 3,200 calls** (10 HTTP from distinct source IPs + 10 MCP per round, web delay 0/10/25/40/60/90 ms) → exactly 1 winner every round (web 121, MCP 39), **0 HTTP 500, 0 overlaps**, losers HTTP 400 / MCP isError "Tiden är inte tillgänglig", web/MCP stderr empty. MCP-only (`probe-q3-mcp-concurrency.log`): 30 same-slot + 30 overlap rounds × 20 calls on 2 MCP processes → 60 OK / 1,140 "Tiden är inte tillgänglig", 0 bad rounds, max 228 ms, 0 overlaps. |
| | Busy/past/closed time refused | **PASS** | Integration tests. Also verified at fc83a70; the domain is unchanged. |
| | Caps (4th per email, 6th per channel, replay after cap, restart can't reset) | **PASS** | Integration test (×3). Domain and server unchanged since my fc83a70 probe verification. |
| **E02-5** | Default client makes no booking | **PASS** | `probe-q2-client.log`: tools `list_services, get_availability`; 0/0 rows. `--admin` without `--book` = existing campaign-draft flow, 0 bookings. |
| | Summary + explicit "ja" before create_booking; no/EOF → 0 writes | **PASS** | The summary is shown before the prompt (`Testbokning: Fotvård` / `Tid: 2026-11-13 09:00 (Europe/Stockholm)` / `Kund: Syntetisk MCP-testkund (example.test)` / key). **0 writes** for: `nej`, EOF, empty line, `j`, `yes`, `ja!`, `jaa`, `nej\nja`, stdin closed up front. **1 write** for: `ja`, `JA`, `  ja  `, `ja`+EOF without newline, `ja` piped before the prompt (see E02-QA-6). `--book` without `--admin` → exit 1 `MCP_CLIENT_FAILED`, 0 writes. |
| | Client prints no customer data / secrets | **PASS** | No email, SESSION_SECRET, ADMIN_PASSWORD, DB URL or canary in stdout/stderr for any case. |
| | Ja → booking visible in admin with Stockholm time, email masked | **PASS** | E2E "lokal MCP-bokning visas i skyddad admin med Stockholmstid" passed in 4 modes × 2 projects. Demo PNGs confirm it (§5). The DB row of my "ja" run has Stockholm local start 09:00, matching the summary. |
| | Summer/winter conversion tested | **PASS** | Unit `format.test.ts` (3 cases). My own `probe-q5-dst.log`: 10/10 formatter cases incl. both DST days (2027-03-28 01:59 CET/03:59 CEST; 2027-10-31 02:30 CEST and CET). Slot generation: 2027-03-26 first 08:00Z → 2027-03-29 07:00Z; 2027-10-29 07:00Z → 2027-11-01 08:00Z; DST Sundays 0 slots. The admin's `dateStyle:"full"` format agrees in every case. |
| **E02-6** | All final criteria pass or are reported as blocked | **PASS** | §2. External CI correctly marked NOT RUN. Audit reported as FAIL, not as green. |
| | Status/handoff point to the tested commit | **PASS** | 3cd633b (code) / 7a65aee (demo); cad997b = docs snapshot (tree-consistent, see §1) |
| | One final demo showing the MCP booking in admin; state whether video was reviewed | **PASS (evidence)** | §5 |
| DoD | No unauthorized write path; no raw insertBooking from the tool | **PASS** | Code: `create_booking` → `createBooking(v, v.clientRequestId, MCP_BOOKING_CLIENT)`; registered only under `--admin` + valid `--allow-bookings`. |

## 4. Codex claims
- **Confirmed:**
  - lint / tsc / build PASS
  - unit 43/43; integration 30/30 ×3; E2E 12/12 in all four modes
  - cleanup PASS with Booking/Campaign/Session/overlap/deadlocks 0
  - audit FAIL 3 high / 7 moderate
  - package / lockfile / migrations unchanged
  - QA-1 exact static text for the 6 named cases; strict schema kept, no SDK patches or looser rules
  - QA-2 documented without an isolation claim; QA-3 documented and tested
  - new 20-call real HTTP/MCP regression; E02-5 yes/no/EOF; read-only default client; shared formatter summer/winter; MCP → admin desktop/mobile
- **Contradicted:** none.
- **Unverifiable:**
  - the per-commit split (no git history)
  - Codex's Windows timings and its 55448 DB
  - the demo videos (not delivered to me)
  - the root cause of the first 18b2ac5 demo FAIL
  - the "4/4" count: the manifest has `status: PASS`, `.last-run.json` `passed` / `failedTests: []` and 4 flow folders, but no explicit count field.

## 5. Demo evidence (`src/demo-2026-11-12T00-27-19-502Z-png.zip`, unpacked in `demo/`)
- **manifest.json:** `revision 7a65aeec341820442effe68a77a1ea978050a0b0`, `dirty: false`, `status: PASS`, `build: production`, `startedAt 2026-11-12T00:27:19.502Z` (= 01:27 CET). It lists 14 PNG + 4 WebM; the PNGs are present, the WebMs are not included by design.
- **Images I viewed:**
  - 07 desktop/mobile: "måndag 16 november 2026 kl. 09:00 · Fotvård · Syntetisk agentkund Anna/Erik · \*\*\*@\*\*\*"
  - 03-bekraftelse desktop: "2026-11-17 09:00 (Europe/Stockholm)"
  - 04-admin mobile: "Testkund Erik · \*\*\*@\*\*\*", campaign draft
- **Assessment:** synthetic names only, emails masked, times correct (16 Nov = CET, first slot 09:00), SEK prices, no dev badge.
- **Gaps:** I did not review the videos. `index.html`'s intro text still describes only the campaign-draft MCP flow (stale wording, cosmetic).
- **Known flaky risk:** the first full demo on 18b2ac5 failed 1/4 at the desktop `page.screenshot` (hung after "fonts loaded" until the 60 s test timeout), after its functional checks had passed. Codex's targeted diagnostics passed. The root cause is **unknown and not claimed fixed**. I have no failing artifacts, so I cannot add anything. This is recording-reliability only: the functional E2E matrix passed 4×12 for me.

## 6. Findings
| ID | Severity | Label | Summary |
|---|---|---|---|
| E02-QA-1 | Low | **CLOSED (fixed, verified)** | Schema errors now static "Kontrollera uppgifterna" via safeFailure |
| E02-QA-2 | Low | CLOSED as documented limitation / **known pilot blocker** (process isolation) | Prisma `.env` autoload |
| E02-QA-3 | Low | CLOSED (documented + tested, accepted POC decision) | Shared web/MCP idempotency namespace |
| E02-QA-4 | Low | IDEA | Own `__proto__` key silently dropped, booking accepted |
| E02-QA-5 | Info | IDEA | Non-object `arguments` → SDK protocol error with English Zod text (not isError/static) |
| E02-QA-6 | Info | IDEA | Confirmation accepts `ja` piped in before the summary is shown |

**E02-QA-4: an own `__proto__` key in the arguments is silently dropped rather than rejected.**
- **Repro:** raw stdio `tools/call` `{"name":"create_booking","arguments":{<valid>,"__proto__":{"isAdmin":true}}}` → a booking is created (`probe-q1-validation.log`).
- **Cause:** the SDK's request-envelope parse (`arguments` as a Zod record) rebuilds the object before the tool schema runs, so the own key disappears.
- **Impact:** no pollution. A following call missing `confirmed` is still rejected, and `__proto__:{confirmed:true}` cannot satisfy `confirmed`. Same behaviour as fc83a70.
- **Criterion:** literally deviates from README "Okända fält nekas" / E02-1 "okända fält … avvisas" for this one key name. Not a security or integrity issue, so not blocking.
- **Fix direction (optional):** a one-line README note, or leave it.

**E02-QA-5: malformed envelope errors come from the SDK, not the tool contract.**
- **Repro:** `arguments` = `null` / `[]` / `"x"` / `42` → JSON-RPC error `-32602 "Invalid tools/call request: [ { expected: record, … received string } ]"`. An unknown tool returns `Tool <name> not found` (echoes the tool name).
- **Leak check:** no argument values are echoed (markers checked, `probe-q1b-envelope.log`); no PII or secrets. A conforming client cannot send these.
- **Scope:** this is protocol-level, before any tool, and shared by all tools. The plan's "isError och säker statisk text" concerns tool errors, so I don't count it as broken.
- **Related:** DATA_FLOWS already notes that the older tools' SDK validation errors can still reflect input.
- **Fix direction (backlog):** none needed for the POC; consider it if remote MCP is ever in scope.

**E02-QA-6: the test client's confirmation can be satisfied by input given before the summary is shown.**
- **Repro:** `printf 'ja\n' | npm run mcp:client -- --admin --book` → 1 booking. `JA` / `  ja  ` / `ja` without newline are also accepted (trim + lowercase).
- **Plan:** "kräver ett uttryckligt ja" is met, since `ja` is explicit, and the plan itself states `confirmed` "inte tekniskt bevis på mänskligt samtycke".
- **Fix direction (optional):** require a TTY for `--book` or document non-interactive use.

**Other info (no action):**
- The autumn DST hour displays identically for two instants (02:30). That day is a Sunday and closed, so no booking can hit it.
- The admin uses its own `dateStyle:"full"` formatter, not `formatBookingTime`; both agree in every case I tested.
- The demo's MCP booking is created by the E2E's direct SDK client, not via `--book`. The `--book` path is covered by the integration tests and my probe.

## 7. Missing tests (non-blocking suggestions)
1. A raw-envelope regression for `__proto__` / non-object arguments, documenting E02-QA-4 and E02-QA-5.
2. Non-TTY input to `--book` (E02-QA-6), if the team wants to forbid it.
3. A formatter test that includes the DST transition days themselves (mine passed; current unit cases are adjacent weekdays).

## 8. Housekeeping
- **Stopped:** production web server (:3300); Playwright web servers (:3000, auto-stopped); all MCP / client child processes; PostgreSQL 55521 (`server stopped`).
- **State check:** 0 remaining processes; no listeners on 3000/3300/55521; final DB 0/0/0, 0 overlaps, 0 deadlocks.
- **Kept:** `pgdata`, `work/`, `norm/` and `demo/` remain as scratch.
- **Other:** no commits, pushes, merges, PRs, GitHub writes or deploys; no new deps. Only my own synthetic `.env` in `work/`; no Codex `.env`, cookies or secrets were read or copied. No new demo recording. Nothing was run on the PC.
