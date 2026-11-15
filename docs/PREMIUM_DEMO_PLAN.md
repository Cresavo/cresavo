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

Frozen product: `5212b7afb439ec22e36116f226b6db504cc7c5c3`. Subsequent
status edits are documentation only. Private product push and protected preview deployment verified.

- Implemented English/Swedish customer and workspace presentation, dark Relay
  product page, labelled interactive illustration, shared navigation and styles.
- Synthetic demo database started with 78 bookings, 32 customers, six services
  and five staff. Own browser test added one booking, moved and cancelled it,
  then saved one unpublished campaign draft. Shared databases remain unchanged.
- PASS: npm ci, Prisma generate, ten historical migrations and seed, lint,
  typecheck, build, 114 unit, 125 integration, 13 agent-card harness tests,
  and 62 web tests in each of four dev/production/proxy modes. Initial failures
  and the unchanged dev timeout rerun are retained in VERIFICATION.
- Actual local browser clicks cover booking, move, cancellation, history,
  customer search return, team editor cancellation, and capacity-to-draft.
  Screenshots include production desktop and emulated mobile, plus old cloud
  preview before-images. Physical iPhone/Safari remains NOT RUN.
- Full audit: seven moderate development findings; production: zero. No new
  dependency, risky override or business-rule change.
- Grok verified the frozen source archive and reviewed it in a separate
  synthetic copy. Initial scoped GO received, zero correction rounds used. Original hash verified.
- The standalone motion fragment works in a browser. Its inline host rendering
  is not yet confirmed; re-emitting a path is not proof of a repaired host read.
- Full CI run 43546809210 passed all four jobs on the exact pushed SHA; the protected preview was verified. See DEMO.md.

## Accepted scoped-QA backlog

PR-QA-1: hero navigation contrast over the photograph at 1440px.
PR-QA-2: use unambiguous English month names in history timestamps.
PR-QA-3: explicit E2E_PRODUCTION parsing rather than truthiness (existing).
PR-QA-4/5: clarify English-only product page selector and a few action labels.
No new fix loop is started for these Low/Info findings. Exact evidence,
reproduction and limitations remain in the unmodified QA original.
