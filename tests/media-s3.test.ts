import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s3ConfigFromEnv, s3MediaStore } from "../src/lib/media-store/s3";
import { sha256Hex, signature } from "../src/lib/media-store/sigv4";
import { MediaStoreError } from "../src/lib/media-store/types";

// The S3 adapter against a tiny in-test S3: it checks every request's SigV4 signature and payload hash,
// keeps objects in memory and answers like S3. The credentials are invented.

const ACCESS = "AKIDFICTIONAL";
const SECRET = "fictional-secret-0123456789abcdefghijklmnop";
const objects = new Map<string, { body: Buffer; type: string }>();
const seen: { method: string; path: string; authorization: string }[] = [];
let server: Server;
let endpoint: string;

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

/** Recomputes the signature from what arrived; a request whose signature or payload hash is wrong gets 403. */
function verified(request: IncomingMessage, body: Buffer) {
  const authorization = String(request.headers.authorization ?? "");
  const match = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(authorization);
  if (!match || match[1] !== ACCESS) return false;
  const signedHeaders = match[4].split(";");
  if (!signedHeaders.includes("host") || !signedHeaders.includes("x-amz-content-sha256") || !signedHeaders.includes("x-amz-date")) return false;
  if (request.headers["x-amz-content-sha256"] !== sha256Hex(body)) return false;
  const headers = Object.fromEntries(signedHeaders.filter((name) => name !== "host" && name !== "x-amz-date").map((name) => [name, String(request.headers[name])]));
  const stamp = String(request.headers["x-amz-date"]);
  const date = new Date(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`);
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const expected = signature({ method: request.method!, url, headers, payloadHash: sha256Hex(body) },
    { accessKeyId: ACCESS, secretAccessKey: SECRET, region: match[3], service: "s3" }, date);
  return expected.signature === match[5];
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const body = await readBody(request);
    seen.push({ method: request.method!, path: request.url!, authorization: String(request.headers.authorization) });
    if (!verified(request, body)) return response.writeHead(403).end("<Error><Code>SignatureDoesNotMatch</Code></Error>");
    const key = decodeURIComponent(request.url!.split("?")[0]);
    if (request.method === "PUT") {
      objects.set(key, { body, type: String(request.headers["content-type"]) });
      return response.writeHead(200).end();
    }
    if (request.method === "GET") {
      const found = objects.get(key);
      return found ? response.writeHead(200, { "content-type": found.type }).end(found.body) : response.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
    }
    if (request.method === "DELETE") {
      objects.delete(key);
      return response.writeHead(204).end();
    }
    response.writeHead(405).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const env = (overrides: Record<string, string | undefined> = {}) => ({
  MEDIA_S3_ENDPOINT: endpoint, MEDIA_S3_REGION: "eu-north-1", MEDIA_S3_BUCKET: "cresavo-media-test",
  MEDIA_S3_ACCESS_KEY_ID: ACCESS, MEDIA_S3_SECRET_ACCESS_KEY: SECRET, ...overrides,
}) as unknown as NodeJS.ProcessEnv;

describe("S3 media store", () => {
  it("puts, gets and deletes a private object with signed requests, path-style", async () => {
    const store = s3MediaStore(s3ConfigFromEnv(env()));
    const bytes = Buffer.from("fictional picture bytes");
    expect(await store.put("media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc", bytes, "image/jpeg")).toBeNull();
    expect(objects.get("/cresavo-media-test/media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc")).toEqual({ body: bytes, type: "image/jpeg" });
    expect(await store.get("media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc", null)).toEqual(bytes);
    await store.delete("media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc");
    expect(await store.get("media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc", null)).toBeNull();
    // Deleting an object that is already gone succeeds.
    await store.delete("media/7c1e4f3a-1b2c-4d5e-8f90-123456789abc");
    expect(seen.every((request) => request.authorization.startsWith(`AWS4-HMAC-SHA256 Credential=${ACCESS}/`))).toBe(true);
    expect(seen.some((request) => request.authorization.includes(SECRET))).toBe(false);
  });

  it("fails without naming the key, the secret or the address when the signature is refused", async () => {
    const store = s3MediaStore(s3ConfigFromEnv(env({ MEDIA_S3_SECRET_ACCESS_KEY: "another-fictional-secret-value-000000000" })));
    const error = await store.put("media/x", Buffer.from("x"), "image/png").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MediaStoreError);
    expect((error as Error).message).toBe("Media store put failed (403)");
    for (const secret of ["another-fictional-secret", ACCESS, "127.0.0.1", "media/x", "cresavo-media-test"]) {
      expect(JSON.stringify(error) + String(error) + (error as Error).stack, secret).not.toContain(secret);
    }
  });

  it("refuses incomplete settings and plain HTTP to another machine, naming no value", () => {
    for (const bad of [{ MEDIA_S3_BUCKET: undefined }, { MEDIA_S3_SECRET_ACCESS_KEY: "" }, { MEDIA_S3_ENDPOINT: "http://s3.example.test" },
      { MEDIA_S3_ENDPOINT: "https://user:pass@s3.example.test" }, { MEDIA_S3_BUCKET: "Bad_Bucket" }, { MEDIA_S3_ENDPOINT: "not a url" }]) {
      const error = (() => { try { s3ConfigFromEnv(env(bad)); } catch (caught) { return caught as Error; } })();
      expect(error).toBeInstanceOf(MediaStoreError);
      expect(error!.message).toBe("Media store config failed");
    }
    expect(s3ConfigFromEnv(env({ MEDIA_S3_ENDPOINT: "https://s3.eu-north-1.example.test" })).endpoint.hostname).toBe("s3.eu-north-1.example.test");
  });
});
