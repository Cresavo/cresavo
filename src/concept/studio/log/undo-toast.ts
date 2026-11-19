import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { undoBlockReason, type UndoBlockReason } from "../../log/undo";
import { currentState, dispatch, dispatchWithLog } from "../../store";
import { showToast } from "../../ui/toast";

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
  const reason = state && undoBlockReason(state, state.log.find((entry) => entry.id === id));
  showToast(undoBlockMessage(reason) ?? t("log.cannotUndo"));
  return false;
}

export function showUndoToast(message: string, id: ReturnType<typeof dispatchWithLog>, onUndo?: () => void): boolean {
  if (id === false) return false;
  const undoable = id && currentState()?.log.find(entry => entry.id === id)?.patch;
  showToast(message, id && undoable ? { label: t("common.undo"), run: () => { if (undoWithToast(id)) onUndo?.(); } } : undefined);
  return true;
}

export function dispatchWithUndoToast(action: DemoAction, message: string, meta?: Parameters<typeof dispatchWithLog>[1]) {
  return showUndoToast(message, dispatchWithLog(action, meta));
}
