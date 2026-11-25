"use client";

import { useServerCopyAt } from "../../account/server-copy";
import { toKey } from "../../data/dates";
import { t } from "../../i18n";
import { formatDayLong, formatTime } from "../../i18n/format";
import { useConnection } from "../../ui/connection";

/** When the calendar on screen was read, said plainly: the time alone today, with the day before that. */
export function updatedText(readAt: number, today: string): string {
  const read = new Date(readAt);
  const time = formatTime(read.getHours() * 60 + read.getMinutes());
  const day = toKey(read);
  return day === today ? t("calendar.offline.updatedAt", { time }) : t("calendar.offline.updatedOn", { day: formatDayLong(day), time });
}

/**
 * A signed-in salon's calendar while the server cannot be reached: the board stays readable as it was last read,
 * and new bookings wait. The sample salon lives in this browser and is always current, so it never says this.
 */
export function useCalendarOffline(account: boolean): { offline: boolean; readAt: number | null } {
  const connection = useConnection();
  const readAt = useServerCopyAt();
  return { offline: account && connection !== "online", readAt };
}

export function CalendarOfflineNote({ offline, readAt, today }: { offline: boolean; readAt: number | null; today: string }) {
  if (!offline || readAt === null) return null;
  return <p role="status" className="mb-3 text-meta text-text-secondary">{updatedText(readAt, today)}</p>;
}
