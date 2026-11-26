import type { Locale } from "@/lib/locale";
import { BRAND } from "../brand";
import { translate } from "../i18n";
import type { HelpArticle } from "./articles";

const ARTICLES = [
  { id: "campaigns", entry: "more.campaigns" },
  { id: "change-price", entry: "services.treatment" },
  { id: "command-box", entry: "shell.assistant" },
  { id: "export-data", entry: "data.download" },
  { id: "help-ticket", entry: "shell.help" },
  { id: "import-customers", entry: "customers.import" },
  { id: "inbox", entry: "nav.inbox" },
  { id: "journal", entry: "customer.journal" },
  { id: "modules", entry: "features.switches" },
  { id: "move-cancel-booking", entry: "booking.move" },
  { id: "new-booking", entry: "calendar.new-booking" },
  { id: "stock", entry: "more.stock" },
  { id: "support-access", entry: "advanced.support-access" },
  { id: "trash-restore", entry: "log.trash" },
  { id: "undo-changes", entry: "help.history" },
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
