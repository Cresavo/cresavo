# Progress · AI-native demo

## 2026-11-17 · Codex · night 2 part 1: AI settings, tools and saved usage

**Done**: encrypted per-business BYOK (OpenRouter/OpenAI/Anthropic), provider
priority over platform keys, remove/replace key, Fast/Smart per-task selector,
persistent usage with task/month totals. Command interpretation now requests one
structured proposal tool call and validates it before the existing approval UI;
rules remain available on provider/schema failure and with no keys. Offline evals
ignore saved keys. Eight new edge cases cover every task (36 total).

**Try it**: `/studio/more/data`. Set `CONCEPT_KEY_SECRET` (32+ private random
characters) on the server to enable the key form. Data lives in gitignored
`.data/concept-ai/`; preserve the secret across restarts. Only provider and last
four characters return to the browser. The demo uses a server-selected fictional
business and local single-process storage; production authentication/storage is
still future work.

**Verified**: lint, tsc, 748 unit tests, production build (synthetic database URL,
no connection), 36/36 offline evals. Every task also runs through all three mocked
provider transports. Disk, tampering/wrong-secret, business isolation and HTTP
validation tests pass. Browser → settings API → encrypted file → reload and
remove/restore rules passed at 390 and 1280 px, without a real provider call.
Screenshots: [mobile](screens/night2-ai-390.png) · [desktop](screens/night2-ai-1280.png).

**Remains**: real-key verification (no key available); goal 7 retains that explicit
pending item. Side finding: development dependency audit advisories filed as #12.

## 2026-11-17 · Claude Code · goal 4: campaign studio (also goal 1 step 5b)

**Done**

- **Campaign studio** `/studio/more/campaigns/new`, four steps: Offer (opens
  pre-filled) → Texts (one per channel: Instagram, Facebook, TikTok, newsletter,
  SMS, from `write-post`, rules first, AI draft replaces untouched texts, length
  counters and limits) → Poster (5 styles, 2 salon photos, editable text, formats
  Instagram post / story / A4 window poster, client-side PNG export) → Publish
  (preview as it looks in each channel, **Publish everywhere** or **Schedule**).
- **Campaign page** `/studio/more/campaigns/<id>`: trackable link, simulated
  reach, clicks, bookings via the link and revenue, reach per channel, poster
  downloads, the texts that went out, and **Run as ad** (budget, days, local area,
  estimated reach; adds to the results).
- **Content calendar** (month view with holidays and planned posts) on the
  Campaigns page, next to the list of coming holidays.
- **Entry points**: Today holiday card ("Make a campaign"), a new Today card for
  a quiet day ("Tuesday has 5 free hours"), and the command box: "make a
  Father's Day campaign", "make a poster for Christmas", "20% off massage all of
  March" open the studio pre-filled.
- Tests: channel copy limits, link and stats simulation, ad estimate, prefill
  parsing and studio address, store actions, calendar grid, quiet day, poster
  layout (`tests/concept-campaigns.test.ts`).

**Try it**: `/studio` → holiday card → Make a campaign; or type "make a Father's
Day campaign" in the command box.

Screenshots (390 / 1280, replace the size): [Today](screens/campaign-today-390.png) ·
[command](screens/campaign-command-390.png) · [1 offer](screens/campaign-1-offer-390.png) ·
[2 texts](screens/campaign-2-texts-390.png) · [3 poster](screens/campaign-3-poster-390.png) ·
[4 publish](screens/campaign-4-publish-390.png) (previews: `campaign-4-preview-facebook|tiktok|newsletter|sms`) ·
[result](screens/campaign-result-390.png) · [run as ad](screens/campaign-ad-390.png) ·
[with ad](screens/campaign-result-ad-390.png) · [list + calendar](screens/campaign-list-390.png).

