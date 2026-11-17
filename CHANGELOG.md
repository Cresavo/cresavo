# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/) (`0.x` while in concept stage).

## [Unreleased]

### Added
- Everyday operations: opening hours, lunch and closed days are editable in Settings (Swedish public holidays are suggested), each person has a weekly schedule with days off, sick days and extra shifts, and rooms can be added and assigned to treatments so two bookings never share one.
- Free times follow all of it everywhere: the customer booking page, calendar, "Someone is calling", command box and MCP tools use one availability function.
- Today shows a "needs moving" card for bookings that no longer fit (someone is off, the salon is closed). The calendar can filter by room.
- Owner and Staff view: the Staff view shows only the person's own calendar, customers served and journal, without finance, settings or modules.
- Command box: "Anna is off on Friday", "close the salon on 24 December" and "Erik works Saturday 10-14" create proposals.
- Gift cards (More > Gift cards, switchable module): sell a card with amount,
  recipient and message, share or print it, pay a booking with it from the
  booking sheet, and let customers check the balance on the booking page.
  Selling a card is not revenue; it is owed to the customer until a visit is
  paid with it. Finance shows what customers have prepaid.
- Packages (More > Packages, switchable module): sell "5 visits for the price
  of 4". Marking a visit done uses one visit of the customer's package.
- Evening summary on Today after the last booking: revenue, visits, no-shows,
  new customers, missing journals and tomorrow's first customer, from the
  `daily-summary` task (rule text without an AI key).
- Calendar subscription per staff member (More > Staff): a read-only `.ics`
  link with a secret token (`CONCEPT_ICS_SECRET`) for Google or Apple Calendar,
  showing treatments and first names only.

### Changed
- Polish pass: Today has two number cards instead of three and two suggestions at first (the rest behind "Show more"); the schedule no longer repeats times or durations, and finished visits are shaded instead of faded.
- Muted text, warning badges and Erik's colour are darker so they pass WCAG AA contrast; the customer day chips and calendar days no longer use faded text.
- Empty Gift cards and Packages pages show only the empty state (the "owed to customers" card appears once something is sold); review cards no longer repeat "No reply yet" next to the Reply button.
- Customer rows wrap the next visit instead of cutting it off on phones.
- Animations and transitions in the studio and booking pages stop with "reduce motion".
- The product name and tagline live in one constant (`src/concept/brand.ts`);
  every user-facing mention reads from it, and a test guards that.

