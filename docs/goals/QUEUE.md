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
| 2 | The customer experience | Codex | done · 2026-11-17 |
| 3 | Customers, journal and return visits | Claude (Sonnet) | done · 2026-11-17 |
| 4 | The marketing studio | Claude (Sonnet) | done · 2026-11-17 |
| 5 | Stock and purchasing | Claude (Sonnet) | done · 2026-11-17 |
| 6 | Finance and overview | Claude (Sonnet) | done · 2026-11-17 |
| 7 | The AI layer for real | Codex | done · 2026-11-17 (live-key check pending) |
| 8 | Support, log and "What happened?" | Claude (Sonnet) | done · 2026-11-17 |
| 9 | Modules and industry packs | Claude (Sonnet) | done · 2026-11-17 |
| 10 | Open protocols for the concept | Opus | done · 2026-11-17 |
| 11 | From demo to real engine | Opus | open |
| 12 | Pilot readiness: quality and security | Opus (Fable for review) | open |
| 13 | Open-source launch: clean public repos | Opus | ready for launch; owner steps in docs/LAUNCH_CHECKLIST.md |
| 14 | Everyday operations: hours, schedules, rooms, roles | Claude (Sonnet) | done · 2026-11-17 |
| 15 | Gift cards, packages, daily summary, calendar feeds, one brand constant | Claude (Sonnet) | done · 2026-11-17 |
| 16 | The Flerdo assistant: conversation, memory, routines, proactive briefs | Claude (Opus) | done · 2026-11-17 |
| 17 | Your booking page: own address and own design | Claude (Sonnet) | done · 2026-11-17 |
| 18 | Libovo brand v0.9 implementation ([guide](../design/LIBOVO.md)) | Claude (Opus) | done · 2026-11-17 (assistant name pending owner decision) |
| 19 | Phone answering (voice receptionist) | Opus | open |
| 20 | Email for every business (inbox + send from own domain) | Opus | open |
| 21 | Languages: English source, generated Swedish, tenant locale | Sonnet | open |
| 22 | Campaigns people want to share + social media connections | Opus | open |
| 23 | Pricing, modules and billing (open core) | Opus | open |
| 24 | Own domain onboarding ([exploration](../explore/OWN_DOMAIN.md)) | Opus | proposal · awaiting Niclas's priority |
| 25 | Calm settings: home, search, six groups ([exploration](../explore/SETTINGS_IA.md)) | Codex | proposal · awaiting Niclas's priority |
| 26 | Salon site template on the whole domain ([exploration](../explore/WEBSITE_SERVICE.md)) | Claude (Sonnet) | proposal · awaiting Niclas's priority |
| 27 | Done-for-you move-in ([exploration](../explore/WEBSITE_SERVICE.md)) | Claude (Sonnet) | proposal · awaiting Niclas's priority |
| 29 | International by default and an open-source best-practice baseline | Opus | open · after the QA fixes, before goal 28's UI |
| 28 | Connections: Cresavo-managed or bring your own provider | Opus | open · after the desktop redesign and the QA fixes |

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

**Status 2026-11-18: ready for launch; owner steps in [docs/LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md).**
The repository is published in place under the Cresavo name (no new org or
monorepo for now); the plan below is kept as history.

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

## 14 · Everyday operations: hours, schedules, rooms, roles

**Goal:** the owner can run the real week: when the salon is open, who works
when, which room or chair is used, and what each person may see.

- Opening hours per weekday, lunch/breaks, closed days and holidays (with the
  Swedish holiday calendar as a suggestion), editable in Settings.
- Staff schedules: a weekly template per person plus exceptions (vacation,
  sick day, extra shift); free times everywhere respect them.
- Resources: rooms/chairs/equipment per service; bookings cannot double-book a
  resource; calendar can filter by resource.
- Roles in the demo: switch between Owner and Staff view. Staff see their own
  calendar, customers they serve and journal; no finance, settings or modules.
- Command box: "Anna is off on Friday", "close the salon on 24 December",
  "Erik works Saturday 10–14" create proposals.

**Done when:** mark Anna off Friday → her free times disappear on the customer
page and her bookings that day show a "needs moving" card; Staff view hides
finance.

