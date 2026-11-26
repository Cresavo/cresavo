/**
 * The outline that says "this one": the first-visit tour and "Show me" both mark their target with this attribute
 * (`[data-tour-active]` in studio.css). Returns the cleanup that removes the mark again.
 */
export const HIGHLIGHT_ATTRIBUTE = "data-tour-active";

export function highlight(targets: Iterable<Element>): () => void {
  const marked = [...targets];
  for (const target of marked) target.setAttribute(HIGHLIGHT_ATTRIBUTE, "");
  return () => { for (const target of marked) target.removeAttribute(HIGHLIGHT_ATTRIBUTE); };
}
