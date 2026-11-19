# ADR 005 — Pair an assistant with a fictional studio

Date: 2026-11-18

Status: Accepted for the flag-controlled preview.

## Context

A visitor wants to ask their assistant about an incoming request, choose a free
appointment and see the proposed move in their own Inbox. The same visitor
makes the final decision in Cresavo. The demo must also work without an AI
subscription, a provider key or an assistant connection.

The browser demo and the local concept MCP currently have separate copies of
Salong Eko. Sharing the local MCP's process-wide copy between public visitors
would expose other visitors' work. A hosted request can reach a different
process from the one which rendered the studio.

## Endpoint and authority

Serve the owner preview at https://demo.cresavo.com/mcp/owner over Streamable
HTTP with JSON responses. Use the installed MCP SDK for protocol negotiation,
discovery and tool calls. Keep the transport stateless between requests.

Use the canonical endpoint URL as the resource indicator and token audience.
Configure the canonical origin with PAIRING_ORIGIN. The pairing issuer is
that origin plus /oauth. Publish its document at
/.well-known/oauth-authorization-server/oauth and its resource document at
/.well-known/oauth-protected-resource/mcp/owner. The root documents serve the
engine. Match the request host against the configured authority using the
app's trusted proxy policy. Support HTTP on configured loopback origins.
[RFC 8414 issuer metadata](https://www.rfc-editor.org/rfc/rfc8414.html#section-3.1)

The customer gateway retains customer mandates and provider credentials.
The engine's local owner MCP retains its operator trust model.
The local concept fixture keeps its own bearer and process state.
None of these credentials authorizes access to a paired workspace.
A future production owner resource will have a separate issuer or audience.

## Starting a workspace

Start pairing is an explicit same-origin POST from Your data & AI.
Prepare a daily hair-salon template outside the creation transaction.
Project upcoming bookings and fictional names into it, discard journals,
notes, tags and generated threads, and supply two neutral Inbox fixtures. Store the fixture day, schema version, public workspace identifier and
initial revision. Give exposed booking and Inbox records workspace-specific IDs.
Seed a Friday reschedule request pointing at a booked fictional appointment.

Generate an opaque owner session with 256 bits of randomness. Send it only in
a host-only HttpOnly, Secure, SameSite=Lax cookie at path /. Lax allows a
top-level OAuth navigation from the assistant. Store only its digest.
The public workspace ID, copied URL and revision confer no authority.

The workspace expires after sixty minutes of inactivity. Activity may extend
the expiry up to twenty-four hours after creation. Check both deadlines
during every authenticated operation, including refresh and owner decisions.
Automatic polls check both deadlines without renewing them. Closing a tab leaves the workspace available in the same browser until expiry.

Disconnect deletes the workspace. Foreign keys cascade to its authorizations,
tokens and proposals. The browser discards the workspace cache. Other tabs
discover the loss of session on their next check. Reconnecting creates fresh data.

## Discovery, client identity and consent

Publish RFC 9728 protected-resource metadata and RFC 8414 authorization-server
metadata. Missing or invalid credentials receive a 401 Bearer challenge with
the protected-resource metadata URL. Advertise the three supported scopes.

Prefer client ID metadata documents (CIMD). Fetch an HTTPS document over the
public network with bounded time, bytes and ports. Pin the connection to a
validated public DNS answer, preserve TLS hostname verification, and reject
redirects, user information, fragments and private or reserved addresses.
Require exact equality between the document's client_id and its URL.
Ignore optional logos and other embedded URLs.

Offer public-client dynamic registration at POST /oauth/register. Use generated
opaque registration IDs. Display the supplied client name as unverified and
show the callback host. Registration alone grants no access to a workspace.
Compare registered callback strings exactly during authorization, allowing
only the port to vary for native HTTP callbacks on 127.0.0.1 or [::1].
Bind the code to the exact callback used for authorization. Never redirect an invalid request.
[RFC 8252 loopback redirects](https://www.rfc-editor.org/rfc/rfc8252.html#section-7.3)

GET /oauth/authorize validates response type, resource, scopes, redirect URI
and the S256 challenge. The live browser session identifies the visitor.
When the cookie is missing, link to the studio to start pairing and ask the
visitor to restart sign-in there. Cross-device pairing is deferred.

The consent heading identifies the callback host. Label the DCR name as
unverified and strip control and bidirectional formatting characters before
display. Explain the requested permissions.

- bookings:read reads fictional appointment details and compatible times.
- inbox:read reads the fictional request and its linked booking reference.
- bookings:propose submits a booking move and checks the decision.

Consent explains that results go to the connected assistant and that the
owner decides changes in Cresavo. The form has explicit Allow and Decline
buttons, frame protection and an origin-only referrer policy. Escape all client strings.
Bind a short-lived single-use consent handle to the reviewed request and
owner session. Require an exact Origin on the form POST.
Return OAuth state and the configured issuer in the authorization response.

## Authorization code and token handling

The installed MCP SDK handles transport. The existing OAuth lab is tied to
loopback and process memory. The project has no hosted authorization-server
dependency. Keep the preview provider limited to the code and refresh grant types, using Node
crypto, Zod and database transactions. Revisit the provider choice before
introducing production identity.

Use authorization code with PKCE S256 for public clients. Issue a random
single-use code valid for five minutes. Bind it to client, workspace,
redirect URI, granted scopes, challenge and resource. Consume it atomically.
Exclude implicit, password and client-credentials grants.

Issue opaque access tokens valid for ten minutes and rotating refresh tokens
bounded by workspace expiry. Store only digests. Exchange credentials in
form bodies over TLS. Authenticate MCP calls with the Authorization header.
Keep access tokens, refresh tokens and session credentials out of URLs,
logs, studio snapshots, browser storage and tool results.

Rotate refresh and access credentials in a transaction. Detect reuse of a
rotated refresh token and invalidate its family. Revoke a grant at
/oauth/revoke. Unknown tokens receive the same successful revocation response.
A repeated code with the original client, redirect and PKCE proof revokes
the grant it issued. Recheck workspace expiry and audience on every use.

## Grant identity and phase 2

Each token references a Grant. Its subject is the owner, its tenant is the
salon, and it records the client, scopes and resource. The demo uses the
workspace ID for its tenant and a workspace-scoped demo owner for its subject.
Phase-2 consent requires owner sign-in and authorization for the selected
salon. A tenant can have multiple grants, including two consents for the same
client. List each in the studio Connect card with independent revocation.
Disconnecting the workspace removes all its grants.

## State, commands and polling

Use PostgreSQL via Prisma. Introduce dedicated pairing tables for workspaces,
client registrations, pending consent/codes, token pairs, proposals and rate
buckets. Foreign keys point only to pairing tables. Existing booking-engine
data, migrations, API and admin session semantics stay independent.

The server snapshot is authoritative for the connected booking and Inbox
slice. The ordinary studio and public booking page retain the browser profile.
Show “Connected assistant · demo workspace” wherever paired records appear.
Support a direct owner move in the paired calendar using the same validation.

Return a bounded projection to the studio with a revision, expiry and pending
proposals. Cache only under a workspace-specific key. Authenticate before
displaying cached data. Poll while visible every 2.5 seconds, refresh on focus
and reconnect, and use an ETag containing workspace, revision and Stockholm day.
Back off exponentially on 429 and 503 responses and honor Retry-After. A matching
validator avoids transferring the snapshot. Recover with a full fetch.

## Proposals and contention

The OwnerWorkspace interface exposes booking and Inbox reads, slot lookup,
and proposal creation, status and decisions. Its first adapter uses the
PostgreSQL-backed fixture snapshot. A future salon adapter can enforce the same
contract over the booking engine. Only the owner surface calls decide.

The only draft operation is a same-staff reschedule. Read tools expose a
workday summary, Inbox and thread, booking details/search, available move
options and proposal status. Scope both discovery and execution.
Limit returned fields and result counts. Return machine-readable results,
read-only annotations and errors that tell the caller how to recover.

Use the existing concept slot functions and move proposal builder. Persist
the typed booking/move action, per-booking version precondition and rendered before/after
diff. A draft increments the revision and has status pending. Creating it
does not change the appointment. Persist an idempotency key scoped to
workspace and client. An identical retry returns its original result.
Reusing the key with different arguments produces a conflict.

Approve and Decline are same-origin POST commands authenticated with the owner
cookie. Bind decisions to the immutable proposal ID and displayed workspace.
Concurrent drafts and grant exchanges can advance the workspace revision.
Decisions check the target booking version and current slot. A move followed
by a move back still changes the booking version.
Lock the workspace row, check the expected appointment, revalidate the
requested slot and apply through the concept reducer. Commit snapshot,
revision and terminal status together. Return applied only after commit.
Decline leaves the booking untouched. Terminal decisions are idempotent.
A stale booking or occupied slot requires a fresh proposal.

## Untrusted text and abuse budgets

The following invariants apply to every adapter and future owner surface.

- Assistants supply only IDs and enumerated choices for Inbox changes. They
  can select validated slot coordinates. They cannot insert free text into the Inbox.
- Tag every customer-authored field as untrusted, including names, thread
  text and derived display text such as a proposal title or service label.
- No scope can approve a proposal.
- Approval belongs to any first-party authenticated owner surface. The preview
  implements approval in the studio Inbox.

Server instructions tell the assistant to treat them as quoted material and
to use the owner's directions when considering a tool. Include a fictional
message asking the assistant to disregard instructions as a regression fixture.
Keep credentials, owner commands, outbound adapters and arbitrary URLs out
of the tool vocabulary. Treat client names as unverified display text.

Use a trusted source address, with a shared fallback bucket if unavailable.
Hash the address for short-term accounting. Bound workspace creation per IP,
global active workspaces, request bursts, registration and proposal counts.
Allow six live workspaces per IP, twelve starts per IP per hour and 2,000 live
workspaces overall. Check live deadlines under the creation lock. Bound the
public bucket at 180 requests per IP and 30,000 overall per minute. Charge
authenticated polling and MCP traffic separately at 180 and 100 requests per
workspace per minute respectively. Cap consent at 20 per workspace per minute.
Reuse a live registration for the same name and redirect set. Bound new
registrations at 600 per IP per hour and 20,000 overall per day. Charge token
issuance at 60 per grant per minute and refresh rotation at 360 per grant per
day. Store up to 50 changes per workspace, including manual moves.
Bound inbound bodies before parsing. Serialize quota checks across instances.
Return HTTP 429 for exhausted HTTP budgets and an actionable tool error for
the workspace proposal cap. Retain idempotency records until workspace deletion.

Run daily cleanup through the CRON_SECRET-protected sweep route on Vercel.
Self-hosted installations can schedule the cleanup script. Enforce access
expiry on read and exclude expired workspaces from live quotas between sweeps.

## Release and verification

ASSISTANT_PAIRING=1 enables the studio card and narrowly enumerated handlers.
Default installations require no pairing database connection. PUBLIC_READONLY
continues to protect all existing engine and concept routes.

Unit coverage checks PKCE, redirect exactness, fetch policy and fixture rules.
Exercise one-time exchange, rotation, replay, revocation, limits, expiration,
duplicate drafts, stale decisions and two independent sessions in PostgreSQL.
Use the MCP SDK client against the local HTTP server, including discovery,
all eight tools, studio approval, ETag changes and final booking details.
Exercise the card, consent, live proposal and decision in a real browser.
Record the three preview screens using fictional data only.

Claude web is the first manual compatibility gate. Repeat in an eligible
ChatGPT account and later Grok. Record vendor and account results separately
from the local SDK and browser proof.

## Deferred

Real tenants, admin sign-in, engine writes, finance, journals, messages,
provider integrations, voice, autonomous policies, remote approval, directory
listings, cross-device challenges and production identity are later decisions.
The preview requests no assistant API key and sends no outgoing notifications.

## Demo catalogue extension

The expanded fictional preview uses area-specific read and propose scopes.
The snapshot adapter now includes a minimised projection of hair-salon visit
history and aggregate finance figures. Every record reference is resolved in
the granted workspace. The studio continues to own every approval.

Booking creation, cancellation, time blocks, treatment prices and visibility,
and simulated Inbox replies follow the same decision transaction as a move.
Approval checks versions for the affected records plus current booking rules.
A booking or block also checks changes to its staff interval since drafting.
The price shown for a new booking is bound to the treatment version.

A short reply draft is the only free-form write input. The studio attributes
it to the assistant and shows the exact text before approval. Approval records
a simulated reply on the fictional thread. A new booking accepts an existing
customer ID or an enumerated fictional name. Customer names, thread text and
derived display strings are quoted as untrusted. The connected assistant has
no approval tool, outbound messaging or access to journal entries.
