# Customer booking, from the treatment list to the next visit

## Walkthrough

The audit used the Salong Eko fixture at 10:00 on Tuesday 17 November 2026, Europe/Stockholm. Chromium ran at 390 × 900 and 1280 × 900 against the Next development server on port 3730. Both widths offered the same actions. These are observed paths through the demo. They measure interaction cost, not how readily a first-time visitor notices a control.

A tap is an intentional action, including submitting a search with Enter. Scrolling, focusing fields and typing are excluded. Fields count required entries typed. Screens count distinct task views, including the starting view, dialogs and results. Selecting a time inside an already open move dialog leaves it on the same screen. Opening an incoming confirmation or gift link precedes the count. The first-booking total includes choosing the treatment. The repeat visit starts from an active confirmation, with the previous contact available on the same device.

| Journey | Observed actions and friction | Baseline taps / fields / screens | Target taps / fields / screens |
| --- | --- | --- | --- |
| First booking | Book beside the treatment → select the earliest time on the default day → name and mobile → confirm. The next available appointment takes a separate screen to select. The rule near Confirm appears only after both fields validate, including for visits already inside the cutoff. | 3 / 2 / 4 | 2 / 2 / 3. Show the next available visit, its staff member, price and applicable rule with the contact form. Keep other dates one action away. |
| Same as last time | Back to the salon → locate and book the same treatment → pick time → confirm. Past visits have a repeat link, but an active confirmation has none. Contact is automatically remembered. | 4 / 0 / 5 | 2 / 0 / 3 with prior consent. Book again → confirm a new time for the same treatment and practitioner. Two fields when contact is unavailable. |
| Move | Open the booking detail URL → Reschedule → time → Move to that time. The message preview prints the URL. A second button confirms a choice already made. | 3 / 0 / 3 | 2 / 0 / 3. Follow one actionable manage link, open Reschedule, then choose an explicitly labelled move action. Show the day and practitioner before committing. Choosing a different day adds one tap. |
| Cancel | Open booking → Cancel booking → Yes, cancel it. The dialog identifies the visit and offers a way to keep it. | 2 / 0 / 3 | 2 / 0 / 3. Keep the deliberate final confirmation. Show the salon contact when the online window has closed. |
| Waiting list | Submit a request for a fully booked day → Notify me about that day → name and mobile → Put me on the list. Feedback names the destination number. The form also saves the guest for subsequent visits without asking. | 3 / 3 / 4 | 3 / 3 / 4 including the search field. Keep the requested day and the success message. Make remembering the contact optional. |
| My bookings | Salon header → My bookings → mobile → Show my bookings. Works without an account. On a previously used device, automatic recall can open the last person's bookings immediately. | 2 / 1 / 3 on an unremembered device | 2 / 1 / 3. Keep the phone route and offer the 1-tap, zero-field route only after opt-in. |
| Gift card balance | Open a shared card → Book a treatment to return to the salon → scroll to and expand Gift card balance → retype the code → Check balance. The shared card already contains the code. | 3 / 1 / 4 | 0 / 0 / 1. Show the balance from the salon's card record on the shared card. Preserve manual lookup for printed cards. |

## Design decisions

1. **High impact, low effort.** Put Book again on the appointment itself and make the simulated confirmation link usable. Reuse the same detail URL for confirmation, messages, the widget and My bookings. Keep the phone lookup as a separate entry.
2. **High impact, moderate effort.** Offer the earliest actual appointment beside the confirmation fields. Hold the displayed choice still while someone types. On conflict, keep their input and return them to current availability. Pass treatment and practitioner on repeat links. Surface the cancellation deadline or closed window before Confirm.
3. **High impact, moderate effort.** Reduce moving to two deliberate actions on the default day. Label the final button with its effect, keep the original appointment until the replacement succeeds, and recheck the latest state under the same lock used by first bookings.
4. **High impact on shared devices, low effort.** Use an unchecked, optional device-memory control in booking and waiting-list forms. Ignore prior contacts saved without consent. A customer can opt out on a later visit.
5. **Medium impact, low effort.** Provide a calendar file and a Google Calendar event draft alongside the appointment. Use the salon time zone, duration and location. Do not include the customer's phone or management credential in the event.
6. **Medium impact, low effort.** Resolve a shared gift code against the local card ledger and display the remaining balance. A missing local card needs an explicit unavailable state.
7. **Later.** Evaluate signed wallet passes for gift cards and cross-device management after the booking engine is connected. Pilot work needs a verified recovery channel and revocable booking-scoped links. Phone lookup and browser fixture IDs are suitable only for this fictional demo.

## Research behind the choices

Baymard's checkout testing attributes more perceived effort to fields than to the number of pages. For a salon, the practical inference is to retain one name field, use the telephone keyboard and avoid adding account, email or payment fields. Offer a visible choice before saving a contact on a shared device. [Baymard checkout field research](https://baymard.com/research-articles/checkout-flow-average-form-fields)

