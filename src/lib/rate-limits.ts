// Requests per 15-minute window, shared by the memory and PostgreSQL stores.
export const RATE_LIMITS = {
  login: 5,
  bookings: 30,
  "admin-bookings": 60,
  "agent-api": 300,
  // Split-mode customer consent page: per client address, and per proposal across addresses.
  "consent-ip": 60,
  "consent-proposal": 20,
} as const;
export type RateLimitRoute = keyof typeof RATE_LIMITS;
