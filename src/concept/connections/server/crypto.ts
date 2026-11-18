import { createHmac, timingSafeEqual } from "node:crypto";

export function hmac(algorithm: "sha1" | "sha256", key: string | Buffer, data: string, encoding: "hex" | "base64"): string {
  return createHmac(algorithm, key).update(data, "utf8").digest(encoding);
}

/** Constant-time comparison of two strings; false for different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
