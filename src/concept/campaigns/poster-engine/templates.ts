import { encode } from "uqr";
import { z } from "zod";
import { contrast, readable } from "../../page/colour";
import { BACKDROPS, backdropSvg } from "./backdrops";
import { box, image, svgImage, text, type PosterNode, type Style } from "./element";

// Poster templates for the server renderer: designed layouts with fixed slots
// (headline, price, photo, sticker, price list, signature) that the owner fills
// and adjusts within limits, so every poster stays presentable.

export const ENGINE_TEMPLATES = ["price", "pricelist", "season", "review", "slots", "beforeafter", "portrait", "fullphoto", "typography"] as const;
export type EngineTemplate = (typeof ENGINE_TEMPLATES)[number];

export const ENGINE_FORMATS = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 }, window: { width: 1050, height: 1485 } } as const;
export type EngineFormat = keyof typeof ENGINE_FORMATS;

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const line = (max: number) => z.string().trim().max(max);
/** Photos arrive as JPEG or PNG data URLs (Satori cannot read WebP); about 2 MB each at most. */
const photo = z.string().max(2_800_000).regex(/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/);

const hasHost = (value: string) => {
  try {
    return new URL(value).hostname.length > 0;
  } catch {
    return false;
  }
};

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
  /** The quoted review's own rating; the review poster never shows the salon's average beside a single quote. */
  stars: z.number().int().min(1).max(5).optional(),
  /** Every template but Type only draws it; the route refuses a request without one (`usesPhoto`). */
  photo: photo.optional(),
  /** Before/after: the "before" photo, and the two words on the photos in the salon's language. */
  before: photo.optional(),
  pair: z.tuple([line(12), line(12)]).default(["Before", "After"]),
  /** Portrait: the smaller line above the headline, the drawn background, and whether the photo is a cut-out (transparent PNG). */
  lead: line(30).default(""),
  backdrop: z.enum(BACKDROPS).default("bloom"),
  cutout: z.boolean().default(false),
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
    /** The full booking address, drawn as a QR code beside the salon's name. */
    qr: z.string().trim().max(200).regex(/^https:\/\/[^\s<>"]+$/).refine(hasHost).optional(),
  }).strict(),
}).strict();

export type PosterData = z.infer<typeof posterDataSchema>;

/** The photo of a template that draws one. */
function photoOf(data: PosterData): string {
  if (!data.photo) throw new Error("This poster needs a photo");
  return data.photo;
}

/** A story's top and bottom, which Instagram covers with its own bars: no text there. */
export const STORY_SAFE = { top: 270, bottom: 390 } as const;
const isStory = (width: number, height: number) => height > width * 1.5;

const SCALE = { small: 0.85, normal: 1, large: 1.15 } as const;
const CROP = { top: "50% 10%", center: "50% 50%", bottom: "50% 90%" } as const;
const HIGHLIGHT = "#ffd84d";
const WHITE = "#ffffff";
const INK = "#111111";

/** Near-black or white, whichever reads better on `background`. */
const onColour = (background: string) => (contrast(WHITE, background) >= contrast(INK, background) ? WHITE : INK);

const stars = (count: number, size: number) =>
  svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${count * size}" height="${size}" viewBox="0 0 ${count * 24} 24">${Array.from({ length: count }, (_, i) =>
    `<path transform="translate(${i * 24} 0)" fill="#f5b400" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>`).join("")}</svg>`, { width: count * size, height: size });

/** A QR code on a white tile, drawn as one SVG path (each run of dark modules in a row is one rectangle). */
function qrCode(url: string, size: number): PosterNode {
  const { data } = encode(url, { ecc: "M", border: 4 });
  const modules = data.length;
  let path = "";
  data.forEach((row, y) => {
    for (let x = 0; x < modules; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < modules && row[end + 1]) end++;
      path += `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`;
      x = end;
    }
  });
  return svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges"><rect width="${modules}" height="${modules}" fill="#ffffff"/><path d="${path}" fill="#111111"/></svg>`,
    { width: size, height: size, borderRadius: 16 });
}

