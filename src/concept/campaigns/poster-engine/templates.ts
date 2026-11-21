import { z } from "zod";
import { box, image, svgImage, text, type PosterNode } from "./element";

// Poster templates for the server renderer: designed layouts with fixed slots
// (headline, price, photo, sticker, price list, signature) that the owner fills
// and adjusts within limits, so every poster stays presentable.

export const ENGINE_TEMPLATES = ["price", "pricelist"] as const;
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

const LAYOUTS: Record<EngineTemplate, (data: PosterData, width: number, height: number) => PosterNode> = {
  price: priceTemplate,
  pricelist: priceListTemplate,
};

export function posterTree(template: EngineTemplate, data: PosterData, format: EngineFormat): PosterNode {
  const { width, height } = ENGINE_FORMATS[format];
  return LAYOUTS[template](data, width, height);
}
