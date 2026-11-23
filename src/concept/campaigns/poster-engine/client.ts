import type { CampaignPoster, PosterFormat, PosterTone, Salon } from "../../data/types";
import { bookingHome } from "../../booking/links";
import type { Locale } from "@/lib/locale";
import { getActiveLocale, translate } from "../../i18n";
import { FONT_PAIRS, type PageTheme } from "../../page/theme";
import { libraryIdOf, posterPhotoRef } from "../../../lib/media/limits";
import { onSessionChange, sessionGeneration } from "../../media/library-client";
import { usesPhoto } from "../poster-layout";
import { applyLightContrast, applyWarmth, clampTone, isNeutralTone, toneFilter, toneKey } from "./tone";

// The browser side of the poster engine: gathers what a template needs, turns
// photos into JPEG or, for cut-outs, PNG (the renderer cannot read WebP), and asks the server for
// the SVG. Identical requests are answered from memory.

const TEMPLATE_COLORS = { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" };
const PHOTO_SIDE = 1400;
const MAX_PHOTOS = 12;

export interface EngineContext {
  salon: Pick<Salon, "name" | "phone" | "slug">;
  link?: string;
  /** The business's language: the words on the poster are for its customers, not the studio's language. */
  language?: Locale;
  theme?: PageTheme;
  rating?: { average: number; count: number };
}

// Both caches can hold a signed-in owner's own photos, so they belong to one session (library-client.ts):
// their keys carry the session generation and a new session empties them.
const photos = new Map<string, Promise<PosterPhoto>>();
const svgs = new Map<string, Promise<string>>();
onSessionChange(() => { photos.clear(); svgs.clear(); });

/** Thrown for a result that arrived for a session that has ended since it was asked for. */
class StaleSession extends Error {}
const current = <T>(generation: number, value: T): T => {
  if (generation !== sessionGeneration()) throw new StaleSession();
  return value;
};
const CUTOUT_SIDE = 1100;
/** Below the server's 2.8 MB limit for one photo. */
const MAX_DATA_URL = 2_700_000;

export interface PosterPhoto {
  src: string;
  /** True when the photo has transparent parts: a cut-out person, kept as PNG. */
  cutout: boolean;
}

/** True when some pixel is noticeably transparent (sampled, so large photos stay fast). */
export function hasTransparency(pixels: Uint8ClampedArray, step = 97): boolean {
  for (let i = 3; i < pixels.length; i += 4 * step) if (pixels[i] < 250) return true;
  return false;
}

let filterSupport: boolean | undefined;
/** Whether this browser applies canvas filters: some Safari versions accept `filter` and silently ignore it. */
function canvasFilters(): boolean {
  if (filterSupport === undefined) {
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!probe) return (filterSupport = false);
    probe.fillStyle = "#808080";
    probe.filter = "brightness(0%)";
    probe.fillRect(0, 0, 1, 1);
    filterSupport = probe.getImageData(0, 0, 1, 1).data[0] < 10;
  }
  return filterSupport;
}

/** The photo at most `side` px, with the owner's light and contrast (canvas filter, or pixels as a fallback) and warmth (pixels) applied. */
function draw(bitmap: ImageBitmap, side: number, tone?: PosterTone) {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const native = canvasFilters();
  if (native) context.filter = toneFilter(tone);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (tone && !isNeutralTone(tone)) {
    const { light, contrast, warmth } = clampTone(tone);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    if (!native) applyLightContrast(image.data, light, contrast);
    applyWarmth(image.data, warmth);
    context.putImageData(image, 0, 0);
  }
  return canvas;
}

/**
 * A photo (demo file, upload or object URL) for the renderer, which cannot read WebP: a JPEG of at most
 * 1400 px, or a PNG when the photo is a cut-out, scaled down until it fits the server's limit. The owner's
 * tone is applied; the photo itself is untouched.
 */