const QR_SIZE = 168;

/** Phone, rating, booking link, the salon's name and a QR code to the booking page: the same strip on every poster, so posts are recognisable. */
function signature(data: PosterData, width: number, colourOn: string, bottom = 56): PosterNode {
  const { salon, phone, rating, reviews, link, qr } = data.signature;
  const side = qr ? 320 + QR_SIZE : 340;
  const details = box({ flexDirection: "column", fontSize: 30, color: colourOn, maxWidth: width - 128 - side },
    text({ fontSize: 44, fontWeight: 800 }, phone),
    ...(rating ? [box({ alignItems: "center", marginTop: 4 }, stars(Math.round(rating), 30), text({ marginLeft: 12 }, `${rating.toFixed(1)}${reviews ? ` · ${reviews}` : ""}`))] : []),
    text({ display: "block", opacity: 0.85, marginTop: 4, maxWidth: width - 128 - side, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, link));
  const name = text({ fontFamily: "Caladea", fontSize: qr ? 40 : 46, lineHeight: 1, color: colourOn, maxWidth: qr ? 280 : 320, textAlign: "right" }, salon);
  return box({ position: "absolute", left: 64, bottom, width: width - 128, alignItems: "flex-end", justifyContent: "space-between" },
    details,
    qr ? box({ alignItems: "flex-end" }, name, box({ marginLeft: 24 }, qrCode(qr, QR_SIZE))) : name);
}

/** The largest pill text size, at most 25 px, at which the badges fit on one row of `room` pixels. */
const badgeSize = (badges: string[], room: number) => {
  const letters = badges.reduce((sum, badge) => sum + badge.length, 0);
  // Per pill: about 0.62 em per letter, 1.2 em of padding, a third of an em of margin and two 3 px borders.
  for (let size = 25; size > 14; size--) if (letters * size * 0.62 + badges.length * (size * 1.2 + size / 3 + 6) <= room) return size;
  return 14;
};

/** The wellness-benefit services the salon accepts (Epassi, Benify …), as small outlined pills. */
const badgeRow = (badges: string[], colour: string, size: number, style: Record<string, string | number> = {}) =>
  box({ flexWrap: "wrap", alignItems: "flex-start", ...style }, ...badges.map((badge) =>
    text({ border: `3px solid ${colour}`, color: colour, borderRadius: 999, padding: `${Math.round(size / 4)}px ${Math.round(size * 0.6)}px`, marginRight: Math.round(size / 3), marginTop: 10, fontSize: size, fontWeight: 800 }, badge)));

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
  const detailTop = priceTop + priceSize + 70;
  const detailSize = Math.round(40 * scale);
  // The badges sit just above the signature; the detail gets the lines that fit above them.
  const badgesTop = height - 290;
  const detailLines = data.badges.length ? Math.max(1, Math.min(4, Math.floor((badgesTop - 16 - detailTop) / (detailSize * 1.25)))) : 4;
  const wave = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height - waveTop}" viewBox="0 0 ${width} ${height - waveTop}" preserveAspectRatio="none"><path d="M0 60 C ${width * 0.24} -10, ${width * 0.48} 140, ${width} 40 V${height - waveTop} H0Z" fill="${accent}"/></svg>`;
  return box({ width, height, position: "relative", background, fontFamily: "Inter" },
    svgImage(wave, { position: "absolute", left: 0, top: waveTop, width, height: height - waveTop }),
    image(photoOf(data), { position: "absolute", right: -40, top: Math.round(height * 0.09), width: photoWidth, height: Math.round(height * 0.91), objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px ${photoWidth / 2}px 0 0` }),
    text({ position: "absolute", left: 64, top: 90, width: width - photoWidth - 40, ...headingFont(data), fontSize: Math.round(112 * scale), lineHeight: 0.95, color: readable(ink, [background], 4.5) }, data.headline),
    text({ position: "absolute", left: 56, top: priceTop, fontFamily: "Inter Display", fontWeight: 900, fontSize: priceSize, letterSpacing: -6, color: onAccent, textShadow: `12px 12px 0 ${onAccent === WHITE ? ink : WHITE}` }, data.price),
    ...(data.sticker ? [box({ position: "absolute", left: width - photoWidth - 150, top: waveTop + 20, width: 210, height: 210, borderRadius: 999, background: HIGHLIGHT, color: "#111111", transform: "rotate(-12deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      text({ fontSize: 32 }, data.sticker[0]), text({ fontSize: 52 }, data.sticker[1]))] : []),
    text({ position: "absolute", left: 64, top: detailTop, width: width - photoWidth - 40, fontSize: detailSize, fontWeight: 600, lineHeight: 1.25, color: onAccent, lineClamp: detailLines }, data.detail),
    ...(data.badges.length ? [badgeRow(data.badges, onAccent, badgeSize(data.badges, width - photoWidth - 40), { position: "absolute", left: 64, top: badgesTop, width: width - photoWidth - 40, height: 64, overflow: "hidden" })] : []),
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
    image(photoOf(data), { position: "absolute", right: 0, top: 0, width: Math.round(width * 0.4), height: height - footer, objectFit: "cover", objectPosition: CROP[data.focus] }),
    box({ position: "absolute", left: 56, top: 100, width: cardWidth, flexDirection: "column", background: WHITE, borderRadius: 40, padding: 56, boxShadow: "0 30px 60px rgba(0,0,0,0.15)" },
      ...(data.label ? [box({}, text({ background: accent, color: onColour(accent), fontWeight: 800, fontSize: 28, letterSpacing: 5, padding: "8px 20px", borderRadius: 12 }, data.label.toUpperCase()))] : []),
      text({ ...headingFont(data), fontSize: Math.round(88 * scale), lineHeight: 0.98, marginTop: 22, marginBottom: 18, color: ink }, data.headline),
      ...rows,
      ...(data.badges.length ? [badgeRow(data.badges, ink, 26, { marginTop: 14 })] : [])),
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
    image(photoOf(data), { position: "absolute", right: 0, top: photoTop, width: photoWidth, height: height - photoTop - 260, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px 0 0 ${photoWidth / 8}px`, boxShadow: `-24px 0 0 ${HIGHLIGHT}` }),
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
  const rating = data.stars;
  return box({ width, height, position: "relative", background: ink, fontFamily: "Inter" },
    image(photoOf(data), { position: "absolute", left: 64, top: 90, width: 280, height: 280, borderRadius: 999, border: `10px solid ${accent}`, objectFit: "cover", objectPosition: CROP[data.focus] }),
    text({ position: "absolute", left: 390, top: 40, fontFamily: "Caladea", fontSize: 400, lineHeight: 1, color: accent }, "“"),
    // The quote and its stars flow as one column, so a short quote never leaves a gap.
    box({ position: "absolute", left: 64, top: Math.round(height * 0.33), width: width - 128, flexDirection: "column", color: onInk },
      text({ fontFamily: "Caladea", fontSize: Math.round(72 * scale), lineHeight: 1.15, lineClamp: 6 }, data.quote || data.headline),
      ...(rating ? [box({ marginTop: 48 }, stars(rating, 44))] : []),
      text({ fontSize: 34, marginTop: 12, opacity: 0.9 }, data.author)),
    signature(data, width, onInk));
}

