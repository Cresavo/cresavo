/** One short article of the help knowledge base. */
export interface HelpArticle {
  id: string;
  title: string;
  keywords: string[];
  /** The help-map entry "Show me" points at (`src/concept/help/map`). */
  entry?: string;
  body: string;
}
