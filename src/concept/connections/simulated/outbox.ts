import type { Money, PortName } from "../core";

/** What a simulated adapter "would have sent". Recipients are references or addresses exactly as given; nothing here leaves the process. */
export interface OutboxEntry {
  id: string;
  port: PortName;
  action: string;
  to?: string;
  subject?: string;
  body: string;
  reference?: string;
  cost: Money | null;
}

export interface Outbox {
  /** Idempotent: an entry with a known id is ignored, so replays and React double renders record once. */
  record(entry: OutboxEntry): void;
  list(port?: PortName): OutboxEntry[];
  clear(): void;
}

export function createOutbox(limit = 500): Outbox {
  const entries = new Map<string, OutboxEntry>();
  return {
    record(entry) {
      if (entries.has(entry.id)) return;
      entries.set(entry.id, Object.freeze({ ...entry }));
      while (entries.size > limit) entries.delete(entries.keys().next().value as string);
    },
    list(port) {
      const all = [...entries.values()];
      return port ? all.filter((e) => e.port === port) : all;
    },
    clear() {
      entries.clear();
    },
  };
}
