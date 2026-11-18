const LIMIT = 40;
const SELECTOR = "h1, h2, h3, button, a[href], [role=tab], [role=radio]";
/** The help window and the Help button are not part of what the owner was looking at. */
const IGNORED = "dialog, [data-help=help-button]";

function label(el: Element): string {
  const text = el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? el.textContent ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * A plain-text outline of what is on screen: headings, buttons and links that
 * are visible (the caller passes the page's main area, not the menus). It stands in for a screenshot and never includes typed text,
 * form values or the help window itself.
 */
export function summarizeScreen(root: ParentNode = document): string[] {
  const lines: string[] = [];
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (lines.length >= LIMIT) break;
    if (el.closest(IGNORED) || el.getClientRects().length === 0) continue;
    const text = label(el);
    if (!text) continue;
    const kind = /^H[1-3]$/.test(el.tagName) ? "Heading" : el.tagName === "A" ? "Link" : "Button";
    const line = `${kind}: ${text}`;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}