## 15 · Gift cards, packages, daily summary, calendar feeds, one brand constant

**Goal:** common revenue tools and daily rhythm without building a till.

- Gift cards: sell (amount, recipient, message, code), print/share a nice card,
  redeem against a booking, balance check on the customer page.
- Packages/punch cards: e.g. "5 massages for the price of 4", sold to a
  customer, visits deducted automatically when a booking is marked done.
- Daily summary at closing: the `daily-summary` task turns the day into a short
  note (revenue, visits, no-shows, journals missing, tomorrow's first
  customer); Today shows it after the last booking.
- Calendar feeds: per staff ICS subscription URL (read-only, secret token in
  the URL, no customer contact details) to add the work calendar to Google or
  Apple Calendar.
- Brand: the product name lives in one constant (`src/concept/brand.ts` plus the
  i18n dictionary) and every user-facing mention uses it, so a rename is one edit.

**Done when:** sell a gift card and redeem it on a booking; sell a punch card
and see a visit deducted; the evening summary appears; the ICS URL returns a
valid calendar; changing the brand constant changes the name everywhere.

## 16 · The Flerdo assistant: conversation, memory, routines, proactive briefs

**Goal:** a colleague, not a chatbot. The owner can talk to their own assistant
about the business (by voice or text), it remembers what matters, learns
routines and speaks up on its own, and it can only propose changes.

Inspiration: Hermes Agent (Nous Research, MIT): plain-text memory, full-text
recall with summaries, skills as `SKILL.md` (agentskills.io) refined through
periodic self-review. Borrow the pattern; do not embed Hermes.

