// The activity log: every change to the demo records who did it, what, and
// enough to take it back. Captured centrally in `capture.ts`, not per page.

/** Who made the change. */
export type LogActor = "owner" | "staff" | "ai" | "customer" | "integration";

/** Where the change came from. */
export type LogSource = "button" | "command" | "voice" | "customer-page" | "campaign" | "mcp" | "assistant";

export interface LogMeta {
  actor: LogActor;
  source: LogSource;
  /** Epoch milliseconds. */
  at: number;
}

/** A record that can be restored: anything in a collection has an id. */
export interface Item {
  id: string;
}

export interface CollectionPatch {
  /** Ids the change created. */
  added: string[];
  changed: { before: Item; after: Item }[];
  removed: { index: number; item: Item }[];
}

/** What a change did to the state, kept so it can be taken back. */
export interface StatePatch {
  collections: Record<string, CollectionPatch>;
  values: Record<string, { before: unknown; after: unknown }>;
}

export interface LogEntry extends LogMeta {
  id: string;
  /** The action type, e.g. "booking/move". */
  type: string;
  summary: string;
  /** Short before/after text such as "Thu 19 Nov 10:00". */
  before?: string;
  after?: string;
  /** Present when the change can be undone. */
  patch?: StatePatch;
  undone?: boolean;
}
