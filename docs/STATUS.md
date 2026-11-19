# Status

Cresavo is a concept demo (0.x) for salons and other small service businesses.
Start with the [demo and product tour](../README.md) or see the
[public roadmap](ROADMAP.md).

## Available today

- A flag-controlled assistant pairing preview creates a temporary fictional
  workspace with its own Inbox and calendar. An assistant can read the salon schedule, customer visits,
  catalogue, staff and financial summaries. Visitors review proposed bookings, blocks,
  treatment changes and simulated replies in the studio Inbox. The public rollout
  and hosted assistant account checks are pending. [Connection guide](CONNECT_AI_ASSISTANT.md#connect-claude-to-the-demo-preview).

- The [launch plan](LAUNCH_PLAN.md) and [post drafts](launch/) cover feedback on the public concept demo and contributor onboarding. GitHub community setup and posting are owner steps.
- [demo.cresavo.com](https://demo.cresavo.com) opens the owner studio directly. Salong Eko’s customer booking page stays at /boka/salong-eko. The studio includes the
  Assistant, campaigns, stock and purchasing, finance and configurable modules.
  The demo uses fictional fixtures and browser state. The Assistant works
  without an AI key.
- [cresavo.com](https://cresavo.com) shows the product page in English and [Swedish](https://cresavo.com/sv), with a product tour and links to the demo and public repository. Its launch
  waiting-list form is a placeholder and does not store sign-ups.
- Host routing serves the product site, demo and business booking pages at
  different addresses. The demo resolves fixture businesses and simulates
  custom-domain setup. Live domain changes are disabled until owner and
  domain ownership can be verified on the server.
- Owners can now set up a separate browser-local salon from Today or Settings, try their own booking page and switch back to the sample business. A first-run checklist and a short demo tour guide the first visit.
- The studio and booking flow support Swedish and English, with a separate business language for confirmations and customer messages. The built-in assistant answers in the studio language and understands common Swedish commands.
- The separate booking engine uses Prisma and PostgreSQL. The web workspace,
  provider API and local owner MCP share booking rules, including idempotency
  and protection against double-booking. The public agent gateway lives in
  the separate `booking-lab-gateway` repository.
- The concept demo includes the November QA fixes for booking and caller
  flows, same-origin tab synchronization, assistant lookups and host feedback.
  Booking undo checks availability, and the customer time picker shows salon
  contacts when no days are open. The QA runner is available through `npm run qa`.
- The product page includes the founder story, a looping request-to-booking example, and a diagram of available and planned connections. Its tour includes five workflow films and an offline booking sample.
- Owners can drag to reorder treatments and categories in the studio and undo
  each move. The booking-page editor supports dragging sections in its draft.

## Before a real pilot

The studio still needs to connect to the booking engine. Real customer use
requires verified tenant isolation, production authentication and access
controls, backups and restore, monitoring, and a security and privacy review.
The launch waiting list needs a storage provider and a current privacy policy
before it can accept sign-ups. Use fictional data and simulated messages in
the meantime. See the [pilot gate](QUALITY_SECURITY.md) and [roadmap](ROADMAP.md).

Reminders by text and e-mail, payments and other providers have a connections
foundation: simulated by default, live adapters behind a flag
([connections guide](integrations/README.md)).
