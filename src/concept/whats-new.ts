import type { MessageKey } from "./i18n";

export interface WhatsNewItem {
  /** Owner-facing text, in the studio dictionaries. */
  text: MessageKey;
  /** A studio page the item can open. */
  href?: string;
}

export interface WhatsNewEntry {
  version: string;
  /** ISO date of the release. */
  date: string;
  items: readonly WhatsNewItem[];
}

/** Newest release first. A release PR adds its owner-facing items here, in en and sv (docs/RELEASING.md). */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    version: "0.8.0",
    date: "2026-11-22",
    items: [
      { text: "whatsNew.v080.customerData", href: "/studio/customers" },
      { text: "whatsNew.v080.review", href: "/studio/customers/review" },
      { text: "whatsNew.v080.privacy", href: "/studio/more/privacy" },
      { text: "whatsNew.v080.accounts" },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-11-22",
    items: [
      { text: "whatsNew.v070.booking" },
      { text: "whatsNew.v070.confirmation" },
      { text: "whatsNew.v070.change" },
      { text: "whatsNew.v070.privacy" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-11-22",
    items: [
      { text: "whatsNew.v060.campaigns", href: "/studio/more/campaigns" },
      { text: "whatsNew.v060.posters", href: "/studio/more/campaigns" },
      { text: "whatsNew.v060.timing", href: "/studio/more/services" },
      { text: "whatsNew.v060.import", href: "/studio/customers" },
    ],
  },
];

/** The newest release shown to the owner. */
export function latestVersion(entries: readonly WhatsNewEntry[] = WHATS_NEW): string | null {
  return entries[0]?.version ?? null;
}

/** Compares dotted release numbers numerically, so "0.10.0" is newer than "0.9.0". */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** True when the device has not yet seen the newest release. A device that never opened the list has seen nothing. */
export function hasUnseen(lastSeen: string | null, entries: readonly WhatsNewEntry[] = WHATS_NEW): boolean {
  const latest = latestVersion(entries);
  if (!latest) return false;
  return lastSeen === null || compareVersions(latest, lastSeen) > 0;
}
