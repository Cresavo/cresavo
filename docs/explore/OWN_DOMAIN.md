# Own domain: how a business connects its address

Exploration for Niclas, 2026-11-18. Proposal only: nothing here is built or
decided. Items marked **(verify)** come from memory and must be checked
against the provider's current documentation before we rely on them.

**Recommendation in one line:** start every business on a subdomain such as
`boka.salongsolgarden.se` (one CNAME record, email untouched, nothing else
changes), and offer the whole domain (`salongsolgarden.se`) only together
with a salon site, at a planned switch date, with a checklist that protects
email.

## 1. The four options

| | What the customer sees | What the owner changes | Risk to email | Risk overall |
|---|---|---|---|---|
| a. Subdomain via CNAME | `boka.salongsolgarden.se` shows our booking page | One CNAME record | None (MX untouched) | Low |
| b. Whole domain (apex) | `salongsolgarden.se` is our salon site + booking | A/ALIAS record, or name servers | Real if name servers move | Medium |
| c. "Book" link only | Their old site, button goes to our page | A link on their site | None | Very low |
| d. Widget embed | Our booking form inside their old site | Paste iframe code | None | Low |

### a. Subdomain (CNAME): the default

- **Pros:** one record, no effect on the existing site or email, easy to undo
  (delete the record). This is what we already built (goal 17).
- **Cons:** the address is slightly longer; the main site stays wherever it
  is today. Needs access to the DNS control panel.
- **Risk:** low. The only way to break something is to edit or delete the
  wrong record. We tell the owner to *add* a record and touch nothing else.

### b. Whole domain (apex): only with a salon site

- **Pros:** one address for everything; we can host a one-page salon site
  plus booking (see `WEBSITE_SERVICE.md`); fully out of the old platform.
- **Cons:** the old site disappears the moment the record changes; old page
  addresses need redirects; an apex cannot hold a CNAME, so the owner needs
  an A record, or ALIAS/ANAME/"CNAME flattening" if their DNS host offers it.
- **Risk to email:** changing the A record of the apex does **not** touch MX.
  Moving the *name servers* (letting someone else host all DNS) **does**: every
  record, MX, SPF, DKIM, DMARC and any verification TXT, must be copied first
  or email stops. DNSSEC adds a trap: switching name servers with an old DS
  record left at the registry can take the whole domain offline **(verify the
  exact .se procedure)**.
- **Our recommendation:** change only the A record (and `www`), never move
  name servers as part of onboarding.

### c. "Book" link from the existing site

- **Pros:** zero DNS work; works with any site builder; good first week.
- **Cons:** customers leave their site for our address
  (`salongsolgarden.cresavo...` or `boka.salongsolgarden.se` once a is done).
  If the old platform owns the site template, it may not let you change its
  own booking button.
- **Risk:** very low.

### d. Widget embed (iframe)

- **Pros:** booking stays inside their site; code exists today
  (`src/concept/booking/share.ts`, More → Settings → Booking widget).
- **Cons:** iframes feel less native (height, scrolling on phones); some
  hosted site builders do not allow iframes or third-party code; analytics and
  SEO credit stay with the old site.
- **Risk:** low, but support-heavy ("it looks cut off on my phone").

**Combination that works for most:** a + c (subdomain for booking, the old
site links to it). b comes later, together with the salon site.

## 2. How it works technically for us

What exists (goal 17):

- `src/concept/page/resolve.ts`: `resolveHost` turns the `Host` header into a
  business: product domain, demo subdomain, `<slug>.<product>`, or an own
  domain looked up in a `Directory` (`domains: host → slug`).
- `src/proxy.ts`: calls `routeHost`, which rewrites `/` on a business address
  to `/boka/<slug>` and only serves that business's booking paths.
- `src/concept/page/domain.ts`: `checkDomain` validates input and **rejects
  apex domains** ("apex" problem); `dnsInstruction` gives one CNAME to
  `cname.vercel-dns.com`; statuses `waiting-dns → verifying → secure`.
- `src/concept/server/vercel-domains.ts`: adds/reads/removes the domain on
  the Vercel project, behind `CONCEPT_DOMAINS_ENABLED=1`, off by default.
