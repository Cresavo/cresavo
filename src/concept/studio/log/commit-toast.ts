import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { commitAction, type CommitOptions, type CommitResult, type Target } from "../../store/commit";
import { showToast } from "../../ui/toast";
import { showUndoRefused } from "./undo-toast";

// The commit-result counterparts of `undo-toast.ts`: Undo is bound to the
// salon the change was made in (docs/design/BROWSER_STORE_IDB.md, PR 3).

/**
 * Takes back a change in the salon it was made in; a replaced salon refuses it.
 * The reason is looked up in the log only while that salon is still the open
 * one: log ids repeat across salons, so another salon's entry says nothing.
 */
export async function undoCommitted(target: Target, id: string): Promise<boolean> {
  const result = await commitAction(target, { type: "log/undo", id });
  if (result.ok) showToast(t("log.undoneToast"));
  else if (result.reason === "replaced" || result.reason === "not-found") showToast(t("log.cannotUndo"));
  else showUndoRefused(id);
  return result.ok;
}

/**
 * Commits an action and shows `message` with Undo when the saved change can
 * be taken back. Resolves with the commit's result; nothing is shown on refusal.
 * Undo is bound to the same target, so it never reaches a replacement salon.
 */
export async function commitWithUndoToast(target: Target, action: DemoAction, message: string, options?: CommitOptions & { onUndo?: () => void }): Promise<CommitResult> {
  const result = await commitAction(target, action, options);
  if (!result.ok) return result;
  const { logId } = result;
  const undoable = logId && result.state.log.find(entry => entry.id === logId)?.patch;
  showToast(message, logId && undoable ? { label: t("common.undo"), run: () => { void undoCommitted(target, logId).then((done) => { if (done) options?.onUndo?.(); }); } } : undefined);
  return result;
}
