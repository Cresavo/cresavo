# Cresavo API platform

Owners can build websites, dashboards and tools on their Cresavo data. The
studio will use the same API, with booking rules shared by every client.
The [architecture decisions](ARCHITECTURE_DECISIONS.md) record the accepted design.

## Current interfaces

The concept demo runs on fictional fixtures and browser state. Assistant
pairing uses a temporary fictional workspace. The separate database engine
serves public booking routes, a consent-based customer agent API v1 with
OpenAPI, cookie-authenticated admin routes and a trusted local MCP server.
A scoped owner API against persistent salon data, search and pagination,
outbound events, a headless booking-page profile and full API export are planned.

## API parity

Every feature declares its resources in the module manifest or always-on core
list. Design each feature for REST with OpenAPI, MCP, change events and export,
subject to the data access rules below. Generate OpenAPI from the validation
schemas and document changes in a versioned changelog with a deprecation policy.
Plan for a full account export in JSON and CSV and support AGPL self-hosting.

The table records implemented coverage, including partial coverage in the
legacy engine and demo. REST reads include public, admin and paired studio
endpoints. Write records `propose` for owner-reviewed MCP changes, otherwise
`available` for direct REST writes. Bookings and services also have direct
REST writes. MCP includes the paired owner tools and concept MCP. For example,
salon opening hours and the booking-page profile have partial reads through
`get_business`. The photo library and logo are read and written through the
signed-in owner's `/api/owner/media` routes; only the active logo has a public address.
The paired studio session returns inbox items, and the demo AI settings route
reads and updates task settings. Events refer to outbound change notifications.
`planned` marks a coverage gap, subject to the security model. Journal and
health notes are excluded from API access.

Regenerate after declaration changes with `node --import tsx scripts/api-parity-table.mjs`.

<!-- api-parity:start -->
| Area | Resource | REST read | Write | MCP | Events |
| --- | --- | --- | --- | --- | --- |
| core | bookings | available | propose | available | planned |
| core | customers | available | available | available | planned |
| core | services | available | propose | available | planned |
| core | staff | available | available | available | planned |
| core | hours | planned | planned | available | planned |
| core | booking-page-profile | planned | planned | available | planned |
| core | inbox | available | propose | available | planned |
| core | media-library | available | available | planned | planned |
| journal | journal | planned | planned | planned | planned |
| stock | stock | planned | propose | available | planned |
| campaigns | campaigns | planned | planned | available | planned |
| finance | finance | planned | planned | available | planned |
| reviews | reviews | planned | planned | planned | planned |
| waitlist | waitlist | planned | planned | planned | planned |
| assistant | assistant-settings | available | available | planned | planned |
| assistant | assistant-memory | planned | planned | planned | planned |
| assistant | assistant-routines | planned | planned | planned | planned |
| giftcards | gift-cards | planned | planned | planned | planned |
| giftcards | packages | planned | planned | planned | planned |
| domain | domains | planned | planned | planned | planned |
<!-- api-parity:end -->

## Sandbox

Serve deterministic fictional data from the server. A test booking returns a
simulated confirmation and appears in the creator's demo studio as "Test booking
from your website". The studio polls while visible. Store bookings server-side
for 24 hours, isolated by `sandbox_session`, with up to 20 per session and
per-IP limits. Each session has its own demo state.

## Security model for v1

- Public sites use a publishable site key and an origin allow-list. The public
  surface serves the profile, hours, categories, services and prices, staff
  display names, free slots and booking creation. An unguessable token permits
  viewing or cancelling its own booking. Public surfaces exclude customer
  records, booking lists and counts, notes, revenue and staff personal data.
  APIs exclude secrets, other tenants' data, journal and health notes, raw IPs
  and card data. Credentials are handled only by their dedicated flows.
- Private tools use OAuth 2.1 with PKCE, 15-minute access tokens and refresh
  rotation with reuse detection. Read and write scopes are separate by area.
  Self-hosters can create scoped, hashed `crsv_pat_` tokens expiring after
  90 days. Third-party owner access uses OAuth.
- Writes default to owner approval. Direct writes require a write scope, an
  idempotency key and an audit record. Payments, refunds, bulk deletion, sending
  campaigns, full export and owner login changes have no direct v1 operation.
- Connected tools shows public API settings and origins, granted scopes and
  last use. Owners can revoke tools or pause them all. New salons enable the
  public API when they publish their booking page. Tools, direct write scopes,
  webhooks and personal access tokens start disabled or absent. Full export
  starts in the studio.
- Limit public reads to 60/minute per IP and 600/minute per salon. Limit booking
  creation to 5/hour per IP, 3 active per contact and 30/hour per salon, with a
  challenge when limits are hit. Limit owner tokens to 120/minute and 10,000/day,
  and exports to 2/day.
- Minimize owner lists by scope, avoid public customer-keyed lookups and return
  uniform 404s for invalid booking tokens. Fight booking spam with pending
  confirmation, a honeypot and an approval mode. Delimit notes as untrusted
  input and enforce approval and write scopes independently of tool text.
- Webhooks use HTTPS and HMAC signatures, block private network destinations
  and reject redirects. Browser tools use PKCE public clients. Exports require
  reauthentication and an email notice, with a download link that expires in
  one hour.
- Log actor, tool, scope and IP hash. Notify owners about new tools, newly
  granted write scopes, exports, bulk reads, spikes and token reuse.

## Consent and liability

**Lawyer review required, not legal advice.** The planned account flow records
versioned B2B terms and a data processing agreement for GDPR Article 28. Review
acceptable use, responsibility for connected tools, the proposed cap of 12
months of fees, indirect loss and warranties for self-built sites. Validate
the treatment of processor duties and data-subject liability, intentional
misconduct and gross negligence, section 36 of the Swedish Contracts Act, and
the salon's consumer and marketing consent obligations with counsel.

Use a just-in-time `ConsentSheet` for private tool access, write scopes,
public API activation or new origins, personal access tokens, full exports
or contact-field scopes, webhooks, fees and deposits, live SMS or email,
support access and bulk imports. Record the text version and hash in
`consent_record`. Owners can revoke grants under Settings → Access and approvals.

## Delivery phases

| Phase | Scope |
| --- | --- |
| 0 | Declare API parity, test it and publish this plan. OpenAPI for the existing public booking routes is a separate follow-up. |
| 1 | Public website API v1 for profile, hours, closures, categories, services, staff, availability and booking with consent and token-based viewing or cancellation. Add CORS, rate limits and the sandbox. |
| 2 | Add copy-ready studio prompts for building a website with the public API or a dashboard with OAuth and MCP. Include the salon's API base, branding and rules. |
| 3 | Add scoped owner reads, filtering, cursor pagination and an authenticated full-account export on the pilot store. |
| 4 | Add signed, retried and replayable webhooks and a change feed for bookings, customers, payments and inbox. |
| 5 | Add scoped direct owner writes alongside proposal and approval, with audit and idempotency. |

Phases 3–5 depend on the pilot data store.
