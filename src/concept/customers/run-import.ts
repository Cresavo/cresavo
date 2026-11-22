import { reduce, type DemoAction } from "../actions";
import type { Customer } from "../data/types";
import { currentState, currentTarget, hasUnsavedChanges } from "../store";
import { commitAction, type CommitResult, type Target } from "../store/commit";

export type ImportOutcome =
  | { ok: true; added: number; result: Extract<CommitResult, { ok: true }> }
  | { ok: false; reason: "failed" | "notStored" };

const failed: ImportOutcome = { ok: false, reason: "failed" };
const sameSalon = (target: Target) => {
  const shown = currentTarget();
  return shown?.workspace === target.workspace && shown.epoch === target.epoch;
};

/**
 * Imports the customers as one action in the salon the page showed (`target`); a salon replaced meanwhile
 * refuses it. An account salon's import counts only when the server accepted it. The number added is what the
 * reducer adds when it applies the action to the salon as it was at confirmation, never read back from the
 * server's state, where another writer's customers could be mistaken for the import's. A browser salon's
 * import is taken back when its storage refused the write.
 */
export async function runCustomerImport(target: Target, customers: Omit<Customer, "id">[]): Promise<ImportOutcome> {
  const before = currentState();
  if (!before || !sameSalon(target)) return failed;
  const action: DemoAction = { type: "customers/import", customers };
  const added = reduce(before, action).customers.length - before.customers.length;
  const result = await commitAction(target, action).catch(() => null);
  if (!result?.ok) return failed;
  if (hasUnsavedChanges()) {
    if (result.logId) await commitAction(target, { type: "log/undo", id: result.logId });
    return { ok: false, reason: "notStored" };
  }
  // Another salon is on screen now: nothing here may report on it.
  if (!sameSalon(target)) return failed;
  return { ok: true, added, result };
}
