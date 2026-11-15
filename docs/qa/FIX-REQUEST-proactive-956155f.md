# Fix request – proactive capacity overview (956155f)

Consolidated, single request (max two fix rounds). Base: `956155fa0d7db70d5050990bba1490d52f546055`. Full QA: `QA-REPORT-proactive-956155f.md` (Swedish).

## 1. PRO-QA-1 (Medium) – limit of 10 hides actionable suggestions
- **Where:**
  - `src/lib/capacity.ts:191-204`: `listCapacity` takes `limit+1` cancelled sources ordered by time *before* projection, so decided, stale and passed sources use up the limit.
  - `src/app/admin/overview/overview.tsx:68-72`: tells the user "Fler finns i kalendern", but the calendar does not show suggestions, and the UI has no paging or `from` control.
- **Repro:**
  1. Have ≥ 10 dismissed, drafted, stale or passed cancellations early in the 7-day window.
  2. Cancel another slot later in the window.
  3. Open `/admin/overview`.

  Observed: 10 cards, 9 of them non-actionable; 2 actionable suggestions not reachable.
- **Expected:** actionable suggestions (`available && status==="new"`) are always reachable from the overview.
- **Fix direction (pick one):**
  - order actionable first;
  - or hide handled/passed by default with a "show handled" toggle;
  - or add cursor/`from` paging in API, MCP and UI.

  Keep strict schemas, auth-before-replay and no customer fields.
- **Tests:**
  - an integration test with 11+ sources where the 11th is actionable and must be returned or reachable;
  - an E2E or UI assertion that it is visible.

## Optional (only if trivial, not required)
- Give "Översikt" a distinct nav icon (`src/app/admin/header.tsx:28`).

Do not change dependencies or the lockfile. Re-run unit (memory), integration (postgres), lint, tsc, build and prod E2E, and report counts.
