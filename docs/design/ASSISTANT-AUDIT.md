# Assistant audit (Codex gpt-6.2-sol)

Read-only audit of the in-product assistant, 2026-11-17, against branch design/libovo-brand-v09. Verbatim.

# Cresavo assistant audit

**Make Assistant a visible secondary tool in Studio.** It earns its place when an owner can say “Move Eva’s 10:45 to Thursday” and get a checked proposal. Today it handles that better than “Who’s next?” or “Can I fit a massage tomorrow?” Fix those daily gaps before giving it more screen space.

I checked the exact English prompts below against the rule engine as an owner, using Salong Eko demo data at 10:00 on 17 November 2026. The ranking is product judgment. **14 work, 3 partly work, and 13 fail.** Both requested test suites passed all 53 tests. I traced the UI in code. Verification was at the engine level. This checkout names the platform **Libovo** and the assistant **Ask Flerdo**. The naming recommendation uses **Cresavo** as the target brand. [Assistant tests](../../tests/concept-assistant.test.ts) · [Command tests](../../tests/concept-command.test.ts) · [Brand config](../../src/concept/brand.ts)

## 1. What owners would actually ask

**Fallback** means “I did not catch that” followed by generic example prompts. Business changes appear as proposals for approval. Explicit memory requests save immediately with Undo. Customer sends in this demo are simulated. [Fallback in `engine.ts → commandReply`](../../src/concept/assistant/engine.ts:162) · [Approval UI](../../src/concept/studio/assistant/reply-card.tsx:50)

