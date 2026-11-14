# Premium agent-ready demo — approved scope, 2026-11-14

Active work: `design/international-agent-ready`, isolated worktree from
`46b261ac3884d26fb1b512b3e0680713e7e96460`. Previous product/QA/deploy is
`9840309df4d8addc3e4bf5f6c5da0f3802eb4a2d`; those results do not certify this change.

## Outcome

Implement the selected dark photographic Relay design, English first, with
Swedish preserved. Hero: “Your next booking. Just ask.” Supporting line:
“Agent-ready booking. Built around your business.” The salon is the concrete
demo, not a claim that every industry is supported. Keep the existing stack.

The same level of visual care applies to customer booking, calendar, booking
detail/create/move/cancel, customer search/card/history, staff, services,
schedules and owner overview/campaign drafts. No new business modules.

## Acceptance and evidence

1. Product page communicates purpose, agent distinction and an honest demo
   entry, with a restrained photographic hero and one primary action.
2. Illustrated assistant animation is labelled, keyboard usable, replayable
   and respects reduced motion. It never claims to execute MCP calls.
3. Customer journey is usable in English without typing dates. Swedish remains
   available. Localized presentation preserves API errors and business rules.
4. Calendar and customer routes preserve filters, date, search and return
   context. Existing create/move/cancel/contact-data safeguards still work.
5. Existing staff/service/schedule/overview features use a coherent visual
   system. No fake KPI, inactive AI action or unsupported client-support claim.
6. Synthetic ordinary/full/quiet days and cancellation-to-capacity scenarios
   use existing domain rules; additive seed, no reset of existing shared data.
7. Actual captures and clicks at 320/390/desktop, keyboard and empty/error/success
   states. Physical iPhone remains NOT RUN unless actually tested.
8. Lint, typecheck, build, unit/integration/card tests and four web modes on
   isolated loopback test databases. Audit reported separately, no risky override.
9. Frozen revision for existing Grok conversation, separate synthetic copy,
   original report, at most two collected correction rounds. No invented QA.
10. Private push and the same protected preview only after verification within
    existing authorization; confirm exact deployed SHA and access protection.

## Sequence and boundaries

Inventory/current captures → assets and product story → shared locale/UI
presentation → existing workspace flows → additive demo scenarios → full
regressions → frozen Grok review → targeted fixes → final evidence/delivery.

Codex is the sole source writer. Preserve historical migrations, domain/API/MCP
contracts, auth/session/rate-limit controls and data minimization. Preserve the
separate local MCP runtime on 3187 and shared PostgreSQL on 55451. Do not change
their profiles or stop them. No main merge, public release, new paid service,
real customer data, external messages or automatic next epic.

The older standalone motion fragment has a reported host read error. Its file
exists; browser/host loading must be distinguished from JavaScript behavior.
Repair and re-emit it without claiming a successful client render unseen.

## Current evidence

- Base verified; clean existing worktree preserved; isolated branch created.
- In progress: photographic English product page and labelled illustrative
  assistant interaction; shared English/Swedish preference and presentation for
  booking, calendar, customer lists/cards, services and staff. Remaining screens,
  the final visual system and browser verification are not complete.
- Isolated local `booking_premium_20261114_demo` created, ten migrations verified
  current. Read-only counts: 78 bookings, 32 customers, six services, five staff.
  Shared preview and local MCP data were not changed.
- `npm ci` and Prisma generation passed. Latest completed unit run: 114/114 in
  23 files; lint and typecheck passed. Locale-route tests initially failed because
  Vitest lacked the app's `@` alias; resolving the existing source alias fixed the
  test import. Targeted locale/navigation tests then passed 19/19.
- Integration 125/125, build, unit 114/114, lint/typecheck and 13/13 agent-card
  tests passed. Production web without proxy passed 62/62 after recorded fixes;
  other three modes running. Full audit: seven moderate development findings,
  production dependencies: zero. New Grok QA and deployment remain pending.
  No new commit or push yet. These intermediate results do not certify a release.
- Local browser evidence: English preference retained typed booking name;
  authenticated calendar opened, day picker selected Monday 16 November;
  at 390px a booking opened and its return link restored that same calendar day.
  Measured viewport 390px, document scroll width 375px (no horizontal overflow).
  Actual screenshots are in ignored `.vercel/premium-evidence/`; these are dev
  captures, not production/demo release evidence. Physical Safari not tested.
- Additional presentation implemented: midnight desktop navigation, cool light
  workspace surfaces, bilingual capacity/campaign review and contact-data panel.
  Safety scope and campaign validity descriptions retained. New local review
  account only in the isolated demo database; credential stays in ignored storage.
