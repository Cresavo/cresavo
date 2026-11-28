# Demo: a customer's assistant books a salon time

This runbook shows the customer side of agent booking end to end, with the
fictional salon **Salong Eko** and fictional customers only. A customer's
assistant (Claude, ChatGPT or any MCP client) connects to the salon's own MCP
address, signs in with OAuth, finds a free time, proposes it, the customer
approves with a one-time code, and the booking lands in the salon calendar
with a confirmation and a reminder.

Everything runs on one computer. Nothing is sent: e-mail codes, confirmations
and reminders are simulated. No external booking system is called.

## What the audience sees

| Step | Tool or page | What to say |
| --- | --- | --- |
| 1. Connect | OAuth consent page `/agent-oauth/authorize` | "The assistant asks the salon for access. The customer sees exactly what it may do and chooses Allow." |
| 2. Discover | `list_services`, `get_availability` | "The assistant reads the salon's real treatments, prices and free times. No scraping, no guessing." |
| 3. Hold for approval | `create_proposal` | "It proposes one exact time. That grants nothing yet: the salon waits for the customer." |
| 4. Customer approves | Consent page `/consent/<id>` | "The customer types their e-mail, gets a code and says yes. Only now may the assistant book, and only this time, price and treatment." |
| 5. Book | `get_proposal` (mandate), `create_booking` | "The assistant books under that approval. A retry with the same key never books twice." |
| 6. Confirm | `get_booking` | "The booking is confirmed in the salon calendar. The confirmation e-mail and the reminder are shown as simulated." |

A pending proposal does not reserve the slot: if someone else books it first,
the booking step answers `slot_unavailable` and the assistant proposes a new time.

## Prepare (once)

1. Node.js 24, a local PostgreSQL and `npm ci`.
2. Create a local database whose name ends in `_demo` (for example
   `cresavo_demo`). The guards refuse anything else.
3. In the checkout's private `.env` (never committed), set these by name. Use
   your own values; keep secrets out of chat and screenshots.

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | The local `_demo` database |
   | `SESSION_SECRET` | At least 32 random characters |
   | `AGENT_OAUTH` | `1` |
   | `BOOKING_CONSENT_LAB` | `1` |
   | `BOOKING_PUBLIC_ORIGIN` | `http://127.0.0.1:3217` (must match `PORT`) |
   | `PORT` | `3217` |
   | `PUBLIC_READONLY` | `0` |

4. Migrate and seed:

   ```sh
   npx prisma generate
   npm run db:migrate
   npm run db:seed
   ```

## Before each demo (2 minutes)

```sh
npm run demo:agentic:reset                  # removes what the demo's assistants connected and booked, re-seeds
eval "$(npm run -s demo:agentic:inbox -- --init)"   # private inbox for the simulated e-mail codes
npm run dev                                 # same shell, so the server sees BOOKING_CONSENT_INBOX_DIR
```

In a second terminal (export the same `BOOKING_CONSENT_INBOX_DIR`), run the
scripted check once. It must end with `Demo flow passed.`:

```sh
npm run demo:agentic:e2e
```

Then run `npm run demo:agentic:reset` again so the live demo starts clean.

## Live demo with Claude Code (local, recommended)

Claude Code can connect to a loopback MCP address and runs the OAuth sign-in in
your browser. Rehearse this once on the demo computer before the meeting.

```sh
claude mcp add --transport http --scope local cresavo-eko http://127.0.0.1:3217/api/v1/salons/demo/mcp
claude
```

1. In Claude Code, run `/mcp`, choose **cresavo-eko → Authenticate**. The
   browser opens the Salong Eko consent page. Choose **Allow**. Claude Code
   identifies itself with its published client metadata document, so the
   server fetches that document once over HTTPS.
2. Ask: *"Book a foot care appointment at Salong Eko on Monday morning for
   kund@example.test, name Demo Kund."*
