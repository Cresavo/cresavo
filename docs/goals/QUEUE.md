# Goal queue

**Rule for agents:** take the topmost goal with status `open`, set it to
`in progress · <agent> · <branch> · <date>` and push that immediately (so nobody
else takes the same one). Work until "Done when" is met, set `done`, write in
PROGRESS.md and **take the next open one without asking**. If the queue is empty
or blocked: run the "Cleanup pass" at the bottom. Never stop just because a goal is done.

**Branches:** one agent at a time works directly on `concept/ai-native-demo`.
If two agents run at once: make `goal/<nr>-<shortname>` from the latest
`concept/ai-native-demo`, and merge back there when the goal is done
(never to `main`).

**Who:** `Codex` = well-specified UI and feature building and cleanup passes.
`Opus` = architecture, AI layer, move to a real backend, review.
`Both` = anyone. Always read CONCEPT.md for the big picture.

Shared "Done when" for all goals: lint, tsc, test and build green;
screenshots 390 px + 1280 px of new/changed views in `docs/concept/screens/`;
PROGRESS.md updated; side findings as issues with the label `finding`.
All UI text is English and goes through the dictionary (see AGENTS.md).

| # | Goal | Who | Status |
|---|---|---|---|
| 1 | Clickable demo night 1 ([file](../concept/CODEX_GOAL_NIGHT1.md)) | Both | done (step 5b delivered in goal 4) |
| 2 | The customer experience | Codex | in progress · Codex goal/codex-night2 (messages, reviews, widget) |
| 3 | Customers, journal and return visits | Claude (Sonnet) | done · 2026-11-17 |
| 4 | The marketing studio | Claude (Sonnet) | done · 2026-11-17 |
| 5 | Stock and purchasing | Claude (Sonnet) | done · 2026-11-17 |
| 6 | Finance and overview | Claude (Sonnet) | done · 2026-11-17 |
| 7 | The AI layer for real | Codex | in progress · goal/codex-night2 (BYOK, persisted costs, tool calls) |
| 8 | Support, log and "What happened?" | Both | open |
| 9 | Modules and industry packs | Claude (Sonnet) | done · 2026-11-17 |
| 10 | Open protocols for the concept | Opus | open |
| 11 | From demo to real engine | Opus | open |
| 12 | Pilot readiness: quality and security | Opus (Fable for review) | open |
| 13 | Open-source launch: clean public repos | Opus | open (can run any time after goal 1) |

---

## 2 · The customer experience

**Goal:** a customer who has never booked online understands immediately and books in under a minute.

- `/boka/salong-eko`: refine "What would you like to book?" (more phrasings,
  typos, "as soon as possible", "after work", "with Anna").
- The customer's own page via link: upcoming/past bookings, rebook with the
  same treatment, cancel with a clear rule ("free until 24 h before").
- Waiting list: "Notify me if something opens up" when fully booked; the owner
  sees it in Inbox and "Fill the gap" uses it.
- Reminders and confirmations as previews (SMS and email look), with a
  simulated "sent" log in Inbox.
- Review after the visit: 1–5 stars + text, shown on the salon's page after
  the owner's approval.
- Booking button/widget to embed on your own website (copy-code box in
  More → Settings) and a clean share link for an Instagram bio.

**Done when:** a test person can book, rebook, cancel, join the queue and
leave a review on mobile without instructions; everything shows up for the owner.

## 3 · Customers, journal and return visits

**Goal:** the customer card is the best place to understand a customer in five seconds.