### Fixed
- Development dependency audits are clean after compatible upstream fixes (#12).
- The engine MCP transport is reused without sharing client authority or repeating setup for every request (#15).
- Commands keep minutes in times such as "at 14:30" and "to 09:45" (#13).
- Mobile command input is shorter, and the floating mic no longer covers actions (#16).
- MCP write tools (`propose_move` and the others) failed with "The tool could not run" because the Owner/Staff rules shared a file with browser-only code; the rules and the browser's role switch are now separate files.
- After booking inside 24 hours the confirmation said both "online changes are closed" and "free to change until" a past date; only the one that applies is shown.
- Star ratings, the gift card page without a card and the day chips are announced correctly by screen readers.

## [0.2.0] - 2026-11-17

### Changed
- The product is now called Flerdo.

### Added
- Open-source front door: English CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  issue and pull request templates, and a draft CLA (pending legal review).
- Open protocols for the demo business: an HTTP MCP endpoint
  (`/api/concept/mcp`, bearer token `CONCEPT_MCP_TOKEN`) with read tools for
  bookings, free times, customers (names only), services, stock, finance and
  campaigns, and write tools that only create proposals.
- Inbox shows proposals from Claude, ChatGPT or another agent under "Waiting
  for your approval" with Approve and Decline; approved changes appear in What
  happened? as Assistant · MCP with Undo.
- Your data & AI: status per protocol and copy-paste setup for Claude Code,
  Claude Desktop and ChatGPT.
- A2A agent card and read-only A2A endpoint, plus a USP discovery profile, for
  customer assistants (services and free times; the person books on the
  booking page).
- Modules with prices: Features shows each module (Journal, Stock, Campaigns,
  Finance, Reviews, Waiting list, Ask Flerdo) as a card with on/off, a demo
  price and a running monthly total. Switching a module off removes it from the
  menu, Today cards, AI task list and command box answers.
- Industry packs: Foot care and massage, Hair salon, Nails, Personal trainer and
  Clinic. A pack sets words (customer/client/patient, treatment/service/session),
  services, stock, journal templates and starting modules; switching pack
  rebuilds the demo.
- Onboarding at `/studio/welcome` (three questions), reachable from Settings
  via "Start over as a new business".
- What happened? (More): every change with who made it (you, the assistant, a
  customer), what changed before and after, and where it came from (button,
  command box, voice, booking page). Filter the list and undo a change with one
  tap while nothing else has touched it.
- Trash: cancelled bookings and deleted customers stay for 30 days and can be
  restored, a customer with all their bookings and journal. New Delete customer
  on the customer card.
- Help button in the studio header: ask how to do something and get an answer
  from 15 help articles, let it show you the right button, or create a ticket
  with the page, a request number, a screen outline and your latest changes.
  Tickets are listed under What happened? > Support tickets.
- Support access in Settings: let support read the account for 1 or 24 hours and
  stop it at any time; every grant and stop is logged.
- Server logs for `/api/concept/*` are one JSON line per request (request id,
  route, status, duration, task) and never contain input text, keys or personal
  data; responses carry an `x-request-id` header.
- Stock and purchasing: mark a finished visit as done in the booking sheet and
  the products it uses (foot cream, massage oil, gloves, couch paper) are
  deducted automatically. Stock shows "runs out in about N days", Today warns
  when a product runs low, and the purchase list (one amount per product, one
  tap to approve) puts the order on order and saves an email draft per supplier
  in the Inbox (simulated). Goods received adds the delivery to the stock, typed
  in or from a "photo of delivery note" (demo result).
- Sell a product to a customer (Stock or the customer card, or "sold a foot
  cream to Lena" in the command box): the balance drops and the sale shows in
  the customer's history and in revenue. "How much massage oil is left?" and
  "order more foot cream" also work in the command box.
- Edit a product's minimum level, supplier and prices from the Stock page.
- Finance overview on one screen: revenue, occupancy per person, popular
  treatments, cancellations and no-shows, and new vs returning customers for a
  day, week, month or year, each compared with the period before.
- Monthly costs (rent, products, wages, fees) with the result left over each month.
- Accounted bookkeeping card (simulated connection, preview of what would sync)
  and SIE and CSV exports.
- The command box answers "compare March with last year", "which treatment earns
  the most per hour?" and "how busy is Erik next week?" with a number and a chart.
- SMS and email previews for booking confirmations and reminders, with simulated
  confirmation sends, retry-safe reminder sends and a Sent log in Inbox.
- Customers can leave a 1–5 star review after a completed visit. Owners approve
  it in Inbox or Reviews before its text or rating appears on the salon page.
- A responsive Flerdo booking widget, plus copyable embed code and a clean
  Instagram bio link in More → Settings.
- More customer booking phrases, including sports massage, back rub, footcare,
  next available, day after tomorrow, weekday abbreviations and around HH:mm.
- Flerdo can securely save a business's own OpenRouter, OpenAI or Anthropic key
  on the demo server, choose Fast/Smart per task, and show saved usage by task
  and month. The command box uses validated provider tool proposals with rules
  as fallback; all features still work without keys.
- Campaign studio: pick an offer or holiday, get a text for Instagram, Facebook,
  TikTok, newsletter and SMS, choose a poster (5 styles; Instagram post, story or
  A4 window poster as PNG), preview it per channel, then publish everywhere or
  schedule. Each campaign gets a trackable link and (simulated) reach, clicks,
  bookings and revenue, and can be run as an ad with budget, days and local area.
- Content calendar with holidays and planned posts on the Campaigns page.
- Today suggests campaigns for coming holidays and quiet days; the command box
  ("make a Father's Day campaign", "20% off massage all of March") opens the
  studio pre-filled.
- Customer card: a one-line summary at the top ("Regular since 2024, foot care
  every 6 weeks, sensitive skin, prefers Anna, afternoons") and the next
  suggested visit with a one-tap time suggestion.
- Return visits (Customers > Due back): set the return interval per treatment,
  see who is overdue and send a simulated SMS with a ready booking link that
  lands in the Inbox.
- Customer segments as filters: regulars, not seen in 3 months, new this year,
  birthday this month.
- Journal templates (foot care, ingrown nail, massage, deep tissue),
  before/after photos and version history that keeps earlier wording after edits.
- Customer import from CSV with column matching and preview, plus an example
  file (`/demo/customers-example.csv`).
- Command box at the top of every studio page: type or speak what you want,
  review a proposal with before/after, then approve, edit or cancel. Questions
  about earnings and lapsed customers are answered in the card.
- Voice journal: dictate a visit, get treatment, observations, advice and next
  visit as editable fields, and book the next visit in one tap.
- Your data & AI shows which AI task runs on which model (or built-in rules),
  a cost log and a form for your own AI key.
- Customer booking page (`/boka/salong-eko`): describe what you want in your own
  words or pick a treatment, choose a time, confirm with name and phone. Includes
  add to calendar, reschedule, cancel (free until 24 hours before), "My bookings"
  with rebooking, and a waiting list for full days that reaches the owner's Inbox.
- Links from the start page to the customer page and owner studio demos.
- Salon command proposals and seven optional AI tasks work without API keys.
- AI evaluation command checks salon scenarios and reports accuracy, time and
  estimated cost, with no network calls by default.
- Concept for an AI-native salon system: owners and customers say or type
  what they want and approve a proposal; everything also works with buttons.
- Owner studio (`/studio`) demo: Today, Calendar, Customers, Inbox and More,
  with realistic fictional data (in progress).
- Goal queue, agent guide, quality and security baseline, and release process.

### Fixed
- Opening an Inbox item on desktop no longer opens a hidden mobile dialog that
  blocks clicking the message actions.
- Booking suggestions label the end time as “until”, making each time card
  unambiguous (#8).
- Campaign dates and posters show the year. Generic holiday requests and command
  suggestions use the next upcoming occasion; explicitly named holidays remain
  available (#11).
- Voice journal: sentences about treating skin or nails are no longer filed
  under observations.

## [0.1.0] - 2026-11-16

### Added
- Booking engine proof of concept: online booking, admin calendar, customer
  register, services and staff, proactive capacity suggestions, agent API and
  MCP with customer approval before booking.
