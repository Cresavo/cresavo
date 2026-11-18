import type { PosterFormat, PosterStyle } from "../data/types";

/** Size in pixels at export scale 1, and the factor used when exporting. */
export const POSTER_FORMATS: Record<PosterFormat, { width: number; height: number; exportScale: number }> = {
  post: { width: 1080, height: 1350, exportScale: 1 },
  story: { width: 1080, height: 1920, exportScale: 1 },
  // A4 proportions (1:1.414), exported at twice the size for printing.
  window: { width: 1050, height: 1485, exportScale: 2 },
};

export const POSTER_STYLES: PosterStyle[] = ["calm", "bold", "photo", "arch", "dusk"];
export const POSTER_IMAGES = ["/demo/salon.webp", "/demo/massage.webp"];

/** Greedy word wrap by character count. Words longer than a line stay whole. */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), `${lines.slice(maxLines - 1).join(" ").slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`];
}

const BOLD_GLYPH_WIDTH = 0.58;

/** Largest font size (up to `max`) at which a bold single line fits the width. */
export function fitFontSize(text: string, width: number, max: number): number {
  return Math.min(max, Math.floor(width / (Math.max(1, text.length) * BOLD_GLYPH_WIDTH)));
}
