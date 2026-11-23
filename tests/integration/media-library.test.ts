import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listRoute, POST as uploadRoute } from "../../src/app/api/owner/media/route";
import { DELETE as deleteRoute, GET as readRoute, PATCH as patchRoute } from "../../src/app/api/owner/media/[id]/route";
import { POST as restoreRoute } from "../../src/app/api/owner/media/[id]/restore/route";
import { GET as publicRoute } from "../../src/app/api/public/media/[id]/[sha256]/route";
import { POST as actionRoute } from "../../src/app/api/owner/salon/actions/route";
import { POST as posterRoute } from "../../src/app/api/concept/poster/route";
import { createDatabaseClient } from "../../scripts/database.mjs";
import type { DemoState } from "../../src/concept/data/types";
import { db } from "../../src/lib/db";
import { deleteMedia, findMedia, listMedia, restoreMedia, setAltText, uploadMedia } from "../../src/lib/media/library";
import { MAX_PHOTOS, PURGE_AFTER_DAYS } from "../../src/lib/media/limits";
import { sweepDeletedMedia } from "../../src/lib/media/sweep";
import { mediaKey, type MediaStore } from "../../src/lib/media-store";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { sessionKey } from "../../src/lib/owner-http";
import { openOwnerSession, OWNER_COOKIE, ownerFromCookie } from "../../src/lib/owner-session";
import { ownerStore } from "../../src/lib/owner-store";
import { GPS_MARK, metadataWebp, phoneJpeg, realPng } from "../media-fixtures";

// The photo library against a disposable local *_test database: upload, deduplication, limits (deleted
// pictures count until purged), the logo published by saving the page, serving, deletion with undo, the
// sweep (pending uploads, per-object retries, keys checked), two salons trying each other's pictures, and
// the least-privilege logins of prisma/grants/roles.sql. The routes run on DATABASE_URL, which may be the
// app login; fixtures and clean-up use TEST_ADMIN_DATABASE_URL when set (the schema owner). Generated
// images and fictional accounts only.

const run = randomUUID().slice(0, 8);
const origin = "http://localhost";
const clients: PrismaClient[] = [];
const admin = createDatabaseClient(process.env.TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL, 3) as PrismaClient;
clients.push(admin);

interface Owner { tenantId: string; accountId: string; cookie: string; session: string }

async function owner(label: string): Promise<Owner> {
  const result = await createOwnerAccount({ email: `${label}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong ${label} ${run}`, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, accountId: result.identity.id, cookie: `${OWNER_COOKIE}=${session!.value}`, session: sessionKey((await ownerFromCookie(session!.value))!) };
}

const request = (path: string, { cookie, method = "GET", body, headers = {} }: { cookie?: string; method?: string; body?: BodyInit; headers?: Record<string, string> } = {}) =>
  new NextRequest(`${origin}${path}`, {
    method, body,
    headers: { ...(cookie && { cookie }), ...(method !== "GET" && { origin, host: "localhost" }), ...headers },
  });
const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const upload = (who: Owner, bytes: Buffer, kind = "photo", session: string | null = who.session) =>
  uploadRoute(request(`/api/owner/media?kind=${kind}`, { cookie: who.cookie, method: "POST", body: new Uint8Array(bytes), headers: session === null ? {} : { "x-cresavo-session": session } }));
const read = (who: Owner, id: string, headers: Record<string, string> = {}) => readRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, headers }), params({ id }));
const patch = (who: Owner, id: string, altText: string | null) =>
  patchRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, method: "PATCH", body: JSON.stringify({ altText }), headers: { "content-type": "application/json" } }), params({ id }));
const remove = (who: Owner, id: string) => deleteRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, method: "DELETE" }), params({ id }));
const restore = (who: Owner, id: string) => restoreRoute(request(`/api/owner/media/${id}/restore`, { cookie: who.cookie, method: "POST" }), params({ id }));
const publicLogo = (url: string, cookie?: string) => {
  const [, , , , id, sha256] = url.split("/");
  return publicRoute(request(url, { cookie }), params({ id, sha256 }));
};
const body = async (response: Response) => Buffer.from(await response.arrayBuffer());
const row = (id: string) => admin.mediaAsset.findUniqueOrThrow({ where: { id } });
const DAY = 86_400_000;

