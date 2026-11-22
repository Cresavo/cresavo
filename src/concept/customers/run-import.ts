import { expectAck } from "../account/sync";
import type { DemoAction } from "../actions";
import type { Customer } from "../data/types";
import { currentState, currentTarget, dispatchWithLog, hasUnsavedChanges } from "../store";
import { commitAction, type CommitResult, type Target } from "../store/commit";

export type ImportOutcome =
  | { ok: true; added: number; logId: string | null; result?: Extract<CommitResult, { ok: true }> }
  | { ok: false; reason: "failed" | "notStored" };

const failed: ImportOutcome = { ok: false, reason: "failed" };

/** An account salon's change is shown at once and sent to the server: it counts as saved only when the server accepts it. */
async function importIntoAccount(target: Target, action: DemoAction, before: number): Promise<ImportOutcome> {
  const shown = currentTarget();
  if (shown?.workspace !== target.workspace || shown.epoch !== target.epoch) return failed;
  const ack = expectAck("customers/import");
  const logId = dispatchWithLog(action);
  if (logId === false) {
    ack.cancel();
    return failed;
  }
  if (!(await ack.result)) return failed;
  return { ok: true, added: (currentState()?.customers.length ?? before) - before, logId };
}

/** A browser salon's change counts as saved only when the write to storage held; otherwise the import is taken back. */
async function importIntoBrowser(target: Target, action: DemoAction, before: number): Promise<ImportOutcome> {
  const result = await commitAction(target, action).catch(() => null);
  if (!result?.ok) return failed;
  if (hasUnsavedChanges()) {
    if (result.logId) await commitAction(target, { type: "log/undo", id: result.logId });
    return { ok: false, reason: "notStored" };
  }
  return { ok: true, added: result.state.customers.length - before, logId: result.logId, result };
}

/**
 * Imports the customers as one action in the salon the page showed (`target`); a salon replaced since then
 * refuses it. `before` is the salon's customer count when the owner confirmed.
 */
export function runCustomerImport(target: Target, customers: Omit<Customer, "id">[], before: number): Promise<ImportOutcome> {
  const action: DemoAction = { type: "customers/import", customers };
  return (target.workspace === "account" ? importIntoAccount : importIntoBrowser)(target, action, before);
}
