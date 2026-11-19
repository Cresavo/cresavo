import type { Locale } from "@/lib/locale";
import { getActiveLocale } from "../i18n";
import { runAiTask } from "../ai/api-client";
import type { HelpArticle } from "./articles";

export interface HelpReply {
  /** The answer text; empty when nothing in the help articles fits. */
  answer: string;
  /** Articles the answer is based on, in order of relevance. */
  articles: HelpArticle[];
  source: "ai" | "rules";
  requestId: string | null;
}

const loaded: Partial<Record<Locale, Promise<HelpArticle[]>>> = {};

/** The knowledge base, fetched once per language per page load. */
function fetchArticles(language: Locale): Promise<HelpArticle[]> {
  return loaded[language] ??= fetch(`/api/concept/help?lang=${language}`)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Help articles failed"))))
    .then((data: { articles: HelpArticle[] }) => data.articles)
    .catch((error) => {
      delete loaded[language];
      throw error;
    });
}

/** Asks the `answer-help` task. Only ids of known articles are accepted from the answer. */
export async function askHelp(question: string, localOnly: boolean): Promise<HelpReply> {
  const language = getActiveLocale();
  const all = await fetchArticles(language);
  const articles = all.map(({ id, title, keywords, body }) => ({ id, title, keywords, body }));
  const { output, log, requestId } = await runAiTask<{ answer: string; articleIds: string[] }>("answer-help", { question, articles, language }, localOnly);
  const used = output.articleIds.flatMap((id) => all.find((article) => article.id === id) ?? []);
  return { answer: used.length ? output.answer : "", articles: used, source: log.source, requestId };
}
