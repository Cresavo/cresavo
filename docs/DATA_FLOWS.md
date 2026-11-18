# Data flows

Cresavo currently uses fictional data. The concept studio and the booking
engine have separate stores. [Architecture](ARCHITECTURE.md).

| Surface | Data and destination |
| --- | --- |
| Public concept demo | Fictional salon, staff, bookings and client records start from bundled fixtures. Changes and exports use the demo state stored on the device and scoped to the browser origin. Resetting the demo replaces that state. |
| Concept assistant | Built-in rules run without an AI key. In a local setup with a provider configured, supported tasks send selected input to the provider through the server-side AI layer. The server holds provider keys. |
| Local concept HTTP MCP | A bearer token grants access to a fictional in-memory server snapshot. Read tools return selected records. Write tools create proposals that appear in the studio Inbox. The snapshot and proposals reset on app restart or a new salon day. |
| Demo connections | Simulated providers record example messages and other actions in a demo outbox. Live adapters, where implemented, require separate server configuration. |
| Product-site waiting list | The preview form validates submitted email addresses and discards them. It tracks requests in short-lived, in-memory rate-limit buckets. |
| Booking engine | PostgreSQL stores businesses, staff, services, bookings, booking history and customer contact data for synthetic tests. Booking records preserve the price and duration agreed at creation. |
| Admin access | The engine stores password hashes and session token hashes. The browser carries a signed session cookie. Session checks use the database and verify the linked account and its version. |
| Agent access | The engine checks agent credentials, business scope and booking ownership. Creating a booking through the agent API requires an idempotency key and a stored test mandate. Agent key material is stored as a hash. |

Use the [privacy and security overview](PRIVACY_SECURITY.md) for security
boundaries, the [waiting-list guide](WAITLIST.md) for its current limits and
the [AI connection guide](CONNECT_AI_ASSISTANT.md) for what an assistant can read.
