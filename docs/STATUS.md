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
- Help in the studio has Show me: a question in Swedish or English finds the place on the device (a help map of more than a hundred Studio places, checked against the source and the browser) and a guide points the way step by step. It opens pages for the owner but never presses a button that changes data. Error and missing-setup messages follow [FRIENDLY_ERRORS](design/FRIENDLY_ERRORS.md).
- The studio and booking flow support Swedish and English, with a separate business language for confirmations and customer messages. Salong Eko’s sample data and the studio help follow the selected language. The built-in assistant understands common Swedish commands for bookings, prices, stock, campaigns and booking-page design.
- The legacy booking engine uses Prisma and PostgreSQL. The web workspace,
  provider API and local owner MCP share its booking rules, including
  idempotency and protection against double-booking. It is being replaced by
  the studio's rules behind `StudioStore` and gets no new booking rules
  ([ADR 1](design/ARCHITECTURE_DECISIONS.md)). Customers' agents will reach
  Cresavo salons through the app's own MCP; the separate
  [`Cresavo/gateway`](https://github.com/Cresavo/gateway) stays an optional
  entry for other booking systems ([ADR 7](design/ARCHITECTURE_DECISIONS.md)).
- The concept demo includes the November QA fixes for booking and caller
  flows, same-origin tab synchronization, assistant lookups and host feedback.
  Booking undo checks availability, and the customer time picker shows salon
  contacts when no days are open. The QA runner is available through `npm run qa`.
- The product page shows three everyday moments from the demo, a short founder note with a link to the full story, the status of each part, pricing and practical questions about switching. Its tour includes five workflow films (recorded in English) and an offline booking sample. While the waiting list stores nothing, the page shows no sign-up form.
- The browser demo supports versioned cancellation rules, simulated deposit checkout and owner decisions on late cancellations and no-shows. Paying the full price when booking is the default; a salon can let customers pay at the salon, for all or some treatments. The studio shows new online bookings, cancellations and moves under "New since last time" and as a toast while it is open. Bookings and Finance show payments and refunds. [Feature design](design/NO_SHOW_DEPOSITS.md).
- A demo register in the booking sheet takes the remaining payment by card, Swish or cash (with change), issues DEMO-numbered receipts with VAT per rate and feeds a daily report in Finance. The sample salon's customer can also pay on their own phone from a QR code (card or Swish, simulated); the paid mark lives in server memory, so it is a demo flow, not a payment integration. Only browser demo salons get it, and its receipts never reach the bookkeeping export. A certified register is not built ([#70](https://github.com/Cresavo/cresavo/issues/70)).
- Owners can drag to reorder treatments and categories in the studio and undo
  each move. The booking-page editor supports dragging sections in its draft.
- Campaign posters (roadmap stage 1, November 2026) are drawn on the server
  from designed templates.
  - **Templates:** Price, Price list, Season, Review, Free times, Before/after,
    Portrait (with cut-out photos and drawn backgrounds), Full photo and
    Type only. Four of them also have a mirrored layout.
  - **Starting point:** a campaign starts from a goal (fill free times,
    promote a treatment, wellness benefits, gift cards or a review), which
    suggests three compositions.
  - **Editing:** photo tone, a feed preview, wellness badges, a QR code to the
    booking page and captions that follow the goal and the owner's own
    sign-off.
  - **Layout guard:** a test renders every template, format and text size and
    checks the margins, Instagram's story bars and the face area of
    portraits.
  - **Photo library:** signed-in owners upload their own photos and logo
    (metadata such as GPS removed, stored in Postgres or an S3-compatible
    bucket) and use library photos on posters. The public demo shows sample
    photos only. See [photo library storage](operations/MEDIA_STORAGE.md).
- Owner accounts and a salon stored on the server (`StudioStore` on Postgres)
  exist behind `OWNER_ACCOUNTS_ENABLED`; the public demo keeps them off.
- Security step 1 is complete (November 2026). CodeQL analyses the code and
  workflows, Dependency Review stops pull requests that add high or critical
  vulnerabilities, and GitHub secret scanning with push protection runs
  alongside Gitleaks. The `main` ruleset requires these checks and blocks new
  serious CodeQL findings and force pushes. [Security checks](QUALITY_SECURITY.md#security-checks).

## Before a real pilot

Built and tested, but switched off in the public demo:
- owner accounts with a salon stored on the server (`StudioStore` on Postgres), sessions, lock-out and password reset;
- live public booking with cancel and move links, and booking e-mails through an outbox;
- customer data rights (export, correction, erasure) and retention sweeps.

Also in place:
- cross-tenant tests for the owner and public APIs and the store;
- rate limits on every public route that writes, sends mail or costs money;
- an axe check of the main pages;
- least-privilege database roles (`prisma/grants/roles.sql`);
- a [backup and restore drill](operations/BACKUP_RESTORE.md) and an [incident runbook](operations/INCIDENT_RUNBOOK.md).

Still open before real customer data:
- staff authentication (owners have two-step sign-in; set `OWNER_MFA_REQUIRED=1` for the pilot);
- database-level tenant enforcement (RLS): policies and scopes are prepared, enforcement is one operator step (`prisma/grants/rls-enable.sql`);
- encryption and server-side access control for journals (prepared behind `JOURNALS_ON_SERVER`, off until enabled; key rotation not built);
- staff roles;
- monitoring;
- an external security review;
- legal review of the DPA, the DPIA and the retention periods.

The provider API and gateway still run on the legacy engine (the migration path is in [ADR 1](design/ARCHITECTURE_DECISIONS.md)). The open owner steps are tracked in issue #148. Until then, use fictional data and simulated messages. See the [pilot gate](QUALITY_SECURITY.md) and [roadmap](ROADMAP.md).
