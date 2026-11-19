import { addDays } from "../data/dates";
import type { CampaignPoster, Channel, DateKey, DemoState, PosterStyle } from "../data/types";
import { t } from "../i18n";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { CHANNELS } from "./channels";
import { listServices, offerText } from "./copy";
import { trackingLink } from "./links";
import type { CampaignPrefill } from "./prefill";

/** A campaign being made in the studio, before it is published. */
export interface Draft extends CampaignPrefill {
  channels: Channel[];
  /** Final text per channel. */
  copy: Partial<Record<Channel, string>>;
  /** The offer the texts were written for; texts are rewritten when it changes. */
  copyFor: string;
  style: PosterStyle;
  /** Poster text and photo the owner changed; the rest follows the offer. */
  posterEdits: Partial<Pick<CampaignPoster, "image" | "headline" | "detail">>;
}

export function newDraft(prefill: CampaignPrefill): Draft {
  return { ...prefill, channels: [...CHANNELS], copy: {}, copyFor: "", style: "calm", posterEdits: {} };
}

/** Used when the studio opens without a request: the first treatment, a modest offer for two weeks. */
export function defaultPrefill(state: DemoState, today: DateKey): CampaignPrefill {
  const service = state.services[0];
  return {
    name: t("campaigns.name.discount", { percent: 10, service: service.name }),
    serviceIds: [service.id],
    discountPercent: 10,
    from: today,
    to: addDays(today, 13),
  };
}

export function serviceNames(state: DemoState, draft: Pick<Draft, "serviceIds">): string[] {
  return state.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => s.name);
}

export function draftLink(draft: Pick<Draft, "name" | "from">): string {
  return trackingLink(draft.name, draft.from);
}

/** The sentence the texts are written from. */
export function draftOffer(state: DemoState, draft: Draft): string {
  const language = state.localization.language;
  const names = state.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => serviceCopy(s, language).name);
  return offerText({ name: draft.name, serviceNames: names, discountPercent: draft.discountPercent, to: draft.to }, language);
}

export function offerSignature(state: DemoState, draft: Draft): string {
  return `${state.localization.language}|${draftOffer(state, draft)}|${draftLink(draft)}`;
}

/** The poster as shown: the owner's edits on top of what follows from the offer. */
export function resolvePoster(state: DemoState, draft: Draft): CampaignPoster {
  const first = state.services.find((s) => s.id === draft.serviceIds[0]);
  return {
    style: draft.style,
    image: draft.posterEdits.image ?? (first?.category === "massage" ? "/demo/massage.webp" : "/demo/salon.webp"),
    headline: draft.posterEdits.headline ?? (draft.discountPercent > 0 ? t("campaigns.posterOffer", { percent: draft.discountPercent }) : draft.name),
    detail: draft.posterEdits.detail ?? listServices(serviceNames(state, draft)),
  };
}
