# Changelog

Cresavo was called Flerdo before November 2026.

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/) (`0.x` while in concept stage).

## [Unreleased]

### Fixed

- **Review follow-ups to the two fixes below.** A signed-in studio refuses a booking or Undo action on a provisional id before queuing it, Undo toasts wait for the server's own log id, and the screen reconciles to the newest server copy when the last of several queued changes fails. Staff blocks, free gaps, shift ends and fixed blocks are judged in elapsed time around the clock changes, the lead time tells the repeated hour's two passes apart by the trusted instant, and the public page hides exactly the times the store refuses for a completed visit. The account check holds `FOR SHARE` to the commit, the in-transaction quota shares the rate store's 10,000-bucket bound and lock, the self-hosted server refuses an oversized owner action body before Next.js buffers it, and the routine runner uses the salon's clock.
- **Signed-in studio: Undo and drag-to-move never act on another writer's record (#138).** A booking or Activity entry made by a change that the server has not answered yet has only a provisional id, which another device may already hold for a different record. Undo is now disabled and the booking cannot be dragged until the server's answer replaces the screen with its own ids.
- **Public booking, cancel and move (#133 items 6-10).** A deactivated owner account takes no booking even when it was switched off after the page was read, a retry gets its original receipt before the salon's quota is looked at (and with Postgres rate limits the quota is taken inside the booking's own transaction, so a commit that fails uses none of it), and a link that a concurrent earlier move has expired answers 404 instead of a booking-specific 409.
- **Clock changes (#133 items 8 and 11).** Two visits of the same person or room, and the one-hour lead time for online booking, are compared in elapsed time on 2027-03-28 and 2027-10-31 in Europe/Stockholm; a 60-minute visit at 01:30 now blocks a 03:00 booking the same night. Other days are judged exactly as before.
- **Older findings (#133 items 1-4).** An oversized owner action body is refused by the proxy before Next.js buffers it; a routine's `routine/ran` stamp must be the latest due slot by the store's clock, so a fast browser clock cannot silence later runs; the calendar grid widens to hold a visit's preparation and clean-up; a completed visit no longer holds clean-up time, so restoring it cannot overlap a visit booked in the meantime.

## [0.7.0] - 2026-11-22

### Added

- **Booking on a salon's own page (off by default).** With `PUBLIC_BOOKING_LIVE=1` and owner accounts on, the details step on `/boka/<slug>` now asks for name, mobile number and e-mail (all required) instead of saying booking opens soon, and `POST /api/public/salons/<slug>/bookings` books the time through the studio's own booking rules: one slot is booked once however many ask at once, a retry with the same `Idempotency-Key` returns the same booking, and the page reloads the free times when the time was just taken. Guests are held to 3 upcoming online bookings per phone number, 28 days ahead, 10 bookings per address per 15 minutes and 60 per salon per hour; a hidden field and a signed form-time token (3 seconds to 2 hours old) turn bots away with one generic answer, the body is capped at 4 KB, and an existing customer's name and e-mail are never overwritten from the public page. The typed e-mail is kept on the booking and erased with the customer. The page books only on the price, length and cancellation terms the guest was shown (checked under the salon's lock), a retry of a booking already made returns its original receipt even if the salon has since changed the treatment, and the receipt carries an opaque reference and appears on the page itself, on the product host and on a business's own address. A treatment that needs a deposit is not bookable here yet, for any guest whether or not the phone number is already a customer's: the page says to call the salon (English and Swedish). International numbers with a trunk zero (+44 (0)7700 …) are one number everywhere, and a form can no longer reach another salon that has taken over its address. The demo and the browser-state booking page are unchanged.
- **Booking confirmation e-mail (off by default, simulated until a provider is live).** A booking made on a salon's own page now sends a plain HTML and text confirmation in the salon's language (English and Swedish) through the e-mail connection, once per booking; a public booking is e-mailed only to the address typed on it, a bad address fails at once instead of being retried ten times, a message is frozen at its first attempt and resent unchanged under the same key, a send that may have gone out twice is retried only on Resend within 23 hours (otherwise it is marked `uncertain` for a person), a worker without the provider's credentials never counts a real e-mail as sent, and `npm run effects:drain` delivers what is left (run it every minute with the web app's settings). The e-mail links to `/boka/<slug>/booking/<id>` with a signed token in the address fragment; the page posts it, removes it from the address bar and shows a read-only view (treatment, time, address, free-cancellation deadline) with "call the salon to change or cancel". Nothing is sent for real unless `CONCEPT_CONNECTIONS_LIVE=1`, a provider and its secrets are set.
- **Cancel or change the time from the booking link (off by default).** Before the salon's free-cancellation deadline the holder of the e-mail link can cancel the booking or move it to another free time of the same treatment within the 28 days offered, free of charge (`POST /api/public/salons/<slug>/bookings/<ref>/cancel` and `/move`, token in the body, one `Idempotency-Key` per change); the studio's own booking rules decide, so a taken time, a finished or already cancelled booking and a booking with a deposit or fee are refused (409 `slot_unavailable`, `not_changeable`). After the deadline the page says to call the salon, with the number (409 `call_salon`); no fee is ever charged or refunded automatically. The owner gets an inbox notice and the customer one e-mail ("Your booking is cancelled" or "moved to ...", with a fresh link for a move), in English and Swedish. The demo is unchanged.

### Changed

- **A new product homepage, in English at `/` and Swedish at `/sv`.** "Own your bookings." opens with the wordmark drawn in dots, then walks from booking to chair beside live HTML replicas of the booking page, Today, a client card and the Someone is calling dialog, followed by three short reasons to own the system, an open-source card with the GitHub mark in dots, the client's own AI as the next step being tested, the founder's note, where each part stands, the two ways to run it, honest answers and a calm closing ask with the demo and an email to the founder. The page follows the system's light or dark scheme until the visitor flips the new toggle, works on phones without sideways scrolling, and shows everything at once with reduced motion. The film tour, sample booking and sticky phone button of the previous homepage are gone.

## [0.6.0] - 2026-11-22

### Added

- **A salon's booking page and free times from its own data (read only, off by default).** With `PUBLIC_BOOKING_LIVE=1` and owner accounts on, `/boka/<slug>` shows a real salon from the server: its page, treatments, team and when it is free. A projection built from explicit public fields leaves out customers, notes, journals, the inbox, surnames, internal roles, past visits and anything not listed; reviews are sent only when the salon has them on and the owner approved them, as ratings alone unless the page shows the reviews section, then with the display name of the few it shows; the page gets only the sanitised stylesheet, and times beyond 28 days are not offered. `GET /api/public/salons/<slug>` and every page view are limited to 120 reads per 15 minutes per address and never cached. An unknown address is a 404 and a store failure an error page, never the browser's own demo copy; the demo build and the demo's host never take this path. A salon whose owner account is switched off is not shown. Confirming still books nothing: before asking for contact details the page says online booking opens soon and gives the salon's phone, in English and Swedish. A unique index gives each salon its own booking address: signing up with a name another salon uses gets the next free address ("-2", also when two people sign up at once), and changing an address to a taken one tells the owner so. The demo and the browser-state booking page are unchanged.
- **Safer customer import from a CSV export.** The importer now reads Swedish and English headers (förnamn, telefon, e-post, anteckning, födelsedag and more), quoted cells with line breaks, a BOM and comma, semicolon or tab separators. It rejects invalid e-mail addresses and overlong values, treats the same phone number or e-mail (in the file or already a customer) as a duplicate, accepts at most 5,000 rows and 2 MB, and summarises "new, duplicates skipped, errors" before you confirm. A note explains that the salon needs a legal basis and that imported customers have no marketing consent. A file with a quote that is not closed properly is rejected with the line number, and the import is one step (up to 5,000 customers, allowed up to 2.5 MB on the server) that is reported as done only when it is saved (a signed-in salon waits for the server, and browser storage that is full cancels it) and can be undone in one go. Customer exports now defuse free text that starts with = + - or @ so a spreadsheet does not run it as a formula.
- **Preparation, clean-up and processing time for treatments, for hairdressers.** A treatment can have time before and after the visit when you are busy and the customer is not there, and a processing gap (for example colour developing) where the customer stays and you are free to take someone else's short treatment. Free times, the calendar's checks and every booking path use the same rule, rooms and chairs stay taken through the processing, and the calendar shows the gap striped and the buffers faintly. Set it under "More options" when editing a treatment.
- **A "Layout" choice for four posters, instead of free placement.** Price, Portrait, Full photo and Before/after get one safe alternative arrangement, picked in the poster step and carried into the next campaign. Price puts the photo on the left and the text, price and sticker on the right; Portrait puts the text column on the right and the person on the left, with the scrim and a cut-out's position mirrored so the face stays clear of the text; Full photo ("Text at the top") puts the text block, with the salon's name chip on it, on a solid dark panel at the top and the photo below the panel, inside a story's safe zones; Before/after shows the after photo first, with each label and the arrow still right. Margins, the scrim behind white text and the story's top and bottom bars are kept in every arrangement; the other templates ignore the choice.
- **Captions that fit the goal and sound like the owner.**
  - The texts follow the campaign's goal: free times list the day and times from the Free-times poster, wellness names the treatments and the owner's benefit badges, gift cards promise no price or validity, and a review campaign quotes the newest review with the customer's public name. Without a goal the discount sentence is unchanged.
  - The texts step learns the owner's voice from their latest published campaigns, with nothing new stored: hashtags they add again and again, whether they use emoji and how long they write. Only published text teaches it. The rule-based captions use it, the AI draft gets only emoji and length hints, a review caption is never sent to it, and the step says "Written in your style" when hashtags were found. A sign-off the owner types ("Your sign-off (optional)") is saved with the campaign, carried to the next one, added to every caption where it fits and never to an SMS; an SMS review keeps its closing quote mark and author. Publishing a free-times campaign after the day it advertises is blocked. When the offer changes, captions the owner edited keep their text and are flagged "Check the text for: …" in the texts and publish steps.
- Two poster templates. **Full photo** lets the photo fill the whole poster under a dark gradient with a big headline, one line, a white booking button and one small contact line; it has its own story layout. **Type only** is a poster of words on the salon's background colour: a very large headline, the detail, a thin accent rule and the booking button. The goals now suggest them: Promote suggests Price, Full photo and Portrait; Fill free times suggests Free times, Full photo and Type only. Type only needs no photo: the editor hides the photo, crop and tone controls and nothing is fetched or sent. Long single words shrink to fit instead of running off the poster, the Type only footer keeps the booking link whole, its text and button colours follow real contrast, and default poster words follow the business's language; Full photo and Type only under Fill free times show the free day and times.
- **Start a campaign from a goal.** The campaign studio first asks what the owner wants to do: fill free times, promote a treatment, wellness benefits, sell gift cards or share a review. The goal fills in the campaign's name, offer and dates, and the poster step shows three suggested posters with different compositions above the full list of styles.
- **One message per poster.**
  - Posters now start from the first sentence of a treatment's description; the full description belongs in the post's text.
  - The QR code is on the printed window poster by default. Posts and stories show it only when the owner ticks "Show the QR code in posts and stories too", and new campaigns keep that choice.
  - Every story keeps its text out of the top 270 px and bottom 390 px that Instagram covers with its own bars. Templates without their own story layout show the post as a card between the bars.
  - The editor warns when a long word would make a headline too small to read in the feed.
- A **Portrait** poster template: a photo of the owner or a colleague on a drawn background in the salon's colour (flower, leaves, waves, sun or plain), with a small line above a big headline, the wellness badges, a short text, a call to book, the link and a QR code. A cut-out photo (a transparent PNG, for example an iPhone "lift subject" cut-out) stands free at the bottom right; any other photo sits in an arch. Text is laid out by rule: a dark scrim behind it, nothing over a face, and nothing important in the parts of a story that Instagram covers. Söderberg & Partners joins the wellness badges.
- Owners can adjust the photo on the server-engine posters with Light (±15%), Contrast (±10%) and Warmth (±10%) sliders and a reset button; both Before/after photos get the same tone and the original photo is never changed. The poster step can also preview the poster at feed width inside a plain phone-feed mock (no Instagram or Meta marks). A published Free-times campaign warns above its exports when some of its saved times have since been booked, and still lets the owner export.
- A **Before/after** poster template: the owner's before and after photos side by side (one above the other in the story format) with "Before" and "After" on them, the treatment, a short text and, in the story format, a call to book. The poster step has a photo picker for each photo; both can be the owner's own photo.
- Engine posters carry a QR code to the salon's booking page in the signature, beside its name, so a printed poster or a screenshot leads straight to booking. Owners can pick the wellness benefits they accept (Epassi, Benify, Wellnet, Actiway, Edenred; up to four) for the Price and Price list posters; a new campaign keeps the choice from the latest one. The QR code uses uqr (MIT).
- Three more poster templates on the server engine: **Season** (a holiday or season greeting on the salon's colour with a call to book), **Review** (the newest published review, its stars and the customer's first name and initial) and **Free times** (up to four free times on the first day this week that still has room for the treatment, with the day on a sticker; the story format ends with a booking button).
- A server poster engine draws campaign posters from designed templates with fixed slots, so they stay presentable: **Price** (the treatment, its price after the discount, an offer sticker and the photo in an arch) and **Price list** (treatments with prices from the price list and payment badges). Both carry the same signature with phone, rating and booking link, follow the salon's colours and heading font, and work with your own photo, text size, crop, Share and Download. Price is the default for new campaigns; the five earlier styles remain. The engine uses Satori (MPL-2.0) and bundled Inter and Caladea font subsets (OFL).
- Campaign posters use the salon's own colours and heading font from its booking page design, in every poster style, so they look like the salon and not like a template. Salons without their own colours keep the template look.
- Owners can use a photo from their phone or computer on a campaign poster (scaled down in the browser) for sharing and downloading. It is not saved with the campaign yet; the published campaign keeps a template photo, and the poster step says so.
- The campaign poster has a Share button that opens the phone's share sheet (Instagram, Facebook, Messages) with the finished image and text, and downloads it where sharing is not supported. Owners can make the poster text smaller or larger and choose which part of the photo stays in view; the headline never grows wider than the poster. A new campaign's poster starts from the style, text size and photo crop of the latest one.
- Owner accounts for real salons, off by default (`OWNER_ACCOUNTS_ENABLED=1`). `/api/owner/signup` creates an account and its salon in one transaction, stored as a `salon` row behind `StudioStore`. `/api/owner/login`, `/logout` and `/me` use a 30-day session cookie whose token is stored only as a hash and ends when the password changes or the account is disabled. Sign-up and login are rate-limited, refuse other sites and stay locked on the read-only demo. Owners create an account at `/account/signup`, sign in at `/account/login` and see their salon and a sign-out button at `/account`, in English and Swedish. A new migration adds `owner_account` and `owner_session`. `GET /api/owner/salon` returns the signed-in owner's salon and `POST /api/owner/salon/actions` saves one studio change to it through `PostgresStudioStore`, with version checks and idempotency keys; the salon always comes from the session. Owner changes are limited to an allowlist of studio action types; messages and payments are not sent yet. Set `STUDIO_STORE_HMAC_SECRET` (32+ characters). A signed-in owner's studio opens their salon from the server: changes show at once, are sent one at a time and replaced by the server's answer, and the same salon appears on every device they sign in on. A refused change or lost connection reloads the saved salon and says so. The demo and the browser trial salon are unchanged.
- An isolated agent-booking sandbox profile with expiring agent keys, a private demo phone, a per-session calendar and a nightly reset. Each address bucket holds at most one session slot; pairing again replaces the earlier session without refilling its call budget. The deployment guide covers a dedicated project for the fictional data.
- `scripts/sandbox/bootstrap.mjs` prepares the sandbox database and both projects' production settings on the owner's machine without printing a secret.
- A `StudioStore` interface defines how the studio and server read and change a salon. It covers versions, idempotency keys, effects published after commit and an append-only action log. An in-memory reference store, an adapter over the existing browser store and a shared contract suite back it. The studio behaves as before. See docs/design/STUDIO_STORE.md.
- A staged `PostgresStudioStore` keeps each salon in a `tenant_state` row behind a row lock, with the database clock, 24-hour idempotency keys fingerprinted by HMAC, an append-only `tenant_action` log and a `tenant_effect` outbox written in the same transaction. Effects are delivered one at a time in commit order, so a refund never overtakes its checkout. Booking cutoffs and support grants follow the store clock, and activity text uses the salon's language and currency. A new migration adds the four tables. The intended role grants and a check of the role's effective privileges are in `prisma/grants/`. It passes the shared contract suite against a disposable database. Nothing in the app uses it yet.
- The staged Postgres store has an outbox poller (`npm run effects:drain`). It delivers effects left after a crash exactly once, in commit order, with backoff and a `failed` state, and is safe to run several at once. Effects of demo and sandbox salons only reach simulated providers. A held row lock now times out after 2 seconds as a conflict. A new migration adds the outbox states. Nothing in the app uses it yet.
- Erasing a customer for good (`customer/erase`) removes them and their records from the salon and the trash. Activity entries about them keep no text or undo data, and their name, phone or email in other notes is replaced by a marker in the salon's language. Slugs, ids and other customers' details are never changed. Stores refuse it as an ordinary change. The staged Postgres store's `eraseSubject` also redacts its audit log, including idempotency keys and phones typed in another format, and the messages to that customer in the same transaction. It cancels unsent messages to them, reports one that is being sent, and forgets only the idempotency keys that held them. The SECURITY DEFINER version for production is in `prisma/grants/erase-subject.sql`, created in one transaction without access for other roles.
- The staged Postgres store publishes commit versions across instances through LISTEN/NOTIFY. It adds caller-scoped idempotency keys, privileged tenant replacement, a daily demo reset and 24-hour sandboxes with simulated effects. Operators can run `npm run store:sweep` for retention and `npm run store:loadtest` to measure a fictional 10,000-booking tenant. The store records local size and latency metrics and refuses documents over 8 MB.

### Changed

- The homepage FAQ now says the first salons get the founder’s personal help to move clients and upcoming bookings; older visit history cannot be moved yet.
- The product homepage (`/` and `/sv`) now says who it is for and what works today. The first screen reads “Booking system for salons” and “Less admin. More time for your clients.”, says next to the button that this is an early demo not yet open to salons, and shows a readable crop of the day’s schedule on phones. Three everyday moments with Swedish screenshots on the Swedish page replace the tabbed studio views and the big one-word rows. A short founder note, one status section (demo, simulated, on the way, before the first salon) with the clients’ AI as a marked test, hosted pricing as the main plan with no lock-in period, a contact email and eight more precise answers about import, bookings, help, export and shutdown follow. While the waiting list stores nothing, the page ends with the demo and the client’s booking page instead of a form. The demo buttons open the studio and booking page in the page’s language, replacing a language saved on an earlier visit. The phone menu shows Pricing, and `/about` and `/sv/about` may be indexed.
- The product homepage is rebuilt around what makes Cresavo different: few clicks and less admin, open source, no commission and built for AI. It shows a Friday at Salong Eko with the studio's own screenshots in the page's language, what's in the demo now and what's still to come, plus a sticky demo button on phones. The studio views ("Inside the studio") and the film tour with its sample booking ("See it in action") stay; the channel map, open-design hub and comparison table are gone. The founder's story moved to a new about page (`/about`, `/sv/about`). Both languages say the same thing.

- Cost guards: the proxy no longer runs for static files, the Inbox polls proposals every 60 s on the public demo (15 s elsewhere), AI provider calls are capped at 2,048 output tokens and 200 calls per day per process, and anonymous pairing traffic has a global ceiling of 3,000 requests per minute. [Cost safety](docs/DEPLOY_DEMO.md#cost-safety) lists the code limits and the dashboard settings to pair with them.
- Pages send a per-request Content-Security-Policy nonce, so the browser runs only scripts the server issued. Inline and injected scripts without the nonce are blocked.
- Write endpoints use one shared same-origin check that follows the public host behind trusted proxies, rejects requests browsers mark as cross-site or same-site, and requires https origins in production. Pages also send a Permissions-Policy and, outside the OAuth consent flow, Cross-Origin-Opener-Policy.
- The staff preview starts in Advanced, with a return to the owner view available while previewing.
- Finance opens with what is left this month and a comparison with last month. Send to my accountant explains the two download options and the dates they cover.
- Gift cards and packages share one add-on and one More entry with two tabs. Owners can approve and reply to reviews from the Inbox.
- The owner studio uses shared controls, page headers, status badges and list rows. Calendar groups its secondary tools in an options sheet and gives appointments larger touch targets.
- The public booking pages and product site use shared controls. Booking keeps the salon's colours, makes treatment actions and review ratings easier to see, and keeps the checkout summary beside the form on wide screens.

### Security

- The owner studio endpoint (`/api/owner/salon/actions`) validates every field of each action against its own strict schema, not only the action type. Unknown fields, wrong types, oversized strings, out-of-range amounts, invalid dates, ids of another kind and prototype keys (`__proto__`, `constructor`, `prototype`) are refused with `invalid` before the studio reducer runs, and the reducer receives only the parsed action.

### Fixed

- **Posters stay inside their margins, whatever the text.** Headlines, prices, captions, badges, salon names and booking links are now sized and wrapped with the real widths of the bundled fonts instead of estimates, and a layout guard test renders every template, arrangement, format and text size with the longest content and measures the drawn text: 64 px margins, a story's top and bottom bars, no text over the face part of a photo, no overlapping text. This fixes a long Portrait text block growing into the top bar or over a cut-out person or the arch, Price clipping `MAMMAMASSAGE` and starting its price over the photo, a long Full photo link or salon name running off the poster, and the Before/after labels covering faces (they now sit in a strip below each photo). Price and Before/after text follow real contrast, and the footer keeps 64 px from the bottom.
- The public demo studio lost its side menu, desktop layout and spacing because the deployed stylesheet was built with the product site's Tailwind settings. The studio stylesheet now names its own settings.
- The demo deploys again: Vercel rejected every deployment after the build command grew past its 256-character limit. The build steps now live in `scripts/vercel-build.sh`, the upload allowlist in `.vercelignore` includes the product site's Tailwind config and the pairing Prisma config, and tests guard both.
- Booking, payment and undo in the demo are now saved for the salon they were shown in. A second tap while a booking, deposit payment, cancellation or assistant approval is being saved does nothing. A booking whose lead time passed while it was being saved is refused. A change, Undo or assistant approval made for a salon that another tab has since replaced or reset is refused with the usual message, instead of reaching the new salon. Approving an assistant card that would change nothing now shows it as failed.
- The demo now records a simulated text, email or payment only after its change is saved. A save that is refused or retried because another tab saved first sends nothing extra. Offering a freed time or today's free times to the waiting list sends the text only together with its Inbox note, with the count of customers it actually reached. Nothing is sent if the visit was moved, its time was booked by someone else, no free time is left, nobody is waiting any more or the waiting list was switched off meanwhile.
- Prisma's configuration loader now uses `effect` 3.22.5, which fixes a high-severity ReDoS advisory (GHSA-7589-6fvf-x4pw) in the dependency tree.
- The staged Postgres store allows customer erasure, support access revocation and size-reducing writes above 8 MB. It keeps sandbox versions and history scoped to a unique tenant lifetime, ignores stale demo resets, and signals subscribers to refresh when notifications reconnect.
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
