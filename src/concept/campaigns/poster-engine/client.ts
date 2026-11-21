import type { CampaignPoster, PosterFormat, Salon } from "../../data/types";
import { getActiveLocale, translate } from "../../i18n";
import { FONT_PAIRS, type PageTheme } from "../../page/theme";

// The browser side of the poster engine: gathers what a template needs, turns
// photos into JPEG (the renderer cannot read WebP), and asks the server for
// the SVG. Identical requests are answered from memory.

const TEMPLATE_COLORS = { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" };
const PHOTO_SIDE = 1400;

export interface EngineContext {
  salon: Pick<Salon, "name" | "phone">;
  link?: string;
  theme?: PageTheme;
  rating?: { average: number; count: number };
}

const photos = new Map<string, Promise<string>>();

/** A photo (demo file, upload or object URL) as a JPEG data URL of at most 1400 px. */
export function jpegPhoto(url: string): Promise<string> {
  let cached = photos.get(url);
  if (!cached) {
    cached = (async () => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", 0.86);
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
const SERIF_FONTS = new Set<string>([FONT_PAIRS.classic.heading, FONT_PAIRS.elegant.heading]);

/** The request body for one poster. */
export async function engineRequest(poster: CampaignPoster, format: PosterFormat, kicker: string, context: EngineContext) {
  const language = getActiveLocale();
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
      photo: await jpegPhoto(poster.image),
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
