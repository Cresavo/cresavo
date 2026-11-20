# Changelog

Cresavo was called Flerdo before November 2026.

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/) (`0.x` while in concept stage).

## [Unreleased]

### Added

- A `StudioStore` interface defines how the studio and server read and change a salon. It covers versions, idempotency keys, effects published after commit and an append-only action log. An in-memory reference store, an adapter over the existing browser store and a shared contract suite back it. The studio behaves as before. See docs/design/STUDIO_STORE.md.
- A staged `PostgresStudioStore` keeps each salon in a `tenant_state` row behind a row lock, with the database clock, 24-hour idempotency keys fingerprinted by HMAC, an append-only `tenant_action` log and a `tenant_effect` outbox written in the same transaction. Effects are delivered one at a time in commit order, so a refund never overtakes its checkout. Booking cutoffs and support grants follow the store clock, and activity text uses the salon's language and currency. A new migration adds the four tables. The intended role grants and a check of the role's effective privileges are in `prisma/grants/`. It passes the shared contract suite against a disposable database. Nothing in the app uses it yet.
- The staged Postgres store has an outbox poller (`npm run effects:drain`). It delivers effects left after a crash exactly once, in commit order, with backoff and a `failed` state, and is safe to run several at once. Effects of demo and sandbox salons only reach simulated providers. A held row lock now times out after 2 seconds as a conflict. A new migration adds the outbox states. Nothing in the app uses it yet.
- Erasing a customer for good (`customer/erase`) removes them and their records from the salon and the trash. Activity entries about them keep no text or undo data, and their name, phone or email in other notes is replaced by a marker in the salon's language. Slugs, ids and other customers' details are never changed. Stores refuse it as an ordinary change. The staged Postgres store's `eraseSubject` also redacts its audit log, including idempotency keys and phones typed in another format, and the messages to that customer in the same transaction. It cancels unsent messages to them, reports one that is being sent, and forgets only the idempotency keys that held them. The SECURITY DEFINER version for production is in `prisma/grants/erase-subject.sql`, created in one transaction without access for other roles.
- The staged Postgres store publishes commit versions across instances through LISTEN/NOTIFY. It adds caller-scoped idempotency keys, privileged tenant replacement, a daily demo reset and 24-hour sandboxes with simulated effects. Operators can run `npm run store:sweep` for retention and `npm run store:loadtest` to measure a fictional 10,000-booking tenant. The store records local size and latency metrics and refuses documents over 8 MB.

### Changed

- The staff preview starts in Advanced, with a return to the owner view available while previewing.
- Finance opens with what is left this month and a comparison with last month. Send to my accountant explains the two download options and the dates they cover.
- Gift cards and packages share one add-on and one More entry with two tabs. Owners can approve and reply to reviews from the Inbox.
- The owner studio uses shared controls, page headers, status badges and list rows. Calendar groups its secondary tools in an options sheet and gives appointments larger touch targets.
- The public booking pages and product site use shared controls. Booking keeps the salon's colours, makes treatment actions and review ratings easier to see, and keeps the checkout summary beside the form on wide screens.

### Fixed

- A deleted customer whose 30 days in the trash are over is now also removed from the activity log and from the browser's saved copy, so undo can no longer bring them back.
- Studio forms, step controls and actions use content-appropriate widths on desktop. Campaign treatments follow the studio language.
- Fixed unwanted horizontal scrolling in the studio at high zoom and in the booking-page editor.

## [0.5.0] - 2026-11-19

