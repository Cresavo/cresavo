# Concept: AI-native salon system (clickable demo)

Decision by Niclas 2026-11-16. Goal: a **clickable, living demo of the whole system**
that feels real. It should be possible to show to salon owners and use to
get reactions (for example from a foot therapist who uses booking systems
daily). It is **not** a live product. Speed and feel come before full
correctness. The good parts are rebuilt "for real" later.

## The idea in one sentence

A salon system where the owner and the customer **say or type what they want**
and the system proposes the change, which you approve with one tap. Everything
can also be done with ordinary buttons, so AI is a shortcut and not a requirement.

## Principles

1. **Less is more.** Few menu choices, big clear buttons, at most two taps to
   anything common. The owner is stressed and often standing with a customer or on the phone.
2. **Say it instead of clicking.** A command box (text + microphone) is
   always at hand. The result is shown as a **proposal card** with
   Approve / Change / Cancel. Nothing changes without approval.
3. **Proactive.** The system says by itself what needs doing: gaps to fill,
   products running out, holidays to run campaigns for, customers who have not been in.
4. **You own your data.** Everything can be read via MCP and exported for free.
   A dedicated page shows "connect Claude/ChatGPT" with a copy button.
5. **Modules you switch on yourself.** Journal, Stock, Campaigns, Finance, Reviews.
   A switched-off module does not appear in the menu.
6. **The customer understands immediately.** The customer page has one simple box: "What would you
   like to book?" → three ready time suggestions → book. The classic click flow remains.
7. **English UI, ready for more languages.** All UI text is in English. Every
   user-facing string lives in a per-area dictionary (e.g. `src/concept/i18n/en.ts`
   with a small `t()` helper) so Swedish (`sv`) can be added later without touching
   components. Demo data may stay Swedish-flavoured (Stockholm salon, Swedish names,
   SEK). Dates en-GB, 24h clock.

## The owner's app (`/studio`)

Menu (tabs at the bottom on mobile, side menu on desktop):

| Tab | Content |
|---|---|
| **Today** (start) | Today's timeline, next customer with customer-card quick info, proactive cards ("2 gaps this afternoon – send an offer?", "Foot cream running low – order?", "Father's Day in 19 days – see campaign suggestions"), today's revenue. |
| **Calendar** | Day/week, drag and drop to move, tap for details. Staff filter. |
| **Customers** | Search, customer card with image, history, notes, journal (if switched on), "not been here in 10 weeks" marker. |
| **Inbox** | Messages/requests from customers, rebooking requests, new reviews. One tap to reply with a suggestion. |
| **More** | Services & prices, Staff, Stock, Campaigns, Finance, Reviews, Features (modules on/off), Your data & AI, Settings. |

**Command box** ("What do you want to do?") at the top of every page + a floating
microphone button on mobile. Examples that must work in the demo:

- "Move Anna's appointment on Thursday to 14:00" → card showing before/after.
- "Book Erik for a foot treatment next Tuesday morning" → three free times.
- "Cancel 15:00 today and offer the slot to the waiting list".
- "20% off massage all of March" → campaign card with price before/after.
- "What have I earned this month?" → number + small chart.
- "Which customers haven't been here since the summer?" → list + "send a greeting".
- "Order more foot cream" → purchase draft.
- "Make a poster for Father's Day" → poster suggestion.

## New ideas to show (things other systems lack)

- **Phone mode**: a big "Someone is calling" button. Shows today's/this week's gaps
  immediately and lets the owner say "move Lisa to Friday 10" with one hand.
- **Voice journal after the visit**: tap "Dictate journal" on the visit →
  transcription → structured note (treatment, observations,
  recommendation, next visit) → review → save. Suggests the next booking.
- **Smart return-visit reminder**: "Foot care is usually done every 6 weeks –
  5 customers are late, send a suggestion?".
- **Fill the gap**: a cancellation → waiting list/regulars get an offer automatically
  (in the demo: a simulated send that shows up in Inbox).
- **Holiday calendar**: Valentine's Day, Easter, Mother's Day, Father's Day, Christmas,
  gift card periods. Each holiday gives a ready campaign suggestion + poster.
- **Daily summary** at closing: revenue, new customers, missing journals,
  tomorrow's first customer.
- **Stock that talks**: consumption is counted per treatment, a warning when
  it starts running out, a purchase list to approve.

## The customer's page (`/boka/[salon]`)

- The salon's page with image, address, opening hours, reviews, services with image/price.
- At the top: the **"What would you like to book?"** box. "Foot care some afternoon next week"
  → three time suggestions as cards → tap → name + phone → done.
- Classic alternative: choose treatment → choose time → confirm (3 steps).
- Confirmation page with "Add to calendar", "Rebook", "Cancel".
- "My bookings" via link (no login in the demo).

## Tech for the demo

- New separate route tree: `/studio` and `/boka`. Do **not** touch the existing
  `/admin`, API, MCP, Prisma schema or migrations.
