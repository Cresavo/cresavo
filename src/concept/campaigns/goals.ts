import { addDays } from "../data/dates";
import type { DateKey, DemoState, PosterStyle } from "../data/types";
import { t } from "../i18n";
import type { Draft } from "./draft";

// A campaign starts from what the owner wants to achieve, not from a template:
// each goal fills in the offer and suggests three posters with different
// compositions (photo first, offer first, person first).

export const GOALS = ["fill", "promote", "wellness", "giftcard", "review"] as const;
export type Goal = (typeof GOALS)[number];

/** Three suggested poster styles per goal, best first. */
export const GOAL_STYLES: Record<Goal, [PosterStyle, PosterStyle, PosterStyle]> = {
  fill: ["slots", "price", "portrait"],
  promote: ["price", "beforeafter", "portrait"],
  wellness: ["portrait", "pricelist", "price"],
  giftcard: ["portrait", "season", "price"],
  review: ["review", "portrait", "beforeafter"],
};

const WEEK = 6;
const RUN = 13;

/** What choosing a goal changes in the draft: the campaign's name and offer, the first suggested style and its words. */
export function applyGoal(state: DemoState, draft: Draft, goal: Goal, today: DateKey): Partial<Draft> {
  const first = state.services.find((s) => s.id === draft.serviceIds[0]) ?? state.services[0];
  const base = { goal, style: GOAL_STYLES[goal][0], holidayId: undefined, from: today };
  // Words the goal puts on the poster replace earlier ones; photos, text size and badges stay.
  const { lead: _lead, headline: _headline, detail: _detail, ...kept } = draft.posterEdits;
  switch (goal) {
    case "fill":
      return { ...base, name: t("campaigns.goal.fill.name"), discountPercent: 0, to: addDays(today, WEEK), posterEdits: kept };
    case "promote":
      return { ...base, name: first ? first.name : draft.name, discountPercent: draft.discountPercent || 10, to: addDays(today, RUN), posterEdits: kept };
    case "wellness":
      return { ...base, name: t("campaigns.goal.wellness.name"), discountPercent: 0, to: addDays(today, RUN), posterEdits: { ...kept, lead: t("campaigns.goal.wellness.lead"), headline: t("campaigns.goal.wellness.headline") } };
    case "giftcard":
      return { ...base, name: t("campaigns.goal.giftcard.name"), discountPercent: 0, to: addDays(today, RUN), posterEdits: { ...kept, lead: t("campaigns.goal.giftcard.lead"), headline: t("campaigns.goal.giftcard.headline"), detail: t("campaigns.goal.giftcard.detail") } };
    case "review":
      return { ...base, name: t("campaigns.goal.review.name"), discountPercent: 0, to: addDays(today, RUN), posterEdits: kept };
  }
}
