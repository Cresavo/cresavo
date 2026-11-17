import type { Category, DateKey, JournalContent, JournalEntry } from "../data/types";

// Journal helpers: templates per treatment type, demo photos and edit versions.

export type JournalTemplateId = "foot" | "ingrown" | "massage" | "deep";

/** Template texts live in the dictionary as `journal.template.<id>.<field>`. */
export const JOURNAL_TEMPLATES: { id: JournalTemplateId; category: Category }[] = [
  { id: "foot", category: "foot" },
  { id: "ingrown", category: "foot" },
  { id: "massage", category: "massage" },
  { id: "deep", category: "massage" },
];

/** Demo images a journal photo can use. */
export const JOURNAL_PHOTOS = ["/demo/massage.webp", "/demo/salon.webp", "/demo/hair.webp"];

const same = (a: JournalContent, b: JournalContent) =>
  a.treatment === b.treatment &&
  a.observations === b.observations &&
  a.advice === b.advice &&
  (a.nextVisit ?? "") === (b.nextVisit ?? "") &&
  a.photos?.before === b.photos?.before &&
  a.photos?.after === b.photos?.after;

/** Applies an edit and keeps what was there as an earlier version. An edit that changes nothing returns the same entry. */
export function editJournalEntry(entry: JournalEntry, content: JournalContent, today: DateKey): JournalEntry {
  const next: JournalContent = { ...content, nextVisit: content.nextVisit?.trim() || undefined };
  if (same(entry, next)) return entry;
  const { treatment, observations, advice, nextVisit, photos } = entry;
  return { ...entry, ...next, versions: [...(entry.versions ?? []), { treatment, observations, advice, nextVisit, photos, replacedOn: today }] };
}
