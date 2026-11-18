# Integrations (connections)

Each type of external service uses one **port**
per capability, with a **simulated adapter** as the default and real
**provider adapters** behind a flag. Code: `src/concept/connections/`.

- **Ports** (`ports/*.ts`): one typed interface per capability. Every call
  resolves to a `PortResult` with `status`, `cost` and a normalised
  `ConnectionError` (fixed message, `retryable`, optional `retryAfterSeconds`,
  sanitised `providerCode`). Adapters never throw for provider failures.
  `retryable` is only true when a retry cannot do the thing twice: a timeout,
  dropped connection or 5xx on a write without an idempotency key (Twilio,
  46elks, Postmark, Fortnox, Visma, Meta publishing) is not retryable.
- **Locale-neutral contract** (`core.ts`): money is integer minor units plus an
  ISO 4217 currency (`{ amountMinor: 4900, currency: "SEK" }`), phone numbers
  E.164, timestamps UTC ISO 8601 plus an IANA time zone, countries ISO 3166-1
  alpha-2, languages BCP 47.
- **Simulated adapters** (`simulated/`): deterministic, no network, no clock,
  no secrets. Every call records what would have been sent in an outbox. The
  public demo uses nothing else. The concept demo's booking confirmations and
  reminders, due-back time suggestions, waiting-list texts and campaign posts
  go through them (`demo.ts`).
- **Registry** (`server/registry.ts`): picks the adapter per business and
  port, like `src/concept/ai/router.ts` picks a model, and says why.
- **Secrets** (`server/secrets.ts`): read only on the server through a
  `SecretStore`. Today an env-backed store (one business per self-hosted
  install). An encrypted per-business store is planned for the database-backed studio. Names starting with `NEXT_PUBLIC_` are refused.

## When is a provider live?

All of these must hold, otherwise the port is simulated:

1. The deployment is not the public demo (`NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1`
   at build time, or `PUBLIC_READONLY=1`, force simulation whatever else is
   set; the build-time flag is inlined, so no runtime setting can undo it).
2. `CONCEPT_CONNECTIONS_LIVE=1` (the master switch, off by default).
3. The port's provider is selected, for example `CONCEPT_SMS_PROVIDER=twilio`.
4. Every required secret and setting for that provider is set (for example a
   sender for SMS).

`GET /api/concept/connections` shows, per port, the adapter in use, the reason
(`public-demo`, `live-off`, `not-selected`, `unknown-provider`,
`missing-secret`, `missing-setting`, `interface-only`, `live`) and the names
of missing secrets or settings. It never returns a value, and an unknown
provider value is not echoed (it could be a key pasted into the wrong
variable).

Webhooks arrive at `POST /api/concept/connections/webhooks/<provider>`. Only a
live, selected provider is verified; anything else answers 404. A verified
event answers 501 for now (nothing acts on events yet), so providers keep
retrying instead of an event being lost. **Do not register webhooks with a
provider until event handling has landed.**

## Status

Status: **simulated** (the demo default for every port), **ready behind flag**
(live adapter with contract tests, never run against the real provider: no
account was used), **interface only** (documented contract, every call answers
`not_supported`). Costs are the provider's published list prices in their own
currency, checked 2026-11; all are (verify) and exclude VAT.

### Global

