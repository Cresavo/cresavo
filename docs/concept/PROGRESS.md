# Progress · AI-native demo

Newest first. Each entry: date, who, done, how to try it, what remains.

## 2026-11-16 · Claude Code · goal 1, steps 1–2: foundation and the owner app

**Done**

- **Demo data** (`src/concept/data/`): Salong Eko in Vasastan, Anna (owner,
  medical foot therapist) and Erik (massage therapist), 9 treatments, 360
  fictional customers of whom 40 are regulars with notes and journals,
  6 months of history and about 70% booked for the next 3 weeks, 15 stock
  items (urea foot cream and unscented massage oil nearly out), ~3 reviews a
  week, 8 inbox items (request, reschedule, cancellation today, reviews,
  gift card question, new customer, reminders) and a Swedish holiday
  calendar with campaign ideas. Generated deterministically relative to
  today's date. *Deviation:* the concept said ~40 customers; 40 customers
  cannot fill a 70% calendar, so there are 40 regulars plus occasional
  customers.
- **Store** (`src/concept/actions.ts`, `store.ts`): one pure reducer for every
  change (move/cancel/create booking, price, campaign, journal, stock, inbox,
  reviews, notes, modules), kept in `localStorage`, with undo (toasts have
  "Undo") and "Reset demo". A new day regenerates the data.
- **i18n** (`src/concept/i18n/`): all UI text in `en.ts` through `t()` and
  `tc()` (plurals). Add `sv.ts` with the same keys to translate. Dates en-GB,
  24h clock.
- **Design system** (`src/concept/ui/`): calm warm palette with one sage
  accent, light and dark mode via CSS tokens (`src/app/studio/studio.css`),
  44 px touch targets, sheets (bottom sheet on phones, dialog on desktop),
  chips, switches, simple SVG/CSS charts, generated initials avatars.
- **Owner app `/studio`**: bottom tabs on phones, sidebar on desktop.
  - *Today*: earned so far, bookings, free slots, next customer card
    (visits, note, last advice), suggestion cards (free slots → offer to
    waiting list, unanswered inbox, low stock, customers due back, next
    holiday), timeline with free gaps, and **Someone is calling** (find the
    caller, see free times, book or move in two taps).
  - *Calendar*: day and week, staff filter, tap a free spot to book, drag a
    booking to move it (desktop), booking sheet with move (before/after) and
    cancel (with "offer the slot to the waiting list").
  - *Customers*: search, filters (regulars, due back, not seen in 10+ weeks,
    new), customer card with contact, stats, notes, history, journal (write
    entry; "Dictate entry" is a placeholder), book again, "send a hello".
  - *Inbox*: unread state, filters, drafted replies; requests and reschedules
    come with a live free slot that is booked/moved when you send.
  - *More*: services & prices (edit price), staff, stock (± and order
    draft), campaigns (holiday calendar, create campaign, template poster in
    3 styles), finance (month/treatment/person), reviews (reply), features
    (switching a module off hides it from the menu), your data & AI (MCP
    address and config to copy, JSON/CSV export, protocol status), settings
    (salon details, opening hours, reset demo).
- Tests: `tests/concept-data.test.ts`, `concept-actions.test.ts`,
  `concept-export.test.ts`.

**Try it:** `npm run dev`, open `/studio` on phone width and desktop. Tap
"Someone is calling", open a booking in the calendar and move it, send a
reply in Inbox, switch off Stock under More → Features, then More → Settings →
Reset demo.

**Screenshots** (390 px / 1280 px, Today at 10:40):
[Today](screens/today-390.png) / [desktop](screens/today-1280.png) ·
[Calendar day](screens/calendar-390.png) / [desktop](screens/calendar-1280.png) ·
[Calendar week](screens/calendar-week-390.png) / [desktop](screens/calendar-week-1280.png) ·
[Customers](screens/customers-390.png) / [desktop](screens/customers-1280.png) ·
[Customer card](screens/customer-390.png) / [desktop](screens/customer-1280.png) ·
[Inbox](screens/inbox-390.png) / [desktop](screens/inbox-1280.png) ·
[Inbox reply](screens/inbox-reply-390.png) / [desktop](screens/inbox-reply-1280.png) ·
[More](screens/more-390.png) / [desktop](screens/more-1280.png) ·
[Services](screens/services-390.png) / [desktop](screens/services-1280.png) ·
[Staff](screens/staff-390.png) / [desktop](screens/staff-1280.png) ·
[Stock](screens/stock-390.png) / [desktop](screens/stock-1280.png) ·
[Campaigns](screens/campaigns-390.png) / [desktop](screens/campaigns-1280.png) ·
[Finance](screens/finance-390.png) / [desktop](screens/finance-1280.png) ·
[Reviews](screens/reviews-390.png) / [desktop](screens/reviews-1280.png) ·
[Features](screens/features-390.png) / [desktop](screens/features-1280.png) ·
[Your data & AI](screens/data-390.png) / [desktop](screens/data-1280.png) ·
[Settings](screens/settings-390.png) / [desktop](screens/settings-1280.png) ·
[Phone mode](screens/phone-mode-390.png) · [Booking sheet](screens/booking-sheet-390.png) ·
[Move booking](screens/move-booking-390.png)

**Left for Codex (goal 1, steps 3–6)**

- Command box: replace `src/concept/command/command-slot.tsx` (already at the
  top of every page via `PageHeader`) with the intent parser and suggestion
  cards; add the floating mic button on phones. Approving should call
  `dispatch()` from `src/concept/store.ts` with the existing actions, and
  toasts already support "Undo".
- AI layer (`src/concept/ai/`, `/api/concept/...`), voice journal (the
  "Dictate entry" button in `src/concept/studio/customers/journal.tsx`),
  campaign studio (extend More → Campaigns), the AI tasks/cost section in
  More → Your data & AI, customer page `/boka/salong-eko`, links from `/`.

**Findings**

- `tests/public-readonly-ux.test.ts` (2 tests) and `tests/two-track-demo.test.ts`
  (1 test) fail on the base branch too when the Stockholm date differs from
  the UTC date (late evening UTC): they expect `2026-11-16` but get
  `2026-11-17`. Not touched.
- The root layout's demo banner and language switch are hidden inside
  `/studio` (the studio shows "Demo · fictional data" itself).

## 2026-11-16 · Claude Code · plan and cleanup

- Done: concept plan (`CONCEPT.md`), new short `AGENTS.md` (old one archived
  in `docs/history/`), goal prompt for Codex night 1 (`CODEX_GOAL_NIGHT1.md`).
- Try it: nothing to click yet.
