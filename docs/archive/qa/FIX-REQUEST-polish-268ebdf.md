# FIX REQUEST – UI polish 268ebdf (round 1 of max 2)

Revision under review: `268ebdfa3a1d42ef241e654bb2f511c96db8db9c` (ui/salon-polish). Full report: `QA-REPORT-polish-268ebdf.md` (Swedish).
Scope: CSS/TSX in the admin calendar and form controls only. No domain/API/MCP/auth/schema/dependency changes.

## 1. UP-QA-1 (Medium, BLOCKER) – hover expansion covers the next visit and steals its click
- Where: `src/app/workspace-polish.css:326-334` (`.calendar-booking:hover, .calendar-booking:focus-visible { z-index:6; min-height:82px; ... }`), `src/app/admin/calendar.tsx:369-373`.
- Repro: day view, one staff member, 5-min bookings at 10:00/10:05/10:10, 1440 or 1180 px. Hover 10:00, move the pointer down to the point where 10:05 was visible, and click. Result: 10:00's booking opens. Expected: 10:05.
- This breaks the brief ("expand instead of covering the next visit").
- Fix: do not grow the interactive card over neighbours on `:hover`. Options:
  - (a) show the details in a non-interactive tooltip/popover (`pointer-events:none`) positioned outside the column;
  - (b) keep the expansion only for `:focus-visible` (keyboard), which works fine today;
  - (c) give compact cards a real minimum height with collision-aware lanes so that nothing overlaps.
- Add e2e: hover 10:00, click 10:05's original centre, expect the 10:05 URL.

## 2. UP-QA-2 (Low, fix in the same round) – 5-min cards are 10 px targets
- Where: `calendar.tsx:369-373` (`Math.max(10, …)`), `workspace-polish.css:318-325`.
- Measured height is 10 px with a 12 px pitch at 1440/1180/1024. This fails WCAG 2.5.8 (24×24 or the spacing exception).
- Fix: compact cards ≥24 px, laid out side by side (lanes) or grouped when they are closer than 24 px. Keep the full aria-label/title.
- Add an e2e assertion that each card's height is ≥24 and that cards do not overlap.

## 3. Codex risk hypotheses (measured; include in the same round)
- **Admin inputs/selects are 14 px at 320/390/1440** (`workspace-polish.css:117,144,253,625`). Recommend `font-size:16px` below 768 px to avoid the iOS focus zoom. The zoom itself was NOT verified on Safari.
- **Calendar help summary is 166×36** (`workspace-polish.css:169`). Restore `min-height:44px`.
- **Checkboxes are 22×22** (`workspace-polish.css:146`). Restore 24 px.
  - The calendar label is 44 px tall (OK).
  - The **customers "Visa även arkiverade" label is 182×29** (`src/app/admin/customers/page.tsx:82-90`). Give it `min-height:44px; display:inline-flex; align-items:center`.

## Acceptance
- Full matrix stays green: unit 102, integration 125, cards 13, e2e 58 in each of the 4 modes, build, lint, tsc.
- New e2e tests for items 1 and 2.
- QA will re-run its own Chromium clicks (ux5) at 320/390/1024/1179/1180/1440.
