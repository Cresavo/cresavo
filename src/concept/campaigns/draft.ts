import { addDays } from "../data/dates";
import type { CampaignPoster, Channel, DateKey, DemoState, PosterStyle } from "../data/types";
import { t, tc, translate } from "../i18n";
import { dayChipLabel, formatDate, formatDayLong, formatDayMonth, formatDayShort, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { openSlots } from "../booking/suggest";
import { publicName, recentReviews } from "../booking/reviews";
import { salonClock } from "../tools/clock";
import type { Goal } from "./goals";
import { isEngineStyle, POSTER_IMAGES } from "./poster-layout";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { CHANNELS, cleanSignOff } from "./channels";
import { listServices, offerText, rulesCopy } from "./copy";
import { bookingHome } from "../booking/links";
import { campaignCode, trackingLink } from "./links";
import { isOwnPhoto } from "./own-photo";
import { isNeutralTone } from "./poster-engine/tone";
import type { CampaignPrefill } from "./prefill";
import type { OwnerVoice } from "./voice";

/** A campaign being made in the studio, before it is published. */
export interface Draft extends CampaignPrefill {
  /** What the owner wants to achieve; it decides the three suggested posters. */
  goal?: Goal;
  channels: Channel[];
  /** Final text per channel. */
  copy: Partial<Record<Channel, string>>;
  /** The offer the texts were written for; texts are rewritten when it changes. */
  copyFor: string;
  /** Channels whose text the owner has changed by hand; a new offer never overwrites them. */
  copyEdited?: Channel[];
  /** The owner's own closing line, typed in the texts step. */
  signOff?: string;
  /** Edited channels whose offer changed after the owner wrote them: to be looked over; cleared when edited again. */
  copyStale?: Channel[];
  style: PosterStyle;
  /** Poster text and photo the owner changed; the rest follows the offer. */
  posterEdits: Partial<Pick<CampaignPoster, "image" | "headline" | "detail" | "textSize" | "focus" | "arrangement" | "badges" | "before" | "lead" | "backdrop" | "socialQr" | "photoTone">>;
}

/**
 * A new campaign. With `last`, the poster starts from the owner's latest one: its style,
 * text size and photo crop, so the choices they keep making need not be made again.
 */
export function newDraft(prefill: CampaignPrefill, last?: CampaignPoster, signOff?: string): Draft {
  const posterEdits: Draft["posterEdits"] = {
    ...(last?.textSize && { textSize: last.textSize }),
    ...(last?.focus && { focus: last.focus }),
    ...(last?.arrangement && { arrangement: last.arrangement }),
    ...(last?.badges?.length && { badges: last.badges }),
    ...(last?.socialQr && { socialQr: true }),
  };
  return { ...prefill, channels: [...CHANNELS], copy: {}, copyFor: "", style: last?.style ?? "price", posterEdits, ...(signOff && { signOff }) };
}

/** The sign-off of the most recently made campaign, so the owner does not type it again. */
export const latestSignOff = (state: Pick<DemoState, "campaigns">) => state.campaigns[0]?.signOff;

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

/** The sentence the texts are written from, shaped by the campaign's goal in the business's language. */
export function draftOffer(state: DemoState, draft: Draft): string {
  const language = state.localization.language;
  const names = state.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => serviceCopy(s, language).name);
  const plain = offerText({ name: draft.name, serviceNames: names, discountPercent: draft.discountPercent, to: draft.to }, language);
  switch (draft.goal) {
    case "fill": {
      const free = freeTimes(state, draft.serviceIds[0], draft);
      return free ? translate(language, "campaigns.offer.fill", { day: formatDayLong(free.date, language), times: free.times.join(", ") }) : plain;
    }
    case "wellness": {
      const badges = draft.posterEdits.badges?.join(", ");
      const vars = { name: draft.name, services: listServices(names, language), badges: badges ?? "", date: formatDate(draft.to, language) };
      return translate(language, badges ? "campaigns.offer.wellness" : "campaigns.offer.wellnessNoBadges", vars);
    }
    case "giftcard":
      return translate(language, "campaigns.offer.giftcard", { name: draft.name });
    case "review": {
      const review = newestReview(state);
      return review ? reviewOffer(review, firstSentence(review.text)) : plain;
    }
    default:
      return plain;
  }
}

