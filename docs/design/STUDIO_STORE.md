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
| Validation | `apply` runs `prepareAction`, the same reducer and activity log entry as `dispatch`. A refusal or no-op is `rejected` and changes nothing: state, version, log and subscribers. |
| Versions | Every commit increments `version` by exactly one. With `expectedVersion`, a stale version is `conflict` and changes nothing. |
| Serialized applies | Applies to one tenant run one at a time. Without `expectedVersion` the reducer decides against the latest state, so two bookings for one slot never both succeed. |
| Idempotency | Keys are scoped per tenant. The same key and the same action (canonical JSON) return the first result with `replayed: true`. The reducer does not run again and effects are not published again. The same key with another action is `idempotency-mismatch`. Refused applies are not remembered, so a retry runs the rules again. |
| Effects after commit | Payment calls are staged while the reducer runs, as in `dispatchWithLog`. They are published only after the commit, then reported in the result and to subscribers. |
| Append-only log | Each commit appends one `TenantAction` with `seq` 1, 2, 3 and so on. `history` pages it oldest first. The log differs from `state.log`, which is capped at 100 entries, skips unlogged actions such as `card/dismiss`, and supports undo. |
| Isolation | One tenant's state, log, idempotency keys, effects and notifications are never visible through another tenant's ID. |
| Migration | `load` returns the state at `DEMO_VERSION` and runs `migrateState` on an older saved document first. |

## Implementations

- **`MemoryStudioStore`** (`src/concept/store/memory-studio-store.ts`) is the
  reference. It has plain memory, an injectable clock and one simulated
  payment ledger per tenant, and copies seeds through JSON as a database
  would. It migrates seeds when they are first read. A per-tenant promise queue
  serializes applies, modelling the row lock.
- **`BrowserStudioStore`** (`src/concept/store/browser-studio-store.ts`)
  wraps the existing store. It calls `latestState`, which is a new read-only
  export, plus `dispatchWithLog` and `withBookingLock`. Storage keys, the
  cross-tab receipts and every existing code path are unchanged. Its tenant
  IDs are the workspaces `"demo"` and `"own"`. A tab serves only the workspace
  it has open, and the other workspace is `not-found`. The adapter keeps its
  version, log and keys in the tab's memory under no storage key, so versions
  are tab-local. A write picked up from legacy `dispatch` or another tab
  increments the version and notifies subscribers, without a log entry. The
  version check runs inside `dispatchWithLog`'s guard after it rereads
  storage, so a stale tab gets `conflict`. Without a version, the slot rules
  run against the other tab's write.

## Contract suite

`tests/store-contract/contract.ts` exports `runStudioStoreContract(name, makeStore)`.
`memory.test.ts` and `browser.test.ts` run it against each implementation.
`browser.test.ts` uses a stubbed `window`, as the existing store tests do. It
covers:

- load and apply round trip, and a version increment per commit only
- stale `expectedVersion` returns `conflict`, with no change to state, log or subscribers
- idempotency replay returns the same entry, version and effects, with one log entry and one notification; key reuse with another action returns `idempotency-mismatch`; a refused key is not remembered
- refused actions (unknown booking, taken slot, unknown treatment) leave everything unchanged
- effects only after commit: a deposit payment is published once, a listener already reads the committed state, and conflicts and refusals publish nothing
- two concurrent applies for one slot: one wins, and the other is `rejected` without a version or `conflict` with one
- cancel then rebook the same slot; a second cancel is refused
- customer deletion removes the customer from a later load
- history ordering, actor, versions and pagination with `after` and `next`
- tenant isolation of state, log, idempotency keys and notifications
- migration of a v20 save that keeps the owner's edits

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
               effects jsonb, PRIMARY KEY (tenant_id, seq),
               UNIQUE (tenant_id, idempotency_key))
```

Each `apply` runs in one transaction:

1. `SELECT … FROM tenant_state WHERE tenant_id = $1 FOR UPDATE` takes the row lock that the memory queue models.
2. If the key exists in `tenant_action`, return the stored result as a replay, or `idempotency-mismatch`.
3. Compare `expectedVersion` with the stored version and return `conflict` on a mismatch.
4. Run `migrateState` and `prepareAction` with a staged ledger, and return `rejected` if the state is unchanged.
5. `UPDATE tenant_state SET state, version = version + 1`, then `INSERT tenant_action`.
6. `COMMIT`, then publish effects and notify, for example with `NOTIFY` or an outbox table that a worker drains.

Run `runStudioStoreContract("PostgresStudioStore", …)` against a disposable
database in `test:integration`. The suite must pass unchanged.

## Open questions for step 2

- **Messages are not staged.** `sendDemoMessage` (confirmations, waitlist
  texts, assistant texts) and campaign posts record to the global outbox from
  inside the reducer. A refused or conflicting apply can still record a
  message. Staging these like payments, so the reducer takes an effect sink,
  would make "effects after commit" hold for all effects.
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
