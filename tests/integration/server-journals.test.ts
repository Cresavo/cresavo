import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getJournals, POST as postJournal } from "../../src/app/api/owner/journals/route";
import { GET as getSalon } from "../../src/app/api/owner/salon/route";
import { POST as postAction } from "../../src/app/api/owner/salon/actions/route";
import { POST as postErase } from "../../src/app/api/owner/salon/erase/route";
import { customerExport } from "../../src/concept/customers/export";
import type { DemoState, JournalEntry } from "../../src/concept/data/types";
import { isStub, journalsIn } from "../../src/concept/journals/sealed";
import { decryptJournal, journalKey } from "../../src/concept/store/journal-crypto";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { ownerStore } from "../../src/lib/owner-store";
import { sessionKey } from "../../src/lib/owner-http";
import { openOwnerSession, OWNER_COOKIE, ownerFromCookie } from "../../src/lib/owner-session";

// Server-side journals (JOURNALS_ON_SERVER) through the owner routes, against a disposable local *_test
// database: text only in journal_entry, encrypted; stubs in the salon; one customer's journal per read, logged;
// versions, undo, trash, erasure, export, the lazy move of journals that were in the document, other salons, a
// missing key, and the flag off. The key and every secret are made at run time. All data is fictional.

const run = randomUUID().slice(0, 8);
const origin = "http://localhost";
// A key version of its own: journal_key keeps one verifier per version for the whole database.
const KEY_VERSION = 100_000 + Math.floor(Math.random() * 800_000);
const keyValue = `v${KEY_VERSION}:${randomBytes(32).toString("base64")}`;
const key = journalKey(keyValue)!;
const SECRET = `Fictional heel fissure ${run}`;
const ADVICE = `Private advice ${run}`;
const LATER = `Later observation ${run}`;

const holder = globalThis as typeof globalThis & { cresavoOwnerStore?: { close(): void } };
/** The owner store is built once per process with the flag and key of that moment; tests that change them start a new one. */
function freshStore() {
  holder.cresavoOwnerStore?.close();
  delete holder.cresavoOwnerStore;
}

