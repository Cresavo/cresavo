# Browser store on IndexedDB

Status **accepted** (owner decisions of 20 Nov 2026 after a second-model review; PR 1 in progress). It replaces the browser half of [STUDIO_STORE.md](STUDIO_STORE.md) and the multi-tab machinery on `feat/waitlist-offers-v2` (preview overlay, Web Lock commits, per-tab journals, op ids, salon generations, receipts).

**The idea.** Each salon stays one snapshot and the reducer stays as it is. Every change commits in **one IndexedDB `readwrite` transaction**: read the salon, run the synchronous reducer, write the result. The browser serializes overlapping `readwrite` transactions across all tabs of the origin, so two tabs can no longer overwrite each other. The UI updates and staged effects are published only after the transaction's `complete` event.

## 1. Current write paths (main, 20 Nov 2026)

All salon state lives in `src/concept/store.ts` as JSON text in localStorage: `salong-eko-demo`, `salong-eko-demo-<workspace>` and `…-own-last-used`. The tab's selected workspace is in `sessionStorage`. Counts exclude `store.ts` itself.

| Path | Where | Count |
| --- | --- | --- |
| `dispatch(action)` → boolean | UI handlers | 44 calls in 29 files (about 25 use the result) |
| `dispatchWithLog(action, meta, guard)` → log id \| null \| false | UI, `undo-toast`, assistant, inbox agents, `BrowserStudioStore` | 16 calls in 13 files |
| `dispatchWithUndoToast` / `showUndoToast` (wrap `dispatchWithLog`) | studio sheets and lists | 49 + 8 calls in 38 files |
| `withBookingLock(() => dispatch…)` (Web Lock + Cache Storage receipt) | booking pages, booking sheets, fee decision, deposit checkout | 12 uses in 7 files |
| `withAddressLock` (cross-workspace slug lock) | address section, `BrowserStudioStore` | 4 uses in 2 files |
| `startBusiness` (new sample business / reset) | welcome flow, advanced settings | 3 uses |
| `switchSalon("own", draft)` (creates the trial salon), `switchSalon` | wizard, entry, trial notice | 3 uses |
| `deleteTrialSalon`, `expireIdleTrial` (on init), `markTrialUsed` (every studio navigation) | trial notice, `initialize`, studio shell | 3 |
| Writes on read inside `load()`: demo regenerated on a new day, expired checkout holds dropped, `purgeExpired` erasure written back by `persistErasure` | `refresh` | 1 path, runs on every storage read |
| `BrowserStudioStore.apply` (via `dispatchWithLog` + both locks + its own receipt cache) | contract, future callers | 1 |

Notifications: `useDemo` (6 files), `usePublicDemo` (6), `useWorkspaceSlug` (4) and `useTrialRemoved` use `useSyncExternalStore` over a module listener set. Cross-tab changes arrive through the `storage` event (`onStorage`) and are re-read lazily (`refreshFromStorage`) before writes. `subscribeStore` and `onSalonRemoved` bridge to `BrowserStudioStore`.

