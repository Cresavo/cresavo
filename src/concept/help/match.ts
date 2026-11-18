// Rule-based help answer: the fallback of the `answer-help` task and the
// answer when no AI key is set. Matches the question against each article's
// title, keywords and text.

export interface HelpCandidate {
  id: string;
  title: string;
  keywords: string[];
  body: string;
}

export interface HelpAnswer {
  answer: string;
  articleIds: string[];
}

const STOP = new Set(["the", "and", "for", "how", "can", "does", "what", "where", "when", "why", "who", "with", "from", "this", "that", "are", "was", "you", "your", "his", "her", "our", "its", "not", "but", "any", "get", "got", "need", "want", "would", "could", "should", "please", "have", "has", "had", "into", "out", "about", "there", "them", "they", "will", "show", "tell", "make", "give", "find", "like", "just", "again"]);
const MIN_SCORE = 4;
const MAX_ANSWER = 700;

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word.replace(/(ing|ed|es|s)$/, "").replace(/(ing|ed)$/, "").replace(/e$/, "").replace(/([a-z])\1$/, "$1");
}

/** Lower-case word stems: "bookings", "booked" and "booking" all become "book". */
export function stems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 3 && !STOP.has(word))
    .map(stem);
}

function score(question: string[], article: HelpCandidate): number {
  const title = new Set(stems(article.title));
  const keywordTokens = new Set(article.keywords.flatMap(stems));
  const body = new Set(stems(article.body));
  const asked = new Set(question);
  let total = 0;
  for (const word of asked) {
    if (title.has(word)) total += 3;
    if (keywordTokens.has(word)) total += 3;
    if (body.has(word)) total += 1;
  }
  // Every word of a keyword phrase in the question is a strong hint.
  for (const phrase of article.keywords) {
    const words = stems(phrase);
    if (words.length > 1 && words.every((word) => asked.has(word))) total += 4;
  }
  return total;
}

function shorten(body: string): string {
  if (body.length <= MAX_ANSWER) return body;
  const cut = body.slice(0, MAX_ANSWER);
  const end = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return (end > 0 ? cut.slice(0, end + 1) : cut).trim();
}

/** The best article's text, and up to three article ids. Empty when nothing fits well enough. */
export function ruleAnswer({ question, articles }: { question: string; articles: HelpCandidate[] }): HelpAnswer {
  const asked = stems(question);
  const ranked = articles
    .map((article) => ({ article, score: score(asked, article) }))
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { answer: "", articleIds: [] };
  const best = ranked[0].score;
  return {
    answer: shorten(ranked[0].article.body),
    articleIds: ranked.filter((entry) => entry.score >= best * 0.6).slice(0, 3).map((entry) => entry.article.id),
  };
}