export function posterPhoto(url: string, tone?: PosterTone): Promise<PosterPhoto> {
  const generation = sessionGeneration();
  const key = `${generation}|${toneKey(tone)}|${url}`;
  let cached = photos.get(key);
  if (!cached) {
    cached = (async () => {
      const bitmap = await createImageBitmap(current(generation, await (await fetch(url)).blob()));
      try {
        const probe = draw(bitmap, 400);
        const pixels = probe.getContext("2d")?.getImageData(0, 0, probe.width, probe.height).data;
        if (pixels && hasTransparency(pixels)) {
          for (let side = CUTOUT_SIDE; side >= 400; side = Math.round(side * 0.8)) {
            const src = draw(bitmap, side, tone).toDataURL("image/png");
            if (src.length <= MAX_DATA_URL) return { src, cutout: true };
          }
        }
        return { src: draw(bitmap, PHOTO_SIDE, tone).toDataURL("image/jpeg", 0.86), cutout: false };
      } finally {
        bitmap.close();
      }
    })();
    cached.catch(() => photos.delete(key));
    // Moving a slider makes a new photo per value: keep only the latest ones.
    if (photos.size >= MAX_PHOTOS) photos.delete(photos.keys().next().value!);
    photos.set(key, cached);
  }
  return cached;
}

const cut = (value: string, max: number) => value.trim().slice(0, max);
/** Shortened at a word boundary, so a label never ends mid-word. */
const cutWords = (value: string, max: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const head = trimmed.slice(0, max + 1);
  return head.slice(0, Math.max(head.lastIndexOf(" "), 1)).trim();
};
const LINK_CHARS = 32;
/** The booking link without its scheme, shortened to fit the signature. */
export const shortLink = (link: string) => {
  const bare = link.trim().replace(/^https?:\/\//, "");
  return bare.length > LINK_CHARS ? `${bare.slice(0, LINK_CHARS - 1)}…` : bare;
};
/** An https address with a host, at most 200 characters, for the QR code; undefined otherwise. */
export const qrLink = (link: string | undefined): string | undefined => {
  if (!link) return undefined;
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" && url.hostname && url.href.length <= 200 ? url.href : undefined;
  } catch {
    return undefined;
  }
};
/** Where the QR code leads: the campaign link when it is a real address, otherwise the salon's booking page on this site. */
export const qrTarget = (link: string | undefined, slug: string, origin: string | undefined) =>
  qrLink(link) ?? (origin ? qrLink(`${origin}${bookingHome(slug)}`) : undefined);
/**
 * A QR code is for paper: on the window poster always, in posts and stories only when the owner asks
 * for it (whoever sees a post is usually holding the phone that would have to scan it).
 */
export const qrFor = (format: PosterFormat, social: boolean, link: string | undefined, slug: string, origin: string | undefined) =>
  format === "window" || social ? qrTarget(link, slug, origin) : undefined;
const SERIF_FONTS = new Set<string>([FONT_PAIRS.classic.heading, FONT_PAIRS.elegant.heading]);

/**
 * A library photo the renderer may read itself (`media:<id>`): the owner's untouched photo, unless a tone is
 * applied or a portrait needs to know whether it is a cut-out, which only the browser works out.
 */
const libraryRef = (poster: CampaignPoster, url: string | undefined) => {
  const id = libraryIdOf(url);
  return id && isNeutralTone(poster.photoTone) && poster.style !== "portrait" ? posterPhotoRef(id) : undefined;
};

