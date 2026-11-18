# Launch waiting list

The form is on cresavo.com (coming soon) and at the end of the demo landing.
It posts to `POST /api/waitlist`. **Today nothing is stored**: the provider is
`none`, and the page says "Thanks! The list opens in a few days. Come back
soon." It never claims the person was added. The owner picks a provider; this
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
| **Resend Audiences** | Resend is a developer email API; Audiences is its contact list with Broadcasts for sending. Useful if Resend also sends the product's booking emails later (goal 20). | Free tier around 1,000 contacts and 3,000 emails a month, then a monthly fee. | US company; sending regions include the EU (Ireland), contact data is stored with the account in the US. DPA available. | Not built in: we would send our own confirmation email and mark the contact confirmed. | Medium: sign-up call plus our own confirmation flow. |
| **Own Postgres (Neon, EU region)** | One table in a database we control: email, kind of business, created, confirmed, unsubscribe token. We send the launch email with any provider on the day. | Free tier is enough; then a few dollars a month. | Our choice: Neon has EU regions (Frankfurt). Neon is a US company, so a DPA still applies. | We build it: a confirmation email needs a sending provider anyway. | Largest: table, confirmation and unsubscribe links, an export, and a sender. |

## GDPR notes

- **Lawful basis is consent.** The consent line next to the button says what
  the address is used for ("only about the launch") and that people can
  unsubscribe. Keep the purpose that narrow, or ask again later.
- **Double opt-in is recommended** (and expected practice in Sweden and
  Germany): it proves the owner of the address asked, and keeps typos and
  malicious sign-ups off the list.
- **Collect little.** Email and the optional kind of business only. No names,
  no IP address stored with the entry, no tracking pixels in the launch email
  unless the policy says so.
- **EU hosting is preferable but not required.** A US processor needs a signed
  DPA with standard contractual clauses (or Data Privacy Framework
  certification) and must be named in the privacy policy.
- **Every email needs an unsubscribe link**, and removal must be prompt. A
  hosted list tool does this for us.
- **Retention:** delete the list a set time after launch (for example six
  months) unless people opted in to more.
- `/privacy` is a short stub today and says honestly that nothing is stored.
  It must become a real policy (controller identity, contact, processor,
  retention, rights) **before** a provider is switched on.

## Recommendation

**Buttondown**, for the waiting list only.

- It is the least to build and the least to get wrong: double opt-in,
  unsubscribe and the launch email are done, so one adapter call finishes the
  work.
- The list is small and short-lived; it does not need automations (Loops) or
  our own tables (Postgres).
- It keeps the waiting list separate from the product's future transactional
  email, so that decision (goal 20) stays open.

Choose **own Postgres in an EU region** instead if keeping all personal data
on infrastructure we control matters more than a day of extra work. Choose
**Resend** only if it is already decided as the product's email provider.

The owner decides. Until then the provider stays `none`.
