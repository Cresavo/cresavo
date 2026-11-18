import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSISTANT, BRAND } from "../brand";
import { parseArticle, type HelpArticle } from "./articles";

const DIR = join(process.cwd(), "docs", "help");

/** Reads `docs/help/*.md`, a handful of small files, filling in `{brand}` and `{assistant}`. Server and tests only. */
export function loadHelpArticles(): HelpArticle[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => parseArticle(file.replace(/\.md$/, ""), fillNames(readFileSync(join(DIR, file), "utf8"))));
}

const fillNames = (text: string) => text.replaceAll("{brand}", BRAND.name).replaceAll("{assistant}", ASSISTANT.name);
