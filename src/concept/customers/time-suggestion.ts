import { serviceCopy } from "../i18n/salon-eko-copy";
import { customerText } from "../i18n/customer-text";
import type { Locale } from "@/lib/locale";
import type { OutgoingText } from "../assistant/actions";
import type { Customer, DateKey, DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDayShort, formatTime } from "../i18n/format";
import { bookingLink, suggestSlot } from "./return-visits";

const SMS_HOST = "salongeko.example";

/** Words for the slot the SMS offers, e.g. "Tue 24 Nov 14:00" with a name. Undefined if nothing is free. */
export function suggestedTime(state: DemoState, customer: Customer, service: Service, today: DateKey, language?: Locale) {
  const slot = suggestSlot(state, customer, service, today);
  const staff = slot && state.staff.find((s) => s.id === slot.staffId);
  return slot && staff ? { when: `${formatDayShort(slot.date, language)} ${formatTime(slot.start, language)}`, staff: staff.firstName } : undefined;
}

/** The simulated SMS that suggests a return visit, with a ready booking link. */
export function timeSuggestionText(state: DemoState, customer: Customer, service: Service, today: DateKey): OutgoingText {
  const time = suggestedTime(state, customer, service, today, state.localization.language);
  const vars = { name: customer.firstName, service: serviceCopy(service, state.localization.language).name.toLocaleLowerCase(), link: `${SMS_HOST}${bookingLink(state, service.id)}` };
  return {
    customerId: customer.id,
    recallServiceId: service.id,
    title: t("dueBack.logTitle", { name: customer.firstName }),
    body: time ? customerText(state, "dueBack.sms", { ...vars, ...time }) : customerText(state, "dueBack.smsNoSlot", vars),
  };
}

/** The booking page as a link in a text. */
export function bookingPageLink(state: DemoState): string {
  return `${SMS_HOST}/boka/${state.salon.slug}`;
}
