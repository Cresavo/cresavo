import type { DemoState, StaffId } from "../data/types";
import { manualGaps } from "./waitlist-match";
import { finishOffer, removeEntry } from "./waitlist-offer";
import { HOLD_MINUTES, OFFER_MODES, type OfferRules } from "./waitlist-types";

/** The owner's and customers' waitlist actions that need no booking rules (claims live with online booking). */
export type WaitlistAction =
  /** Owner: offer mode, hold length, pause. */
  | { type: "waitlist/rules"; rules: Partial<OfferRules> }
  /** Owner: start the queue for a pending gap, or for an open time chosen on a day (`opening`). */
  | { type: "waitlist/offer"; gapId: string; opening?: { date: string; staffId: StaffId } }
  /** The salon's clock: lapse ended holds, send what quiet hours held back, drop passed entries. */
  | { type: "waitlist/advance" }
  /** Customer: say no to a personal offer. */
  | { type: "online/decline"; id: string }
  /** Customer: leave one request (an entry id), or every request (`all`, from an entry or offer id). */
  | { type: "online/leave"; id: string; all?: boolean };

export function validRules(rules: OfferRules): boolean {
  return OFFER_MODES.includes(rules.mode) && typeof rules.paused === "boolean" && (HOLD_MINUTES as readonly number[]).includes(rules.minutes);
}

export function applyWaitlist(state: DemoState, action: WaitlistAction, now: number): DemoState {
  switch (action.type) {
    case "waitlist/rules": {
      const rules: OfferRules = { ...state.waitlistRules, ...action.rules };
      const same = rules.mode === state.waitlistRules.mode && rules.minutes === state.waitlistRules.minutes && rules.paused === state.waitlistRules.paused;
      return !validRules(rules) || same ? state : { ...state, waitlistRules: { mode: rules.mode, minutes: rules.minutes, paused: rules.paused } };
    }
    case "waitlist/offer": {
      const { modules, waitlistRules: rules } = state;
      if (!modules.waitlist || rules.paused || rules.mode === "off" ||
          state.waitlistOffers.some((o) => o.gapId === action.gapId && o.status === "offered")) return state;
      const existing = state.waitlistGaps.find((g) => g.id === action.gapId);
      const gap = existing ?? (action.opening && manualGaps(state, action.opening.date, action.opening.staffId, now).find((g) => g.gap.id === action.gapId)?.gap);
      if (!gap) return state;
      return { ...state, waitlistGaps: [...state.waitlistGaps.filter((g) => g !== existing), { ...gap, approved: true }] };
    }
    case "waitlist/advance":
      return state;
    case "online/decline": {
      const offer = state.waitlistOffers.find((o) => o.id === action.id && o.status === "offered" && o.expiresAt > now);
      return offer ? finishOffer(state, offer, "declined", now) : state;
    }
    case "online/leave": {
      const customerId = state.waitlistEntries.find((e) => e.id === action.id)?.customerId ?? state.waitlistOffers.find((o) => o.id === action.id)?.customerId;
      if (!customerId) return state;
      const entries = state.waitlistEntries.filter((e) => (action.all ? e.customerId === customerId : e.id === action.id));
      let next = state;
      for (const entry of entries) {
        next = removeEntry(next, entry.id);
        for (const offer of next.waitlistOffers) {
          if (offer.entryId === entry.id && offer.status === "offered") next = finishOffer(next, offer, offer.expiresAt > now ? "declined" : "lapsed", now);
        }
      }
      return next;
    }
  }
}
