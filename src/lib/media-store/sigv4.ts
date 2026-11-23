import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 for S3-compatible object storage, with node:crypto only
// (https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html).
// The payload is signed by its SHA-256 (x-amz-content-sha256). Path segments are
// encoded once, as S3 expects; the secret never leaves this module.

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export interface SigV4Request {
  method: string;
  url: URL;
  /** Lower- or mixed-case names; all of them are signed. `host` is added from the URL. */
  headers: Record<string, string>;
  /** Hex SHA-256 of the body, or "UNSIGNED-PAYLOAD". */
  payloadHash: string;
}

export const EMPTY_PAYLOAD_HASH = createHash("sha256").update("").digest("hex");

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986 encoding as SigV4 wants it: everything but unreserved characters, upper-case hex. */
export const uriEncode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/** `20150830T123600Z` for a date. */
export const amzDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function canonicalQuery(url: URL) {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [uriEncode(key), uriEncode(value)] as const)
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** The path with each segment decoded once and encoded again, so a key is never encoded twice. */
const canonicalPath = (url: URL) => url.pathname.split("/").map((segment) => uriEncode(decodeURIComponent(segment))).join("/") || "/";

/** The canonical request, string to sign and signature; exported for the test vectors. */
export function signature(request: SigV4Request, credentials: SigV4Credentials, date: Date) {
  const stamp = amzDate(date);
  const day = stamp.slice(0, 8);
  const headers: Record<string, string> = { host: request.url.host };
  for (const [name, value] of Object.entries(request.headers)) headers[name.toLowerCase()] = value;
  headers["x-amz-date"] = stamp;
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonical = [
    request.method.toUpperCase(),
    canonicalPath(request.url),
    canonicalQuery(request.url),
    names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join(""),
    signedHeaders,
    request.payloadHash,
  ].join("\n");
  const scope = `${day}/${credentials.region}/${credentials.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), credentials.region), credentials.service), "aws4_request");
  const value = createHmac("sha256", key).update(stringToSign, "utf8").digest("hex");
  return {
    canonical,
    stringToSign,
    signature: value,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${value}`,
    },
  };
}

/** The request's headers with x-amz-date and Authorization added. */
export function signRequest(request: SigV4Request, credentials: SigV4Credentials, date = new Date()): Record<string, string> {
  return signature(request, credentials, date).headers;
}
