# Friendly errors

Every error, failure and missing-setup message in Cresavo is written for a beginner. The owner should understand
what is wrong and what to do next, and never feel startled or blamed.

## Style rules

1. **What happened**, in plain words, first. "The payment could not be recorded." Not "Error" or "Failed".
2. **Why**, when it helps and is known. "The time may just have been taken." Leave it out rather than guess.
3. **One clear next step.** "Check the visit and try again." "Choose another time." If there is a place to fix it,
   add **Show me** with that place's help-map id (`src/concept/help/map/entries.ts`).
4. **No error codes, status numbers or stack text** on screen. Log them with `logForSupport(code, error)` from
   `src/concept/ui/friendly-copy.ts`. The support reference that `ActionFailure` shows is the one exception: it
   is a number to quote to support, not an explanation, and sits after the friendly text.
5. **No exclamation marks** and no "Oops", "Sorry!" or "Something went wrong" on its own.
6. **No blame.** "The email or password does not match", not "Wrong password". "That file could not be read",
   not "You uploaded an invalid file".
7. **No red for what can be fixed.** Use `FriendlyNotice` (neutral surface) or `Notice tone="warning"`. Keep
   `tone="danger"` and red text for something lost or irreversible, and for a field's own inline error.
8. **Say what did not change** when the owner may worry: "Nothing was changed."
9. **Both languages** in the same change, saying the same thing. Swedish is written as Swedish, not translated
   word for word.

`tests/concept-friendly-errors.test.ts` fails when an error message in either dictionary has an exclamation mark
or something that looks like an error code.

## Building a message

```ts
import { friendlyMessage, FriendlyNotice } from "@/concept/ui/friendly-message";

const message = friendlyMessage({
  what: "setupGaps.hours.what",   // The salon has no opening hours.
  why: "setupGaps.hours.why",     // Without them there are no free times to book.
  next: "setupGaps.hours.next",   // Choose the days and times you are open.
  showMe: "hours.weekly",         // Show me points at the opening hours.
});
<FriendlyNotice message={message} onShowMe={closeSheet} />;
```

`friendlyText(message)` gives one line for a toast or an announcement. The pure builder is in
`src/concept/ui/friendly-copy.ts`, so the onboarding wizard and server-rendered code can use it too.

## Examples

| Before | After (en) | After (sv) |
| --- | --- | --- |
| Something went wrong. Try again. | That did not work this time. Check your connection and try again. | Det fungerade inte den här gången. Kontrollera anslutningen och försök igen. |
| Wrong email or password. | The email or password does not match. Check both and try again. | E-postadressen eller lösenordet stämmer inte. Kontrollera båda och försök igen. |
| Could not restore: the time is taken | This booking cannot come back: its time is booked now. Book the customer at another time. | Bokningen kan inte återställas eftersom tiden är bokad nu. Boka kunden på en annan tid. |
| Could not make the PNG | The poster image could not be made. Try again in a moment. | Affischbilden kunde inte skapas. Försök igen om en stund. |
| Help is not available right now. You can still create a ticket. | The help articles did not load. The connection may have dropped for a moment. Try again, or use Show me above to find the place in the studio. | Hjälpartiklarna laddades inte. Anslutningen kan ha försvunnit en stund. Försök igen, eller använd Visa mig ovanför för att hitta stället i studion. |

## Rewritten in this pass

`account.error.generic`, `account.error.invalid_credentials`, `account.error.wrong_password`,
`bookingView.failed`, `data.resetFailed`, `data.unavailable`, `campaigns.poster.failed`, `campaigns.copyFailed`,
`trash.cannotRestore`, `log.cannotUndo`, `log.undoTimeTaken`, `import.readFailed` and `help.failed` (now with a
why, a next step and Try again). `ActionFailure`, the treatment form's limits, the gift card balance check and the
review form no longer use the red danger tone for a failure that can be tried again.

## Still to do

Clear but smaller wins, left for a later pass:

- **No next step or vague "Please try again":** `setup.switchFailed`, `ai.key.failed`, `customerReview.failed`,
  `language.updated`, `journal.structureFailed` (say that the text is kept), `register.refundFailed`,
  `register.phoneFailed`, `journal.audio.saveFailed`, `gallery.failed`, `customer.edit.failed` (unused).
- **Technical words:** `ai.keyStorageUnavailable` names a server variable and `data.setup.chatgpt.limit` mentions
  OAuth and a token. Both are on the developer page under Advanced, where that is allowed, but a plain first
  sentence would still help.
- **`import.summary`** says "{errors} errors"; "rows to fix" reads kinder.
- **Server and assistant errors:** the API and the owner's assistant connection return "Something went wrong. Try
  again." (`src/lib/errors.ts`, asserted in `tests/security.test.ts` and the MCP integration tests). Changing them
  touches `/api/v1` and the MCP, which needs its own assignment.
- **Inline red text:** about twenty form messages use `text-danger` directly instead of `Field`'s `error`
  (for example the import page's file error). They are inline validation, which may stay red, but should move
  to the shared field error so the wording and colour stay consistent.
- **Booking page errors** (`booking.failed`, `booking.unavailable`, `pay.failed`) are clear but say "Please";
  keep the tone of the salon's page in mind when rewording.