- `src/app/api/concept/domains/route.ts`: has **no login** (issue #14); must
  stay off until real authentication exists.

How Vercel multi-tenant domains work (verify all endpoint versions):

1. We add the customer's host to our one project:
   `POST /v10/projects/{id}/domains {name}`. No new deployment needed.
2. The owner adds the DNS record. Subdomain: CNAME to the target Vercel
   shows for that domain (Vercel now hands out project-specific CNAME
   targets in some cases, not only `cname.vercel-dns.com` **(verify)**). Apex:
   A record to Vercel's anycast IP (historically `76.76.21.21` **(verify)**).
3. If the domain (or its parent) is already used in another Vercel account,
   Vercel asks for a TXT record `_vercel.<domain>` with a token; the project
   domain response then carries a `verification` array and
   `POST /v9/projects/{id}/domains/{host}/verify` completes it **(verify)**.
4. `GET /v6/domains/{host}/config` reports `misconfigured`; when DNS is right,
   Vercel issues a Let's Encrypt certificate automatically, usually within
   minutes.
5. Limits and cost: number of custom domains per project and plan
   (Hobby/Pro/Enterprise, "Vercel for Platforms") **(verify before pricing)**.

Gaps between our code and a real launch:

| Gap | What to build |
|---|---|
| Directory is a fixture (`directory.ts`) | A `custom_domain` table (host unique, tenant, kind sub/apex, status, verified_at). The proxy reads it through a small cache (or Edge Config) so every request does not hit the database. |
| `statusFrom` ignores Vercel's TXT challenge | A fourth state "Needs one more record" that shows the TXT name and value. Today such a domain would sit at "Waiting for DNS" forever. |
| Anyone could claim any host | Our own ownership proof: a TXT `_cresavo.<host>` with a per-business token, checked before we map the host. Stops one tenant from taking a domain that already points at us. |
| `checkDomain` rejects apex | Allow apex when the salon-site option is on; show A record (+ `www` CNAME) instead; redirect `www` → apex (or the reverse) in `routeHost`. |
| `routeHost` serves only booking paths | For apex sites: serve the salon site at `/` and keep booking at `/boka` paths; 301 redirects for the old site's important URLs (table per tenant). |
| Faster, clearer feedback | Our own DNS lookup (CNAME/A/NS of the host) to say "we see a record pointing to X" and to recognise the DNS provider by its name servers, so the guide can name it. |
| Leaving | Removing the domain from the project when a business leaves or disconnects, and a goodbye page for 30 days. |
| No auth on the endpoint | Precondition: real login (goal 11/12) before `CONCEPT_DOMAINS_ENABLED=1`. |

## 3. Getting free of lock-in (general, any provider)

Three different roles, often confused:

1. **Registrar**: where the domain is registered and renewed. Controls who
   *owns* it (the domain holder) and which name servers it uses. For .se the
   registry is Internetstiftelsen; you always buy through a registrar.
2. **DNS host**: whoever runs the name servers. Controls the records (A,
   CNAME, MX, TXT). Often the registrar, sometimes the site platform.
3. **Site/booking host**: where the website and booking live. Only needs the
   records to point at it.

The domain **holder** (the legal owner) should be the salon's company or the
owner personally, never the platform. If the platform is listed as holder,
that is the real lock-in and must be fixed first.

How to check in practice:

- **WHOIS for .se:** Internetstiftelsen's WHOIS search on their website, or
  `whois salongsolgarden.se` in a terminal. It shows registrar, name servers,
  status, expiry date and DNSSEC. Holder details for private persons are
  usually hidden **(verify what is shown today)**.
- **Name servers** tell you the DNS host (`dig NS salongsolgarden.se`).
- **MX records** tell you where email lives (`dig MX salongsolgarden.se`):
  Google, Microsoft, the registrar's own mail, or the platform.
- **The registrar's control panel:** log in (or ask who has the login) and
  confirm the holder, the renewal date and who pays.

Moving the domain to another registrar (.se, general process **(verify with
Internetstiftelsen and both registrars)**):

1. Make sure the holder is correct and the contact email works.
2. Ask the current registrar for the **authorisation code** (transfer code /
   EPP auth code).
3. Give the code to the new registrar and start the transfer there. For .se
   this is usually quick (hours to a day) and typically adds no renewal year
   **(verify)**.
4. Name servers and records normally carry over unchanged; check afterwards.

**A registrar transfer is not needed for us.** To use our booking page, the
owner only needs to be able to *edit DNS records*. Move registrar only if the
current one will not give DNS access or is the platform itself.

What to ask the current provider for (in writing):

- Confirmation of who the domain holder is, and the auth code if they are the
  registrar.
- DNS access, or that they add one CNAME (and later an A record) for us.
- A full export of the DNS zone (all records), before anything changes.
- Customer register, booking history, future bookings, outstanding gift
  cards and punch cards, in a machine-readable format (CSV/JSON). The right to
  data portability under GDPR may apply **(verify with a lawyer; do not
  promise it to the owner)**.
- Website texts and photos.
- Contract end date, notice period and what happens to the domain and email
  on exit.

Migration without downtime:

1. **Inventory:** export the DNS zone; write down MX, SPF/DKIM/DMARC TXT and
   any verification TXT (Google, Meta, Microsoft).
2. **Lower TTL** on the records you will change to 300 seconds, at least one
   old TTL (often 1 to 24 hours) before the switch.
3. **Keep MX and mail TXT records exactly as they are.** Do not move name
   servers unless the new DNS host already holds a full copy.
4. **Switch** in a quiet hour: add the subdomain CNAME (no risk), or change the
   apex A record and `www` (site switch).
5. **Verify:** our status says "Secure connection ready"; open the page on a
   phone on mobile data; send and receive a test email; book a test
   appointment.
6. Raise TTL again after a few days. Keep the old provider's account until the
   contract ends, as a fallback.

## 4. Questions Niclas must answer for Salong Solgården

No facts about the current provider or the domain are assumed here.

1. Who is the **registrar** of salongsolgarden.se, and who is the **holder**:
   the salon's company, your partner personally, or the platform?
2. Who **hosts DNS** (which name servers), and does anyone at the salon have a
   login that can add records?
3. Where does **email** for @salongsolgarden.se live, who has the login, and
   is it part of the current platform's package?
4. Is **DNSSEC** switched on for the domain?
5. When does the **contract** end, what is the notice period, and is the domain
   or email part of the contract?
6. Can the current site's **"Book" button** be changed to our address, or is it
   locked to the platform's own booking?
7. Can you get an **export** of customers, future bookings, gift cards and
   punch cards? In what format?
8. Who owns the current **texts and photos** on the site?
9. Is booking also linked from **Google Business Profile, Instagram or
   Facebook**? Those links must change at the switch.

## 5. Recommended path for the pilot

1. **Answer the questions** above (an evening with the registrar's WHOIS, the
   control panel and the contract).
2. **Set up the salon in Cresavo** with real services, hours and staff; book
   test appointments on the default address. No DNS yet.
3. **Add the subdomain:** `boka.salongsolgarden.se` CNAME to us. Email and the
   old site are untouched. Our status shows "Secure connection ready".
4. **Pick one switch date.** Two booking systems open at once will double-book.
   On that date: close online booking on the old platform, import or re-enter
   future bookings, change the "Book" links (site, Google, Instagram) to
   `boka.salongsolgarden.se`.
5. **Run for 4 to 8 weeks** on the subdomain, with the old site still live.
6. **At contract end, move the whole domain:** build the salon site
   (`WEBSITE_SERVICE.md`, option a), lower TTL, change the apex A record and
   `www`, keep MX, add redirects for the old page addresses, verify, raise TTL.
7. If the registrar is the platform itself: transfer the domain to a neutral
   registrar *before* step 6, with the auth code.

Steps 3 and 6 need the live domains module switched on, which needs real
login first (section 2).

## 6. Onboarding UX: three guided steps

Plain words; "DNS", "CNAME" and "TXT" appear only where the owner must copy
them, with "What is this?" behind a tap.

```
Step 1 · Your address
  "Which address should your booking page have?"
  [ boka.salongsolgarden.se            ]
  We suggest boka. in front of your domain: your website and email
  stay exactly as they are.
  ( ) Use my whole domain for a new salon site   -> only with the salon site
                                              [ Continue ]

Step 2 · Add one record
  "Log in where your domain is managed and add this:"
  We think your domain is managed at: <provider from name servers>
  Type   CNAME                         [Copy]
  Name   boka                          [Copy]
  Value  <target>                      [Copy]
  Do not change or delete anything else.
  [ Send these steps to the person who manages your domain ]
                                              [ I have added it ]

Step 3 · We connect it
  (o) Waiting for DNS          We cannot see the record yet. This can take
                               a few minutes, sometimes a few hours.
  ( ) Checking your address
  ( ) Secure connection ready  Customers can book at boka.salongsolgarden.se
  We check by ourselves and tell you when it is ready. You can close this.
```

Details:

- **Live status:** poll every 30 s while open, then in the background; a card on
  Today and a message in Inbox when it is ready. Rename today's "Secure and
  live" to **"Secure connection ready"**.
- **Specific errors, not "failed":** "We see a record, but it points to
  <value>. Change it to <target>." / "Your domain needs one more record to
  prove it is yours" (TXT, shown the same way).
- **Hand-off link:** a read-only page with the exact records, for the nephew
  or IT person who manages the domain. No login, expires in 7 days.
- **Undo:** "Disconnect" explains what happens ("Customers using
  boka.salongsolgarden.se will see a 'not connected' page. Your other address
  keeps working.").
- **Never block booking:** the default address works the whole time; the own
  domain is an addition.
