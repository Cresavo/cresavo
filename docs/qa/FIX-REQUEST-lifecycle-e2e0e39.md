# Fix request – customer lifecycle (e2e0e39), fix round 1 of max 2

Consolidated, single request. Base: `e2e0e398de683823ffa962a4c669085f9800b6f2`. Full QA: `QA-REPORT-lifecycle-e2e0e39.md` (Swedish).

## LC-QA-1 (Medium) – contact removal leaves the raw e-mail in `Booking.emailCapKey`
- **Where:**
  - `src/lib/customer-data.ts:224-233`: the `updateMany` scrubs only `customerName`/`customerEmail`.
  - `src/lib/domain.ts:293,362`: `emailCapKey` is the lower-cased e-mail without the +tag, in clear text, for non-admin channels, including local MCP `create_booking` with `customerId`.
- **Contradicted claims:**
  - UI `src/app/admin/customers/data-panel.tsx:145-147`: "e-post … samt kontaktkopior i kopplade bokningar ersätts".
  - `docs/CUSTOMER_LIFECYCLE_AGENT_PLAN.md:36`: remaining quota keys are "hashade".
- **Repro:**
  1. Create customer `x@example.test`.
  2. Local MCP `--admin --allow-workspace` `create_booking` with `customerId`.
  3. Make the visit past, then preview and confirm contact removal.
  4. `SELECT "emailCapKey" FROM "Booking" WHERE "customerId"=…` → `x@example.test`.
- **Expected:** after a confirmed removal, no linked booking contains the original address in any column, or the UI and docs say explicitly that it does.
- **Fix direction (pick one, no new feature):**
  - (a) In the removal transaction, replace `emailCapKey` on linked rows with an HMAC (SESSION_SECRET) of the key, or NULL for rows created before today. The cap only counts the creation day, and removal already requires no upcoming visits.
  - (b) Store `emailCapKey` as an HMAC for new bookings, so that "hashed quota keys" is true. This is an additive data change with a migration only if needed; keep the lock order and the cap semantics.
  - (c) If the owner deliberately keeps the raw key, correct the UI text and the plan/PRIVACY docs so they state it.
- **Tests:** an integration test that creates linked bookings via HTTP admin and local MCP, removes the contact, and asserts that the original address/name does not occur in any Booking column, plus the existing invariants (version/events/capacity source unchanged).

Do not change dependencies or the lockfile, and do not touch other epics. Re-run unit (memory), integration (postgres), lint, tsc, build and prod E2E, and report counts. Info items in the report remain backlog.
