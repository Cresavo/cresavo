import type { StockItem } from "../data/types";
import { normalize } from "../intent/match";

const FILLER_WORDS = new Set(["more", "some", "the", "for", "and", "new", "any", "our"]);

/** The products whose names contain the most of the words in the text. Several results mean "ask which". */
export function findProducts(stock: StockItem[], text: string): StockItem[] {
  const words = normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
    .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));
  const scored = stock.map((item) => ({ item, score: words.filter((w) => normalize(item.name).includes(w)).length }));
  const best = Math.max(0, ...scored.map((s) => s.score));
  return scored.filter((s) => best > 0 && s.score === best).map((s) => s.item);
}
