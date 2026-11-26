# Phone receptionist ("Maja")

An AI receptionist that answers for the sample salon: it reads the salon's own
data, offers free times, and books, moves and cancels through the studio's
booking rules. Off unless the deployment sets `PHONE_RECEPTIONIST_ENABLED=1`,
and only the sample salon (`demo` workspace) shows it. No phone number is
connected: the only way in today is "Try in the browser".

## Parts

| File | What it does |
| --- | --- |
| `types.ts`, `actions.ts` | Settings and call log in the salon document (`receptionist`, `receptionistCalls`), changed through `receptionist/settings` and `receptionist/call`. |
| `host.ts` | The receptionist's view of a salon: read and commit through `StudioStore`. |
| `tools.ts` | The eight tools and the rules they enforce (read-back before a change, proof of identity before moving or cancelling, hand-over when a change would cost the customer). |
| `instructions.ts` | What she is told: stay with the salon, decline other topics kindly, confirm before booking, hand over when unsure. |
| `call-session.ts` | One call: runs tool calls from Realtime server events, keeps the transcript, counts time and estimated cost against the ceiling, says when to hang up. |
| `limits.ts` | The ceiling per call (5 minutes, USD 0.50 by default) and the cost estimate. |
| `realtime-config.ts` | The Realtime session (model, voice, tools). Built on the server. |
| `server/` | The deployment switch, the key lookup and the exchange of the API key for a one-minute client secret. |
| `transport.ts`, `elks46.ts` | The seam for whatever carries the audio, and a stub for 46elks Realtime Voice. |

Bookings a call makes are ordinary `booking/create` actions with source
`phone`; nothing in this folder holds a booking rule of its own.

## Public web call ("Ring Salong Eko")

`/studio/ring` on the demo has one button that calls Maja from the browser
(`web-call/`). Unlike the studio's test call, the browser never gets a
credential: it sends its WebRTC offer to `POST /api/concept/receptionist/web-call`,
and the server creates the call with OpenAI (`POST /v1/realtime/calls`, the
"unified interface") using the API key. OpenAI answers with the call's id, so
the server can end the call itself (`POST /v1/realtime/calls/{id}/hangup`).

| File | What it does |
| --- | --- |
| `web-call/config.ts` | The kill switch (`PHONE_RECEPTIONIST_WEB_CALL=1`), the model (`gpt-realtime-2.1`, or `PHONE_RECEPTIONIST_WEB_MODEL`), the 4-minute ceiling and the quotas. |
| `web-call/page-token.ts` | The signed page token (20 minutes) the page is rendered with; the route refuses requests without one. It also names the page session for the per-session limit. |
| `web-call/ledger.ts` | Counters and running calls in the pairing database's `PairBudget` table (keys `voice:*`, hashed, no addresses). Process memory only outside production. |
| `web-call/server.ts` | Limits, call creation, the server's watch of each call (deadline, cost, tampering, kill switch; scheduled with `after()`), retry of failed hang-ups, and the sweep of overdue calls on every request. |
| `web-call/persona.ts` | Maja's web-call voice: soft AI disclosure, calm pace, honest suggestions, owner call-back, strict salon-only role. |
| `web-call/browser.ts` | The browser side: microphone, WebRTC, iPhone audio unlock, and the end report. |

Limits, all on the server: 3 calls in any rolling hour per address, 3 per page
session, 30 a day in all (`PHONE_RECEPTIONIST_WEB_DAILY`), 4 minutes per call.
The request that started a call keeps its own connection to it (OpenAI's
sideband, with the key) and hangs it up at the deadline, when OpenAI's usage
reports reach the cost ceiling (`PHONE_RECEPTIONIST_MAX_COST_USD`), when the
client changes the session's rules, tools or voice, or when that connection
fails. If that instance is gone, the next web-call request on any instance
sweeps overdue calls. Only the page that started a call can end it early.

Kill switch: set `PHONE_RECEPTIONIST_WEB_CALL` to anything but `1` (or remove
it) and redeploy. The button closes, the start route answers 404, and the first
request to `/studio/ring` or the start route hangs up every call still running.
A call the old deployment is still watching ends within 4 minutes regardless.

## Keys and limits

- `OPENAI_API_KEY` (or the sample salon's saved OpenAI key) stays on the
  server. `POST /api/concept/receptionist/session` answers with a client
  secret that can start one session during the next minute.
- The route is same-origin only, refused in `PUBLIC_READONLY`, limited to 3
  calls a minute per visitor and 40 a day per deployment.
- The call session ends a call at the time or cost ceiling. In a browser test
  the browser holds the connection, so the ceiling is enforced there; the
  server's own guard is the daily ration. A phone transport runs the session on
  the server, where the ceiling is enforced by the party that pays.
- The studio's Content-Security-Policy and Permissions-Policy allow the
  microphone and `https://api.openai.com` only while the switch is on
  (`src/proxy.ts`).

## Before a real number is connected

1. **A server that can hold a call.** 46elks opens one WebSocket per call and
   the Realtime bridge is another; both need a long-running process, not a
   serverless function.
2. **The salon on the server.** A phone call has no browser, so the salon must
   live in `PostgresStudioStore` (owner accounts) and the number must map to
   one tenant. `studioStoreHost` already takes any `StudioStore`.
3. **Finish `elks46.ts`** (or SIP): accept the socket, check it comes from
   46elks' addresses, bridge audio both ways, handle `interrupt` when the
   caller talks over her, send `bye` on hang-up. Then buy and point a number.
4. **Server-side ceiling and spend.** Enforce the call ceiling where the
   socket is held, add a per-salon monthly budget, and replace the token-price
   estimate with the provider's reported usage. Transcription is not counted
   in the estimate today.
5. **Who is calling.** Use the caller's number from the phone network instead
   of asking for it, and decide what a withheld number may do.
6. **Opening-hour rules in use.** `answerWhen` is saved and shown but nothing
   routes calls yet; the transport must check it before answering.
7. **Personal data.** A transcript holds names and numbers. Needed before real
   callers: telling the caller the call is transcribed by an AI, a retention
   period for calls, calls in the customer's data export, OpenAI listed as a
   subprocessor with its data-retention setting decided, and the DPIA updated.
8. **Confirmation to the caller.** No text or e-mail is sent from a call, and
   the receptionist says so. Decide whether a phone booking sends one.
9. **Quality.** A set of recorded test calls in Swedish and English (off-topic
   questions, noisy line, interruptions, names and numbers read back) run
   against each model change, and a look at the full model if the mini model
   mishears names or digits.
10. **Emergencies and abuse.** A fixed reply for callers in distress, and
    blocking of repeat nuisance numbers.
