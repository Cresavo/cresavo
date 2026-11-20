// The activity log: every change to the demo records who did it, what, and
// enough to take it back. Captured centrally in `capture.ts`, not per page.

/** Who made the change. */
export type LogActor = "owner" | "staff" | "ai" | "customer" | "integration" | "automatic";

/** Where the change came from. */
export type LogSource = "button" | "command" | "voice" | "customer-page" | "campaign" | "mcp" | "assistant" | "waitlist";

export interface LogMeta {
  actor: LogActor;
  source: LogSource;
  /** Set when the owner approved a change someone else drafted (an assistant's proposal). */
  approvedBy?: "owner";
  /** Epoch milliseconds. */
  at: number;
}

/** A record that can be restored: anything in a collection has an id. */
export interface Item {
  id: string;
}

export interface CollectionPatch {
  /** Created records as written. Older log entries stored only their IDs. */
  added: (Item | string)[];
  changed: { before: Item; after: Item }[];
  removed: { index: number; item: Item }[];
  /** Set when the change reordered the list: the ids in order, before and after. */
  order?: { before: string[]; after: string[] };
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
  /** The customer a waiting-list event concerns, so erasing them empties it. */
  customerId?: string;
  /** Present when the change can be undone. */
  patch?: StatePatch;
  undone?: boolean;
}