let keys = 0;
/** Saves the salon's page with this logo, the way the studio's editor does. */
async function savePage(who: Owner, logo: string | null) {
  const { state } = (await ownerStore().load(who.tenantId))! as { state: DemoState };
  const page = { ...state.page, theme: { ...state.page.theme, logo } };
  return actionRoute(request("/api/owner/salon/actions", {
    cookie: who.cookie, method: "POST", headers: { "content-type": "application/json", "x-cresavo-session": who.session },
    body: JSON.stringify({ action: { type: "page/set", page }, idempotencyKey: `media-${run}-${++keys}` }),
  }));
}

/** A small row straight into the table, for filling a library up to its limits. */
const filler = (tenantId: string, n: number, byteSize = 1) => {
  const id = randomUUID();
  return {
    id, tenantId, kind: "photo", contentType: "image/png", byteSize, width: 1, height: 1,
    sha256: createHash("sha256").update(`${run}-${tenantId}-${n}`).digest("hex"), storage: "postgres", storageKey: mediaKey(tenantId, id), bytes: new Uint8Array([n & 0xff]),
  };
};

let a: Owner, b: Owner;

beforeAll(async () => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("STUDIO_STORE_HMAC_SECRET", process.env.STUDIO_STORE_HMAC_SECRET ?? randomBytes(32).toString("hex"));
  vi.stubEnv("MEDIA_STORE", "postgres");
  a = await owner("media-a");
  b = await owner("media-b");
});

afterAll(async () => {
  const accounts = await admin.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  const tenants = accounts.map((account) => account.tenantId);
  await admin.mediaAsset.deleteMany({ where: { tenantId: { in: tenants } } });
  await admin.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"]) await admin.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, tenants);
  vi.unstubAllEnvs();
  await Promise.all([db.$disconnect(), ...clients.map((client) => client.$disconnect())]);
});

