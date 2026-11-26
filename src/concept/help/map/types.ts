import type { ModuleKey } from "../../data/types";
import type { MessageKey } from "../../i18n";

/**
 * What pressing an entry's element does. The same vocabulary as the assistant's tools: `navigate` is a read (it only
 * opens a page, tab or view), `changes-data` is a write (it books, moves, pays, sends, deletes, resets, copies or
 * starts a form that does). "Show me" may click a `navigate` element for the owner, never a `changes-data` one.
 */
export type HelpSafety = "navigate" | "changes-data";

/** One place in the studio that "Show me" can point at. */
export interface HelpEntry {
  /** Stable id, also the element's `data-help-id`. Dotted: area, then the thing. */
  id: string;
  /** The page that shows the element. A `[id]` segment is any record of that kind. */
  route: string;
  /** Entries to follow first, in order, to reach this one (Mer, then Inställningar, then …). */
  path: readonly string[];
  safety: HelpSafety;
  /** Visible name, from the dictionary. The caption is `showMe.<id>.hint`, the search words `showMe.<id>.keywords`. */
  label: MessageKey;
  /** In the studio frame (tab bar, sidebar, header) rather than one page: reachable from every studio page. */
  global?: true;
  /** Shown only while this add-on is on. */
  module?: ModuleKey;
  /** Only one layout has it: the phone tab bar, or the desktop sidebar. */
  viewport?: "phone" | "desktop";
  /** Of several matching elements, prefer the one with this `data-help-state` (a visit that has finished, say). */
  prefer?: "upcoming" | "past";
}