/** The quote with who said it; the attribution is never part of what is cut. */
const reviewOffer = (review: { author: string }, quote: string) => `“${quote}”${review.author ? ` – ${review.author}` : ""}`;

/**
 * An SMS holds 160 characters: the quote is shortened until the whole line with its closing quote mark and
 * author fits next to the link. Other goals and channels use the plain offer.
 */
function smsOffer(state: DemoState, draft: Draft, link: string, voice: OwnerVoice, signOff?: string): string {
  const offer = draftOffer(state, draft);
  const review = draft.goal === "review" ? newestReview(state) : null;
  if (!review) return offer;
  const sentence = firstSentence(review.text);
  for (let length = sentence.length; length > 1; length--) {
    const candidate = reviewOffer(review, length < sentence.length ? `${sentence.slice(0, length - 1).trimEnd()}…` : sentence);
    if (rulesCopy("sms", candidate, link, state.localization.language, voice, signOff).startsWith(candidate)) return candidate;
  }
  return reviewOffer(review, `${sentence.slice(0, 1)}…`);
}

/** What the texts were written for: language, offer, link, the chosen treatments and the sign-off. */
export function offerSignature(state: DemoState, draft: Draft): string {
  return [state.localization.language, draftOffer(state, draft), draftLink(state, draft), draft.serviceIds.join(","), cleanSignOff(draft.signOff) ?? ""].join("|");
}

/** Whether a free-times campaign would go out after the day its texts advertise. */
export function advertisedTimesPassed(state: DemoState, draft: Draft, publishOn: DateKey): boolean {
  const free = draft.goal === "fill" ? freeTimes(state, draft.serviceIds[0], draft) : null;
  return !!free && publishOn > free.date;
}

/**
 * The texts for the current offer: written again by the rules for every channel the owner has not edited by hand.
 * `regenerated` are those channels, `stale` the edited ones, which keep their text and should be checked.
 */
export function refreshCopy(state: DemoState, draft: Draft, voice: OwnerVoice) {
  const stale = (draft.copyEdited ?? []).filter((channel) => draft.copy[channel] !== undefined);
  const regenerated = CHANNELS.filter((channel) => !stale.includes(channel));
  const offer = draftOffer(state, draft);
  const link = draftLink(state, draft);
  const signOff = cleanSignOff(draft.signOff);
  const copy: Draft["copy"] = {};
  for (const channel of CHANNELS) {
    copy[channel] = stale.includes(channel) ? draft.copy[channel] : rulesCopy(channel, channel === "sms" ? smsOffer(state, draft, link, voice, signOff) : offer, link, state.localization.language, voice, signOff);
  }
  return { copy, copyFor: offerSignature(state, draft), regenerated, stale };
}

/** The patch for a hand edit: the owner's text, the channel marked as edited, and no longer waiting to be checked. */
export function editCopy(draft: Draft, channel: Channel, text: string): Pick<Draft, "copy" | "copyEdited" | "copyStale"> {
  return {
    copy: { ...draft.copy, [channel]: text },
    copyEdited: [...new Set([...(draft.copyEdited ?? []), channel])],
    copyStale: (draft.copyStale ?? []).filter((c) => c !== channel),
  };
}

/** Whether a late AI text may replace a channel's text: same offer, not edited by hand, still the text it was started from. */
export const canApplyAiText = (draft: Draft, channel: Channel, signature: string, written: string | undefined) =>
  draft.copyFor === signature && !(draft.copyEdited ?? []).includes(channel) && draft.copy[channel] === written;