| Capability | Provider | Status | What the business needs | Cost (verify) |
|---|---|---|---|---|
| All ports | Simulated | simulated (default) | Nothing | Free |
| SMS | Twilio | ready behind flag | Twilio account, a sender (number, alphanumeric sender ID where allowed, or messaging service); US A2P 10DLC registration for US numbers | USD 0.0646 per segment to Sweden, USD 0.0083 per segment in the US (verify) |
| Email | Resend | ready behind flag | Resend account, verified sending domain (SPF/DKIM DNS records) | Free 3,000/month (100/day); Pro USD 20/month for 50,000 (verify) |
| Email | Postmark | ready behind flag | Postmark account, server token, verified sender signature or domain | Free 100/month; Basic USD 15/month for 10,000 (verify) |
| Email | SMTP | interface only | Any SMTP relay; needs nodemailer (not a dependency today) | Depends on the relay |
| Payments | Stripe (cards, Klarna, Swish, Payment Links, refunds) | ready behind flag | Stripe account with completed verification; Klarna and Swish enabled in the Dashboard; Swish needs a Swedish (or listed) Stripe account, SEK only, 3 to 150,000 SEK | Sweden: cards 1.5% + SEK 1.80 (standard EEA); Swish 1% + SEK 3.00, max SEK 7.00 (verify) |
| Accounting | Xero (manual journals) | not started (table row) | Xero organisation, OAuth app | Developer plans AUD 0 to 1,445/month (verify) |
| Accounting | QuickBooks Online (journal entries) | not started (table row) | QuickBooks company, Intuit app | Developer plans USD 0 to 4,500/month (verify) |
| Calendar | Google Calendar | ready behind flag | Google Cloud project, OAuth consent screen (verification for external users), refresh token with `calendar.events` | No API fee; quota 600 requests/min per user (verify) |
| Calendar | Microsoft Graph | ready behind flag | Entra ID app registration, `Calendars.ReadWrite` + `offline_access`, refresh token | No API fee; 10,000 requests per 10 min per mailbox (verify) |
| Listing | Reserve with Google (Actions Center) | ready behind flag (feeds + booking-server auth only) | **Google partner approval** (interest form, sandbox and production review); feed upload via Partner Portal SFTP; booking-server Basic auth credentials | No fee published (verify) |
| Listing | Google Business Profile posts | not started (table row) | GBP API access approval for the Cloud project ("Application for Basic API Access") | No fee published (verify) |
| Social | Meta (Instagram + Facebook Page) | ready behind flag | Facebook Page + Instagram professional account linked to it; Meta app with **App Review** for `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`; long-lived Page token | No API fee; 50 to 100 API posts per 24 h per Instagram account (verify) |
| Ads | Meta Marketing API (paused campaign draft) | interface only | Ad account, `ads_management` with App Review | Ad spend only |

### Regional: Nordics

| Capability | Provider | Status | What the business needs | Cost (verify) |
|---|---|---|---|---|
| SMS | 46elks | ready behind flag | 46elks account with credit; sender name or number | SEK 0.52 per segment in Sweden (verify) |
| Payments | Swish (through Stripe) | ready behind flag via Stripe | See Stripe; a direct Swish agreement with a bank is **not** needed when Stripe is the acquirer (verify) | See Stripe |
| Payments | Swish (direct, Swish Handel/Commerce API) | not started (table row) | Swish agreement with a Swedish bank, TLS client certificate | Bank tariff (verify) |
| Payments | MobilePay / Vipps (Vipps MobilePay) | not started (table row) | Vipps MobilePay merchant agreement | Agreement tariff (verify) |
| Accounting | Fortnox | ready behind flag | Fortnox with Bookkeeping and the Integration licence; a Fortnox developer app (client id/secret), consent with scope `bookkeeping` | Integration licence SEK 189/month plus Bookkeeping (verify) |
| Accounting | Visma eAccounting / eEkonomi (Spiris) | ready behind flag | eAccounting with the Integration add-on; Visma developer app approved for production; scopes `ea:api ea:accounting offline_access` | Integration add-on SEK 119/month (verify) |
| Accounting | Bokio | interface only | Bokio Premium/Business/Plus with API access; OAuth app | SEK 89/month extra on Premium (verify) |

Other regions get their own table here when their first adapter lands (for
example UK/IE, DACH, North America), with the same columns.

## Provider setup (self-hosters)

General steps for every provider: create the account yourself, put the values
in the server's environment (never in Git, never with `NEXT_PUBLIC_`), select
the provider, set `CONCEPT_CONNECTIONS_LIVE=1`, restart, and check
`GET /api/concept/connections`. Start with the provider's test mode where one
exists. Variable names are in `.env.example`.

### Twilio (SMS)

1. Create an account; note the Account SID and Auth Token (Console → Account).
2. Buy a number or register an alphanumeric sender ID (country rules vary), or
   create a Messaging Service.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` or
   `TWILIO_MESSAGING_SERVICE_SID`; `CONCEPT_SMS_PROVIDER=twilio`.
4. Delivery reports are signed with `X-Twilio-Signature` (HMAC-SHA1 of the
   exact public URL plus sorted POST fields). Behind a proxy set
   `CONCEPT_CONNECTIONS_PUBLIC_ORIGIN` so the URL matches.
5. Twilio has no idempotency key for sends: never retry a send that may have
   gone out.

### 46elks (SMS, Nordics)

1. Create an account and add credit; API username and password are under
   Account.
2. Set `ELKS_API_USERNAME`, `ELKS_API_PASSWORD`, `ELKS_FROM` (max 11
   characters or an E.164 number), optionally `ELKS_CURRENCY` (default SEK);
   `CONCEPT_SMS_PROVIDER=46elks`.
3. 46elks does not sign delivery reports. Set `ELKS_WEBHOOK_TOKEN` (16+
   random characters) and use
   `https://46elks:<token>@<host>/api/concept/connections/webhooks/46elks` as
   `whendelivered`: 46elks sends the credentials as Basic auth, so the token
   never sits in a query string that proxies log. Also allowlist 46elks'
   callback IPs at your proxy.

