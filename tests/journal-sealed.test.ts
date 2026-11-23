import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState, JournalEntry } from "@/concept/data/types";
import {
  auditAction, canonicalContent, holdsJournalText, hydrateJournal, isStub, journalPlaces, journalsIn, journalStub, mapJournals, remapVersions,
  versionCount, versionsOf, withoutJournalText,
} from "@/concept/journals/sealed";
import { reduce } from "@/concept/actions";
import { applyAction } from "@/concept/log/capture";
import { recordJournalView } from "@/concept/privacy/journal-access";

// The document side of server-side journals: every journal entry the document holds is found (the list, trash
// bundles and the undo data of the activity log), a stub carries no text, and what a browser or the audit log
// receives never does. All data is fictional.

const today = "2026-11-23";
const meta = { actor: "owner" as const, source: "button" as const, at: Date.parse("2026-11-23T10:00:00Z") };
const TEXT = ["Fictional heel crack", "Sealed observation", "Private advice"];

/** A demo salon with an edited entry (undo data in the log) and a deleted customer whose journal is in the trash. */
function salon(): { state: DemoState; edited: JournalEntry } {
  let state = createDemoState(today);
  const [first] = state.journals;
  state = applyAction(state, { type: "journal/edit", id: first.id, content: { treatment: TEXT[0], observations: TEXT[1], advice: TEXT[2] }, on: today }, meta);
  const other = state.journals.find((entry) => entry.customerId !== first.customerId)!;
  state = applyAction(state, { type: "customer/delete", id: other.customerId }, meta);
  return { state, edited: state.journals.find((entry) => entry.id === first.id)! };
}

const stubFor = (entry: JournalEntry, start = 1) => {
  const { contents, replacedOn } = versionsOf(entry);
  return journalStub(entry, { versions: contents.map((_, i) => start + i), replacedOn });
};

