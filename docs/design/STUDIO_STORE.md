# Studio store

Status **Step 1 of decision 1** in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).

Studio and server code should read and change a salon through `StudioStore`
(`src/concept/store/studio-store.ts`), not through the browser store directly.
Step 1 defines the interface, wraps the browser store and adds a contract
suite. There is no database yet and the studio behaves as before.

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
  | { ok: false; reason: "conflict" | "rejected" | "idempotency-mismatch" | "not-found"; version? };

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
| Effects after commit | Calls are staged while the reducer runs and published only after the commit, then reported in the result and to subscribers. The memory store stages payments, SMS, email and social posts. The browser store stages payments only, as `dispatchWithLog` does today. |
| Detached values | Results, loaded states, history entries and each subscriber's payload are copies. The store copies the action it receives. Editing any of them never changes what is stored. |
| Append-only log | Each commit appends one `TenantAction` with `seq` 1, 2, 3 and so on. `history` pages it oldest first. The log differs from `state.log`, which is capped at 100 entries, skips unlogged actions such as `card/dismiss`, and supports undo. |
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

## Contract suite

`tests/store-contract/contract.ts` exports `runStudioStoreContract(name, makeStore)`.
`memory.test.ts` and `browser.test.ts` run it against each implementation.
`browser.test.ts` uses a stubbed `window`, as the existing store tests do. It
covers:

- load and apply round trip, and a version increment per commit only
- detached values: edits to results, actions, history pages and one subscriber's payload change nothing stored
- a malformed saved document never makes `load` or `apply` throw
- stale `expectedVersion` returns `conflict`, with no change to state, log or subscribers
- idempotency replay returns the original state, entry, version and effects even after a later commit, and the recording payment sink (`harness.payments`) gets exactly one charge; key reuse with another action returns `idempotency-mismatch`; a refused key is not remembered
- refused actions (unknown booking, taken slot, unknown treatment, a semantic no-op price change) leave everything unchanged and do not use up their keys
- effects only after commit: the sink receives the deposit only after the commit, a listener already reads the committed state, and conflicts and refusals publish nothing
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

`PostgresStudioStore` implements the same interface:

```sql
tenant_state  (tenant_id PK, version bigint, state jsonb, updated_at)
tenant_action (tenant_id, seq bigint, action jsonb, actor, source, at,
               idempotency_key text NULL, resulting_version bigint,
               effects jsonb, fingerprint text NULL,
               PRIMARY KEY (tenant_id, seq),
               UNIQUE (tenant_id, idempotency_key))
```

Each `apply` runs in one transaction:

1. `SELECT … FROM tenant_state WHERE tenant_id = $1 FOR UPDATE` takes the row lock that the memory queue models.
2. If the key exists in `tenant_action`, return the stored result as a replay, or `idempotency-mismatch`. An exact replay needs the state as of `resulting_version`. Store it with the action, or replay the log up to that point.
3. Compare `expectedVersion` with the stored version and return `conflict` on a mismatch.
4. Run `migrateState` and `prepareAction` with a staged ledger, and return `rejected` if the state is unchanged.
5. `UPDATE tenant_state SET state, version = version + 1`, then `INSERT tenant_action`.
6. `COMMIT`, then publish effects and notify, for example with `NOTIFY` or an outbox table that a worker drains.

Run `runStudioStoreContract("PostgresStudioStore", …)` against a disposable
database in `test:integration`. The suite must pass unchanged.

## Open questions for step 2

- **Messages in the browser.** The memory store stages messages through
  `withDemoChannels`. The browser store still lets the reducer record them
  in the shared outbox as before, so a refused browser apply can still
  record a message. Moving it onto staged channels changes the legacy
  `dispatch` path, which step 1 leaves alone.
- **Legacy no-ops.** `dispatch` still reports success for a reducer no-op
  that returns an identical copy (for example a price change for a missing
  treatment). The stores reject it. Fixing `prepareAction` itself would
  change studio toasts.
- **Demo regeneration in the browser.** The sample business regenerates on a
  new day inside the legacy `load`, which the adapter cannot tell apart from
  an edit. Its records survive that until the next reset.
- **Effects outbox.** Should effects be published in-process after `COMMIT`,
  or through a `tenant_effect` outbox table for at-least-once delivery to
  webhooks and providers?
- **Personal data in the log.** `tenant_action.action` contains guest names
  and phone numbers. Customer deletion must redact or crypto-shred those rows
  while the log stays append-only for audit.
- **Idempotency retention.** How long are keys kept, and should a key's scope
  include the caller (agent or client), as `demo-business.ts` scopes proposals?
- **Clock.** `at` and hold expiry come from `meta.at` or the server clock.
  Decide whether the database clock is authoritative.
- **Daily regeneration.** The browser regenerates the sample business each
  day. The demo tenant on the server needs an explicit reset, logged or not.
- **Document size.** The state includes `log` (100 entries) and trash. Decide
  whether to split hot collections, such as bookings, out of the JSONB
  document before load testing.
