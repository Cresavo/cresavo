// Svix webhook signatures (used by Resend).
// Source: https://docs.svix.com/receiving/verifying-payloads/how-manual
// Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with the
// base64-decoded secret after "whsec_", base64. The header holds space-separated
// "v1,<signature>" entries. Timestamps more than 5 minutes off are refused.
import { hmac, safeEqual } from "./crypto";

export const SVIX_TOLERANCE_SECONDS = 300;

export function verifySvix(secret: string, headers: Record<string, string>, rawBody: string, nowSeconds: number): boolean {
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const header = headers["svix-signature"];
  if (!id || !timestamp || !header || !secret.startsWith("whsec_") || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SVIX_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (key.length === 0) return false;
  const expected = hmac("sha256", key, `${id}.${timestamp}.${rawBody}`, "base64");
  return header.split(" ").some((entry) => {
    const [version, signature] = entry.split(",", 2);
    return version === "v1" && !!signature && safeEqual(signature, expected);
  });
}
