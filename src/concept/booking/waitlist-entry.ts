import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayShort, formatTime } from "../i18n/format";
import { findService } from "../selectors";
import type { WaitlistEntry } from "./waitlist-types";

/** "Medical pedicure · Anna · Thu 19 Nov, Fri 20 Nov · any time", for the studio and the customer's own page. */
export function entrySummary(state: Pick<DemoState, "services" | "retiredServices" | "staff">, entry: WaitlistEntry): string {
  if (!entry.serviceId) return t("offers.legacy");
  const person = state.staff.find((p) => p.id === entry.staffId)?.firstName ?? t("offers.anyStaff");
  const window = entry.window.start === 0 && entry.window.end === 1440
    ? t("offers.anyTime")
    : `${formatTime(entry.window.start)}–${formatTime(entry.window.end)}`;
  return [findService(state, entry.serviceId)?.name, person, entry.days.map((day) => formatDayShort(day)).join(", "), window].filter(Boolean).join(" · ");
}
