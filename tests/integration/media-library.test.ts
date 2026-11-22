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
import { POST as posterRoute } from "../../src/app/api/concept/poster/route";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { db } from "../../src/lib/db";
import { deleteMedia, findMedia, listMedia, restoreMedia, setAltText, uploadMedia } from "../../src/lib/media/library";
import { MAX_PHOTOS, PURGE_AFTER_DAYS } from "../../src/lib/media/limits";
import { sweepDeletedMedia } from "../../src/lib/media/sweep";
import type { MediaStore } from "../../src/lib/media-store";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { openOwnerSession, OWNER_COOKIE } from "../../src/lib/owner-session";
import { GPS_MARK, metadataWebp, phoneJpeg, realPng } from "../media-fixtures";

// The photo library against a disposable local *_test database: upload, deduplication, limits, the one
// active logo, serving, deletion with undo and the sweep, two salons trying each other's pictures, and the
// least-privilege logins of prisma/grants/roles.sql. Generated images and fictional accounts only.

const run = randomUUID().slice(0, 8);
const origin = "http://localhost";
const prisma = db as unknown as PrismaClient;
const clients: PrismaClient[] = [];

interface Owner { tenantId: string; cookie: string }

async function owner(label: string): Promise<Owner> {
  const result = await createOwnerAccount({ email: `${label}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong ${label} ${run}`, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, cookie: `${OWNER_COOKIE}=${session!.value}` };
}

const request = (path: string, { cookie, method = "GET", body, headers = {} }: { cookie?: string; method?: string; body?: BodyInit; headers?: Record<string, string> } = {}) =>
  new NextRequest(`${origin}${path}`, {
    method, body,
    headers: { ...(cookie && { cookie }), ...(method !== "GET" && { origin, host: "localhost" }), ...headers },
  });
const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const upload = (who: Owner, bytes: Buffer, kind = "photo") => uploadRoute(request(`/api/owner/media?kind=${kind}`, { cookie: who.cookie, method: "POST", body: new Uint8Array(bytes) }));
const read = (who: Owner, id: string, headers: Record<string, string> = {}) => readRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, headers }), params({ id }));
const patch = (who: Owner, id: string, altText: string | null) =>
  patchRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, method: "PATCH", body: JSON.stringify({ altText }), headers: { "content-type": "application/json" } }), params({ id }));
const remove = (who: Owner, id: string) => deleteRoute(request(`/api/owner/media/${id}`, { cookie: who.cookie, method: "DELETE" }), params({ id }));
const restore = (who: Owner, id: string) => restoreRoute(request(`/api/owner/media/${id}/restore`, { cookie: who.cookie, method: "POST" }), params({ id }));
const publicLogo = (id: string, sha256: string) => publicRoute(request(`/api/public/media/${id}/${sha256}`), params({ id, sha256 }));
const body = async (response: Response) => Buffer.from(await response.arrayBuffer());
const row = (id: string) => prisma.mediaAsset.findUniqueOrThrow({ where: { id } });

/** A small row straight into the table, for filling a library up to its limits. */
const filler = (tenantId: string, n: number, byteSize = 1) => ({
  id: randomUUID(), tenantId, kind: "photo", contentType: "image/png", byteSize, width: 1, height: 1,
  sha256: createHash("sha256").update(`${run}-${tenantId}-${n}`).digest("hex"), storage: "postgres", storageKey: `media/filler-${n}`, bytes: new Uint8Array([n & 0xff]),
});

let a: Owner, b: Owner;

beforeAll(async () => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("MEDIA_STORE", "postgres");
  a = await owner("media-a");
  b = await owner("media-b");
});

afterAll(async () => {
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  const tenants = accounts.map((account) => account.tenantId);
  await db.mediaAsset.deleteMany({ where: { tenantId: { in: tenants } } });
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"]) await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, tenants);
  vi.unstubAllEnvs();
  await Promise.all([db.$disconnect(), ...clients.map((client) => client.$disconnect())]);
});

