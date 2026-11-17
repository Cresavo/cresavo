import type { OutgoingText } from "../assistant/actions";
import { formatTime } from "../data/dates";
import type { Customer, DateKey, DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDayShort } from "../i18n/format";
import { bookingLink, suggestSlot } from "./return-visits";

const SMS_HOST = "salongeko.example";

/** Words for the slot the SMS offers, e.g. "Tue 24 Nov 14:00" with a name. Undefined if nothing is free. */
export function suggestedTime(state: DemoState, customer: Customer, service: Service, today: DateKey) {
  const slot = suggestSlot(state, customer, service, today);
  const staff = slot && state.staff.find((s) => s.id === slot.staffId);
  return slot && staff ? { when: `${formatDayShort(slot.date)} ${formatTime(slot.start)}`, staff: staff.firstName } : undefined;
}

/** The simulated SMS that suggests a return visit, with a ready booking link. */
export function timeSuggestionText(state: DemoState, customer: Customer, service: Service, today: DateKey): OutgoingText {
  const time = suggestedTime(state, customer, service, today);
  const vars = { name: customer.firstName, service: service.name.toLowerCase(), link: `${SMS_HOST}${bookingLink(state, service.id)}` };
  return {
    customerId: customer.id,
    recallServiceId: service.id,
    title: t("dueBack.logTitle", { name: customer.firstName }),
    body: time ? t("dueBack.sms", { ...vars, ...time }) : t("dueBack.smsNoSlot", vars),
  };
}

/** The booking page as a link in a text. */
export function bookingPageLink(state: DemoState): string {
  return `${SMS_HOST}/boka/${state.salon.slug}`;
}
