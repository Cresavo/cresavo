import type { DateKey, JournalContent, JournalEntry } from "../data/types";

// Journal helpers: demo photos and edit versions. Templates come from the industry pack.

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