**Remains**: results are a first-week snapshot at publish time, not updated daily;
no real publishing, ads or link tracking (simulated); Father's Day 2026 has passed
so the Today card shows the next holiday (the command box finds Father's Day 2027);
AI-written texts were verified with mocks only.
## 2026-11-17 · Claude Code (Sonnet) · goal 3: customers, journal and return visits

**Done**

- **Customer card**: one-line summary on top (new `summarize-customer` AI task,
  tier fast, rule fallback, 2 eval cases; the rule text shows at once and the AI
  wording replaces it when a key exists), plus a Next visit card (booked time, or
  due date with a one-tap "Send time suggestion").
- **Return-visit engine** (`src/concept/customers/return-visits.ts`): interval per
  service (editable steppers on **Customers > Due back**), journal "next visit"
  notes can override it, overdue list, suggested free time with the preferred
  person near their usual hour. Sending adds a simulated SMS with a link to
  `/boka/salong-eko?service=...` to the Inbox log. Today's recall card now links here.
- **Segments** (`customers/segments.ts`, exported for the marketing studio): not seen
  in 3 months, regulars, new this year, birthday this month. Used as Customers filters.
  Demo customers now have birthdays (demo data version 5).
- **Journal**: templates per treatment type, before/after demo photos, edit with
  version history (earlier wording stays visible), journal notes in History.
- **CSV import** (Customers > Import): mapping with guessed columns, preview with
  skipped rows (duplicates, missing name or phone), example file
  `public/demo/customers-example.csv`.
- Fixed #9 (structure-journal fallback misfiled "skin"/"nail" treatment sentences).
- Tests: summary fallback, segments, interval engine, CSV, journal versions, store
  actions (27 new) plus a #9 regression and eval cases.

**Try it**: `/studio/customers` (filters, Import), `/studio/customers/due-back`,
any customer card > Journal.

Screenshots (390 / 1280, replace the number): [card](screens/customers-card-390.png) ·
[due back](screens/customers-due-back-390.png) · [sent](screens/customers-due-back-sent-390.png) ·
[inbox log](screens/customers-inbox-log-390.png) · [segments](screens/customers-segments-390.png) ·
[journal form](screens/customers-journal-form-390.png) · [versions](screens/customers-journal-versions-390.png) ·
[dictated](screens/customers-journal-dictated-390.png) · [history](screens/customers-history-390.png) ·
[import](screens/customers-import-390.png).

**Remains**: real-key check of `summarize-customer`; photos are picked from demo
images only; per-customer intervals; sending to everyone due in one tap.

## 2026-11-17 · Claude Code · command box, voice and AI section in the studio

**Done**

- **Command box** (top of every `/studio` page): the rule parser answers
  instantly (label "Quick parse"); when the server has an AI key the
  `interpret-command` task replaces it a moment later (label "AI"). The result
  is a proposal card with before/after, **Approve / Edit / Cancel**; Approve
  dispatches the existing store action and shows the usual undo toast. Taken
  times turn into up to three tappable alternatives. Questions answer inside
  the card: earnings as a number plus bars per treatment, lapsed customers as a
  list. Clarifying questions become tappable choices (treatments, days,
  day parts, discounts, matching customers). Empty box shows three example
  prompts built from real demo data. Enter sends, Esc closes.
- **Voice**: browser `SpeechRecognition` (`en-GB`) on the mic in the box and a
  floating mic on phones above the tab bar; hidden where unsupported.
- **Voice journal** (customer → Journal → Dictate entry): dictate or type →
  `structure-journal` (works without a key) → editable fields → save, or
  "Save and book in N weeks" which opens the booking sheet near that date.
- **More → Your data & AI**: the seven AI tasks with tier and provider/model
  (or "Rules"), cost log from the new `GET /api/concept/ai`, and a demo "Add
  your own key" form that says it stores nothing.
- Tests: intent context, intent → proposal mapping and clarifying choices,
  AI overview, USD formatting, next-visit interval parsing (23 new tests).

**Try it**: `/studio` → click the box or a chip; `/studio/customers` → open a
customer → Journal → Dictate entry (type into "What happened" to simulate);
`/studio/more/data`.

Screenshots (390 / 1280): command box
[empty](screens/command-empty-390.png) ·
[move](screens/command-move-390.png) ·
[stock order](screens/command-stock-390.png) ·
[earnings answer](screens/command-answer-390.png) ·
[customers answer](screens/command-customers-390.png) ·
[clarifying choices](screens/command-clarify-390.png); journal
[dictation](screens/journal-dictation-390.png) ·
[structured](screens/journal-review-390.png); AI section
[Your data & AI](screens/data-ai-390.png). Replace `390` with `1280` for desktop.

**Remains**: real-key check of the AI path (mocked only); speech cannot be
screenshotted headless, so voice was verified by code and the typed fallback;
make-poster only links to Campaigns; cost log is process-local.
## 2026-11-17 · Claude Code · goal 1 step 5/6 and goal 2: the customer page

**Done**
- `/boka/salong-eko`: salon hero (photo, rating, open now), the "What would you
  like to book?" box, classic choose treatment, time, details flow, prices,
  recent reviews, opening hours and address. Mobile first, light and dark.
- The box reads free text ("foot care some afternoon next week with Anna", typos,
  "after work", "as soon as possible") through the studio interpreter's date and
  name matching (`src/concept/booking/request.ts`) and offers three varied times.
- Confirmation page `/boka/salong-eko/booking/<id>` with Add to calendar (.ics),
  Reschedule and Cancel. Rule: free until 24 h before, then "call us".
- "My bookings" `/boka/salong-eko/me?ref=<customer id>`: upcoming, earlier visits,
  Book again, cancel and reschedule. No login: the link carries the reference, or
  the customer types their phone number (the page shows a demo number to try).
- Waiting list "Notify me if something opens up" on full days and when nothing
  matches. It lands in the owner's Inbox with a drafted reply and marks the
  customer as waiting-list (used by "Fill the gap").
- Bookings, moves and cancellations show up in `/studio` (same store) and as
  Inbox items. Landing page `/` links to both demos.

**Try it:** `npm run dev`, open `/boka/salong-eko`, book, then open `/studio/inbox`.
Screenshots: `docs/concept/screens/booking-*-390.png` and `-1280.png`
(home, suggest, details, confirmed, reschedule, cancel, mine, classic, waitlist, owner inbox).

**Remains (goal 2):** SMS/email previews with a "sent" log, reviews after a visit,
embed widget and share link, more phrasings.

## 2026-11-17 · Codex · goal 7 headless evaluations

- Continued on `goal/7-ai-evals` from the latest concept branch, carrying the
  completed engine commits forward. Added `npm run ai:eval`: 25 fixed-clock,
  fictional scenarios covering all seven tasks; rules mode passes 25/25 with
  no network or API cost, even if keys are configured. `--task <name>` filters
  cases and `--json` exports accuracy, timings, safe model/token/cost metadata.
- Added 39 evaluation tests, including mocked live success, fallback counted
  as failure, unknown costs, private-error redaction and CLI behavior. No live
  provider calls made. Full verification: 620 tests, lint, TypeScript and production build pass. Integration: `src/concept/ai/README.md`.
- Goal 7 remains in progress: evaluation tooling is delivered; real-key
  verification, encrypted BYOK storage, persisted cost history and UI/function
  calling integration remain. Reserved UI/data/store/i18n files are unchanged.

## 2026-11-17 · Codex · intent/AI engine and cleanup

- Night 1 steps 3/3b engine is ready: rule-based English intent interpreter, seven versioned AI tasks, JSON schemas, provider router, fetch adapters, bounded in-memory cost log and `POST /api/concept/ai/[task]`. No UI, fixture/store changes or new dependencies. No keys used; provider tests mock fetch.
- Wire the UI with `interpretCommand(text, context)` and `IntentContext`/`IntentResult` from `src/concept/intent`. Map fixture fields into that context, display the proposal/question, and apply approved actions through the store. Calculate free slot suggestions and revenue/segment answers from fixtures. All date-range ends are exclusive.
- For AI, POST each task's input object directly; response is `{ output, log }`. Import `tasks`/`TaskName` from `ai/registry.ts` to inspect contracts, and `runTask()` or `getCostLog()` on the server. Browser code uses HTTP. Integration details, tier overrides and cost limitations: `src/concept/ai/README.md`. PUBLIC_READONLY blocks POST by the existing policy.
- Cleanup: no queued goal fits wholly within the allowed areas. Finding #6 fixes mixed fixture clocks and freezes legacy test dates; no pages changed. Verification: 568 tests pass (86 intent, 57 AI plus existing suites), lint and TypeScript pass. Production build passes in database-free PUBLIC_READONLY mode; normal build verification uses an inert synthetic database URL. A real HTTP request against the production server also returned a zero-cost rule fallback. Real-key testing remains for later; no screenshots apply to engine-only work.
Senaste överst. Varje post: datum, vem, klart, prova så här, kvar.

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
