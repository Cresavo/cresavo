import { loadHelpArticles } from "@/concept/help/load";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";

/** The help knowledge base (`docs/help/*.md`). */
export const GET = withRequestLog("/api/concept/help", () => Response.json({ articles: loadHelpArticles() }));
