# Studio store

Status **Step 2 of decision 1** in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).
The Postgres work in items 1–10 of the [build order](#build-order) is staged.
The browser store stages messages as well as payments ([BROWSER_STORE_IDB.md](BROWSER_STORE_IDB.md), PR 2).

Studio and server code should read and change a salon through `StudioStore`
(`src/concept/store/studio-store.ts`), not through the browser store directly.
Step 1 defined the interface, wrapped the browser store and added a contract
suite. Step 2 stages a Postgres store behind the same contract. The app does not
use it yet, and the studio behaves as before.

## Interface

```ts
interface StudioStore {
  load(tenantId): Promise<{ state: DemoState; version: number } | null>;
  apply(tenantId, action: DemoAction, meta?: { actor?, source?, at? },
        options?: { expectedVersion?, idempotencyKey? }): Promise<ApplyResult>;
  subscribe(tenantId, listener: (change: StoreChange) => void): () => void;
  history(tenantId, { after?, limit }): Promise<{ entries: TenantAction[]; next: number | null }>;
}

type ApplyResult =
  | { ok: true; state; version; effects: StoreEffect[]; entry: TenantAction; replayed: boolean }
  | { ok: false; reason: "conflict" | "rejected" | "idempotency-mismatch" | "not-found"; version?; detail? };

interface TenantAction {
  seq; tenantId; action; actor; source; at; idempotencyKey?; resultingVersion;
}
```

## Guarantees

| Guarantee | Meaning |
| --- | --- |
| Validation | `apply` runs `prepareAction`, the same reducer and activity log entry as `dispatch`. A refusal or no-op is `rejected` and changes nothing: state, version, log and subscribers. A no-op is also a fresh object with identical content, apart from `seq`. |
| Versions | Every commit increments `version` by exactly one. With `expectedVersion`, a stale version is `conflict` and changes nothing. |
| Serialized applies | Applies to one tenant run one at a time. Without `expectedVersion` the reducer decides against the latest state, so two bookings for one slot never both succeed. |
| Idempotency | Keys are scoped per tenant. The same key and the same action (canonical JSON) return the first result (its state, version, entry and effects) with `replayed: true`, even after later commits. The reducer does not run again and effects are not published again. The same key with another action is `idempotency-mismatch`. Refused applies are not remembered, so a retry runs the rules again. |
| Effects after commit | Calls are staged while the reducer runs and published only after the commit, then reported in the result and to subscribers. The memory and browser stores stage payments, SMS, email and social posts; `dispatchWithLog` publishes them only after its save. |
| Detached values | Results, loaded states, history entries and each subscriber's payload are copies. The store copies the action it receives. Editing any of them never changes what is stored. |
| Append-only log | Each commit appends one `TenantAction` with `seq` 1, 2, 3 and so on. `history` pages it oldest first. Privileged erasure redacts entries and maintenance applies demo and sandbox retention. The log differs from `state.log`, which is capped at 100 entries, skips unlogged actions such as `card/dismiss`, and supports undo. |
| Isolation | One tenant's state, log, idempotency keys, effects and notifications are never visible through another tenant's ID. |
| Migration | `load` returns the state at `DEMO_VERSION` and runs `migrateState` on an older saved document first. |

## Implementations

- **`MemoryStudioStore`** (`src/concept/store/memory-studio-store.ts`) is the
  reference. It has plain memory and an injectable clock, which also judges
  checkout-hold expiry through `withSlotClock`. Each tenant gets its own
  simulated ledger (`channelLedger`) for payments and messages, so tenants
  never share idempotency keys or outboxes. The reducer's sends are routed
  there with `withDemoChannels`. The store copies seeds through JSON as a
  database would. It migrates them on first read and treats a document that
  cannot be migrated or is malformed as missing. A per-tenant promise queue
  serializes applies, modelling the row lock.
- **`BrowserStudioStore`** (`src/concept/store/browser-studio-store.ts`)
  wraps the existing store with `dispatchWithLog`, `withBookingLock` and
  `withAddressLock`. It also uses new read-only or notification exports:
  `latestState`, `currentRaw`, `subscribeStore` and `onSalonRemoved`.
  Storage keys, the legacy receipts and every existing code path are
  unchanged.
  - Tenant IDs are the workspaces `"demo"` and `"own"`. A tab serves the one
    it has open; the other is `not-found`.
  - Version, log and keys are per tab and shared by every adapter instance in
    it. They are kept in memory under no storage key and end when the salon is
    deleted, expires, is removed in another tab or is replaced by a new sample
    business. Switching workspaces keeps them.
  - While anyone subscribes, the adapter listens to the store's own
    notifications. A legacy `dispatch` or another tab's write increments the
    version and reaches subscribers once, without a log entry.
  - The version check runs inside `dispatchWithLog`'s guard after it rereads
    storage. Before that, under its own Web Lock, the adapter waits until this
    tab's storage read matches the receipt of the last adapter commit, which is
    a hash of the saved text plus the day and `seq` in Cache Storage. A
    renderer with an older localStorage view therefore cannot pass a stale
    version, even for changes that do not bump `seq`. A read that never
    matches within a second is a later write made without the adapter, which
    is then current.
  - Actions that can change the booking address (`salon/slug`, `log/undo`,
    `trash/restore`) also take the cross-workspace address lock.
  - When the legacy booking receipt times out, the result is `conflict`
    (retry). `not-found` means the tab switched salon.

- **`PostgresStudioStore`** (`src/concept/store/postgres-studio-store.ts`)
  is staged over `tenant_state`, `tenant_action`, `tenant_idempotency` and
  `tenant_effect`. See [Step 2: Postgres](#step-2-postgres).

## Contract suite

`tests/store-contract/contract.ts` exports `runStudioStoreContract(name, makeStore)`.
`memory.test.ts` and `browser.test.ts` run it against each implementation, and
`tests/integration/postgres-studio-store.test.ts` runs it against Postgres.
`browser.test.ts` uses a stubbed `window`, as the existing store tests do. It
covers:

- load and apply round trip, and a version increment per commit only
- detached values: edits to results, actions, history pages and one subscriber's payload change nothing stored
- a malformed saved document never makes `load` or `apply` throw
- stale `expectedVersion` returns `conflict`, with no change to state, log or subscribers
- idempotency replay returns the original state, entry, version and effects even after a later commit, and the recording payment sink (`harness.payments`) gets exactly one charge; key reuse with another action returns `idempotency-mismatch`; a refused key is not remembered
- refused actions (unknown booking, taken slot, unknown treatment, a semantic no-op price change) leave everything unchanged and do not use up their keys
- effects only after commit: the sink receives the deposit only after the commit, a listener already reads the committed state, and conflicts and refusals publish nothing
- messages only for commits: a refused or conflicting apply records no message, a commit exactly one (`harness.messages`)
- two concurrent applies for one slot: one wins, and the other is `rejected` without a version or `conflict` with one
- cancel then rebook the same slot; a second cancel is refused
- customer deletion removes the customer from a later load
- history ordering, actor, versions and pagination with `after` and `next`
- tenant isolation of state, log, idempotency keys and notifications
- migration of a v20 save that keeps the owner's edits

Store-specific tests cover the following:

- **Memory:** malformed and too-old documents, the injected clock for holds, per-tenant message delivery and O(page) paging.
- **Browser:** shared metadata between instances, subscribers bridged to legacy and cross-tab writes, trial deletion and expiry, two-tab conflicts, a lagging storage read, receipt timeout as `conflict`, and the address lock.

### Legacy invariants now covered

| Legacy invariant (`tests/e2e`, `tests/integration`) | Contract test |
| --- | --- |
| No double booking, capacity | Concurrent applies for one slot; taken slot refused |
| Idempotency | Key replay, mismatch and no memory of refusals |
| Card replay (no second charge) | Paying a hold twice, with or without the key, charges once |
| Cancel and rebook | Cancelled slot freed for a new booking |
| Customer data delete | Deleted customer gone from the loaded state |
| Tenant separation | Isolation test |

Not yet covered: cancel **by token** (the studio has no public cancel token
yet), customer data **export** (a read, outside the store), and the legacy
engine's per-resource limits beyond what `isFree` checks.

## Step 2: Postgres

`PostgresStudioStore` (`src/concept/store/postgres-studio-store.ts`) implements
the same interface. It is staged only: nothing in the app constructs it yet.
Migration `20261119120000_studio_store` adds four tables and leaves every
existing table unchanged. `20261120090000_effect_outbox_states` adds the
`failed` and `cancelled` outbox states and the poller's index:

```sql
tenant_state       (tenant_id PK, kind tenant_kind {salon|demo|sandbox}, version int,
                    doc jsonb, expires_at timestamptz NULL, updated_at timestamptz)
tenant_action      (tenant_id, seq bigint, action jsonb, actor, source, at timestamptz,
                    idempotency_key text NULL,  -- informational, not unique
                    resulting_version int, subject_ids text[] (GIN), redacted_at NULL,
                    PRIMARY KEY (tenant_id, seq))
tenant_idempotency (tenant_id, key (1..200 chars), fingerprint_hmac, seq bigint,
                    result jsonb, expires_at timestamptz (indexed),
                    PRIMARY KEY (tenant_id, key))
tenant_effect      (tenant_id, seq bigint, n int, id text UNIQUE, fingerprint, kind,
                    payload jsonb, status pending|delivered|failed|cancelled, attempts,
                    next_attempt_at, delivered_at, PRIMARY KEY (tenant_id, seq, n),
                    INDEX (status, next_attempt_at), INDEX (tenant_id, status, seq, n),
                    INDEX (status, tenant_id, seq, n))
```

The migration does not create roles. `prisma/grants/studio-store.sql`
documents the intended grants for operators. It first revokes everything the
application role already has on the four tables, then grants it only `SELECT`
and `INSERT` on `tenant_action`. The `erase_subject` function in
`prisma/grants/erase-subject.sql` is the only updater (see [Erasure](#erasure-item-7)).
`prisma/grants/verify-studio-store.sql` lists every remaining problem for a
role:

- `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER` on the log, including privileges inherited through role membership or `PUBLIC`
- ownership of the table or schema, directly or through a role it can use
- superuser or `BYPASSRLS`
- missing `SELECT` or `INSERT`

The operator runs it with `psql -v app_role=…`. It must return no rows.

Each `apply` is one interactive Prisma transaction:

1. `SELECT … FROM tenant_state WHERE tenant_id = $1 FOR UPDATE` takes the row lock, after `SET LOCAL lock_timeout` (`lockTimeoutMs`, 2 s by default). A lock timeout (`55P03`) is `conflict`, so the caller retries instead of piling up connections. A missing or expired tenant is `not-found`.
2. The clock is read after the lock, from `clock_timestamp()` or the injected `now`. The log stamp `at` is the clock clamped to the previous entry's `at`. Everything else uses the clock itself.
3. A key that has not expired in `tenant_idempotency` returns the stored result as a replay (state, version, entry and effects). If the HMAC-SHA256 fingerprint differs, the result is `idempotency-mismatch`. Expiry is judged and set by the clock (24 hours), never by `at`. An imported, backdated or clamped stamp therefore cannot shorten or stretch the window. An expired key is forgotten and the rules run again. Keys longer than 200 characters are `rejected`.
4. A stale `expectedVersion` is `conflict`.
5. `migrateState` and the reducer run staged like `MemoryStudioStore`:

   ```ts
   withTenantPresentation(state, () => withSlotClock(now, () => withDemoChannels(stage, () => prepareAction(…))))
   ```

   - **Clock.** The reducer's `now` is the clock. `withTrustedTimes` replaces the caller-reported times that decide eligibility or access with the clock: the booking cutoff of `online/*` requests (`guest.at`), whether `review/submit` follows the visit, and the start or end of `support/grant` and `support/revoke`. Pure event stamps such as `stock/order` and `customers/message` are kept. With `trustCallerClock`, which is for tests and imports only, the caller's `meta.at` and action times are used instead.
   - **Presentation.** `withTenantPresentation` sets the tenant's language, vocabulary and currency for activity text and payment descriptions, then restores the process settings.
   - **No-ops.** No-op detection (`sameContent`, `diffStates`, `page/set`, the policy check) uses `jsonEqual`, which ignores object key order, so a page or policy read back from `jsonb` is not a change. An unchanged state is `rejected`.
   - **Sync guard.** A reducer that returned a Promise would throw. A unit test guards that it never does.
6. The store checks the UTF-8 document size, writes the document and version, appends `tenant_action` with `subject_ids`, inserts new effects, stores the key and queues the change notification in the transaction.

**After the commit**, `apply` drains the tenant's due effects in `(seq, n)` order, its own included, with the same code and claim rule as the [poller](#outbox-poller-item-4). With `deliverAfterCommit: false` only the poller delivers.

- Each row is claimed with a 60-second lease on `next_attempt_at`, sent, then acknowledged in its own statement. A later slow or failing send never undoes an earlier acknowledgement, and no connection is held while a sink runs.
- A payment is never claimed while an earlier payment of the same tenant is still pending or `failed`. A refund therefore waits for its checkout. Rows are claimed one at a time, so the deliverer that acknowledges the checkout claims the refund it unblocked next.
- A sink error leaves the row `pending` with an exponential backoff for the poller.
- Then in-process subscribers are notified.

Other details:

- **Effect ids.** The reducer's sends go through `stagedChannels`, which keeps each record with its full provider request (port, operation, idempotency key, input).
  - An effect's id is `eff_` plus the SHA-256 of the tenant id and that logical provider key. For a port without keys it uses the whole request. The 32-bit outbox record id is not used.
  - The id is stable, unique across tenants and meant as the provider's idempotency key. `fingerprint` is the SHA-256 of the full request.
  - The same id with the same fingerprint is a request an earlier apply already made, so it is not a new effect. The same id with another fingerprint is a key reused for different content. The provider would refuse it, so the whole apply is `rejected`.
- **Returned states.** The returned state is the document as stored (`UPDATE … RETURNING doc`), so results, loads and replays share the same `jsonb` key order.
- **`subject_ids`.** The store collects every `customerId` or `customerIds` anywhere in the action, including nested entries and multi-recipient texts, and the `id` of `customer/*` actions. It also adds the customer of every record the reducer changed in any of the state's lists.
- **`history`.** Like `load`, `history` returns nothing for an unknown, deleted or expired tenant.
- **Constructor.** `{ prisma, hmacSecret (≥ 32 chars, never logged or stored), sinks: { payment, message }, simulatedSinks?, now?: () => Promise<number>, trustCallerClock?: false, deliverAfterCommit?: true, lockTimeoutMs?: 2000, leaseMs?: 60000, maxAttempts?: 10, listenerConnectionString? }`. `sinks` serve `salon` tenants only. `simulatedSinks` serve `demo` and `sandbox` tenants and acknowledge without sending by default.

### Outbox poller (item 4)

`drainPendingEffects({ prisma, sinks?, simulatedSinks?, now?, limit = 100, leaseMs = 60 s, maxAttempts = 10, tenants? })`
in `src/concept/store/effect-outbox.ts` is one poller run over every tenant, or
only over `tenants` (an operator draining one salon, or tests that share a database).
`npm run effects:drain` (`scripts/drain-effects.mts`) runs it once for a cron
and prints only counts. The in-apply drain calls the same `deliverDue` with a
tenant filter, so both claim by one rule, in one statement per row:

```sql
WITH next AS (
  SELECT … FROM tenant_effect e LEFT JOIN tenant_state s USING (tenant_id)
  WHERE e.status = 'pending' AND e.next_attempt_at <= now        -- due, and not leased
    AND e.erased_at IS NULL                                       -- not stopped by an erasure
    AND (s.expires_at IS NULL OR s.expires_at > now)
    AND (e.kind <> 'payment' OR NOT EXISTS (earlier payment of the tenant, pending or failed))
  ORDER BY e.tenant_id, e.seq, e.n LIMIT 1                        -- commit order
  FOR UPDATE OF e SKIP LOCKED)
UPDATE tenant_effect … SET attempts = attempts + 1, next_attempt_at = now + lease, leased_until = now + lease …
```

- **Concurrent pollers.** `SKIP LOCKED` and the lease mean two pollers never claim the same row. A row whose deliverer died after claiming it is due again when the lease runs out. Sinks must give up well within the lease, since the provider sees the effect id again after that (it is the provider's idempotency key).
- **Acknowledgement.** Each row is acknowledged on its own after its send, and a send that happened is recorded as `delivered` whatever happened to the row meanwhile. A failure is recorded only by the deliverer holding the latest claim (same `attempts`). Every outcome clears `leased_until`, so a future `leased_until` means a deliverer is sending the row right now.
- **Backoff and failure.** After failed attempt *k* the row is due again after 2^k seconds (capped at an hour). After `maxAttempts` it becomes `failed`, for an operator. A failed payment keeps blocking the tenant's later payments, so a refund never goes out for a checkout that never went through.
- **Routing by kind.** The tenant's `kind` decides the sink: `demo` and `sandbox` effects go to `simulatedSinks` only, and only `salon` effects reach `sinks`. A poller run without `sinks` does not claim salon effects at all. An effect whose tenant row is gone gets no sink, so it is retried and then `failed`. Payloads and sink errors are never logged.

### Concurrency (item 5)

All applies to a tenant serialize on its row lock. Tested with real separate connections:

- 20 store instances, each on its own connection, book the same slot at once: exactly one commits and the rest are `rejected` (or `conflict` after a lock timeout). There is one `tenant_action` row and one booking.
- 20 connections pay the same checkout hold at once: one commit, one payment effect, one charge.
- Two instances interleave 15 applies each on one tenant: versions and `seq` run 1 to 30 without gaps, and each row's `resulting_version` equals its `seq`.
- A third connection holds the row lock: an apply with `lockTimeoutMs: 300` returns `conflict` after about 300 ms and changes nothing, and so does `eraseSubject`.

### Change notifications (item 6)

Each document commit queues `pg_notify('tenant_changes', …)` in the same
transaction. Postgres releases the message at commit. Its JSON payload is
`{tenantId, version, sender}`. Instances use the existing `pg` driver from
`@prisma/adapter-pg` for one dedicated connection while they have subscribers.
Set `listenerConnectionString` to a direct connection to the same database
as Prisma. It defaults to `DATABASE_URL` when available.

The writing instance still delivers its full local notification after the
outbox drain. It recognises its own database echo by a sender ID generated
once per store instance. Other instances receive the version and re-read
through `load` or `history`. Unsubscribing removes the callback. The last
unsubscribe or `close()` releases the listener connection.

The initial `LISTEN` is asynchronous. `notificationsReady` indicates that
registration has completed. The listener retries after connection loss.
Pass `{ onRefresh }` as the third argument to the Postgres store's `subscribe`
to reload the snapshot when listening starts or resumes. Postgres only
delivers notifications to sessions listening at commit.

### Erasure (item 7)

`customer/delete` keeps its meaning in the studio: the customer and their
records go to the trash for 30 days and the undo toast can bring them back.
The new reducer action **`customer/erase`** (`src/concept/customers/erase.ts`)
is the final form:

- It removes the customer, live or in the trash, every record with their `customerId` in any list, checkout holds made with their phone (compared as `normalizePhone` does) and the trash entries of their bookings.
- Log entries in `state.log` that concern them (a record of theirs in the undo data, their phone in any format, or their name, phone or email in the text) keep only their type, time and actor. The text becomes "A change about an erased customer", since a cancellation reason or an inbox title is personal too, and the undo `patch` is dropped.
- Their name, phone or email in other free text is replaced by the marker in the salon's language ("[removed]" or "[borttaget]"). That covers other customers' notes and journals (versions included), the name of the person a visit or a checkout in progress is for (`visitFor`), inbox text, reviews, assistant memory, gift card recipients and messages, support tickets, and the same fields in other trash bundles (`DOCUMENT_FREE_TEXT`). Ids, slugs, settings and other customers' contact fields are never rewritten, so erasing a "Summer" leaves the booking address `summer-studio` alone.
- Its own log entry names nobody and cannot be undone.
- `purgeExpired` runs it for customers whose 30 days in the trash are over, so an expired deletion can no longer be undone from the log. The browser store writes such a load back to storage, but only over the text it just read, so another tab's newer write is never overwritten. That write is purged when it is read.

Identifiers are the full name, the phone (as stored and as normalized digits)
and the email. Values shorter than 5 characters are not scrubbed.

Every store refuses `customer/erase` as a plain `apply` (`isErasure`, a
contract case). Their history, idempotency results and published effects would
otherwise keep and replay what was erased. The browser and memory stores
therefore have no erasure path yet. `PostgresStudioStore.eraseSubject(tenantId,
customerId)` runs one transaction under the row lock:

1. **`tenant_action`.** These rows get the fields listed for their type in `PERSONAL_FIELDS` (`src/concept/store/erasure.ts`) replaced by `[redacted]`, and `redacted_at` is set:
   - rows that name the customer by `subject_ids` or `customerId`;
   - rows that contain their email;
   - rows with a `phone` field holding their number in any format (an `online/hold` from before they were a customer has no subject id).

   Rows that only contain the name have just the name replaced. The informational `idempotency_key` column is scrubbed the same way, since a caller's key can embed an email.

   Covered fields: guest name, phone and email; notices and inbox text; booking cancel and fee waiver reasons; imported customers; customer notes; message titles and bodies; inbox and review replies; review text; journal content and versions; gift card recipients and messages; assistant memory; support tickets.

   Array fields are redacted for every element, not only the erased customer's. The log is audit only, so redacting a little more is the safe side.
2. **`tenant_effect`.** The matched rows are locked (`FOR UPDATE`), so an acknowledgement waits for the erasure and a claim skips them.
   - **Messages addressed to the customer** (`to` is `customer:<id>`) have their recipient, subject and body redacted.
     - If pending, the row becomes `cancelled` (with `erased_at`), whether or not a deliverer holds it. A deliverer holding it right now (`leased_until` in the future) is reported in `inFlightMessages`. The message sink rechecks the booking under the tenant's lock and commits its `dispatched` marker only while the row is still pending and not erased, so one that had not dispatched yet sends nothing. One that had dispatched still records a successful send as `delivered` (with the redacted payload); a failed one stays `cancelled` and is never retried.
   - **Other recipients' messages**, even from the same multi-recipient action, keep their status. They only lose an identifier that appears in their text.
   - **Delivered payments** only lose identifiers, so the amount and reference stay for the books. A pending payment is kept so a refund still goes out (see open questions).
3. **`tenant_idempotency`.** Rows whose stored result (a state copy) holds the customer's id or an identifier are never deleted, so a retry is always answered and never applied a second time: the customer's records, card, trash entry and checkout holds (by any phone number they had) are removed from the stored snapshot, undo data is dropped from its history, and their identifiers are replaced. A key that itself holds an identifier is stored under `erased-<sha256>`, and the replay lookup also tries that form. Another customer's replay therefore returns the same answer after the erasure. Other keys keep protecting their retries, so a typo or a repeated erasure never makes a keyed change apply twice.
4. **The document.** `customer/erase` runs like an apply: a new version and a `tenant_action` row `{ type: "customer/erase", id }`. It can commit above the document size limit. If the document no longer holds the customer, only the tables are redacted and the version stays.

The result reports the counts, the pending payments kept and the in-flight
messages.

**Privileges.** The application role may only insert into and read
`tenant_action`, so in production the table half must be the SECURITY DEFINER
`erase_subject(tenant, customerId)` from `prisma/grants/erase-subject.sql`:

- Construct the store with `erasure: "function"`. It calls `erase_subject` inside the same transaction, after the row lock and before the document is written.
- The default, `erasure: "statements"`, runs the same statements as the connecting role. That is for staging and tests.
- The script runs in one transaction with psql variables `eraser_role` and `app_role`. It grants the eraser role only the columns it changes, creates the function and its helpers, then revokes `EXECUTE` from `PUBLIC`. It also makes the eraser role the owner and grants `EXECUTE` to the application role only. The function never exists with the default grant to `PUBLIC`. Helpers are schema-qualified and scrub only JSON string values, never keys or numbers.

The test database role cannot create roles, so the tests run the script with
both roles set to the connecting role. That checks:

- `PUBLIC` cannot execute the function;
- it redacts exactly as the statements do;
- `eraseSubject` with `erasure: "function"` calls it.

Running it under a truly restricted application role is left to an
environment where roles can be created.

`tests/integration/postgres-studio-store.test.ts` runs
`runStudioStoreContract("PostgresStudioStore", …)` unchanged against a
disposable local database (`*_test`, after `prisma migrate deploy`) in
`test:integration`. Each run seeds fresh tenant ids. The Postgres-specific
cases cover the following:

- the database clock wins over `meta.at`, `trustCallerClock` applies, and the clock is clamped
- booking cutoffs and support grants follow the store clock, not the caller's
- keys expire after 24 hours on an injected clock: a replayed booking is rejected, a replayed payment charges once, and the key can be reused
- the key window stays on the clock with backdated and future-dated imports
- the fingerprint is only an HMAC
- effects are rolled back with the transaction, then written and delivered exactly once
- a provider key reused for another request refuses the change
- each delivery is acknowledged on its own
- a refund never overtakes its checkout across two store instances
- a failing sink leaves the effect pending with a backoff
- unknown and expired tenants, and their history
- `subject_ids` for single, nested and multi-recipient actions
- resubmitting the loaded booking page is a no-op
- activity text uses the tenant's language and currency
- the grants check flags a role that owns or can change the log. The test role cannot create roles, so it checks the connecting owner role.
- two store instances on separate connection pools wait on the same row lock for one slot, and one wins

`tests/integration/postgres-studio-store-durability.test.ts` covers items 4,
5 and 7:

- a crash between commit and drain (`deliverAfterCommit: false`): the poller delivers each effect exactly once, in commit order, and a second run delivers nothing
- a deliverer that dies after claiming: the row is retried only after its lease
- four concurrent pollers on separate connections never deliver one row twice
- backoff of 2 s and then 4 s, `failed` after `maxAttempts`, and a refund that keeps waiting behind the failed checkout
- demo and sandbox effects reach only the simulated sinks, both from the poller and from the in-apply drain, and a poller without live sinks leaves salon effects unclaimed
- the concurrency cases above
- a poller restricted to some tenants never claims another tenant's rows
- erasure: a fictional customer is deleted and erased. They have a deposit booking, confirmations, a note, texts (one shared with another customer), a hold typed with a formatted phone and no email, and a booking under a key that holds their email, cancelled with a private reason. A scan of every column of every row in the four tables, the document included, finds their name, phone in either format, email and the private reason zero times. The other customer's messages, the payment amount and the booking address are intact.
- unsent messages to the erased customer are cancelled, the other recipient's messages from the same action are still sent, and a pending payment is kept and delivered
- a message a deliverer holds during the erasure is cancelled with the erasure (statements and `erase_subject` alike) and reported. Its success is recorded as delivered with a redacted payload; its failure stays cancelled and is never retried.
- an unrelated or repeated erasure keeps other idempotency keys, so a keyed retry still replays
- `apply` refuses `customer/erase`
- `erase_subject`: `PUBLIC` cannot execute it, JSON keys and numbers survive its scrub, it matches the statements exactly, and `erasure: "function"` uses it

Pure helpers (`jsonEqual`, `withTrustedTimes`, effect ids, `subjectIds`,
`withTenantPresentation`) have unit tests in `tests/store-contract/store-helpers.test.ts`.

### Maintenance and tenant lifecycle (items 8 and 9)

- `scopedIdempotencyKey(caller, key)` prepares a single tenant key for a future HTTP caller. It accepts an authenticated client ID, site key or the reserved `studio` caller. Caller IDs use letters, digits, underscores and hyphens, and opaque keys use printable ASCII without spaces. The combined value, including the colon, is at most 200 characters.
- `replaceState(tenantId, state, { actor: "system", reason })` is a privileged entry point on the concrete Postgres store. It replaces a locked tenant document and appends a `system/replace` audit entry. The operator caller authorizes the operation.
- `resetDemoTenant({ generatedFor })` operates on the seeded `demo` tenant of kind `demo`. It regenerates the fixture under the same row lock and records a `system/reset` action with payload `{ generatedFor }`. Requests for the date already in the document or an older date do not write. The document's ID counter is preserved, and the version keeps the audit sequence increasing even after all earlier demo entries have been purged.
- `openSandboxTenant(token)` returns a handle with `load` and `apply`. Its first successful apply creates and changes the day's deterministic salon-local fixture in one transaction. Rejected first applies leave no tenant. The database clock sets a fixed 24-hour expiry. Expired tenants are unavailable to loads, writes, history and outbox claims. If a token is reused after its expired rows are swept, the new sandbox gets a new tenant ID. `load()` and the committed action entry return that ID. Pair it with `expectedVersion` for edits through `store.apply`, and with the cursor for `history`. A token-only `apply` accepts an omitted version or version `0` for the initial write. The caller will own token validity when an API is added.
- `npm run store:sweep` runs one pass using the supplied `DATABASE_URL` and prints JSON counts. It deletes expired sandboxes and all their rows, expired idempotency keys and demo audit rows older than seven days. The sweepers use at most 500 selected rows or tenants per batch by default and skip locks held by another transaction. Each sandbox batch locks the tenant rows and deletes their data atomically. The cron connection needs maintenance privileges on the four store tables, including `DELETE` on `tenant_action` and `tenant_effect`. The application audit grants stay append-only. `prisma/grants/roles.sql` creates that sweep role with column-level grants derived from the sweepers; `tests/ops-roles.test.ts` keeps the two in step.

### Retention of personal data

The periods live in `src/concept/privacy/retention.ts`. They are defaults: the salon (controller) or a lawyer must confirm them before the pilot gate is signed off.

| Data | Default | How it is enforced |
| --- | --- | --- |
| Inactive customers | 3 years after the last visit | Never automatic. "Customers due for review" lists them in the studio (`customersDueForReview`). The owner keeps, deletes (30 days in the trash) or erases. A kept customer returns after 12 months. |
| Journal entries | The owner's setting (`state.privacy`) | Never automatic. Privacy lists customers with entries older than the chosen period. |
| Activity log, personal data | 13 months | `sweepActivityPersonalData` replaces the personal fields of old `tenant_action` rows (`PERSONAL_FIELDS`) with `[redacted]`, sets `redacted_at` and clears the informational `idempotency_key`. The document's own history (`state.log`) is aged by `ageActivityLog` whenever the salon changes: older entries keep type, time and actor. |
| Message bodies in the outbox | 90 days | `sweepOutboxBodies` blanks body, subject, address and delivery copy of non-pending messages whose action is older than 90 days. A `customer:<id>` reference stays. |
| Rate-limit rows | 1 day | `sweepRateLimits` deletes `RateLimitBucket` rows that expired more than a day ago. |
| Idempotency keys | 24 hours | `sweepExpiredIdempotency` (unchanged). |
| Journal access log | 24 months | Pruned when a new read is logged. |

`npm run store:sweep` runs all of them and prints their counts. The cron connection needs `UPDATE ("action", "idempotency_key", "redacted_at")` and `DELETE` on `tenant_action`, `UPDATE ("payload")` on `tenant_effect` and `DELETE` on `"RateLimitBucket"` in addition to the grants above. Age-based redaction of an audit row is marked inside its action (`retentionRedacted`), not by `redacted_at`, which an erasure also sets for one customer only. Every old row loses its informational `idempotency_key`, and `journal/view` audit rows are deleted after 24 months (`sweepJournalAccessRows`). The outbox sweep judges body, subject, address and the stored mail copy separately and keeps the delivery outcome (`sent`, `reason`). The application role keeps append-only access to `tenant_action`. Nothing schedules the script yet: the operator runs it (daily is enough).

### Journal read log

`journal/view` records one read of a journal in `state.journalAccess` (who, when, which customer, no content). It is not an activity entry. The studio sends it when a journal is shown (the customer's journal tab, the history list, the last advice on a booking and on Today). The owner salon load (`GET /api/owner/salon`) logs one entry without a customer when the salon holds journal entries, because the document delivers every journal to the browser; it is logged at most every ten minutes. Missing: the journals still travel with the document, so a modified client can read without reporting. Logging every read on the server needs a route that returns one customer's journal.

The lifecycle integration tests cover notification delivery and reconnect,
privileged replacement, demo-only reset and retention, sandbox expiry and
simulated delivery, and refusal of oversized writes.

### Metrics and benchmark (item 10)

`store.store_metrics()` reads a process-local snapshot of commit and
size-refusal counts, the latest committed document's compact UTF-8 size and
booking count, and its transaction duration in milliseconds. Duration
starts at the write call and ends at commit, before outbox delivery. The
snapshot also reports p95 over the last 100 document commits and counts
how often the warn or act thresholds were reached. Above 8,000,000 bytes,
the store rejects writes unless they shrink the saved document, revoke
support access, or run as privileged customer erasure.

`npm run store:loadtest` requires a migrated local `_test` database named in
`DATABASE_URL`. It seeds a uniquely named tenant with 10,000 fictional
completed bookings, warms up five times, then measures 50 serial loads and
card-dismiss applies through the store. It prints p50 and p95 in milliseconds
and the document size in bytes, then removes its tenant and audit rows.
The clock lint rule covers the reducer, slot code and store files. The legacy
wall-clock fallbacks each have a narrow exception documenting their caller.

## Step 2 decisions

Adopted 19 November 2026 through the owner's delegation. They replace the first step 2 sketch:

- `tenant_action` gets no UNIQUE constraint on (tenant_id, idempotency_key).
- New table `tenant_idempotency`.
- New table `tenant_effect`.

### 1. Effect sink
- The target is `reduce(state, action, ctx { now, effects })`. Step 2 keeps the reducer signature unchanged.
- The Postgres store stages effects with `withSlotClock(at, () => withDemoChannels(stage, () => prepareAction(...)))`.
- A test guards that `prepareAction` is never async.
- A separate browser PR stages messages in `dispatchWithLog`, then adds the contract case "a refused or conflicting apply records no message" for all stores.

### 2. Effect publishing
- A `tenant_effect` outbox table is written in the same transaction as the state. Columns: tenant_id, seq, n, id, kind, payload, status, attempts, next_attempt_at, delivered_at.
- `apply` drains its own effects after commit. A `SKIP LOCKED` poller retries anything left, with backoff.
- The effect id is the provider's idempotency key.
- `subscribe` uses LISTEN/NOTIFY to signal versions. Listeners re-read.
- Webhooks are a consumer with a cursor over `tenant_action.seq`.
- Test: a crash between commit and drain still delivers the effect exactly once.

### 3. Personal data in the log
- The JSON document is the source of truth; the log is audit only and never rebuilds state. Erasure is in-place redaction.
- The application role may only insert into and select from `tenant_action`. The only updater is a SECURITY DEFINER function `erase_subject(tenant, customerId)`.
- `subject_ids text[]` with a GIN index, computed at commit.
- `customer/delete` erases in the same transaction:
  - redacts by a per-action field map and sets `redacted_at`
  - redacts delivered effect payloads
  - deletes the tenant's idempotency rows
- Fingerprints are HMAC-SHA256 with a server secret.
- Check that `deleteCustomer` also purges `state.log` and trash.
- Backups are kept at most 30 days.
- Test: after deletion, a search of every table finds the name and phone zero times.

### 4. Idempotency
- Keys are per tenant. The HTTP layer prefixes the caller: `<clientId|siteKey|studio>:<key>`.
- One TTL of 24 hours. After expiry or erasure the key is forgotten and the rules run again.
- Table `tenant_idempotency(tenant_id, key, fingerprint_hmac, seq, result jsonb, expires_at, PK(tenant_id, key))`.
- An hourly sweeper deletes expired keys. Keys are at most 200 characters.
- Test with a fake clock: after 24 hours, a replayed booking is rejected and a replayed payment charges once.

### 5. Clock
- The database clock is authoritative.
- Read `clock_timestamp()` after the row lock, and clamp `at` so it never goes before the previous entry.
- Ignore `meta.at` unless `trustCallerClock` is set (tests and imports only).
- The constructor takes `now?: () => Promise<number>`.
- A lint rule bans `Date.now()` in reducer and slot code.
- A health check alerts if the app and database clocks drift more than 2 seconds.

### 6. Demo reset and sandbox
- An admin-only method `replaceState`. `resetDemoTenant()` runs daily under the row lock:
  - increments the version but never resets seq
  - logs a `system/reset` row
  - is a no-op for a date at or before the current fixture's date
- Demo log rows older than 7 days are purged.
- `tenant_state` gets `kind` (salon | demo | sandbox) and `expires_at`.
- Sandbox tenants `sbx_<token hash>_<lifetime UUID>`:
  - created on first write from the day's fixture
  - expire after 24 hours by the database clock, then `load` returns null
  - an hourly sweeper deletes them
- Effects for demo and sandbox tenants go to simulated sinks only, enforced on `kind`.
- The 20-booking cap is enforced in the API layer.

### 7. Document size
- Keep a single document. Record its size and apply duration on every commit.

| Threshold | Size or count | Latency |
|---|---|---|
| Warn | 1 MB or 5,000 bookings | – |
| Act | 2 MB | apply p95 > 50 ms |
| Refuse writes unless they shrink the document, revoke access or erase a customer | 8 MB | – |

- The first projection is a `booking` table written from the diff in the same transaction (a read model for phase-3 lists). When the act threshold is reached, finished and cancelled bookings older than 90 days move out of the document.
- Customers are projected second.
- `state.log` is capped at 100 entries and 200 KB; trash at 50 items and 30 days.
- Load test with 10,000 bookings before the pilot. It also measures load p95 against the 150 ms design target.

### Build order

[S] means a strong model plus a second-model review.
1. [S] Migration: the four tables plus grants.
2. [S] `PostgresStudioStore.load` and `apply`.
3. The contract harness against a disposable database, plus the async-reducer guard.
4. [S] Effect outbox, poller and crash test.
5. [S] Concurrency with real connections: 20 parallel applies, two instances, lock timeout maps to conflict.
6. History paging and LISTEN/NOTIFY.
7. [S] Erasure and the zero-hits test.
8. Idempotency sweeper, expiry tests and caller prefixing.
9. Demo reset, sandbox lifecycle and its sweeper.
10. Size and latency metrics and the 10,000-booking load test. Browser message staging followed as a separate PR.

## Open questions

- **Legacy no-ops.** `dispatch` still reports success for a reducer no-op
  that returns an identical copy (for example a price change for a missing
  treatment). The stores reject it. Fixing `prepareAction` itself would
  change studio toasts.
- **Demo regeneration in the browser.** The sample business regenerates on a
  new day inside the legacy `load`, which the adapter cannot tell apart from
  an edit. Its records survive that until the next reset.
- **Memory store parity.** `MemoryStudioStore` still runs the reducer with
  the caller's times and the process presentation settings. Moving it to
  `withTrustedTimes` and `withTenantPresentation` is a small follow-up, but it
  changes which times the reference store reports.
- **Erasure gaps.**
  - A payment still pending at erasure keeps its payload until it is delivered, and nothing redacts it afterwards. Payment payloads hold no names today.
  - The effect `fingerprint` is a SHA-256 of the full request.
  - `purgeExpired` erases expired trash entries in the document. A future salon trash sweeper still needs to invoke `eraseSubject` for those customers to redact their retained table rows.
  - The browser and memory stores refuse erasure as a plain `apply`. The studio's "Erase permanently" runs `customer/erase` through the browser's own dispatch for the demo and own-browser salons, and through `POST /api/owner/salon/erase` (`eraseSubject`) for account salons.
  - The owner store erases through `erase_subject` when `NODE_ENV=production` (override with `STUDIO_STORE_ERASURE=statements|function`). `erasure: "function"` has not been run under a role without `UPDATE` on `tenant_action`, because the test database cannot create roles.
- **Poller fairness.** A run claims in `(tenant_id, seq, n)` order up to `limit`, so with a large backlog one tenant's rows can delay another's until the next run. Live provider sinks are not wired, so `npm run effects:drain` delivers only demo and sandbox effects for now.
- **Browser dirty checks.** UI comparisons such as the booking-rules draft
  still use `JSON.stringify`. They only see browser state today. Revisit them
  when the studio reads from Postgres.

## Load test result (PostgreSQL 16, 2026-11-20)

`npm run store:loadtest` on a local PostgreSQL 16 `_test` database with 10,000 fictional bookings and 50 samples:
document 2,366,052 bytes; load p50 24.96 ms, p95 33.57 ms; apply p50 157.71 ms, p95 186.23 ms.
This is past the act thresholds (2 MB, apply p95 > 50 ms), so the first projection (a `booking` table written from
the diff, with finished and cancelled bookings older than 90 days leaving the document) is required before a real pilot.