### Resend (email)

1. Create an account, add and verify your sending domain (DNS records).
2. Create an API key with sending access: `RESEND_API_KEY`;
   `CONCEPT_EMAIL_PROVIDER=resend`.
3. For events, add a webhook and copy its signing secret (`whsec_...`) to
   `RESEND_WEBHOOK_SECRET` (Svix signatures, 5-minute tolerance).
4. Sends carry an `Idempotency-Key` (kept 24 h by Resend).

### Postmark (email)

1. Create a server, verify a sender signature or domain, copy the Server API
   token: `POSTMARK_SERVER_TOKEN`; `CONCEPT_EMAIL_PROVIDER=postmark`.
2. Postmark webhooks have no signature: configure Basic auth credentials on the
   webhook URL and set `POSTMARK_WEBHOOK_USER` and `POSTMARK_WEBHOOK_PASSWORD`
   (16+ characters). Postmark has no idempotency keys.

### Stripe (payments)

1. Create and verify a Stripe account. Use test-mode keys first (`sk_test_`),
   or a restricted key (`rk_`) limited to Checkout Sessions, Payment Links and
   Refunds.
2. Enable the payment methods you want in the Dashboard (Klarna; Swish needs
   an eligible account and SEK).
3. Set `STRIPE_SECRET_KEY`; `CONCEPT_PAYMENTS_PROVIDER=stripe`.
4. Add a webhook endpoint for `checkout.session.completed`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `refund.updated`; copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
5. The adapter pins `Stripe-Version` (see `STRIPE_VERSION`), sends an
   `Idempotency-Key` on every POST, and checks `Stripe-Signature` with a
   300-second tolerance.

### Fortnox (accounting, Nordics)

1. Register as a Fortnox developer and create an app (client id and secret),
   scope `bookkeeping`.
2. The business needs Bookkeeping and the Integration licence, then approves
   the app (authorization code flow) to get a refresh token.
3. Set `FORTNOX_CLIENT_ID`, `FORTNOX_CLIENT_SECRET`, `FORTNOX_REFRESH_TOKEN`,
   optionally `FORTNOX_VOUCHER_SERIES` (default `A`);
   `CONCEPT_ACCOUNTING_PROVIDER=fortnox`.
4. Known gap: Fortnox rotates the refresh token on every refresh. The adapter
   keeps the new one in memory, so a running server keeps working, but after a
   restart the env token is stale and you must re-consent until the
   planned per-business store can save it (verify). Rate limit 25 requests
   per 5 seconds.

### Visma eAccounting / eEkonomi (accounting, Nordics)

1. Register at the Visma developer portal; production access needs approval.
2. The business needs the Integration add-on and consents with
   `ea:api ea:accounting offline_access`.
3. Set `VISMA_CLIENT_ID`, `VISMA_CLIENT_SECRET`, `VISMA_REFRESH_TOKEN`;
   `CONCEPT_ACCOUNTING_PROVIDER=visma-eaccounting`. Same refresh-token caveat
   as Fortnox (verify).

### Google Calendar

1. Create a Google Cloud project, enable the Calendar API, configure the OAuth
   consent screen, create a Web OAuth client.
2. Run the consent flow once with `access_type=offline` and scope
   `https://www.googleapis.com/auth/calendar.events` to get a refresh token.
3. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_CALENDAR_REFRESH_TOKEN`; `CONCEPT_CALENDAR_PROVIDER=google-calendar`.
4. Events get a deterministic id from the booking id; a push that answers 409
   (a retry or a moved booking) updates the existing event. Pulls use sync
   tokens; a 410 asks for a full resync, and `nextPageToken` continues a pull
   with more pages than one call reads. All-day events are read in the
   calendar's own time zone; cancelled and "free" events are reported as
   `cancelled` so a stale block is removed.

### Microsoft Graph (Outlook calendar)

1. Register an app in Entra ID with a client secret and delegated
   `Calendars.ReadWrite` and `offline_access`.
2. Run the consent flow once to get a refresh token.
3. Set `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_REFRESH_TOKEN`,
   `MS_GRAPH_TENANT` (tenant id or `common`) and `MS_GRAPH_USER` (user id or
   address); `CONCEPT_CALENDAR_PROVIDER=microsoft-graph`.
4. v1.0 delta sync covers the primary calendar only (verify); pulling another
   calendar answers `not_supported`.

### Reserve with Google (listing)

1. Apply through Google's partner interest form. Without approval there is no
   Partner Portal, no feed dropbox and no booking traffic.
2. After approval: upload the merchant, service and availability feeds the
   adapter builds (`buildFeeds`) to the Partner Portal SFTP dropbox and run the
   feed validator; field names are marked (verify) in
   `providers/listing/reserve-feeds.ts`.
3. Set booking-server credentials in the Partner Portal and the same values in
   `GOOGLE_RESERVE_BOOKING_USER` and `GOOGLE_RESERVE_BOOKING_PASSWORD` (16+
   characters); `CONCEPT_LISTING_PROVIDER=google-reserve`.
4. Not built yet: the booking-server routes themselves (they must call the
   booking engine's double-booking protection, not a copy of it) and real-time
   updates (need a service-account token).

### Meta (Instagram and Facebook publishing)

1. Create a Meta app (Business type), add Facebook Login and the Instagram
   Graph API, link the Instagram professional account to the Facebook Page.
2. Request Advanced Access through **App Review** for
   `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`
   and `pages_show_list` (Standard Access only works for app roles).
3. Get a long-lived Page access token. Set `META_PAGE_ACCESS_TOKEN`,
   `META_APP_SECRET`, `META_PAGE_ID`, `META_INSTAGRAM_USER_ID`;
   `CONCEPT_SOCIAL_PROVIDER=meta`.
4. Every call sends `appsecret_proof`; the token travels in the POST body or
   the Authorization header, never in the URL. Images must be public HTTPS
   JPEG/PNG. The adapter waits (bounded) for the media container to finish
   before publishing. Publishing is not idempotent.

## Add a new provider

Follow these steps to add one adapter. Use `providers/sms/twilio.ts` as the
model.

1. **Pick the port.** Use an existing one from `ports/`. If the provider can do
   less, list fewer capabilities; if it needs more, extend the port in a
   separate commit and update the simulated adapter and its test first.
2. **Verify the API.** Read the provider's current docs for endpoint, auth,
   payload, errors, rate limits, idempotency and webhook signing. Put the
   source URLs in a comment at the top of the file, with the date. Mark
   anything not confirmed with `// verify:` and keep that part conservative
   (refuse rather than guess).
3. **Write the adapter** in `providers/<port>/<provider>.ts`:
   - a factory taking typed options plus `fetch` (never the global one), and a
     `definition: ProviderDefinition<"port">` with `info` (id, `kind: "live"`,
     capabilities, `region` for regional providers, secret names), required
     and optional `secrets`, non-secret `settings`, and `create`;
   - all HTTP through `request()` in `server/http.ts`, with a `codeOf` that
     maps provider error bodies to codes, a `secrets` list in the context, and
     `{ idempotent: false }` for writes the provider cannot de-duplicate;
   - `missingSettings` for required non-secret settings (a sender, a user id);
   - validate input before any request (E.164, ISO currency, UTC times,
     balanced vouchers) and return `invalid_input` or `not_configured`;
   - send the provider's idempotency key when it has one;
   - verify webhooks with `safeEqual` from `server/crypto.ts`, over the raw
     body, with a timestamp tolerance where the provider signs one;
   - never log, and never put a provider message, URL or header in a result.
4. **Register it** in `providers/index.ts` and add its variables, empty and
   commented, to `.env.example`. Secret names are upper case and never start
   with `NEXT_PUBLIC_`.
5. **Test it** in a `tests/concept-connections-*.test.ts` file with
   `scriptedFetch` from `tests/helpers/connections-fetch.ts`: request URL,
   method, auth header and body; idempotency header; success mapping; at least
   401, 429 (with `Retry-After`), 5xx, timeout and network errors; webhook
   accept, tamper, stale and missing-secret cases, using a published test
   vector when the provider has one. The shared secret test picks the new
   provider up from `PROVIDERS` automatically; add its secrets there.
6. **Document it** with a row in the right table above (global or a region),
   a setup section, and a `CHANGELOG.md` entry.
7. Never run it against a real account from CI or the demo. A real-account
   check is a separate, owner-approved step.
