import type { Prisma } from "@prisma/client";
import type { DemoAction } from "../actions";
import { scrubDeep } from "../customers/erase";
import { jsonEqual } from "../data/json-equal";
import type { DemoState, JournalContent, JournalEntry } from "../data/types";
import {
  auditAction,
  holdsJournalText,
  hydrateJournal,
  isStub,
  journalPlaces,
  journalsIn,
  journalStub,
  mapJournals,
  sameContent,
  versionsOf,
  withoutJournalText,
} from "../journals/sealed";
import { decryptJournal, encryptJournal, JournalUnreadable, keyVerifier, verifiesKey, type JournalKey } from "./journal-crypto";

// The `journal_entry` table behind sealed journal entries (JOURNALS_ON_SERVER;
// migration 20261123090000_server_journals). Only PostgresStudioStore uses it,
// always inside its own transaction under the tenant's row lock and scope, so
// version numbers are allocated one apply at a time.
//
// Versions are append-only: an edit, and the first save of an entry that still
// carried its text in the document, add rows; nothing rewrites one. The
// application may only mark rows trashed (`deleted_at`). Erasure deletes a
// customer's rows through erase_subject (or the store's own statements), and
// replaces a version of another customer's entry that names them by a scrubbed
// copy (`replaces`) through studio_erase_journal_mentions, in the same step.

type Tx = Prisma.TransactionClient;

interface StoredRow {
  id: string;
  customer_id: string;
  version: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  key_version: number;
  deleted_at?: Date | null;
}

/** A scrubbed copy of a version that names an erased customer, encrypted for the next version of its entry. */
export interface MentionCopy {
  id: string;
  customerId: string;
  /** The version it replaces, which the erasure deletes. */
  replaces: number;
  version: number;
  deletedAt: Date | null;
  ciphertext: Buffer;
  iv: Buffer;
  keyVersion: number;
}

/** What tenant_idempotency keeps per key: the result of the first apply, a state copy included. */
export interface StoredReplay {
  state?: DemoState;
  entry?: { action?: DemoAction | { type: string; [field: string]: unknown } };
  [field: string]: unknown;
}

interface PendingRow {
  customerId: string;
  id: string;
  version: number;
  content: JournalContent;
}

/** Actions whose rules read journal text: the edited entry, or every entry (memory refuses notes that copy a journal). */
const READS_ENTRY = new Set<DemoAction["type"]>(["journal/edit"]);
const READS_ALL = new Set<DemoAction["type"]>(["memory/add", "memory/edit"]);

/** Actions that need the key: they write or read journal text. */
export const JOURNAL_TEXT_ACTIONS = new Set<DemoAction["type"]>(["journal/add", ...READS_ENTRY, ...READS_ALL]);

/**
 * The journal half of an erasure as the store's own statements (staging; erase_subject does the same): the
 * customer's rows, and every version an erasure replaced by a scrubbed copy. No key needed.
 */
export function deleteErasedJournals(tx: Tx, tenantId: string, customerId: string): Promise<number> {
  return tx.$executeRaw`DELETE FROM journal_entry WHERE tenant_id = ${tenantId} AND customer_id = ${customerId}`;
}

/** The copies as studio_erase_journal_mentions takes them. */
export const mentionCopiesJson = (copies: MentionCopy[]) => JSON.stringify(copies.map((copy) => ({
  id: copy.id, replaces: copy.replaces, version: copy.version, ciphertext: copy.ciphertext.toString("base64"), iv: copy.iv.toString("base64"), keyVersion: copy.keyVersion,
})));

/** studio_erase_journal_mentions as the store's own statements (staging): each copy in, the version it replaces out. */
export async function replaceMentions(tx: Tx, tenantId: string, copies: MentionCopy[]): Promise<number> {
  for (const copy of copies) {
    await tx.$executeRaw`
      INSERT INTO journal_entry (tenant_id, customer_id, id, version, author, ciphertext, iv, key_version, replaces, deleted_at)
      VALUES (${tenantId}, ${copy.customerId}, ${copy.id}, ${copy.version}, 'owner', ${copy.ciphertext}, ${copy.iv}, ${copy.keyVersion},
              ${copy.replaces}, ${copy.deletedAt}::timestamptz)`;
    await tx.$executeRaw`DELETE FROM journal_entry WHERE tenant_id = ${tenantId} AND id = ${copy.id} AND version = ${copy.replaces}`;
  }
  return copies.length;
}

const TEXT_FIELDS = ["treatment", "observations", "advice", "nextVisit", "photos", "versions"];

