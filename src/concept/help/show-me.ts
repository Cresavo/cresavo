import type { HelpArticle } from "./articles";

const HIGHLIGHT_CLASS = "help-highlight";
const HIGHLIGHT_MS = 4500;
const WAIT_MS = 2500;

/** The first element with this `data-help` name that is actually on screen. */
export function findTarget(name: string, root: ParentNode = document): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(`[data-help="${CSS.escape(name)}"]`);
  return [...candidates].find((el) => el.getClientRects().length > 0) ?? null;
}

function highlight(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
}

/**
 * "Show me": highlights the button or menu item an article is about. When it
 * is not on the current page, go to the article's page first and wait for it.
 * Returns false when it cannot be found.
 */
export async function showMe(article: HelpArticle, pathname: string, navigate: (path: string) => void): Promise<boolean> {
  if (!article.show) return false;
  let target = findTarget(article.show);
  if (!target && article.path && article.path !== pathname) navigate(article.path);
  const deadline = Date.now() + WAIT_MS;
  while (!target && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    target = findTarget(article.show);
  }
  if (!target) return false;
  highlight(target);
  return true;
}
