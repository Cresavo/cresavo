# Websites for businesses: what to offer

Exploration for Niclas, 2026-11-18. Proposal only. Prices are a sketch in SEK
to discuss, not decided. **(verify)** marks things to check before launch.

**Recommendation in one line:** build (a), a one-page salon site generated
from data we already have, sold as a cheap module; sell (b), a fixed-scope
"we move you in" package, as a one-off fee; do **not** build bespoke sites
ourselves: make (c) a partner offering.

## 1. The spectrum

### a. Built-in salon site (product)

A one-page site on the business's own domain (`salongsolgarden.se`), generated
from what the studio already holds: treatments and prices, opening hours,
staff, approved reviews, photos, address and map, gift cards. Booking is the
core of the page, not a link away. A few templates (for example "Calm",
"Bright", "Classic") that only change look and section order.

Most of it exists: the booking page editor (goal 17) already has theme, logo,
colours, fonts, photos and nine sections (hero, treatments, staff, reviews,
gallery, map, FAQ, Instagram, gift cards). The salon site is that page served
on the apex domain, plus:

- sections: About us, Opening hours, Contact; a short privacy page;
- search basics: page title and description, `LocalBusiness` structured data,
  sitemap, Open Graph image;
- templates as theme + section presets, picked in one tap;
- real photo upload (the demo uses fixture photos);
- apex domain support and redirects from the old site's addresses
  (`OWN_DOMAIN.md`, section 2).

### b. Done-for-you setup (service)

We do the move: domain and DNS (with the owner on the phone or via the hand-off
link), services and prices, hours and staff, texts and photos for the salon
site, import of customers and future bookings, gift card balances, changing
links on Google Business Profile and Instagram, a test booking together.
Fixed scope, written as a checklist; anything outside it is not included.

### c. Bespoke sites with maintenance (partner)

A designed multi-page site, own copy, own photography, blog, shop. Built and
maintained by a web agency or freelancer, connected to us through the "Book"
link, the widget or (later) our API.

## 2. Cost to deliver and maintain

| | Build cost for us | Cost per business | Ongoing cost | Main risk |
|---|---|---|---|---|
| a. Salon site | 2 to 4 goals of work (section 6) | Near zero: same deployment, a domain on the project, image storage | Template upkeep, shared by all | Domain limits/cost per Vercel plan **(verify)**; support questions about DNS |
| b. Done-for-you | A checklist and an internal "move-in" view | 2 to 4 hours of Niclas's time per business, plus waiting on the old provider | None after delivery | Time: it does not scale; old providers slow to hand over data |
| c. Bespoke | None (partner) | None for us | Partner's | If we did it ourselves: scope creep, endless small edits, security updates on custom code, one person becomes the bottleneck |

**Why not (c) in-house:** a one-person business cannot be a web agency and a
software company at once. Every bespoke site is a maintenance promise for
years, and its edits ("change the photo before the weekend") arrive at the
worst times. It also pulls the product away from "one person can run this"
(`docs/concept/CONCEPT.md`).

**Keeping (b) safe:** a fixed number of move-ins per month (for example four),
booked in a calendar; the checklist is the scope; text writing limited to what
the template needs; one round of changes. The checklist doubles as the spec
for making (b) more self-service over time.

## 3. Pricing sketch (SEK, excl. VAT)

Consistent with goal 23: low base, switchable modules, no booking commission,
self-hosting free. Today's demo prices: core 149/month, own domain 49/month.

| Offer | One-off | Monthly | Notes |
|---|---|---|---|
| Booking page on our address | 0 | in core (149) | Unchanged |
| Own domain (subdomain, e.g. `boka.`) | 0 | 49 | Existing module |
| Salon site (whole domain, templates) | 0 | +49 | New module; needs own domain; 247/month with core |
| Move-in package (b) | 1,995 | 0 | Fixed checklist; pilot and first 10 businesses free or 995, as references |
| Site care (optional, with b) | 0 | 99 | Up to two small text/photo changes a month, yearly check of domain and email records |
| Bespoke site (c) | Partner's quote | Partner's | We list vetted partners; a referral fee is optional, not a goal |

Sanity checks to do: what local site builders and booking platforms charge for
a site plus booking **(verify current Swedish prices)**; the Vercel cost per
custom domain at our plan **(verify)**; whether 1,995 covers about 3 hours of
work plus waiting time.

## 4. Open source and white label

- **Templates are product, so they are open (AGPL)**, like the booking page.
  Self-hosters get the salon site for free; the hosted service charges for
  running it, the domain and support. That is the open-core line from goal 23.
- **The move-in package and site care are services, not code.** Nothing to
  open-source; matches "flytthjälp och onboarding som tjänst" in
  `docs/ROADMAP.md`.
- **White label rules apply unchanged** (`docs/design/LIBOVO.md`, section 8;
  `TENANT_POLICY` in `src/concept/brand.ts`): the salon site carries only the
  business's name, logo and colours. No platform footer, favicon or app name.
  Attribution stays off by default; if we ever want a "Made with" link it is
  the owner's opt-in.
- **The booking flow stays fixed** inside every template (structure,
  accessibility); templates change look and the surrounding sections only.
- **Partner sites (c)** that link or embed are their own work and licence. A
  partner who modifies our templates and hosts them for others is bound by
  AGPL to share those changes.
- **Legal basics for every site** **(verify with a lawyer)**: a privacy page,
  no tracking cookies by default (so no cookie banner), accessible by default.
  Check whether the European Accessibility Act applies to small salons'
  booking services or whether the micro-enterprise exemption covers them.

## 5. Recommendation

1. **Build (a)** as the "Salon site" module on top of the own-domain module.
   It reuses the booking page and the data the owner already keeps, so the
   site is never out of date (hours, prices and staff change in one place).
2. **Offer (b)** as a fixed-scope move-in package from day one, starting with
   Salong Solgården as the pilot. Use the pilot to write the checklist.
3. **Make (c) a partner offering:** a short page listing two or three vetted
   partners, who connect through the link, widget or API. We do not build or
   maintain custom sites.
4. Revisit after 10 move-ins: which steps took longest, and which of them can
   become product (import, DNS guide, text suggestions).

## 6. What to build first (candidate goals)

In order; each is small enough for one goal. Added to `docs/goals/QUEUE.md`
as proposals (goals 24 to 27).

1. **Own domain onboarding** (goal 24): the three-step flow, TXT challenge
   state, ownership proof, database-backed directory. See `OWN_DOMAIN.md`.
2. **Settings IA** (goal 25): the calmer settings home, so the new options
   land in the right place. See `SETTINGS_IA.md`.
3. **Salon site template** (goal 26): apex support, About/Hours/Contact
   sections, three templates, search basics, redirects.
4. **Done-for-you onboarding** (goal 27): the move-in checklist as an internal
   view, customer and future-booking import, gift card balance import, the
   hand-off link.

Not now: a page builder, multiple pages, a blog, a shop, or custom code per
business.
