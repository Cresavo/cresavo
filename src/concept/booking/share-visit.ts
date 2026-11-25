import { t } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import type { DateKey } from "../data/types";

export interface SharedVisit {
  salon: string;
  date: DateKey;
  start: number;
  /** A public address only: never a booking link's token, which would let the receiver change the booking. */
  url: string;
}

/** What the share sheet carries: the day, the time and the salon in one sentence, and the link beside it. */
export function visitShare(visit: SharedVisit): ShareData {
  return {
    title: visit.salon,
    text: t("booking.share.text", { salon: visit.salon, day: formatDayLong(visit.date), time: formatTime(visit.start) }),
    url: visit.url,
  };
}

/**
 * Open the phone's share sheet, or copy the link where there is none. "shared" also covers a sheet the customer
 * closed; "copied" and "failed" are for the caller to say.
 */
export async function shareVisit(visit: SharedVisit): Promise<"shared" | "copied" | "failed"> {
  const data = visitShare(visit);
  if (typeof navigator.share === "function" && navigator.canShare?.(data) !== false) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(visit.url);
    return "copied";
  } catch {
    return "failed";
  }
}
