import { bookingLink, suggestSlot } from "../../customers/return-visits";
import { formatTime } from "../../data/dates";
import type { Customer, DateKey, DemoState, Service } from "../../data/types";
import { t } from "../../i18n";
import { formatDayShort } from "../../i18n/format";
import { dispatch, undo } from "../../store";
import { showToast } from "../../ui/toast";

const SMS_HOST = "salongeko.example";

/** Words for the slot the SMS offers, e.g. "Tue 24 Nov 14:00" with a name. Undefined if nothing is free. */
export function suggestedTime(state: DemoState, customer: Customer, service: Service, today: DateKey) {
  const slot = suggestSlot(state, customer, service, today);
  const staff = slot && state.staff.find((s) => s.id === slot.staffId);
  return slot && staff ? { when: `${formatDayShort(slot.date)} ${formatTime(slot.start)}`, staff: staff.firstName } : undefined;
}

/** Simulated SMS with a ready booking link. It lands in the inbox log; nothing leaves the demo. */
export function sendTimeSuggestion(state: DemoState, customer: Customer, service: Service, today: DateKey, minutes: number) {
  const time = suggestedTime(state, customer, service, today);
  const link = `${SMS_HOST}${bookingLink(state, service.id)}`;
  const vars = { name: customer.firstName, service: service.name.toLowerCase(), link };
  dispatch({
    type: "inbox/add",
    item: {
      kind: "system",
      customerId: customer.id,
      recallServiceId: service.id,
      date: today,
      time: minutes,
      title: t("dueBack.logTitle", { name: customer.firstName }),
      body: time ? t("dueBack.sms", { ...vars, ...time }) : t("dueBack.smsNoSlot", vars),
      read: false,
      handled: true,
    },
  });
  showToast(t("dueBack.toast", { name: customer.firstName }), { label: t("common.undo"), run: undo });
}
