import type { DemoAction } from "../actions";
import { jsonEqual } from "../data/json-equal";
import type { DateKey, DemoState, JournalContent, JournalEntry, SealedJournal } from "../data/types";
import type { TrashEntry } from "../trash/trash";

// Journal entries whose text the server keeps encrypted (JOURNALS_ON_SERVER,
// docs/design/STUDIO_STORE.md "Server-side journals"). In the salon document a
// sealed entry is a stub: its id, customer, booking, date and staff member,
// empty text fields and `sealed`, which names the stored versions in
// `journal_entry`. These pure helpers find every journal entry the document
// holds (the live list, deleted customers' trash bundles and the undo data of
// the activity log), turn entries into stubs and back, and keep the text out of
// what the server stores in the audit log or sends to a browser.

/** The content as it is encrypted and compared: empty optional fields left out. */
export function canonicalContent(content: JournalContent): JournalContent {
  const out: JournalContent = { treatment: content.treatment ?? "", observations: content.observations ?? "", advice: content.advice ?? "" };
  if (content.nextVisit) out.nextVisit = content.nextVisit;
  const { before, after } = content.photos ?? {};
  if (before || after) out.photos = { ...(before ? { before } : {}), ...(after ? { after } : {}) };
  return out;
}

export const sameContent = (a: JournalContent, b: JournalContent) => jsonEqual(canonicalContent(a), canonicalContent(b));

/** Every version of an entry, oldest first, the current one last, and the day each earlier one was replaced. */
export function versionsOf(entry: JournalEntry): { contents: JournalContent[]; replacedOn: DateKey[] } {
  const earlier = entry.versions ?? [];
  return { contents: [...earlier.map(canonicalContent), canonicalContent(entry)], replacedOn: earlier.map((v) => v.replacedOn) };
}

/** True for an entry that carries no text, only where its text is stored. */
export function isStub(entry: JournalEntry): boolean {
  const sealed = entry.sealed;
  return !!sealed && Array.isArray(sealed.versions) && sealed.versions.length >= 1 && Array.isArray(sealed.replacedOn) &&
    sealed.replacedOn.length === sealed.versions.length - 1 &&
    entry.treatment === "" && entry.observations === "" && entry.advice === "" &&
    entry.nextVisit === undefined && entry.photos === undefined && entry.versions === undefined;
}

/** The stub of an entry whose versions are stored as `sealed` says. */
export function journalStub(entry: JournalEntry, sealed: SealedJournal): JournalEntry {
  const { id, customerId, bookingId, date, staffId } = entry;
  return { id, customerId, ...(bookingId ? { bookingId } : {}), date, staffId, treatment: "", observations: "", advice: "", sealed };
}

/** The full entry of a stub, from the decrypted content of each of its versions (in `sealed.versions` order). */
export function hydrateJournal(stub: JournalEntry, contents: JournalContent[]): JournalEntry {
  const sealed = stub.sealed!;
  const current = contents.at(-1)!;
  const { id, customerId, bookingId, date, staffId } = stub;
  const versions = contents.slice(0, -1).map((content, i) => ({ ...content, replacedOn: sealed.replacedOn[i] }));
  return { id, customerId, ...(bookingId ? { bookingId } : {}), date, staffId, ...current, ...(versions.length ? { versions } : {}), sealed };
}

/** How many versions an entry has, the current one included. */
export const versionCount = (entry: JournalEntry) => entry.sealed?.versions.length ?? (entry.versions?.length ?? 0) + 1;

type Visit = (entry: JournalEntry) => JournalEntry | null;

const mapList = (list: JournalEntry[] | undefined, visit: Visit): JournalEntry[] | undefined => {
  if (!Array.isArray(list)) return list;
  const next = list.flatMap((entry) => {
    const out = visit(entry);
    return out ? [out] : [];
  });
  return next.length === list.length && next.every((entry, i) => entry === list[i]) ? list : next;
};

function mapBundle<T>(entry: T, visit: Visit): T {
  const trash = entry as unknown as TrashEntry;
  if (!trash || typeof trash !== "object" || trash.kind !== "customer") return entry;
  const journals = mapList(trash.journals, visit);
  return journals === trash.journals ? entry : ({ ...trash, journals } as unknown as T);
}

interface Patch {
  added?: unknown[];
  changed?: Array<{ before: unknown; after: unknown }>;
  removed?: Array<{ index: number; item: unknown }>;
}

