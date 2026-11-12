import { createHash } from "node:crypto";

export const DEMO_ADMIN_EMAIL = "demo-owner@example.test";

// Operator opt-in, never inferred from a URL, header or client payload. The
// database fingerprint survives credential rotation but not a change of target.
export function demoDatabaseFingerprint(value: string) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    [...url.searchParams.keys()].some((k) =>
      ["host", "hostaddr"].includes(k.toLowerCase()),
    )
  )
    throw new Error("DEMO_DATABASE_REFUSED");
  return createHash("sha256")
    .update(
      `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`,
    )
    .digest("hex");
}

export function demoAccessEnabled(env = process.env) {
  if (
    env.BOOKING_DEMO_ACCESS !== "1" ||
    env.BOOKING_RUNTIME !== "vercel" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "preview" ||
    !env.BOOKING_DEMO_PROJECT_ID ||
    env.VERCEL_PROJECT_ID !== env.BOOKING_DEMO_PROJECT_ID ||
    !/^[a-f0-9]{64}$/.test(env.BOOKING_DEMO_DATABASE ?? "")
  )
    return false;
  try {
    return (
      demoDatabaseFingerprint(env.DATABASE_URL ?? "") ===
      env.BOOKING_DEMO_DATABASE
    );
  } catch {
    return false;
  }
}