/** The free times left on one day, with the day on a sticker and a call to book. */
function slotsTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  const photoTop = Math.round(height * 0.3);
  const photoHeight = Math.round(height * 0.32);
  const onBackground = onColour(background) === WHITE ? WHITE : ink;
  const listTop = photoTop + photoHeight + 50;
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: onBackground },
    text({ position: "absolute", left: 60, top: tall ? STORY_SAFE.top : 80, width: width - 380, fontFamily: "Inter Display", fontWeight: 900, fontSize: Math.round(150 * scale), lineHeight: 0.92, letterSpacing: -5 }, data.headline),
    ...(data.sticker ? [box({ position: "absolute", right: 70, top: tall ? STORY_SAFE.top + 20 : 90, width: 240, height: 240, borderRadius: 999, background: accent, color: onColour(accent), transform: "rotate(10deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      text({ fontSize: 38 }, data.sticker[0]), text({ fontSize: 64 }, data.sticker[1]))] : []),
    image(photoOf(data), { position: "absolute", left: 0, top: photoTop, width, height: photoHeight, objectFit: "cover", objectPosition: CROP[data.focus] }),
    text({ position: "absolute", left: 60, top: listTop, width: width - 120, fontSize: Math.round(54 * scale), fontWeight: 800 }, data.items.map((item) => item.name).join("  ·  ")),
    text({ position: "absolute", left: 60, top: listTop + Math.round(80 * scale), width: width - 120, fontSize: Math.round(40 * scale), fontWeight: 600, opacity: 0.85 }, data.detail),
    ...(tall
      // The story ends with a booking button, and the QR code beside it so a screenshot still leads to booking.
      ? [box({ position: "absolute", left: 60, bottom: STORY_SAFE.bottom, width: width - 120, alignItems: "center" },
        box({ flexGrow: 1, justifyContent: "center", background: ink, color: onColour(ink), fontWeight: 800, fontSize: 48, padding: 30, borderRadius: 999 }, text({}, data.cta || data.signature.link)),
        ...(data.signature.qr ? [box({ marginLeft: 28 }, qrCode(data.signature.qr, QR_SIZE))] : []))]
      : [box({ position: "absolute", left: 0, bottom: 0, width, height: 250, background: ink }), signature(data, width, onColour(ink))]));
}

/** A before and an after photo side by side (stacked in the story format), the treatment and a call to book. */
function beforeAfterTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  // In a story the dark footer also covers the bottom bar, and the signature sits above it.
  const footer = tall ? 250 + STORY_SAFE.bottom - 56 : 250;
  const gap = 24;
  const onBackground = onColour(background) === WHITE ? WHITE : ink;
  // A long headline gets two smaller lines, and the photos start below them.
  // Heavy display letters average under 0.5 em wide; a headline that would not fit on one line gets two smaller lines.
  const long = data.headline.length * 104 * scale * 0.5 > width - 128;
  const headlineSize = Math.round((long ? 76 : 104) * scale);
  const headlineTop = tall ? STORY_SAFE.top : 70;
  const photoTop = headlineTop + Math.round(headlineSize * (long ? 2 : 1) * 1.02) + 40;
  // Post: two photos side by side; story: one above the other. Both end above the text and the footer.
  const detailSize = Math.round(38 * scale);
  const detailHeight = Math.round(detailSize * 1.25 * 2);
  const photosBottom = height - footer - 30 - detailHeight - (tall ? 150 : 30);
  const slot = tall
    ? { width: width - 128, height: Math.round((photosBottom - photoTop - gap) / 2) }
    : { width: Math.round((width - 128 - gap) / 2), height: photosBottom - photoTop };
  const at = (index: number) => (tall ? { left: 64, top: photoTop + index * (slot.height + gap) } : { left: 64 + index * (slot.width + gap), top: photoTop });
  const tag = (label: string, index: number) => {
    const { left, top } = at(index);
    const fill = index ? accent : WHITE;
    return text({ position: "absolute", left: left + 24, top: top + slot.height - 92, background: fill, color: index ? onColour(accent) : "#111111", fontWeight: 800, fontSize: 32, letterSpacing: 4, padding: "10px 24px", borderRadius: 999 }, label.toUpperCase());
  };
  const photoAt = (src: string, index: number) =>
    image(src, { position: "absolute", ...at(index), width: slot.width, height: slot.height, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: 32 });
  const middle = tall
    ? { left: Math.round(width / 2 - 48), top: photoTop + slot.height + gap / 2 - 48 }
    : { left: Math.round(width / 2 - 48), top: photoTop + Math.round(slot.height / 2) - 48 };
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: onBackground },
    text({ position: "absolute", left: 64, top: headlineTop, width: width - 128, ...headingFont(data), display: "block", fontSize: headlineSize, lineHeight: 1, lineClamp: 2 }, data.headline),
    photoAt(data.before ?? photoOf(data), 0),
    photoAt(photoOf(data), 1),
    tag(data.pair[0], 0),
    tag(data.pair[1], 1),
    box({ position: "absolute", ...middle, width: 96, height: 96, borderRadius: 999, background: HIGHLIGHT, color: "#111111", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 800, transform: tall ? "rotate(90deg)" : "none" }, text({}, "→")),
    text({ position: "absolute", left: 64, top: photosBottom + 30, width: width - 128, fontSize: detailSize, fontWeight: 600, lineHeight: 1.25, lineClamp: 2 }, data.detail),
    ...(tall && data.cta ? [box({ position: "absolute", left: 64, top: photosBottom + 30 + detailHeight + 30 }, button(data.cta, ink, onColour(ink)))] : []),
    box({ position: "absolute", left: 0, bottom: 0, width, height: footer, background: ink }),
    signature(data, width, onColour(ink), tall ? STORY_SAFE.bottom : 56));
}

