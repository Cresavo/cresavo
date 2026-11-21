import { z } from "zod";
import { box, image, svgImage, text, type PosterNode } from "./element";

// Poster templates for the server renderer: designed layouts with fixed slots
// (headline, price, photo, sticker, price list, signature) that the owner fills
// and adjusts within limits, so every poster stays presentable.

export const ENGINE_TEMPLATES = ["price", "pricelist", "season", "review", "slots"] as const;
export type EngineTemplate = (typeof ENGINE_TEMPLATES)[number];

export const ENGINE_FORMATS = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 }, window: { width: 1050, height: 1485 } } as const;
export type EngineFormat = keyof typeof ENGINE_FORMATS;

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const line = (max: number) => z.string().trim().max(max);
/** Photos arrive as JPEG or PNG data URLs (Satori cannot read WebP); about 2 MB each at most. */
const photo = z.string().max(2_800_000).regex(/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/);

export const posterDataSchema = z.object({
  /** Small label above the headline, such as "Friskvård". */
  label: line(24).default(""),
  headline: line(40),
  price: line(16),
  detail: line(120),
  sticker: z.tuple([line(14), line(10)]).optional(),
  items: z.array(z.object({ name: line(40), price: line(16) }).strict()).max(8).default([]),
  badges: z.array(line(20)).max(4).default([]),
  /** A button-like line ("Book now →"), and a customer's words with who said them. */
  cta: line(40).default(""),
  quote: line(220).default(""),
  author: line(40).default(""),
  photo,
  focus: z.enum(["top", "center", "bottom"]).default("center"),
  textSize: z.enum(["small", "normal", "large"]).default("normal"),
  colors: z.object({ accent: colour, ink: colour, background: colour }).strict(),
  serifHeadings: z.boolean().default(false),
  signature: z.object({
    salon: line(60),
    phone: line(30),
    link: line(80),
    rating: z.number().min(1).max(5).optional(),
    /** Shown after the stars, e.g. "48 omdömen"; worded by the caller in the salon's language. */
    reviews: line(30).optional(),
  }).strict(),
}).strict();

export type PosterData = z.infer<typeof posterDataSchema>;

const SCALE = { small: 0.85, normal: 1, large: 1.15 } as const;
const CROP = { top: "50% 10%", center: "50% 50%", bottom: "50% 90%" } as const;
const HIGHLIGHT = "#ffd84d";
const WHITE = "#ffffff";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Black or white, whichever reads better on `background`. */
const onColour = (background: string) => (luminance(background) > 0.4 ? "#111111" : WHITE);