describe("upload", () => {
  it("stores a photo without its metadata and serves it to its owner with private, revalidated caching", async () => {
    const original = phoneJpeg({ orientation: 6 });
    const response = await upload(a, original);
    expect(response.status).toBe(200);
    const { asset, deduped } = await response.json();
    expect(deduped).toBe(false);
    expect(asset).toMatchObject({ kind: "photo", contentType: "image/jpeg", width: 480, height: 640, altText: null, url: `/api/owner/media/${asset.id}` });
    expect(asset.publicUrl).toBeUndefined();
    expect(Object.keys(asset).sort()).toEqual(["altText", "byteSize", "contentType", "createdAt", "height", "id", "kind", "url", "width"]);

    const stored = await row(asset.id);
    expect(stored.storage).toBe("postgres");
    expect(Buffer.from(stored.bytes!).includes(Buffer.from(GPS_MARK))).toBe(false);
    const served = await read(a, asset.id);
    expect(served.status).toBe(200);
    expect(await body(served)).toEqual(Buffer.from(stored.bytes!));
    expect(Object.fromEntries(served.headers)).toMatchObject({
      "content-type": "image/jpeg", "cache-control": "private, no-cache", "x-content-type-options": "nosniff", vary: "Cookie",
      "content-disposition": 'inline; filename="photo.jpg"', "cross-origin-resource-policy": "same-origin", etag: `"${stored.sha256}"`,
    });
    expect(served.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect((await read(a, asset.id, { "if-none-match": `"${stored.sha256}"` })).status).toBe(304);
  });

  it("keeps the same picture once, even with other metadata", async () => {
    const first = await (await upload(a, realPng(24, 16, 1))).json();
    const again = await (await upload(a, Buffer.concat([realPng(24, 16, 1), Buffer.from(`trailer ${GPS_MARK}`)]))).json();
    expect(again).toEqual({ asset: first.asset, deduped: true });
    // Another salon's copy of the same picture is its own.
    const theirs = await (await upload(b, realPng(24, 16, 1))).json();
    expect(theirs.deduped).toBe(false);
    expect(theirs.asset.id).not.toBe(first.asset.id);
  });

  it("refuses HEIC with its own code, other types, a broken file and an empty or oversized body", async () => {
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

  it("is refused signed out and from another site", async () => {
    expect((await uploadRoute(request("/api/owner/media", { method: "POST", body: new Uint8Array(realPng()) }))).status).toBe(401);
    const foreign = new NextRequest(`${origin}/api/owner/media`, { method: "POST", body: new Uint8Array(realPng()), headers: { cookie: a.cookie, origin: "https://attacker.example", host: "localhost" } });
    expect((await uploadRoute(foreign)).status).toBe(403);
    expect((await listRoute(request("/api/owner/media"))).status).toBe(401);
  });

  it("holds a salon to 300 photos and 500 MB", async () => {
    const full = await owner("media-full");
    await prisma.mediaAsset.createMany({ data: Array.from({ length: MAX_PHOTOS }, (_, n) => filler(full.tenantId, n)) });
    expect(await (await upload(full, realPng(24, 16, 2))).json()).toEqual({ error: "photo_limit" });
    // A logo does not count as a photo, but it counts towards the bytes.
    expect((await upload(full, realPng(24, 16, 3), "logo")).status).toBe(200);
    await prisma.mediaAsset.updateMany({ where: { tenantId: full.tenantId, kind: "photo" }, data: { deletedAt: new Date() } });
    await prisma.mediaAsset.createMany({ data: Array.from({ length: 63 }, (_, n) => filler(full.tenantId, 1000 + n, 8 * 1024 * 1024)) });
    expect(await (await upload(full, phoneJpeg({ width: 999 }))).json()).toEqual({ error: "storage_limit" });
  });

  it("removes an object store's copy when the row is refused", async () => {
    const full = await owner("media-objects");
    await prisma.mediaAsset.createMany({ data: Array.from({ length: MAX_PHOTOS }, (_, n) => filler(full.tenantId, n)) });
    const calls: string[] = [];
    const store: MediaStore = { name: "s3", put: async (key) => { calls.push(`put ${key}`); return null; }, get: async () => null, delete: async (key) => { calls.push(`delete ${key}`); } };
    expect(await uploadMedia(full.tenantId, "photo", realPng(24, 16, 4), { store })).toEqual({ ok: false, reason: "photo_limit" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(calls[0].replace("put", "delete"));
  });
});

describe("the logo", () => {
  it("keeps one active logo, served publicly only at its id and hash", async () => {
    const first = (await (await upload(a, realPng(64, 32, 5), "logo")).json()).asset;
    expect(first.publicUrl).toMatch(/^\/api\/public\/media\/[0-9a-f-]{36}\/[0-9a-f]{64}$/);
    const [, , , , id, sha] = first.publicUrl.split("/");
    const served = await publicLogo(id, sha);
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await body(served)).includes(Buffer.from(GPS_MARK))).toBe(false);
    expect((await publicLogo(id, "0".repeat(64))).status).toBe(404);

    const second = (await (await upload(a, realPng(64, 32, 6), "logo")).json()).asset;
    expect(await prisma.mediaAsset.count({ where: { tenantId: a.tenantId, kind: "logo", deletedAt: null } })).toBe(1);
    expect((await row(first.id)).deletedAt).not.toBeNull();
    expect((await publicLogo(id, sha)).status).toBe(404);
    // The database itself refuses a second active logo.
    await expect(prisma.mediaAsset.create({ data: { ...filler(a.tenantId, 9999), kind: "logo" } })).rejects.toThrow();
    // Bringing back the old logo would make two.
    expect((await restore(a, first.id)).status).toBe(409);
    const [, , , , secondId, secondSha] = second.publicUrl.split("/");
    expect((await publicLogo(secondId, secondSha)).status).toBe(200);
  });

  it("never serves a photo at a public address", async () => {
    const photo = (await (await upload(a, realPng(24, 16, 7))).json()).asset;
    const { sha256 } = await row(photo.id);
    expect((await publicLogo(photo.id, sha256)).status).toBe(404);
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
    // Control: the owner reaches it.
    expect((await read(a, photo.id)).status).toBe(200);
  });

  it("draws a library photo on a poster for its own salon only", async () => {
    const photo = (await (await upload(a, realPng(40, 30, 9))).json()).asset;
    const poster = (cookie: string) => posterRoute(new NextRequest(`${origin}/api/concept/poster`, {
      method: "POST", headers: { cookie, origin, host: "localhost", "content-type": "application/json" },
      body: JSON.stringify({
        template: "fullphoto", format: "post",
        data: { headline: "Fictional offer", price: "", detail: "", photo: `media:${photo.id}`, colors: { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" }, signature: { salon: "Salong", phone: "", link: "" } },
      }),
    }), undefined as never);
    expect((await poster(b.cookie)).status).toBe(422);
    const own = await poster(a.cookie);
    expect(own.status).toBe(200);
    expect(await own.text()).toContain("data:image/png;base64,");
    expect((await poster("")).status).toBe(401);
    // Satori cannot read WebP: the studio is told to send a copy.
    const webp = (await uploadMedia(a.tenantId, "photo", metadataWebp())) as { ok: true; asset: { id: string } };
    const response = await posterRoute(new NextRequest(`${origin}/api/concept/poster`, {
      method: "POST", headers: { cookie: a.cookie, origin, host: "localhost" },
      body: JSON.stringify({ template: "fullphoto", format: "post", data: { headline: "x", price: "", detail: "", photo: `media:${webp.asset.id}`, colors: { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" }, signature: { salon: "S", phone: "", link: "" } } }),
    }), undefined as never);
    expect(await response.json()).toEqual({ error: "photo_unsuitable" });
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

    // Past the undo window, it stays deleted; past the retention, the sweep purges it.
    await prisma.mediaAsset.update({ where: { id: photo.id }, data: { deletedAt: new Date(Date.now() - 2 * 86_400_000) } });
    expect((await restore(a, photo.id)).status).toBe(404);
    const recent = (await (await upload(a, realPng(24, 16, 11))).json()).asset;
    expect(await deleteMedia(a.tenantId, recent.id)).toBe(true);
    await sweepDeletedMedia({ prisma });
    expect(await prisma.mediaAsset.count({ where: { id: { in: [photo.id, recent.id] } } })).toBe(2);
    await prisma.mediaAsset.update({ where: { id: photo.id }, data: { deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * 86_400_000) } });
    expect(await sweepDeletedMedia({ prisma })).toBeGreaterThanOrEqual(1);
    expect(await prisma.mediaAsset.findUnique({ where: { id: photo.id } })).toBeNull();
    expect(await prisma.mediaAsset.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it("removes an object store's copy before the row", async () => {
    const id = randomUUID();
    await prisma.mediaAsset.create({ data: { ...filler(b.tenantId, 4242), id, storage: "s3", storageKey: `media/${id}`, bytes: null, deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * 86_400_000) } });
    const deleted: string[] = [];
    const failing: MediaStore = { name: "s3", put: async () => null, get: async () => null, delete: async () => { throw new Error("unreachable"); } };
    await expect(sweepDeletedMedia({ prisma, storeOf: () => failing })).rejects.toThrow();
    expect(await prisma.mediaAsset.findUnique({ where: { id } })).not.toBeNull();
    const working: MediaStore = { ...failing, delete: async (key) => { deleted.push(key); } };
    await sweepDeletedMedia({ prisma, storeOf: (storage) => (storage === "s3" ? working : failing) });
    expect(deleted).toContain(`media/${id}`);
    expect(await prisma.mediaAsset.findUnique({ where: { id } })).toBeNull();
  });
});

describe("as the least-privilege logins of prisma/grants/roles.sql", () => {
  const superuser = async () => (await prisma.$queryRaw<{ rolsuper: boolean }[]>`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`)[0]?.rolsuper === true;
  const appLogin = `media_app_${run}`;
  const sweepLogin = `media_sweep_${run}`;
  const supportLogin = `media_support_${run}`;
  const url = (user: string) => { const next = new URL(process.env.DATABASE_URL!); next.username = user; next.password = ""; return next.href; };

  it("uploads, reads, describes, deletes and restores as the app, and purges as the sweeper, and nothing more", async (context) => {
    if (!(await superuser())) return context.skip();
    const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    try {
      await admin.query(readFileSync(new URL("../../prisma/grants/roles.sql", import.meta.url), "utf8"));
      await admin.query(`CREATE ROLE ${appLogin} LOGIN IN ROLE cresavo_app; CREATE ROLE ${sweepLogin} LOGIN IN ROLE cresavo_sweeper; CREATE ROLE ${supportLogin} LOGIN IN ROLE cresavo_support`);
      const app = createDatabaseClient(url(appLogin), 2) as PrismaClient;
      const sweeper = createDatabaseClient(url(sweepLogin), 2) as PrismaClient;
      clients.push(app, sweeper);

      const uploaded = await uploadMedia(a.tenantId, "photo", realPng(24, 16, 20), { client: app });
      if (!uploaded.ok) throw new Error(uploaded.reason);
      expect((await listMedia(a.tenantId, { client: app })).map((item) => item.id)).toContain(uploaded.asset.id);
      expect((await (await findMedia(a.tenantId, uploaded.asset.id, { client: app }))!.bytes())!.length).toBe(uploaded.asset.byteSize);
      expect((await setAltText(a.tenantId, uploaded.asset.id, "Fictional", { client: app }))!.altText).toBe("Fictional");
      expect(await deleteMedia(a.tenantId, uploaded.asset.id, { client: app })).toBe(true);
      expect(await restoreMedia(a.tenantId, uploaded.asset.id, { client: app })).toMatchObject({ ok: true });
      expect((await uploadMedia(a.tenantId, "logo", realPng(64, 32, 21), { client: app })).ok).toBe(true);
      // The app never rewrites a picture or removes a row.
      await expect(app.$executeRaw`UPDATE media_asset SET bytes = '\\x00' WHERE id = ${uploaded.asset.id}`).rejects.toThrow();
      await expect(app.$executeRaw`UPDATE media_asset SET tenant_id = 'other' WHERE id = ${uploaded.asset.id}`).rejects.toThrow();
      await expect(app.$executeRaw`DELETE FROM media_asset WHERE id = ${uploaded.asset.id}`).rejects.toThrow();

      await prisma.mediaAsset.update({ where: { id: uploaded.asset.id }, data: { deletedAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * 86_400_000) } });
      expect(await sweepDeletedMedia({ prisma: sweeper })).toBeGreaterThanOrEqual(1);
      expect(await prisma.mediaAsset.findUnique({ where: { id: uploaded.asset.id } })).toBeNull();
      // The sweeper never sees a picture or its description.
      await expect(sweeper.$queryRaw`SELECT bytes FROM media_asset LIMIT 1`).rejects.toThrow();
      await expect(sweeper.$queryRaw`SELECT alt_text FROM media_asset LIMIT 1`).rejects.toThrow();

      const verify = readFileSync(new URL("../../prisma/grants/verify-roles.sql", import.meta.url), "utf8")
        .replaceAll(":'app_login'", `'${appLogin}'`).replaceAll(":'sweeper_login'", `'${sweepLogin}'`).replaceAll(":'support_login'", `'${supportLogin}'`);
      const problems = (await admin.query(verify)).rows.map((r: { problem: string }) => r.problem).filter((problem) => /media_asset/.test(problem));
      expect(problems).toEqual([]);
    } finally {
      await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
      await admin.query(`DROP ROLE IF EXISTS ${appLogin}; DROP ROLE IF EXISTS ${sweepLogin}; DROP ROLE IF EXISTS ${supportLogin}`);
      await admin.end();
    }
  });
});
