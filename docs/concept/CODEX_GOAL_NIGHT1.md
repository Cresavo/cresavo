# Codex goal prompt · night 1 · clickable AI-native demo

Copy everything below the line into Codex. Start in the booking-lab-se repo on branch
`concept/ai-native-demo` (fetch it first: `git fetch && git checkout concept/ai-native-demo`).

---

You are building a clickable, living demo of an AI-native salon system. Read
`AGENTS.md` and `docs/concept/CONCEPT.md` first – they are the whole brief.
Do not read other docs unless you need them for something concrete.

## Goal for the night

Tomorrow Niclas should be able to open `/studio` and `/boka/salong-eko` on mobile and
desktop, click around everywhere, see realistic data and try the command box –
and get a clear feel for the whole system. Not everything has to be real,
but everything visible must react (buttons do something, proposals can be approved
and then show up in the calendar/list).

## Work in this order. Commit and push after each step.

First read `docs/concept/PROGRESS.md`. If Claude or someone else has already
done a step: continue from there, do not rebuild what exists.

1. **Foundation**
   - `src/concept/data/` – fixture data per CONCEPT.md "Demo data"
     (salon, staff, ~40 customers, services, bookings relative to today's date,
     6 months of history, stock, reviews, inbox, holiday calendar).
     Generate deterministically (seeded random) so it looks the same every time.
   - `src/concept/store.ts` – client state (React context + `localStorage`,
     try/catch) with actions: move/cancel/create booking, change price,
     create campaign, add journal entry, adjust stock, mark inbox read.
     "Reset demo" button in More → Settings.
   - `src/concept/i18n/en.ts` – every user-facing string lives in a per-area
     dictionary with a small `t()` helper, so Swedish (`sv`) can be added later
     without touching components. Dates en-GB, 24h clock.
   - Design system in `src/concept/ui/`: calm, warm, modern salon feel.
     Large tap targets (min 44 px), clear typography, soft cards, one accent
     colour, light and dark mode. Mobile first. Icons from the existing lucide-react.
   - Customer avatars as generated SVG (initials, pastel). Reuse images in
     `public/demo/` for salon/services.

2. **The owner's app `/studio`** with layout: bottom tabs on mobile
   (Today · Calendar · Customers · Inbox · More), side menu on desktop.
   - **Today**: timeline, next customer, proactive cards (gaps, stock, holiday,
     late return visits), today's revenue, a "Someone is calling" button (phone mode).
   - **Calendar**: day and week view, staff filter, tap for details,
     move via dialog (drag and drop on desktop if time allows).
   - **Customers**: search, customer card (image, contact, history, notes,
     journal tab, "book again"), marker for late return visits.
   - **Inbox**: requests/rebookings/reviews, reply with one tap.
   - **More**: Services & prices, Staff, Stock, Campaigns (with
     holiday calendar + poster suggestions as a generated HTML/SVG poster),
     Finance (revenue per month/service/person as simple charts – SVG, no
     new dependency), Reviews, Features (modules on/off that hide menu items),
     Your data & AI (shows the MCP connection with a copy button + export button
     that downloads JSON/CSV of the demo data), Settings.

3. **The command box** – a component at the top of all `/studio` pages
   plus a floating microphone button on mobile.
   - `src/concept/intent/` – rule-based interpreter (weekdays, "today",
     "tomorrow", "next Tuesday", times, customer names with fuzzy match,
     service names, percent/price). Returns `{action, params, summary}`.
     Cover all examples in CONCEPT.md + variants. Write vitest tests for the interpreter.
   - The result is shown as a **proposal card**: what changes before/after,
     buttons Approve / Change / Cancel. Approve runs the store action and shows
     a short confirmation with "Undo".
   - Questions ("what have I earned…", "which customers…") are answered with a number,
     list or small chart in the card.
   - Speech: the browser's `SpeechRecognition` with `lang = "en-GB"`; hide
     the microphone gracefully if it is missing.
   - Optional AI mode: `src/app/api/concept/intent/route.ts` uses
     `OPENAI_API_KEY` if present (fetch against OpenAI, no new SDK required),
     asks for the same JSON structure and falls back to the rule interpreter.
     Show a small label "AI" or "Quick parse" on the card.

3b. **The AI layer** (see CONCEPT.md "AI architecture") in `src/concept/ai/`:
   - `tasks/` – one file per task (`interpret-command`, `structure-journal`,
     `write-post`, `suggest-campaign`, `stock-forecast`, `reply-customer`,
     `daily-summary`) with prompt, JSON schema for the answer, model tier
     (`fast`/`smart`/`image`/`speech`) and a rule-based fallback.
   - `router.ts` – tier → provider + model. Reads `OPENROUTER_API_KEY`,
     `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` on the server. OpenAI-compatible
     fetch client (works against OpenRouter and OpenAI); Anthropic via its own
     small adapter. No new dependencies.
   - `api/concept/ai/[task]/route.ts` – runs the task, validates the answer against
     the schema, falls back to the rule variant, logs task/model/
     estimated cost (in memory, shown in More → Your data & AI).
   - More → Your data & AI: show which tasks exist, which tier/model
     they run, "Add your own key (OpenRouter/OpenAI/Anthropic)" as a
     demo form (not actually saved), and the cost log.

4. **Voice journal** on a visit/customer card: "Dictate journal" →
   transcription (SpeechRecognition, or `api/concept/transcribe` with
   OpenAI if a key exists) → structured note (treatment, observations, advice,
   suggested next visit) → edit → save.
   Without a key: simple rule-based structuring of the text.

5. **The customer page `/boka/salong-eko`**: salon image, info, reviews,
   services. At the top the box "What would you like to book?" → three time suggestions as cards →
   name + phone → confirmation (add to calendar, rebook, cancel).
   Classic 3-step flow as an alternative. The booking then shows up in `/studio`
   (same `localStorage` store) and as a new item in Inbox.

5b. **Campaign studio** (More → Campaigns): choose an offer or
   holiday suggestion → text per channel (Instagram, Facebook, TikTok, newsletter,
   SMS) from `write-post` → poster from template (salon photo + text + price,
   2–3 styles) → preview as it looks in each channel → "Publish
   everywhere"/"Schedule" (simulated) → the campaign gets a trackable link and
   simulated statistics (reach, clicks, bookings via the link).
   "Run as ad" button with budget/days/local area (simulated).

6. **Start page**: add clear links to `/studio` and
   `/boka/salong-eko` from `/` (small change, touch nothing else there).

## Quality

- `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` must
  be green before you stop. Add tests for the interpreter and the store actions.
- Run the app and take screenshots (Playwright is available) of every new page, 390 px
  and 1280 px, into `docs/concept/screens/`.
- No console errors. No horizontal scrollbars on mobile.
- All UI text in English, via the dictionary. All AI proposals are marked as proposals.

## When you are done (or time runs out)

Update `docs/concept/PROGRESS.md`: what is done, how to try it,
screenshots, what remains, and your own suggestions for improvements.
Commit and push. No deploy, no merge to main.