const stars = (count: number, size: number) =>
  svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${count * size}" height="${size}" viewBox="0 0 ${count * 24} 24">${Array.from({ length: count }, (_, i) =>
    `<path transform="translate(${i * 24} 0)" fill="#f5b400" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>`).join("")}</svg>`, { width: count * size, height: size });

/** Phone, rating, booking link and the salon's name: the same strip on every poster, so posts are recognisable. */
function signature(data: PosterData, width: number, colourOn: string): PosterNode {
  const { salon, phone, rating, reviews, link } = data.signature;
  const details = box({ flexDirection: "column", fontSize: 30, color: colourOn, maxWidth: width - 128 - 340 },
    text({ fontSize: 44, fontWeight: 800 }, phone),
    ...(rating ? [box({ alignItems: "center", marginTop: 4 }, stars(Math.round(rating), 30), text({ marginLeft: 12 }, `${rating.toFixed(1)}${reviews ? ` · ${reviews}` : ""}`))] : []),
    text({ display: "block", opacity: 0.85, marginTop: 4, maxWidth: width - 128 - 340, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, link));
  return box({ position: "absolute", left: 64, bottom: 56, width: width - 128, alignItems: "flex-end", justifyContent: "space-between" },
    details,
    text({ fontFamily: "Caladea", fontSize: 46, lineHeight: 1, color: colourOn, maxWidth: 320, textAlign: "right" }, salon));
}

function headingFont(data: PosterData) {
  return data.serifHeadings ? { fontFamily: "Caladea", fontWeight: 400, letterSpacing: -1 } : { fontFamily: "Inter Display", fontWeight: 900, letterSpacing: -4 };
}

/** One treatment and its price, large, beside the owner's photo. */
function priceTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const onAccent = onColour(accent);
  const waveTop = Math.round(height * 0.28);
  const photoWidth = Math.round(width * 0.52);
  // Heavy digits are about 0.6 em wide; the price may reach a little over the photo, never across it.
  const priceTop = waveTop + (data.sticker ? 250 : 130);
  const priceSize = Math.min(Math.round(220 * scale), Math.floor((width - photoWidth + 60) / (Math.max(3, data.price.length) * 0.6)));
  const wave = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height - waveTop}" viewBox="0 0 ${width} ${height - waveTop}" preserveAspectRatio="none"><path d="M0 60 C ${width * 0.24} -10, ${width * 0.48} 140, ${width} 40 V${height - waveTop} H0Z" fill="${accent}"/></svg>`;
  return box({ width, height, position: "relative", background, fontFamily: "Inter" },
    svgImage(wave, { position: "absolute", left: 0, top: waveTop, width, height: height - waveTop }),
    image(data.photo, { position: "absolute", right: -40, top: Math.round(height * 0.09), width: photoWidth, height: Math.round(height * 0.91), objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px ${photoWidth / 2}px 0 0` }),
    text({ position: "absolute", left: 64, top: 90, width: width - photoWidth - 40, ...headingFont(data), fontSize: Math.round(112 * scale), lineHeight: 0.95, color: onColour(background) === WHITE ? WHITE : ink }, data.headline),
    text({ position: "absolute", left: 56, top: priceTop, fontFamily: "Inter Display", fontWeight: 900, fontSize: priceSize, letterSpacing: -6, color: onAccent, textShadow: `12px 12px 0 ${onAccent === WHITE ? ink : WHITE}` }, data.price),
    ...(data.sticker ? [box({ position: "absolute", left: width - photoWidth - 150, top: waveTop + 20, width: 210, height: 210, borderRadius: 999, background: HIGHLIGHT, color: "#111111", transform: "rotate(-12deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      text({ fontSize: 32 }, data.sticker[0]), text({ fontSize: 52 }, data.sticker[1]))] : []),
    text({ position: "absolute", left: 64, top: priceTop + priceSize + 70, width: width - photoWidth - 40, fontSize: Math.round(40 * scale), fontWeight: 600, lineHeight: 1.25, color: onAccent, lineClamp: 4 }, data.detail),
    signature(data, width, onAccent));
}

/** Several treatments with prices on a card, with the payment badges the salon accepts. */
function priceListTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const cardWidth = Math.round(width * 0.74);
  const footer = 250;
  const rows = data.items.map((item) => box({ alignItems: "flex-end", paddingTop: 12, paddingBottom: 12, fontSize: Math.round(38 * scale) },
    text({ maxWidth: cardWidth - 260 }, item.name),
    box({ flexGrow: 1, borderBottom: `3px dotted ${accent}`, marginLeft: 14, marginRight: 14, marginBottom: 10 }),
    text({ fontWeight: 800 }, item.price)));
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: ink },
    image(data.photo, { position: "absolute", right: 0, top: 0, width: Math.round(width * 0.4), height: height - footer, objectFit: "cover", objectPosition: CROP[data.focus] }),
    box({ position: "absolute", left: 56, top: 100, width: cardWidth, flexDirection: "column", background: WHITE, borderRadius: 40, padding: 56, boxShadow: "0 30px 60px rgba(0,0,0,0.15)" },
      ...(data.label ? [box({}, text({ background: accent, color: onColour(accent), fontWeight: 800, fontSize: 28, letterSpacing: 5, padding: "8px 20px", borderRadius: 12 }, data.label.toUpperCase()))] : []),
      text({ ...headingFont(data), fontSize: Math.round(88 * scale), lineHeight: 0.98, marginTop: 22, marginBottom: 18, color: ink }, data.headline),
      ...rows,
      ...(data.badges.length ? [box({ marginTop: 24, flexWrap: "wrap" }, ...data.badges.map((badge) => text({ border: `3px solid ${ink}`, borderRadius: 999, padding: "6px 20px", marginRight: 12, fontSize: 26, fontWeight: 800 }, badge)))] : [])),
    box({ position: "absolute", left: 0, bottom: 0, width, height: footer, background: ink }),
    signature(data, width, onColour(ink)));
}

const mixColour = (a: string, b: string, amount: number) => {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount).toString(16).padStart(2, "0")).join("")}`;
};

const button = (label: string, background: string, colour: string): PosterNode =>
  text({ background, color: colour, fontWeight: 800, fontSize: 40, padding: "20px 36px", borderRadius: 999 }, label);

/** A season or holiday greeting on the accent colour, the photo in an arch with a bright edge. */
function seasonTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent } = data.colors;
  const scale = SCALE[data.textSize];
  const onAccent = onColour(accent);
  const deep = mixColour(accent, "#000000", 0.45);
  const photoWidth = Math.round(width * 0.52);
  const photoTop = Math.round(height * 0.36);
  const dots = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${[[0.11, 0.1, 6], [0.28, 0.06, 4], [0.83, 0.15, 8], [0.9, 0.38, 5], [0.06, 0.45, 7], [0.72, 0.07, 3], [0.48, 0.13, 5], [0.19, 0.31, 3]]
    .map(([x, y, radius]) => `<circle cx="${x * width}" cy="${y * height}" r="${radius}" fill="#ffffff" opacity="0.5"/>`).join("")}</svg>`;
  return box({ width, height, position: "relative", fontFamily: "Inter", backgroundImage: `radial-gradient(circle at 70% 25%, ${accent}, ${deep})` },
    svgImage(dots, { position: "absolute", left: 0, top: 0, width, height }),
    // The photo stops above the signature, which keeps the whole width.
    image(data.photo, { position: "absolute", right: 0, top: photoTop, width: photoWidth, height: height - photoTop - 260, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px 0 0 ${photoWidth / 8}px`, boxShadow: `-24px 0 0 ${HIGHLIGHT}` }),
    // A short greeting is set large; a campaign name gets two smaller lines so it never reaches the text below.
    text({ position: "absolute", left: 64, top: 100, width: width - 128, fontFamily: "Caladea", fontSize: Math.round((data.headline.length > 14 ? 96 : 150) * scale), lineHeight: 0.95, color: onAccent, lineClamp: 2 }, data.headline),
    text({ position: "absolute", left: 68, top: photoTop + 20, width: width - photoWidth - 110, fontSize: Math.round(42 * scale), fontWeight: 600, lineHeight: 1.25, color: onAccent, lineClamp: 5 }, data.detail),
    ...(data.cta ? [box({ position: "absolute", left: 64, top: photoTop + 360 }, button(data.cta, WHITE, deep))] : []),
    signature(data, width, onAccent));
}