/** Width and height from a PNG data URL's header, or null when it is not a readable PNG. */
export function pngSize(dataUrl: string): { width: number; height: number } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:image/png") || comma < 0) return null;
  const head = Buffer.from(dataUrl.slice(comma + 1, comma + 1 + 44), "base64");
  if (head.length < 24 || head.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/** The share of a half-body cut-out, from the top, that holds the head and face. */
const HEAD_SHARE = 0.45;

/**
 * Where a cut-out person stands: on the bottom edge, right of centre. When the head can stay above the
 * text block (the person grows to at most 95 % of the height), `clear` is true and the headline may run
 * the full width; otherwise the person stays at 80 % and the text keeps to the left column.
 */
export function cutoutPlacement(size: { width: number; height: number }, width: number, height: number, textTop: number) {
  const aspect = size.width / Math.max(1, size.height);
  const needed = (height - textTop + 24) / (1 - HEAD_SHARE);
  const clear = needed <= Math.min(height * 0.95, (width * 0.66) / aspect);
  // At most two thirds of the width, so the whole face stays on the poster.
  const tall = Math.round(Math.min(clear ? Math.max(height * 0.6, needed) : height * 0.8, (width * 0.66) / aspect));
  const wide = Math.round(tall * aspect);
  // Centred at 74 % of the width, never further left than 40 %, so the face sits right of the text column.
  const left = Math.max(Math.round(width * 0.4), Math.round(width * 0.74 - wide / 2));
  return { clear, left, top: height - tall, width: wide, height: tall };
}

const CREAM = "#fdf3e6";
const GOLD = "#ffd27a";

/**
 * The owner or a colleague on a drawn background in the salon's colour: a cut-out photo stands at the
 * bottom right, any other photo sits in an arch. Big two-level headline, wellness badges, short lines and the link.
 */
function portraitTemplate(data: PosterData, width: number, height: number): PosterNode {
  const scale = SCALE[data.textSize];
  const column = Math.round(width * 0.58);
  // Stories keep text out of the app's own bars: 270 px at the top and 390 px at the bottom of 1920.
  const tall = isStory(width, height);
  const top = tall ? STORY_SAFE.top : 70;
  const safe = tall ? STORY_SAFE.bottom : 40;
  const shadow = "0 3px 18px rgba(0,0,0,0.45)";
  const headlineSize = Math.min(Math.round(150 * scale), Math.floor((width - 128) / (Math.max(6, data.headline.length) * 0.52)));
  const leadSize = Math.round(76 * scale);
  const bodySize = Math.round(40 * scale);
  // Where the text block starts, estimated from the sizes above (it grows upwards from the footer).
  const textBottom = height - (safe + 190);
  const textTop = textBottom - (data.lead ? leadSize : 0) - 6 - Math.round(headlineSize * 0.98)
    - (data.badges.length ? 18 + 54 : 0) - (data.detail ? 28 + bodySize * 1.25 * 2 : 0) - (data.cta ? 14 + bodySize * 1.25 : 0);
  const placement = data.cutout ? cutoutPlacement(pngSize(photoOf(data)) ?? { width: 3, height: 4 }, width, height, textTop) : null;
  // A headline that would cross the face keeps to the left column, set smaller to fit its longest word.
  const keepLeft = placement ? !placement.clear : false;
  const longest = Math.max(6, ...data.headline.split(/\s+/).map((word) => word.length));
  const headline = keepLeft ? Math.min(headlineSize, Math.floor(column / (longest * 0.52))) : headlineSize;
  const person = placement
    ? image(photoOf(data), { position: "absolute", left: placement.left, top: placement.top, width: placement.width, height: placement.height, objectFit: "cover", objectPosition: "50% 0%" })
    // The arch ends above the text block, so the headline never runs across a face.
    : image(photoOf(data), { position: "absolute", left: column + 12, top: top + 30, width: width - column - 12, height: Math.round(height * (tall ? 0.36 : 0.34)), objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${(width - column) / 2}px 0 0 ${(width - column) / 2}px`, border: `8px solid ${GOLD}`, borderRight: "none" });
  return box({ width, height, position: "relative", fontFamily: "Inter", color: CREAM },
    svgImage(backdropSvg(data.backdrop, width, height, data.colors.accent), { position: "absolute", left: 0, top: 0, width, height }),
    person,
    // Dark scrims behind the text, strongest on the left where the lines are, so light text stays readable
    // over the photo and the art while the person on the right keeps their colour.
    box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)" }),
    box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) ${Math.round(((safe + 190) / height) * 100)}%, rgba(0,0,0,0) 60%)` }),
    text({ position: "absolute", left: 64, top, maxWidth: column - 64, fontFamily: "Caladea", fontSize: 64, lineHeight: 1, textShadow: shadow }, data.signature.salon),
    // The text block grows upwards from the footer, so short and long texts both end in the same place.
    box({ position: "absolute", left: 64, bottom: safe + 190, width: width - 128, flexDirection: "column", textShadow: shadow },
      ...(data.lead ? [text({ fontFamily: "Inter Display", fontWeight: 900, fontSize: leadSize, letterSpacing: -2, lineHeight: 1, maxWidth: column }, data.lead)] : []),
      text({ display: "block", fontFamily: "Inter Display", fontWeight: 900, fontSize: headline, letterSpacing: -4, lineHeight: 0.98, marginTop: 6, lineClamp: 2, ...(keepLeft && { maxWidth: column }) }, data.headline),
      ...(data.badges.length ? [badgeRow(data.badges, CREAM, badgeSize(data.badges, column) + 4, { marginTop: 18, maxWidth: column })] : []),
      ...(data.detail ? [text({ display: "block", fontSize: bodySize, fontWeight: 600, lineHeight: 1.25, marginTop: 28, maxWidth: column, lineClamp: 2 }, data.detail)] : []),
      ...(data.cta ? [text({ fontSize: bodySize, fontWeight: 600, color: GOLD, marginTop: 14, maxWidth: column }, data.cta)] : [])),
    box({ position: "absolute", left: 64, bottom: safe + 104, width: width - 128 - (data.signature.qr ? 170 : 0), height: 2, background: CREAM, opacity: 0.4 }),
    text({ display: "block", position: "absolute", left: 64, bottom: safe + 40, maxWidth: width - 128 - 180, fontSize: 36, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: shadow }, [data.signature.link, data.signature.phone].filter(Boolean).join("  ·  ")),
    ...(data.signature.qr ? [box({ position: "absolute", right: 64, bottom: safe }, qrCode(data.signature.qr, 150))] : []));
}