- **No database for the concept.** Fixture data in TypeScript + state in the
  browser (React state + `localStorage`), with a "Reset demo" button.
  That makes the demo fast, safe to show and independent of Postgres.
- **Command interpreter** in two modes:
  1. *Without a key* (default): a rule-based English interpreter that handles
     the example phrases above and variants.
  2. *With `OPENAI_API_KEY`* in `.env`: the server route `/api/concept/intent`
     asks the model to return the same JSON structure (action + parameters). Falls
     back to the rule interpreter on error. The key never leaves the server.
- **Speech**: the browser's `SpeechRecognition` (en-GB) first. With a key:
  `/api/concept/transcribe` which sends audio to OpenAI transcription.
- **UI strings**: all text goes through a per-area dictionary (`src/concept/i18n/en.ts`,
  `t()` helper), never hard-coded in components, so `sv` can be added later.
- Images: use the existing ones in `public/demo` + generated, uniform
  SVG avatars (initials on pastel) for customers. No photos of real people.
- All AI proposals are marked "Proposal" and show exactly what changes.

## Demo data

Salon: **Salong Eko** (foot care + massage), Vasastan, Stockholm. Two people: Anna
(foot therapist, owner) and Erik (massage therapist). ~40 customers with names, phone (fictional
070-1xx xx xx), notes, 3–12 visits each, some with journal entries.
Calendar ~70% full for the coming 3 weeks + 6 months of history (for charts).
Stock: ~15 products (foot cream, cuticle oil, files, massage oil …) of which
2 nearly out. 3 reviews per week. Today's date = the real current date so
"Today" always looks alive. Prices in SEK.

## AI architecture: built to get better as the models get better

The core is **headless**: every business action (book, move, change price,
create campaign, journal, stock, publish post) is a *tool* with a clear
schema. The same tools are used by the buttons in the app, the command box, internal
agents and external AIs via MCP. The UI is just one of several ways to call them.

```
 Buttons · Command box · Voice · Claude/ChatGPT (MCP) · Scheduled agents
                              │
                  Tools (typed actions + propose/approve)
                              │
       Task agents (one thing each) ── Model router (cheap/smart/local)
                              │                     │
                   Business data              Provider: OpenAI / Anthropic /
                                              OpenRouter / own key (BYOK)
```

- **One agent per task.** Small specialists: `interpret-command`,
  `structure-journal`, `write-post`, `suggest-campaign`, `stock-forecast`,
  `reply-customer`, `daily-summary`. Each task has its own prompt file, its own
  input/output structure (JSON schema) and a **model tier**: `fast` (cheap),
  `smart` (expensive), `image`, `speech`. A better model = change the tier in a table.
- **Model selector/router.** One place that maps tier → provider + model.
  Default: the platform's keys. The customer can add their own key (OpenAI,
  Anthropic or OpenRouter, which gives hundreds of models via one API) and
  choose a tier per feature. All OpenAI-compatible calls go through the same client.
- **Cost is visible.** Every AI call is logged with task, model and estimated
  cost, so you can see what features cost and price them.
- **Always a fallback.** Without a key, rule-based variants work.
  AI improves things but is never required.
- **Proposals first.** Agents never change anything directly; they leave proposals
  that a human approves (or for which the owner has explicitly switched on
  "approve automatically", per type).
- **AI in the background.** A lot of AI should be invisible: it sorts the Today cards,
  fills in fields, suggests text, detects patterns. No chat bubble unless needed.

## Marketing: one campaign → all channels

- **Campaign studio**: choose a treatment/offer (or take a holiday suggestion)
  → the system writes text per channel (Instagram, Facebook, TikTok, Google,
  newsletter, SMS) and makes an image/poster in the salon's style → review/edit →
  **Publish everywhere** or schedule.