/** A customer's own words, large, with the stars and their name. */
function reviewTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink } = data.colors;
  const scale = SCALE[data.textSize];
  const onInk = onColour(ink);
  const rating = data.signature.rating ?? 5;
  return box({ width, height, position: "relative", background: ink, fontFamily: "Inter" },
    image(data.photo, { position: "absolute", left: 64, top: 90, width: 280, height: 280, borderRadius: 999, border: `10px solid ${accent}`, objectFit: "cover", objectPosition: CROP[data.focus] }),
    text({ position: "absolute", left: 390, top: 40, fontFamily: "Caladea", fontSize: 400, lineHeight: 1, color: accent }, "“"),
    // The quote and its stars flow as one column, so a short quote never leaves a gap.
    box({ position: "absolute", left: 64, top: Math.round(height * 0.33), width: width - 128, flexDirection: "column", color: onInk },
      text({ fontFamily: "Caladea", fontSize: Math.round(72 * scale), lineHeight: 1.15, lineClamp: 6 }, data.quote || data.headline),
      box({ marginTop: 48 }, stars(Math.round(rating), 44)),
      text({ fontSize: 34, marginTop: 12, opacity: 0.9 }, data.author)),
    signature(data, width, onInk));
}

/** The free times left on one day, with the day on a sticker and a call to book. */
function slotsTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const tall = height > width * 1.5;
  const photoTop = Math.round(height * (tall ? 0.27 : 0.3));
  const photoHeight = Math.round(height * (tall ? 0.4 : 0.32));
  const onBackground = onColour(background) === WHITE ? WHITE : ink;
  const listTop = photoTop + photoHeight + 50;
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: onBackground },
    text({ position: "absolute", left: 60, top: tall ? 180 : 80, width: width - 380, fontFamily: "Inter Display", fontWeight: 900, fontSize: Math.round(150 * scale), lineHeight: 0.92, letterSpacing: -5 }, data.headline),
    ...(data.sticker ? [box({ position: "absolute", right: 70, top: tall ? 200 : 90, width: 240, height: 240, borderRadius: 999, background: accent, color: onColour(accent), transform: "rotate(10deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      text({ fontSize: 38 }, data.sticker[0]), text({ fontSize: 64 }, data.sticker[1]))] : []),
    image(data.photo, { position: "absolute", left: 0, top: photoTop, width, height: photoHeight, objectFit: "cover", objectPosition: CROP[data.focus] }),
    text({ position: "absolute", left: 60, top: listTop, width: width - 120, fontSize: Math.round(54 * scale), fontWeight: 800 }, data.items.map((item) => item.name).join("  ·  ")),
    text({ position: "absolute", left: 60, top: listTop + Math.round(80 * scale), width: width - 120, fontSize: Math.round(40 * scale), fontWeight: 600, opacity: 0.85 }, data.detail),
    ...(tall
      ? [box({ position: "absolute", left: 60, bottom: 100, width: width - 120, justifyContent: "center", background: ink, color: onColour(ink), fontWeight: 800, fontSize: 48, padding: 30, borderRadius: 999 }, text({}, data.cta || data.signature.link))]
      : [box({ position: "absolute", left: 0, bottom: 0, width, height: 250, background: ink }), signature(data, width, onColour(ink))]));
}

const LAYOUTS: Record<EngineTemplate, (data: PosterData, width: number, height: number) => PosterNode> = {
  price: priceTemplate,
  pricelist: priceListTemplate,
  season: seasonTemplate,
  review: reviewTemplate,
  slots: slotsTemplate,
};

export function posterTree(template: EngineTemplate, data: PosterData, format: EngineFormat): PosterNode {
  const { width, height } = ENGINE_FORMATS[format];
  return LAYOUTS[template](data, width, height);
}
