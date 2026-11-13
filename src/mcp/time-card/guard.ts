import { assertTestDatabase } from "../../../scripts/test-db-guard.mjs";

// This profile is deliberately local and read-only; it is not remote auth.
export function assertTimeCardDemo(
  env: Record<string, string | undefined> = process.env,
  args = process.argv,
) {
  if (
    env.BOOKING_TIME_CARD_DEMO !== "1" ||
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV ||
    args.some((arg) =>
      ["--admin", "--allow-bookings", "--allow-workspace"].includes(arg),
    )
  )
    throw new Error("TIME_CARD_DEMO_REFUSED");
  try {
    assertTestDatabase(env.DATABASE_URL);
  } catch {
    throw new Error("TIME_CARD_DEMO_REFUSED");
  }
}
