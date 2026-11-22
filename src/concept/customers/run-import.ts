import { normalizePhone } from "../booking/lookup";
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
 * refuses it. An account salon's import counts only when the server accepted it, and the number added is
 * read from the server's state: the customers new in it whose phone number was in the file, so a customer
 * another writer added meanwhile is not counted. A browser salon's import is taken back when its storage
 * refused the write.
 */
export async function runCustomerImport(target: Target, customers: Omit<Customer, "id">[]): Promise<ImportOutcome> {
  if (!sameSalon(target)) return failed;
  const knownIds = new Set(currentState()?.customers.map((c) => c.id));
  const result = await commitAction(target, { type: "customers/import", customers }).catch(() => null);
  if (!result?.ok) return failed;
  if (hasUnsavedChanges()) {
    if (result.logId) await commitAction(target, { type: "log/undo", id: result.logId });
    return { ok: false, reason: "notStored" };
  }
  // Another salon is on screen now: nothing here may report on it.
  if (!sameSalon(target)) return failed;
  const sent = new Set(customers.map((c) => normalizePhone(c.phone)));
  const added = result.state.customers.filter((c) => !knownIds.has(c.id) && sent.has(normalizePhone(c.phone))).length;
  return { ok: true, added, result };
}