| # | What the owner says | Without AI | What comes back and where |
|---:|---|---|---|
| 1 | “Who’s next?” | **No** | Fallback. Today already has a Next customer card. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) |
| 2 | “Any room for a 60-minute massage tomorrow afternoon?” | **No** | Fallback. `getAvailability` exists, but the panel has no availability-only route. [`tools/read.ts → getAvailability`](../../src/concept/tools/read.ts:91) |
| 3 | “Move Eva Nyberg’s 10:45 today to Thursday at 14:00.” | **Yes** | 14:00 is taken. Offers 14:15, 15:45 or 16:00, then shows the old and new times for approval. [`command/proposal.ts → moveProposal`](../../src/concept/command/proposal.ts:140) |
| 4 | “Book Camilla Malm for Basic foot care Thursday afternoon.” | **Yes** | “Pick a time” with 14:15 and 15:45. Selecting one shows the service, duration, price and practitioner for approval. [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 5 | “When is Camilla Malm’s next appointment?” | **No** | “Which treatment should I book?” with service choices. It treats the lookup as a new booking. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:72) |
| 6 | “Cancel Lars Lindberg at 11:30 today and offer the slot to the waiting list.” | **Yes** | Cancellation preview with an offer to 54 waiting customers. Approval cancels the booking and adds one simulated Inbox notice. The count uses the broad waitlist flag. [`command/proposal.ts → cancelProposal`](../../src/concept/command/proposal.ts:162) · [`waitlist-notice.ts → waitlistCount`](../../src/concept/studio/booking/waitlist-notice.ts:7) |
| 7 | “Text Ida Nilsson that I’m running 15 minutes late.” | **No** | Fallback. The panel’s outreach route recognizes offers and greetings. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:198) |
| 8 | “Who is coming today?” | **Yes** | Ten rows with time, client, service and practitioner. Includes completed visits and gives no direct booking link from each row. The date handling covers today and tomorrow. [`engine.ts → bookingsReply`](../../src/concept/assistant/engine.ts:125) · [Booking rows](../../src/concept/studio/assistant/reply-card.tsx:138) |
| 9 | “Book her for the same as last time in six weeks.” | **Partly** | After discussing Eva, fills in Basic foot care with Anna, then asks which day and offers Today through Saturday. “Last time” can also pick a future booking. [`assistant/thread.ts → resolveReferences`](../../src/concept/assistant/thread.ts:73) · [`intent/dates.ts → parseDate`](../../src/concept/intent/dates.ts:26) |
| 10 | “What did we do for Eva Nyberg last time?” | **No** | Fallback. The “same as last time” substitution supports rebooking phrasing. [`assistant/thread.ts → resolveReferences`](../../src/concept/assistant/thread.ts:86) |
| 11 | “Block 13:00 to 14:00 tomorrow for lunch.” | **No** | Fallback. Schedule commands cover whole-day absence, whole-day closure and shift changes. [`intent/schedule.ts → interpretSchedule`](../../src/concept/intent/schedule.ts:29) |
| 12 | “What’s waiting in the inbox?” | **No** | Fallback. The morning brief can count pending booking and reschedule requests. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) · [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:58) |
| 13 | “Erik is sick today.” | **Yes** | Proposes marking Erik off and says four bookings need moving. The owner handles the moves separately. [`command/schedule-proposal.ts → staffOffProposal`](../../src/concept/command/schedule-proposal.ts:24) |
| 14 | “Mark Marie Bergström’s 09:00 today as a no-show.” | **No** | Fallback. The command interpreter has no visit-outcome intent. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:72) |
| 15 | “What does Basic foot care cost, and how long does it take?” | **No** | Asks which discount or price to use, with 10%, 15% and 20% choices. The service catalog already has the answer. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:53) · [`tools/read.ts → listServices`](../../src/concept/tools/read.ts:143) |
| 16 | “Save a journal note for Eva Nyberg: used a softer file, review in six weeks.” | **No** | Fallback. Dictation and review are available separately on the customer’s journal. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) · [`journal-dictation.tsx → JournalDictation`](../../src/concept/studio/customers/journal-dictation.tsx:38) |
| 17 | “Who’s due back for foot care?” | **No** | Fallback. The brief can show a count across services and link to Due back. [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:72) |
| 18 | “Put Camilla Malm on the waiting list for a Saturday morning cut.” | **No** | Fallback. The command path only recognizes the waiting list as part of cancellation. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:104) |
| 19 | “Remember Eva Nyberg prefers Anna.” | **Yes** | “Saved. I will keep that in mind.” Shows the saved note with Undo. Future booking proposals can prefer Anna when she can perform the service. [`engine.ts → rememberReply`](../../src/concept/assistant/engine.ts:53) · [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 20 | “Show me today’s brief.” | **Yes** | Up to six items. In the sample it shows a cancellation, booking count and first booking, inbox count, two low-stock items and a gap count. [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:58) |
| 21 | “What have I earned today?” | **Yes** | SEK 795, date, visit count and a breakdown. The calculation uses finished visits and recorded retail sales. [`command/proposal.ts → revenueProposal`](../../src/concept/command/proposal.ts:297) · [`selectors.ts → revenueBetween`](../../src/concept/selectors.ts:115) |
| 22 | “How much unscented massage oil is left?” | **Yes** | One 1 L bottle, low-stock indicator, about five days remaining, and a Stock link. [`command/proposal.ts → stockLevelProposal`](../../src/concept/command/proposal.ts:255) |
| 23 | “Sold two home care foot creams to Eva Nyberg.” | **Yes** | Proposes recording two units for SEK 438 and shows stock going from nine to seven. [`command/proposal.ts → sellProposal`](../../src/concept/command/proposal.ts:275) |
| 24 | “Order more urea foot cream.” | **Yes** | Supplier proposal with 20 tubes, SEK 1,780, on-order count and an estimated three-day lead time. [`command/proposal.ts → stockProposal`](../../src/concept/command/proposal.ts:235) |
| 25 | “How busy is Erik next week?” | **Yes** | 82% of working hours booked, the date range and a per-day chart. [`command/insight.ts → busyWeek`](../../src/concept/command/insight.ts:82) |
| 26 | “Remember Eva Nyberg only wants mornings.” | **Partly** | Saves and can recall the note. Booking suggestions can still include afternoons because only practitioner preference affects booking. [`assistant/memory.ts → memoryFor`](../../src/concept/assistant/memory.ts:95) · [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 27 | “How much is left on gift card EKO-1234?” | **No** | “I could not find ‘is’ in your stock.” The stock matcher consumes the balance question. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:29) |
| 28 | “Close the salon on Friday.” | **Yes** | Whole-day closure proposal with 14 bookings flagged for moving. [`command/schedule-proposal.ts → closeSalonProposal`](../../src/concept/command/schedule-proposal.ts:43) |
| 29 | “Which customers haven’t been here since summer?” | **Yes** | 46 customers with no visit since 1 September and no future booking. Shows eight names, visit history and a follow-up offer. [`command/proposal.ts → inactiveProposal`](../../src/concept/command/proposal.ts:311) |
| 30 | “Send them a 15% welcome-back offer.” | **Partly** | After #29, drafts for all 46 at **10%**. Preview shows three names and one example text. [`engine.ts → offerReply`](../../src/concept/assistant/engine.ts:100) · [`assistant/outreach.ts → offerProposal`](../../src/concept/assistant/outreach.ts:17) |

Two more failures matter before broader rollout. “Who is coming on Friday?” returned Tuesday’s list. “Close the salon early tomorrow at 15:00” drafted an **all-day closure**. A revenue question about “yesterday” returned **the entire month**. These are plausible-looking wrong answers in routine workflows. [Schedule reply](../../src/concept/assistant/engine.ts:125) · [Closure parser](../../src/concept/intent/schedule.ts:29) · [Revenue date parsing](../../src/concept/intent/dates.ts:58)

## 2. Gimmick check

| Current feature | Decision |
|---|---|
| Booking, move and cancellation proposals | **Keep.** Useful from another screen or while handling a call. When the appointment is already open, its Move or Cancel button is faster. Keep before/after, approval and Undo. [Booking sheet](../../src/concept/studio/booking/booking-sheet.tsx:172) |
| Voice input and read-aloud | **Improve.** Put one mic in the panel, show it when supported, and let the owner correct names and times before submitting. Move read-aloud to preferences. Today it reads reply text, which can omit the useful details in the card. [Panel](../../src/concept/studio/assistant/assistant-panel.tsx:48) · [Speech](../../src/concept/command/use-speech.ts:48) |
| Briefs and routine suggestions on both Today and panel opening | **Improve.** Put urgent exceptions on Today with direct actions. The panel should open at the input. Keep closing and weekly reports available on request. Today already has schedule, next customer, needs-moving and evening summary. [Today](../../src/app/studio/page.tsx:50) · [Panel opening](../../src/concept/studio/assistant/assistant-panel.tsx:170) |
| Monday recalls and Friday restock | **Improve.** Keep recall drafts under Due back and reorder drafts under Stock. The current two templates prepare proposals while Studio is open. Remove the owner-facing `SKILL.md` view and the extra trip through chat to review a run. [Routine runner](../../src/concept/studio/assistant/assistant-launcher.tsx:65) · [Routines page](../../src/concept/studio/assistant/routines-page.tsx:57) |
| Memory, inferred facts and thread summaries | **Improve.** Keep explicit booking preferences where owners can see and edit them on the customer record. Remove unsolicited “remember this?” cards and automatic topic summaries. A preference earns its place when it affects the next booking. [Memory rules](../../src/concept/assistant/memory.ts:55) · [Thread summaries](../../src/concept/studio/assistant/use-assistant.ts:120) |
| Revenue, utilisation and stock answers | **Keep.** A specific number is useful from another screen. Inside Finance or Stock, use the page’s existing figures and controls. [Answer cards](../../src/concept/command/answer-card.tsx:20) |
| Poster and booking-page commands | **Remove from global Assistant.** “Make a poster” often opens a prefilled Campaigns flow. Page styling is occasional and easier to judge in the editor preview. Put those shortcuts in their editors. [Campaign handoff](../../src/concept/command/proposal.ts:191) · [Page design proposal](../../src/concept/command/page-proposal.ts:34) |
| Sparkles, “Rules · no AI” badges and automatic prose rewrites | **Remove.** Give the visual emphasis to a useful status such as “Needs approval” or “Simulated.” Optional model interpretation can still help with phrasing. [Panel chrome](../../src/concept/studio/assistant/assistant-panel.tsx:88) · [Model handling](../../src/concept/studio/assistant/use-assistant.ts:69) |

## 3. Ten improvements in priority order

| # | Improvement | Effort |
|---:|---|:---:|
| 1 | **Separate read questions from changes.** Parse explicit dates and time bounds before building a card. Ask what the owner means when a bound is unsupported. Add fixed-clock regression cases for Friday, yesterday, “close early” and price lookups. | M |
| 2 | **Add `find-availability`.** Answer with up to three actual starts for the service, duration, staff and room across the requested window. Show the next viable day when full. Offer **Book this time** on each choice. | M |
| 3 | **Add next-client, named appointment and last-visit lookups.** Lead with the time, service and practitioner. Link straight to the booking or customer. Ask which person only when multiple records match. | M |
| 4 | **Make rebooking a continuation.** Use the last completed visit, support “in six weeks” and “anything later?”, and keep the chosen customer, service and practitioner while the owner compares times. | M |
| 5 | **Add a late-running message.** Resolve the appointment, prefill the recipient and a short delay message, then show one editable preview with a send confirmation. Use the existing Inbox flow for replies. | M |
| 6 | **Turn staff absence into a recovery list.** After “Erik is sick,” show each affected booking with its best eligible replacement and a clear next action. Let the owner approve each move from the same list. | L |
| 7 | **Make gap filling and recalls specific.** Record waitlist service and time constraints, then filter eligible recipients by fit, contact permission and recent outreach. Show the full recipient list and exact offer before approval. A due-back query should name clients and suggest real openings. | L |
| 8 | **Add timed blocks and visit outcomes.** “Block lunch 13:00–14:00” should preview overlaps for the selected practitioner. “Mark Marie as a no-show” should identify the booking and offer one confirmation. | L |
| 9 | **Add direct service and balance answers.** Show price and duration from the catalog. Resolve a gift-card code to its balance and details. Show pending Inbox items with direct links instead of sending the owner to a generic menu. | M |
| 10 | **Send journal requests to the customer’s journal.** Resolve the client and open the existing dictation or entry form in one step. Keep treatment text in the journal workflow. The current chat persists recent messages in browser storage. | S |

## 4. Naming

**Use “Assistant.” Skip the persona name.** It is a recognizable tool label in both languages and leaves Cresavo as the product brand. The owner-facing control belongs in Studio. Public booking, gift cards and My bookings should use the tenant’s identity and task labels like **Book an appointment**. [White-label policy](../../docs/design/LIBOVO.md:118)

| Option | Judgment |
|---|---|
| **Ask** | Quiet and short. “Ask” alone could mean Help or search. Swedish *Fråga* has the same issue. |
| **Assistant** | Best fit. **Assistent** translates directly and the label can cover questions and actions. |
| **Ask Cresavo** | Understandable once the brand is familiar. It repeats the wordmark and makes the assistant feel more central to the product. |
| **Short persona name** | Adds a second identity owners have to learn. It also makes the feature feel like a chatbot before it has answered anything. |

| UI element | English | Swedish |
|---|---|---|
| Panel title | **Assistant** | **Assistent** |
| Open button | **Assistant** | **Assistent** |
| Input placeholder | **Who is coming today?** | **Vilka kommer idag?** |
| Submit button | **Send** | **Skicka** |
| Desktop shortcut hint | **⌘K** on Mac, **Ctrl+K** elsewhere | **⌘K** on Mac, **Ctrl+K** elsewhere |

## 5. Placement verdict

**Secondary, one tap away.** Keep the desktop header button and shortcut. On phones, use one quiet, labeled launcher above the tabs and put the mic inside. Give Today, Calendar and Inbox the primary actions. The assistant is worth opening when it can combine a lookup and a change in one request. For an appointment already on screen, the owner should be able to act directly. [Current entry points](../../src/concept/studio/assistant/assistant-launcher.tsx:17)
137,512
# Cresavo assistant audit

**Make Assistant a visible secondary tool in Studio.** It earns its place when an owner can say “Move Eva’s 10:45 to Thursday” and get a checked proposal. Today it handles that better than “Who’s next?” or “Can I fit a massage tomorrow?” Fix those daily gaps before giving it more screen space.

I checked the exact English prompts below against the rule engine as an owner, using Salong Eko demo data at 10:00 on 17 November 2026. The ranking is product judgment. **14 work, 3 partly work, and 13 fail.** Both requested test suites passed all 53 tests. I traced the UI in code. Verification was at the engine level. This checkout names the platform **Libovo** and the assistant **Ask Flerdo**. The naming recommendation uses **Cresavo** as the target brand. [Assistant tests](../../tests/concept-assistant.test.ts) · [Command tests](../../tests/concept-command.test.ts) · [Brand config](../../src/concept/brand.ts)

## 1. What owners would actually ask

**Fallback** means “I did not catch that” followed by generic example prompts. Business changes appear as proposals for approval. Explicit memory requests save immediately with Undo. Customer sends in this demo are simulated. [Fallback in `engine.ts → commandReply`](../../src/concept/assistant/engine.ts:162) · [Approval UI](../../src/concept/studio/assistant/reply-card.tsx:50)

| # | What the owner says | Without AI | What comes back and where |
|---:|---|---|---|
| 1 | “Who’s next?” | **No** | Fallback. Today already has a Next customer card. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) |
| 2 | “Any room for a 60-minute massage tomorrow afternoon?” | **No** | Fallback. `getAvailability` exists, but the panel has no availability-only route. [`tools/read.ts → getAvailability`](../../src/concept/tools/read.ts:91) |
| 3 | “Move Eva Nyberg’s 10:45 today to Thursday at 14:00.” | **Yes** | 14:00 is taken. Offers 14:15, 15:45 or 16:00, then shows the old and new times for approval. [`command/proposal.ts → moveProposal`](../../src/concept/command/proposal.ts:140) |
| 4 | “Book Camilla Malm for Basic foot care Thursday afternoon.” | **Yes** | “Pick a time” with 14:15 and 15:45. Selecting one shows the service, duration, price and practitioner for approval. [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 5 | “When is Camilla Malm’s next appointment?” | **No** | “Which treatment should I book?” with service choices. It treats the lookup as a new booking. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:72) |
| 6 | “Cancel Lars Lindberg at 11:30 today and offer the slot to the waiting list.” | **Yes** | Cancellation preview with an offer to 54 waiting customers. Approval cancels the booking and adds one simulated Inbox notice. The count uses the broad waitlist flag. [`command/proposal.ts → cancelProposal`](../../src/concept/command/proposal.ts:162) · [`waitlist-notice.ts → waitlistCount`](../../src/concept/studio/booking/waitlist-notice.ts:7) |
| 7 | “Text Ida Nilsson that I’m running 15 minutes late.” | **No** | Fallback. The panel’s outreach route recognizes offers and greetings. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:198) |
| 8 | “Who is coming today?” | **Yes** | Ten rows with time, client, service and practitioner. Includes completed visits and gives no direct booking link from each row. The date handling covers today and tomorrow. [`engine.ts → bookingsReply`](../../src/concept/assistant/engine.ts:125) · [Booking rows](../../src/concept/studio/assistant/reply-card.tsx:138) |
| 9 | “Book her for the same as last time in six weeks.” | **Partly** | After discussing Eva, fills in Basic foot care with Anna, then asks which day and offers Today through Saturday. “Last time” can also pick a future booking. [`assistant/thread.ts → resolveReferences`](../../src/concept/assistant/thread.ts:73) · [`intent/dates.ts → parseDate`](../../src/concept/intent/dates.ts:26) |
| 10 | “What did we do for Eva Nyberg last time?” | **No** | Fallback. The “same as last time” substitution supports rebooking phrasing. [`assistant/thread.ts → resolveReferences`](../../src/concept/assistant/thread.ts:86) |
| 11 | “Block 13:00 to 14:00 tomorrow for lunch.” | **No** | Fallback. Schedule commands cover whole-day absence, whole-day closure and shift changes. [`intent/schedule.ts → interpretSchedule`](../../src/concept/intent/schedule.ts:29) |
| 12 | “What’s waiting in the inbox?” | **No** | Fallback. The morning brief can count pending booking and reschedule requests. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) · [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:58) |
| 13 | “Erik is sick today.” | **Yes** | Proposes marking Erik off and says four bookings need moving. The owner handles the moves separately. [`command/schedule-proposal.ts → staffOffProposal`](../../src/concept/command/schedule-proposal.ts:24) |
| 14 | “Mark Marie Bergström’s 09:00 today as a no-show.” | **No** | Fallback. The command interpreter has no visit-outcome intent. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:72) |
| 15 | “What does Basic foot care cost, and how long does it take?” | **No** | Asks which discount or price to use, with 10%, 15% and 20% choices. The service catalog already has the answer. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:53) · [`tools/read.ts → listServices`](../../src/concept/tools/read.ts:143) |
| 16 | “Save a journal note for Eva Nyberg: used a softer file, review in six weeks.” | **No** | Fallback. Dictation and review are available separately on the customer’s journal. [`engine.ts → respond`](../../src/concept/assistant/engine.ts:175) · [`journal-dictation.tsx → JournalDictation`](../../src/concept/studio/customers/journal-dictation.tsx:38) |
| 17 | “Who’s due back for foot care?” | **No** | Fallback. The brief can show a count across services and link to Due back. [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:72) |
| 18 | “Put Camilla Malm on the waiting list for a Saturday morning cut.” | **No** | Fallback. The command path only recognizes the waiting list as part of cancellation. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:104) |
| 19 | “Remember Eva Nyberg prefers Anna.” | **Yes** | “Saved. I will keep that in mind.” Shows the saved note with Undo. Future booking proposals can prefer Anna when she can perform the service. [`engine.ts → rememberReply`](../../src/concept/assistant/engine.ts:53) · [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 20 | “Show me today’s brief.” | **Yes** | Up to six items. In the sample it shows a cancellation, booking count and first booking, inbox count, two low-stock items and a gap count. [`assistant/briefs.ts → morningBrief`](../../src/concept/assistant/briefs.ts:58) |
| 21 | “What have I earned today?” | **Yes** | SEK 795, date, visit count and a breakdown. The calculation uses finished visits and recorded retail sales. [`command/proposal.ts → revenueProposal`](../../src/concept/command/proposal.ts:297) · [`selectors.ts → revenueBetween`](../../src/concept/selectors.ts:115) |
| 22 | “How much unscented massage oil is left?” | **Yes** | One 1 L bottle, low-stock indicator, about five days remaining, and a Stock link. [`command/proposal.ts → stockLevelProposal`](../../src/concept/command/proposal.ts:255) |
| 23 | “Sold two home care foot creams to Eva Nyberg.” | **Yes** | Proposes recording two units for SEK 438 and shows stock going from nine to seven. [`command/proposal.ts → sellProposal`](../../src/concept/command/proposal.ts:275) |
| 24 | “Order more urea foot cream.” | **Yes** | Supplier proposal with 20 tubes, SEK 1,780, on-order count and an estimated three-day lead time. [`command/proposal.ts → stockProposal`](../../src/concept/command/proposal.ts:235) |
| 25 | “How busy is Erik next week?” | **Yes** | 82% of working hours booked, the date range and a per-day chart. [`command/insight.ts → busyWeek`](../../src/concept/command/insight.ts:82) |
| 26 | “Remember Eva Nyberg only wants mornings.” | **Partly** | Saves and can recall the note. Booking suggestions can still include afternoons because only practitioner preference affects booking. [`assistant/memory.ts → memoryFor`](../../src/concept/assistant/memory.ts:95) · [`command/proposal.ts → bookProposal`](../../src/concept/command/proposal.ts:102) |
| 27 | “How much is left on gift card EKO-1234?” | **No** | “I could not find ‘is’ in your stock.” The stock matcher consumes the balance question. [`intent/index.ts → interpretCommand`](../../src/concept/intent/index.ts:29) |
| 28 | “Close the salon on Friday.” | **Yes** | Whole-day closure proposal with 14 bookings flagged for moving. [`command/schedule-proposal.ts → closeSalonProposal`](../../src/concept/command/schedule-proposal.ts:43) |
| 29 | “Which customers haven’t been here since summer?” | **Yes** | 46 customers with no visit since 1 September and no future booking. Shows eight names, visit history and a follow-up offer. [`command/proposal.ts → inactiveProposal`](../../src/concept/command/proposal.ts:311) |
| 30 | “Send them a 15% welcome-back offer.” | **Partly** | After #29, drafts for all 46 at **10%**. Preview shows three names and one example text. [`engine.ts → offerReply`](../../src/concept/assistant/engine.ts:100) · [`assistant/outreach.ts → offerProposal`](../../src/concept/assistant/outreach.ts:17) |

Two more failures matter before broader rollout. “Who is coming on Friday?” returned Tuesday’s list. “Close the salon early tomorrow at 15:00” drafted an **all-day closure**. A revenue question about “yesterday” returned **the entire month**. These are plausible-looking wrong answers in routine workflows. [Schedule reply](../../src/concept/assistant/engine.ts:125) · [Closure parser](../../src/concept/intent/schedule.ts:29) · [Revenue date parsing](../../src/concept/intent/dates.ts:58)

## 2. Gimmick check

| Current feature | Decision |
|---|---|
| Booking, move and cancellation proposals | **Keep.** Useful from another screen or while handling a call. When the appointment is already open, its Move or Cancel button is faster. Keep before/after, approval and Undo. [Booking sheet](../../src/concept/studio/booking/booking-sheet.tsx:172) |
| Voice input and read-aloud | **Improve.** Put one mic in the panel, show it when supported, and let the owner correct names and times before submitting. Move read-aloud to preferences. Today it reads reply text, which can omit the useful details in the card. [Panel](../../src/concept/studio/assistant/assistant-panel.tsx:48) · [Speech](../../src/concept/command/use-speech.ts:48) |
| Briefs and routine suggestions on both Today and panel opening | **Improve.** Put urgent exceptions on Today with direct actions. The panel should open at the input. Keep closing and weekly reports available on request. Today already has schedule, next customer, needs-moving and evening summary. [Today](../../src/app/studio/page.tsx:50) · [Panel opening](../../src/concept/studio/assistant/assistant-panel.tsx:170) |
| Monday recalls and Friday restock | **Improve.** Keep recall drafts under Due back and reorder drafts under Stock. The current two templates prepare proposals while Studio is open. Remove the owner-facing `SKILL.md` view and the extra trip through chat to review a run. [Routine runner](../../src/concept/studio/assistant/assistant-launcher.tsx:65) · [Routines page](../../src/concept/studio/assistant/routines-page.tsx:57) |
| Memory, inferred facts and thread summaries | **Improve.** Keep explicit booking preferences where owners can see and edit them on the customer record. Remove unsolicited “remember this?” cards and automatic topic summaries. A preference earns its place when it affects the next booking. [Memory rules](../../src/concept/assistant/memory.ts:55) · [Thread summaries](../../src/concept/studio/assistant/use-assistant.ts:120) |
| Revenue, utilisation and stock answers | **Keep.** A specific number is useful from another screen. Inside Finance or Stock, use the page’s existing figures and controls. [Answer cards](../../src/concept/command/answer-card.tsx:20) |
| Poster and booking-page commands | **Remove from global Assistant.** “Make a poster” often opens a prefilled Campaigns flow. Page styling is occasional and easier to judge in the editor preview. Put those shortcuts in their editors. [Campaign handoff](../../src/concept/command/proposal.ts:191) · [Page design proposal](../../src/concept/command/page-proposal.ts:34) |
| Sparkles, “Rules · no AI” badges and automatic prose rewrites | **Remove.** Give the visual emphasis to a useful status such as “Needs approval” or “Simulated.” Optional model interpretation can still help with phrasing. [Panel chrome](../../src/concept/studio/assistant/assistant-panel.tsx:88) · [Model handling](../../src/concept/studio/assistant/use-assistant.ts:69) |

## 3. Ten improvements in priority order

| # | Improvement | Effort |
|---:|---|:---:|
| 1 | **Separate read questions from changes.** Parse explicit dates and time bounds before building a card. Ask what the owner means when a bound is unsupported. Add fixed-clock regression cases for Friday, yesterday, “close early” and price lookups. | M |
| 2 | **Add `find-availability`.** Answer with up to three actual starts for the service, duration, staff and room across the requested window. Show the next viable day when full. Offer **Book this time** on each choice. | M |
| 3 | **Add next-client, named appointment and last-visit lookups.** Lead with the time, service and practitioner. Link straight to the booking or customer. Ask which person only when multiple records match. | M |
| 4 | **Make rebooking a continuation.** Use the last completed visit, support “in six weeks” and “anything later?”, and keep the chosen customer, service and practitioner while the owner compares times. | M |
| 5 | **Add a late-running message.** Resolve the appointment, prefill the recipient and a short delay message, then show one editable preview with a send confirmation. Use the existing Inbox flow for replies. | M |
| 6 | **Turn staff absence into a recovery list.** After “Erik is sick,” show each affected booking with its best eligible replacement and a clear next action. Let the owner approve each move from the same list. | L |
| 7 | **Make gap filling and recalls specific.** Record waitlist service and time constraints, then filter eligible recipients by fit, contact permission and recent outreach. Show the full recipient list and exact offer before approval. A due-back query should name clients and suggest real openings. | L |
| 8 | **Add timed blocks and visit outcomes.** “Block lunch 13:00–14:00” should preview overlaps for the selected practitioner. “Mark Marie as a no-show” should identify the booking and offer one confirmation. | L |
| 9 | **Add direct service and balance answers.** Show price and duration from the catalog. Resolve a gift-card code to its balance and details. Show pending Inbox items with direct links instead of sending the owner to a generic menu. | M |
| 10 | **Send journal requests to the customer’s journal.** Resolve the client and open the existing dictation or entry form in one step. Keep treatment text in the journal workflow. The current chat persists recent messages in browser storage. | S |

## 4. Naming

**Use “Assistant.” Skip the persona name.** It is a recognizable tool label in both languages and leaves Cresavo as the product brand. The owner-facing control belongs in Studio. Public booking, gift cards and My bookings should use the tenant’s identity and task labels like **Book an appointment**. [White-label policy](../../docs/design/LIBOVO.md:118)

| Option | Judgment |
|---|---|
| **Ask** | Quiet and short. “Ask” alone could mean Help or search. Swedish *Fråga* has the same issue. |
| **Assistant** | Best fit. **Assistent** translates directly and the label can cover questions and actions. |
| **Ask Cresavo** | Understandable once the brand is familiar. It repeats the wordmark and makes the assistant feel more central to the product. |
| **Short persona name** | Adds a second identity owners have to learn. It also makes the feature feel like a chatbot before it has answered anything. |

| UI element | English | Swedish |
|---|---|---|
| Panel title | **Assistant** | **Assistent** |
| Open button | **Assistant** | **Assistent** |
| Input placeholder | **Who is coming today?** | **Vilka kommer idag?** |
| Submit button | **Send** | **Skicka** |
| Desktop shortcut hint | **⌘K** on Mac, **Ctrl+K** elsewhere | **⌘K** on Mac, **Ctrl+K** elsewhere |

## 5. Placement verdict

**Secondary, one tap away.** Keep the desktop header button and shortcut. On phones, use one quiet, labeled launcher above the tabs and put the mic inside. Give Today, Calendar and Inbox the primary actions. The assistant is worth opening when it can combine a lookup and a change in one request. For an appointment already on screen, the owner should be able to act directly. [Current entry points](../../src/concept/studio/assistant/assistant-launcher.tsx:17)
