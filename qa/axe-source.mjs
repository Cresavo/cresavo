import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

export const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** @returns {string} */
export function axeSource() {
  const candidates = [process.env.QA_AXE, "axe-core/axe.min.js"].filter(Boolean);
  const require = createRequire(import.meta.url);
  for (const c of candidates) { try { return readFileSync(existsSync(c) ? c : require.resolve(c), "utf8"); } catch {} }
  throw new Error("axe-core not found: npm i -D axe-core, or set QA_AXE=/path/axe.min.js");
}
