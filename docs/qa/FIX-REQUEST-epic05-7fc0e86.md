# FIX REQUEST – Epic 05 – candidate 7fc0e866f0ef457bf9eaef4ca153e7a69b30b3d0

Source: independent QA (Grok Bot), 2026-11-12 CET. Full report: QA-REPORT-epic05-7fc0e86.md (Swedish).

## E05-QA-1 (Medium, blocking for limited local product alpha): admin manual bookings are throttled by anonymous customer caps

**Where**
- `src/app/api/admin/bookings/route.ts:44` calls `createBooking(input, key, clientIp(request.headers), actor)`.
- Because of that, `src/lib/domain.ts` applies these limits to an authenticated admin:
  - `:255` the in-memory 30/15 min limiter;
  - `:263–275` 5 new bookings per HMAC(client IP) per Stockholm creation day;
  - `:284` 3 per e-mail key per day.

**Reproduction (verified on a production build, port 3320, synthetic DB)**
1. Log in as an active admin and keep one source address (127.99.0.1).
2. POST `/api/admin/bookings` `{action:"create", ...}` 7 times, each with:
   - a fresh Idempotency-Key;
   - a different customer e-mail;
   - a different slot or staff member.
3. Result: 201 ×5, then 429 "För många försök. Försök igen senare." ×2, with Retry-After until midnight.

**Impact**
- A salon can enter at most 5 phone or walk-in bookings per day per computer.
- In a local alpha, the admin and the customer page share the same 127.0.0.1 budget.
- More than 3 bookings per day under one customer e-mail are refused.
- Cancelled rows keep counting.
- The error message gives the admin no actionable reason.
- None of this is documented for the admin channel. It breaks the core E05-2 manual-booking flow and AC1/AC4 in real use.

**Requested fix direction**
- For a verified, active admin actor, do not apply the anonymous IP cap or the per-e-mail customer cap. Alternatively, apply a separate, clearly documented and much higher per-admin-account limit. Do not share the budget with public bookings.
- Keep everything else unchanged:
  - authorisation before replay;
  - the admin-namespaced idempotency;
  - the lock order;
  - the serviceVersion check;
  - the exclusion constraint.
- Add an integration test: at least 6 admin creates on the same day from the same IP all return 201. Public bookings from that IP keep their own 5/day cap.
- Update ARCHITECTURE/README to state which caps apply to admin, public and MCP channels.

No other blocking defects were found. Minor backlog items (E05-QA-2..7) are listed in the report and are not part of this request.
