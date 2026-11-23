import { addDays } from "../data/dates";
import type { DateKey, DemoState, PosterStyle } from "../data/types";
import { translate, type MessageKey } from "../i18n";
import { firstSentence, newestReview, type Draft } from "./draft";

// A campaign starts from what the owner wants to achieve, not from a template:
// each goal fills in the offer and suggests three posters with different
// compositions (photo first, offer first, person first).

export const GOALS = ["fill", "promote", "wellness", "giftcard", "review"] as const;
export type Goal = (typeof GOALS)[number];

/** Three suggested poster styles per goal, best first. None shows a price the goal does not offer. */
export const GOAL_STYLES: Record<Goal, [PosterStyle, PosterStyle, PosterStyle]> = {
  fill: ["slots", "fullphoto", "typography"],
  promote: ["price", "fullphoto", "portrait"],
  wellness: ["portrait", "pricelist", "price"],
  giftcard: ["portrait", "season", "pricelist"],
  review: ["review", "portrait", "season"],
};

/** The goals this salon can pick: sharing a review needs a published review. */
export const availableGoals = (state: DemoState): Goal[] => GOALS.filter((goal) => goal !== "review" || newestReview(state) !== null);

/** Poster fields that carry words, which a goal replaces; the rest (photos, size, badges) is the owner's look. */
const WORDS = new Set(["lead", "headline", "detail"]);
export const withoutWords = (edits: Draft["posterEdits"]) =>
  Object.fromEntries(Object.entries(edits).filter(([key]) => !WORDS.has(key))) as Draft["posterEdits"];

const WEEK = 6;
const RUN = 13;

/**
 * What choosing a goal changes in the draft: the campaign's name and offer, the first suggested style and the
 * poster's words, in the business's language (they are for its customers). Choosing the current goal again
 * changes nothing, so the owner's later edits stay.
 */
export function applyGoal(state: DemoState, draft: Draft, goal: Goal, today: DateKey): Partial<Draft> {
  if (draft.goal === goal) return {};
  const say = (key: MessageKey) => translate(state.localization.language, key);
  const first = state.services.find((s) => s.id === draft.serviceIds[0]) ?? state.services[0];
  const base = { goal, style: GOAL_STYLES[goal][0], holidayId: undefined, from: today, to: addDays(today, RUN), discountPercent: 0 };
  const kept = withoutWords(draft.posterEdits);
  switch (goal) {
    case "fill":
      return { ...base, name: say("campaigns.goal.fill.name"), to: addDays(today, WEEK), posterEdits: kept };
    case "promote":
      return { ...base, name: first ? first.name : draft.name, discountPercent: draft.discountPercent || 10, posterEdits: kept };
    case "wellness":
      return { ...base, name: say("campaigns.goal.wellness.name"), posterEdits: { ...kept, lead: say("campaigns.goal.wellness.lead"), headline: say("campaigns.goal.wellness.headline") } };
    case "giftcard":
      return { ...base, name: say("campaigns.goal.giftcard.name"), posterEdits: { ...kept, lead: say("campaigns.goal.giftcard.lead"), headline: say("campaigns.goal.giftcard.headline"), detail: say("campaigns.goal.giftcard.detail") } };
    case "review": {
      // The review layout quotes it in full; the other suggestions carry its first sentence and the customer's name.
      const review = newestReview(state);
      const quote = review ? `“${firstSentence(review.text)}”${review.author ? ` – ${review.author}` : ""}` : "";
      return { ...base, name: say("campaigns.goal.review.name"), posterEdits: { ...kept, headline: say("campaigns.goal.review.name"), ...(quote && { detail: quote }) } };
    }
  }
}
