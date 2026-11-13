import { assertTestDatabase } from "../../../scripts/test-db-guard.mjs";
import { bookingModeAllowed } from "../booking";

// Local demo only; explicit booking opt-in does not grant workspace/admin tools.
export function assertTimeCardDemo(
  env: Record<string, string | undefined> = process.env,
  args = process.argv,
) {
  if (
    env.BOOKING_TIME_CARD_DEMO !== "1" ||
    env.NODE_ENV === "production" ||
    Object.keys(env).some(
      (k) => (k.startsWith("VERCEL") || k === "NOW_REGION") && env[k],
    ) ||
    args.includes("--allow-workspace") ||
    args.includes("--workday-card")
  )
    throw new Error("TIME_CARD_DEMO_REFUSED");
  try {
    assertTestDatabase(env.DATABASE_URL);
    const booking = env.BOOKING_TIME_CARD_BOOKINGS === "1";
    if (booking) {
      if (!bookingModeAllowed(args, env.SESSION_SECRET)) throw new Error();
    } else if (args.includes("--admin") || args.includes("--allow-bookings")) {
      throw new Error();
    }
  } catch {
    throw new Error("TIME_CARD_DEMO_REFUSED");
  }
}

export function timeCardBookingsEnabled() {
  assertTimeCardDemo();
  return process.env.BOOKING_TIME_CARD_BOOKINGS === "1";
}
