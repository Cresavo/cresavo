import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArticle, type HelpArticle } from "./articles";

const DIR = join(process.cwd(), "docs", "help");

/** Reads `docs/help/*.md`, a handful of small files. Server and tests only. */
export function loadHelpArticles(): HelpArticle[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => parseArticle(file.replace(/\.md$/, ""), readFileSync(join(DIR, file), "utf8")));
}