### Added
- The studio now has shared accessible controls, form feedback, consent dialogs and motion for both themes, with a development-only component gallery.
- The API platform plan and architecture decisions document current REST and MCP coverage. API parity tests require every module to declare its resources and keep the published coverage table in sync.
- Owners can configure cancellation fees and treatment deposits. Customers see the deadline and can pay a simulated deposit, and the studio records fee decisions, balances and refunds.
- The paired salon assistant can read calendars, customers, treatments, staff and finance, and draft bookings, blocks, cancellations, treatment changes and simulated Inbox replies for owner review. OAuth consent lists permissions by area.
- A flag-controlled demo lets visitors connect an assistant to a temporary fictional salon, review proposed booking moves live in the studio Inbox and see approved times in the paired calendar.
- The demo shows the service total, payment split and salon-local cancellation deadline before booking. Studio settings estimate monthly reminder SMS costs and link to the simulated Sent log. Your data & AI has a checklist for exporting data and importing customers. Failed booking and payment actions show a copyable reference code.
- Releases are published automatically when a release pull request merges, with readable notes from `docs/releases/`. [Releasing](docs/RELEASING.md) explains the cadence and how to follow along.
- The Swedish product page and privacy note live at `/sv` and `/sv/privacy`. The Swedish site links into the demo in Swedish, and the Swedish domains redirect to the main site.
- Start a browser-local salon from Today or Settings with a short setup in Swedish or English. New salons have their own bookable page, empty studio views and a first-run checklist. A short guided tour introduces the demo salon.
- The studio and Salong Eko booking flow support Swedish and English. Owners choose a studio language per device and a business language for confirmations and customer messages. The rules assistant understands common Swedish booking and scheduling commands.
- The public product site publishes a sitemap and search metadata. Its production deployment uses cookie-free Vercel Web Analytics to measure visits.
- CodeQL analyses the JavaScript/TypeScript code and the GitHub Actions workflows on pull requests, on `main` and weekly. Pull requests run Dependency Review, which fails on new dependencies with high or critical advisories. [Quality and security](docs/QUALITY_SECURITY.md#security-checks) lists every security check and what blocks merge.

### Changed
- Trying Cresavo with your own salon takes about two minutes. Setup has three screens: the salon's name and type (hair, beauty, nails, lashes & brows, massage or skin care), then suggested treatments with typical prices that you edit in place, then "Your salon is ready" with links to your booking page and your day. Opening hours (Monday to Friday 9–17), currency, address and staff get defaults and stay editable in Settings. A few example bookings, clearly marked, keep Today from being empty. New salons start with every add-on off.
- A salon you set up is a trial that lives only in this browser. Today and Settings say so and offer Delete now. A trial unused for 24 hours is removed the next time the studio opens, with a screen to start a new one or return to the demo salon. The demo salon never expires.
- Getting started is a thin strip under the day's heading with four steps: add your treatments, check your booking page, share your link and make a test booking. Today puts the next customer first, shows the next five schedule rows with Show all, keeps a new salon to one suggestion and hides the owner/staff switch in a one-person salon. The studio header carries one "Demo: nothing is sent or charged" label, and simulated send buttons on Today say "(demo)".
- Book again sits beside booking management on confirmations and in My bookings, and keeps the original treatment and practitioner when available.
- Salong Eko’s sample treatments, team profiles, reviews and inbox messages follow the language of each view. Studio help is available in Swedish, and the built-in assistant understands more Swedish price, stock, campaign and booking-page requests.
- English is the default language; Salong Eko offers Swedish to visitors.
- Customers can confirm the next available visit from the treatment list, opt in to contact prefill, and book the same treatment and practitioner again. The confirmation links to appointment management, calendar downloads and Google Calendar. Shared gift cards show their remaining balance when available.
- The customer list starts each row with the customer's name and shows the next booking before the last visit. The filters carry the customer counts.
- On phones, Today shows the next customer above the schedule. Inbox rows lead with the message subject and show the sender below it.
- Settings is a short overview with six sections, each on its own page: Salon, Opening hours and closed days, Reminders and cancellations, Your booking link, Appearance and language, and Advanced. Owners can now edit the salon's name, phone, email, address and area; the change is listed in History and can be undone.
- An Advanced area at the end of More and Settings holds what most salons never need: the developer details from Your data & AI (connecting an outside assistant, AI models and costs, own keys and the open protocols), the website embed code and own domain, the booking language, the SMS price, own CSS for the booking page, rooms and chairs, support access and the error reference lookup, the industry pack and the demo reset. Your data keeps three plain cards: Download my data, Import customers and Connect an assistant. Existing addresses keep working.
- Features is now Add-ons: a plain list with one line and a switch per add-on, without prices or packs. Gift cards and packages explain prepaid money before they are switched on.
- "What happened?" is now History and undo, under Help instead of More. What the assistant remembers and its routines are two tabs on the assistant's page, shown while the assistant is on.
- Today keeps "Someone is calling" as a secondary button until a new salon has real bookings. Text outside Advanced avoids developer words, and a unit test keeps it that way.

### Fixed
- Closing a sheet with Escape, its close button or its backdrop returns focus to the opener. Settings section headers wrap on very narrow screens.
- Deposit and refund records follow the saved booking, including after a customer is restored. Customers can reopen settled visits from My Bookings, and gift cards retain returned credit after customer deletion.
- Deposit checkout respects Swish amount limits and remembers a guest’s contact choice across reloads. Gift-card redemptions show the exact amount due, and calendar exports and cancellation deadlines use the same salon clock.
- The hosted pairing demo uses a dedicated database connection, and Vercel applies pending Prisma migrations through its direct connection when pairing is enabled.
- Paired assistants need fresh consent to draft new bookings, cancellations and calendar blocks. The studio blocks cancellations once a visit has finished and uses finished visits to calculate when customers are due back.
- The paired Inbox shows the customer’s message alongside a drafted reply and keeps proposal review working in already-open tabs. Availability proposals name the paired workspace they affect.
- Treatment prices retain their decimal amounts through approval, activity history and later edits.
- Paired demo workspaces support independent assistant grants, native loopback callbacks and revocation in the studio. Idle tabs expire, and open calendar edits stay bound to their original booking.
- Booking summaries account for prepaid packages, past visits show their status, and failed moves stay visible after the time picker closes. Simulated previews keep the management link and separate confirmation channel choices from reminder defaults.
- Reminder pricing follows the salon’s currency and calendar month. Demo error references can be looked up in browser-local Support access, and gift card lookup errors wait until the code field loses focus.
- New bookings respect the calendar’s staff filter. Staff schedules show exact shift times, and the mobile week view names each practitioner. Owners can undo a removed cost, clear an empty customer filter and switch studio views with the arrow keys.
- Opening a booking link keeps other studio tabs on their selected salon. Local salons keep their own saved edits, booking address and browser-only AI settings.
- Owners can change the studio language during setup and keep their answers. Setup offers to reopen an existing salon. First bookings respect the selected team member, finance exports use the salon currency and campaign links open the salon’s booking page.
- The local owner MCP server keeps `--admin` read-only. Saving campaign drafts requires workspace write access, explicit confirmation and a request ID for safe retries.
- The large photo on public booking pages starts loading right away.
- Screen readers can announce when a team member's schedule is saved.
- If another tab books the time you picked, the demo asks you to choose another time, even during the first booking on a device.
- Online booking and change cutoffs follow the same salon time as calendar exports. Turning off contact prefill while a booking is confirming clears the saved details.
- Repeat booking keeps the requested practitioner on waiting-list requests. If a past treatment is unavailable, the widget lets you choose a new one.
- Own-domain setup shows the full DNS record name for nested booking addresses. (#4)
- The booking wizard searches the specific date you name, including December 24 in English and Swedish. (#6)
- Online booking enforces the minimum lead time when saving a confirmed appointment. (#7)
- The activity log credits customers for cancelling or moving their own bookings. (#12)
- Assistant clarification questions follow the studio language and industry terms. (#13)
- The booking-page browser tests use the port from the configured base URL.

## [0.4.0] - 2026-11-18

### Added
- The README now links to the demo, community, public roadmap and ways to contribute. First-time contributors have a quickstart and review guide, with simple forms for GitHub Discussions.
- One product page brings together the founder story, studio previews, five workflow films and an offline booking sample. All demo links open the owner studio directly.
- A looping inbox story follows a request through owner approval, booking and customer confirmation. A connected diagram shows which tools work in the demo and which are planned.
- Visitors can compare fees, branding, hosting and data ownership, see the GitHub star count and contribute through the community links.
- Anna and Erik have fictional staff portraits on the booking page, throughout booking and in the studio.
- Treatments & prices: owners add, edit, hide, duplicate, reorder and delete treatments, and add, rename, reorder and remove categories. Name, category, length and price come first; description, who can do it and visibility sit behind "More options". Deleting a treatment with upcoming bookings says how many, offers to hide it instead, and never changes the bookings. Every change is in What happened? and can be undone. The booking page, booking flows, the assistant and campaigns follow at once.
- Salon booking page: opening hours, address with a map link, phone and e-mail links, the team with short bios, a few reviews and the cancellation rule, as one block beside the price list on wide screens.

- Connections foundation (goal 28): one port per capability (SMS, email, payments, accounting, calendar, listing, social, ads) with a locale-neutral contract (minor units + ISO 4217, E.164, UTC + IANA zone). The demo's confirmations, reminders, time suggestions, waiting-list texts and campaign posts go through simulated adapters that record what would have been sent; nothing leaves the demo. Live adapters for Twilio, 46elks, Resend, Postmark, Stripe, Fortnox, Visma eAccounting, Google Calendar, Microsoft Graph, Reserve with Google and Meta are off by default behind `CONCEPT_CONNECTIONS_LIVE` and per-port provider settings; see `docs/integrations/README.md`.
- Cresavo: the platform is named Cresavo (wordmark, tokens and copy on every platform surface). `cresavo.com` shows a coming-soon page with a launch waiting list, `demo.cresavo.com` opens the studio; the tenant booking page keeps the business's own brand.
- Assistant: daily questions are answered straight from your data: who is next, when a customer is coming, what they had last time, whether a treatment fits a day (with the next day that has room), what a treatment costs, a gift card's balance, what waits in the Inbox and who is due back. Rows link to the customer.
- Assistant: "Text Ida that I'm running 15 minutes late" drafts one simulated text for approval.
- Features: two starting points, Essentials and Everything, as one tap each (also `/studio?start=essentials|everything`).
- Brand kit v0.9 (provisional, since replaced by Cresavo): the product name comes from the one brand constant, with the kit's wordmark in the studio, home, product, live and landing pages, and temporary monogram icons for the browser tab, home screen and web app manifest.
- Light, dark or system theme for the studio (Settings > Appearance, the sidebar, and More on phones), remembered on the device and applied before the page paints.
- Ctrl+K (⌘K on a Mac) opens the assistant anywhere in the studio; quick commands are typed there.
- The assistant ("Assistant" button): a conversation panel, full screen on phones and a side panel on larger screens, opened by button or straight into listening with the microphone. Replies can be read aloud.
- Multi-turn conversation grounded in your data through the same proposals and read tools as the command box and MCP: numbers with charts, customer and booking lists, and proposal cards with Approve and Undo. Follow-ups understand "her", "them", "that day" and "the same as last time". Approvals are logged as the assistant.
- "Send an offer to the customers who haven't been here since summer" drafts simulated texts to everyone in that group for approval.
- Memory per business (More > What the assistant remembers): "remember …" saves at once, facts the assistant notices are offered first, notes can be searched, edited and forgotten, and finished conversations leave a short topic summary. A remembered preference ("Lena prefers Erik") picks the staff member next time she is booked. Health and journal text and contact details are never stored.
- Routines (More > Routines): suggested when the assistant sees a pattern (overdue customers, low stock), stored as SKILL.md-style records with a schedule, switchable on and off; each run leaves a proposal in the assistant.
- Morning brief and weekly review on Today and in the assistant, closing brief after the last booking, and reactions to a cancellation, low stock or an upcoming holiday. Rules choose the items; AI may only reword and reorder them.
- Works without any AI key, clearly labelled "Rules only". With a key, two new AI tasks (`assistant-reply`, `phrase-brief`) only reword; `CONCEPT_AI_BASE_URL` points the AI layer at any OpenAI-compatible server such as a local Ollama.
- Your own booking address: pick a name in Settings (checked for length, characters, reserved words and clashes) and the page is served at `<name>.<product domain>` as well as `/boka/<name>`. One host resolver in the proxy turns an address into a business; unknown addresses get a friendly page.
- Own domain (paid module, off by default): Settings shows the exact CNAME record to add and the status (waiting for DNS, verifying, secure). Simulated in the demo; a server module wraps the Vercel Domains API behind `CONCEPT_DOMAINS_ENABLED`, `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`.
- More > Booking page: logo, colours with an automatic WCAG AA contrast check and adjustment, font pairs, corner style and top photo; add, remove and reorder sections (top of the page, treatments, team, reviews, gallery, find us, questions, Instagram, gift cards) with two looks each; live preview of the real page; scoped custom CSS. The booking flow stays fixed.
- The assistant can change the page: "make it calmer and more luxurious", "put reviews first" or "use the colours from our logo" give a proposal with a before and after preview, applied on approval and undoable from What happened?.

### Changed
- The README opens with an animated product tour and links to the public roadmap. The finance demo labels its accounting connection as simulated and uses the Cresavo name for bookkeeping downloads. The local concept MCP reports the current display name.
- The README and launch drafts tell the story of the salon at home that inspired Cresavo and explain what an open booking system would let salons do.
- Owners can drag treatments and categories into order with a mouse, touch or keyboard. Each drop updates the public price list and can be undone. The booking-page editor also supports dragging sections alongside its up and down buttons.
- The studio sidebar displays the capital-C Inter Regular wordmark at 124 px. The browser tab and home-screen icons use a white lowercase c on aubergine in both themes.
- The coming-soon page now introduces the demo with a 36-second product tour, links to the public repository and a summary of booking, daily planning and data ownership.
- Public booking pages give each treatment a full-width description. Prices align on the right, with the Book button below beside duration and staff.
- The privacy note says who runs the pages, what the closed waiting-list form actually does with an address (checks it and discards it; tries are counted per network address for about ten minutes), what the public demo keeps on the device, and which rights people have. The form and its answer say plainly that the list is not open and nothing was saved.
- Salon booking page: the price list comes first and is made to be scanned (name and price on one line); free-text search is one quiet line instead of a block with a button and example chips; the name and facts sit under the photo instead of on a darkened photo.
- Studio on a desktop: one page frame (content starts at the sidebar and grows to a readable width instead of floating in the middle); the assistant and Help sit in each page's title row; the owner/staff demo switch moved to the sidebar footer; Business and Settings are groups in the sidebar, one open at a time, so the menu fits a laptop screen.
- Today: one card language. The brief no longer repeats the schedule and shares one card with the suggestions, which lost their "Suggestion" label and icon tile; "Show more" is the card's last row.
- Status words are plain text: no tinted pills and no dots. A warning or an error is set in its semantic colour, nothing else. Plain information boxes are neutral instead of blue; progress bars are neutral.
- Staff: no progress bars, treatments as a line of text, the calendar subscription folded and hidden when the server has none. Your data & AI: export and connecting first, the protocol table under "For developers".
- The assistant is called "Assistant", with no persona name. On phones it is one quiet labelled button above the tabs with the microphone inside the panel; the panel opens at the message box ("Who is coming today?") without a brief, routine offer, sparkles or "Rules · no AI" labels, and no longer saves conversation summaries to memory.
- Today is calmer: one suggestion at a time, and routines are suggested under More > Routines instead of on Today.
- Text on a tinted background is always neutral ink (Features, Gift cards and Packages totals, the gift card balance on the booking page).
- The studio, home, login, product and live pages use the brand colours (aubergine and apricot), Inter, calmer corners and outlined cards, in light and dark. Buttons, fields and chips are at least 44 px tall and inputs 16 px.
- The old command box at the top of every page is gone: the assistant is one button (top bar, or the floating button with microphone on phones). With an AI key, the model's reading of a quick command still replaces the rules' answer before you approve.
- Today lists today's bookings first, then what needs attention, then the brief; the two number cards are one strip. On phones the calendar shows one person's day with a staff switch.
- New bookings in the studio show treatment, duration, staff, price and time next to the confirm button.
- Booking pages without chosen colours now look neutral (ink on white) instead of borrowing the product's look; Salong Eko keeps its green as its own palette. The studio's theme never changes a booking page, and a business's own CSS cannot change success, warning, danger or info colours.
- The customer page lives at `/boka/<slug>` for any slug the business picks (it was fixed to `salong-eko`); links, texts and the share code follow the slug. DEMO_VERSION is 14.
- On phones the inline command box is replaced by the assistant button (#18); it stays on larger screens.

### Fixed
- Concept AI requests need a configured bearer token and a verified client address to use a provider, with a per-address budget. Custom-domain setup stays simulated.
- Stripe partial refunds validate the original payment currency. A gift-card payment preserves the customer's package visit, and deleting and restoring a customer moves their packages with them.
- Staff assistant conversations are scoped to the active role, and staff can only move or cancel visits in their own calendar.
- Undo actions stay tied to their activity log entry and preserve records that later changes rely on.
- Studio booking sheets only confirm times on the selected day. Undo checks staff and resource availability before restoring a booking.
- The customer time picker shows salon contact links when there are no open days in the four-week window.
- Preserve links between the product site and demo after a proxy rewrite and allow indexing of the product home.
- Return English booking-engine errors and owner MCP messages.
- Demo bookings: book a new caller with contact details, start from a treatment that fits the selected gap, and preserve public booking details when changing times. Phone search handles local and international formatting, and public booking validates mobile numbers.
- Demo state refreshes across tabs, and booking confirmations on a salon address explain where browser storage is available. Waiting-list offers are opt-in and appear in the Sent log.
- The morning brief tracks current availability. The assistant answers questions about staff availability, low stock and opening hours from the demo data.
- Studio and public page QA fixes cover same-time moves, suggestion counts, room filters, mobile assistant access, staff days off, Inbox timestamps, unknown-address status and page language.
- The read-only public demo keeps working where the server refuses writes: journal structuring and help answers run their built-in rules in the browser instead of failing, and the Data page shows one note instead of connection steps, a server reset and a key form that cannot work there.
- Assistant: "Who is coming on Friday?" lists Friday (it listed today), yesterday's revenue is one day (it was the whole month), a stated discount is used in an offer (it was always 10%), "same as last time" means the last finished visit, and a gift card question is no longer read as a stock question.
- Assistant: closing early, blocking part of a day, no-shows, waiting-list adds and journal notes are declined in plain words with the place to do them, instead of a wrong draft (a part-day closure used to become an all-day one) or "I did not catch that".
- Saved demo data survives the rebrand: saves from versions 12–14 are migrated in place (bookings, customer edits, stock and the booking page design are kept) instead of being replaced by fresh data. Only new Salong Eko data starts on the Forest palette (Codex #1).
- On phones and tablets the Owner/Staff demo switch is a compact button in the top bar, so a staff view can always switch back (it used to live in More, which staff cannot open) (Codex #2).
- Assistant: a model's late reading of a quick command no longer replaces a card the owner has already picked from, approved, declined or moved past, and when it does replace the card it brings its own context, so "that day" means the day on the card (Codex #3).
- The assistant offers Undo on a card only while the change can still be taken back, and says "Undone" only when it was; otherwise the button goes away (Codex #4).
- Assistant proposals have Edit again: it puts your words back in the message box and retires the old proposal. Approved spoken commands are logged as Voice, typed ones as Assistant (Codex #5).
- Booking pages are the business's from edge to edge: the page background, an unknown address and error states use the neutral tenant look instead of the platform's colours or the studio's theme; the browser tab shows the business's logo or a neutral calendar icon, never the platform monogram, and booking pages no longer offer the platform's web app manifest (Codex #6, #23).
- The embed code is titled "Book with <your business>" and the confirmation page says "Fictional demo" instead of naming the platform; platform attribution on booking pages is a product policy setting, off by default (#27).
- Error, warning and confirmation messages on booking pages always sit on their own meaning colours, so they stay readable on any page colour. A business's own CSS can colour only branding slots (page, headings, links, buttons, header, footer, sections, images) and cannot fade or filter containers; the page editor's contrast check now lists error messages and confirmations (Codex #7).
- The browser's address and status bar follow the studio's saved theme (also against the phone's own setting) from the first frame and when the theme is changed; booking pages keep their own colour (the business's page colour, or neutral) (Codex #8, #29).
- Booking pages keep their header, content and footer clear of the notch, rounded corners and home indicator in portrait and landscape (Codex #9).
- Finance charts draw the period before in a colour with at least 3:1 contrast and as outlined columns or dashed bars, with a legend, so it is not told apart by colour alone (Codex #10).
- Today's schedule and a customer's bookings say who the booking is with ("Anna ·") instead of relying on the staff colour dot (#26).
- 44 px touch targets for switches (the compact track sits inside a larger target), the assistant message box buttons and panel header, customer phone and email links, the booking page's business link and the demo banner's language select (Codex #11, #30).
- A test keeps the runtime colour tokens identical to the brand kit's colors.json (documented extensions listed explicitly), and the browser chrome and manifest colours are read from that file instead of a copy (Codex #12).
- At 200 % zoom on a phone, Today, Customers, Settings and the booking page no longer scroll sideways: buttons, badges and chips wrap, long addresses break, the assistant pill collapses to one icon and the tab bar shows icons only (labels stay as accessible names) (#25).
- `/landing` declares its language, uses the brand tokens (so it also follows dark mode) with a plum hero, and its animated booked slot keeps full text contrast (#28).

## [0.3.0] - 2026-11-17

### Added
- CI hygiene for the open-source launch: Dependabot (npm and GitHub Actions, weekly, grouped), a gitleaks full-history secret scan and an OpenSSF Scorecard workflow.
- Everyday operations: opening hours, lunch and closed days are editable in Settings (Swedish public holidays are suggested), each person has a weekly schedule with days off, sick days and extra shifts, and rooms can be added and assigned to treatments so two bookings never share one.
- Free times follow all of it everywhere: the customer booking page, calendar, "Someone is calling", command box and MCP tools use one availability function.
- Today shows a "needs moving" card for bookings that no longer fit (someone is off, the salon is closed). The calendar can filter by room.
- Owner and Staff view: the Staff view shows only the person's own calendar, customers served and journal, without finance, settings or modules.
- Command box: "Anna is off on Friday", "close the salon on 24 December" and "Erik works Saturday 10-14" create proposals.
- Gift cards (More > Gift cards, switchable module): sell a card with amount,
  recipient and message, share or print it, pay a booking with it from the
  booking sheet, and let customers check the balance on the booking page.
  Selling a card is not revenue; it is owed to the customer until a visit is
  paid with it. Finance shows what customers have prepaid.
- Packages (More > Packages, switchable module): sell "5 visits for the price
  of 4". Marking a visit done uses one visit of the customer's package.
- Evening summary on Today after the last booking: revenue, visits, no-shows,
  new customers, missing journals and tomorrow's first customer, from the
  `daily-summary` task (rule text without an AI key).
- Calendar subscription per staff member (More > Staff): a read-only `.ics`
  link with a secret token (`CONCEPT_ICS_SECRET`) for Google or Apple Calendar,
  showing treatments and first names only.

### Changed
- Calendar: staff and room filters are one Filter button (showing the chosen person and room) that opens a small sheet, so the header is one row at 390 px.
- Due back: one small send icon per row instead of a "Send time suggestion" button on every row.
- Booking page: while a booking is under way the treatment list steps aside, so there is one obvious next action; it returns on the first screen.
- Polish pass: Today has two number cards instead of three and two suggestions at first (the rest behind "Show more"); the schedule no longer repeats times or durations, and finished visits are shaded instead of faded.
- Muted text, warning badges and Erik's colour are darker so they pass WCAG AA contrast; the customer day chips and calendar days no longer use faded text.
- Empty Gift cards and Packages pages show only the empty state (the "owed to customers" card appears once something is sold); review cards no longer repeat "No reply yet" next to the Reply button.
- Customer rows wrap the next visit instead of cutting it off on phones.
- Animations and transitions in the studio and booking pages stop with "reduce motion".
- The product name and tagline live in one constant (`src/concept/brand.ts`);
  every user-facing mention reads from it, and a test guards that.

### Fixed
- Development dependency audits are clean after compatible upstream fixes (#12).
- The engine MCP transport is reused without sharing client authority or repeating setup for every request (#15).
- Commands keep minutes in times such as "at 14:30" and "to 09:45" (#13).
- Mobile command input is shorter, and the floating mic no longer covers actions (#16).
- MCP write tools (`propose_move` and the others) failed with "The tool could not run" because the Owner/Staff rules shared a file with browser-only code; the rules and the browser's role switch are now separate files.
- After booking inside 24 hours the confirmation said both "online changes are closed" and "free to change until" a past date; only the one that applies is shown.
- Star ratings, the gift card page without a card and the day chips are announced correctly by screen readers.

## [0.2.0] - 2026-11-17

### Changed
- The clickable concept introduced the first product name.

### Added
- Open-source front door: English CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  issue and pull request templates, and a draft CLA (pending legal review).
- Open protocols for the demo business: an HTTP MCP endpoint
  (`/api/concept/mcp`, bearer token `CONCEPT_MCP_TOKEN`) with read tools for
  bookings, free times, customers (names only), services, stock, finance and
  campaigns, and write tools that only create proposals.
- Inbox shows proposals from Claude, ChatGPT or another agent under "Waiting
  for your approval" with Approve and Decline; approved changes appear in What
  happened? as Assistant · MCP with Undo.
- Your data & AI: status per protocol and copy-paste setup for Claude Code,
  Claude Desktop and ChatGPT.
- A2A agent card and read-only A2A endpoint, plus a USP discovery profile, for
  customer assistants (services and free times; the person books on the
  booking page).
- Modules with prices: Features shows each module (Journal, Stock, Campaigns,
  Finance, Reviews, Waiting list, Assistant) as a card with on/off, a demo
  price and a running monthly total. Switching a module off removes it from the
  menu, Today cards, AI task list and command box answers.
- Industry packs: Foot care and massage, Hair salon, Nails, Personal trainer and
  Clinic. A pack sets words (customer/client/patient, treatment/service/session),
  services, stock, journal templates and starting modules; switching pack
  rebuilds the demo.
- Onboarding at `/studio/welcome` (three questions), reachable from Settings
  via "Start over as a new business".
- What happened? (More): every change with who made it (you, the assistant, a
  customer), what changed before and after, and where it came from (button,
  command box, voice, booking page). Filter the list and undo a change with one
  tap while nothing else has touched it.
- Trash: cancelled bookings and deleted customers stay for 30 days and can be
  restored, a customer with all their bookings and journal. New Delete customer
  on the customer card.
- Help button in the studio header: ask how to do something and get an answer
  from 15 help articles, let it show you the right button, or create a ticket
  with the page, a request number, a screen outline and your latest changes.
  Tickets are listed under What happened? > Support tickets.
- Support access in Settings: let support read the account for 1 or 24 hours and
  stop it at any time; every grant and stop is logged.
- Server logs for `/api/concept/*` are one JSON line per request (request id,
  route, status, duration, task) and never contain input text, keys or personal
  data; responses carry an `x-request-id` header.
- Stock and purchasing: mark a finished visit as done in the booking sheet and
  the products it uses (foot cream, massage oil, gloves, couch paper) are
  deducted automatically. Stock shows "runs out in about N days", Today warns
  when a product runs low, and the purchase list (one amount per product, one
  tap to approve) puts the order on order and saves an email draft per supplier
  in the Inbox (simulated). Goods received adds the delivery to the stock, typed
  in or from a "photo of delivery note" (demo result).
- Sell a product to a customer (Stock or the customer card, or "sold a foot
  cream to Lena" in the command box): the balance drops and the sale shows in
  the customer's history and in revenue. "How much massage oil is left?" and
  "order more foot cream" also work in the command box.
- Edit a product's minimum level, supplier and prices from the Stock page.
- Finance overview on one screen: revenue, occupancy per person, popular
  treatments, cancellations and no-shows, and new vs returning customers for a
  day, week, month or year, each compared with the period before.
- Monthly costs (rent, products, wages, fees) with the result left over each month.
- Bookkeeping card (simulated connection, preview of what would sync)
  and SIE and CSV exports.
- The command box answers "compare March with last year", "which treatment earns
  the most per hour?" and "how busy is Erik next week?" with a number and a chart.
- SMS and email previews for booking confirmations and reminders, with simulated
  confirmation sends, retry-safe reminder sends and a Sent log in Inbox.
- Customers can leave a 1–5 star review after a completed visit. Owners approve
  it in Inbox or Reviews before its text or rating appears on the salon page.
- A responsive Cresavo booking widget, plus copyable embed code and a clean
  Instagram bio link in More → Settings.
- More customer booking phrases, including sports massage, back rub, footcare,
  next available, day after tomorrow, weekday abbreviations and around HH:mm.
- Cresavo can securely save a business's own OpenRouter, OpenAI or Anthropic key
  on the demo server, choose Fast/Smart per task, and show saved usage by task
  and month. The command box uses validated provider tool proposals with rules
  as fallback; all features still work without keys.
- Campaign studio: pick an offer or holiday, get a text for Instagram, Facebook,
  TikTok, newsletter and SMS, choose a poster (5 styles; Instagram post, story or
  A4 window poster as PNG), preview it per channel, then publish everywhere or
  schedule. Each campaign gets a trackable link and (simulated) reach, clicks,
  bookings and revenue, and can be run as an ad with budget, days and local area.
- Content calendar with holidays and planned posts on the Campaigns page.
- Today suggests campaigns for coming holidays and quiet days; the command box
  ("make a Father's Day campaign", "20% off massage all of March") opens the
  studio pre-filled.
- Customer card: a one-line summary at the top ("Regular since 2024, foot care
  every 6 weeks, sensitive skin, prefers Anna, afternoons") and the next
  suggested visit with a one-tap time suggestion.
- Return visits (Customers > Due back): set the return interval per treatment,
  see who is overdue and send a simulated SMS with a ready booking link that
  lands in the Inbox.
- Customer segments as filters: regulars, not seen in 3 months, new this year,
  birthday this month.
- Journal templates (foot care, ingrown nail, massage, deep tissue),
  before/after photos and version history that keeps earlier wording after edits.
- Customer import from CSV with column matching and preview, plus an example
  file (`/demo/customers-example.csv`).
- Command box at the top of every studio page: type or speak what you want,
  review a proposal with before/after, then approve, edit or cancel. Questions
  about earnings and lapsed customers are answered in the card.
- Voice journal: dictate a visit, get treatment, observations, advice and next
  visit as editable fields, and book the next visit in one tap.
- Your data & AI shows which AI task runs on which model (or built-in rules),
  a cost log and a form for your own AI key.
- Customer booking page (`/boka/salong-eko`): describe what you want in your own
  words or pick a treatment, choose a time, confirm with name and phone. Includes
  add to calendar, reschedule, cancel (free until 24 hours before), "My bookings"
  with rebooking, and a waiting list for full days that reaches the owner's Inbox.
- Links from the start page to the customer page and owner studio demos.
- Salon command proposals and seven optional AI tasks work without API keys.
- AI evaluation command checks salon scenarios and reports accuracy, time and
  estimated cost, with no network calls by default.
- Concept for an AI-native salon system: owners and customers say or type
  what they want and approve a proposal; everything also works with buttons.
- Owner studio (`/studio`) demo: Today, Calendar, Customers, Inbox and More,
  with realistic fictional data (in progress).
- Goal queue, agent guide, quality and security baseline, and release process.

### Fixed
- Opening an Inbox item on desktop no longer opens a hidden mobile dialog that
  blocks clicking the message actions.
- Booking suggestions label the end time as “until”, making each time card
  unambiguous (#8).
- Campaign dates and posters show the year. Generic holiday requests and command
  suggestions use the next upcoming occasion; explicitly named holidays remain
  available (#11).
- Voice journal: sentences about treating skin or nails are no longer filed
  under observations.

## [0.1.0] - 2026-11-16

### Added
- Booking engine proof of concept: online booking, admin calendar, customer
  register, services and staff, proactive capacity suggestions, agent API and
  MCP with customer approval before booking.
