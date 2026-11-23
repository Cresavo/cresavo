import { EMPTY_PAYLOAD_HASH, sha256Hex, signRequest, uriEncode, type SigV4Credentials } from "./sigv4";
import { MediaStoreError, type MediaStore } from "./types";

// An S3-compatible bucket (AWS S3, or an EU provider that speaks the same API), addressed path-style:
// `<endpoint>/<bucket>/<key>`. Requests are signed with SigV4; objects are written without an ACL, so they
// stay private to the bucket's owner. Nothing here logs, and errors carry the HTTP status only.

export interface S3Config extends Omit<SigV4Credentials, "service"> {
  endpoint: URL;
  bucket: string;
}

const TIMEOUT_MS = 15_000;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The S3 settings from MEDIA_S3_*; throws a MediaStoreError("config") naming no value when one is missing or wrong. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config {
  const { MEDIA_S3_ENDPOINT, MEDIA_S3_REGION, MEDIA_S3_BUCKET, MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY } = env;
  if (!MEDIA_S3_ENDPOINT || !MEDIA_S3_REGION || !MEDIA_S3_BUCKET || !MEDIA_S3_ACCESS_KEY_ID || !MEDIA_S3_SECRET_ACCESS_KEY) throw new MediaStoreError("config");
  let endpoint: URL;
  try {
    endpoint = new URL(MEDIA_S3_ENDPOINT);
  } catch {
    throw new MediaStoreError("config");
  }
  // Plain HTTP only to this machine (a local test server); credentials and photos never cross a network unencrypted.
  const secure = endpoint.protocol === "https:" || (endpoint.protocol === "http:" && LOCAL.has(endpoint.hostname));
  if (!secure || endpoint.username || endpoint.password || endpoint.search || !BUCKET.test(MEDIA_S3_BUCKET) || !/^[a-z0-9-]+$/.test(MEDIA_S3_REGION)) {
    throw new MediaStoreError("config");
  }
  return { endpoint, bucket: MEDIA_S3_BUCKET, region: MEDIA_S3_REGION, accessKeyId: MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: MEDIA_S3_SECRET_ACCESS_KEY };
}

export function s3MediaStore(config: S3Config, fetcher: typeof fetch = fetch): MediaStore {
  const credentials: SigV4Credentials = { ...config, service: "s3" };
  const base = config.endpoint.pathname.replace(/\/+$/, "");
  const urlOf = (key: string) => {
    const url = new URL(config.endpoint.href);
    url.pathname = `${base}/${config.bucket}/${key.split("/").map(uriEncode).join("/")}`;
    return url;
  };

  async function send(operation: "put" | "get" | "delete", key: string, body?: Buffer, contentType?: string) {
    const url = urlOf(key);
    const payloadHash = body ? sha256Hex(body) : EMPTY_PAYLOAD_HASH;
    const headers: Record<string, string> = { "x-amz-content-sha256": payloadHash };
    if (body) Object.assign(headers, { "content-type": contentType ?? "application/octet-stream", "content-length": String(body.length) });
    const signed = signRequest({ method: operation === "put" ? "PUT" : operation === "get" ? "GET" : "DELETE", url, headers, payloadHash }, credentials);
    // fetch sets Host itself, from the same URL.
    delete signed.host;
    try {
      return await fetcher(url, {
        method: operation === "put" ? "PUT" : operation === "get" ? "GET" : "DELETE",
        headers: signed,
        body: body ? new Uint8Array(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new MediaStoreError(operation);
    }
  }

  return {
    name: "s3",
    async put(key, bytes, contentType) {
      const response = await send("put", key, bytes, contentType);
      await response.body?.cancel();
      if (!response.ok) throw new MediaStoreError("put", response.status);
      return null;
    },
    async get(key) {
      const response = await send("get", key);
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new MediaStoreError("get", response.status);
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async delete(key) {
      const response = await send("delete", key);
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) throw new MediaStoreError("delete", response.status);
    },
  };
}