/** The texts of the channels the campaign goes to; drafts for channels the owner switched off stay in the editor. */
export function selectedCopy(draft: Pick<Draft, "channels" | "copy">): Draft["copy"] {
  return Object.fromEntries(draft.channels.flatMap((channel) => (draft.copy[channel] === undefined ? [] : [[channel, draft.copy[channel]]])));
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

/**
 * The first day in the offer period (and within a week of its start, never before today) that still has free
 * times for the treatment, with up to four of them spread over the day.
 */
function freeTimes(state: DemoState, serviceId: string | undefined, period?: { from: DateKey; to: DateKey }) {
  if (!serviceId) return null;
  const clock = salonClock();
  const start = period && period.from > clock.today ? period.from : clock.today;
  for (let i = 0; i < SLOT_DAYS; i++) {
    const date = addDays(start, i);
    if (period && date > period.to) break;
    const slots = openSlots(state, serviceId, date, clock);
    if (!slots.length) continue;
    const step = Math.max(1, Math.floor(slots.length / MAX_SLOTS));
    const picked = slots.filter((_, index) => index % step === 0).slice(0, MAX_SLOTS);
    return { date, today: clock.today, count: slots.length, times: picked.map((slot) => formatTime(slot.start)) };
  }
  return null;
}

/**
 * The times on a published Free-times poster that can no longer be booked on the day it advertises (booked,
 * blocked or past). Posters saved before the day was kept cannot be checked and give an empty list.
 */
export function unavailablePosterTimes(state: DemoState, poster: Pick<CampaignPoster, "style" | "items" | "slotDate">, serviceId: string | undefined): string[] {
  if (poster.style !== "slots" || !serviceId || !poster.slotDate) return [];
  const open = new Set(openSlots(state, serviceId, poster.slotDate, salonClock()).map((slot) => formatTime(slot.start)));
  return (poster.items ?? []).map((item) => item.name).filter((time) => !open.has(time));
}

/** The newest published review with the customer's public name, or null when the salon has none. */
export function newestReview(state: DemoState) {
  const [review] = recentReviews(state.reviews, 1);
  if (!review) return null;
  const customer = state.customers.find((c) => c.id === review.customerId);
  return { text: review.text, rating: review.rating, author: customer ? publicName(customer.firstName, customer.lastName) : "" };
}

/** What the season, review and free-times posters show, from the holiday, the published reviews and the calendar. */
function storyFields(state: DemoState, draft: Draft): Pick<CampaignPoster, "cta" | "quote" | "author" | "stars" | "sticker" | "items" | "slotDate"> {
  if (draft.style === "review") {
    const review = newestReview(state);
    return review ? { quote: review.text, author: review.author, stars: review.rating } : {};
  }
  if (draft.style === "slots") {
    const free = freeTimes(state, draft.serviceIds[0], draft);
    return free ? { slotDate: free.date, sticker: [dayChipLabel(free.date, free.today), formatDayMonth(free.date)], items: free.times.map((name) => ({ name, price: "" })), cta: translate(state.localization.language, "campaigns.engine.book") } : { cta: translate(state.localization.language, "campaigns.engine.book") };
  }
  return { cta: translate(state.localization.language, "campaigns.engine.book") };
}

/** Price, sticker and price list for the engine styles, from the treatments the campaign is about. */
function engineFields(state: DemoState, draft: Draft): Pick<CampaignPoster, "price" | "sticker" | "items" | "cta" | "quote" | "author" | "stars" | "slotDate" | "lead" | "backdrop"> {
  if (draft.style === "season" || draft.style === "review" || draft.style === "slots") return storyFields(state, draft);
  if (draft.style === "beforeafter" || draft.style === "fullphoto" || draft.style === "typography") return { cta: translate(state.localization.language, "campaigns.engine.book") };
  if (draft.style === "portrait") return { cta: translate(state.localization.language, "campaigns.engine.book"), lead: draft.posterEdits.lead ?? translate(state.localization.language, "campaigns.engine.portraitLead"), backdrop: draft.posterEdits.backdrop ?? "bloom" };
  const chosen = state.services.filter((s) => draft.serviceIds.includes(s.id) && !s.hidden);
  const listed = (chosen.length > 1 ? chosen : state.services.filter((s) => !s.hidden)).slice(0, MAX_LIST);
  const off = (price: number) => Math.round(price * (1 - draft.discountPercent / 100));
  const first = chosen[0];
  return {
    ...(first && { price: formatMoney(off(first.price)) }),
    ...(draft.discountPercent > 0 && { sticker: [translate(state.localization.language, "campaigns.engine.offer"), `–${draft.discountPercent}%`] as [string, string] }),
    items: listed.map((s) => ({ name: s.name, price: formatMoney(chosen.includes(s) ? off(s.price) : s.price) })),
  };
}

/** Styles about one treatment: its name is the headline and the first sentence of its description the detail. */
const NAMED_AFTER_TREATMENT = new Set<PosterStyle>(["price", "beforeafter", "portrait", "fullphoto", "typography"]);

/** The campaign's first treatment as the business's customers read it (its language, not the studio's). */
function firstTreatment(state: DemoState, draft: Draft) {
  const service = state.services.find((s) => s.id === draft.serviceIds[0]);
  return service && serviceCopy(service, state.localization.language);
}

function defaultHeadline(state: DemoState, draft: Draft): string {
  if (NAMED_AFTER_TREATMENT.has(draft.style)) return firstTreatment(state, draft)?.name ?? draft.name;
  if (draft.style === "season") return state.holidays.find((h) => h.id === draft.holidayId)?.name ?? draft.name;
  if (draft.style === "slots") {
    const free = freeTimes(state, draft.serviceIds[0], draft);
    return free ? tc("campaigns.engine.slotsLeft", free.count) : draft.name;
  }
  if (draft.style === "pricelist") return draft.name;
  return draft.discountPercent > 0 ? t("campaigns.posterOffer", { percent: draft.discountPercent }) : draft.name;
}

const SHORT_DETAIL = 70;
/**
 * The first sentence of a description, at most 70 characters (cut at a word), for the poster.
 * One message per poster: the whole description belongs in the post's text, not on the image.
 */
export function firstSentence(text: string): string {
  const sentence = text.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  if (sentence.length <= SHORT_DETAIL) return sentence;
  // One character is kept for the ellipsis; without a word boundary the text is cut mid-word.
  const head = sentence.slice(0, SHORT_DETAIL);
  const space = head.lastIndexOf(" ");
  return `${(space > SHORT_DETAIL / 2 ? head.slice(0, space) : head.slice(0, SHORT_DETAIL - 1)).replace(/[,;:–-]$/, "").trim()}…`;
}

/** The first free day and its times as one short line: what a "fill free times" poster says instead of the treatment. */
function freeTimesLine(state: DemoState, draft: Draft): string | null {
  const free = freeTimes(state, draft.serviceIds[0], draft);
  return free && [formatDayShort(free.date, state.localization.language), ...free.times].join(" · ");
}

function defaultDetail(state: DemoState, draft: Draft): string {
  const first = firstTreatment(state, draft);
  if (draft.goal === "fill" && (draft.style === "fullphoto" || draft.style === "typography")) {
    const line = freeTimesLine(state, draft);
    if (line) return line;
  }
  if (NAMED_AFTER_TREATMENT.has(draft.style) && first?.description) return firstSentence(first.description);
  if (draft.style === "slots" && first) return `${first.name} · ${formatDuration(first.duration)}`;
  return listServices(serviceNames(state, draft));
}

/** The poster as shown: the owner's edits on top of what follows from the offer. */
export function resolvePoster(state: DemoState, draft: Draft): CampaignPoster {
  const first = state.services.find((s) => s.id === draft.serviceIds[0]);
  // The Portrait poster starts from a staff photo; the others from a photo of the room.
  const staffPhoto = state.staff.find((member) => member.photo)?.photo;
  const image = draft.posterEdits.image
    ?? (draft.style === "portrait" && staffPhoto ? staffPhoto : first?.category === "massage" ? "/demo/massage.webp" : "/demo/salon.webp");
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
    ...(draft.posterEdits.arrangement && { arrangement: draft.posterEdits.arrangement }),
    ...(draft.posterEdits.badges?.length && { badges: draft.posterEdits.badges }),
    ...(draft.posterEdits.socialQr && { socialQr: true }),
    ...(draft.posterEdits.photoTone && !isNeutralTone(draft.posterEdits.photoTone) && { photoTone: draft.posterEdits.photoTone }),
  };
}
