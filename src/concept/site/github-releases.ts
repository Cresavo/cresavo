import { cachedGitHub } from "./github-cache";

export interface ReleaseSummary {
  version: string;
  /** The release's theme, e.g. "simple by default", or its GitHub title when the notes have none. */
  title: string;
  url: string;
  publishedAt: string;
  highlights: string[];
}

const shown = 3;
const highlightsShown = 4;

/** Release notes start with "# <Product> 0.5.0 – theme" and list highlights as "- **Lead.** Detail". */
export function summariseRelease(release: Record<string, unknown>): ReleaseSummary | null {
  const { tag_name: tag, name, html_url: url, published_at: publishedAt, body, draft } = release;
  if (draft || typeof tag !== "string" || typeof url !== "string" || typeof publishedAt !== "string") return null;
  if (!url.startsWith("https://github.com/") || Number.isNaN(Date.parse(publishedAt))) return null;
  const notes = typeof body === "string" ? body : "";
  const title = typeof name === "string" ? name : "";
  const theme = (/^#\s+[^\n]*?\s[–-]\s+([^\n]+)$/m.exec(notes) ?? /\s[–-]\s+(.+)$/.exec(title))?.[1].trim();
  const highlights = [...notes.matchAll(/^[-*]\s+\*\*(.+?)\*\*/gm)]
    .map(([, lead]) => lead.replace(/[.:]$/, "").trim())
    .filter(Boolean)
    .slice(0, highlightsShown);
  return {
    version: tag.replace(/^v/, ""),
    title: theme ?? (title || tag),
    url,
    publishedAt,
    highlights,
  };
}

export const getReleases = cachedGitHub<ReleaseSummary[]>(`/releases?per_page=${shown + 2}`, (body) => {
  if (!Array.isArray(body)) return null;
  const releases = body
    .map((release) => (release && typeof release === "object" ? summariseRelease(release) : null))
    .filter((release): release is ReleaseSummary => release !== null)
    .slice(0, shown);
  return releases.length ? releases : null;
});
