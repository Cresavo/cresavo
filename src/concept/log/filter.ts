import type { LogActor, LogEntry, LogSource } from "./types";

export interface LogFilter {
  actor?: LogActor;
  source?: LogSource;
}

export function filterLog(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  return entries.filter((e) => (!filter.actor || e.actor === filter.actor) && (!filter.source || e.source === filter.source));
}

/** The distinct values present in the log, in the order they first appear. */
export function present<K extends "actor" | "source">(entries: LogEntry[], key: K): LogEntry[K][] {
  return [...new Set(entries.map((e) => e[key]))];
}