Google Calendar builds bookable times from availability, lead time and buffers. The salon flow uses that pattern to offer a specific next appointment and lets the customer choose another before committing. [Google appointment availability](https://support.google.com/calendar/answer/11423292?hl=en)

Google's appointment guidance places cancellation in the confirmation and asks for a deliberate final action. An appointment-specific link lets someone act without first searching their whole booking history. [Google Calendar appointment cancellation](https://support.google.com/calendar/answer/10737245?hl=en)

Apple Calendar imports individual ICS events. Google documents a pre-filled event link as a user-controlled way to add a one-off copy. Offer both after booking. A saved copy can need editing after a move or cancellation. [Apple Calendar import](https://support.apple.com/guide/calendar/icl1023/mac) · [Google Calendar event links](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events)

Apple requires signed passes, and Google's save flow issues a signed pass from a wallet issuer. A gift card with an authoritative balance is useful before introducing either integration. Reserve provider badges for actual wallet passes. [Apple Wallet distribution](https://developer.apple.com/wallet/get-started/) · [Google Wallet issuance](https://developers.google.com/wallet/tickets/events/overview/add-to-google-wallet-flow)

## Evidence

The linked screenshots below are a curated set; the full capture set (about 100 viewport images) is kept outside the repository. Filenames follow `customer-{before|after}-{390|1280}-{journey}-{step}.jpg` with journey names `first`, `again`, `move`, `cancel`, `waitlist`, `lookup` and `gift`. The waiting-list fixture fills the requested Tuesday and the gift fixture includes a sold card. The move and cancellation start from separate upcoming visits outside the cutoff.

## Results after implementation

Both widths reached the targets above. From the treatment list, choosing **Book** now opens a reviewable appointment with its actual time, practitioner, price and cancellation rule. Accepting it takes one further tap. For a different slot, open **Choose another time**, select a time under its date, then confirm. The native chooser keeps the contact fields intact. The widget also keeps repeat bookings inside the embedded flow.

| Journey | Before → after taps | Before → after typed fields | Before → after screens | 390 px comparison | 1280 px comparison |
| --- | --- | --- | --- | --- | --- |
| First booking | 3 → 2 | 2 → 2 | 4 → 3 | [Before](cresavo/screens/customer-before-390-first-03-details.jpg) → [After](cresavo/screens/customer-after-390-first-03-details.jpg) | [Before](cresavo/screens/customer-before-1280-first-03-details.jpg) → [After](cresavo/screens/customer-after-1280-first-03-details.jpg) |
| Book again | 4 → 2 | 0 → 0 | 5 → 3 | [Before](cresavo/screens/customer-before-390-again-02-treatment.jpg) → [After](cresavo/screens/customer-after-390-again-04-details.jpg) | [Before](cresavo/screens/customer-before-1280-again-02-treatment.jpg) → [After](cresavo/screens/customer-after-1280-again-04-details.jpg) |
| Move | 3 → 2 | 0 → 0 | 3 → 3 | [Before](cresavo/screens/customer-before-390-move-03-selection.jpg) → [After](cresavo/screens/customer-after-390-move-02-times.jpg) | [Before](cresavo/screens/customer-before-1280-move-03-selection.jpg) → [After](cresavo/screens/customer-after-1280-move-02-times.jpg) |
| Cancel | 2 → 2 | 0 → 0 | 3 → 3 | [Before](cresavo/screens/customer-before-390-cancel-02-check.jpg) → [After](cresavo/screens/customer-after-390-cancel-02-check.jpg) | [Before](cresavo/screens/customer-before-1280-cancel-02-check.jpg) → [After](cresavo/screens/customer-after-1280-cancel-02-check.jpg) |
| Waiting list | 3 → 3 | 3 → 3 | 4 → 4 | [Before](cresavo/screens/customer-before-390-waitlist-03-details.jpg) → [After](cresavo/screens/customer-after-390-waitlist-03-details.jpg) | [Before](cresavo/screens/customer-before-1280-waitlist-03-details.jpg) → [After](cresavo/screens/customer-after-1280-waitlist-03-details.jpg) |
| My bookings | 2 → 2 | 1 → 1 | 3 → 3 | [Before](cresavo/screens/customer-before-390-lookup-02-phone.jpg) → [After](cresavo/screens/customer-after-390-lookup-02-phone.jpg) | [Before](cresavo/screens/customer-before-1280-lookup-02-phone.jpg) → [After](cresavo/screens/customer-after-1280-lookup-02-phone.jpg) |
| Shared gift card balance | 3 → 0 | 1 → 0 | 4 → 1 | [Before](cresavo/screens/customer-before-390-gift-03-code.jpg) → [After](cresavo/screens/customer-after-390-gift-04-balance.jpg) | [Before](cresavo/screens/customer-before-1280-gift-03-code.jpg) → [After](cresavo/screens/customer-after-1280-gift-04-balance.jpg) |

Opting in adds one optional tap. The repeat walkthrough uses an earlier opted-in booking. Declining still allows a repeat in two taps with two contact fields. On the shared card the face value and remaining balance can appear together, so the card and balance captures show one screen. The manual balance lookup remains available for someone holding a printed card.

The [message preview](cresavo/screens/customer-after-390-move-00-link.jpg) links directly to the appointment. The confirmation offers an ICS file and a pre-filled Google event as separate actions. Both use the appointment's start and duration in the salon's time zone. The booking detail link continues to reflect changes made in the demo. Each downloaded or saved calendar event is a one-off copy. The [recorded mobile move](cresavo/screens/customer-move.gif) shows the two decisions and the resulting appointment.

Automated WCAG A/AA checks of the booking form, confirmation, move dialog, cancel dialog, phone lookup and bookings list returned zero violations at both widths. The contact form retains input when changing slots, uses native controls and works with keyboard submission. Slot selection and contact entry run locally. A real-device latency and assistive-technology study is still outstanding.

Two tabs raced to confirm the same visit in ten repeated browser checks, five per width. The test delayed visibility of the other tab’s write. Each time, one customer received confirmation and the other saw fresh times. The demo uses a browser lock and a saved sequence number for this check. Browsers that block shared storage retain the local availability recheck.

Before a pilot, test the wording and the mobile time chooser with salon customers on their own phones, including VoiceOver and TalkBack users. Cross-device access, verified recovery, live notifications and issued wallet passes still require the production work listed above.
