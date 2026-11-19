import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { undoBlockReason, type UndoBlockReason } from "../../log/undo";
import { currentState, dispatch, dispatchWithLog } from "../../store";
import { isBookingOrPaymentAction } from "../../support/action-reference";
import { showActionFailure, showToast } from "../../ui/toast";

const REASON_KEYS = {
  "time-taken": "log.undoTimeTaken",
  "customer-in-use": "log.undoCustomerInUse",
  "gift-card": "log.undoGiftCard",
  "created-changed": "log.undoCreatedChanged",
  "record-in-use": "log.undoRecordInUse",
} as const;

/** The message that explains why an undo is blocked, or undefined when there is nothing specific to say. */
export function undoBlockMessage(reason: UndoBlockReason | null | undefined): string | undefined {
  return reason && reason !== "changed" ? t(REASON_KEYS[reason]) : undefined;
}

export function undoWithToast(id: string): boolean {
  if (dispatch({ type: "log/undo", id })) {
    showToast(t("log.undoneToast"));
    return true;
  }
  const state = currentState();
  const entry = state?.log.find(row => row.id === id);
  const reason = state && undoBlockReason(state, entry);
  const message = undoBlockMessage(reason) ?? t("log.cannotUndo");
  if (entry && isBookingOrPaymentAction(entry.type)) showActionFailure(message);
  else showToast(message);
  return false;
}

export function showUndoToast(message: string, id: ReturnType<typeof dispatchWithLog>, onUndo?: () => void): boolean {
  if (id === false) return false;
  showToast(message, id ? { label: t("common.undo"), run: () => { if (undoWithToast(id)) onUndo?.(); } } : undefined);
  return true;
}

export function dispatchWithUndoToast(action: DemoAction, message: string, meta?: Parameters<typeof dispatchWithLog>[1]) {
  return showUndoToast(message, dispatchWithLog(action, meta));
}