- Images: template-based posters (own text on the salon's photos) as the default,
  AI-generated image as an option. Many people dislike the "AI look", so templates and
  own photos come first.
- **Ads**: "Run this as an ad on Facebook/Instagram, 500 SEK, 7 days"
  → suggested audience (local area) → approve.
- **Results back**: reach, clicks and – most important – **bookings that
  came via the campaign link** show on the campaign. Every campaign gets a trackable link.
- In the demo, publishing and statistics are simulated but look real.

## Reuse instead of inventing (candidates)

| Need | Candidate | Note |
|---|---|---|
| Publish to social channels | Postiz (open source, AGPL-3.0, self-hosted, API + MCP) | Same licence as the repo. Otherwise Ayrshare/PostPeer as a paid API. |
| Several AI providers in one API | OpenRouter (OpenAI-compatible), Vercel AI SDK | BYOK support. Start with a simple fetch client, switch to the SDK if needed. |
| Speech to text | Browser speech recognition → OpenAI transcription | Local Whisper later if cost/privacy requires. |
| MCP for "own your data" | Existing `src/mcp` + `/api/v1/mcp` in the repo | Extend with read tools for everything. |
| Posters | Template in HTML/SVG → PNG (Playwright already exists) | AI image as an option. |
| Accounting (later) | Fortnox API | No till is built now. |

Licence and cost are checked before anything is connected for real.

## Open protocols: build on others' standards

Principle: our own core with typed tools, and **thin adapters** per protocol.
When a protocol gets better or a new one wins, we swap/add
an adapter, not the core.

| Protocol | What it does | Status in the repo |
|---|---|---|
| MCP | AI (Claude/ChatGPT) reads data and runs tools | Exists (`src/mcp`, `/api/v1/mcp`). Extend with read tools for everything. |
| A2A | Agent talks to agent (the customer's assistant ↔ the salon's agent) | Local trial exists (`@a2a-js/sdk`). |
| USP (Universal Services Protocol) | Discovery/booking of services via agents | Discovery profile `/.well-known/usp` + name aliases, not full conformance. Early draft of a standard. |
| UCP (Google/Shopify) | Agentic commerce: discovery, checkout, order; expanding towards travel/accommodation | Not started. Relevant for e-commerce and possibly booking. |
| ACP (OpenAI/Stripe) | Purchases inside ChatGPT | Not started. Later, when a till exists. |
| AP2 | Proof that a human approved an agent's payment | Not started. The repo's mandate/approval model is close to the idea. |
| OAuth 2.1 + discovery, OpenAPI, llms.txt | Secure connection, machine-readable API description | Exists (lab). |

The demo shows this at More → Your data & AI: "Your salon can be reached by AI assistants
via MCP, A2A and USP" with status per protocol.

## Business model: open core following the Accounted model (proposal)

Role model: [Accounted](https://github.com/erp-mafia/accounted), Swedish
AI-native open-source accounting (Next.js 16, AGPL, 150+ MCP tools,
the agent proposes and the human approves). Their model, translated here:

1. **The core is AGPL and can be self-hosted freely.** That gives trust and
   attention. Free to self-host, never locked down.
2. **Paid cloud version.** A subscription for those who just want to log in
   (most salons).
3. **"Connect" service, private and paid.** What requires agreements, keys
   and certificates (SMS, payment, publishing to social channels, ads,
   Google booking, calendar sync) runs as a separate service. Even those who self-host
   buy it. Accounted chose this after someone resold a fork.
4. **Exception for add-ons in the licence.** Third-party modules that only use
   the documented add-on API may have their own licence, so a
   marketplace can grow.
5. **White label.** Chains, franchises and suppliers can run under their own
   brand.
6. **No commission per booking.** That is the difference from the chains.

**Accounting is not built in-house.** Connect to Accounted via their
MCP/API instead. Same stack and same licence, and we avoid rebuilding
accounting.

## Operations, logging and support: built for one person

One person should be able to run this. So the system does as much of the
support itself as possible, and errors should show before the customer calls.

- **Structured logging from day one.** Every call gets a request id.
  JSON logs with level, business, user (pseudonymised), action and
  time. Never customer data, journal text or keys in logs.
- **Event log per business.** Everything that changes (by human, AI or
  integration) is saved with who, what, before/after and from where. Shown to the owner
  as "What happened?" and makes it possible to undo and debug without digging in the server.
- **AI log.** Every AI call: task, model, tokens, cost, time, whether
  fallback was used, whether the proposal was approved. This is both debugging and pricing.
- **Error tracking and alerts.** Errors are collected (e.g. Sentry or the open-source
  alternative GlitchTip) with request id. Phone alerts for errors that
  affect booking. Health page for integrations (SMS, publishing, payment).
- **Built-in support.** A "Help" button in the app that (1) answers with AI based on
  documentation and the customer's own data/log, (2) can show "here is how"
  directly in the right view, (3) creates a ticket with a screenshot, request id and
  recent events when AI is not enough. One place for all tickets.
- **Self-service.** Export, restoring deleted items (trash),
  undo, status page and knowledge base, so fewer people need to contact support.
- **Support mode.** The owner can grant support time-limited read access; every
  access is logged and visible to the owner.

## Contributing to the project

- Every contribution requires a **contributor licence agreement (CLA)** signed digitally
  once (e.g. CLA Assistant on GitHub) before the first PR can be merged.
- Why a CLA and not just a DCO (which Accounted uses): Accounted
  found that they cannot change licence without consent from all
  contributors. With a CLA the project keeps the option of offering a
  commercial licence or changing licence later. The core stays AGPL for everyone.
- `CONTRIBUTING.md` describes: CLA, code style, tests, synthetic data,
  security reporting (never a public issue) and the add-on API.
- The text of the CLA must be legally reviewed before the project goes public.

## More industries

Salon (foot care/massage) is the first trial. The core should fit more: hairdresser,
nails, PT, clinic, tradespeople with booking and e-commerce. An industry is a
**pack** of modules, words ("treatment"/"service"/"product") and agent prompts
– not a separate codebase.

## Not in the demo (later)

Real outgoing messages (SMS/email), payment/till, real accounting, login,
GDPR handling of journals, Swedish (`sv`) UI translation. Everything like that is shown
as simulated and labelled.
