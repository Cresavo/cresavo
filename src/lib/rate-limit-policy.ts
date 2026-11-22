// Limits and window lengths of every rate-limited route, shared by the in-process and the Postgres store.

export type RateRoute =
  | "login" | "signup" | "bookings" | "admin-bookings" | "agent-api" | "public-read" | "public-booking" | "public-tenant"
  // Owner accounts: failed logins per account, lock-outs per account (the backoff step) and the lock itself.
  | "login-account" | "login-strikes" | "login-lock"
  // Owner password reset: requests per address, per mailbox, and reset submissions per address.
  | "password-reset" | "password-reset-email" | "password-reset-submit";

const MINUTE = 60_000;

export const RATE_POLICY: Record<RateRoute, { limit: number; windowMs: number }> = {
  login: { limit: 5, windowMs: 15 * MINUTE },
  signup: { limit: 5, windowMs: 15 * MINUTE },
  bookings: { limit: 30, windowMs: 15 * MINUTE },
  "admin-bookings": { limit: 60, windowMs: 15 * MINUTE },
  "agent-api": { limit: 300, windowMs: 15 * MINUTE },
  "public-read": { limit: 120, windowMs: 15 * MINUTE },
  "public-booking": { limit: 10, windowMs: 15 * MINUTE },
  "public-tenant": { limit: 60, windowMs: 60 * MINUTE },
  "login-account": { limit: 5, windowMs: 15 * MINUTE },
  // Lock-outs are remembered for a day; the lock's own length is chosen per lock (see owner-lockout.ts).
  "login-strikes": { limit: 20, windowMs: 24 * 60 * MINUTE },
  "login-lock": { limit: 1, windowMs: 15 * MINUTE },
  "password-reset": { limit: 5, windowMs: 15 * MINUTE },
  "password-reset-email": { limit: 3, windowMs: 15 * MINUTE },
  "password-reset-submit": { limit: 10, windowMs: 15 * MINUTE },
};
