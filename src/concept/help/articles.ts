/** One short article of the help knowledge base. */
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