/**
 * The largest headline size, and the fewest lines (at most `maxLines`), at which `headline` fits `room` pixels.
 * A size reaching 60 % of `max` is comfortable; otherwise one more line is tried. The size stays at or above
 * `floor` (a longer text gets another line instead of smaller letters), except that the longest word must always
 * fit the width on its own: shrinking is better than a word running off the poster.
 */
export function fitHeadline(headline: string, room: number, max: number, floor: number, maxLines: number) {
  const longest = Math.max(1, ...headline.split(/\s+/).map((word) => word.length));
  // Heavy display letters average about 0.6 em with their spacing (measured on "Medicinsk" at 200 px).
  const wordFit = room / (longest * 0.6);
  const sizeFor = (lines: number) => Math.min(max, room / (Math.max(longest, Math.ceil(headline.length / lines)) * 0.6));
  const lines = Array.from({ length: maxLines }, (_, i) => i + 1).find((count) => sizeFor(count) >= max * 0.6) ?? maxLines;
  return { size: Math.floor(Math.min(wordFit, Math.max(floor, sizeFor(lines)))), lines };
}

const QR_SMALL = 120;

/**
 * One small line of two parts, `name` and `link`, that stays on one row, with the QR code at its end when there is one.
 * The link keeps its full width; the name gives way first and is ellipsized.
 */