Sync reads right after a dispatch (`currentState()` used as the commit's result): `deposit-checkout.tsx:63` (new booking), `details-step.tsx:81` (new hold or booking), `booking-actions.tsx:116` (moved booking), `undo-toast.ts:26,37`, `assistant/reply-actions.ts:54`, `assistant/use-assistant.ts:81`, `campaign-studio.tsx:55` (new campaign), `giftcards/sell-sheet.tsx:35` (new card), `waitlist-sheet.tsx:72` (new contact). That is 10 sites in 9 files. Four more (`ops/role.ts`, `ui/action-failure.tsx`, `assistant/thread-store.ts`, `service-sheet.tsx:53`) only read the current salon and can stay sync.

Effects: payments are staged (`demoPaymentLedger.stage()`) and published after the save. Messages are still recorded **inside** the reducer straight into the shared in-memory `demoOutbox`. Two UI handlers even send before dispatching: `inbox-detail.tsx:120` and `today/suggestions.tsx:45` (`textWaitlistAbout*`).

Not salon state, out of scope: theme, role, tour flag, guest opt-in, pairing session, assistant threads (all localStorage, per device).

## 2. Target design

### Database

One database `concept-store`, schema version 1, two object stores with explicit keys:

| Store | Key | Value |
| --- | --- | --- |
| `salons` | `"demo"` \| `"own"` | `{ version, epoch, doc }` |
| `meta` | `"lastUsed:own"`, `"imported"` | the trial's last use (epoch ms); the import marker `{ at, primary }` |

- `doc` is the **JSON text** of `DemoState`, byte for byte what localStorage holds today. That keeps today's JSON semantics (no `undefined` keys, `jsonEqual` behaviour), makes the import a copy and every read a detached `JSON.parse`.
- `version` increments by one on every commit. Unlike today it is shared by all tabs, so `expectedVersion` means the same thing in every tab. `DemoState.seq` is unchanged and still drives log ids.
- `epoch` is a random id, new whenever a salon is created or replaced (sample business, reset, new-day regeneration, trial creation). It lives outside `DemoState`, so there is no migration. It replaces the branch's `generation`.
- `lastUsed:own` is separate so `markTrialUsed` never rewrites the salon or wakes other tabs.

### One write primitive

`src/concept/store/salon-db.ts` (IndexedDB, opening and fallback) and `memory-salon-db.ts` (fallback and tests) implement one interface from `salon-tx.ts`. The import is in `salon-import.ts`.

```ts
interface SalonDb {
  read(workspace): Promise<SalonRecord | null>;
  /** One readwrite transaction. Reads only what `scope` names, runs `change` synchronously, then writes what it staged. */
  write<T>(scope: { salons?: Workspace[]; exists?: Workspace[]; meta?: string[] }, change: (tx: SalonTx) => T): Promise<WriteResult<T>>;
  subscribe(listener: (change: { workspace; record: SalonRecord | null }) => void): () => void;
}
```

- `write` issues the scoped `get`s, plus `count`s for `exists`, which reads no document. It calls `change` in the callback of the last one, using plain callbacks and no `await`: awaiting anything that is not an IDB request lets the transaction auto-commit. `change` only stages `putSalon`/`deleteSalon`/`putMeta` on `tx`. The core issues every `put` and `delete` in that same final callback. A `change` that returns a thenable or throws aborts the transaction and writes nothing. A write started from inside a `change` is refused with `ReentrantWriteError` in both adapters.
- It resolves only on `complete`. `abort` and `error` (quota included) resolve `{ ok: false, reason: "storage" }`, and every such failure also reaches one store-level `onStorageFailure` listener. The store shows `showActionFailure` from that listener, so a quota abort is visible even for `void dispatch(...)` callers.
- After `complete` the core posts `{ workspace, version, epoch }` (or `deleted`) for every changed salon on `BroadcastChannel("concept-store")`, before any local subscriber runs. `subscribe` delivers changes from this connection at once and other tabs' changes after re-reading.
- Scope stays small. `markTrialUsed` reads `exists: ["own"]` and `meta: ["lastUsed:own"]` only. A commit reads its own salon, plus the other salon only for actions that can change the address (`salon/slug`, `log/undo`, `trash/restore`) and for trial creation.

### Targets and commit

Every command is bound to the salon it was rendered from: `Target = { workspace, epoch }`. Forms, booking pages, undo toasts, assistant cards and the trial notice's delete and renew buttons capture the target when they render or are created. Without it, a toast holding `logId` `l-12` could undo `l-12` in a replacement salon.

Until the backend switch (PRs 3–5), `commitAction` (`src/concept/store/commit.ts`) runs through `BrowserStudioStore.commit` on localStorage, under the existing locks. There the epoch is a random id saved in the same localStorage value as the salon, as a top-level `epoch` field that loading strips. No tab can therefore read a new salon with an old lifetime, and a replacement that cannot be saved keeps its new lifetime in memory with it. It is set when a sample business or trial salon is created. The sample business adds its day, and a salon saved earlier has the lifetime `legacy` (or one from a separate `-epoch` key, which the next save moves into the value). The commit API refuses a content-identical change before any of its sends run. A page takes its target with `targetOf(state)` from the state it rendered, never from a fresh read; freshness is checked only when committing. Reading a new lifetime ends the earlier salon's send records and commit history, as removing it does. Versions are this tab's, as in `BrowserStudioStore`. Specs read stored salons only through `salonState` in `tests/concept-e2e/fixtures.ts`. `editSalon` follows when a spec needs it. The import in PR 6 takes the record's epoch from the value's `epoch` field and also removes any `-epoch` keys.

```ts
commitAction(target, action, { meta?, guard?, expectedVersion? }): Promise<
  | { ok: true; state; version; logId: string | null; effects: OutboxEntry[] }
  | { ok: false; reason: "rejected" | "conflict" | "replaced" | "not-found" | "newer-version" | "storage" }>;
```

Inside the one transaction, in order:

1. Load the record and run `migrateState`. A document whose `version` is above `DEMO_VERSION` (after a rollback) is `newer-version` and never overwritten. A missing record is `not-found`.
2. **Normalize** with today's `load()` logic as a pure function: drop expired checkout holds, run `purgeExpired`, and regenerate the demo on a new day with a new epoch.
3. If the epoch differs from the target's, the result is `replaced`. If `expectedVersion` is stale, it is `conflict`. Then run `guard` against the normalized state. The lead-time check in `details-step.tsx`, which today runs before the lock, moves into this guard.
4. Run `withSlotClock(now, () => withDemoChannels(stage, () => prepareAction(...)))`. `stage` comes from the `channelLedger` for this `workspace:epoch`. A ledger is created per salon lifetime and dropped when its epoch ends, so payment and message keys never carry over to a replacement salon. A no-op (`next === current` or `sameContent`) is `rejected`.
5. For address-changing actions, check the slug against the other salon read in the same transaction. This replaces `withAddressLock`.
6. Stage `{ version + 1, epoch, doc }` and, for `"own"`, `lastUsed:own`.

**Normalization persists on refusal.** If step 2 changed the document (new day, expired holds, erasure) but step 3 or 4 refuses, the transaction still writes the normalized document (version + 1) and returns the refusal: `replaced` when the epoch changed. The action's staged effects are discarded and subscribers refresh. Without this, every retry after midnight would regenerate and refuse again, and an erasure would be undone by a refused click.

After `complete`: update the tab's cache, `stage.publish()` (payments, SMS, email and posts reach the outbox only now), notify React listeners, then resolve. On `abort` nothing is published and the cache is untouched.

The other salon mutations are `write`s with their own small `change`:

- opening a workspace: normalize and persist, including the erasure that `persistErasure` does today;
- `startBusiness`;
- trial creation in `switchSalon`, with the slug checked in the same transaction;
- `deleteTrialSalon` and renewal, bound to the target epoch;
- `expireIdleTrial`, which reads `lastUsed:own` and deletes in one transaction;
- `markTrialUsed`, which writes meta only.

### Opening, fallback and lifecycle

- `indexedDB.open` resolves to one of four states, kept in a store status that the UI reads:
  - **Open.** `onsuccess`.
  - **Waiting.** While the open is slow or `blocked` (another tab holds an older schema), pages keep their loading shell. `blocked` adds "Close other demo tabs or reload". A slow open is never treated as unavailable.
  - **Unavailable, confirmed.** `indexedDB` is missing, `open` throws, or `onerror` fires (`SecurityError`, `InvalidStateError`, private-mode denial). Only then does the tab use `MemorySalonDb`, seeded once from any legacy localStorage text, read only and never written back. A connection that succeeds after this choice is closed at once.
  - **Outdated.** `onversionchange`, or a `VersionError` on open (another tab already upgraded), closes the connection and shows a reload notice. It is never memory.
  - **Failed.** Once a handle has used IndexedDB, a failed reopen is reported as `storage` and never switches to memory mid-session. A later `reopen()` retries.
  - **Closed.** `close()` rejects operations still waiting for an open with `SalonDbClosedError`, and later operations fail at once. An upgrade it had requested is aborted, whether it was still blocked or already under way, so it never leaves a newer schema behind.
  - `reopen()` starts the replacement open at once, so a retry reaches `open` or `failed` on its own.
- The backend is installed before any open starts, and a connection before its channel is set up. Every user callback (status, subscribers, storage failures, listener-error reports, in both adapters) runs later from one ordered queue, never inside an open, fallback, settle, close or write completion. Only `write`'s `change` runs synchronously, by design.
- `close()` refuses new operations at once. A write already in its transaction still commits and broadcasts, and the channel closes after the last one.
- Subscriber, status and channel errors are isolated: a write resolves with its real outcome, and the errors go to `onListenerError`.
- On bfcache `pageshow` (`persisted`), or after the browser closed the connection (`close` event), the store reopens and re-reads **both** workspaces. A record that disappeared meanwhile clears the cache and fires `onSalonRemoved`.
- **Memory mode** shows a visible notice on the studio and on the public booking page: "This browser does not let the demo save. Changes last until you close this tab." One tab's JavaScript is single-threaded, so memory commits are just as atomic and waitlist offers stay on. Tabs do not share data, so they cannot overwrite each other. The old localStorage write path is removed rather than kept as a second mode.

### Cross-tab notification and React

- The module keeps one cache per workspace: `{ version, epoch, state }`. `useDemo`'s `getSnapshot` returns it, or `null` before the first read. The studio and booking pages already render a loading shell for `null`.
- Receivers accept a broadcast only for a higher version, a new epoch or a deletion, so updates are monotonic whatever the arrival order. A re-read also runs on `visibilitychange`.
- The `storage` listener for salon keys, `refreshFromStorage`, `latestState`'s lazy re-read and the receipt caches go away with the backend switch.

### Converting call sites

- Existing helpers keep their return types until their callers move. A **parallel** async API (`commitAction`, `commitWithUndoToast`) returns the full result with the committed state, since a `Promise<boolean>` cannot supply it. Callers migrate in batches, then the old helpers become thin wrappers over it.
- The 10 post-dispatch `currentState()` reads take `result.state`. Its `at(-1)` is this commit's own record, because the state is the one this transaction wrote.
- A small `useCommit()` hook (`[run, pending]`) disables the button while a commit is in flight, only where a double click would create two records: booking, deposit pay, gift card sale, campaign, waitlist join (about 10 sites).
- There is no preview: the screen changes when the commit completes. Controlled inputs already edit local drafts.
- `withBookingLock` and `withAddressLock` stay in place while callers migrate, and are removed together with the backend switch.

### Undo, history, idempotency, locks

- **Undo** is the ordinary `log/undo` action, bound to its target. It runs inside the transaction against the latest state, so the undo-integrity checks (slot taken, card spent) see other tabs' commits and holds.
- **`BrowserStudioStore`** becomes a thin adapter over `commitAction`. Its `version` is the record's. History and idempotency keys are in memory per `workspace:epoch` and end with the epoch. Applies with the same key are serialized per tenant, so a concurrent retry waits and then replays once. Payments and messages are reported as effects.
- **Web Locks** are not used for salon state after the switch. Transactions serialize writes.

## 3. Migration

- **Import once.** The first open runs one import `write` over both salons and `meta: ["imported"]`.
  - If the `imported` marker exists, nothing is imported, ever. Legacy keys that reappear (an old tab, Playwright's `addInitScript`) are just removed, so they can never resurrect a deleted trial salon.
  - Otherwise it imports each legacy key (`salong-eko-demo`, `-demo`, `-own`, both `-last-used` variants), deciding the workspace by `industry` as `load` does today. It writes the marker `{ at, primary }` in the same transaction.
  - If any legacy key cannot be read, nothing is written and nothing is removed, so the next open retries. Each workspace comes from the unsuffixed key when it holds that kind of salon, otherwise from its suffixed key, so a demo under `-demo` survives the removal of a primary trial salon. A legacy key is removed only once its workspace is in the database, or when it held nothing the old store would have opened.
  - `primary` keeps `initialize()`'s rule: `"own"` when the old unsuffixed key held the trial salon. A tab without a `sessionStorage` selection opens the primary workspace if it exists, otherwise the demo.
  - After `complete` the tab removes the legacy keys and the Cache Storage receipts (`concept-booking-sequence`, `concept-studio-store`). Two tabs racing the import are serialized, and the second sees the marker.
- **DEMO_VERSION.** It is independent of the database schema version. `migrateState` runs on read and inside each commit, and the migrated text is written on the next commit or on open. Schema upgrades use `onupgradeneeded`.
- **Rollback.** Accepted: after the import, a rollback to a localStorage release shows a fresh sample business and loses a trial salon. The legacy keys are not kept, because a frozen copy would outlive customer erasure. A record newer than the code's `DEMO_VERSION` is never overwritten.
- **Vitest.** **`fake-indexeddb` 6.2.7** is an exact-pinned devDependency: Apache-2.0, compatible with AGPL-3.0-only, no runtime dependencies, and not shipped. Core tests run on separate fake connections. `MemorySalonDb` runs the same core suite.
- **Playwright.**
  - Seeding through `addInitScript` keeps working for the first load of a fresh profile via the import.
  - Reads and mid-test edits (`state(page)` in 6 specs, plus direct edits, about 57 lines in 12 specs) move to `salonState(page, workspace)` and `editSalon(page, workspace, edit, { lastUsed })` in `tests/concept-e2e/fixtures.ts`. They are introduced over localStorage first, so the swap is one file.
  - A WebKit project runs the store specs: two tabs, bfcache restore, and suspension/resume.

## 4. Guarantees

Each guarantee gets a unit test on two fake-indexeddb connections and a two-tab Playwright test:

1. **An offer SMS only after its hold commits.** The text is staged during the reducer and published on `complete`. A refused, conflicting, replaced or aborted commit sends nothing. Contract case: "a refused or conflicting apply records no message" (all stores).
2. **Claims re-check and consume atomically.** `online/claim` runs inside the transaction against the latest state. Checking that the offer is open and the slot is free, booking, and marking the offer consumed are one `put`. The second of two concurrent claims sees it consumed and is `rejected`.
3. **Booking, reschedule and undo respect holds.** They are reducer actions in the same serialized transactions, so `isFree`/`activeHolds` always see the latest holds and offers. Clock-driven `waitlist/advance` ticks from several tabs are ordinary commits: a tick that finds nothing due is a `rejected` no-op.

**Durability.** Default transaction durability is used. A commit is atomic and visible to other tabs on `complete`. An OS crash could lose the last commit together with its simulated, in-memory SMS, which is acceptable for a demo because the state is the source of truth. Quota and I/O failures abort the transaction and are surfaced as described above. The store never switches to memory mid-session.

## 5. PR plan

Each PR is green on `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` and `npm run test:concept`.

| PR | Content | Sites touched |
| --- | --- | --- |
| 1. Storage core | `SalonDb`, IndexedDB and memory adapters, open states, import with marker, broadcast, `fake-indexeddb` 6.2.7. Unit tests cover atomic read-modify-write on two connections, no await inside a transaction, import once, epoch replacement and refusal with normalization. Nothing in the app uses it yet. | 0 |
| 2. Stage messages | `dispatchWithLog` stages with `channelLedger` and publishes after the save. The two early waitlist SMS sends move after their commit. Contract case "no message on refusal". | ~5 |
| 3. Commit-result API | `commitAction` and `commitWithUndoToast` beside the old helpers, on the localStorage backend and under the existing locks, with `Target` binding. Add `useCommit`, plus e2e helpers over localStorage. | ~3 + helpers |
| 4. Booking, payment, undo callers | Booking pages, deposit checkout, fee decision, booking sheets, undo toasts, assistant replies. The `details-step.tsx` lead-time check moves into the guard. | ~30 |
| 5. Studio callers | The remaining `dispatch*`/`dispatchWithUndoToast` sites, possibly split by folder. The old helpers become wrappers. | ~85 |
| 6. Backend switch | `store.ts` on `SalonDb`: commit and normalize transactions, trial lifecycle, import, broadcast, fallback notices. Remove the locks and receipts in the same PR, and rewrite `BrowserStudioStore`. Swap the e2e helper internals, and add the two-tab and WebKit specs. Update `STUDIO_STORE.md` and `CHANGELOG.md`. | ~20, 11 test files |
| 7. Waitlist offers | Rebase `feat/waitlist-offers-v2`, dropping its overlay, journals, receipts, `generation`, op ids and lock code. Add the three guarantee tests. | branch-sized |

**Risks.**
- An accidental `await` inside a transaction commits it early. Callbacks only, the thenable refusal, a source guard test and the sync-reducer guard cover it.
- PRs 4 and 5 touch toasts everywhere. They are mechanical, and the locks and backend are unchanged while they land.
- A tab running old code during the deploy may write legacy keys after the import. Those edits are dropped by design.
- `useDemo` is `null` for one async read on first paint.
- Two dispatches in a row (`service-sheet.tsx:59-60`, the assistant's effect loop) stay two commits, as today.

## 6. Owner decisions (20 Nov 2026)

1. Rollback loss of a trial salon is accepted.
2. Memory fallback is tab-only, with offers on and a visible notice on the public booking page and the studio. It is used only for confirmed unavailability.
3. `fake-indexeddb` is pinned at exactly 6.2.7 as a devDependency. Real WebKit Playwright coverage for the store is planned.
4. History and idempotency stay in memory per workspace and epoch. Concurrent applies with the same key are serialized.
5. The `dispatch*` wrappers stay. Direct `StudioStore.apply` adoption is deferred.
