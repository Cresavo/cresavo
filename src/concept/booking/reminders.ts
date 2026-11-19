import { monthKey } from "../data/dates";
import type { DateKey, DemoState } from "../data/types";
import type { MessageChannel } from "./messages";

export interface ReminderSettings {
  channel: MessageChannel;
  /** The per-message rate in the salon currency's minor units. */
  smsPriceOre: number;
}

export const DEFAULT_REMINDER_SETTINGS: Readonly<ReminderSettings> = { channel: "sms", smsPriceOre: 45 };
export const MAX_SMS_PRICE_ORE = 99_999;

export function smsPriceOre(input: string): number | undefined {
  const value = input.trim();
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value)) return;
  return Math.round(Number(value.replace(",", ".")) * 100);
}

export function monthlySmsEstimate(state: Pick<DemoState, "bookings">, today: DateKey, settings: ReminderSettings) {
  const month = monthKey(today);
  const bookings = state.bookings.filter(booking => monthKey(booking.date) === month && booking.status !== "cancelled").length;
  const smsPerBooking = settings.channel === "sms" ? 1 : 0;
  return { bookings, smsPerBooking, totalOre: smsPerBooking * bookings * settings.smsPriceOre };
}
