import type { DemoState } from "../data/types";
import type { MessageKey } from "../i18n";
import { checklistProgress } from "../onboarding/salon";

// What is still missing for customers to book, read from the salon itself, each with a calm next step and the
// help-map place that fixes it. Pairs with Getting started on Today (the same checklist).

export type SetupGap = "services" | "hours" | "share";

export interface SetupGapMessage {
  what: MessageKey;
  why?: MessageKey;
  next: MessageKey;
  showMe: string;
}

export const SETUP_GAP_MESSAGES: Record<SetupGap, SetupGapMessage> = {
  services: { what: "setupGaps.services.what", why: "setupGaps.services.why", next: "setupGaps.services.next", showMe: "services.add" },
  hours: { what: "setupGaps.hours.what", why: "setupGaps.hours.why", next: "setupGaps.hours.next", showMe: "hours.weekly" },
  share: { what: "setupGaps.share.what", why: "setupGaps.share.why", next: "setupGaps.share.next", showMe: "link.copy" },
};

/** The gaps, most important first: nothing can be booked without treatments and opening hours. */
export function setupGaps(state: DemoState): SetupGap[] {
  const progress = checklistProgress(state);
  const open = Object.values(state.salon.hours).some(Boolean);
  return [
    !progress.addServices && "services" as const,
    !open && "hours" as const,
    !progress.share && "share" as const,
  ].filter((gap): gap is SetupGap => !!gap);
}