const smallLine = (name: string, link: string, qr: string | undefined, width: number, colourOn: string, style: Style = {}) => {
  const part = { fontSize: 32, fontWeight: 700, color: colourOn, whiteSpace: "nowrap" } as const;
  return box({ width, alignItems: "flex-end", justifyContent: "space-between", ...style },
    box({ flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: width - (qr ? QR_SMALL + 32 : 0) },
      // The name gives way first (a much larger shrink factor) but keeps its first letters; a link longer than the
      // rest of the line is cut too.
      ...(name ? [text({ ...part, flexShrink: 1000, minWidth: Math.min(200, name.length * 18), overflow: "hidden", textOverflow: "ellipsis" }, name)] : []),
      ...(name && link ? [text({ ...part, flexShrink: 0, whiteSpace: "pre" }, "  ·  ")] : []),
      ...(link ? [text({ ...part, flexShrink: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }, link)] : [])),
    ...(qr ? [qrCode(qr, QR_SMALL)] : []));
};

/** The photo over the whole poster under a dark scrim: a big headline, one line, a booking pill and one small contact line. */
function fullPhotoTemplate(data: PosterData, width: number, height: number): PosterNode {
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  const room = width - 128;
  const { size, lines } = fitHeadline(data.headline, room, Math.round(150 * scale), Math.round(72 * scale), 2);
  const shadow = "0 3px 18px rgba(0,0,0,0.45)";
  const bottom = tall ? STORY_SAFE.bottom + 40 : 64;
  const lineSize = Math.round(44 * scale);
  const line = data.price || data.detail;
  // The text block's height, estimated from its parts, tells where the scrim has to start: strong from the headline's first line (the contact row is as tall as the QR code when there is one).
  const contactRow = data.signature.qr ? QR_SMALL : 40;
  const blockTop = height - bottom - 32 - contactRow - (data.cta ? 36 + 88 : 0) - (line ? 24 + lineSize * 1.25 : 0) - Math.round(size * 0.98 * lines);
  const percent = (y: number) => Math.max(0, Math.round((y / height) * 100));
  return box({ width, height, position: "relative", fontFamily: "Inter", color: WHITE },
    image(photoOf(data), { position: "absolute", left: 0, top: 0, width, height, objectFit: "cover", objectPosition: CROP[data.focus] }),
    box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) ${percent(blockTop - height * 0.12)}%, rgba(0,0,0,0.8) ${percent(blockTop)}%, rgba(0,0,0,0.9) 100%)` }),
    text({ position: "absolute", left: 64, top: tall ? STORY_SAFE.top + 20 : 64, maxWidth: room, background: "rgba(255,255,255,0.82)", color: "#111111", fontFamily: "Caladea", fontSize: 38, lineHeight: 1, padding: "12px 26px", borderRadius: 999, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, data.signature.salon),
    box({ position: "absolute", left: 64, bottom, width: room, flexDirection: "column", alignItems: "flex-start", textShadow: shadow },
      text({ display: "block", width: room, fontFamily: "Inter Display", fontWeight: 900, letterSpacing: -4, fontSize: size, lineHeight: 0.98, lineClamp: lines }, data.headline),
      ...(line ? [text({ display: "block", width: room, fontSize: lineSize, fontWeight: 700, lineHeight: 1.25, marginTop: 24, lineClamp: 1 }, line)] : []),
      ...(data.cta ? [text({ background: WHITE, color: "#111111", fontWeight: 800, fontSize: 40, padding: "22px 48px", borderRadius: 999, marginTop: 36, textShadow: "none" }, data.cta)] : []),
      smallLine(data.signature.phone, data.signature.link, data.signature.qr, room, WHITE, { marginTop: 32 })));
}

/** Only words: a very large headline, the detail, a thin accent rule and the call to book, on the salon's background colour. */
function typographyTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const room = width - 128;
  // The owner's ink when it reads on the background, otherwise the nearest colour that does.
  const readableInk = readable(ink, [background], 4.5);
  const { size, lines } = fitHeadline(data.headline, room, Math.round(230 * scale), Math.round(96 * scale), 3);
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: readableInk },
    box({ position: "absolute", left: 64, top: 64, width: room, height: height - 128 - 120, flexDirection: "column", justifyContent: "center", alignItems: "flex-start" },
      text({ display: "block", width: room, ...headingFont(data), fontSize: size, lineHeight: 0.98, lineClamp: lines }, data.headline),
      ...(data.detail ? [text({ display: "block", width: room, fontSize: Math.round(46 * scale), fontWeight: 600, lineHeight: 1.25, marginTop: 44, lineClamp: 3 }, data.detail)] : []),
      box({ width: 160, height: 8, background: accent, marginTop: 52 }),
      ...(data.cta ? [text({ background: accent, color: onColour(accent), fontWeight: 800, fontSize: 40, padding: "22px 48px", borderRadius: 999, marginTop: 52 }, data.cta)] : [])),
    smallLine(data.signature.salon, data.signature.link, data.signature.qr, room, readableInk, { position: "absolute", left: 64, bottom: 64 }));
}

const LAYOUTS: Record<EngineTemplate, (data: PosterData, width: number, height: number) => PosterNode> = {
  price: priceTemplate,
  pricelist: priceListTemplate,
  season: seasonTemplate,
  review: reviewTemplate,
  slots: slotsTemplate,
  beforeafter: beforeAfterTemplate,
  portrait: portraitTemplate,
  fullphoto: fullPhotoTemplate,
  typography: typographyTemplate,
};

/** Templates with their own story layout; the others show their post layout as a card inside the story's safe zone. */
const STORY_LAYOUTS = new Set<EngineTemplate>(["slots", "beforeafter", "portrait", "fullphoto"]);
const CARD = { width: 1008, height: 1260 };

export function posterTree(template: EngineTemplate, data: PosterData, format: EngineFormat): PosterNode {
  const { width, height } = ENGINE_FORMATS[format];
  if (format !== "story" || STORY_LAYOUTS.has(template)) return LAYOUTS[template](data, width, height);
  // The post's proportions (4:5), a little smaller, between the bars Instagram lays over a story.
  const top = STORY_SAFE.top + Math.round((height - STORY_SAFE.top - STORY_SAFE.bottom - CARD.height) / 2);
  return box({ width, height, position: "relative" },
    svgImage(backdropSvg("plain", width, height, data.colors.accent), { position: "absolute", left: 0, top: 0, width, height }),
    box({ position: "absolute", left: Math.round((width - CARD.width) / 2), top, width: CARD.width, height: CARD.height, borderRadius: 36, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" },
      LAYOUTS[template](data, CARD.width, CARD.height)));
}