describe("upload", () => {
  it("stores a photo rebuilt without metadata and serves it to its owner with private, revalidated caching", async () => {
    const response = await upload(a, phoneJpeg({ orientation: 6 }));
    expect(response.status).toBe(200);
    const { asset, deduped, session } = await response.json();
    expect(deduped).toBe(false);
    expect(session).toMatch(/^\w+\.\d+\.[0-9a-f]{16}$/);
    expect(asset).toMatchObject({ kind: "photo", contentType: "image/jpeg", width: 480, height: 640, altText: null, url: `/api/owner/media/${asset.id}` });
    expect(Object.keys(asset).sort()).toEqual(["altText", "byteSize", "contentType", "createdAt", "height", "id", "kind", "url", "width"]);

    const stored = await row(asset.id);
    expect(stored).toMatchObject({ storage: "postgres", status: "ready", storageKey: `media/${a.tenantId}/${asset.id}` });
    expect(Buffer.from(stored.bytes!).includes(Buffer.from(GPS_MARK))).toBe(false);
    const served = await read(a, asset.id);
    expect(served.status).toBe(200);
    expect(await body(served)).toEqual(Buffer.from(stored.bytes!));
    expect(Object.fromEntries(served.headers)).toMatchObject({
      "content-type": "image/jpeg", "cache-control": "private, no-cache", "x-content-type-options": "nosniff", vary: "Cookie",
      "content-disposition": 'inline; filename="photo.jpg"', "cross-origin-resource-policy": "same-origin", etag: `"${stored.sha256}"`,
    });
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect((await read(a, asset.id, { "if-none-match": `"${stored.sha256}"` })).status).toBe(304);
  });

  it("keeps the same picture once, even with other metadata", async () => {
    const first = await (await upload(a, realPng(24, 16, 1))).json();
    const again = await (await upload(a, Buffer.concat([realPng(24, 16, 1), Buffer.from(`trailer ${GPS_MARK}`)]))).json();
    expect(again.asset).toEqual(first.asset);
    expect(again.deduped).toBe(true);
    const theirs = await (await upload(b, realPng(24, 16, 1))).json();
    expect(theirs.deduped).toBe(false);
    expect(theirs.asset.id).not.toBe(first.asset.id);
  });

  it("refuses HEIC, animation, other types, a broken file and an empty or oversized body", async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"), randomBytes(64)]);
    const refused = await upload(a, heic);
    expect(refused.status).toBe(415);
    expect(await refused.json()).toEqual({ error: "heic" });
    expect(await (await upload(a, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).json()).toEqual({ error: "unsupported" });
    expect((await upload(a, phoneJpeg().subarray(0, 40))).status).toBe(422);
    expect((await upload(a, Buffer.alloc(0))).status).toBe(400);
    expect((await upload(a, Buffer.alloc(8 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await upload(a, realPng(), "banner")).status).toBe(400);
  });

  it("stores nothing for a batch picked in another session", async () => {
    const before = await admin.mediaAsset.count({ where: { tenantId: a.tenantId } });
    expect(await (await upload(a, realPng(24, 16, 30), "photo", b.session)).json()).toEqual({ error: "session_changed" });
    expect((await upload(a, realPng(24, 16, 30), "photo", null)).status).toBe(409);
    expect((await upload(a, realPng(24, 16, 30), "photo", `${a.accountId}.0`)).status).toBe(409);
    expect(await admin.mediaAsset.count({ where: { tenantId: a.tenantId } })).toBe(before);
  });

  it("is refused signed out and from another site", async () => {
    expect((await uploadRoute(request("/api/owner/media", { method: "POST", body: new Uint8Array(realPng()) }))).status).toBe(401);
    const foreign = new NextRequest(`${origin}/api/owner/media`, { method: "POST", body: new Uint8Array(realPng()), headers: { cookie: a.cookie, origin: "https://attacker.example", host: "localhost" } });
    expect((await uploadRoute(foreign)).status).toBe(403);
    expect((await listRoute(request("/api/owner/media"))).status).toBe(401);
  });

  it("holds a salon to 300 photos and 500 MB, deleted pictures counting until the sweep purges them", async () => {
    const full = await owner("media-full");
    await admin.mediaAsset.createMany({ data: Array.from({ length: MAX_PHOTOS }, (_, n) => filler(full.tenantId, n)) });
    expect(await (await upload(full, realPng(24, 16, 2))).json()).toEqual({ error: "photo_limit" });
    expect((await upload(full, realPng(24, 16, 3), "logo")).status).toBe(200);
    // Deleting frees a place among the 300, but not the bytes: they are still stored.
    await admin.mediaAsset.updateMany({ where: { tenantId: full.tenantId, kind: "photo" }, data: { deletedAt: new Date() } });
    await admin.mediaAsset.createMany({ data: Array.from({ length: 63 }, (_, n) => ({ ...filler(full.tenantId, 1000 + n, 8 * 1024 * 1024), deletedAt: new Date() })) });
    expect(await (await upload(full, phoneJpeg({ width: 999 }))).json()).toEqual({ error: "storage_limit" });
    // Once purged, the room is back.
    await admin.mediaAsset.updateMany({ where: { tenantId: full.tenantId, deletedAt: { not: null } }, data: { deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY) } });
    expect((await sweepDeletedMedia({ prisma: admin })).purged).toBeGreaterThanOrEqual(363);
    expect((await upload(full, phoneJpeg({ width: 999 }))).status).toBe(200);
  });
});

describe("an object store", () => {
  it("writes a pending row before the bytes, confirms it after, and leaves a failed upload to the sweep", async () => {
    const who = await owner("media-objects");
    const objects = new Map<string, Buffer>();
    const store: MediaStore = {
      name: "s3",
      put: async (key, bytes) => {
        const pending = await admin.mediaAsset.findFirstOrThrow({ where: { storageKey: key } });
        expect(pending.status).toBe("pending");
        objects.set(key, bytes);
        return null;
      },
      get: async (key) => objects.get(key) ?? null,
      delete: async (key) => { objects.delete(key); },
    };
    const done = await uploadMedia(who.tenantId, "photo", realPng(24, 16, 4), { store });
    if (!done.ok) throw new Error(done.reason);
    expect((await row(done.asset.id)).status).toBe("ready");
    expect(objects.has(mediaKey(who.tenantId, done.asset.id))).toBe(true);

    const failing: MediaStore = { ...store, put: async () => { throw new Error("unreachable"); } };
    await expect(uploadMedia(who.tenantId, "photo", realPng(24, 16, 5), { store: failing })).rejects.toThrow();
    const left = await admin.mediaAsset.findFirstOrThrow({ where: { tenantId: who.tenantId, status: "pending" } });
    expect(left.deletedAt).not.toBeNull();
    expect(await listMedia(who.tenantId)).toHaveLength(1);
    // An upload whose process died stays pending; after an hour the sweep removes row and object.
    const abandoned = randomUUID();
    await admin.mediaAsset.create({ data: { ...filler(who.tenantId, 77), id: abandoned, storage: "s3", storageKey: mediaKey(who.tenantId, abandoned), bytes: null, status: "pending", createdAt: new Date(Date.now() - 2 * 3600_000) } });
    objects.set(mediaKey(who.tenantId, abandoned), Buffer.from("partial"));
    await admin.mediaAsset.updateMany({ where: { id: left.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
    const swept = await sweepDeletedMedia({ prisma: admin, storeOf: () => store });
    expect(swept.failed).toBe(0);
    expect(await admin.mediaAsset.count({ where: { id: { in: [abandoned, left.id] } } })).toBe(0);
    expect(objects.has(mediaKey(who.tenantId, abandoned))).toBe(false);
  });

  it("fails an upload whose row was taken away before it was confirmed, and drops its object", async () => {
    const who = await owner("media-final");
    const objects = new Map<string, Buffer>();
    const store: MediaStore = {
      name: "s3",
      put: async (key, bytes) => {
        objects.set(key, bytes);
        // The sweep (or a delete) took the pending row while the bytes were on their way.
        await admin.mediaAsset.deleteMany({ where: { storageKey: key } });
        return null;
      },
      get: async () => null,
      delete: async (key) => { objects.delete(key); },
    };
    await expect(uploadMedia(who.tenantId, "photo", realPng(24, 16, 31), { store })).rejects.toThrow();
    expect(objects.size).toBe(0);
  });

  it("leaves a row another transaction holds, object included", async () => {
    const id = randomUUID();
    await admin.mediaAsset.create({ data: { ...filler(b.tenantId, 5150), id, storage: "s3", storageKey: mediaKey(b.tenantId, id), bytes: null, deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY) } });
    const holder = new pg.Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL });
    await holder.connect();
    const deleted: string[] = [];
    const store: MediaStore = { name: "s3", put: async () => null, get: async () => null, delete: async (key) => { deleted.push(key); } };
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM media_asset WHERE id = $1 FOR UPDATE", [id]);
      await sweepDeletedMedia({ prisma: admin, storeOf: () => store });
      expect(deleted).not.toContain(mediaKey(b.tenantId, id));
      expect(await admin.mediaAsset.count({ where: { id } })).toBe(1);
      await holder.query("COMMIT");
    } finally {
      await holder.end();
    }
    await sweepDeletedMedia({ prisma: admin, storeOf: () => store });
    expect(deleted).toContain(mediaKey(b.tenantId, id));
  });

  it("retries a purge the store refuses without holding up the others", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
    const old = new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY);
    for (const [n, id] of ids.entries()) {
      await admin.mediaAsset.create({ data: { ...filler(b.tenantId, 4242 + n), id, storage: "s3", storageKey: mediaKey(b.tenantId, id), bytes: null, deletedAt: old } });
    }
    const deleted: string[] = [];
    const flaky: MediaStore = { name: "s3", put: async () => null, get: async () => null, delete: async (key) => { if (key.endsWith(ids[0])) throw new Error("unreachable"); deleted.push(key); } };
    const first = await sweepDeletedMedia({ prisma: admin, storeOf: () => flaky, batch: 1 });
    expect(first.failed).toBe(1);
    expect(deleted.filter((key) => ids.some((id) => key.endsWith(id)))).toEqual(ids.slice(1).map((id) => mediaKey(b.tenantId, id)));
    expect(await admin.mediaAsset.count({ where: { id: { in: ids } } })).toBe(1);
    const working: MediaStore = { ...flaky, delete: async (key) => { deleted.push(key); } };
    expect(await sweepDeletedMedia({ prisma: admin, storeOf: () => working })).toMatchObject({ failed: 0 });
    expect(await admin.mediaAsset.count({ where: { id: { in: ids } } })).toBe(0);
  });

  it("never lets a row point at another object", async () => {
    const id = randomUUID();
    await expect(admin.mediaAsset.create({ data: { ...filler(b.tenantId, 999), id, storageKey: `media/${a.tenantId}/${id}` } })).rejects.toThrow();
    await expect(admin.mediaAsset.create({ data: { ...filler(b.tenantId, 998), id, storageKey: "../../etc" } })).rejects.toThrow();
    expect(() => mediaKey("../other", id)).toThrow();
  });
});