/** The same patch with `edit` applied to each record it holds; a changed pair whose side is dropped goes. */
function mapPatch(patch: Patch | undefined, edit: (item: unknown) => unknown): Patch | undefined {
  if (!patch) return patch;
  let touched = false;
  const keep = <T>(was: T, now: T) => {
    if (was !== now) touched = true;
    return now;
  };
  const added = patch.added?.flatMap((item) => {
    if (typeof item === "string") return [item];
    const out = keep(item, edit(item));
    return out ? [out] : [];
  });
  const changed = patch.changed?.flatMap((pair) => {
    const before = keep(pair.before, edit(pair.before));
    const after = keep(pair.after, edit(pair.after));
    if (!before || !after) return [];
    return [before === pair.before && after === pair.after ? pair : { before, after }];
  });
  const removed = patch.removed?.flatMap((entry) => {
    const item = keep(entry.item, edit(entry.item));
    if (!item) return [];
    return [item === entry.item ? entry : { index: entry.index, item }];
  });
  if (!touched) return patch;
  return { ...patch, ...(added ? { added } : {}), ...(changed ? { changed } : {}), ...(removed ? { removed } : {}) };
}

/**
 * Applies `visit` to every journal entry the document holds, in a fixed order: the live list, the trash bundles,
 * then the undo data of each activity entry (its journals and trash). A visit that returns null drops the entry
 * (and a changed pair in undo data loses both sides). Unchanged parts keep their identity.
 */
export function mapJournals(state: DemoState, visit: Visit): DemoState {
  const journals = mapList(state.journals, visit)!;
  const trash = state.trash.map((entry) => mapBundle(entry, visit));
  const trashChanged = trash.some((entry, i) => entry !== state.trash[i]);
  const log = state.log.map((entry) => {
    const collections = entry.patch?.collections;
    if (!collections || (!collections.journals && !collections.trash)) return entry;
    const journalPatch = mapPatch(collections.journals as Patch | undefined, (item) => visit(item as JournalEntry));
    const trashPatch = mapPatch(collections.trash as Patch | undefined, (item) => mapBundle(item, visit));
    if (journalPatch === collections.journals && trashPatch === collections.trash) return entry;
    const next = { ...collections };
    if (journalPatch) next.journals = journalPatch as typeof collections.journals;
    if (trashPatch) next.trash = trashPatch as typeof collections.trash;
    return { ...entry, patch: { ...entry.patch!, collections: next } };
  });
  const logChanged = log.some((entry, i) => entry !== state.log[i]);
  if (journals === state.journals && !trashChanged && !logChanged) return state;
  return { ...state, journals, ...(trashChanged ? { trash } : {}), ...(logChanged ? { log } : {}) };
}

/** Every journal entry the document holds, in `mapJournals` order. */
export function journalsIn(state: DemoState): JournalEntry[] {
  const found: JournalEntry[] = [];
  mapJournals(state, (entry) => {
    found.push(entry);
    return entry;
  });
  return found;
}

/** True when some journal entry in the document still carries its text. */
export const holdsJournalText = (state: DemoState) => journalsIn(state).some((entry) => !isStub(entry));

/** The document with every entry that carries text left out: what a browser may receive while the server keeps journals. */
export const withoutJournalText = (state: DemoState) => mapJournals(state, (entry) => (isStub(entry) ? entry : null));

/** The document with stored versions renumbered (`remap` per entry id: old version to new). */
export function remapVersions(state: DemoState, remap: ReadonlyMap<string, ReadonlyMap<number, number>>): DemoState {
  if (!remap.size) return state;
  return mapJournals(state, (entry) => {
    const map = entry.sealed && remap.get(entry.id);
    if (!map || !entry.sealed!.versions.some((v) => map.has(v))) return entry;
    return { ...entry, sealed: { ...entry.sealed!, versions: entry.sealed!.versions.map((v) => map.get(v) ?? v) } };
  });
}

/** Entry ids in the live list, and in deleted customers' trash bundles. */
export function journalPlaces(state: DemoState): { live: Set<string>; trashed: Set<string> } {
  const live = new Set(state.journals.map((entry) => entry.id));
  const trashed = new Set(state.trash.flatMap((entry) => (entry.kind === "customer" ? entry.journals.map((j) => j.id) : [])));
  return { live, trashed };
}

/** What the audit log keeps of a journal change: who and which entry, never the text. */
export type JournalAuditAction =
  | { type: "journal/add"; entry: { id?: string; customerId: string; bookingId?: string; date: DateKey; staffId: string } }
  | { type: "journal/edit"; id: string; on: DateKey; customerId?: string };

/** The action as the audit log and the replay store keep it while journals are sealed: the text replaced by the entry id. */
export function auditAction(action: DemoAction, before?: DemoState, after?: DemoState): DemoAction | JournalAuditAction {
  if (action.type === "journal/edit") return { type: "journal/edit", id: action.id, on: action.on, ...(action.customerId ? { customerId: action.customerId } : {}) };
  if (action.type !== "journal/add") return action;
  const known = new Set(before?.journals.map((entry) => entry.id) ?? []);
  const id = after?.journals.find((entry) => !known.has(entry.id))?.id;
  const { customerId, bookingId, date, staffId } = action.entry;
  return { type: "journal/add", entry: { ...(id ? { id } : {}), customerId, ...(bookingId ? { bookingId } : {}), date, staffId } };
}
