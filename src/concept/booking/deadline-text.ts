import type { Booking } from "../data/types";
import { t } from "../i18n";
import { formatDate, formatTime } from "../i18n/format";
import { SALON_TIMEZONE } from "../tools/clock";
import { freeCancellationDeadline } from "./policy";

export function freeUntilText(booking: Pick<Booking, "date" | "start">) {
  const deadline = freeCancellationDeadline(booking);
  return t("booking.freeUntil", { day: formatDate(deadline.date), time: formatTime(deadline.time), zone: SALON_TIMEZONE });
}
