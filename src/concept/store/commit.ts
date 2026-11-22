import { expectAnswer, newRequestId } from "../account/sync";
import type { DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import { currentTarget, dispatchWithLog, type Workspace } from "../store";
import { BrowserStudioStore, type CommitResult } from "./browser-studio-store";
import type { ApplyMeta } from "./studio-store";

// The studio's commit-result API (docs/design/BROWSER_STORE_IDB.md, PR 3).
// `commitAction` returns the committed outcome with the state that was saved,
// where `dispatch` only says yes or no. Commands are bound to the salon they
// were made for (`Target`): one made for an earlier lifetime of the salon (a
// new sample business, a new day's sample, a removed trial) is `replaced`. It
// runs beside the `dispatch` helpers, on the same localStorage store and under
// the same locks (through `BrowserStudioStore`), until callers have moved.

/** The salon a command was made for: its workspace and the lifetime it had then. */
export interface Target {
  workspace: Workspace;
  epoch: string;
}

export interface CommitOptions {
  meta?: ApplyMeta;
  /** Re-checked against the latest saved state; false refuses the change (`rejected`). */
  guard?: (current: DemoState) => boolean;
  /** Sends that belong to the change but not to its reducer, staged with it; false refuses it. */
  send?: (current: DemoState) => boolean;
  /** This tab's version of the salon (see `BrowserStudioStore`); a newer one is `conflict`. */
  expectedVersion?: number;
  idempotencyKey?: string;
}

export type { CommitResult };

let store: BrowserStudioStore | undefined;

/**
 * An account salon's change is shown at once, as `dispatchWithLog` does, and the result resolves only when
 * the server has answered for this change, found by its idempotency key. The state, version and log id in
 * the result are the server's. A refusal or an unreachable server resolves as a failure, and the sync has
 * already put the server's copy back on screen.
 */
async function commitToAccount(target: Target, action: DemoAction, options: CommitOptions): Promise<CommitResult> {
  const shown = currentTarget();
  if (shown?.workspace !== target.workspace || shown.epoch !== target.epoch) return { ok: false, reason: "replaced" };
  const requestId = options.idempotencyKey ?? newRequestId();
  const waiting = expectAnswer(requestId);
  const localId = dispatchWithLog(action, options.meta, options.guard, { send: options.send, refuseNoOp: true, requestId });
  if (localId === false) {
    waiting.cancel();
    return { ok: false, reason: "rejected" };
  }
  const answer = await waiting.answer;
  if (!answer.ok) return answer;
  // The server's state is the one right after this change, so its newest log entry is this change's when it logs one.
  const logId = localId ? answer.state.log[0]?.id ?? null : null;
  const entry = { seq: answer.version, tenantId: target.workspace, action, actor: options.meta?.actor ?? "owner", source: options.meta?.source ?? "button", at: 0, idempotencyKey: requestId, resultingVersion: answer.version };
  return { ok: true, state: answer.state, version: answer.version, effects: [], entry, replayed: answer.replayed, logId };
}

/**
 * Commits one action to the target salon and resolves with the outcome: the
 * saved state, version, log id and published effects, or why nothing changed.
 * Effects reach the outbox once, after the save.
 */
export function commitAction(target: Target, action: DemoAction, options: CommitOptions = {}): Promise<CommitResult> {
  if (target.workspace === "account") return commitToAccount(target, action, options);
  const { meta = {}, guard, send, expectedVersion, idempotencyKey } = options;
  store ??= new BrowserStudioStore();
  return store.commit(target.workspace, action, meta, { expectedVersion, idempotencyKey }, { epoch: target.epoch, guard, send });
}