- Customer card: AI summary at the top ("Regular since 2024, foot care every
  6 weeks, sensitive skin, prefers Anna, afternoons").
- Journal: voice input → structure (from goal 1), templates per service
  (foot care, massage), before/after images (demo images), version history.
- Return-visit engine: interval per service, list of "late" customers, one tap
  "send time suggestion" (simulated SMS with a ready link).
- Segments: "not been here in 3 months", "regulars", "new this year",
  "birthday this month" – used by the Marketing studio.
- Customer import from CSV (demo: example file) with preview.

**Done when:** open any customer → summary, history, journal and next
suggested visit are visible; a voice journal is saved and shows in the history.

## 4 · The marketing studio

**Goal:** from idea to a published campaign in all channels in two minutes.

- The campaign flow from CONCEPT.md: offer/holiday → text per channel →
  poster from template → preview per channel → publish/schedule.
- Poster templates: 4–6 styles, the salon's colours/logo/photos, export as PNG
  (formats: Instagram post, story, A4 for the shop window).
- Content calendar: month view with planned posts and holidays.
- Ads flow: budget, days, local area, expected reach (simulated).
- Results per campaign: reach, clicks, **bookings via the link**, revenue.
- "Today" suggests campaigns automatically (free slots + holiday + segment).

**Done when:** create a Father's Day campaign from the Today card → texts + poster
→ "publish everywhere" → the campaign shows simulated statistics and bookings.

## 5 · Stock and purchasing

**Goal:** the owner never needs to count jars.

- Products with balance, minimum level, supplier, purchase price.
- Consumption per treatment (foot care uses 1 portion of foot cream) that
  automatically reduces the balance when visits are marked done.
- Selling a product to a customer (no till: mark as "sold").
- Forecast: "runs out in about 9 days", purchase list to approve, simulated
  order to supplier (email draft).
- Goods in: scan/type in, or photograph the delivery note (demo: predefined).
- Proactive cards on Today.

**Done when:** mark a visit done → balance drops → warning on Today →
approve purchase list → goods in raises the balance.

## 6 · Finance and overview

**Goal:** "How is it going?" is answered on one screen.

- Overview: revenue (day/week/month/year), occupancy per person, popular
  services, cancellations/no-shows, new vs returning customers, compared with
  the previous period. Simple, nice SVG charts.
- Ask with the command box: "compare March with last year", "which service
  earns the most per hour?" → answer with a chart.
- Costs (rent, products, fees) entered simply → result.
- "Connect accounting": Accounted card (simulated connection, shows what
  would be synced), export SIE/CSV.

**Done when:** the Finance view and three questions via the command box give
reasonable answers from the demo data.

## 7 · The AI layer for real

**Goal:** all AI tasks run through one layer that gets better when the
models get better, and that handles own keys.

- Task registry (from goal 1 step 3b) with versioned prompts,
  JSON schemas and evaluation cases (example in → expected structure out).
- Router: tier → provider/model; OpenRouter, OpenAI, Anthropic; own
  key per business (BYOK) with encrypted storage in demo mode.
- Eval script `npm run ai:eval` that runs all cases against the chosen model and
  shows accuracy, time and cost, so model changes can be judged with numbers.
- The cost log is persisted and shown per task/month.
- The command box uses tools/function calls instead of free text.

**Done when:** `npm run ai:eval` passes with the rule-based variant and with at
least one real key; switching the model for a task is done in one place.

## 8 · Support, log and "What happened?"

**Goal:** one person can support hundreds of salons. See CONCEPT.md
"Operations, logging and support".

- Event log in the store: who (human/AI/integration), what, before/after.
  A "What happened?" view with filters and **Undo**.
- Trash for deleted bookings/customers (30 days).
- Help button: AI answers from a small knowledge base (`docs/help/*.md`, write
  10–15 articles), "show me" that highlights the right button, and "create ticket"
  that bundles a screenshot, request id and recent events.
- Support mode: time-limited access that the owner grants and sees in the log.
- Structured server logging with request id in `/api/concept/*`.

**Done when:** change something via AI → it shows in "What happened?" → undo works;
the help button answers 5 common questions.

## 9 · Modules and industry packs

**Goal:** the same core fits more industries; you only pay for what you switch on.

- Module registry: each module (Journal, Stock, Marketing, Finance, Reviews,
  Waiting list, AI assistant) has a manifest: name, description, menu items,
  Today cards, AI tasks, price (demo).
- The Features page shows modules as cards with on/off and price.
- Industry packs: Foot care/massage, Hairdresser, Nails, PT, Clinic – words,
  default services, journal templates and modules. Switch pack in the demo → the
  app adapts (words, menus, demo data).
- Onboarding: "What kind of business do you have?" → 3 questions → ready setup.

**Done when:** switch to the Hairdresser pack → services, words and menus change;
turn off Stock → it disappears everywhere.

## 10 · Open protocols for the concept

**Goal:** the concept's data and actions can be reached by external AIs. See CONCEPT.md
"Open protocols".

- A shared tool registry for the concept's actions (the same ones the
  command box uses).
- MCP server (HTTP) exposing read tools for everything + write tools that
  create **proposals** the owner approves in the app.
