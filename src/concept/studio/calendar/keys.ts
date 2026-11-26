/** What a key does in the desktop calendar. The mouse can do all of it too; these only save reaching for it. */
export type CalendarKey = "previous" | "next" | "today" | "earlier" | "later" | "help";

const KEYS: Record<string, CalendarKey> = {
  ArrowLeft: "previous",
  k: "previous",
  ArrowRight: "next",
  j: "next",
  t: "today",
  ArrowUp: "earlier",
  ArrowDown: "later",
  "?": "help",
};

/** Fields and widgets that use these keys themselves: typing, a segmented control, a menu, an open dialog. */
const OWN_KEYS = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role=radiogroup], [role=tablist], [role=menu], [role=listbox], [role=slider], dialog, [role=dialog]";

interface KeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** The focused element, or null for the page itself. */
  target: { closest(selector: string): unknown } | null;
}

/**
 * The calendar's action for a key press, or null to leave it alone. A key with Cmd, Ctrl or Alt is never taken,
 * so Cmd+K still opens Search and the browser keeps its own shortcuts.
 */
export function calendarKey(event: KeyInput): CalendarKey | null {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.target?.closest(OWN_KEYS)) return null;
  return KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? null;
}

/** The booking before or after the one in focus, in time order; from nothing, the first or the last. */
export function stepThrough<T>(items: T[], current: T | null, direction: "earlier" | "later"): T | null {
  if (!items.length) return null;
  const index = current === null ? -1 : items.indexOf(current);
  if (index < 0) return direction === "later" ? items[0] : items[items.length - 1];
  return items[Math.min(items.length - 1, Math.max(0, index + (direction === "later" ? 1 : -1)))];
}
