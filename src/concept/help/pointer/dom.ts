import type { HelpEntry } from "../map/types";

// "Show me" works only with the studio's own page: it finds an element by its `data-help-id`, and it presses an
// element for the owner only when that just opens a page or a view. No screenshots and no network.

/** Thrown when something asks "Show me" to press a button that changes data. */
export class ShowMeRefusal extends Error {
  constructor(readonly entryId: string) {
    super(`Show me does not press "${entryId}" for the owner: it changes data.`);
  }
}

export const mayClickFor = (entry: Pick<HelpEntry, "safety">) => entry.safety === "navigate";

/** What a click can open: a link, a button, a tab, a form control or a label. */
export const INTERACTIVE = "a[href], button, [role=button], [role=tab], [role=link], [role=menuitem], input, select, summary, label";

type Clickable = Pick<HTMLElement, "click">;
interface Anchor extends Clickable {
  matches?(selector: string): boolean;
  querySelectorAll?(selector: string): ArrayLike<Clickable>;
}

/**
 * The element a click should land on: the anchor itself when it is a control, else the one control inside it.
 * `element.click()` on a wrapper never reaches the button in it, so a wrapper with none or several is refused.
 */
export function clickTarget(element: Anchor): Clickable | null {
  if (!element.matches || element.matches(INTERACTIVE)) return element;
  const inside = element.querySelectorAll?.(INTERACTIVE);
  return inside?.length === 1 ? inside[0] : null;
}

/** Presses a navigation step for the owner ("Take me there"). Refuses anything that books, moves, pays, sends, deletes or resets. */
export function clickFor(entry: Pick<HelpEntry, "id" | "safety">, element: Anchor): void {
  if (!mayClickFor(entry)) throw new ShowMeRefusal(entry.id);
  const target = clickTarget(element);
  if (!target) throw new Error(`Show me cannot press "${entry.id}": its anchor is not one control.`);
  target.click();
}

/** Behind an open modal dialog, or in a part of the page that is switched off: there, but not reachable now. */
function blocked(element: Element, doc: Pick<Document, "querySelectorAll">): boolean {
  if (element.closest("[inert]")) return true;
  const modal = [...doc.querySelectorAll("dialog[open]")].some((dialog) => dialog.matches(":modal"));
  return modal && !element.closest("dialog[open]");
}

export type AnchorLookup = { element: HTMLElement } | "hidden" | "absent" | "blocked" | "unmatched";

/** Where to find another visit of the kind asked for: finished visits lie on earlier days, coming ones on later. */
export const ANOTHER_DAY: Record<NonNullable<HelpEntry["prefer"]>, string> = { past: "calendar.previous", upcoming: "calendar.next" };

/**
 * The element for an entry that the owner can see now. "hidden" when the page has it but not in this layout (the
 * tab bar on a desktop), "absent" when it is not on the page (yet), "blocked" when it is there but an open sheet
 * keeps it out of reach. Of elements that carry a `data-help-state`
 * (visits), only one in the `prefer` state will do: "unmatched" when none on screen is, so the guide never opens a
 * visit that cannot offer what was asked (an upcoming visit has no Take payment).
 */
export function findAnchor(id: string, prefer?: string, doc: Pick<Document, "querySelectorAll"> = document): AnchorLookup {
  const all = [...doc.querySelectorAll<HTMLElement>(`[data-help-id="${id.replace(/["\\]/g, "\\$&")}"]`)];
  if (!all.length) return "absent";
  const shown = all.filter((element) => element.getClientRects().length > 0 && !blocked(element, doc));
  if (!shown.length) return all.some((element) => element.getClientRects().length > 0) ? "blocked" : "hidden";
  if (!prefer || !shown.some((element) => element.dataset.helpState)) return { element: shown[0] };
  const match = shown.find((element) => element.dataset.helpState === prefer);
  return match ? { element: match } : "unmatched";
}

/** Whether a page address shows an entry's route; a `[id]` segment matches any one segment. */
export function onRoute(pathname: string, route: string): boolean {
  const asked = pathname.replace(/\/$/, "").split("/");
  const wanted = route.split("/");
  return asked.length === wanted.length && wanted.every((part, index) => /^\[.+\]$/.test(part) || part === asked[index]);
}
