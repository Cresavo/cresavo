// The business's own words on the booking page: a heading and a few paragraphs
// of plain text. It is never read as HTML or Markdown; line breaks are kept.

export interface PageAbout {
  /** Empty means the page's own "About <business>" heading. */
  heading: string;
  /** Empty means the section stays hidden even when it is switched on. */
  text: string;
}

export const MAX_ABOUT_HEADING = 80;
export const MAX_ABOUT_TEXT = 1500;

export const EMPTY_ABOUT: PageAbout = { heading: "", text: "" };

// Tabs and line breaks are the only control characters a paragraph needs.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** One line of text: whitespace runs become one space. */
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

/** Paragraphs as typed: line endings unified, at most one blank line between paragraphs, no trailing space. */
const paragraphs = (value: string) =>
  value.replace(/\r\n?/g, "\n").replace(CONTROL, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

/** An about text from untrusted input. Anything that is not a string is empty; long text is cut. */
export function normalizeAbout(input: Partial<PageAbout> | undefined): PageAbout {
  const heading = typeof input?.heading === "string" ? oneLine(input.heading.replace(CONTROL, " ")) : "";
  const text = typeof input?.text === "string" ? paragraphs(input.text) : "";
  return { heading: heading.slice(0, MAX_ABOUT_HEADING).trim(), text: text.slice(0, MAX_ABOUT_TEXT).trim() };
}

/** The text as paragraphs, split on blank lines; single line breaks stay inside a paragraph. */
export const aboutParagraphs = (text: string): string[] => text.split(/\n{2,}/).filter(Boolean);
