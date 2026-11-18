const NUMBER_WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 };

/** Weeks until the next visit from text like "in 6-8 weeks" or "after two months". The low end of a range wins. */
export function suggestedWeeks(text: string): number | undefined {
  const match = text.toLowerCase().match(/\b(\d+|a|one|two|three|four|five|six|eight|ten|twelve)\b(?:\s*(?:-|–|to)\s*\d+)?\s*(week|month)s?\b/);
  if (!match) return undefined;
  const amount = Number(match[1]) || NUMBER_WORDS[match[1]];
  return match[2] === "month" ? amount * 4 : amount;
}
