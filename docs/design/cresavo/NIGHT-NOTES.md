# Night notes, 18 November 2026

Branch `design/libovo-brand-v09`. Continues 852242a (neutral text on tints,
Today time column, module presets) and 16ff37a (host routing, landing, waiting
list). Nothing was merged or deployed.

## What changed

**Read-only public demo.** Built with `NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1
NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com` and run with
`PUBLIC_READONLY=1`, then walked on 390 px and 1280 px.

- Broken before: "Structure entry" in the journal and the Help answer both
  POST to `/api/concept/ai/*`, got 403 and showed an error. Each AI task
  already carries a rule fallback, so the browser now runs it when the build
  is the public demo (no request at all) or the server answers 403.
- The Data page no longer offers what cannot work there: assistant connection
  steps, the server reset and the own-key form are replaced by one note; model
  tiers are read-only.
- Everything else (book by phone mode, move, cancel, assistant commands,
  campaigns, stock, feature presets, booking page including a completed
  booking, gift cards, reviews, waiting list) already lived in the browser
  store and works with no failed request and no console error.

**Assistant** (from `docs/design/ASSISTANT-AUDIT.md`).

- Plain name "Assistant", no persona. Secondary placement: a quiet labelled
  pill above the tabs on phones, the header button and Ctrl/Cmd+K on desktop.
  The panel opens at the message box, placeholder "Who is coming today?".
- Removed: sparkles everywhere in the studio, "Rules · no AI" badges, the
  brief and routine offer inside the panel, automatic conversation summaries.
- Answered now (audit rows 1, 2, 5, 7, 10, 12, 15, 17, 27 and the three
  "plausible wrong answer" cases): who is next, a customer's next appointment,
  the last visit, free times for a treatment, price and duration, gift card
  balance, Inbox, due back, a running-late text, the right day for "on
  Friday" and "yesterday", a stated discount.
- Declined honestly, with a link to where it is done (rows 11, 14, 16, 18 and
  "close early"): timed blocks, no-shows, journal notes, waiting-list adds,
  part-day closures.
- New code: `src/concept/assistant/lookups.ts`; tests in
  `tests/concept-assistant.test.ts` ("read questions", fixed clock).

**Polish.** Today shows one suggestion at a time and no routine offer. The
Features page has Essentials and Everything chips. Remaining same-hue text on
tints is neutral. The tenant booking page was only touched for that rule.

## Screens

In `screens/`, deviceScaleFactor 2, from the read-only production build:
`landing`, `coming-soon`, `studio-today`, `features-presets`,
`assistant-answering`, `booking-page` (each `-mobile` and `-desktop`) and
`booking-confirmed-mobile`.

## Gates

`npm run lint`, `npx tsc --noEmit`, `npx vitest run` (84 files, 1268 tests)
and `npm run test:concept` (68 passed, 2 skipped by design, axe checks
included) pass. The e2e suite was also run against the read-only production
build: the only failures there are the two that need a writable server (an
outside AI proposing over MCP, and the `localhost` address test).

## What remains

- Audit items not done (effort L): recovery list after "Erik is sick" (6),
  specific waitlist and recall targeting (7), timed blocks and visit outcomes
  as real actions (8). Row 9 ("in six weeks", "anything later?") and row 26
  (a "mornings only" note steering suggestions) are still partial.
- Poster and booking-page commands still live in the global assistant; the
  audit suggests moving them into their editors. Read-aloud is still a toggle
  in the panel header rather than a preference.
- A free-time answer offers "Book <name> at …" for the customer the
  conversation is about; without one it only lists times and links to the
  calendar.
- The public demo cannot show an outside assistant connecting (MCP needs a
  writable server); the Data page says so.
- The server's 403 body is Swedish (`src/lib/public-readonly.ts`, outside the
  concept code); nothing in the studio shows it any more.
- `docs/BRAND.md` still describes the earlier names and "Ask Flerdo"; it needs
  the owner's decision before it is rewritten.
- `screens/booking-page-desktop.png` and the two landing shots are above the
  usual 400 kB because of the 2x scale.
- The demo data has no gift cards sold, so the balance answer is only seen
  after selling one.