3. Claude lists services, checks times and creates a proposal. Open the
   `consentUrl` it shows, type `kund@example.test`, choose **Skicka kod** (send code), then
   in a terminal run `npm run demo:agentic:inbox` to read the code and enter it.
   Choose **Ja, godkänn denna bokning** (yes, approve). The consent page is
   Swedish only today.
4. Tell Claude *"I approved it."* It reads the proposal, books with the
   mandate and shows the confirmation and the reminder time.
5. Optional: open `/admin` to show the booking in the salon calendar.

Remove the connector afterwards with `claude mcp remove cresavo-eko --scope local`.
`npm run demo:agentic:reset` also removes Claude Code's grant and bookings, so
the next run starts with a fresh sign-in.

The reset removes only the demo's own OAuth clients: the scripted assistant's
registrations (listed in the git-ignored `.data/demo-agentic-clients.json`),
Claude Code's published client, and any extra client you name with
`npm run demo:agentic:reset -- --client <client-id>`. Other connections, agent
API keys and ordinary bookings stay. It refuses any database that is not a
local `_demo` or `_test` database.

## Fallback: the scripted assistant

If a live client fails to connect, run the same flow as a script. It plays the
assistant and shows each step:

```sh
npm run demo:agentic:e2e                     # fully automatic, approves with the simulated code
npm run demo:agentic:e2e -- --interactive    # pauses so you approve in the browser yourself
```

In interactive mode the script prints the consent link and waits up to ten
minutes. Type the address it names (default `kund@example.test`, or set
`DEMO_CUSTOMER_EMAIL` to another `@example.test` address), read the code with
`npm run demo:agentic:inbox` and choose **Ja, godkänn denna bokning**. The script then books and
prints the confirmation and the reminder.

The script only talks to a loopback origin and never prints tokens or codes.

## Live ChatGPT and Claude web connectors

ChatGPT custom connectors and Claude web or desktop custom connectors call the
MCP server from the vendor's cloud, so they need a public HTTPS address. The
customer consent lab is deliberately limited to a loopback origin, a guarded
`_test` or `_demo` database and simulated e-mail delivery, and it refuses to run
on Vercel. Connecting those clients therefore needs a product decision, not a
setting:

- a hosted engine on a public HTTPS origin with `AGENT_OAUTH=1`,
- a real customer verification channel to replace the simulated e-mail code,
- an operator-approved setup for the vendor (for ChatGPT: a workspace plan that
  allows custom MCP servers, or OpenAI's Secure MCP Tunnel).

Until then, use Claude Code locally or the scripted fallback above. The
owner-side pairing preview in [CONNECT_AI_ASSISTANT.md](CONNECT_AI_ASSISTANT.md)
is a different flow (the salon owner's assistant, not the customer's).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `404` on `/api/v1/salons/demo/mcp` | `AGENT_OAUTH` is not `1`, or the server runs in split mode. |
| `mandate_denied` on `create_proposal` | Consent lab off: check `BOOKING_CONSENT_LAB=1`, a loopback `BOOKING_PUBLIC_ORIGIN` and a `_demo` or `_test` database. |
| `Inbox unavailable or unsafe.` | `BOOKING_CONSENT_INBOX_DIR` is missing or not the private directory from `--init`; the server and the inbox command need the same value. |
| `Request timed out` on the first run | The development server compiles each route on first use. Run the scripted check again, or use `npm run build` and `npm start` for the demo. |
| `rate_limited` | Each address may create 5 proposals and 5 bookings an hour. After several rehearsals, wait or restart the server before the live demo. |
| `slot_unavailable` | The time was taken; ask the assistant for another time. |
| No free times | Run `npm run demo:agentic:reset` to remove earlier demo bookings. The seed sets staff hours only when it creates the staff, so if you changed hours in `/admin`, change them back there or recreate the `_demo` database and seed again. |
| `invalid_request` on the consent page when connecting Claude Code | The server could not fetch Claude Code's client metadata document (network or DNS). Check outbound HTTPS from the demo computer. |
