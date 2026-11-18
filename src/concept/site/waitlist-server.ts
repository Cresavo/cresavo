import { clientLimitKey, vercelClientAddress, verifiedClientAddress } from "../../../scripts/client-address.mjs";

// Server-only helpers for POST /api/waitlist: whose bucket a request counts against, and a body
// read that stops at a byte cap. Kept apart from waitlist.ts, which the form's client bundle imports.

/** Requests whose client address cannot be verified share one bucket: they can slow each other down, never escape the limit. */
export const UNVERIFIED_CLIENT = "unverified";

/**
 * The rate-limit key, from the same client-address handling the booking routes use: on Vercel the
 * platform's overwritten `x-real-ip`, otherwise the address the supported server wrapper signed.
 * Caller-supplied forwarding headers (`X-Forwarded-For`) are never read.
 */
export function waitlistClientKey(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  try {
    if (env.BOOKING_RUNTIME === "vercel" && env.VERCEL === "1") return clientLimitKey(vercelClientAddress({ "x-real-ip": headers.get("x-real-ip") ?? undefined }));
    return verifiedClientAddress(headers, env.BOOKING_ADDRESS_SECRET);
  } catch {
    return UNVERIFIED_CLIENT;
  }
}

/** The body as text, or "too-large" as soon as it passes `limit` bytes (by Content-Length or while streaming). */
export async function readCapped(request: Request, limit: number): Promise<string | "too-large"> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return "too-large";
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return "too-large";
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
