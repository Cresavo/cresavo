# Architecture

Cresavo is a Next.js and TypeScript project with a browser-based concept demo
and a separate PostgreSQL booking engine. Both are intended for fictional
data at this stage. See [project status](STATUS.md) and [data flows](DATA_FLOWS.md).

## Concept demo

- The public product site is in `src/pages/`. The owner studio is in
  `src/app/studio/`, and the customer booking pages are in `src/app/boka/`.
  The concept modules live in `src/concept/`.
- [Host routing](../src/proxy.ts) and the [host resolver](../src/concept/page/resolve.ts)
  select the product site, demo landing page, business booking page or
  unknown-address page. The demo uses a fixture directory for business addresses.
- The [demo store](../src/concept/store.ts) starts with fictional fixtures and
  mirrors changes to browser storage. Booking and studio actions reuse the
  concept's data and business rules.
- The assistant uses built-in rules and an optional server-side AI layer.
  Write tools draft proposals for the owner to review. The local HTTP MCP
  gives agents a separate in-memory demo snapshot, with proposals reviewed
  in the studio Inbox. [Assistant setup](CONNECT_AI_ASSISTANT.md).
- [Connections](integrations/README.md) use typed interfaces and simulated
  adapters by default. Supported live adapters require explicit server
  configuration. The public demo uses simulated connections.

### Studio and booking languages

English is the source dictionary and the default language. Swedish uses the
same keys, placeholders and plural forms. The studio uses the device's saved
language cookie when there is one. The setup header and **Settings →
Appearance → Language** both update that preference.

New salons start with English as the booking language. Owners can choose
Swedish in step 2 of setup or change the setting later under **Settings →
Booking language**. Salong Eko starts in English with SEK and lets visitors
switch to Swedish on its booking page. Confirmation, booking management,
calendar downloads and outbound message templates use the business default.
The demo stores these settings in the browser. The version 20 upgrade applies
the new localization defaults to the demo and preserves each owner's salon
settings. A visitor's language choice lasts while the booking layout is open.
Business settings on another origin start from that origin's demo fixtures.

The client route boundary selects the active dictionary and formatting
locale and updates the document language. Server rendering uses the device
preference for the studio and the fixture default for the booking shell.
Message builders pass the business locale explicitly. The format helpers use
Intl for presentation and leave stored dates, clock values and booking rules
as they were. Edited business copy, reviews, and previously saved text keep
their original wording.

The rules-only assistant shares the same dictionary as the studio. The
Swedish command parser covers common booking, availability, opening-hour,
sales and scheduling phrases. More complex commands for pricing, stock sales,
booking-page design and conversational references still rely on English
patterns. The product site, Help articles, some demo records and several
optional AI task prompts still use English.

## Booking engine

The workspace (`/admin`), provider REST API (`/api/v1`) and local owner MCP
share [booking domain code](../src/lib/domain.ts). The domain applies
availability, request validation, quotas and idempotency. PostgreSQL enforces
non-overlap at the database boundary for active staff bookings. Prisma
handles data access, and historical booking details such as price and
duration are preserved when a treatment changes.

The local owner MCP uses standard input and output and is read-only by
default. The separate agent gateway owns its external REST and MCP
interfaces, while this repository owns the provider API, database and
authorization rules. [Gateway contract](GATEWAY_SPLIT.md).

## Deployment

The public demo serves the browser studio without a database. Local booking
engine development uses a separate synthetic PostgreSQL database. For
deployment and operating details, see the [demo deployment guide](DEPLOY_DEMO.md),
[admin operations](ADMIN_OPERATIONS.md) and [security baseline](QUALITY_SECURITY.md).
