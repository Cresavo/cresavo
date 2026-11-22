import type { CampaignPoster, PosterFormat, Salon } from "../../data/types";
import { bookingHome } from "../../booking/links";
import type { Locale } from "@/lib/locale";
import { getActiveLocale, translate } from "../../i18n";
import { FONT_PAIRS, type PageTheme } from "../../page/theme";

// The browser side of the poster engine: gathers what a template needs, turns
// photos into JPEG or, for cut-outs, PNG (the renderer cannot read WebP), and asks the server for
// the SVG. Identical requests are answered from memory.

const TEMPLATE_COLORS = { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" };
const PHOTO_SIDE = 1400;

export interface EngineContext {
  salon: Pick<Salon, "name" | "phone" | "slug">;
  link?: string;
  /** The business's language: the words on the poster are for its customers, not the studio's language. */
  language?: Locale;
  theme?: PageTheme;
  rating?: { average: number; count: number };
}

const photos = new Map<string, Promise<PosterPhoto>>();
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

function draw(bitmap: ImageBitmap, side: number) {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * A photo (demo file, upload or object URL) for the renderer, which cannot read WebP: a JPEG of at most
 * 1400 px, or a PNG when the photo is a cut-out, scaled down until it fits the server's limit.
 */
export function posterPhoto(url: string): Promise<PosterPhoto> {
  let cached = photos.get(url);
  if (!cached) {
    cached = (async () => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      try {
        const probe = draw(bitmap, 400);
        const pixels = probe.getContext("2d")?.getImageData(0, 0, probe.width, probe.height).data;
        if (pixels && hasTransparency(pixels)) {
          for (let side = CUTOUT_SIDE; side >= 400; side = Math.round(side * 0.8)) {
            const src = draw(bitmap, side).toDataURL("image/png");
            if (src.length <= MAX_DATA_URL) return { src, cutout: true };
          }
        }
        return { src: draw(bitmap, PHOTO_SIDE).toDataURL("image/jpeg", 0.86), cutout: false };
      } finally {
        bitmap.close();
      }
    })();
    cached.catch(() => photos.delete(url));
    photos.set(url, cached);
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

/** The request body for one poster. */
export async function engineRequest(poster: CampaignPoster, format: PosterFormat, kicker: string, context: EngineContext) {
  const language = context.language ?? getActiveLocale();
  const photo = await posterPhoto(poster.image);
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
      photo: photo.src,
      cutout: poster.style === "portrait" && photo.cutout,
      ...(poster.style === "beforeafter" && poster.before && { before: (await posterPhoto(poster.before)).src }),
      ...(poster.style === "portrait" && { lead: cut(poster.lead ?? "", 30), backdrop: poster.backdrop ?? "bloom" }),
      pair: [cut(translate(language, "campaigns.engine.before"), 12), cut(translate(language, "campaigns.engine.after"), 12)],
      focus: poster.focus ?? "center",
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

const svgs = new Map<string, Promise<string>>();

/** The poster's SVG from the server; the same request twice is fetched once. */
export function fetchPosterSvg(body: Awaited<ReturnType<typeof engineRequest>>): Promise<string> {
  const key = JSON.stringify(body);
  let cached = svgs.get(key);
  if (!cached) {
    cached = fetch("/api/concept/poster", { method: "POST", headers: { "content-type": "application/json" }, body: key })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`Poster ${response.status}`))));
    cached.catch(() => svgs.delete(key));
    if (svgs.size > 40) svgs.delete(svgs.keys().next().value!);
    svgs.set(key, cached);
  }
  return cached;
}
