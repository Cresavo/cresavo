# Cresavo architecture decision record

Date **2026-11-19** · Status **Accepted**

The decisions below describe the target architecture and delivery order.
The [API platform plan](API_PLATFORM.md) tracks current interface coverage.

## 1. Use the studio as the product and migrate the booking engine

**Context.** The browser demo has the studio workflows. The database engine
has durable booking rules and security controls.

**Decision.** Put each salon's state in a Postgres `tenant_state` JSONB document
behind `StudioStore`, with row locking and version checks. Use an append-only
`tenant_action` log for audit, undo, webhook delivery and replay. Keep Prisma
migrations, admin users and sessions, Argon2, Postgres rate limiting, OAuth,
keys, mandates, proposals, agent audit, idempotency and security tests.

**Consequences.** Define the store and its invariant suite, stage the Postgres
adapter, add login and tenant isolation, then put `studioBookingProvider`
behind agent API v1 and MCP. Move the demo tenant and verify one green week
before retiring the legacy admin UI, its routes and end-to-end tests.

**Where booking rules live (confirmed 2026-11-21).** The studio reducer
(`src/concept/actions.ts`) and availability code (`src/concept/data/slots.ts`)
are the only place for booking rules. New rules, such as buffers, processing
time or class capacity, are built there and nowhere else. The Prisma engine in
`src/lib/domain.ts` is the legacy engine. It gets security and correctness
fixes until it is retired, but no new booking rules.

**Migration path.**

1. Owner login and tenant isolation on `PostgresStudioStore` (roadmap stage 1).
2. The studio and the public booking page read and write the store
   (roadmap stage 2).
3. `studioBookingProvider` implements the existing `BookingProvider` contract
   (`src/lib/agent-api/provider/types.ts`) over `StudioStore`: services and
   staff from the tenant document, availability from `slots.ts`, bookings
   through `apply` with the caller's idempotency key. `/api/v1` and the owner
   MCP choose the tenant from the caller's credential instead of
   `DEMO_BUSINESS_ID`.
4. The gateway keeps calling `/api/v1` at `SALON_ORIGIN`, so it needs no change
   while the provider contract holds.

**Gate before the legacy engine is removed.** All of these hold:

- The store contract suite passes against Postgres, including the invariants
  `STUDIO_STORE.md` lists as not yet covered: cancel by token, customer data
  export and per-resource limits.
- The gateway's provider conformance check and agent scenarios pass against
  `studioBookingProvider`.
- The legacy engine's security tests (rate limits, OAuth, keys, mandates,
  proposals, agent audit) run against the new provider and pass.
- The demo tenant has run on the new provider for one week without failures.

Then the legacy admin UI, routes and their tests are removed, and its tables
are dropped in a new migration. Historical migrations stay unchanged.

## 2. Isolate sandbox bookings by session

**Context.** Owners need to try bookings from self-built sites using fictional data.

**Decision.** Return a simulated confirmation and show the booking in the
creator's studio through a `sandbox_session` token. Keep bookings server-side
for 24 hours. Enforce a 20-booking cap per session and per-IP limits.

**Consequences.** The studio polls while visible and labels each booking
"Test booking from your website". Each session has its own data.

## 3. Separate public booking access from private owner access

**Context.** A generated site needs public booking data. An owner dashboard
needs explicitly authorized business data.

**Decision.** Use publishable site keys and allowed origins for public access
and separate OAuth scopes for owner reads and writes. Favor owner-reviewed
proposals, and require audit and idempotency for direct writes. Reserve
personal access tokens for self-hosters. Keep sensitive data outside the API.

**Consequences.** Provide visibility and revocation in Connected tools. Apply
the access rules, defaults, rate limits, abuse controls and audit requirements
in the [API security model](API_PLATFORM.md#security-model-for-v1).

## 4. Record consent when access or risk changes

**Lawyer review required, not legal advice.**

**Context.** Account terms and optional, higher-risk capabilities require
separate consent records and legal review.

**Decision.** Version the B2B terms and data processing agreement. Use a
`ConsentSheet` for the specific actions in the
[consent plan](API_PLATFORM.md#consent-and-liability). Store the text version
and hash in `consent_record`, with revocation in Settings → Access and approvals.

**Consequences.** Counsel reviews the proposed terms, liability limits and
statutory obligations before customer use.

## 5. Build a compact studio design system

**Context.** Studio screens need consistent UI and interaction patterns.

**Decision.** Build owned components in `src/concept/ui` with CSS variables and
Tailwind. Prefer native controls and use Radix where native controls are
insufficient. Add motion, elevation, type and z-index tokens while preserving
the brand kit. Cover buttons, fields, selection controls, cards, notices,
dialogs and sheets, undo toasts, loading and empty states, navigation, list
rows, page headers, sticky actions, stats and charts.

**Consequences.** Use CSS and View Transitions for sheets and page changes.
Use 120/200/280 ms ease-out timing with `cubic-bezier(.2,.8,.2,1)`, animate
transform and opacity, and honor reduced motion. Keep budgets at 2 KB per
component, 5 KB per feature, INP under 200 ms and CLS under 0.05. New
dependencies require an ADR. Target WCAG 2.2 AA, 44 px targets, 4.5:1 and 3:1
contrast as applicable, visible focus, cues beyond color, 200% zoom and
320 px layouts.

Document the system in `docs/design/DESIGN_SYSTEM.md` and a dev-only
`/studio/_gallery` with axe and screenshot coverage. Lint disallows raw
buttons, dialogs and inputs outside the kit, hex colors and arbitrary Tailwind
values. Test tokens, accessibility and one primary action per screen.
Use the UI checklist on UI pull requests.

## 6. Sequence the work around the pilot store

**Context.** Owner API work depends on a persistent, isolated salon store.

**Decision.** In week one, simplify the studio, start the design-system
foundation and deliver the API parity rule and test. Track public booking
OpenAPI as a separate phase-zero follow-up. In week two, complete the next
simplification and component adoption rounds, split Settings and salon
details, define the store contract and finish the waitlist with it off by
default. In week three, stage the Postgres store, auth and tenant isolation,
then implement the public API, sandbox and consent records.

**Consequences.** Retire the legacy engine only after the migration gate in
decision 1. Assign auth, tenancy, concurrency, rate limits, consent and the
store contract to a stronger model with second-model review. Use a lighter
model for mechanical work.
