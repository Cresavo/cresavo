import type { DateKey } from "../data/types";

export const SALON_DOMAIN = "salongeko.example";

/** Short, stable code from a name and start day, e.g. "fathers-day-7k2". */
export function campaignCode(name: string, from: DateKey): string {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\boffer\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 3)
    .join("-");
  let hash = 0;
  for (const char of `${name}|${from}`) hash = (hash * 31 + char.charCodeAt(0)) % 46656;
  return `${slug || "offer"}-${hash.toString(36).padStart(3, "0")}`;
}

/** Trackable link shown in every text and on the poster (simulated address). */
export function trackingLink(name: string, from: DateKey): string {
  return `${SALON_DOMAIN}/c/${campaignCode(name, from)}`;
}
