import { addDays } from "../data/dates";
import type { CampaignPoster, Channel, DateKey, DemoState, PosterStyle } from "../data/types";
import { t, tc } from "../i18n";
import { dayChipLabel, formatDayMonth, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { openSlots } from "../booking/suggest";
import { publicName, recentReviews } from "../booking/reviews";
import { salonClock } from "../tools/clock";
import { isEngineStyle, POSTER_IMAGES } from "./poster-layout";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { CHANNELS } from "./channels";
import { listServices, offerText } from "./copy";
import { bookingHome } from "../booking/links";
import { campaignCode, trackingLink } from "./links";
import { isOwnPhoto } from "./own-photo";
import { isNeutralTone } from "./poster-engine/tone";
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
  posterEdits: Partial<Pick<CampaignPoster, "image" | "headline" | "detail" | "textSize" | "focus" | "badges" | "before" | "photoTone">>;
}

/**
 * A new campaign. With `last`, the poster starts from the owner's latest one: its style,
 * text size and photo crop, so the choices they keep making need not be made again.
 */
export function newDraft(prefill: CampaignPrefill, last?: CampaignPoster): Draft {
  const posterEdits: Draft["posterEdits"] = {
    ...(last?.textSize && { textSize: last.textSize }),
    ...(last?.focus && { focus: last.focus }),
    ...(last?.badges?.length && { badges: last.badges }),
  };
  return { ...prefill, channels: [...CHANNELS], copy: {}, copyFor: "", style: last?.style ?? "price", posterEdits };
}

/** The poster of the most recently made campaign (new campaigns come first). */
export const latestPoster = (state: Pick<DemoState, "campaigns">) => state.campaigns.find((campaign) => campaign.poster)?.poster;

/** Used when the studio opens without a request: the first treatment, a modest offer for two weeks. */
export function defaultPrefill(state: DemoState, today: DateKey): CampaignPrefill {
  const service = state.services[0];
  return {
    name: service ? t("campaigns.name.discount", { percent: 10, service: service.name }) : "",
    serviceIds: service ? [service.id] : [],
    discountPercent: 10,
    from: today,
    to: addDays(today, 13),
  };
}

export function serviceNames(state: DemoState, draft: Pick<Draft, "serviceIds">): string[] {
  return state.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => s.name);
}

export function draftLink(state: DemoState, draft: Pick<Draft, "name" | "from">, origin?: string): string {
  if (state.industry) {
    const url = new URL(bookingHome(state.salon.slug), origin ?? window.location.origin);
    url.searchParams.set("campaign", campaignCode(draft.name, draft.from));
    return url.href;
  }
  return trackingLink(draft.name, draft.from);
}

/** The sentence the texts are written from. */
export function draftOffer(state: DemoState, draft: Draft): string {
  const language = state.localization.language;
  const names = state.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => serviceCopy(s, language).name);
  return offerText({ name: draft.name, serviceNames: names, discountPercent: draft.discountPercent, to: draft.to }, language);
}

export function offerSignature(state: DemoState, draft: Draft): string {
  return `${state.localization.language}|${draftOffer(state, draft)}|${draftLink(state, draft)}`;
}

/** The poster a published campaign keeps: a photo that only lives in this tab is replaced by the template's own. */
export function posterToSave(state: DemoState, draft: Draft): CampaignPoster {
  const { image, before } = draft.posterEdits;
  const kept = { ...draft.posterEdits, ...(image && isOwnPhoto(image) && { image: undefined }), ...(before && isOwnPhoto(before) && { before: undefined }) };
  return resolvePoster(state, { ...draft, posterEdits: kept });
}

const MAX_LIST = 6;

const SLOT_DAYS = 7;
const MAX_SLOTS = 4;

/** The first day within a week that still has free times for the treatment, with up to four of them spread over the day. */
function freeTimes(state: DemoState, serviceId: string | undefined) {
  if (!serviceId) return null;
  const clock = salonClock();
  for (let i = 0; i < SLOT_DAYS; i++) {
    const date = addDays(clock.today, i);
    const slots = openSlots(state, serviceId, date, clock);
    if (!slots.length) continue;
    const step = Math.max(1, Math.floor(slots.length / MAX_SLOTS));
    const picked = slots.filter((_, index) => index % step === 0).slice(0, MAX_SLOTS);
    return { date, today: clock.today, count: slots.length, all: slots.map((slot) => formatTime(slot.start)), times: picked.map((slot) => formatTime(slot.start)) };
  }
  return null;
}

