import type { DemoAction } from "../../actions";
import { t } from "../../i18n";
import { undoBlockReason } from "../../log/undo";
import { currentState, dispatch, dispatchWithLog } from "../../store";
import { showToast } from "../../ui/toast";

export function undoWithToast(id: string) {
  if (dispatch({ type: "log/undo", id })) {
    showToast(t("log.undoneToast"));
    return;
  }
  const state = currentState();
  const reason = state && undoBlockReason(state, state.log.find((entry) => entry.id === id));
  showToast(t(reason === "time-taken" ? "log.undoTimeTaken" : "log.cannotUndo"));
}

export function dispatchWithUndoToast(action: DemoAction, message: string) {
  const id = dispatchWithLog(action);
  if (id === false) return false;
  showToast(message, id ? { label: t("common.undo"), run: () => undoWithToast(id) } : undefined);
  return true;
}
