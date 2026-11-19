# Cancellation and no-show protection

Settings → Booking rules lets the owner set a free cancellation window, two fee percentages and a deposit amount for each treatment. Zero disables a deposit. The owner can limit deposits to customers whose phone number is new to the salon, or exempt a treatment from all deposits and fees. The settings preview uses the selected treatment and the business currency.

Each save creates a policy version and an undoable activity entry. The booking stores its agreed version, effective rates, deposit, price and currency. Moving the visit recalculates the deadline from the new start and the agreed window. Existing visits use the original 24-hour window and zero fees. The deadline is inclusive and measured in elapsed hours in Europe/Stockholm.

## Booking and settlement

The white-label booking page shows the deadline and amounts before the customer commits. A deposit reserves the practitioner and room for ten minutes. The booking lock rechecks the offer before placing the hold and rechecks availability before accepting payment. The salon receives the confirmed booking and messages after payment. The same tab can resume checkout after a reload. Customers can cancel checkout, and abandoned holds expire. Checkout offers simulated card payments and simulated Swish for SEK. The demo collects no payment credentials.

The owner can record a late cancellation after the deadline and before the visit, or a no-show once the visit starts. The proposed fee is the booked price times the applicable percentage, rounded half up to a currency minor unit. A charge applies the deposit first, collects a shortfall and refunds any excess. Waiving requires a reason and refunds the full deposit. An ordinary cancellation, including one initiated by the salon, also refunds the deposit. A refunded cancellation stays in history. Booking another visit creates a fresh agreement. The booking records the decision, actor, timestamp and simulated transaction references. Finance displays deposits, net payments, refunds and remaining visit balances. These entries stay separate from the demo’s sales and VAT reports. A prepaid deposit reduces the amount a gift card can cover and takes precedence over a package visit.

## Before real payments

- Move quotes, immutable policy acceptance, expiring reservations and the payment ledger to the booking engine. Authenticate customers and authorize owner decisions per tenant. Enforce practitioner and room availability transactionally.
- Use a hosted provider checkout with verified, idempotent webhooks. Persist payment and refund identifiers, reconcile settlements, and handle asynchronous failures, chargebacks, exhausted holds and refunds after late payment. Establish a separate lawful authorization or payment request for additional fees.
- Review GDPR data minimisation, waiver reasons, retention and export/deletion. Review fee fairness and disclosure under konsumenttjänstlagen and marknadsföringslagen, and payment authorization and strong customer authentication under PSD2.
- Review kassaregisterlagen receipt handling and bokföring/moms treatment for deposits, retained fees, refunds and VAT. Test checkout accessibility (tillgänglighet), including timed holds, keyboard navigation and screen-reader announcements. Reassess the AI Act if automated fee recommendations or decisions are introduced.
