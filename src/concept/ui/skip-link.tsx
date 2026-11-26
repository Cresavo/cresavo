import { t } from "../i18n";

/** The id of the page's own content, where "Skip to content" lands. Give that element `tabIndex={-1}` and `ui-skip-target`. */
export const CONTENT_ID = "content";

/** The first stop for the Tab key: past the header, the sidebar or the tabs, straight to the page's content. */
export function SkipLink() {
  return <a href={`#${CONTENT_ID}`} className="ui-skip">{t("ui.skipToContent")}</a>;
}
