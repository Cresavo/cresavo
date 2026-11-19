import { loadHelpArticles } from "@/concept/help/load";
import { withRequestLog } from "@/concept/server/logger";
import { DEFAULT_LOCALE, parseLocale } from "@/lib/locale";

export const runtime = "nodejs";

export const GET = withRequestLog("/api/concept/help", (request) => {
  const language = parseLocale(new URL(request.url).searchParams.get("lang")) ?? DEFAULT_LOCALE;
  return Response.json({ articles: loadHelpArticles(language) });
});