/** The request body for one poster. With `library`, a library photo is named rather than sent. */
export async function engineRequest(poster: CampaignPoster, format: PosterFormat, kicker: string, context: EngineContext, { library = false } = {}) {
  const language = context.language ?? getActiveLocale();
  const ref = library ? libraryRef(poster, poster.image) : undefined;
  const beforeRef = library ? libraryRef(poster, poster.before) : undefined;
  // Type only has no photo: nothing is fetched, decoded or sent.
  const photo = usesPhoto(poster.style) ? (ref ? { src: ref, cutout: false } : await posterPhoto(poster.image, poster.photoTone)) : undefined;
  const qr = qrFor(format, !!poster.socialQr, context.link, context.salon.slug, typeof window === "undefined" ? undefined : window.location.origin);
  const { rating } = context;
  return {
    template: poster.style,
    format,
    data: {
      // The campaign name above the headline, unless it only repeats it.
      label: kicker.trim() === poster.headline.trim() ? "" : cutWords(kicker, 24),
      headline: cut(poster.headline, 40),
      price: cut(poster.price ?? "", 16),
      detail: cut(poster.detail, 120),
      ...(poster.sticker && { sticker: [cut(poster.sticker[0], 14), cut(poster.sticker[1], 10)] }),
      items: (poster.items ?? []).slice(0, 8).map((item) => ({ name: cut(item.name, 40), price: cut(item.price, 16) })),
      cta: cut(poster.cta ?? "", 40),
      quote: cut(poster.quote ?? "", 220),
      author: cut(poster.author ?? "", 40),
      ...(poster.stars && { stars: poster.stars }),
      badges: (poster.badges ?? []).slice(0, 4).map((badge) => cut(badge, 20)),
      ...(photo && { photo: photo.src }),
      cutout: poster.style === "portrait" && !!photo?.cutout,
      ...(poster.style === "beforeafter" && poster.before && { before: beforeRef ?? (await posterPhoto(poster.before, poster.photoTone)).src }),
      ...(poster.style === "portrait" && { lead: cut(poster.lead ?? "", 30), backdrop: poster.backdrop ?? "bloom" }),
      pair: [cut(translate(language, "campaigns.engine.before"), 12), cut(translate(language, "campaigns.engine.after"), 12)],
      focus: poster.focus ?? "center",
      arrangement: poster.arrangement ?? "standard",
      textSize: poster.textSize ?? "normal",
      colors: context.theme?.colors
        ? { accent: context.theme.colors.accent, ink: context.theme.colors.text, background: context.theme.colors.background }
        : TEMPLATE_COLORS,
      serifHeadings: !!context.theme && SERIF_FONTS.has(FONT_PAIRS[context.theme.fonts].heading),
      signature: {
        salon: cut(context.salon.name, 60),
        phone: cut(context.salon.phone, 30),
        link: shortLink(context.link ?? ""),
        ...(qr && { qr }),
        ...(rating && rating.count > 0 && { rating: Math.min(5, Math.max(1, rating.average)), reviews: cut(translate(language, "campaigns.engine.reviews", { count: rating.count }), 30) }),
      },
    },
  };
}

/** The renderer could not draw a named library photo (a WebP, or one too large); the browser sends a copy instead. */
class LibraryPhotoUnsuitable extends Error {}

/** The poster's SVG from the server; the same request twice is fetched once. */
export function fetchPosterSvg(body: Awaited<ReturnType<typeof engineRequest>>): Promise<string> {
  const generation = sessionGeneration();
  const request = JSON.stringify(body);
  const key = `${generation}|${request}`;
  let cached = svgs.get(key);
  if (!cached) {
    cached = fetch("/api/concept/poster", { method: "POST", headers: { "content-type": "application/json" }, body: request })
      .then((response) => (response.ok ? response.text() : Promise.reject(response.status === 422 && request.includes('"media:') ? new LibraryPhotoUnsuitable() : new Error(`Poster ${response.status}`))))
      .then((svg) => current(generation, svg));
    cached.catch(() => svgs.delete(key));
    if (svgs.size > 40) svgs.delete(svgs.keys().next().value!);
    svgs.set(key, cached);
  }
  return cached;
}

/** The poster's SVG. A library photo is read by the renderer itself when it can draw it, and sent from here when it cannot. */
export async function posterSvg(poster: CampaignPoster, format: PosterFormat, kicker: string, context: EngineContext): Promise<string> {
  const generation = sessionGeneration();
  try {
    return current(generation, await fetchPosterSvg(await engineRequest(poster, format, kicker, context, { library: true })));
  } catch (error) {
    if (!(error instanceof LibraryPhotoUnsuitable)) throw error;
    return current(generation, await fetchPosterSvg(await engineRequest(poster, format, kicker, context)));
  }
}

let mounted = 0;

/**
 * The poster SVG with every id given a prefix unique to this mount, and the references to them rewritten.
 * Satori numbers its clip paths and gradients from 1 in every render, so two posters on one page (a story
 * and its feed preview, or the style thumbnails) would otherwise borrow each other's crops.
 */
export function uniqueIds(markup: string, prefix = `poster${++mounted}-`): string {
  const ids = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  if (!ids.size) return markup;
  return markup
    .replace(/(\sid=")([^"]+)"/g, (_, start: string, id: string) => `${start}${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (match, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : match))
    .replace(/(href=")#([^"]+)"/g, (match, start: string, id: string) => (ids.has(id) ? `${start}#${prefix}${id}"` : match));
}
