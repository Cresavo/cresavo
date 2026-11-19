import type { StockItem } from "../data/types";
import { fixtureStockAliases } from "../i18n/salon-eko-copy";
import { normalize } from "../intent/match";

const FILLER_WORDS = new Set(["more", "some", "the", "for", "and", "new", "any", "our", "mer", "fler", "lite", "nagon", "nagra", "den", "det"]);

/** The products whose names contain the most of the words in the text. Several results mean "ask which". */
export function findProducts(stock: StockItem[], text: string): StockItem[] {
  const words = normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
    .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));
  const scored = stock.map((item) => {
    const names = fixtureStockAliases(item).map(normalize);
    const score = Math.max(...names.map((name) => words.filter((word) =>
      name.includes(word) || word.length >= 6 && name.includes(word.replace(/(?:orna|erna|en|et|or|(?<=a)n|(?<=ad)e)$/, "")),
    ).length));
    return { item, score };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  return scored.filter((s) => best > 0 && s.score === best).map((s) => s.item);
}