- A2A card and USP profile for customer booking.
- "Your data & AI" shows status per protocol + instructions for Claude
  Desktop/Code and ChatGPT.
- Reuse patterns from the existing `src/mcp` and `/api/v1` (mandate,
  idempotency), but do not connect to Prisma yet.

**Done when:** Claude Code can list today's bookings via MCP and create a
move proposal that shows up in Inbox and can be approved.

## 11 · From demo to real engine

**Goal:** the best parts of the concept run against a real database and the
existing booking engine.

- Map: which concept parts have counterparts in `src/lib/domain.ts`,
  Prisma and `/api/v1`, and which are missing. Write the plan in `docs/goals/`.
- Replace the store layer with an API layer behind the same interface (flag:
  demo mode stays). Start with bookings, customers, services, staff.
- New tables via additive migrations for journal, stock, campaigns, log.
- Keep double-booking protection, idempotency and quotas; test against a `_test` DB.

**Done when:** `/studio` in real mode books/moves against Postgres with the
same UI, and demo mode still works.

## 12 · Pilot readiness: quality and security

**Goal:** everything in the "Pilot gate" of `docs/QUALITY_SECURITY.md` is
done or has an explicit, documented decision. Run after goal 11.

- Work through the checklist section by section; each item ends as done
  (with test/evidence), or as an issue labelled `later` with a reason.
- Add tenant-isolation tests, permission tests and end-to-end tests for the
  critical journeys listed there.
- Enable secret scanning and code scanning; fix high/critical findings.
- Write the incident/breach runbook and do one backup restore drill.

**Done when:** every pilot-gate checkbox is ticked or linked to an issue,
and an independent review (Fable or external) has signed off in REVIEW.md.

## 13 · Open-source launch: clean public repos

Name and repo structure are decided in `docs/BRAND.md` (Flerdo, org `flerdo`,
monorepo `flerdo/flerdo`). This goal also does the one-pass rename of code,
UI and package names from Booking Lab to Flerdo.

**Goal:** booking-lab-se (and later the gateway) can be made public without
embarrassment or risk, and gets the free security tooling public repos have.

Recommended structure: **one public monorepo** (`apps/web`, `packages/gateway`
from booking-lab-gateway, `packages/ai`, `docs/`) instead of separate public
repos: one CI, one CLA, one changelog and release, no cross-repo version pin.
Paid/private services (e.g. a "Connect" service for SMS, payments, social
publishing) stay in separate private repos.

Recommended path: publish a **new public repo with fresh, short history**
(squashed from the cleaned tree) and keep the current repo private as the
archive. Niclas decides the name and flips visibility; agents never do.

- Secrets: scan the full history of the tree being published with a proper
  scanner (gitleaks or trufflehog) in CI. A first pattern scan on
  2026-11-16 of both repos' full history found no keys (only false positives).
- Content: remove or move out internal docs (`docs/history/`, old epic/QA
  reports, Swedish internal notes, personal names beyond the copyright
  line). Keep a short English `docs/` that matches the code.
- Front door (all English): README with what/why/screenshots/quick start,
  LICENSE (AGPL-3.0, plus an extension exception like Accounted if we want
  proprietary add-ons), CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant),
  SECURITY.md (private vulnerability reporting), issue and PR templates.
- Contributor agreement: a standard **CLA** (individual + entity, based on
  the Apache/Harmony templates) enforced by the CLA Assistant GitHub app on
  every PR. Text reviewed by a lawyer before launch.
- Security tooling to switch on (free for public repos): secret scanning
  with push protection, CodeQL code scanning, Dependabot alerts and updates,
  private vulnerability reporting, branch protection on `main` (PR + green
  CI required), OpenSSF Scorecard.
- Data: confirm no real customer data anywhere (fixtures are synthetic,
  avatars generated), and that demo/seed data is clearly fictional.

**Done when:** a checklist in `docs/OPEN_SOURCE_LAUNCH.md` is fully ticked,
the cleaned tree builds and tests green from a fresh clone, and Niclas has
approved making it public.

---

## Cleanup pass (when the queue is empty or blocked)

Take open issues labelled `finding` (then `ux`, `bug`), smallest first.
One issue = one commit that references `#nr`. Close the issue with a short
comment on what was done. If you find new things: new issue, not
scope creep. Well suited to a cheap/fast model.
