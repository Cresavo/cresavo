import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { undoBlockReason, type UndoBlockReason } from "../../log/undo";
import { serverLogId } from "../../account/sync";
import { accountRequestOfLog, currentState, currentTarget, dispatch, dispatchWithLog, type DispatchOptions } from "../../store";
import { isBookingOrPaymentAction } from "../../support/action-reference";
import { showActionFailure, showToast } from "../../ui/toast";

const REASON_KEYS = {
  "time-taken": "log.undoTimeTaken",
  "customer-in-use": "log.undoCustomerInUse",
  "gift-card": "log.undoGiftCard",
  "created-changed": "log.undoCreatedChanged",
  "record-in-use": "log.undoRecordInUse",
} as const;

/** The message key that explains why an undo is blocked, when there is a specific reason. */
export function undoBlockMessageKey(reason: UndoBlockReason | null | undefined) {
  return reason && reason !== "changed" ? REASON_KEYS[reason] : undefined;
}

/** Explains a refused undo the way `undoWithToast` does, from the latest saved state. */
export function showUndoRefused(id: string) {
  const state = currentState();
  const entry = state?.log.find(row => row.id === id);
  const reason = state && undoBlockReason(state, entry);
  const key = undoBlockMessageKey(reason) ?? "log.cannotUndo";
  if (entry && isBookingOrPaymentAction(entry.type)) showActionFailure(key);
  else showToast(t(key));
}

export function undoWithToast(id: string): boolean {
  if (dispatch({ type: "log/undo", id })) {
    showToast(t("log.undoneToast"));
    return true;
  }
  showUndoRefused(id);
  return false;
}

export function showUndoToast(message: string, id: ReturnType<typeof dispatchWithLog>, onUndo?: () => void): boolean {
  if (id === false) return false;
  const undoable = id && currentState()?.log.find(entry => entry.id === id)?.patch;
  const target = currentTarget();
  const request = id && target?.workspace === "account" ? accountRequestOfLog(id) : undefined;
  // A signed-in salon shows the change with a provisional log id; Undo waits for the server's own id for it, which no other writer's entry can share.
  const run = request && target
    ? () => { void serverLogId(request).then(async (real) => {
        const { undoCommitted } = await import("./commit-toast");
        if (!real) showToast(t("log.cannotUndo"));
        else if (await undoCommitted(target, real)) onUndo?.();
      }); }
    : () => { if (id && undoWithToast(id)) onUndo?.(); };
  showToast(message, id && undoable ? { label: t("common.undo"), run } : undefined);
  return true;
}

/** `guard` and `options` are those of `dispatchWithLog`: re-checks and sends that run against the saved state. */
export function dispatchWithUndoToast(
  action: DemoAction,
  message: string,
  meta?: Parameters<typeof dispatchWithLog>[1],
  guard?: Parameters<typeof dispatchWithLog>[2],
  options?: DispatchOptions,
) {
  return showUndoToast(message, dispatchWithLog(action, meta, guard, options));
}