/** True when an action as stored (audit row or replay) still carries journal text. */
export function actionHoldsText(action: unknown): boolean {
  const fields = action as { type?: unknown; entry?: unknown; [key: string]: unknown } | null;
  if (!fields || typeof fields !== "object") return false;
  if (fields.type === "journal/add") return !!fields.entry && typeof fields.entry === "object" && TEXT_FIELDS.some((key) => key in (fields.entry as object));
  if (fields.type === "journal/edit") return Object.keys(fields).some((key) => !["type", "id", "on", "customerId"].includes(key));
  return false;
}

export class JournalVault {
  constructor(private readonly key: JournalKey) {}

  /**
   * True when the configured key is the key its version was first used with: it decrypts the verifier stored for
   * that version in `journal_key`, which the first use stores. A wrong key of the same version is refused before it
   * reads or writes anything. Checked in every transaction that uses the key, never remembered across them: a
   * verifier stored by a transaction that then rolled back is no proof.
   */
  async verify(tx: Tx): Promise<boolean> {
    const read = () => tx.$queryRaw<Array<{ verifier: Uint8Array; iv: Uint8Array }>>`
      SELECT verifier, iv FROM journal_key WHERE key_version = ${this.key.version}`;
    let [stored] = await read();
    if (!stored) {
      const fresh = keyVerifier(this.key);
      await tx.$executeRaw`
        INSERT INTO journal_key (key_version, verifier, iv) VALUES (${this.key.version}, ${fresh.verifier}, ${fresh.iv}) ON CONFLICT (key_version) DO NOTHING`;
      [stored] = await read();
    }
    return !!stored && verifiesKey({ verifier: Buffer.from(stored.verifier), iv: Buffer.from(stored.iv) }, this.key);
  }

  /** Work on one tenant's rows inside a store transaction. `clock` stamps new and trashed rows. */
  open(tx: Tx, tenantId: string, clock: number): JournalSession {
    return new JournalSession(tx, tenantId, this.key, clock);
  }
}

export class JournalSession {
  private readonly contents = new Map<string, Map<number, JournalContent>>();
  private readonly owners = new Map<string, string>();
  private readonly top = new Map<string, number>();
  private readonly loaded = new Set<string>();
  private readonly pending: PendingRow[] = [];
  private readonly places: Array<{ ids: string[]; trashed: boolean }> = [];
  /** Entries the sealed document has only in the trash: a version stored for one is stored trashed. */
  private trashedNow = new Set<string>();

  constructor(private readonly tx: Tx, private readonly tenantId: string, private readonly key: JournalKey, private readonly clock: number) {}

  private remember(row: StoredRow) {
    const content = decryptJournal(
      { ciphertext: Buffer.from(row.ciphertext), iv: Buffer.from(row.iv), keyVersion: row.key_version },
      { tenantId: this.tenantId, customerId: row.customer_id, id: row.id, version: row.version }, this.key);
    const versions = this.contents.get(row.id) ?? this.contents.set(row.id, new Map()).get(row.id)!;
    versions.set(row.version, content);
    this.owners.set(row.id, row.customer_id);
    this.top.set(row.id, Math.max(this.top.get(row.id) ?? 0, row.version));
  }

  /** Reads and decrypts every stored version of these entries, once per entry. */
  async load(ids: Iterable<string>) {
    const missing = [...new Set(ids)].filter((id) => !this.loaded.has(id));
    if (!missing.length) return;
    const rows = await this.tx.$queryRaw<StoredRow[]>`
      SELECT id, customer_id, version, ciphertext, iv, key_version FROM journal_entry
      WHERE tenant_id = ${this.tenantId} AND id = ANY(${missing}::text[]) ORDER BY id, version`;
    for (const row of rows) this.remember(row);
    for (const id of missing) this.loaded.add(id);
  }

  /** The full entry of a stub; an entry that still carries its text is returned as it is. */
  async hydrate(entry: JournalEntry): Promise<JournalEntry> {
    if (!isStub(entry)) return entry;
    await this.load([entry.id]);
    const versions = this.contents.get(entry.id);
    if (this.owners.get(entry.id) !== entry.customerId) throw new JournalUnreadable();
    return hydrateJournal(entry, entry.sealed!.versions.map((version) => {
      const content = versions?.get(version);
      if (!content) throw new JournalUnreadable();
      return content;
    }));
  }

