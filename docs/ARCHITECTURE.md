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