- **Two modes of "Ask Flerdo":** the quick command box stays for one-shot
  commands; a Flerdo button opens the assistant panel (full screen on phones,
  side panel on desktop) for multi-turn conversation with voice. On phones the
  big inline box is replaced by the button (resolves #18).
- **Conversation engine:** multi-turn threads, answers grounded in live data
  via the shared tool registry (`src/concept/tools`), rich replies (numbers,
  charts, lists, proposal cards with Approve). Follow-up questions resolve
  "her", "that day", "the same as last time" from the thread.
- **Memory:** per business: facts and preferences ("Anna never before 10",
  "Lena prefers Erik"), summarised past threads, searchable. Captured when the
  owner says "remember…" and proposed (not silently saved) when the assistant
  notices something. Page "What Flerdo remembers": view, edit, forget. Never
  store journal/health text or contact details in memory.
- **Routines (skills):** when the assistant sees a repeated pattern it proposes
  a routine ("prepare Monday reminders for overdue customers"). Routines are
  stored as small SKILL.md-style records (name, when, steps, tools), can be
  switched on/off, and run on their schedule producing proposals.
- **Proactive briefs:** morning brief, closing brief, weekly review and event
  reactions (cancellation, low stock, upcoming holiday) appear as messages in
  the panel and as cards on Today. Rules decide what matters (cost 0); AI only
  phrases and prioritises.
- **Models:** per task tier: rules first, cheap model for briefs/routines,
  smart model on demand; BYOK incl. OpenRouter; any OpenAI-compatible base URL
  (e.g. local Ollama) via `CONCEPT_AI_BASE_URL`. Every call in the cost log.
- **Works without a key:** a rule-based conversation fallback answers the
  common questions and commands, clearly labelled.

**Done when:** open the panel by voice or button, ask "how did last month
compare with last year?", then "send an offer to the customers who haven't
been here since summer" → proposal → approve; say "remember Lena prefers
Erik" → appears in What Flerdo remembers and is used next time Lena is
booked; the morning brief appears on Today; a suggested routine can be
switched on. All without an API key (rules), and with mocked AI in tests.

## 17 · Your booking page: own address and own design

**Goal:** every business gets its own booking address and can make the booking
page look like theirs, without breaking the booking flow.

Address:
- Level 1 (exists): `/boka/<slug>`.
- Level 2: subdomain `<slug>.<product domain>`; the business picks the slug in
  Settings (validated, unique, reserved words blocked).
- Level 3: own domain (e.g. `boka.salongeko.se`): Settings shows the exact DNS
  record (CNAME) to add and a status (waiting for DNS / verifying / secure).
  Simulated in the demo; a server module wraps the Vercel Domains API behind a
  flag and env vars, off by default, with mocked tests.
- Host → business resolution in one place (Next.js proxy/middleware or route
  helper), tested; unknown hosts get a friendly page.

Design:
- Theme: logo, colours (with automatic contrast check), font pair from a short
  list, photos, corner style; live preview.
- Sections: hero, treatments, staff, reviews, gallery, map, FAQ, Instagram
  link, gift cards; add, remove, reorder; a few style options each.
- Say it: "make it calmer and more luxurious", "put reviews first", "use the
  colours from our logo" → the assistant proposes a page-config change with a
  before/after preview; approve to apply. AI edits the page config only.
- Advanced: scoped custom CSS for the booking page (sanitised, no JavaScript,
  no external URLs except images), and the existing embed widget/API for
  businesses that keep their own website.
- The booking flow itself (times, details, confirmation) keeps fixed structure
  and accessibility; themes only change look and the surrounding sections.

**Done when:** pick a subdomain and see it resolve in a test; start the
own-domain flow and see the DNS instruction and status; change theme and
sections with live preview and see `/boka/<slug>` change; ask the assistant
for a calmer look and approve it; custom CSS cannot inject scripts (tested);
axe shows no violations with the default and one custom theme.

## 19 · Phone answering (voice receptionist)

**Goal:** when the salon is busy, calls are answered, questions handled and
bookings proposed or made, and everything lands in the Inbox.

- Simulated first in the demo: incoming call → transcript, summary, intent,
  proposed booking → Inbox item with Approve / Call back.
- Real path behind a flag: 46elks number with forwarding (busy / no answer /
  closed) → realtime voice pipeline (Pipecat, BSD-2) → our tool registry
  (same tools as Ask and MCP). Owner chooses: answer questions only, propose
  times, or book directly. Recording only with caller consent.
- Cost per minute shown in the AI cost log; paid module.
- See docs/OPEN_SOURCE_BUILDING_BLOCKS.md.

## 20 · Email for every business

**Goal:** each business receives and sends email inside the product.

- Inbound: `<slug>@inbox.<product domain>` plus forwarding from the business's
  own `info@` address; messages appear in the Inbox with drafted replies.
- Outbound from the business's own domain (confirmations, replies) after a
  DNS guide (SPF/DKIM/DMARC) with status checks, like the own-domain flow.
- Templates with React Email (MIT) in the tenant's brand.
- Full mailboxes via a partner (Google Workspace, Zoho), not our own server.
- Provider with per-tenant domains (e.g. SES tenants, Postmark); simulated in
  the demo, real provider behind a flag.

## 21 · Languages without maintaining Swedish by hand

- English (`en.ts`) stays the source. `npm run i18n:sync` translates new or
  changed keys into `sv.ts` with a cheap model, a glossary (do-not-translate:
  product and tenant names; fixed terms like Booking → Bokning) and a tone
  guide; unchanged keys are never re-translated.
- CI: same keys and placeholders in every locale; missing keys fall back to
  English; strings marked `review` (customer booking flow, confirmations,
  reminders, primary buttons) are listed for human review.
- Studio language per user (default: browser). Public booking pages, SMS and
  email follow the business's locale. Dates, times and money via Intl.

## 22 · Campaigns people want to share + social media connections

- Designer-made templates (not AI-generated layouts) per format and channel,
  using the business's brand, real photos and safe zones; AI writes copy only.
  Automatic quality checks (contrast, text amount, legibility at feed size).
- One-tap share, link previews (OG images per campaign), trackable links,
  results back on the campaign (reach, clicks, bookings).
- Connections: start with a publishing provider (Postiz as a separate AGPL
  service, or a paid API) for Instagram/Facebook/TikTok/LinkedIn/Google
  Business Profile; direct platform APIs later (Meta app review etc.).

## 23 · Pricing, modules and billing (open core)

- Self-hosting stays free (AGPL). The hosted service is the product: low base
  price, switchable modules, usage-based extras at transparent cost
  (SMS, phone minutes, AI calls; BYOK lowers the price), no booking
  commission.
- "Connect" services that need contracts and keys (numbers, SMS, email,
  social, payments) are what self-hosters also pay for.
- Billing via a payment provider (e.g. Stripe Billing), module switches tied to
  subscription items, usage metering from the existing cost log.
- Protect the name with a trademark; AGPL makes copies share changes; the CLA
  keeps dual licensing possible.


## 24 · Own domain onboarding (proposal)

**Goal:** an owner connects `boka.<their domain>` in three guided steps
without breaking email, and the server maps it safely. See
`docs/explore/OWN_DOMAIN.md`.

- Three-step flow (address, add one record, we connect it) with live status
  "Waiting for DNS" / "Checking your address" / "Secure connection ready",
  background polling, a Today card and Inbox message when ready.
- A fourth state for Vercel's TXT challenge, showing the record to add.
- Ownership proof: a per-business TXT record checked before a host is mapped.
- Our own DNS lookup for specific errors ("points to X") and to name the DNS
  provider; a read-only hand-off link with the records.
- Directory backed by storage instead of the fixture, cached for the proxy.
- Stays behind `CONCEPT_DOMAINS_ENABLED`; going live needs real login first.

**Done when:** in tests (mocked Vercel and DNS), a subdomain goes through all
states including the TXT challenge; a second business cannot claim the same
host; the hand-off link shows only the records; axe passes on all steps.

## 25 · Calm settings: home, search, six groups (proposal)

**Goal:** every setting has one home and the owner finds it in seconds. See
`docs/explore/SETTINGS_IA.md`.

- `/studio/settings` home: search (synonyms, role- and module-aware, lands on
  the control), five-item setup checklist, six groups with live summaries,
  Your account.
- Move pages as in the exploration's table; old URLs redirect; More keeps the
  tools plus Settings and Help & support rows.
- "More options" pattern for advanced controls; switched-off modules show
  nothing; delete the duplicate Appearance control; industry pack out of
  Features.

**Done when:** searching "holiday" opens Closed days with the control
highlighted; the checklist ticks itself from data; switching a module off
removes it from Settings and search shows where to turn it on; no setting is
reachable from two pages.

## 26 · Salon site template on the whole domain (proposal)

**Goal:** a business can use its whole domain for a one-page salon site built
from its own data, with booking at its core. See
`docs/explore/WEBSITE_SERVICE.md`.

- Apex domains in `checkDomain` and the flow (A record plus `www`), `www`
  redirect and per-business redirects from old page addresses in `routeHost`.
- New sections: About us, Opening hours, Contact, a privacy page.
- Three templates as theme and section presets.
- Page title, description, `LocalBusiness` structured data, sitemap, Open
  Graph image; no tracking cookies.
- White-label rules unchanged; booking flow fixed inside every template.

**Done when:** a test apex host serves the salon site at `/` and booking
works from it; the three templates pass axe; a redirect from an old path
works; no platform name appears on the page.

## 27 · Done-for-you move-in (proposal)

**Goal:** Niclas can move a business from another platform in a few hours
with a fixed checklist. See `docs/explore/WEBSITE_SERVICE.md`.

- Internal move-in checklist (questions from `OWN_DOMAIN.md` section 4,
  DNS inventory, switch date, links to change) per business.
- Import of future bookings and gift card and punch card balances from CSV,
  extending the customer import from goal 3, with preview and conflict check.
- Switch-date helper: warns about double booking while two systems are open.

**Done when:** a sample export from a fictional old provider imports with a
preview; the checklist can be followed end to end in the demo; Salong
Solgården's real move is planned with it (no real data in the repo).

---

## 29 · International by default and an open-source best-practice baseline

**Goal:** Cresavo is an international product that happens to start in Sweden,
not a Swedish product translated later. Decided by Niclas 2026-11-18.

- **Locale per business:** country (ISO 3166), currency (ISO 4217, money as
  integer minor units), time zone (IANA), language (BCP 47), first day of the
  week, and the 12/24-hour clock. All formatting goes through one `Intl`-based
  helper. Remove the hardcoded `SEK`, `sv-SE`, `Europe/Stockholm` and "kr"
  (about 140 places in `src/`). Phone numbers are stored in E.164 and entered
  with a country picker.
- **Public URLs in English:** `/book/<slug>` becomes the canonical booking path,
  with `/boka/<slug>` kept as a permanent redirect so existing links keep
  working. Update host routing, tests and docs.
- **English everywhere in code and docs:** engine error messages
  (`Åtkomst nekad` and similar in `src/lib`, `src/mcp`), `docs/STATUS.md` and
  `docs/ROADMAP.md`. Swedish exists only as a generated UI locale (goal 21) and
  in demo data.
- **A second demo business** in another country (e.g. a London nail studio in
  GBP, Europe/London, en-GB) next to Salong Eko, to prove the locale model.
  Switchable in the demo.
- **Regional, not core:** Swedish providers (46elks, Swish, Fortnox, Visma,
  Bokio) are regional adapters (goal 28); global defaults come first.
- **Legal and privacy written for the EU first and stated generally:** GDPR
  basics (data export, deletion, processor list), with CCPA/UK GDPR notes.
  No country-specific legal claims in the product.
- **Open-source best-practice baseline** (check what exists, add what is
  missing, keep each item small):
  - semantic versioning with GitHub releases and a changelog (exists: keep)
  - Conventional Commits (exists)
  - CODEOWNERS, issue and PR templates (check)
  - architecture decision records in `docs/adr/`, the first one recording this
    goal's decisions
  - Dependabot (exists), gitleaks and OpenSSF Scorecard (exist), an SBOM at
    release time, and license checks for dependencies in CI
  - WCAG 2.2 AA as the stated accessibility target (axe in CI from the QA
    routine)
  - a supported-versions table in SECURITY.md
  - `docs/legal/CLA.md` (currently referenced but missing) and `TRADEMARK.md`
    drafts, both marked pending legal review

**Done when:** Salong Eko and the second demo business both look right in
their own currency, time zone and language with no Swedish hardcodes left in
`src/` outside demo data and the sv locale; `/book/<slug>` works and
`/boka/<slug>` redirects; engine errors and all docs are English; the baseline
items exist or have an issue; an ADR records the decisions.

---

## 28 · Connections: Cresavo-managed or bring your own provider

**Goal:** every feature that needs an outside provider plugs into one shared
port. Per feature, a business chooses "Let Cresavo handle it" (paid, one
click) or "Use your own" (free, its own key). A new or cheaper provider later
means one new adapter and nothing else changes. Decided by Niclas 2026-11-18.

- One port (interface) per capability, following the pattern of the AI
  router in `src/concept/ai`: SMS, email, payments, social publishing, ads.
  Each port has a simulated adapter that the demo uses today, and a typed
  contract (send, status, cost, errors) with tests.
- Candidate real adapters, interfaces only until a real business needs them:
  SMS (46elks, Twilio), email (Resend, SMTP), payments (Stripe, Swish via a
  provider), social (Meta), ads (Google, Meta). Verify licences and terms
  before adding SDKs; prefer plain HTTP.
- A "Connections" page under Settings, in the "Booking rules & messages"
  group from `docs/explore/SETTINGS_IA.md`. Each capability shows its current
  choice, a short guide on where to find a key, a "Send a test" button and a
  status line. Keys are entered in a form, stored server-side only, never
  shown again and never logged. The public demo shows the page simulated.
- Campaigns, reminders and receipts call the ports, never a provider directly.
- Usage and cost per capability shown at cost price (ties into goal 23).
- Self-hosting guide: which keys exist, environment variable names, where to
  put them, what works without them.

**Done when:** all outbound sends in the concept go through the ports and
their simulated adapters; the Connections page works on 390 px and 1280 px in
light and dark mode; one real adapter (SMS or email) is implemented behind a
flag and verified with a test key in a local environment only; no key is
ever in Git, logs or the browser; the self-hosting guide is updated.
No real messages are sent and no paid accounts are opened without Niclas's yes.

---

## Cleanup pass (when the queue is empty or blocked)

Take open issues labelled `finding` (then `ux`, `bug`), smallest first.
One issue = one commit that references `#nr`. Close the issue with a short
comment on what was done. If you find new things: new issue, not
scope creep. Well suited to a cheap/fast model.
