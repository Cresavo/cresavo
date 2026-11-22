import { t } from "../i18n";
import type { LogEntry } from "../log/types";
import { activityCutoff } from "./retention";

/**
 * Activity entries recorded before the retention cutoff keep only their type,
 * time and actor: the summary (which can name a customer) becomes a short
 * generic label (an empty one stays empty, so an entry hardly grows), and the
 * undo data (whole customer records) and the before/after text are dropped.
 * Returns the same array when nothing is old enough, and keeps the identity of
 * entries that are already aged.
 */
export function ageActivityLog(log: LogEntry[], now: number): LogEntry[] {
  const cutoff = activityCutoff(now);
  if (!log.some((entry) => entry.at < cutoff && !entry.aged)) return log;
  return log.map((entry) => {
    if (entry.at >= cutoff || entry.aged) return entry;
    const aged: LogEntry = { ...entry, summary: entry.summary ? t("log.agedEntry") : "", aged: true };
    delete aged.patch;
    delete aged.before;
    delete aged.after;
    return aged;
  });
}