/** The times saved on a Free-times poster that are no longer free on the first day with room, for the poster's treatment. */
export function bookedPosterTimes(state: DemoState, poster: Pick<CampaignPoster, "style" | "items">, serviceId: string | undefined): string[] {
  if (poster.style !== "slots" || !serviceId) return [];
  const free = new Set(freeTimes(state, serviceId)?.all);
  return (poster.items ?? []).map((item) => item.name).filter((time) => !free.has(time));
}

/** What the season, review and free-times posters show, from the holiday, the published reviews and the calendar. */
function storyFields(state: DemoState, draft: Draft): Pick<CampaignPoster, "cta" | "quote" | "author" | "sticker" | "items"> {
  if (draft.style === "review") {
    const [review] = recentReviews(state.reviews, 1);
    const customer = review && state.customers.find((c) => c.id === review.customerId);
    return review ? { quote: review.text, author: customer ? publicName(customer.firstName, customer.lastName) : "" } : {};
  }
  if (draft.style === "slots") {
    const free = freeTimes(state, draft.serviceIds[0]);
    return free ? { sticker: [dayChipLabel(free.date, free.today), formatDayMonth(free.date)], items: free.times.map((name) => ({ name, price: "" })), cta: t("campaigns.engine.book") } : { cta: t("campaigns.engine.book") };
  }
  return { cta: t("campaigns.engine.book") };
}

/** Price, sticker and price list for the engine styles, from the treatments the campaign is about. */
function engineFields(state: DemoState, draft: Draft): Pick<CampaignPoster, "price" | "sticker" | "items" | "cta" | "quote" | "author"> {
  if (draft.style === "season" || draft.style === "review" || draft.style === "slots") return storyFields(state, draft);
  if (draft.style === "beforeafter") return { cta: t("campaigns.engine.book") };
  const chosen = state.services.filter((s) => draft.serviceIds.includes(s.id) && !s.hidden);
  const listed = (chosen.length > 1 ? chosen : state.services.filter((s) => !s.hidden)).slice(0, MAX_LIST);
  const off = (price: number) => Math.round(price * (1 - draft.discountPercent / 100));
  const first = chosen[0];
  return {
    ...(first && { price: formatMoney(off(first.price)) }),
    ...(draft.discountPercent > 0 && { sticker: [t("campaigns.engine.offer"), `–${draft.discountPercent}%`] as [string, string] }),
    items: listed.map((s) => ({ name: s.name, price: formatMoney(chosen.includes(s) ? off(s.price) : s.price) })),
  };
}

function defaultHeadline(state: DemoState, draft: Draft): string {
  if (draft.style === "price" || draft.style === "beforeafter") return state.services.find((s) => s.id === draft.serviceIds[0])?.name ?? draft.name;
  if (draft.style === "season") return state.holidays.find((h) => h.id === draft.holidayId)?.name ?? draft.name;
  if (draft.style === "slots") {
    const free = freeTimes(state, draft.serviceIds[0]);
    return free ? tc("campaigns.engine.slotsLeft", free.count) : draft.name;
  }
  if (draft.style === "pricelist") return draft.name;
  return draft.discountPercent > 0 ? t("campaigns.posterOffer", { percent: draft.discountPercent }) : draft.name;
}

function defaultDetail(state: DemoState, draft: Draft): string {
  const first = state.services.find((s) => s.id === draft.serviceIds[0]);
  if ((draft.style === "price" || draft.style === "beforeafter") && first?.description) return first.description;
  if (draft.style === "slots" && first) return `${first.name} · ${formatDuration(first.duration)}`;
  return listServices(serviceNames(state, draft));
}

/** The poster as shown: the owner's edits on top of what follows from the offer. */
export function resolvePoster(state: DemoState, draft: Draft): CampaignPoster {
  const first = state.services.find((s) => s.id === draft.serviceIds[0]);
  const image = draft.posterEdits.image ?? (first?.category === "massage" ? "/demo/massage.webp" : "/demo/salon.webp");
  return {
    style: draft.style,
    image,
    // Until the owner adds her own, the before slot shows the other demo photo.
    ...(draft.style === "beforeafter" && { before: draft.posterEdits.before ?? POSTER_IMAGES.find((other) => other !== image) ?? image }),
    headline: draft.posterEdits.headline ?? defaultHeadline(state, draft),
    detail: draft.posterEdits.detail ?? defaultDetail(state, draft),
    ...(isEngineStyle(draft.style) && engineFields(state, draft)),
    ...(draft.posterEdits.textSize && { textSize: draft.posterEdits.textSize }),
    ...(draft.posterEdits.focus && { focus: draft.posterEdits.focus }),
    ...(draft.posterEdits.badges?.length && { badges: draft.posterEdits.badges }),
    ...(draft.posterEdits.photoTone && !isNeutralTone(draft.posterEdits.photoTone) && { photoTone: draft.posterEdits.photoTone }),
  };
}
