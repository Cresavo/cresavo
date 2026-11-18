# Settings that stay calm

Exploration for Niclas, 2026-11-18. Proposal only: no code is changed. Based
on the studio as it is on `release/cresavo-demo` (`src/app/studio/more/*`,
`src/concept/studio/nav.ts`), with a second opinion from Codex (Astra).

**Recommendation in one line:** separate *tools* (things you use every week)
from *settings* (things you set once); give settings one home page with
search, a five-item setup checklist and six groups in owner language; give
every setting exactly one place; hide the technical options behind "More
options" and show nothing at all for modules that are off.

## 1. What exists today

The More tab has two lists, "Business" and "Settings". Rows marked * vanish
when their module is off (`menuVisible` in `src/concept/modules/registry.ts`).

| Page (route under `/studio/more`) | What it controls | Kind |
|---|---|---|
| Services & prices (`services`) | Treatment list, edit price | Setting |
| Booking page (`booking-page`) | Look (logo, colours, font pair, photos, corners), 9 sections with 2 variants and order, Instagram link, own CSS, live preview, save/discard | Setting |
| Staff (`staff`) | Per-person stats, weekly schedule and exceptions, calendar subscription (ICS) link | Mixed |
| Stock* (`stock`) | Products, levels, orders, goods in | Tool |
| Gift cards* (`giftcards`) | Sell, share, redeem | Tool |
| Packages* (`packages`) | Punch cards | Tool |
| Campaigns* (`campaigns`) | Campaigns, content calendar | Tool |
| Finance* (`finance`) | Overview, costs, bookkeeping connection | Tool + one setting |
| Reviews* (`reviews`) | Reply, publish | Tool |
| What the assistant remembers* (`memory`) | View, edit, forget facts | Privacy setting |
| Routines* (`routines`) | Repeated jobs, on/off | Tool |
| Features (`features`) | Monthly total, presets Essentials/Everything, core card, 10 module switches with prices, industry pack switcher (re-seeds the studio) | Setting |
| Your data & AI (`data`) | Connect Claude/ChatGPT (MCP steps), open protocols (MCP, A2A, USP), export (JSON, customers CSV, bookings CSV), AI tasks and costs, own AI key | Setting + developer |
| What happened? (`log`) | Activity with undo, trash, support tickets | Tool |
| Settings (`settings`), one long page | Salon details (read-only), Appearance (studio theme), Opening hours, Closed days, Rooms and chairs, Your booking address (slug, path link, subdomain link), Own domain (module), Booking widget & share link, Support access, Demo (start over, reset) | Settings, mixed |

Also: an Appearance control at the bottom of More on phones (duplicates the
one on the Settings page), and the Owner/Staff role switch in the top bar.

Not there yet, but coming and needing a home: editing business details,
cancellation and booking rules, reminders and confirmations, customer
payments, notifications, the owner's own plan and invoices, privacy
(consent, retention), salon site, email (goal 20), phone answering (goal 19),
language (goal 21).

**Why it feels heavy:**

1. "Settings" is both a list of six pages and one of those pages, which is
   itself ten sections long.
2. Tools and settings are mixed in both lists ("What happened?" sits under
   Settings, "Booking page" under Business).
3. Where customers find you is split: address and widget on Settings, look on
   Booking page, own domain needs a trip to Features first.
4. Technical options sit at the same level as everyday ones: CSS, protocols,
   ICS, own AI key, A2A/USP.
5. A switch that replaces the studio's data (industry pack) sits next to
   ordinary paid toggles.

## 2. Proposed structure

