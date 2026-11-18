# Brand and naming

**Name:** Cresavo. **Tagline:** "More time. On your terms."

History in one line: the project started as Booking Lab, was briefly called
Flerdo and then Libovo (November 2026), and has been Cresavo since the brand
concept v0.1 of 2026-11-17. Technical identifiers from the earlier names
were deliberately not renamed (see below).

## Messaging

Keep it simple. Use short words and give each idea its own line. Let people ask for the details.

Cresavo is the simple, open-source alternative to the big booking platforms.
Run your salon in one calm app. Your data and your brand stay yours.
Pay no commission on bookings. Your AI assistant can draft changes. You approve.

## Where the brand lives

- `src/concept/brand.ts` holds the product name and tagline (`BRAND`) and the
  assistant label (`ASSISTANT`). Every user-facing mention reads from there;
  `tests/brand.test.ts` fails if the name is written out anywhere else in `src/`.
- `design/brand/cresavo-v0.1/` is the brand concept (wordmark, symbol
  concepts, tokens, typography, voice). `design/brand/libovo-v0.9/` is the
  earlier kit. Both are kept verbatim; do not edit them. A new version goes
  into its own folder.
- The design tokens in code are `src/concept/ui/brand-theme.css`, checked
  against the kit's `tokens/colors.json`; the frontend guide is
  [design/LIBOVO.md](design/LIBOVO.md) (its file name is from the earlier kit).
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
namespaces (for example `flerdo-demo`, `x-flerdo`), the package name
`booking-lab-se`, database tables, file names and the repository name keep
their earlier names. Renaming them would break stored demo state, client
configurations and tests for no user-facing gain. A rename, if any, happens
in one deliberate pass, never piecemeal. New user-facing text says
"Cresavo", never "Booking Lab", "Flerdo" or "Libovo".

## Decision: keep the name despite a Polish product called Cresavo

Decided by Niclas on 2026-11-18.

- **Finding:** a Polish product uses the name Cresavo (cresavo.pl). It
  appears inactive.
- **Decision:** keep Cresavo and accept the risk.
- **Risk:** a name conflict or confusion in the EU, a later trademark claim,
  or having to rename after launch (domains, wordmark, copy). Cresavo is not
  registered as a trademark by this project.
- **What would trigger a rethink:** the Polish product becoming active again;
  a trademark filing for Cresavo by them or anyone else; or a complaint from
  the name's other user. Any of these goes straight to Niclas, who decides
  whether to rename.

## Owner to-dos (only Niclas)

- [ ] Trademark search (EUIPO TMview, classes 9 and 42) before any filing.
- [ ] Decide whether to register the name.