describe("the logo", () => {
  it("stays private until the page that uses it is saved, and the save retires the one before", async () => {
    const first = (await (await upload(a, realPng(64, 32, 5), "logo")).json()).asset;
    expect(first.publicUrl).toMatch(/^\/api\/public\/media\/[0-9a-f-]{36}\/[0-9a-f]{64}$/);
    expect((await publicLogo(first.publicUrl)).status).toBe(404);
    // The editor's preview shows it to its own owner, privately; another owner sees nothing.
    const preview = await publicLogo(first.publicUrl, a.cookie);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("private, no-cache");
    expect((await publicLogo(first.publicUrl, b.cookie)).status).toBe(404);

    expect((await savePage(a, first.publicUrl)).status).toBe(200);
    const served = await publicLogo(first.publicUrl);
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("public, max-age=300, must-revalidate");
    expect((await body(served)).includes(Buffer.from(GPS_MARK))).toBe(false);

    // A new upload is a draft: the saved page keeps showing the first logo.
    const second = (await (await upload(a, realPng(64, 32, 6), "logo")).json()).asset;
    expect((await publicLogo(second.publicUrl)).status).toBe(404);
    expect((await publicLogo(first.publicUrl)).status).toBe(200);
    expect((await savePage(a, second.publicUrl)).status).toBe(200);
    expect((await publicLogo(second.publicUrl)).status).toBe(200);
    expect((await publicLogo(first.publicUrl)).status).toBe(404);
    expect((await row(first.id)).deletedAt).not.toBeNull();
    // The database itself refuses a second published logo.
    await expect(admin.mediaAsset.create({ data: { ...filler(a.tenantId, 9999), kind: "logo", publishedAt: new Date() } })).rejects.toThrow();
    expect((await restore(a, first.id)).status).toBe(404);

    // Saving the page without a logo takes it off at once.
    expect((await savePage(a, null)).status).toBe(200);
    expect((await publicLogo(second.publicUrl)).status).toBe(404);
  });

  it("shows an unsaved logo only to a full session, and a published one only while the booking page is served", async () => {
    const who = await owner("media-gate");
    const logo = (await (await upload(who, realPng(64, 32, 40), "logo")).json()).asset;
    expect((await publicLogo(logo.publicUrl, who.cookie)).status).toBe(200);
    // An enrolment-only session (two-step sign-in required but not set up) sees the anonymous answer.
    vi.stubEnv("OWNER_MFA_REQUIRED", "1");
    expect((await publicLogo(logo.publicUrl, who.cookie)).status).toBe(404);
    vi.stubEnv("OWNER_MFA_REQUIRED", "");
    expect((await savePage(who, logo.publicUrl)).status).toBe(200);
    expect((await publicLogo(logo.publicUrl)).status).toBe(200);
    await admin.ownerAccount.update({ where: { id: who.accountId }, data: { active: false } });
    expect((await publicLogo(logo.publicUrl)).status).toBe(404);
    await admin.ownerAccount.update({ where: { id: who.accountId }, data: { active: true } });
    expect((await publicLogo(logo.publicUrl)).status).toBe(200);
    await admin.tenantState.update({ where: { tenantId: who.tenantId }, data: { expiresAt: new Date(Date.now() - DAY) } });
    expect((await publicLogo(logo.publicUrl)).status).toBe(404);
  });

  it("refuses a page with a new inline logo or with another salon's logo", async () => {
    expect(await (await savePage(a, `data:image/png;base64,${realPng(8, 8, 1).toString("base64")}`)).json()).toEqual({ error: "logo_inline" });
    const theirs = (await (await upload(b, realPng(64, 32, 7), "logo")).json()).asset;
    expect(await (await savePage(a, theirs.publicUrl)).json()).toEqual({ error: "logo_unknown" });
    expect((await savePage(b, theirs.publicUrl)).status).toBe(200);
    expect((await publicLogo(theirs.publicUrl)).status).toBe(200);
  });

  it("never serves a photo at a public address", async () => {
    const photo = (await (await upload(a, realPng(24, 16, 7))).json()).asset;
    const { sha256 } = await row(photo.id);
    expect((await publicLogo(`/api/public/media/${photo.id}/${sha256}`, a.cookie)).status).toBe(404);
  });
});

