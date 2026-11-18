# Launch waiting list

The form is on cresavo.com (coming soon) and at the end of the demo landing.
It posts to `POST /api/waitlist`. **Today nothing is stored**: the provider is
`none`, and the page says "Thanks! The list isn't open yet, so your address
was not saved. Please come back later." It never claims the person was added. The owner picks a provider; this
note compares the options.

## What is built

| Part | Where | Notes |
|---|---|---|
| Form | `src/concept/site/waitlist-form.tsx` | Email, optional kind of business (salon, clinic, other), consent line with a link to `/privacy`. Works without JavaScript (the server redirects back with `?waitlist=<outcome>`). |
| Route | `src/app/api/waitlist/route.ts` | JSON or form post. Stays open when `PUBLIC_READONLY=1`. |
| Rules | `src/concept/site/waitlist.ts` | Email format and 254-character cap, honeypot field (`website`), 5 tries per 10 minutes per client in memory, provider adapter. |
| Route helpers | `src/concept/site/waitlist-server.ts` | The rate-limit key from the verified client address (`scripts/client-address.mjs`: signed by `scripts/server.mjs`, or Vercel's `x-real-ip`; never `X-Forwarded-For`) and a streaming 2,000-byte body cap (413). |
| Tests | `tests/site-waitlist.test.ts` | Validation, honeypot, rate limit, the `none` provider, the route, read-only mode. |

Configuration is by environment only: `WAITLIST_PROVIDER = none | resend |
buttondown | loops | postgres` (unset or unknown means `none`). No keys in
code. A provider that is named but not built yet behaves like `none`, so the
page cannot claim an address was saved before an adapter exists. The address
is never logged. The in-memory rate limit is per server instance (on Vercel,
per warm function); it slows a script down and is not a guarantee. The route
counts a try before it reads the body, and requests whose address cannot be
verified share one bucket. Before a real provider is connected, also limit
`/api/waitlist` at the platform's firewall or move the counter to a shared store.

To connect a provider: add one adapter function to `ADAPTERS` in
`waitlist.ts` that returns `"added"` after the provider accepted the address,
read its key from `process.env`, set the two variables on the deployment, and
update `/privacy` (`privacy.waitlist.body` in `src/concept/site/en.ts`) to
name the provider and where the data is stored.

## Options

Prices are list prices as I know them and change often. **Check each
provider's pricing and data-processing pages before deciding**; I could not
open them from this build environment.

| Option | What it is | Cost at our size (under ~1,000 addresses) | Data location | Double opt-in | Effort |
|---|---|---|---|---|---|
| **Buttondown** | A small, plain newsletter tool with an API. Handles the list, the confirmation email, unsubscribe and sending the launch email. | Free for a small list (around 100 subscribers), then a low monthly fee. | US company. Offers a DPA; data is processed in the US under standard contractual clauses. | Built in, on by default. | Small: one API call per sign-up. |
| **Loops** | Email for SaaS products: lists, simple automations ("welcome", "we launched"), transactional email later. | Free tier around 1,000 contacts, then a monthly fee that grows with contacts. | US company; DPA available. | Supported, must be switched on. | Small: one API call. |
| **Resend Audiences** | Resend is a developer email API; Audiences is its contact list with Broadcasts for sending. Useful if Resend also sends the product's booking emails later. | Free tier around 1,000 contacts and 3,000 emails a month, then a monthly fee. | US company; sending regions include the EU (Ireland), contact data is stored with the account in the US. DPA available. | Not built in: we would send our own confirmation email and mark the contact confirmed. | Medium: sign-up call plus our own confirmation flow. |
| **Own Postgres (Neon, EU region)** | One table in a database we control: email, kind of business, created, confirmed, unsubscribe token. We send the launch email with any provider on the day. | Free tier is enough; then a few dollars a month. | Our choice: Neon has EU regions (Frankfurt). Neon is a US company, so a DPA still applies. | We build it: a confirmation email needs a sending provider anyway. | Largest: table, confirmation and unsubscribe links, an export, and a sender. |

## GDPR notes (before a provider is switched on)

Not legal advice; have the final texts reviewed. All of these must be done
**before** the first real sign-up is accepted:

- **Controller and contact.** `/privacy` must name the controller (the
  maintainer's full legal name, an individual in Sweden, or a company) and a
  working private contact. Neither exists in the repository yet.
- **Lawful basis is consent**, given by a clearly labelled, voluntary submit
  action. Change the button to "Email me when Cresavo launches" and the line
  next to it to: "I agree that [controller] may use my email to confirm this
  request and send me one launch announcement. I can withdraw at any time
  through the link in every email." After submitting, show "Check your inbox
  to confirm your request."
- **Double opt-in and evidence.** Treat a provider's "accepted" as
  unconfirmed. Record the sign-up time, the notice version and the
  confirmation state, and delete unconfirmed entries after a set period (for
  example 30 days). Swedish marketing law requires prior consent for this kind
  of email.
- **Collect little.** Email only; keep the optional kind of business only if
  `/privacy` explains why. No names and no IP address stored with the entry.
- **Processor and transfers.** Sign the provider's data processing agreement
  (GDPR Article 28) and, separately, verify where data is processed and which
  transfer mechanism applies (Chapter V: adequacy such as the EU-US Data
  Privacy Framework only if the provider is actually certified, otherwise
  standard contractual clauses). Name the provider or its category on
  `/privacy`.
- **No tracking.** Disable open and click tracking for this list; mentioning
  a tracking pixel in the policy does not make it allowed.
- **Every email needs an unsubscribe link**, and removal must be prompt.
- **Retention:** delete confirmed entries at a set time after launch (for
  example six months) or at withdrawal, and keep only a minimal suppression
  record if one is needed, with its own period.
- **Rights.** `/privacy` must explain access, correction, erasure,
  restriction, portability and objection where they apply, that withdrawal
  does not affect earlier processing, and the right to complain to IMY.

## Recommendation

**Buttondown**, for the waiting list only.

- It is the least to build and the least to get wrong: double opt-in,
  unsubscribe and the launch email are done, so one adapter call finishes the
  work.
- The list is small and short-lived; it does not need automations (Loops) or
  our own tables (Postgres).
- It keeps the waiting list separate from the product's future transactional
  email, so the email provider decision stays open.

Choose **own Postgres in an EU region** instead if keeping all personal data
on infrastructure we control matters more than a day of extra work. Choose
**Resend** only if it is already decided as the product's email provider.

The owner decides. Until then the provider stays `none`.
