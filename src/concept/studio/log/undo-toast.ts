import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { undoBlockReason, type UndoBlockReason } from "../../log/undo";
import { currentState, dispatch, dispatchWithLog } from "../../store";
import { showToast } from "../../ui/toast";

const REASON_KEYS = {
  "time-taken": "log.undoTimeTaken",
  "customer-in-use": "log.undoCustomerInUse",
  "gift-card": "log.undoGiftCard",
} as const;

/** The message that explains why an undo is blocked, or undefined when there is nothing specific to say. */
export function undoBlockMessage(reason: UndoBlockReason | null | undefined): string | undefined {
  return reason && reason !== "changed" ? t(REASON_KEYS[reason]) : undefined;
}

export function undoWithToast(id: string) {
  if (dispatch({ type: "log/undo", id })) {
    showToast(t("log.undoneToast"));
    return;
  }
  const state = currentState();
  const reason = state && undoBlockReason(state, state.log.find((entry) => entry.id === id));
  showToast(undoBlockMessage(reason) ?? t("log.cannotUndo"));
}

export function dispatchWithUndoToast(action: DemoAction, message: string) {
  const id = dispatchWithLog(action);
  if (id === false) return false;
  showToast(message, id ? { label: t("common.undo"), run: () => undoWithToast(id) } : undefined);
  return true;
}
