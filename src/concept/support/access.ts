import { recordId } from "../data/ids";
import type { DemoState } from "../data/types";

/** The owner lets support look at the account for a limited time. Read access only. */
export interface SupportGrant {
  id: string;
  grantedAt: number;
  until: number;
  revokedAt?: number;
}

export type GrantHours = 1 | 24;

const HOUR = 60 * 60 * 1000;

export function activeGrant(state: DemoState, now: number): SupportGrant | undefined {
  return state.supportGrants.find((g) => !g.revokedAt && g.until > now);
}

/** Starts a grant. One at a time: asking again while access is open changes nothing. */
export function grantSupport(state: DemoState, hours: GrantHours, at: number): DemoState {
  if (activeGrant(state, at)) return state;
  const grant: SupportGrant = { id: recordId("sg", state.seq), grantedAt: at, until: at + hours * HOUR };
  return { ...state, seq: state.seq + 1, supportGrants: [grant, ...state.supportGrants] };
}

export function revokeSupport(state: DemoState, at: number): DemoState {
  const grant = activeGrant(state, at);
  if (!grant) return state;
  return { ...state, supportGrants: state.supportGrants.map((g) => (g.id === grant.id ? { ...g, revokedAt: at } : g)) };
}

export type GrantStatus = "active" | "revoked" | "expired";

export function grantStatus(grant: SupportGrant, now: number): GrantStatus {
  if (grant.revokedAt) return "revoked";
  return grant.until > now ? "active" : "expired";
}
