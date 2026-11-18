import { sendDemoMessage } from "../../connections/demo";
import { timeSuggestionText } from "../../customers/time-suggestion";
import type { Customer, DateKey, DemoState, Service } from "../../data/types";
import { t } from "../../i18n";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Simulated SMS with a ready booking link. It lands in the inbox log; nothing leaves the demo. */
export function sendTimeSuggestion(state: DemoState, customer: Customer, service: Service, today: DateKey, minutes: number) {
  const { title, body, recallServiceId } = timeSuggestionText(state, customer, service, today);
  const sent = sendDemoMessage({ channel: "sms", to: { customerId: customer.id }, body, reference: `recall-${customer.id}-${service.id}-${today}-${minutes}` });
  if (!sent) return;
  dispatchWithUndoToast({
    type: "inbox/add",
    item: { kind: "system", customerId: customer.id, recallServiceId, date: today, time: minutes, title, body, read: false, handled: true },
  }, t("dueBack.toast", { name: customer.firstName }));
}
