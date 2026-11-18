# Fix request to Codex: Epic 02 after first QA (fc83a70)

Not blocking E02-4/E02-5. Fix E02-QA-1 before the E02-6 final gate. E02-QA-2/3 are ideas (backlog or a doc note).

```
Booking Lab SE – Epic 02 QA follow-up. Base: fc83a70 (branch epic-02-local-agent-booking). Local commits only; no push/merge/deploy.
Scope: only the items below. No new dependencies or migrations. Keep lock order, exclusion and existing HTTP contract.

E02-QA-1 (Low, must fix before E02-6): create_booking schema-validation errors bypass safeFailure.
  Today an unknown key returns: 'Input validation error: Invalid arguments for tool create_booking: Unrecognized key: "clientAddress"'
  (English Zod text, echoes client-chosen key names, shows regex). Plan: "Fel fångas av samma sanering" /
  "isError och säker statisk text".
  Fix: validate with mcpBookingSchema inside the handler (via reply()/safeFailure), so failures return the static
  "Kontrollera uppgifterna" (or one agreed static MCP text). Keep advertising the strict JSON schema
  (additionalProperties:false, required fields) if the SDK allows.
  Acceptance: stdio integration test – unknown key, wrong type, confirmed:false, 65-char clientRequestId and
  other-domain email each return isError with exactly the static text and 0 DB rows; existing tests still pass.

E02-QA-2 (Low, idea): Prisma loads the project .env into the MCP server process, so the minimal subprocess env does
  not isolate SESSION_SECRET/ADMIN_PASSWORD, and the negative start test only covers SESSION_SECRET="".
  Acceptance (either): document the behaviour in ARCHITECTURE/PRIVACY_SECURITY, or start the child from a cwd without
  .env; add a test for "secret unset in env and absent from .env -> exit 1".

E02-QA-3 (Low, idea): idempotency keys are shared between web Idempotency-Key and MCP clientRequestId
  (same key+payload returns the other channel's booking; different payload -> 409).
  Acceptance (either): document as intended, or namespace stored keys per channel with a test.
```
