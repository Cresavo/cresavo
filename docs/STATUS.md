# Status

Cresavo is a concept demo (0.x) for salons and other small service businesses.

## Available today

- [demo.cresavo.com](https://demo.cresavo.com) opens the demo landing page,
  owner studio and Salong Eko customer booking page. The studio includes the
  Assistant, campaigns, stock and purchasing, finance and configurable modules.
  The demo uses fictional fixtures and browser state. The Assistant works
  without an AI key.
- [cresavo.com](https://cresavo.com) shows the coming-soon page. Its launch
  waiting-list form is a placeholder and does not store sign-ups.
- Host routing serves the product site, demo and business booking pages at
  different addresses. The demo resolves fixture businesses and simulates
  custom-domain setup.
- The separate booking engine uses Prisma and PostgreSQL. The web workspace,
  provider API and local owner MCP share booking rules, including idempotency
  and protection against double-booking. The public agent gateway lives in
  the separate `booking-lab-gateway` repository.

## Before a real pilot

The studio still needs to connect to the booking engine. Real customer use
requires verified tenant isolation, production authentication and access
controls, backups and restore, monitoring, and a security and privacy review.
The launch waiting list needs a storage provider and a current privacy policy
before it can accept sign-ups. Use fictional data and simulated messages in
the meantime. See the [pilot gate](QUALITY_SECURITY.md) and [goal queue](goals/QUEUE.md).