  /** The live entries the action's rules read, with their text. */
  async hydrateFor(state: DemoState, action: DemoAction): Promise<DemoState> {
    const wanted = READS_ALL.has(action.type) ? new Set(state.journals.map((entry) => entry.id))
      : READS_ENTRY.has(action.type) && "id" in action ? new Set([action.id]) : null;
    if (!wanted?.size) return state;
    const targets = state.journals.filter((entry) => wanted.has(entry.id) && isStub(entry));
    if (!targets.length) return state;
    await this.load(targets.map((entry) => entry.id));
    const full = new Map<JournalEntry, JournalEntry>();
    for (const entry of targets) full.set(entry, await this.hydrate(entry));
    return { ...state, journals: state.journals.map((entry) => full.get(entry) ?? entry) };
  }

  /** One customer's live entries with their text, in document order. */
  async readCustomer(state: DemoState, customerId: string): Promise<JournalEntry[]> {
    const entries = state.journals.filter((entry) => entry.customerId === customerId);
    await this.load(entries.filter(isStub).map((entry) => entry.id));
    const out: JournalEntry[] = [];
    for (const entry of entries) out.push(await this.hydrate(entry));
    return out;
  }

  private queue(customerId: string, id: string, content: JournalContent): number {
    const version = (this.top.get(id) ?? 0) + 1;
    this.top.set(id, version);
    const versions = this.contents.get(id) ?? this.contents.set(id, new Map()).get(id)!;
    versions.set(version, content);
    this.owners.set(id, customerId);
    this.pending.push({ customerId, id, version, content });
    return version;
  }

  /** The stored versions for an entry's contents: a version already stored with the same content is kept, anything else is queued. */
  private versionsFor(entry: JournalEntry, contents: JournalContent[]): number[] {
    const stored = this.contents.get(entry.id) ?? new Map<number, JournalContent>();
    const sameOwner = (this.owners.get(entry.id) ?? entry.customerId) === entry.customerId;
    const preferred = entry.sealed?.versions ?? [];
    const used = new Set<number>();
    return contents.map((content, i) => {
      const candidates = [preferred[i], ...[...stored.keys()].sort((a, b) => a - b)];
      const match = sameOwner ? candidates.find((v) => v !== undefined && !used.has(v) && stored.has(v) && sameContent(stored.get(v)!, content)) : undefined;
      const version = match ?? this.queue(entry.customerId, entry.id, content);
      used.add(version);
      return version;
    });
  }

  /**
   * The document as it is stored: every entry that carries text becomes a stub, and versions it has that are not
   * stored yet are queued for `flush`. The same entry in several places (the list and the undo data of its last
   * change) gets the same versions.
   */
  async seal(state: DemoState): Promise<DemoState> {
    const open = journalsIn(state).filter((entry) => !isStub(entry));
    if (!open.length) return state;
    await this.load(open.map((entry) => entry.id));
    const stubs = new Map<JournalEntry, JournalEntry>();
    const assigned = new Map<string, number[]>();
    for (const entry of open) {
      if (stubs.has(entry)) continue;
      const { contents, replacedOn } = versionsOf(entry);
      const key = JSON.stringify([entry.id, entry.customerId, contents, entry.sealed?.versions ?? null]);
      const versions = assigned.get(key) ?? this.versionsFor(entry, contents);
      assigned.set(key, versions);
      stubs.set(entry, journalStub(entry, { versions, replacedOn }));
    }
    const sealed = mapJournals(state, (entry) => stubs.get(entry) ?? entry);
    const { live, trashed } = journalPlaces(sealed);
    this.trashedNow = new Set([...trashed].filter((id) => !live.has(id)));
    return sealed;
  }

  /** Queues the trash marks for entries that left the live list (to the trash, or undone) and for entries that came back. */
  recordPlaces(before: DemoState, after: DemoState) {
    const was = journalPlaces(before);
    const now = journalPlaces(after);
    const gone = [...was.live, ...was.trashed].filter((id) => !now.live.has(id) && (was.live.has(id) || !now.trashed.has(id)));
    const back = [...now.live].filter((id) => !was.live.has(id));
    if (gone.length) this.places.push({ ids: [...new Set(gone)], trashed: true });
    if (back.length) this.places.push({ ids: back, trashed: false });
  }