describe("tenant isolation", () => {
  it("answers another salon's picture as missing and leaves it untouched", async () => {
    const photo = (await (await upload(a, realPng(24, 16, 8))).json()).asset;
    const before = await row(photo.id);
    expect((await read(b, photo.id)).status).toBe(404);
    expect((await patch(b, photo.id, "Taken by someone else")).status).toBe(404);
    expect((await remove(b, photo.id)).status).toBe(404);
    expect((await restore(b, photo.id)).status).toBe(404);
    expect(await findMedia(b.tenantId, photo.id)).toBeNull();
    const listed = await (await listRoute(request("/api/owner/media", { cookie: b.cookie }))).json();
    expect(listed.media.map((item: { id: string }) => item.id)).not.toContain(photo.id);
    expect(await row(photo.id)).toEqual(before);
    expect((await read(a, photo.id)).status).toBe(200);
  });

  it("draws a library photo on a poster for its own salon only, and only where owner routes are served", async () => {
    const photo = (await (await upload(a, realPng(40, 30, 9))).json()).asset;
    const poster = (cookie: string, id = photo.id) => posterRoute(new NextRequest(`${origin}/api/concept/poster`, {
      method: "POST", headers: { cookie, origin, host: "localhost", "content-type": "application/json" },
      body: JSON.stringify({
        template: "fullphoto", format: "post",
        data: { headline: "Fictional offer", price: "", detail: "", photo: `media:${id}`, colors: { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" }, signature: { salon: "Salong", phone: "", link: "" } },
      }),
    }), undefined as never);
    expect((await poster(b.cookie)).status).toBe(422);
    const own = await poster(a.cookie);
    expect(own.status).toBe(200);
    expect(await own.text()).toContain("data:image/png;base64,");
    expect((await poster("")).status).toBe(401);
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "0");
    expect((await poster(a.cookie)).status).toBe(404);
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
    const webp = (await uploadMedia(a.tenantId, "photo", metadataWebp())) as { ok: true; asset: { id: string } };
    expect(await (await poster(a.cookie, webp.asset.id)).json()).toEqual({ error: "photo_unsuitable" });
  });
});

describe("description, deletion and the sweep", () => {
  it("sets a description, deletes with undo and purges after the retention", async () => {
    const photo = (await (await upload(a, realPng(24, 16, 10))).json()).asset;
    expect((await (await patch(a, photo.id, "  The treatment room  ")).json()).asset.altText).toBe("The treatment room");
    expect((await patch(a, photo.id, "x".repeat(301))).status).toBe(400);
    expect((await remove(a, photo.id)).status).toBe(200);
    expect((await read(a, photo.id)).status).toBe(404);
    expect((await remove(a, photo.id)).status).toBe(404);
    expect((await restore(a, photo.id)).status).toBe(200);
    expect((await read(a, photo.id)).status).toBe(200);
    expect((await remove(a, photo.id)).status).toBe(200);

    await admin.mediaAsset.update({ where: { id: photo.id }, data: { deletedAt: new Date(Date.now() - 2 * DAY) } });
    expect((await restore(a, photo.id)).status).toBe(404);
    const recent = (await (await upload(a, realPng(24, 16, 11))).json()).asset;
    expect(await deleteMedia(a.tenantId, recent.id)).toBe(true);
    await sweepDeletedMedia({ prisma: admin });
    expect(await admin.mediaAsset.count({ where: { id: { in: [photo.id, recent.id] } } })).toBe(2);
    await admin.mediaAsset.update({ where: { id: photo.id }, data: { deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY) } });
    expect((await sweepDeletedMedia({ prisma: admin })).purged).toBeGreaterThanOrEqual(1);
    expect(await admin.mediaAsset.findUnique({ where: { id: photo.id } })).toBeNull();
    expect(await admin.mediaAsset.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});

describe("as the least-privilege logins of prisma/grants/roles.sql", () => {
  const superuser = async () => (await admin.$queryRaw<{ rolsuper: boolean }[]>`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`)[0]?.rolsuper === true;
  const appLogin = `media_app_${run}`;
  const sweepLogin = `media_sweep_${run}`;
  const supportLogin = `media_support_${run}`;
  const outboxLogin = `media_outbox_${run}`;
  // A throwaway password made at run time: CI's Postgres requires password authentication, a local trust setup ignores it.
  const loginSecret = randomBytes(18).toString("hex");
  const url = (user: string) => { const next = new URL(process.env.TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL!); next.username = user; next.password = loginSecret; return next.href; };

  it("uploads, reads, describes, deletes, restores and publishes as the app, and purges as the sweeper, and nothing more", async (context) => {
    if (!(await superuser())) return context.skip();
    const pgAdmin = new pg.Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL });
    await pgAdmin.connect();
    const logins: PrismaClient[] = [];
    try {
      await pgAdmin.query(readFileSync(new URL("../../prisma/grants/roles.sql", import.meta.url), "utf8"));
      // The store's grants too: verify-roles.sql holds every login to the complete allowlist of both files.
      await pgAdmin.query(readFileSync(new URL("../../prisma/grants/studio-store.sql", import.meta.url), "utf8"));
      await pgAdmin.query(`CREATE ROLE ${appLogin} LOGIN PASSWORD '${loginSecret}' IN ROLE cresavo_app; CREATE ROLE ${sweepLogin} LOGIN PASSWORD '${loginSecret}' IN ROLE cresavo_sweeper; CREATE ROLE ${supportLogin} LOGIN PASSWORD '${loginSecret}' IN ROLE cresavo_support; CREATE ROLE ${outboxLogin} LOGIN PASSWORD '${loginSecret}' IN ROLE cresavo_outbox`);
      const app = createDatabaseClient(url(appLogin), 2) as PrismaClient;
      const sweeper = createDatabaseClient(url(sweepLogin), 2) as PrismaClient;
      logins.push(app, sweeper);

      const uploaded = await uploadMedia(a.tenantId, "photo", realPng(24, 16, 20), { client: app });
      if (!uploaded.ok) throw new Error(uploaded.reason);
      expect((await listMedia(a.tenantId, { client: app })).map((item) => item.id)).toContain(uploaded.asset.id);
      expect((await (await findMedia(a.tenantId, uploaded.asset.id, { client: app }))!.bytes())!.length).toBe(uploaded.asset.byteSize);
      expect((await setAltText(a.tenantId, uploaded.asset.id, "Fictional", { client: app }))!.altText).toBe("Fictional");
      expect(await deleteMedia(a.tenantId, uploaded.asset.id, { client: app })).toBe(true);
      expect(await restoreMedia(a.tenantId, uploaded.asset.id, { client: app })).toMatchObject({ ok: true });
      expect((await uploadMedia(a.tenantId, "logo", realPng(64, 32, 21), { client: app })).ok).toBe(true);
      await expect(app.$executeRaw`UPDATE media_asset SET bytes = '\\x00' WHERE id = ${uploaded.asset.id}`).rejects.toThrow();
      await expect(app.$executeRaw`UPDATE media_asset SET tenant_id = 'other' WHERE id = ${uploaded.asset.id}`).rejects.toThrow();
      await expect(app.$executeRaw`UPDATE media_asset SET storage_key = 'media/x' WHERE id = ${uploaded.asset.id}`).rejects.toThrow();
      await expect(app.$executeRaw`DELETE FROM media_asset WHERE id = ${uploaded.asset.id}`).rejects.toThrow();

      await admin.mediaAsset.update({ where: { id: uploaded.asset.id }, data: { deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY) } });
      expect((await sweepDeletedMedia({ prisma: sweeper })).purged).toBeGreaterThanOrEqual(1);
      expect(await admin.mediaAsset.findUnique({ where: { id: uploaded.asset.id } })).toBeNull();
      await expect(sweeper.$queryRaw`SELECT bytes FROM media_asset LIMIT 1`).rejects.toThrow();
      await expect(sweeper.$queryRaw`SELECT alt_text FROM media_asset LIMIT 1`).rejects.toThrow();

      const verify = readFileSync(new URL("../../prisma/grants/verify-roles.sql", import.meta.url), "utf8")
        .replaceAll(":'app_login'", `'${appLogin}'`).replaceAll(":'sweeper_login'", `'${sweepLogin}'`).replaceAll(":'support_login'", `'${supportLogin}'`)
        .replaceAll(":'outbox_login'", `'${outboxLogin}'`);
      const problems = (await pgAdmin.query(verify)).rows.map((r: { problem: string }) => r.problem).filter((problem) => /media_asset/.test(problem));
      expect(problems).toEqual([]);
    } finally {
      await Promise.all(logins.map((client) => client.$disconnect()));
      await pgAdmin.query(`DROP ROLE IF EXISTS ${appLogin}; DROP ROLE IF EXISTS ${sweepLogin}; DROP ROLE IF EXISTS ${supportLogin}; DROP ROLE IF EXISTS ${outboxLogin}`);
      await pgAdmin.end();
    }
  });
});
