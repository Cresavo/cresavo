# FIX-REQUEST – Epic 06 (024796f) – fix round 1 of 2

From: Grok Bot (independent QA). Base: frozen `024796f7f8049d03fa1425742e1fc699063cfac2` (archive sha256 `0be73b2b…2104`). Full evidence: `QA-REPORT-epic06-024796f.md` (incl. Addendum 1).

Scope:
- Fix only the three items below. No other product changes and no new dependencies.
- Do not rewrite historical migrations. Do not deploy before QA re-check.
- Current verdict: GO for a synthetic protected preview only; pilot NO-GO.
- Interim operator rule: do **not** run `demo:seed --preview` against the preview DB until E06-QA-11 is fixed.

---

## E06-QA-11 (Medium) – operator seed links a spoofed public booking to a seed customer card

**Where:**
- `scripts/seed-demo.ts:159-165`: the deterministic key is `"demo-v1-" + sha256("date:hour:minute:staffId").slice(0,36)`.
- `scripts/seed-demo.ts:168-180`: a row counts as "seed-owned" if `idempotencyKey` equals the raw key OR `sha256("admin:<actor.id>:<key>")`.
- `scripts/seed-demo.ts:181-197`: the backfill sets `customerId` when name and email match a `demo-customer-*` card, and counts the row as `existing`. This suppresses the seed's own booking.
- `src/app/api/bookings/route.ts:18-22` and `src/lib/domain.ts:242-247`: a public `Idempotency-Key` is stored raw.
- `src/lib/validation.ts:13-17` accepts the 44-character seed key.
- Legitimate historical seed rows are written with `id: key` and `idempotencyKey: key` (`seed-demo.ts:285`, `:301`) plus an admin create event (`:303-310`).

**Verified repro (QA):**
1. Fresh `_demo` DB: migrate and base seed, but no demo seed.
2. Public `POST /api/bookings` with the predicted key `demo-v1-03982daa…0588`, "Mira Demo" and `demo-customer-0@example.test`. Its create event is `actorKind:"public"`.
3. Run `demo:seed`. Result: `added 78, existing 1`. The public booking gets `customerId="demo-customer-0"`, and the seed's own booking (2026-11-23 09:00, Sofia) is never created.
4. A control booking with a UUID key stays unlinked.

Codex independently reproduced the same result (demo-customer-10).

**Expected behaviour (guard, as proposed by Codex and accepted by QA):**
- Backfill `customerId` or count a row as `existing` ONLY if all of the following hold:
  1. `idempotencyKey` is exactly this seed slot's key: either the admin-namespaced hash `sha256("admin:<demoActor.id>:<key>")`, or the raw key **and** `booking.id === key`, i.e. the seed's own historical id;
  2. a server-stored `BookingEvent` exists with `action:"create"`, `actorKind:"admin"` and `actorId` equal to the dedicated demo-owner actor (`DEMO_ADMIN_EMAIL` account);
  3. recommended: `staffId`, `serviceId` and the initial start match the expected seed slot.
- A row that collides on the key but fails the guard is never linked or modified. It is reported in the seed output as `conflict` (or `skipped`), not `existing`.
- Never match by name or email alone. Snapshot columns are never written.

**Required tests (integration, on a `_demo`/`_test` DB):**
- **Spoofed public key stays unlinked:** a public booking with the predicted raw seed key and a matching seed name and email, then `demo:seed`. Expect `customerId` NULL, the snapshot unchanged, and the seed reporting the conflict.
- **Legitimate old seed booking is linked:** a seed-created row with no `customerId`, simulating an upgrade from the d7bc47f seed (`id = key`, admin create event by the demo actor). After `demo:seed`, expect `customerId = demo-customer-N`.
- **Snapshots untouched:** md5 over all pre-existing booking snapshot columns is identical before and after the seed; only `customerId` may change, and only on guarded rows.
- Re-run idempotency still holds: a 2nd and 3rd run add 0 and leave table hashes unchanged.

---

## E06-QA-1 (Medium, UI) – long unbroken customer name or email overflows

**Where:**
- `src/app/admin/customers/[id]/page.tsx:64` (`<h1>{customer.name}</h1>`) and `:80` (contact line);
- `src/app/admin/customers/page.tsx:107` (`<strong>{c.name}</strong>` in `.customer-row`);
- `src/app/admin/customers/picker.tsx:49` ("Vald kund: <strong>");
- `src/app/style.css:17` (`.customer-row strong`) and `:373` (`.workspace-heading h1`) have no `overflow-wrap`.

**Measured (gate on, 80-char unbroken name, `qa-<61 chars>@example.test`):**
- The card reaches a document width of 1197 px at 320/390 and **1594 px at 1440**.
- The list row reaches 859 px and the new-booking page 729 px.
- The email overflows its panel at 320/390.
- A realistic hyphenated 43-character email wraps correctly.

**Expected:**
- No horizontal page overflow at 320, 390 and 1440 for names up to 80 characters and emails up to 254 characters.
- Use `overflow-wrap:anywhere` and `min-width:0` (inside flex/grid) on: the card heading, the list-row name, the picker's selected name and choice buttons, and the card's contact line.
- The primary actions ("Ny bokning", "Sök kunder") stay visible and clickable.

**Required test (Playwright, desktop + mobile projects, plus 320):**
- Create a customer with a long unbroken name and a long `@example.test` email.
- Visit the list (searched), the card (gate-on contact visible, or the masked variant locally) and `/admin/bookings/new?customer=<id>`.
- Assert `document.documentElement.scrollWidth <= innerWidth` and that the heading and contact elements have `scrollWidth <= clientWidth`.
- With mobile emulation, also assert `innerWidth` equals the configured viewport width (no layout-viewport zoom-out).

---

## E06-QA-2 (Low) – `%` and `_` act as wildcards in customer search

**Where:** `src/lib/customers.ts:147`. Prisma `contains` does not escape LIKE metacharacters.

**Repro:** on the synthetic demo seed (32 customers), `GET /api/admin/customers?q=_`, `q=%` or `q=demo%customer` returns 32 of 32 hits. It is not an injection, but the search semantics are wrong.

**Expected:** `\`, `%` and `_` in `q` are matched literally (escape before `contains`, or use a parameterised `ILIKE … ESCAPE '\'`). Name, email and phone search otherwise behave as now: case-insensitive, at most 80 characters, page limit 50.

**Required test (integration):**
- On the synthetic seed, `q=_` and `q=%` return **0 hits**.
- `q=demo-customer-1@` still returns exactly one hit.
- A customer whose name literally contains `_` or `%` is found by that literal query.

---

## Re-check plan (QA, round 1)
Targeted re-check only:
- the diff 024796f → fix commit;
- the three new tests;
- lint, tsc, build, unit and integration;
- full E2E in prod once;
- the seed-ownership negative probe and the upgrade/seed re-run;
- long-name measurements at 320, 390 and 1440.

No new full UI QA. Round 2 is reserved for remaining issues only.