  /** Writes what `seal` and `recordPlaces` queued, in this transaction. */
  async flush() {
    for (const row of this.pending.splice(0)) {
      const sealed = encryptJournal(row.content, { tenantId: this.tenantId, customerId: row.customerId, id: row.id, version: row.version }, this.key);
      await this.tx.$executeRaw`
        INSERT INTO journal_entry (tenant_id, customer_id, id, version, created_at, author, ciphertext, iv, key_version, deleted_at)
        VALUES (${this.tenantId}, ${row.customerId}, ${row.id}, ${row.version}, to_timestamp(${this.clock}::float8 / 1000), 'owner',
                ${sealed.ciphertext}, ${sealed.iv}, ${sealed.keyVersion}, ${this.trashedNow.has(row.id) ? new Date(this.clock) : null}::timestamptz)`;
    }
    for (const { ids, trashed } of this.places.splice(0)) {
      if (trashed) {
        await this.tx.$executeRaw`
          UPDATE journal_entry SET deleted_at = to_timestamp(${this.clock}::float8 / 1000)
          WHERE tenant_id = ${this.tenantId} AND id = ANY(${ids}::text[]) AND deleted_at IS NULL`;
      } else {
        await this.tx.$executeRaw`
          UPDATE journal_entry SET deleted_at = NULL WHERE tenant_id = ${this.tenantId} AND id = ANY(${ids}::text[]) AND deleted_at IS NOT NULL`;
      }
    }
  }

  /**
   * Before an erasure: a scrubbed copy, encrypted for the next version of its entry, of every stored version of
   * another customer's entry that names the erased customer. The erasure stores each copy and deletes the version it
   * replaces (studio_erase_journal_mentions), keeping its trash mark. Returns the copies and the renumbering for the
   * document's stubs. The application never writes `replaces` itself.
   */
  async scrubMentions(customerId: string, identifiers: readonly string[], marker: string): Promise<{ copies: MentionCopy[]; remap: Map<string, Map<number, number>> }> {
    const remap = new Map<string, Map<number, number>>();
    const copies: MentionCopy[] = [];
    if (!identifiers.length) return { copies, remap };
    const rows = await this.tx.$queryRaw<StoredRow[]>`
      SELECT id, customer_id, version, ciphertext, iv, key_version, deleted_at FROM journal_entry
      WHERE tenant_id = ${this.tenantId} AND customer_id <> ${customerId} ORDER BY id, version`;
    for (const row of rows) if (!this.loaded.has(row.id)) this.remember(row);
    for (const row of rows) this.loaded.add(row.id);
    for (const row of rows) {
      const content = this.contents.get(row.id)!.get(row.version)!;
      const scrubbed = scrubDeep(content, identifiers, marker);
      if (jsonEqual(scrubbed, content)) continue;
      const version = (this.top.get(row.id) ?? 0) + 1;
      this.top.set(row.id, version);
      this.contents.get(row.id)!.set(version, scrubbed);
      const sealed = encryptJournal(scrubbed, { tenantId: this.tenantId, customerId: row.customer_id, id: row.id, version }, this.key);
      copies.push({ id: row.id, customerId: row.customer_id, replaces: row.version, version, deletedAt: row.deleted_at ?? null, ...sealed });
      (remap.get(row.id) ?? remap.set(row.id, new Map()).get(row.id)!).set(row.version, version);
    }
    return { copies, remap };
  }

  /**
   * A stored replay result (a state copy of the last 24 hours) without journal text, once the document's text has
   * moved into the table; null when it holds none. An entry the document has under the same versions keeps its
   * stub, any other text-bearing entry is left out, and the entry's action loses its text as in the audit log.
   */
  replayWithoutText(result: StoredReplay, sealed: DemoState): StoredReplay | null {
    const state = result?.state;
    const action = result?.entry?.action;
    const textInState = !!state && typeof state === "object" && Array.isArray(state.journals) && holdsJournalText(state);
    const textInAction = actionHoldsText(action);
    if (!textInState && !textInAction) return null;
    const entry = textInAction ? { ...result.entry, action: auditAction(action as DemoAction) } : result.entry;
    if (!textInState) return { ...result, entry };
    const stubs = new Map(journalsIn(sealed).map((stub) => [stub.id, stub]));
    const kept = mapJournals(state!, (journal) => {
      if (isStub(journal)) return journal;
      const stub = stubs.get(journal.id);
      const stored = this.contents.get(journal.id);
      const { contents } = versionsOf(journal);
      const same = !!stub && !!stored && contents.length === stub.sealed!.versions.length &&
        contents.every((content, i) => { const at = stored.get(stub.sealed!.versions[i]); return !!at && sameContent(at, content); });
      return same ? stub! : null;
    });
    return { ...result, state: withoutJournalText(kept), ...(entry ? { entry } : {}) };
  }
}
