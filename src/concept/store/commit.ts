import type { DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import type { Workspace } from "../store";
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

const store = new BrowserStudioStore();

/**
 * Commits one action to the target salon and resolves with the outcome: the
 * saved state, version, log id and published effects, or why nothing changed.
 * Effects reach the outbox once, after the save.
 */
export function commitAction(target: Target, action: DemoAction, options: CommitOptions = {}): Promise<CommitResult> {
  const { meta = {}, guard, send, expectedVersion, idempotencyKey } = options;
  return store.commit(target.workspace, action, meta, { expectedVersion, idempotencyKey }, { epoch: target.epoch, guard, send });
}
