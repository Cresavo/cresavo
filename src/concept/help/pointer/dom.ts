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

/** Presses a navigation step for the owner ("Take me there"). Refuses anything that books, moves, pays, sends, deletes or resets. */
export function clickFor(entry: Pick<HelpEntry, "id" | "safety">, element: Pick<HTMLElement, "click">): void {
  if (!mayClickFor(entry)) throw new ShowMeRefusal(entry.id);
  element.click();
}

/** Behind an open modal dialog, or in a part of the page that is switched off: there, but not reachable now. */
function blocked(element: Element, doc: Document): boolean {
  if (element.closest("[inert]")) return true;
  const modal = [...doc.querySelectorAll("dialog[open]")].some((dialog) => dialog.matches(":modal"));
  return modal && !element.closest("dialog[open]");
}

export type AnchorLookup = { element: HTMLElement } | "hidden" | "absent";

/**
 * The element for an entry that the owner can see now. "hidden" when the page has it but not in this layout (the
 * tab bar on a desktop), "absent" when it is not on the page (yet). Of several, `prefer` picks by `data-help-state`.
 */
export function findAnchor(id: string, prefer?: string, doc: Document = document): AnchorLookup {
  const all = [...doc.querySelectorAll<HTMLElement>(`[data-help-id="${CSS.escape(id)}"]`)];
  if (!all.length) return "absent";
  const shown = all.filter((element) => element.getClientRects().length > 0 && !blocked(element, doc));
  if (!shown.length) return all.some((element) => element.getClientRects().length > 0) ? "absent" : "hidden";
  return { element: (prefer && shown.find((element) => element.dataset.helpState === prefer)) || shown[0] };
}

/** Whether a page address shows an entry's route; a `[id]` segment matches any one segment. */
export function onRoute(pathname: string, route: string): boolean {
  const asked = pathname.replace(/\/$/, "").split("/");
  const wanted = route.split("/");
  return asked.length === wanted.length && wanted.every((part, index) => /^\[.+\]$/.test(part) || part === asked[index]);
}