describe("sealed journal documents", () => {
  it("finds every entry: the list, the trash bundles and the activity log's undo data", () => {
    const { state, edited } = salon();
    const found = journalsIn(state);
    expect(found.length).toBeGreaterThan(state.journals.length);
    const bundled = state.trash.flatMap((entry) => (entry.kind === "customer" ? entry.journals : []));
    expect(bundled.length).toBeGreaterThan(0);
    for (const entry of [...state.journals, ...bundled]) expect(found).toContain(entry);
    // The edit's undo data holds the entry before and after; the deletion's holds the trash bundle.
    expect(found.filter((entry) => entry.id === edited.id).length).toBeGreaterThanOrEqual(3);
    expect(holdsJournalText(state)).toBe(true);
  });

  it("a stub carries no text, and hydrating it with its versions gives the entry back", () => {
    const { edited } = salon();
    expect(versionCount(edited)).toBe(2);
    const stub = stubFor(edited);
    expect(isStub(stub)).toBe(true);
    expect(isStub(edited)).toBe(false);
    expect(JSON.stringify(stub)).not.toMatch(new RegExp(TEXT.join("|")));
    expect(versionCount(stub)).toBe(2);
    const back = hydrateJournal(stub, versionsOf(edited).contents);
    expect({ ...back, sealed: undefined }).toEqual({ ...edited, ...canonicalContent(edited), versions: edited.versions!.map((v) => ({ ...canonicalContent(v), replacedOn: v.replacedOn })) });
    // A stub that lost its pointers, or kept text, is not a stub.
    expect(isStub({ ...stub, sealed: { versions: [], replacedOn: [] } })).toBe(false);
    expect(isStub({ ...stub, advice: "x" })).toBe(false);
    expect(isStub({ ...stub, sealed: { versions: [1, 2], replacedOn: [] } })).toBe(false);
  });

  it("turns every entry in every place into a stub, keeping identity where nothing changed", () => {
    const { state } = salon();
    const stubs = new Map<string, JournalEntry>();
    const sealed = mapJournals(state, (entry) => stubs.get(JSON.stringify(entry)) ?? stubs.set(JSON.stringify(entry), stubFor(entry)).get(JSON.stringify(entry))!);
    expect(holdsJournalText(sealed)).toBe(false);
    expect(journalsIn(sealed).every(isStub)).toBe(true);
    expect(JSON.stringify(sealed)).not.toMatch(new RegExp(TEXT.join("|")));
    // Everything that is not a journal entry is unchanged, and a visit that changes nothing changes nothing.
    expect({ ...sealed, journals: [], trash: [], log: [] }).toEqual({ ...state, journals: [], trash: [], log: [] });
    expect(mapJournals(sealed, (entry) => entry)).toBe(sealed);
    expect(sealed.log.map((entry) => entry.id)).toEqual(state.log.map((entry) => entry.id));
  });

  it("serves a browser no entry that carries text, and keeps the stubs", () => {
    const { state, edited } = salon();
    const mixed = { ...state, journals: state.journals.map((entry) => (entry.id === edited.id ? stubFor(entry) : entry)) };
    const served = withoutJournalText(mixed);
    expect(journalsIn(served).every(isStub)).toBe(true);
    expect(served.journals.map((entry) => entry.id)).toEqual([edited.id]);
    expect(served.trash.every((entry) => entry.kind !== "customer" || entry.journals.length === 0)).toBe(true);
    expect(JSON.stringify(served)).not.toMatch(new RegExp(TEXT.join("|")));
    // A changed pair in undo data whose side carried text goes as a whole.
    for (const entry of served.log) for (const pair of entry.patch?.collections.journals?.changed ?? []) expect([pair.before, pair.after].every((x) => isStub(x as JournalEntry))).toBe(true);
  });

  it("renumbers stored versions everywhere, and only for the entries named", () => {
    const { state, edited } = salon();
    const sealed = mapJournals(state, (entry) => stubFor(entry));
    const remapped = remapVersions(sealed, new Map([[edited.id, new Map([[1, 5]])]]));
    for (const entry of journalsIn(remapped)) {
      if (entry.id === edited.id) expect(entry.sealed!.versions[0]).toBe(5);
      else expect(entry.sealed!.versions[0]).toBe(1);
    }
    expect(remapVersions(sealed, new Map())).toBe(sealed);
  });

  it("keeps the audit action without text, naming the entry instead", () => {
    const { state } = salon();
    const before = state;
    const entry = { customerId: state.customers[0].id, date: today, staffId: state.staff[0].id, treatment: TEXT[0], observations: TEXT[1], advice: TEXT[2] };
    const after = applyAction(before, { type: "journal/add", entry }, meta);
    const added = after.journals.find((j) => !before.journals.some((b) => b.id === j.id))!;
    const audit = auditAction({ type: "journal/add", entry }, before, after);
    expect(audit).toEqual({ type: "journal/add", entry: { id: added.id, customerId: entry.customerId, date: today, staffId: entry.staffId } });
    expect(auditAction({ type: "journal/edit", id: added.id, content: { treatment: TEXT[0], observations: "", advice: "" }, on: today })).toEqual({ type: "journal/edit", id: added.id, on: today });
    expect(JSON.stringify(audit)).not.toMatch(new RegExp(TEXT.join("|")));
    const other = { type: "card/dismiss" as const, id: "x" };
    expect(auditAction(other)).toBe(other);
  });

  it("tells the live entries from the trashed ones", () => {
    const { state } = salon();
    const { live, trashed } = journalPlaces(state);
    expect(live.size).toBe(state.journals.length);
    expect(trashed.size).toBeGreaterThan(0);
    for (const id of trashed) expect(live.has(id)).toBe(false);
  });

  it("never counts a read the studio reported as the read the server handed out", () => {
    const { state } = salon();
    const customerId = state.customers[0].id;
    const at = meta.at;
    const reported = recordJournalView(state, { customerId, actor: "owner" }, at);
    const served = recordJournalView(reported, { customerId, actor: "owner", served: true }, at + 1000);
    expect(served.journalAccess!.slice(0, 2).map((row) => row.served)).toEqual([true, undefined]);
    // A second server read within the minute is the same read; a later one is a new read.
    expect(recordJournalView(served, { customerId, actor: "owner", served: true }, at + 2000)).toBe(served);
    expect(recordJournalView(served, { customerId, actor: "owner", served: true }, at + 120_000).journalAccess).toHaveLength(served.journalAccess!.length + 1);
  });

  it("edits an entry only for the customer the edit names", () => {
    const { state, edited } = salon();
    const other = state.customers.find((c) => c.id !== edited.customerId)!;
    const content = { treatment: "A fictional edit", observations: "", advice: "" };
    expect(reduce(state, { type: "journal/edit", id: edited.id, content, on: today, customerId: other.id }).journals.find((j) => j.id === edited.id)).toBe(edited);
    const ok = reduce(state, { type: "journal/edit", id: edited.id, content, on: today, customerId: edited.customerId });
    expect(ok.journals.find((j) => j.id === edited.id)!.treatment).toBe("A fictional edit");
  });
});
