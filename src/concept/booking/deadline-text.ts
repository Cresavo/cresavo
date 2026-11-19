import type { Booking } from "../data/types";
import { t } from "../i18n";
import { formatDate, formatTime } from "../i18n/format";
import { SALON_TIMEZONE } from "../tools/clock";
import { deadline, FREE_CHANGE_HOURS } from "./policy";

export function freeUntilText(visit: Pick<Booking, "date" | "start" | "protection">,
  freeHours = visit.protection?.terms.freeHours ?? FREE_CHANGE_HOURS, instant = Date.now()) {
  const cutoff = deadline(visit, freeHours);
  if (instant > cutoff.toMillis()) return t("protection.alreadyLate", { hours: freeHours });
  return t("booking.freeUntil", { day: formatDate(cutoff.toISODate()!), time: formatTime(cutoff.hour * 60 + cutoff.minute), zone: SALON_TIMEZONE });
}