async function owner(name: string) {
  const result = await createOwnerAccount({ email: `${name.toLowerCase().replace(/\s+/g, "-")}-${run}@example.test`, password: "a long fictional passphrase", salonName: name, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, cookie: `${OWNER_COOKIE}=${session!.value}`, session: sessionKey((await ownerFromCookie(session!.value))!) };
}

type Who = { cookie: string; session: string };
const anon: Who = { cookie: "", session: "" };

const json = (body: unknown, cookie: string) => ({ method: "POST", body: JSON.stringify(body), headers: { cookie, origin, host: "localhost", "content-type": "application/json" } });
const read = (cookie: string) => getSalon(new NextRequest(`${origin}/api/owner/salon`, { headers: { cookie } }));
const send = (cookie: string, body: unknown) => postAction(new NextRequest(`${origin}/api/owner/salon/actions`, json(body, cookie)));
const bound = (who: Who, init: { method?: string; body?: string; headers: Record<string, string> }) => ({ ...init, headers: { ...init.headers, "x-cresavo-session": who.session } });
const write = (who: Who, body: unknown) => postJournal(new NextRequest(`${origin}/api/owner/journals`, bound(who, json(body, who.cookie))));
const journalOf = (who: Who, customerId: string) =>
  getJournals(new NextRequest(`${origin}/api/owner/journals?customer=${encodeURIComponent(customerId)}`, bound(who, { headers: { cookie: who.cookie } })));

/** The session key of a cookie (what the salon load hands the studio for `x-cresavo-session`). */
const keyOf = async (cookie: string) => {
  const owner = await ownerFromCookie(cookie.slice(cookie.indexOf("=") + 1));
  return owner ? sessionKey(owner) : "";
};
const erase = async (cookie: string, body: unknown, session?: string) =>
  postErase(new NextRequest(`${origin}/api/owner/salon/erase`, bound({ cookie, session: session ?? await keyOf(cookie) }, json(body, cookie))));

const people = [
  { firstName: "Vera", lastName: `Journalsdottir${run}`, phone: "0700001111", email: `vera-${run}@example.test` },
  { firstName: "Olle", lastName: `Grannsson${run}`, phone: "0700002222", email: `olle-${run}@example.test` },
];

/** A salon with two customers. */
async function salon(name: string) {
  const a = await owner(name);
  const loaded = (await (await read(a.cookie)).json()) as { state: DemoState };
  const staffId = loaded.state.staff[0].id;
  const customers = people.map((p) => ({ ...p, category: "both", since: "2025-01-10", isRegular: false, tags: [], waitlist: false, preferredStaff: staffId }));
  const imported = await send(a.cookie, { action: { type: "customers/import", customers }, idempotencyKey: `import-${randomUUID()}` });
  expect(imported.status).toBe(200);
  const state = (await imported.json()).state as DemoState;
  const [vera, olle] = people.map((p) => state.customers.find((c) => c.lastName === p.lastName)!);
  return { ...a, staffId, vera, olle };
}

const add = (customerId: string, staffId: string, text: { treatment?: string; observations?: string; advice?: string } = {}) => ({
  type: "journal/add", entry: { customerId, date: "2026-11-20", staffId, treatment: text.treatment ?? "Fictional foot care", observations: text.observations ?? SECRET, advice: text.advice ?? ADVICE },
});

/** Everything stored for a tenant outside journal_entry, as text. */
async function storedText(tenantId: string) {
  const rows = await Promise.all(["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"].map((table) =>
    db.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${table} WHERE tenant_id = $1`, tenantId)));
  return JSON.stringify(rows, (_, value) => (typeof value === "bigint" ? Number(value) : value));
}

type Row = { id: string; customer_id: string; version: number; ciphertext: Uint8Array; iv: Uint8Array; key_version: number; replaces: number | null; deleted_at: Date | null };
const rows = (tenantId: string) => db.$queryRaw<Row[]>`
  SELECT id, customer_id, version, ciphertext, iv, key_version, replaces, deleted_at FROM journal_entry WHERE tenant_id = ${tenantId} ORDER BY id, version`;
const plain = (tenantId: string, row: Row) => decryptJournal({ ciphertext: Buffer.from(row.ciphertext), iv: Buffer.from(row.iv), keyVersion: row.key_version },
  { tenantId, customerId: row.customer_id, id: row.id, version: row.version }, key);
const views = async (tenantId: string) => ((await db.$queryRaw<Array<{ doc: DemoState }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId}`)[0].doc.journalAccess ?? []);

beforeAll(() => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("STUDIO_STORE_HMAC_SECRET", randomBytes(32).toString("hex"));
});

afterEach(() => {
  vi.stubEnv("JOURNALS_ON_SERVER", "");
  vi.stubEnv("JOURNAL_ENCRYPTION_KEY", "");
  freshStore();
});

afterAll(async () => {
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  const tenants = accounts.map((a) => a.tenantId);
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["journal_entry", "tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, tenants);
  await db.$executeRaw`DELETE FROM journal_key WHERE key_version = ${KEY_VERSION}`;
  vi.unstubAllEnvs();
  freshStore();
  await db.$disconnect();
});

const on = () => {
  vi.stubEnv("JOURNALS_ON_SERVER", "1");
  vi.stubEnv("JOURNAL_ENCRYPTION_KEY", keyValue);
  freshStore();
};

describe("server-side journals (JOURNALS_ON_SERVER=1)", () => {
  it("stores an entry encrypted, sends the salon a stub, and hands out one customer's text per logged read", async () => {
    on();
    const a = await salon("Salong Krypto");
    // Journal text goes to its own route only.
    expect((await send(a.cookie, { action: add(a.vera.id, a.staffId), idempotencyKey: "via-actions" })).status).toBe(400);
    const saved = await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "add-1" });
    expect(saved.status).toBe(200);
    const body = await saved.json();
    const stub = (body.state as DemoState).journals.find((j) => j.customerId === a.vera.id)!;
    expect(isStub(stub)).toBe(true);
    expect(stub.sealed).toEqual({ versions: [1], replacedOn: [] });
    expect(JSON.stringify(body)).not.toContain(SECRET);

    // Nothing outside journal_entry holds the text: not the document, the audit row, the replay or the outbox.
    expect(await storedText(a.tenantId)).not.toContain(SECRET);
    const audit = await db.$queryRaw<Array<{ action: unknown }>>`SELECT action FROM tenant_action WHERE tenant_id = ${a.tenantId} AND action->>'type' = 'journal/add'`;
    expect(audit.map((row) => row.action)).toEqual([{ type: "journal/add", entry: { id: stub.id, customerId: a.vera.id, date: "2026-11-20", staffId: a.staffId } }]);
    const [row] = await rows(a.tenantId);
    expect(row).toMatchObject({ id: stub.id, customer_id: a.vera.id, version: 1, key_version: KEY_VERSION, replaces: null, deleted_at: null });
    expect(Buffer.from(row.ciphertext).toString("utf8")).not.toContain("Fictional");
    expect(plain(a.tenantId, row)).toMatchObject({ observations: SECRET, advice: ADVICE });

    // The salon load carries stubs, says so, and logs nothing.
    const loaded = await (await read(a.cookie)).json();
    expect(loaded.journals).toBe("server");
    expect(JSON.stringify(loaded.state)).not.toContain(SECRET);
    expect(await views(a.tenantId)).toEqual([]);

    // The journal read returns the text and logs a read of that customer, once a minute per reader.
    const first = await journalOf(a, a.vera.id);
    expect(first.status).toBe(200);
    const read1 = await first.json();
    expect(read1.entries).toEqual([expect.objectContaining({ id: stub.id, observations: SECRET, advice: ADVICE, sealed: { versions: [1], replacedOn: [] } })]);
    expect(await views(a.tenantId)).toEqual([expect.objectContaining({ actor: "owner", customerId: a.vera.id })]);
    const again = await (await journalOf(a, a.vera.id)).json();
    expect(again.entries).toEqual(read1.entries);
    expect(await views(a.tenantId)).toHaveLength(1);
    expect((await (await journalOf(a, a.olle.id)).json()).entries).toEqual([]);
    expect((await views(a.tenantId)).map((v: { customerId?: string }) => v.customerId)).toEqual([a.olle.id, a.vera.id]);

    // A replay of the same write: the same answer, no second row.
    const replay = await (await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "add-1" })).json();
    expect(replay).toMatchObject({ replayed: true, version: body.version });
    expect(await rows(a.tenantId)).toHaveLength(1);
    // The export of the customer's data holds the decrypted journal, merged into the salon the studio holds.
    const merged = { ...loaded.state, journals: loaded.state.journals.map((j: JournalEntry) => read1.entries.find((e: JournalEntry) => e.id === j.id) ?? j) };
    const exported = customerExport(merged, a.vera.id, new Date().toISOString())!;
    expect(JSON.stringify(exported.journal)).toContain(SECRET);
    expect(JSON.stringify(customerExport(loaded.state, a.vera.id, new Date().toISOString())!.journal)).not.toContain(SECRET);

    // Refusals: a signed-out caller, a bad id, an unknown customer, an action that is not a journal write.
    expect((await journalOf(anon, a.vera.id)).status).toBe(401);
    expect((await journalOf(a, "../x")).status).toBe(400);
    expect((await journalOf(a, "k-404")).status).toBe(404);
    expect((await write(a, { action: { type: "card/dismiss", id: "x" }, idempotencyKey: "other-1" })).status).toBe(400);
    expect((await write(anon, { action: add(a.vera.id, a.staffId), idempotencyKey: "anon-1" })).status).toBe(401);
  });

  it("appends a version for every edit; undo, trash and restore move only the pointers and the trash mark", async () => {
    on();
    const a = await salon("Salong Version");
    const added = await (await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "v-add" })).json();
    const id = (added.state as DemoState).journals[0].id;
    const content = { treatment: "Fictional foot care", observations: LATER, advice: ADVICE };
    const edited = await write(a, { action: { type: "journal/edit", id, content, on: "2026-11-23" }, idempotencyKey: "v-edit" });
    expect(edited.status).toBe(200);
    expect((await edited.json()).state.journals[0].sealed).toEqual({ versions: [1, 2], replacedOn: ["2026-11-23"] });
    const entries = (await (await journalOf(a, a.vera.id)).json()).entries;
    expect(entries[0]).toMatchObject({ observations: LATER, versions: [{ observations: SECRET, replacedOn: "2026-11-23" }] });
    expect((await rows(a.tenantId)).map((r) => r.version)).toEqual([1, 2]);
    const audit = await db.$queryRaw<Array<{ action: unknown }>>`SELECT action FROM tenant_action WHERE tenant_id = ${a.tenantId} AND action->>'type' = 'journal/edit'`;
    expect(audit.map((r) => r.action)).toEqual([{ type: "journal/edit", id, on: "2026-11-23" }]);
    // An edit that changes nothing is refused and stores nothing.
    expect((await write(a, { action: { type: "journal/edit", id, content, on: "2026-11-23" }, idempotencyKey: "v-same" })).status).toBe(422);
    expect(await rows(a.tenantId)).toHaveLength(2);

    // Undo goes back to version 1; the rows stay (append-only).
    const salonNow = (await (await read(a.cookie)).json()).state as DemoState;
    const undone = await send(a.cookie, { action: { type: "log/undo", id: salonNow.log.find((l) => l.type === "journal/edit")!.id }, idempotencyKey: "v-undo" });
    expect(undone.status).toBe(200);
    expect((await undone.json()).state.journals[0].sealed).toEqual({ versions: [1], replacedOn: [] });
    expect((await (await journalOf(a, a.vera.id)).json()).entries[0]).toMatchObject({ observations: SECRET });
    expect(await rows(a.tenantId)).toHaveLength(2);

    // The customer to the trash: rows marked, their journal not readable; restored: unmarked and readable again.
    const deleted = await (await send(a.cookie, { action: { type: "customer/delete", id: a.vera.id }, idempotencyKey: "v-delete" })).json();
    expect((await rows(a.tenantId)).every((r) => r.deleted_at !== null)).toBe(true);
    expect((await journalOf(a, a.vera.id)).status).toBe(404);
    const trashId = (deleted.state as DemoState).trash.find((t) => t.kind === "customer")!.id;
    expect((await send(a.cookie, { action: { type: "trash/restore", id: trashId }, idempotencyKey: "v-restore" })).status).toBe(200);
    expect((await rows(a.tenantId)).every((r) => r.deleted_at === null)).toBe(true);
    expect((await (await journalOf(a, a.vera.id)).json()).entries[0]).toMatchObject({ observations: SECRET });
    expect(await storedText(a.tenantId)).not.toMatch(new RegExp(`${SECRET}|${LATER}`));
  });

  it("erases a customer's rows, and replaces another customer's version that names them by a scrubbed copy", async () => {
    on();
    const a = await salon("Salong Radera Journal");
    await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "e-vera" });
    const name = `${a.vera.firstName} ${a.vera.lastName}`;
    await write(a, { action: add(a.olle.id, a.staffId, { observations: `Came with ${name} today` }), idempotencyKey: "e-olle" });
    const before = await rows(a.tenantId);
    expect(before.map((r) => r.customer_id).sort()).toEqual([a.olle.id, a.vera.id].sort());

    const erased = await erase(a.cookie, { customerId: a.vera.id, name });
    expect(erased.status).toBe(200);
    const after = await rows(a.tenantId);
    expect(after.map((r) => [r.customer_id, r.version, r.replaces])).toEqual([[a.olle.id, 2, 1]]);
    const all = after.map((r) => JSON.stringify(plain(a.tenantId, r))).join(" ");
    expect(all).not.toContain(a.vera.lastName);
    expect(all).toContain("[removed]");
    const olle = (await (await journalOf(a, a.olle.id)).json()).entries;
    expect(olle[0].observations).toBe("Came with [removed] today");
    expect(olle[0].sealed.versions).toEqual([2]);
    expect(await storedText(a.tenantId)).not.toMatch(new RegExp(`${a.vera.lastName}|${SECRET}`));
    // Again: safe, nothing left to do.
    expect((await erase(a.cookie, { customerId: a.vera.id, name })).status).toBe(200);
    expect(await rows(a.tenantId)).toHaveLength(1);
  });

  it("moves journals that were in the document into the table once, on the first load or save, under the lock", async () => {
    on();
    const a = await salon("Salong Flytt");
    const b = await salon("Salong Flytt Spara");
    // As the document was before the flag: entries with text, one edited (versions and undo data), one in the trash, and a replay holding a copy.
    for (const target of [a, b]) {
      freshStore();
      vi.stubEnv("JOURNALS_ON_SERVER", "");
      await send(target.cookie, { action: add(target.vera.id, target.staffId), idempotencyKey: "m-add-vera" });
      const withOlle = await (await send(target.cookie, { action: add(target.olle.id, target.staffId, { advice: "Olle advice" }), idempotencyKey: "m-add-olle" })).json();
      const id = (withOlle.state as DemoState).journals.find((j) => j.customerId === target.vera.id)!.id;
      await send(target.cookie, { action: { type: "journal/edit", id, content: { treatment: "Fictional foot care", observations: LATER, advice: ADVICE }, on: "2026-11-21" }, idempotencyKey: "m-edit" });
      await send(target.cookie, { action: { type: "customer/delete", id: target.olle.id }, idempotencyKey: "m-delete" });
      expect(await storedText(target.tenantId)).toContain(SECRET);
    }
    on();
    const version = async (tenantId: string) => (await db.$queryRaw<Array<{ version: number }>>`SELECT version FROM tenant_state WHERE tenant_id = ${tenantId}`)[0].version;
    const startA = await version(a.tenantId);

    // Two loads at once: one moves the text, the other finds stubs. Every place in the document points at the same rows.
    const [first, second] = await Promise.all([read(a.cookie), read(a.cookie)]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await version(a.tenantId)).toBe(startA + 1);
    const doc = (await db.$queryRaw<Array<{ doc: DemoState }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${a.tenantId}`)[0].doc;
    expect(journalsIn(doc).length).toBeGreaterThan(2);
    expect(journalsIn(doc).every(isStub)).toBe(true);
    // Vera's entry has two versions, Olle's (in the trash) one, plus the version the undo data of the edit points at.
    const moved = (await rows(a.tenantId)).map((r) => `${r.customer_id === a.vera.id ? "vera" : "olle"} v${r.version} ${r.deleted_at === null ? "live" : "trashed"}`);
    expect(moved.sort()).toEqual(["olle v1 trashed", "vera v1 live", "vera v2 live"]);
    const seal = await db.$queryRaw<Array<{ action: unknown; actor: string }>>`SELECT action, actor FROM tenant_action WHERE tenant_id = ${a.tenantId} AND action->>'type' = 'system/seal-journals'`;
    expect(seal).toEqual([{ action: { type: "system/seal-journals", payload: {} }, actor: "system" }]);
    // The document, the replays of the last day and the audit rows from before the flag no longer hold the text, and
    // only then is the salon marked. An old journal/add keeps its entry without text, with the entry it made.
    const replays = await db.$queryRaw<Array<{ result: unknown }>>`SELECT result FROM tenant_idempotency WHERE tenant_id = ${a.tenantId}`;
    expect(JSON.stringify(replays)).not.toMatch(new RegExp(`${SECRET}|${LATER}|Olle advice`));
    const auditRows = await db.$queryRaw<Array<{ action: { type: string; entry?: Record<string, unknown> } }>>`
      SELECT action FROM tenant_action WHERE tenant_id = ${a.tenantId} AND action->>'type' IN ('journal/add', 'journal/edit') ORDER BY seq`;
    expect(JSON.stringify(auditRows)).not.toMatch(new RegExp(`${SECRET}|${LATER}|Olle advice|Fictional foot care`));
    const veraId = doc.journals.find((j) => j.customerId === a.vera.id)!.id;
    // The commit from before the flag recorded no entry id, so none is added: an id is never guessed.
    expect(auditRows.map((r) => r.action)).toEqual([
      { type: "journal/add", entry: { customerId: a.vera.id, date: "2026-11-20", staffId: a.staffId } },
      { type: "journal/add", entry: { customerId: a.olle.id, date: "2026-11-20", staffId: a.staffId } },
      { type: "journal/edit", id: veraId, on: "2026-11-21" },
    ]);
    expect(await ownerStore().journalsSealed(a.tenantId)).toBe(true);
    expect(await ownerStore().journalsSealed(b.tenantId)).toBe(false);
    expect(JSON.stringify(doc)).not.toMatch(new RegExp(`${SECRET}|${LATER}|Olle advice`));
    const vera = (await (await journalOf(a, a.vera.id)).json()).entries;
    expect(vera[0]).toMatchObject({ observations: LATER, versions: [{ observations: SECRET, replacedOn: "2026-11-21" }] });

    // Idempotent: another load and a direct second run change nothing.
    await read(a.cookie);
    expect(await ownerStore().sealJournals(a.tenantId)).toEqual({ ok: true, changed: false, sealed: true });
    expect(await version(a.tenantId)).toBe(startA + 2); // the journal read above logged one view
    expect(await rows(a.tenantId)).toHaveLength(3);

    // The first save moves them too, in the same transaction as the change.
    const startB = await version(b.tenantId);
    expect((await send(b.cookie, { action: { type: "card/dismiss", id: "fictional-card" }, idempotencyKey: "m-save" })).status).toBe(200);
    expect(await version(b.tenantId)).toBe(startB + 1);
    expect(await rows(b.tenantId)).toHaveLength(3);
    const docB = (await db.$queryRaw<Array<{ doc: DemoState }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${b.tenantId}`)[0].doc;
    expect(journalsIn(docB).every(isStub)).toBe(true);
    // The save moved the document and cleaned the audit rows; the replays are the next load's, which marks the salon.
    expect(await ownerStore().journalsSealed(b.tenantId)).toBe(false);
    await read(b.cookie);
    expect(await ownerStore().journalsSealed(b.tenantId)).toBe(true);
    expect(await storedText(b.tenantId)).not.toMatch(new RegExp(`${SECRET}|${LATER}|Olle advice`));
  });

  it("cleans many replays in bounded batches, and unmarks a salon when a replacement brings text back", async () => {
    vi.stubEnv("JOURNALS_ON_SERVER", "");
    freshStore();
    const a = await salon("Salong Manga Svar");
    await send(a.cookie, { action: add(a.vera.id, a.staffId), idempotencyKey: "b-add" });
    // Sixty keyed changes before the flag: each stored replay holds a copy of the salon with the journal text.
    for (let i = 0; i < 60; i++) await send(a.cookie, { action: { type: "card/dismiss", id: `fictional-card-${i}` }, idempotencyKey: `b-${i}` });
    const replaysWithText = async () => (await db.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM tenant_idempotency WHERE tenant_id = ${a.tenantId} AND result::text LIKE ${`%${SECRET}%`}`)[0].n;
    expect(await replaysWithText()).toBe(61);
    on();
    expect((await read(a.cookie)).status).toBe(200);
    expect(await replaysWithText()).toBe(0);
    expect(await ownerStore().journalsSealed(a.tenantId)).toBe(true);
    // A keyed retry of an old change still replays, from its cleaned copy.
    const retried = await (await send(a.cookie, { action: { type: "card/dismiss", id: "fictional-card-3" }, idempotencyKey: "b-3" })).json();
    expect(retried.replayed).toBe(true);
    expect(JSON.stringify(retried)).not.toContain(SECRET);
    // With the flag off, a replacement that brings journal text back unmarks the salon in the same write.
    vi.stubEnv("JOURNALS_ON_SERVER", "");
    freshStore();
    const legacy = (await (await read(a.cookie)).json()).state as DemoState;
    const withText = { ...legacy, journals: legacy.journals.map((j) => ({ ...j, sealed: undefined, observations: SECRET })) };
    expect((await ownerStore().replaceState(a.tenantId, withText, { actor: "system", reason: "fictional restore" })).ok).toBe(true);
    expect(await ownerStore().journalsSealed(a.tenantId)).toBe(false);
  });

  it("binds every journal request to the session the salon was loaded in, and keeps reads the server's own", async () => {
    on();
    const a = await salon("Salong Session");
    await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "s-add" });
    const loaded = await (await read(a.cookie)).json();
    expect(loaded.session).toBe(a.session);
    // Another account's tab (or a change queued there) names another session: refused before anything is read or written.
    const other = await salon("Salong Annan Session");
    for (const who of [{ cookie: a.cookie, session: other.session }, { cookie: a.cookie, session: "" }]) {
      expect((await journalOf(who, a.vera.id)).status).toBe(409);
      expect((await write(who, { action: add(a.vera.id, a.staffId), idempotencyKey: `s-${who.session}` })).status).toBe(409);
    }
    expect(await rows(a.tenantId)).toHaveLength(1);
    expect(await views(a.tenantId)).toEqual([]);
    // An erasure asked in another login is refused before anything is looked up, and the customer stays.
    const name = `${a.vera.firstName} ${a.vera.lastName}`;
    expect((await erase(a.cookie, { customerId: a.vera.id, name }, other.session)).status).toBe(409);
    expect((await erase(a.cookie, { customerId: a.vera.id, name }, "")).status).toBe(409);
    expect((await (await read(a.cookie)).json()).state.customers.some((c: { id: string }) => c.id === a.vera.id)).toBe(true);
    // A new sign-in to the same account is a new login: its key differs, and the old key is refused with the new cookie.
    const current = (await ownerFromCookie(a.cookie.slice(a.cookie.indexOf("=") + 1)))!;
    const again = await openOwnerSession({ id: current.accountId, credentialVersion: current.credentialVersion });
    const relogin = { cookie: `${OWNER_COOKIE}=${again!.value}`, session: sessionKey((await ownerFromCookie(again!.value))!) };
    expect(relogin.session).not.toBe(a.session);
    expect((await journalOf({ cookie: relogin.cookie, session: a.session }, a.vera.id)).status).toBe(409);
    expect((await journalOf(relogin, a.vera.id)).status).toBe(200);
    // A read the studio reports is refused while the server keeps journals: only the server's own reads are logged.
    expect((await send(a.cookie, { action: { type: "journal/view", customerId: a.vera.id, actor: "owner" }, idempotencyKey: "s-view" })).status).toBe(400);
    await journalOf(a, a.vera.id);
    expect(await views(a.tenantId)).toEqual([expect.objectContaining({ customerId: a.vera.id, served: true })]);
  });

  it("refuses every change while the document still holds text and no working key is configured, and a wrong key", async () => {
    vi.stubEnv("JOURNALS_ON_SERVER", "");
    freshStore();
    const legacy = await salon("Salong Fel Nyckel");
    await send(legacy.cookie, { action: add(legacy.vera.id, legacy.staffId), idempotencyKey: "w-legacy" });
    const before = (await db.$queryRaw<Array<{ version: number; doc: unknown }>>`SELECT version, doc FROM tenant_state WHERE tenant_id = ${legacy.tenantId}`)[0];
    const keys = async () => (await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM tenant_idempotency WHERE tenant_id = ${legacy.tenantId}`)[0].n;
    const keysBefore = await keys();
    const unchanged = async () => {
      const now = (await db.$queryRaw<Array<{ version: number; doc: unknown }>>`SELECT version, doc FROM tenant_state WHERE tenant_id = ${legacy.tenantId}`)[0];
      expect(now.version).toBe(before.version);
      expect(await keys()).toBe(keysBefore);
      expect(await rows(legacy.tenantId)).toEqual([]);
    };
    // The flag on without a key: an unrelated change is refused under the lock, the document is not written again.
    vi.stubEnv("JOURNALS_ON_SERVER", "1");
    freshStore();
    expect((await send(legacy.cookie, { action: { type: "card/dismiss", id: "fictional-card" }, idempotencyKey: "w-dismiss" })).status).toBe(503);
    await unchanged();
    // A key of a version already used with another key: refused before it reads or writes anything.
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", keyValue);
    freshStore();
    expect((await read(legacy.cookie)).status).toBe(200);
    const sealedBefore = (await db.$queryRaw<Array<{ version: number }>>`SELECT version FROM tenant_state WHERE tenant_id = ${legacy.tenantId}`)[0].version;
    const impostor = `v${KEY_VERSION}:${randomBytes(32).toString("base64")}`;
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", impostor);
    freshStore();
    expect((await write(legacy, { action: add(legacy.vera.id, legacy.staffId, { observations: "written under the wrong key" }), idempotencyKey: "w-wrong" })).status).toBe(503);
    expect((await journalOf(legacy, legacy.vera.id)).status).toBe(503);
    expect((await db.$queryRaw<Array<{ version: number }>>`SELECT version FROM tenant_state WHERE tenant_id = ${legacy.tenantId}`)[0].version).toBe(sealedBefore);
    expect(await rows(legacy.tenantId)).toHaveLength(1);
  });

  it("erases a salon with encrypted journals only with a working key, whatever the flag says", async () => {
    on();
    const a = await salon("Salong Utan Flagga");
    await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "f-vera" });
    await write(a, { action: add(a.olle.id, a.staffId, { observations: `Came with ${a.vera.firstName} ${a.vera.lastName}` }), idempotencyKey: "f-olle" });
    const name = `${a.vera.firstName} ${a.vera.lastName}`;
    // A restore without the flag and without the key: refused, nothing erased, never reported done.
    vi.stubEnv("JOURNALS_ON_SERVER", "");
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", "");
    freshStore();
    expect((await erase(a.cookie, { customerId: a.vera.id, name })).status).toBe(503);
    expect(await rows(a.tenantId)).toHaveLength(2);
    // Without the flag but with the key, the erasure scrubs the other customer's entry as with the flag on.
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", keyValue);
    freshStore();
    expect((await erase(a.cookie, { customerId: a.vera.id, name })).status).toBe(200);
    const left = await rows(a.tenantId);
    expect(left.map((r) => [r.customer_id, r.replaces])).toEqual([[a.olle.id, 1]]);
    expect(JSON.stringify(plain(a.tenantId, left[0]))).not.toContain(a.vera.lastName);
  });

  it("keeps salons apart: no read, write or row of another salon's journal", async () => {
    on();
    const a = await salon("Salong Egen");
    const b = await salon("Salong Annan Journal");
    // A customer only A has (ids are per salon, so both salons also have a k-1 of their own).
    const extra = await (await send(a.cookie, { action: { type: "customers/import", customers: [{ firstName: "Cecilia", lastName: `Endast${run}`, phone: "0700003333", email: `cecilia-${run}@example.test`,
      category: "both", since: "2025-01-10", isRegular: false, tags: [], waitlist: false, preferredStaff: a.staffId }] }, idempotencyKey: "x-import" })).json();
    const onlyA = (extra.state as DemoState).customers.find((c) => c.firstName === "Cecilia")!;
    expect((await (await read(b.cookie)).json()).state.customers.some((c: { id: string }) => c.id === onlyA.id)).toBe(false);
    const added = await (await write(a, { action: add(onlyA.id, a.staffId), idempotencyKey: "x-add" })).json();
    const id = (added.state as DemoState).journals.find((j) => j.customerId === onlyA.id)!.id;
    // B's session names A's customer and A's entry: not found, refused; nothing of A's is read or written.
    expect((await journalOf(b, onlyA.id)).status).toBe(404);
    expect((await write(b, { action: { type: "journal/edit", id, content: { treatment: "x", observations: "y", advice: "z" }, on: "2026-11-23" }, idempotencyKey: "x-edit" })).status).toBe(422);
    expect((await write(b, { action: add(onlyA.id, b.staffId), idempotencyKey: "x-add-b" })).status).toBe(422);
    expect(await rows(b.tenantId)).toEqual([]);
    expect(await rows(a.tenantId)).toHaveLength(1);
    expect(await views(a.tenantId)).toEqual([]);
    expect(await ownerStore().readJournals(b.tenantId, onlyA.id)).toEqual({ ok: false, reason: "not-found" });
    // B's own customer with the same id as one of A's reads B's journal only.
    const same = await (await journalOf(b, a.vera.id)).json();
    expect(a.vera.id).toBe(b.vera.id);
    expect(same.entries).toEqual([]);
    expect(JSON.stringify(same)).not.toContain(SECRET);
    // B's own entry reads B's row, and A's still reads A's.
    const bAdded = await (await write(b, { action: add(b.vera.id, b.staffId, { observations: "B's own text" }), idempotencyKey: "x-b" })).json();
    const bId = (bAdded.state as DemoState).journals[0].id;
    expect((await (await journalOf(b, b.vera.id)).json()).entries).toEqual([expect.objectContaining({ id: bId, observations: "B's own text" })]);
    expect((await (await journalOf(a, onlyA.id)).json()).entries).toEqual([expect.objectContaining({ id, observations: SECRET })]);
    // A's row copied onto B's tenant does not decrypt there: the associated data names the salon and the customer.
    const [row] = await rows(a.tenantId);
    expect(() => plain(b.tenantId, row)).toThrow();
    expect(() => plain(a.tenantId, { ...row, customer_id: a.vera.id })).toThrow();
  });

  it("answers 503 without the key, and serves the salon without journal text", async () => {
    on();
    const a = await salon("Salong Utan Nyckel");
    await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "k-add" });
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", "");
    freshStore();
    expect((await journalOf(a, a.vera.id)).status).toBe(503);
    expect((await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "k-add-2" })).status).toBe(503);
    expect((await erase(a.cookie, { customerId: a.vera.id, name: `${a.vera.firstName} ${a.vera.lastName}` })).status).toBe(503);
    const loaded = await read(a.cookie);
    expect(loaded.status).toBe(200);
    const body = await loaded.json();
    expect(body.journals).toBe("server");
    expect(journalsIn(body.state).every(isStub)).toBe(true);
    // A legacy document is never served with its text, and is not moved without the key.
    vi.stubEnv("JOURNALS_ON_SERVER", "");
    freshStore();
    const legacy = await salon("Salong Gammal Utan Nyckel");
    await send(legacy.cookie, { action: add(legacy.vera.id, legacy.staffId), idempotencyKey: "k-legacy" });
    vi.stubEnv("JOURNALS_ON_SERVER", "1");
    freshStore();
    const served = await (await read(legacy.cookie)).json();
    expect(JSON.stringify(served.state)).not.toContain(SECRET);
    expect(served.state.journals).toEqual([]);
    expect(await rows(legacy.tenantId)).toEqual([]);
    // A malformed key is no key.
    vi.stubEnv("JOURNAL_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    freshStore();
    expect((await journalOf(a, a.vera.id)).status).toBe(503);
  });

  it("with the flag off, behaves as before: no journal route, text in the document, the load logged", async () => {
    const a = await salon("Salong Av");
    expect((await journalOf(a, a.vera.id)).status).toBe(404);
    expect((await write(a, { action: add(a.vera.id, a.staffId), idempotencyKey: "off-1" })).status).toBe(404);
    expect((await send(a.cookie, { action: add(a.vera.id, a.staffId), idempotencyKey: "off-2" })).status).toBe(200);
    const loaded = await (await read(a.cookie)).json();
    expect(loaded).not.toHaveProperty("journals");
    expect(loaded.state.journals[0]).toMatchObject({ observations: SECRET });
    expect(loaded.state.journals[0]).not.toHaveProperty("sealed");
    expect(loaded.state.journalAccess).toEqual([expect.not.objectContaining({ customerId: expect.anything() })]);
    expect(await rows(a.tenantId)).toEqual([]);
  });
});