**More tab = tools.** Stock, Gift cards, Packages, Campaigns, Finance,
Reviews, Routines, "Recent changes & trash" (today's What happened?), each
only when its module is on. At the top a "Share your booking link" action, at
the bottom two rows: **Settings** and **Help & support**.

**Settings = six groups plus your account:**

| Group | Contains | Today it is in |
|---|---|---|
| **Your business** | Name, address, phone, email, org number (editable), logo; Services & prices | Settings (read-only), Services |
| **Booking page & address** | Look (template, colours, photos), sections, your booking link, own domain*, share link and widget, later the salon site* | Booking page, Settings (address, domain, widget) |
| **Opening hours & staff** | Opening hours, closed days, staff and their schedules and exceptions, rooms and chairs | Settings, Staff |
| **Booking rules & messages** | Cancellation rule, how far ahead customers can book, waiting list*, confirmations and reminders; customer payments when they exist | New (previews exist in the booking flow) |
| **Features & plan** | Module switches with prices, monthly total, later your invoices | Features |
| **Data & privacy** | Export, what the assistant remembers*, connect Claude/ChatGPT, own AI key and AI costs, later consent and retention | Your data & AI, memory |
| *Your account* | Appearance, language, notifications, (demo) role switch | Settings, More, top bar |

Help & support (outside Settings): help articles, tickets, support access.

Naming note: I renamed the suggested "Payments & messages" to **"Booking
rules & messages"**, because payments do not exist yet and an empty word in a
title makes owners look for something that is not there. When payments land
the group can become "Rules, payments & messages". Astra suggests "Hours &
availability" instead of "Opening hours & staff"; mine keeps the word owners
search for ("staff"), but either works.

## 3. Settings home

- **Search** at the top. A static index of every setting (title, group,
  synonyms in English and Swedish, owning module, role), built from the nav
  registry and the dictionary. A result opens the page *and* highlights the
  control (reuse the help "show me" highlight from goal 8). "holiday",
  "semester", "julafton" find Closed days; "price" finds Services & prices.
  A switched-off module gives one result: "Gift cards is off. Turn it on in
  Features." Staff never see owner-only settings.
- **"Set up your business" checklist**, five items, each ticked automatically
  when the data is there, each opening its editor:
  1. Check your business details
  2. Add your treatments and prices
  3. Set your opening hours
  4. Choose your cancellation rule
  5. Preview and share your booking page
  Dismissible; gone when all five are done; "own domain" appears as an
  optional sixth only when that module is on.
- **Groups as rows with a live summary**, so most owners never need to open
  them: "Opening hours & staff · Mon to Fri 9 to 17, 2 people",
  "Booking page & address · boka.salongsolgarden.se · Secure".

## 4. Progressive disclosure rules

1. **Defaults first.** Hours, services, reminders (24 h before) and the
   cancellation rule (free until 24 h before) come from the industry pack at
   onboarding. Nothing needs setting before the first booking.
2. **Three visible things per page,** the ones most owners change; the rest
   under **"More options"**, closed by default and remembered per device.
3. **Behind "More options":** section variants and order, own CSS, widget
   embed code, the calendar subscription link, the path-style booking link,
   connecting Claude/ChatGPT, own AI key, AI cost log, JSON export,
   separate CSV files (one "Export everything" button stays visible).
4. **Developer-only, behind "For developers" inside Data & privacy:** the
   open protocols list (MCP, A2A, USP).
5. **Modules that are off show nothing** in Settings: no greyed rows, no
   upsell cards. They are discoverable only in Features & plan (and via search,
   which points there).
6. **One home per setting.** Other places link to it, never copy it.
7. **Dangerous actions are separate and confirmed:** reset, start over and
   applying another studio template show what changes and ask first.

## 5. Where each page moves

| Today | New place | Action |
|---|---|---|
| More → Services & prices | Settings → Your business | Move |
| More → Booking page | Settings → Booking page & address | Move; open on "Share" with a ready template, customise below |
| More → Staff (schedules) | Settings → Opening hours & staff | Move; ICS link under More options per person |
| More → Staff (stats) | Finance overview (occupancy per person); a one-line summary on the staff row when Finance is off | Merge |
| Stock, Gift cards, Packages, Campaigns, Finance, Reviews | More (tools) | Stay |
| Finance → bookkeeping connection | Stays in Finance | Stay (it is used, not set) |
| What the assistant remembers | Settings → Data & privacy | Move |
| Routines | More (tools) | Stay |
| Features (switches, total) | Settings → Features & plan | Move |
| Features → presets Essentials/Everything | Demo only | Hide outside the demo |
| Features → industry pack switcher | Onboarding; afterwards "Apply a studio template" in Your business → More options, with a preview of what changes | Move, rename |
| Your data & AI → export | Settings → Data & privacy | Move; one button visible, CSVs under More options |
| Your data & AI → connect Claude/ChatGPT, own key, AI costs | Settings → Data & privacy → More options | Move |
| Your data & AI → open protocols | Data & privacy → For developers | Hide |
| What happened? (activity, trash) | More → Recent changes & trash | Rename |
| What happened? → tickets | Help & support | Move |
| Settings → salon details | Your business | Move, make editable |
| Settings → Appearance | Your account | Move |
| More (phone) → Appearance | – | **Delete** (duplicate) |
| Settings → opening hours, closed days, rooms | Opening hours & staff | Move |
| Settings → booking address (path + subdomain) | Booking page & address as one "Your booking link"; path link under More options | Merge |
| Settings → own domain | Booking page & address (only when the module is on) | Move |
| Settings → widget & share link | Booking page & address; share link visible, embed code under More options | Move |
| Settings → support access | Help & support | Move |
| Settings → demo (start over, reset) | Bottom of Settings home, demo builds only | Move |
| Top bar → role switch | Stays in demo; in a real build, staff log in as themselves | Stay (demo) |

Routes: `/studio/settings` (home) and `/studio/settings/<group>`; old
`/studio/more/*` settings URLs redirect, so links in help articles keep
working. Tools keep their `/studio/more/*` routes.

## 6. Wireframes

Phone (390 px), Settings home:

```
+--------------------------------------+
| <  Settings                          |
| [ Search settings...              ]  |
|                                      |
| Set up your business        3 of 5   |
| [x] Check your business details      |
| [x] Add treatments and prices        |
| [x] Set opening hours                |
| [ ] Choose your cancellation rule  > |
| [ ] Preview and share booking page > |
|                              Hide    |
|                                      |
| Your business                      > |
|   Salong Solgården · 4 treatments    |
| Booking page & address             > |
|   boka.salongsolgarden.se · Secure   |
| Opening hours & staff              > |
|   Mon-Fri 9-17 · 1 person            |
| Booking rules & messages           > |
|   Free cancel until 24 h · SMS 24 h  |
| Features & plan                    > |
|   4 features on · 335 kr/month       |
| Data & privacy                     > |
|   Export any time                    |
|                                      |
| Your account                       > |
+--------------------------------------+
| Today  Calendar  Customers Inbox More|
+--------------------------------------+
```

Phone, one group open (progressive disclosure):

```
+--------------------------------------+
| <  Opening hours & staff             |
| Opening hours                        |
|   Mon-Fri  09:00-17:00        Edit   |
|   Sat-Sun  Closed                    |
| Closed days                          |
|   24 Dec, 31 Dec           Add day   |
| Staff                                |
|   Anna · Mon-Thu              Edit   |
| v More options                       |
|   Rooms and chairs                   |
|   Calendar subscription links        |
+--------------------------------------+
```

Desktop (1280 px): groups on the left, the open group on the right, search
always visible.

```
+------------+--------------------------------------------------------+
| Sidebar    | Settings                     [ Search settings...   ] |
| Today      +----------------------+---------------------------------+
| Calendar   | Set up  3 of 5       | Booking page & address           |
| Customers  |----------------------|                                  |
| Inbox      | Your business        | Your booking link                |
| More       | > Booking page &     |  boka.salongsolgarden.se [Copy]  |
|            |   address            |  [Share]  [Open page]            |
| Settings   | Opening hours &      |                                  |
|            |   staff              | Look        Template: Calm  Edit |
|            | Booking rules &      | Own domain  Secure connection    |
|            |   messages           |             ready                |
|            | Features & plan      |                                  |
|            | Data & privacy       | v More options                   |
|            |----------------------|   Sections and order             |
|            | Your account         |   Your own CSS                   |
|            | Help & support       |   Widget code for your website   |
+------------+----------------------+---------------------------------+
```

## 7. Second opinion: Codex (Astra)

Asked with the inventory above (`codex exec -m gpt-6.2-astra`, read-only).
Key points:

1. **Groups:** Salon details · Hours & availability · Booking page · Booking
   rules & messages · Features & billing · Data & privacy, plus *My account*
   for appearance and notifications. One home per setting; staff schedules
   under hours, linked from each staff profile. Keep customer payments apart
   from the owner's own subscription.
2. **Biggest overwhelm risks:** the booking page editor asks for design
   decisions before the owner can share a link; the industry pack switch
   (which replaces data) sits beside paid toggles; "What happened?" mixes
   recovery with support tickets.
3. **Cut or hide:** start the booking page with a usable layout and a big
   "Share booking link"; sections/styling under Customise, CSS under
   Advanced, embed code under "Embed on a website"; drop the protocol list
   from settings; ICS link on the person's schedule; delete the duplicate
   phone Appearance control; switched-off modules only visible in Features.
4. **Search and checklist:** search lands on the exact control, respects
   roles and modules; five dismissible tasks that recognise work already
   done and retire when complete.
5. **Challenge:** the industry pack is not a feature. After onboarding it
   should be "Apply a studio template" with a preview and a confirmation.

Where we agree: almost everything. I adopted "Booking rules & messages",
*Your account*, moving tickets and support access to Help & support, the
share-first booking page, deleting the duplicate Appearance control, and the
pack challenge in full.

Where I differ:

- **Protocols:** Astra would drop them from settings. I keep them, hidden
  under "For developers" in Data & privacy: open protocols are part of the
  open-source pitch and self-hosters look for them.
- **Booking page and address together:** Astra keeps "Booking page" as a
  group on its own. I put the address and own domain in the same group,
  because owners think "where customers book" as one thing, and the salon
  site will live there too.
- **Billing in the group name:** "Features & plan" rather than "Features &
  billing", since there is no billing yet and "plan" also covers the price
  total that exists today.

## 8. Build order

One goal (25 in the queue): settings home with search and checklist, the six
groups, moves and redirects as in section 5, "More options" pattern, delete
the duplicate. New settings (booking rules, payments, consent) come with
their own goals and drop into the group that is already waiting for them.
