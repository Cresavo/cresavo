/** One short article of the help knowledge base (`docs/help/*.md`). */
export interface HelpArticle {
  id: string;
  title: string;
  keywords: string[];
  /** Page that shows the highlighted element; "Show me" goes there when it is not on the current page. */
  path?: string;
  /** `data-help` name of the button or menu item to highlight. */
  show?: string;
  body: string;
}

/** Article text is a small front matter block (`key: value` lines between `---`), then the body. */
export function parseArticle(id: string, source: string): HelpArticle {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.replace(/\r\n/g, "\n"));
  if (!match) throw new Error(`Help article ${id} has no front matter`);
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    }),
  );
  if (!fields.title) throw new Error(`Help article ${id} has no title`);
  return {
    id,
    title: fields.title,
    keywords: (fields.keywords ?? "").split(",").map((word) => word.trim()).filter(Boolean),
    path: fields.path || undefined,
    show: fields.show || undefined,
    body: match[2].trim(),
  };
}
