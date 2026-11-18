# Privacy and security

Cresavo is a concept demo and booking-engine proof of concept. Use fictional
data for bookings, client records and journal entries. [Data flows](DATA_FLOWS.md).

## Public demo

- The studio stores demo activity in browser storage. Reset the demo to clear
  your changes. Share screenshots and exports only if they contain fictional
  data.
- The hosted demo uses simulated connections. The local concept MCP, server
  mutations and live provider access are restricted in public read-only mode.
- The product-site waiting-list preview validates and discards addresses.
  [Waiting-list guide](WAITLIST.md).

## Local development

- Keep provider keys and server credentials in local environment variables or
  in the host's secret store. Use a separate local test database for database
  tests and keep logs free of credentials, customer contacts and journal text.
- A configured external AI provider receives data sent for enabled tasks. An
  assistant connected through MCP can also pass tool results to its provider.
  Use only fictional data during these walkthroughs. [Assistant setup](CONNECT_AI_ASSISTANT.md).
- The booking engine scopes access by business and account or agent identity,
  checks requests on the server and uses revocable account-bound admin
  sessions. Local owner MCP admin permissions rely on trust in the operator
  who launches the process. [Admin identity decision](decisions/ADR_004_ADMIN_IDENTITY.md).

## Before a pilot

Real use requires production authentication, tested tenant isolation,
restricted access to sensitive records, retention and deletion controls,
backups with a tested restore, and independent security and privacy review.
The [pilot gate](QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer)
lists the required checks. Report vulnerabilities through
[the private reporting process](../SECURITY.md).
