import type { Locale } from "@/lib/locale";
import { BRAND } from "../brand";
import { translate } from "../i18n";
import type { HelpArticle } from "./articles";

const ARTICLES = [
  { id: "campaigns", path: "/studio/more", show: "/studio/more/campaigns" },
  { id: "change-price", path: "/studio/more", show: "/studio/more/services" },
  { id: "command-box", path: "/studio", show: "assistant" },
  { id: "export-data", path: "/studio/more", show: "/studio/more/data" },
  { id: "help-ticket", path: "/studio", show: "help-button" },
  { id: "import-customers", path: "/studio/customers", show: "import-customers" },
  { id: "inbox", path: "/studio/inbox", show: "/studio/inbox" },
  { id: "journal", path: "/studio/customers", show: "/studio/customers" },
  { id: "modules", path: "/studio/more", show: "/studio/more/features" },
  { id: "move-cancel-booking", path: "/studio/calendar", show: "/studio/calendar" },
  { id: "new-booking", path: "/studio/calendar", show: "new-booking" },
  { id: "stock", path: "/studio/more", show: "/studio/more/stock" },
  { id: "support-access", path: "/studio/more/advanced", show: "support-access" },
  { id: "trash-restore", path: "/studio/more/log", show: "log-tab-trash" },
  { id: "undo-changes", path: "/studio", show: "help-button" },
] as const;

/** The same articles and screen targets are available in each studio language. */
export function loadHelpArticles(language: Locale = "en"): HelpArticle[] {
  const names = { brand: BRAND.name, assistant: translate(language, "assistant.title") };
  return ARTICLES.map((article) => ({
    ...article,
    title: translate(language, `help.article.${article.id}.title`, names),
    keywords: translate(language, `help.article.${article.id}.keywords`).split(",").map((keyword) => keyword.trim()),
    body: translate(language, `help.article.${article.id}.body`, names),
  }));
}
