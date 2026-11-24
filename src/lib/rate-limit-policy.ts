// One table for both rate-limit stores (process memory and Postgres).
export const RATE_LIMITS = {
  login: { limit: 5, minutes: 15 },
  signup: { limit: 5, minutes: 15 },
  "password-reset": { limit: 5, minutes: 15 },
  "password-reset-submit": { limit: 10, minutes: 15 },
  bookings: { limit: 30, minutes: 15 },
  "admin-bookings": { limit: 60, minutes: 15 },
  "agent-api": { limit: 300, minutes: 15 },
  // Per client address in front of agent authentication (ADR 7), the same budgets as the gateway.
  "agent-ip": { limit: 60, minutes: 1 },
  "agent-ip-proposal": { limit: 5, minutes: 60 },
  "agent-ip-booking": { limit: 5, minutes: 60 },
  // Customer agent OAuth endpoints, per client address.
  "agent-oauth": { limit: 60, minutes: 1 },
  "public-read": { limit: 120, minutes: 15 },
  "public-booking": { limit: 10, minutes: 15 },
  // The writes one salon takes from the public, whoever sends them.
  "public-tenant": { limit: 60, minutes: 60 },
  "media-upload": { limit: 60, minutes: 15 },
  "journal-read": { limit: 300, minutes: 15 },
  "journal-write": { limit: 120, minutes: 15 },
} as const;

export type RateLimitRoute = keyof typeof RATE_LIMITS;
