# Brand and naming

**Name:** Cresavo. **Tagline:** "More time. On your terms."

History in one line: the project started as Booking Lab, was briefly called
Flerdo and then Libovo (November 2026), and has been Cresavo since the brand
concept v0.1 of 2026-11-17. Technical identifiers from the earlier names
were deliberately not renamed (see below).

## Messaging

Give equal weight to two promises: **simple for the salon** and **open source and truly yours**.
Lead with the owner's day. Use the tagline “More time. On your terms.” and the introduction
“The simple, open-source booking app for salons and clinics. Bookings, clients and everything
around them, in one calm app.” Invite the reader to try the demo and see the code on GitHub.

“Open source. Truly yours.” means the AGPL-3.0-only source is public, owners can self-host
or choose hosting, and they can export their data at any time. Describe hosted booking as a
fixed monthly price with no booking commission. Card payment fees are separate and shown up front.

**AI-ready, never AI-required.** Plain controls work throughout the app. An owner can connect
ChatGPT, Claude or their own agent to look things up and draft changes. The owner approves
changes and can use Undo. Distinguish today's owner MCP connection from customer-agent booking,
which is coming soon. Introduce optional AI after the everyday salon workflow.

## Where the brand lives

- `src/concept/brand.ts` holds the product name and tagline (`BRAND`) and the
  assistant label (`ASSISTANT`). Every user-facing mention reads from there;
  `tests/brand.test.ts` fails if the name is written out anywhere else in `src/`.
- `design/brand/cresavo-v0.1/` is the brand concept (wordmark, symbol
  concepts, tokens, typography, voice). `design/brand/libovo-v0.9/` is the
  earlier kit. Both are kept verbatim; do not edit them. A new version goes
  into its own folder.
- The design tokens in code are `src/concept/ui/brand-theme.css`, checked
  against the kit's `tokens/colors.json`; the application stylesheet is
  [brand-theme.css](../src/concept/ui/brand-theme.css).
- Use of the name, wordmark and media: [TRADEMARK.md](../TRADEMARK.md).

## How the name is used

One brand, no sub-brands towards customers. Inside the product, areas use
plain words.

| Level | Name | Example |
|---|---|---|
| Product | **Cresavo** | "Cresavo: more time. On your terms." |
| Areas in the app | Plain words | Today, Calendar, Customers, Inbox, Finance |
| Assistant | **Assistant** (no persona name) | The "Assistant" button in the studio |
| Customer booking page | The business's own brand | Platform attribution is off by default (`TENANT_POLICY`) |
| Domains | `cresavo.com` (coming soon, waiting list), `demo.cresavo.com` (demo) | |

No "AI" in the product name: the product never requires AI, and many owners
are wary of it. The demo business stays "Salong Eko", a fictional customer.

## Technical identifiers were not renamed

Environment variables, storage keys, API routes, MCP server names and
namespaces, the package name `booking-lab-se` and database identifiers keep
their earlier names. Renaming them would break stored demo state, client
configurations and tests for no user-facing gain. A rename, if any, happens
in one deliberate pass, never piecemeal. Use Cresavo in new user-facing text.
