import { encode } from "uqr";
import { z } from "zod";
import { contrast, readable } from "../../page/colour";
import { BACKDROPS, backdropSvg } from "./backdrops";
import { box, image, svgImage, text, type PosterNode, type Style } from "./element";
import { accentRise, fitText, normalSpaces, textWidth } from "./measure";

// Poster templates for the server renderer: designed layouts with fixed slots
// (headline, price, photo, sticker, price list, signature) that the owner fills
// and adjusts within limits, so every poster stays presentable.

export const ENGINE_TEMPLATES = ["price", "pricelist", "season", "review", "slots", "beforeafter", "portrait", "fullphoto", "typography"] as const;
export type EngineTemplate = (typeof ENGINE_TEMPLATES)[number];

export const ENGINE_FORMATS = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 }, window: { width: 1050, height: 1485 } } as const;
export type EngineFormat = keyof typeof ENGINE_FORMATS;

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** A line of text with its no-break and narrow spaces made ordinary ones, so the sizing and Satori break lines the same way. */
const line = (max: number) => z.string().transform(normalSpaces).pipe(z.string().trim().max(max));
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
  /** Price, Portrait, Full photo and Before/after: the mirrored arrangement; the other templates ignore it. */
  arrangement: z.enum(["standard", "mirrored"]).default("standard"),
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
const MARGIN = 64;

/** Phone, rating, booking link, the salon's name and a QR code to the booking page: the same strip on every poster, so posts are recognisable. */
function signature(data: PosterData, width: number, colourOn: string, bottom = MARGIN): PosterNode {
  const { salon, phone, rating, reviews, link, qr } = data.signature;
  const side = qr ? 320 + QR_SIZE : 340;
  const room = width - 128 - side;
  // The phone shrinks to the room it has; the salon's name takes two lines at most, smaller first, then cut.
  const phoneFit = fitText({ text: phone, font: "extrabold", room, max: 44, floor: 28, lineHeight: 1.2, oneLine: true });
  const nameRoom = qr ? 280 : 320;
  const nameFit = fitText({ text: salon, font: "serif", room: nameRoom, max: qr ? 40 : 46, floor: 30, lineHeight: 1.2, maxLines: 2 });
  const cut = { display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const details = box({ flexDirection: "column", fontSize: 30, color: colourOn, maxWidth: room },
    text({ ...cut, maxWidth: room, fontSize: phoneFit.size, fontWeight: 800, lineHeight: 1.2 }, phone),
    ...(rating ? [box({ alignItems: "center", marginTop: 4, maxWidth: room }, stars(Math.round(rating), 30), text({ ...cut, flexShrink: 1, minWidth: 0, marginLeft: 12 }, `${rating.toFixed(1)}${reviews ? ` · ${reviews}` : ""}`))] : []),
    text({ ...cut, opacity: 0.85, marginTop: 4, maxWidth: room }, link));
  const name = text({ fontFamily: "Caladea", fontSize: nameFit.size, lineHeight: 1.2, color: colourOn, maxWidth: nameRoom, textAlign: "right", lineClamp: nameFit.lines }, salon);
  return box({ position: "absolute", left: MARGIN, bottom, width: width - 128, alignItems: "flex-end", justifyContent: "space-between" },
    details,
    qr ? box({ alignItems: "flex-end" }, name, box({ marginLeft: 24 }, qrCode(qr, QR_SIZE))) : name);
}

/** The two lines of a sticker, each shrunk to fit the circle's chord at its height. */
const stickerLines = (lines: readonly [string, string], sizes: readonly [number, number], room: number) =>
  lines.map((value, i) => text({ fontSize: fitText({ text: value, font: "extrabold", room, max: sizes[i], floor: 14, lineHeight: 1.2, oneLine: true }).size, whiteSpace: "nowrap" }, value));

/** What the wellness-benefit pills measure at `size`: the text, 0.6 em of padding on both sides, two 3 px borders and a third of an em between pills. */
const pillWidth = (badge: string, size: number) => textWidth(badge, "extrabold", size) + size * 1.2 + 6 + Math.round(size / 3);
const pillHeight = (size: number) => Math.round(size * 1.2) + 2 * Math.round(size / 4) + 6 + 10;

/** The rows `badges` wrap into within `room` pixels. */
function badgeRows(badges: string[], size: number, room: number): number {
  let rows = 1;
  let used = 0;
  for (const badge of badges) {
    const width = pillWidth(badge, size);
    if (used && used + width > room) {
      rows++;
      used = 0;
    }
    used += width;
  }
  return rows;
}

/** The largest pill text size, at most `max`, that keeps the badges on one row of `room` pixels, or else on two rows (never below 14 px). Every pill must fit the room on its own. */
const badgeSize = (badges: string[], room: number, max = 25) => {
  for (const [rows, floor] of [[1, 18], [2, 14]] as const) {
    for (let size = max; size >= floor; size--) if (badgeRows(badges, size, room) <= rows && badges.every((badge) => pillWidth(badge, size) <= room)) return size;
  }
  return 14;
};

/** The height of the badge rows, with the 10 px above each. */
const badgesHeight = (badges: string[], size: number, room: number) => badgeRows(badges, size, room) * pillHeight(size);

/** The wellness-benefit services the salon accepts (Epassi, Benify …), as small outlined pills. */
const badgeRow = (badges: string[], colour: string, size: number, style: Record<string, string | number> = {}) =>
  box({ flexWrap: "wrap", alignItems: "flex-start", ...style }, ...badges.map((badge) =>
    text({ border: `3px solid ${colour}`, color: colour, borderRadius: 999, padding: `${Math.round(size / 4)}px ${Math.round(size * 0.6)}px`, marginRight: Math.round(size / 3), marginTop: 10, fontSize: size, lineHeight: 1.2, fontWeight: 800 }, badge)));

function headingFont(data: PosterData) {
  return data.serifHeadings ? { fontFamily: "Caladea", fontWeight: 400 } : { fontFamily: "Inter Display", fontWeight: 900 };
}

/** The letter spacing (in em) of Inter Display's big lines: tight, and in proportion to the size. */
const TIGHT = -0.03;

/** The font and tracking `headingFont` draws, for sizing headlines. */
const headingFace = (data: PosterData) => (data.serifHeadings ? { font: "serif", tracking: -0.01 } as const : { font: "black", tracking: TIGHT } as const);

/** A pill with one line of `label`, set smaller to fit `room` pixels and cut with an ellipsis when that is not enough. */
function button(label: string, background: string, colourOn: string, room: number, size = 40, style: Style = {}): PosterNode {
  const padX = Math.round(size * 0.9);
  const fit = fitText({ text: label, font: "extrabold", room: room - 2 * padX, max: size, floor: Math.round(size * 0.7), lineHeight: 1.2, oneLine: true });
  // The wrapper owns the room and the position; the pill inside is as wide as its text, up to the room (or all of it with `flexGrow`).
  // Satori's widths exclude padding, so the pill's own maximum is the room less its padding.
  return box({ width: room, ...style },
    box({ background, borderRadius: 999, padding: `${Math.round(size / 2)}px ${padX}px`, maxWidth: room - 2 * padX, ...(style.flexGrow ? { flexGrow: 1, justifyContent: "center" } : {}) },
      text({ display: "block", color: colourOn, fontWeight: 800, fontSize: fit.size, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, label)));
}

/** One treatment and its price, large, beside the owner's photo. */
function priceTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const onAccent = onColour(accent);
  const mirrored = data.arrangement === "mirrored";
  const waveTop = Math.round(height * 0.28);
  const photoWidth = Math.round(width * 0.52);
  // The text column: left of the photo, or right of it when mirrored (the photo then sits on the left edge). Text never lies over the photo.
  const column = width - photoWidth - 40;
  const textLeft = mirrored ? photoWidth - 24 : MARGIN;
  const face = headingFace(data);
  // The headline stays above the wave, as large as its words allow.
  const headline = fitText({ text: data.headline, font: face.font, room: column, max: Math.round(112 * scale), floor: 56, lineHeight: 0.95, maxHeight: waveTop - 60, tracking: face.tracking });
  const priceTop = waveTop + (data.sticker ? 250 : 130);
  // The badges sit just above the signature; the price may not grow so far that they, and one line of detail, lose their room.
  const badgeFont = badgeSize(data.badges, column);
  const badgesTop = height - MARGIN - QR_SIZE - 8 - (data.badges.length ? badgesHeight(data.badges, badgeFont, column) : 0);
  // The price stays in the text column too (its shadow reaches 12 px further), on one line: the whole string must fit.
  const price = fitText({ text: data.price, font: "black", room: column - 12, max: Math.round(220 * scale), floor: 72, lineHeight: 1, oneLine: true, tracking: TIGHT, maxHeight: badgesTop - 16 - (data.detail ? 33 : 0) - 70 - priceTop });
  const detailTop = priceTop + price.size + 70;
  const detail = fitText({ text: data.detail, font: "semibold", room: column, max: Math.round(40 * scale), floor: 26, lineHeight: 1.25, maxLines: 4, maxHeight: badgesTop - 16 - detailTop });
  const wave = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height - waveTop}" viewBox="0 0 ${width} ${height - waveTop}" preserveAspectRatio="none"><path ${mirrored ? `transform="translate(${width} 0) scale(-1 1)" ` : ""}d="M0 60 C ${width * 0.24} -10, ${width * 0.48} 140, ${width} 40 V${height - waveTop} H0Z" fill="${accent}"/></svg>`;
  return box({ width, height, position: "relative", background, fontFamily: "Inter" },
    svgImage(wave, { position: "absolute", left: 0, top: waveTop, width, height: height - waveTop }),
    // Mirrored, the photo ends above the signature strip, whose phone and rating start on the left.
    image(photoOf(data), { position: "absolute", ...(mirrored ? { left: -40 } : { right: -40 }), top: Math.round(height * 0.09), width: photoWidth, height: mirrored ? Math.round(height * 0.91) - 250 : Math.round(height * 0.91), objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px ${photoWidth / 2}px 0 0` }),
    text({ position: "absolute", left: textLeft, top: 90, width: column, ...headingFont(data), letterSpacing: headline.spacing, fontSize: headline.size, lineHeight: 0.95, lineClamp: headline.lines, color: readable(ink, [background], 4.5) }, data.headline),
    text({ position: "absolute", left: textLeft, top: priceTop, width: column, whiteSpace: "nowrap", fontFamily: "Inter Display", fontWeight: 900, fontSize: price.size, letterSpacing: price.spacing, color: onAccent, textShadow: `12px 12px 0 ${onAccent === WHITE ? ink : WHITE}` }, data.price),
    ...(data.sticker ? [box({ position: "absolute", left: mirrored ? photoWidth - 36 : width - photoWidth - 174, top: waveTop + 20, width: 210, height: 210, borderRadius: 999, background: HIGHLIGHT, color: "#111111", transform: "rotate(-12deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      ...stickerLines(data.sticker, [32, 52], 180))] : []),
    text({ position: "absolute", left: textLeft, top: detailTop, width: column, fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, color: onAccent, lineClamp: detail.lines }, data.detail),
    ...(data.badges.length ? [badgeRow(data.badges, onAccent, badgeFont, { position: "absolute", left: textLeft, top: badgesTop, width: column })] : []),
    signature(data, width, onAccent));
}

/** Several treatments with prices on a card, with the payment badges the salon accepts. */
function priceListTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const cardWidth = Math.round(width * 0.74);
  // Satori's widths exclude padding: the card is 56 px wider than this on each side.
  const inner = cardWidth;
  const footer = 250;
  const face = headingFace(data);
  // The card ends above the footer: the badges, label and headline keep their share, the rows (one line each) shrink to the rest.
  const badgeFont = badgeSize(data.badges, inner, 26);
  const badgesH = data.badges.length ? 14 + badgesHeight(data.badges, badgeFont, inner) : 0;
  const room = height - footer - 24 - 100 - 112 - (data.label ? 50 : 0) - 40 - badgesH;
  const count = Math.max(1, data.items.length);
  const headlineMin = Math.round(2 * 56 * 0.98);
  const rowSize = Math.max(24, Math.min(Math.round(38 * scale), Math.floor(((room - headlineMin) / count - 20) / 1.25)));
  const rowsH = data.items.length * Math.round(rowSize * 1.25 + 20);
  const headline = fitText({ text: data.headline, font: face.font, room: inner, max: Math.round(88 * scale), floor: 56, lineHeight: 0.98, maxLines: 2, maxHeight: room - rowsH, tracking: face.tracking });
  const rows = data.items.map((item) => box({ alignItems: "flex-end", paddingTop: 10, paddingBottom: 10, fontSize: rowSize, lineHeight: 1.25 },
    text({ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: inner - Math.ceil(textWidth(item.price, "extrabold", rowSize)) - 100 }, item.name),
    box({ flexGrow: 1, borderBottom: `3px dotted ${accent}`, marginLeft: 14, marginRight: 14, marginBottom: 10 }),
    text({ fontWeight: 800 }, item.price)));
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: ink },
    image(photoOf(data), { position: "absolute", right: 0, top: 0, width: Math.round(width * 0.4), height: height - footer, objectFit: "cover", objectPosition: CROP[data.focus] }),
    box({ position: "absolute", left: 56, top: 100, width: cardWidth, flexDirection: "column", background: WHITE, borderRadius: 40, padding: 56, boxShadow: "0 30px 60px rgba(0,0,0,0.15)" },
      ...(data.label ? [box({}, text({ background: accent, color: onColour(accent), fontWeight: 800, fontSize: 28, lineHeight: 1.2, letterSpacing: 5, padding: "8px 20px", borderRadius: 12 }, data.label.toUpperCase()))] : []),
      text({ ...headingFont(data), letterSpacing: headline.spacing, fontSize: headline.size, lineHeight: 0.98, lineClamp: headline.lines, marginTop: 22, marginBottom: 18, color: ink }, data.headline),
      ...rows,
      ...(data.badges.length ? [badgeRow(data.badges, ink, badgeFont, { marginTop: 14 })] : [])),
    box({ position: "absolute", left: 0, bottom: 0, width, height: footer, background: ink }),
    signature(data, width, onColour(ink)));
}

const mixColour = (a: string, b: string, amount: number) => {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount).toString(16).padStart(2, "0")).join("")}`;
};

/** A season or holiday greeting on the accent colour, the photo in an arch with a bright edge. */
function seasonTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent } = data.colors;
  const scale = SCALE[data.textSize];
  const onAccent = onColour(accent);
  const deep = mixColour(accent, "#000000", 0.45);
  const photoWidth = Math.round(width * 0.52);
  const photoTop = Math.round(height * 0.36);
  // A short greeting is set large; a campaign name gets two smaller lines so it never reaches the text below.
  const headline = fitText({ text: data.headline, font: "serif", room: width - 128, max: Math.round((data.headline.length > 14 ? 96 : 150) * scale), floor: 64, lineHeight: 0.95, maxLines: 2 });
  // The detail and the button keep left of the photo and its bright edge.
  const detailRoom = width - photoWidth - 110;
  const detail = fitText({ text: data.detail, font: "semibold", room: detailRoom, max: Math.round(42 * scale), floor: 26, lineHeight: 1.25, maxLines: 5, maxHeight: 320 });
  const dots = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${[[0.11, 0.1, 6], [0.28, 0.06, 4], [0.83, 0.15, 8], [0.9, 0.38, 5], [0.06, 0.45, 7], [0.72, 0.07, 3], [0.48, 0.13, 5], [0.19, 0.31, 3]]
    .map(([x, y, radius]) => `<circle cx="${x * width}" cy="${y * height}" r="${radius}" fill="#ffffff" opacity="0.5"/>`).join("")}</svg>`;
  return box({ width, height, position: "relative", fontFamily: "Inter", backgroundImage: `radial-gradient(circle at 70% 25%, ${accent}, ${deep})` },
    svgImage(dots, { position: "absolute", left: 0, top: 0, width, height }),
    // The photo stops above the signature, which keeps the whole width.
    image(photoOf(data), { position: "absolute", right: 0, top: photoTop, width: photoWidth, height: height - photoTop - 260, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: `${photoWidth / 2}px 0 0 ${photoWidth / 8}px`, boxShadow: `-24px 0 0 ${HIGHLIGHT}` }),
    text({ position: "absolute", left: MARGIN, top: 100, width: width - 128, fontFamily: "Caladea", fontSize: headline.size, lineHeight: 0.95, color: onAccent, lineClamp: headline.lines }, data.headline),
    text({ position: "absolute", left: 68, top: photoTop + 20, width: detailRoom, fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, color: onAccent, lineClamp: detail.lines }, data.detail),
    ...(data.cta ? [button(data.cta, WHITE, deep, width - photoWidth - 40 - MARGIN, 40, { position: "absolute", left: MARGIN, top: photoTop + 360 })] : []),
    signature(data, width, onAccent));
}

/** A customer's own words, large, with the stars and their name. */
function reviewTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink } = data.colors;
  const scale = SCALE[data.textSize];
  const onInk = onColour(ink);
  const rating = data.stars;
  const top = Math.round(height * 0.33);
  // The quote gets what is left between its top and the signature, after the stars and the name.
  const reserve = (rating ? 48 + 44 : 0) + 12 + 43;
  const quote = fitText({ text: data.quote || data.headline, font: "serif", room: width - 128, max: Math.round(72 * scale), floor: 40, lineHeight: 1.15, maxLines: 6, maxHeight: height - MARGIN - QR_SIZE - 30 - top - reserve });
  return box({ width, height, position: "relative", background: ink, fontFamily: "Inter" },
    image(photoOf(data), { position: "absolute", left: MARGIN, top: 90, width: 280, height: 280, borderRadius: 999, border: `10px solid ${accent}`, objectFit: "cover", objectPosition: CROP[data.focus] }),
    text({ position: "absolute", left: 390, top: 40, fontFamily: "Caladea", fontSize: 400, lineHeight: 1, color: accent }, "“"),
    // The quote and its stars flow as one column, so a short quote never leaves a gap.
    box({ position: "absolute", left: MARGIN, top, width: width - 128, flexDirection: "column", color: onInk },
      text({ fontFamily: "Caladea", fontSize: quote.size, lineHeight: 1.15, lineClamp: quote.lines }, data.quote || data.headline),
      ...(rating ? [box({ marginTop: 48 }, stars(rating, 44))] : []),
      text({ display: "block", fontSize: 34, lineHeight: 1.25, marginTop: 12, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, data.author)),
    signature(data, width, onInk));
}

/** The free times left on one day, with the day on a sticker and a call to book. */
function slotsTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  const room = width - 128;
  // The headline starts below the margin or the story's bar by the height an accent on a capital reaches above its line.
  const headlineTop = (tall ? STORY_SAFE.top : MARGIN) + accentRise("black", Math.round(150 * scale));
  const photoTop = Math.round(height * 0.3);
  const onBackground = onColour(background) === WHITE ? WHITE : readable(ink, [background], 4.5);
  // The headline keeps left of the sticker and above the photo.
  const headline = fitText({ text: data.headline, font: "black", room: data.sticker ? width - 390 : room, max: Math.round(150 * scale), floor: 64, lineHeight: 0.92, maxHeight: photoTop - headlineTop - 20, tracking: TIGHT });
  const list = data.items.map((item) => item.name).join(" · ");
  const items = fitText({ text: list, font: "extrabold", room, max: Math.round(54 * scale), floor: 34, lineHeight: 1.25, maxLines: 2 });
  const detail = fitText({ text: data.detail, font: "semibold", room, max: Math.round(40 * scale), floor: 26, lineHeight: 1.25, maxLines: 2 });
  const itemsHeight = list ? Math.round(items.lines * items.size * 1.25) : 0;
  const textHeight = itemsHeight + (data.detail ? 12 + Math.round(detail.lines * detail.size * 1.25) : 0);
  // The story ends with a booking button, and the QR code beside it so a screenshot still leads to booking.
  const textBottom = (tall ? height - STORY_SAFE.bottom - (data.signature.qr ? QR_SIZE : 110) : height - 250) - 24;
  // The text keeps its size; a photo that would push it into the footer gets shorter instead.
  const photoHeight = Math.max(160, Math.min(Math.round(height * 0.32), textBottom - 50 - textHeight - photoTop));
  const listTop = photoTop + photoHeight + 50;
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: onBackground },
    text({ position: "absolute", left: MARGIN, top: headlineTop, width: data.sticker ? width - 390 : room, fontFamily: "Inter Display", fontWeight: 900, fontSize: headline.size, lineHeight: 0.92, letterSpacing: headline.spacing, lineClamp: headline.lines }, data.headline),
    ...(data.sticker ? [box({ position: "absolute", right: 70, top: tall ? STORY_SAFE.top + 20 : 90, width: 240, height: 240, borderRadius: 999, background: accent, color: onColour(accent), transform: "rotate(10deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800 },
      ...stickerLines(data.sticker, [38, 64], 200))] : []),
    image(photoOf(data), { position: "absolute", left: 0, top: photoTop, width, height: photoHeight, objectFit: "cover", objectPosition: CROP[data.focus] }),
    ...(list ? [text({ position: "absolute", left: MARGIN, top: listTop, width: room, fontSize: items.size, fontWeight: 800, lineHeight: 1.25, lineClamp: items.lines }, list)] : []),
    text({ position: "absolute", left: MARGIN, top: listTop + itemsHeight + 12, width: room, fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, opacity: 0.85, lineClamp: detail.lines }, data.detail),
    ...(tall
      ? [box({ position: "absolute", left: MARGIN, bottom: STORY_SAFE.bottom, width: room, alignItems: "center" },
        button(data.cta || data.signature.link, ink, onColour(ink), room - (data.signature.qr ? QR_SIZE + 28 : 0), 48, { flexGrow: 1, justifyContent: "center" }),
        ...(data.signature.qr ? [box({ marginLeft: 28 }, qrCode(data.signature.qr, QR_SIZE))] : []))]
      : [box({ position: "absolute", left: 0, bottom: 0, width, height: 250, background: ink }), signature(data, width, onColour(ink))]));
}

/**
 * A before and an after photo side by side (stacked in the story format), each with its label in a strip below it
 * (never over a face), the treatment and a call to book.
 */
function beforeAfterTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  const mirrored = data.arrangement === "mirrored";
  const room = width - 128;
  // In a story the dark footer also covers the bottom bar, and the signature sits above it.
  const footer = tall ? 250 + STORY_SAFE.bottom - 56 : 250;
  const gap = 24;
  const strip = 72;
  const stripGap = 14;
  const face = headingFace(data);
  // A long headline gets two smaller lines, and the photos start below them.
  const headline = fitText({ text: data.headline, font: face.font, room, max: Math.round(104 * scale), floor: 56, lineHeight: 1, maxLines: 2, tracking: face.tracking });
  const headlineTop = (tall ? STORY_SAFE.top : MARGIN) + accentRise(face.font, Math.round(104 * scale));
  const photoTop = headlineTop + Math.round(headline.size * headline.lines * 1.02) + 40;
  // Post: two photos side by side; story: one above the other. Both end above the text and the footer.
  const detail = fitText({ text: data.detail, font: "semibold", room, max: Math.round(38 * scale), floor: 26, lineHeight: 1.25, maxLines: 2 });
  const detailHeight = Math.round(detail.size * 1.25 * 2);
  const photosBottom = height - footer - 30 - detailHeight - (tall ? 150 : 30);
  const slot = tall
    ? { width: room, height: Math.round((photosBottom - photoTop - gap) / 2) - stripGap - strip }
    : { width: Math.round((room - gap) / 2), height: photosBottom - photoTop - stripGap - strip };
  const at = (index: number) => (tall ? { left: MARGIN, top: photoTop + index * (slot.height + stripGap + strip + gap) } : { left: MARGIN + index * (slot.width + gap), top: photoTop });
  // Mirrored, the "after" photo comes first; each label stays with its own photo.
  const shots = [{ src: data.before ?? photoOf(data), label: data.pair[0], after: false }, { src: photoOf(data), label: data.pair[1], after: true }];
  if (mirrored) shots.reverse();
  // The label centres under its photo; beside the photos the arrow takes the middle of the strip, in a story the end of the first strip.
  const labelRoom = tall ? slot.width - 2 * (strip + 12) : slot.width - 72;
  const tag = ({ label, after }: (typeof shots)[number], index: number) => {
    const { left, top } = at(index);
    const fit = fitText({ text: label.toUpperCase(), font: "extrabold", room: labelRoom - 48, max: 32, floor: 22, lineHeight: 1.2, tracking: 0.125, oneLine: true });
    return box({ position: "absolute", left, top: top + slot.height + stripGap, width: slot.width, height: strip, alignItems: "center", justifyContent: "center" },
      text({ display: "block", maxWidth: labelRoom - 48, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: after ? accent : WHITE, color: after ? onColour(accent) : "#111111", fontWeight: 800, fontSize: fit.size, lineHeight: 1.2, letterSpacing: fit.spacing, padding: "10px 24px", borderRadius: 999 }, label.toUpperCase()));
  };
  const photoAt = ({ src }: (typeof shots)[number], index: number) =>
    image(src, { position: "absolute", ...at(index), width: slot.width, height: slot.height, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: 32 });
  // The arrow always points from the before photo to the after photo.
  const arrowTurn = tall ? (mirrored ? -90 : 90) : mirrored ? 180 : 0;
  const arrowAt = tall ? { left: width - MARGIN - strip, top: photoTop + slot.height + stripGap } : { left: Math.round(width / 2 - strip / 2), top: photoTop + slot.height + stripGap };
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: readable(ink, [background], 4.5) },
    text({ position: "absolute", left: MARGIN, top: headlineTop, width: room, ...headingFont(data), letterSpacing: headline.spacing, display: "block", fontSize: headline.size, lineHeight: 1, lineClamp: headline.lines }, data.headline),
    ...shots.map(photoAt),
    ...shots.map(tag),
    box({ position: "absolute", ...arrowAt, width: strip, height: strip, borderRadius: 999, background: HIGHLIGHT, color: "#111111", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800, transform: arrowTurn ? `rotate(${arrowTurn}deg)` : "none" }, text({}, "→")),
    text({ position: "absolute", left: MARGIN, top: photosBottom + 30, width: room, fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, lineClamp: detail.lines }, data.detail),
    ...(tall && data.cta ? [button(data.cta, ink, onColour(ink), room, 40, { position: "absolute", left: MARGIN, top: photosBottom + 30 + detailHeight + 30 })] : []),
    box({ position: "absolute", left: 0, bottom: 0, width, height: footer, background: ink }),
    signature(data, width, onColour(ink), tall ? STORY_SAFE.bottom : MARGIN));
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

/** The share of the width the text keeps beside a cut-out person who is too tall for the text to stay below the head. */
const CUTOUT_TEXT = 0.44;

/** How far, as a share of the width, a cut-out's box may reach past the poster's edge (its sides are transparent). */
const CUTOUT_OVERHANG = 0.1;

/**
 * Where a cut-out person stands: on the bottom edge, right of centre (left of centre when `mirrored`). When the head can stay above the
 * text block (the person grows to at most 95 % of the height), `clear` is true and the text may run the full width below
 * the head; otherwise the person stands right of the text column, at most 80 % tall, and never reaches into it.
 */
export function cutoutPlacement(size: { width: number; height: number }, width: number, height: number, textTop: number, mirrored = false) {
  const aspect = size.width / Math.max(1, size.height);
  const needed = (height - textTop + 24) / (1 - HEAD_SHARE);
  const clear = needed <= Math.min(height * 0.95, (width * 0.66) / aspect);
  // At most two thirds of the width, so the whole face stays on the poster.
  const column = Math.round(width * CUTOUT_TEXT) + 80;
  const tall = Math.round(clear ? Math.min(Math.max(height * 0.6, needed), (width * 0.66) / aspect) : Math.min(height * 0.8, (width * 0.66) / aspect, (width * (1 + CUTOUT_OVERHANG) - column) / aspect));
  const wide = Math.round(tall * aspect);
  // Clear: centred at 74 % of the width, never further left than 40 %. Otherwise just right of the text column.
  const left = clear ? Math.max(Math.round(width * 0.4), Math.round(width * 0.74 - wide / 2)) : column;
  // Mirrored, the person stands bottom left and the text column is on the right.
  return { clear, left: mirrored ? width - left - wide : left, top: height - tall, width: wide, height: tall };
}

const CREAM = "#fdf3e6";
const GOLD = "#ffd27a";

/** The Portrait text block's sizes, from the nominal sizes down to half, so a long text shrinks before it reaches the photo. */
const PORTRAIT_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.5];

/** The Portrait text block at `step` of the nominal sizes: each part's fitted size and lines, and the height they add up to. */
function portraitBlock(data: PosterData, step: number, column: number, headlineRoom: number) {
  const scale = SCALE[data.textSize] * step;
  const lead = data.lead ? fitText({ text: data.lead, font: "black", room: column, max: Math.round(76 * scale), floor: 30, lineHeight: 1, maxLines: 2, tracking: TIGHT }) : null;
  const headline = fitText({ text: data.headline, font: "black", room: headlineRoom, max: Math.round(150 * scale), floor: 48, lineHeight: 0.98, maxLines: 2, tracking: TIGHT });
  const body = Math.max(22, Math.round(40 * scale));
  const detail = data.detail ? fitText({ text: data.detail, font: "semibold", room: column, max: body, floor: 22, lineHeight: 1.25, maxLines: 2 }) : null;
  const cta = data.cta ? fitText({ text: data.cta, font: "semibold", room: column, max: body, floor: 20, lineHeight: 1.25, maxLines: 1 }) : null;
  const badgeFont = badgeSize(data.badges, column, 29);
  // The headline's accent on a capital reaches into the line above, so a lead leaves room for it.
  const gap = lead ? accentRise("black", headline.size) : 6;
  const height = (lead ? lead.lines * lead.size : 0) + gap + headline.lines * headline.size * 0.98
    + (data.badges.length ? 18 + badgesHeight(data.badges, badgeFont, column) : 0)
    + (detail ? 28 + detail.lines * detail.size * 1.25 : 0) + (cta ? 14 + cta.size * 1.25 : 0);
  return { lead, headline, detail, cta, badgeFont, gap, height: Math.ceil(height) };
}

/** The largest text block (see `PORTRAIT_STEPS`) that is at most `room` pixels tall; the smallest when none is. */
const fitPortraitBlock = (data: PosterData, column: number, headlineRoom: number, room: number) => {
  const blocks = PORTRAIT_STEPS.map((step) => portraitBlock(data, step, column, headlineRoom));
  return blocks.find((block) => block.height <= room) ?? blocks[blocks.length - 1];
};

/**
 * The owner or a colleague on a drawn background in the salon's colour: a cut-out photo stands at the
 * bottom right, any other photo sits in an arch. Big two-level headline, wellness badges, short lines and the link.
 * The text block grows upwards from the footer and shrinks until it ends below the arch, or, beside a cut-out
 * person, until the face is clear of it.
 */
function portraitTemplate(data: PosterData, width: number, height: number): PosterNode {
  const mirrored = data.arrangement === "mirrored";
  /** An offset from the side where the text starts: the left edge, or the right edge when mirrored. */
  const side = (offset: number): Style => (mirrored ? { right: offset } : { left: offset });
  const column = Math.round(width * 0.58);
  // Stories keep text out of the app's own bars: 270 px at the top and 390 px at the bottom of 1920.
  const tall = isStory(width, height);
  const top = tall ? STORY_SAFE.top + 8 : 70;
  const safe = tall ? STORY_SAFE.bottom : MARGIN;
  const shadow = "0 3px 18px rgba(0,0,0,0.45)";
  const textBottom = height - (safe + 190);
  const name = fitText({ text: data.signature.salon, font: "serif", room: column - 64, max: 64, floor: 36, lineHeight: 1, maxLines: 2 });
  const belowName = top + Math.round(name.lines * name.size) + 24;
  const archTop = top + 30;
  const archWidth = width - column - 12;
  // A cut-out person: the text may run the full width when the head stays above it, and otherwise keeps to a narrower column.
  const size = data.cutout ? (pngSize(photoOf(data)) ?? { width: 3, height: 4 }) : null;
  const narrow = Math.round(width * CUTOUT_TEXT);
  // The full-width block ends below the name, and, with an arch, below the arch at its smallest.
  const wide = fitPortraitBlock(data, column, width - 128, textBottom - (size ? belowName : Math.max(belowName, archTop + Math.round(height * 0.24) + 24)));
  const placement = size ? cutoutPlacement(size, width, height, textBottom - wide.height, mirrored) : null;
  const block = placement && !placement.clear ? fitPortraitBlock(data, narrow, narrow, textBottom - belowName) : wide;
  const blockColumn = placement && !placement.clear ? narrow : column;
  const headlineRoom = placement && !placement.clear ? narrow : width - 128;
  // The arch ends above the text block, so the headline never runs across a face.
  const archHeight = Math.min(Math.round(height * (tall ? 0.36 : 0.34)), textBottom - block.height - 24 - archTop);
  const person = placement
    ? image(photoOf(data), { position: "absolute", left: placement.left, top: placement.top, width: placement.width, height: placement.height, objectFit: "cover", objectPosition: "50% 0%" })
    : image(photoOf(data), { position: "absolute", ...(mirrored ? { left: 0 } : { left: column + 12 }), top: archTop, width: archWidth, height: archHeight, objectFit: "cover", objectPosition: CROP[data.focus], borderRadius: mirrored ? `0 ${(width - column) / 2}px ${(width - column) / 2}px 0` : `${(width - column) / 2}px 0 0 ${(width - column) / 2}px`, border: `8px solid ${GOLD}`, ...(mirrored ? { borderLeft: "none" } : { borderRight: "none" }) });
  const { lead, headline, detail, cta } = block;
  // Beside a cut-out person the footer line keeps to the text column too, clear of the head.
  // The QR code then moves to the text side, so it never lies in the head zone of the person's box; the footer line follows it.
  const qrOnText = Boolean(placement && !placement.clear);
  const qrShift = data.signature.qr && qrOnText ? 174 : 0;
  const footerRoom = (qrOnText ? narrow : width - 128 - 180) - qrShift;
  // The link and phone shrink a little (36 to 26 px) before anything is cut, so a narrow column still shows the whole number.
  const footerLine = [data.signature.link, data.signature.phone].filter(Boolean).join("  ·  ");
  const footerSize = Math.max(26, fitText({ text: footerLine, font: "extrabold", room: footerRoom, max: 36, floor: 26, lineHeight: 1.2, maxLines: 1, oneLine: true }).size);
  return box({ width, height, position: "relative", fontFamily: "Inter", color: CREAM },
    svgImage(backdropSvg(data.backdrop, width, height, data.colors.accent), { position: "absolute", left: 0, top: 0, width, height }),
    person,
    // Dark scrims behind the text, strongest on the side of the lines (left, or right when mirrored), so light text stays readable
    // over the photo and the art while the person on the other side keeps their colour.
    box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(to ${mirrored ? "left" : "right"}, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)` }),
    box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) ${Math.round(((safe + 190) / height) * 100)}%, rgba(0,0,0,0) 60%)` }),
    text({ position: "absolute", ...side(MARGIN), top, maxWidth: column - 64, fontFamily: "Caladea", fontSize: name.size, lineHeight: 1, textShadow: shadow, lineClamp: name.lines }, data.signature.salon),
    // The text block grows upwards from the footer, so short and long texts both end in the same place.
    box({ position: "absolute", left: MARGIN, bottom: safe + 190, width: width - 128, flexDirection: "column", textShadow: shadow, ...(mirrored && { alignItems: "flex-end", textAlign: "right" }) },
      ...(lead ? [text({ fontFamily: "Inter Display", fontWeight: 900, fontSize: lead.size, letterSpacing: lead.spacing, lineHeight: 1, maxWidth: blockColumn, lineClamp: lead.lines, ...(mirrored && { marginRight: 2 }) }, data.lead)] : []),
      text({ display: "block", fontFamily: "Inter Display", fontWeight: 900, fontSize: headline.size, letterSpacing: headline.spacing, lineHeight: 0.98, marginTop: block.gap, lineClamp: headline.lines, maxWidth: headlineRoom, ...(mirrored && { marginRight: 4 }) }, data.headline),
      ...(data.badges.length ? [badgeRow(data.badges, CREAM, block.badgeFont, { marginTop: 18, maxWidth: blockColumn, ...(mirrored && { justifyContent: "flex-end" }) })] : []),
      ...(detail ? [text({ display: "block", fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, marginTop: 28, maxWidth: blockColumn, lineClamp: detail.lines }, data.detail)] : []),
      ...(cta ? [text({ display: "block", fontSize: cta.size, fontWeight: 600, lineHeight: 1.25, color: GOLD, marginTop: 14, maxWidth: blockColumn, lineClamp: 1 }, data.cta)] : [])),
    box({ position: "absolute", ...side(MARGIN + qrShift), bottom: safe + 104, width: qrOnText ? narrow - qrShift : width - 128 - (data.signature.qr ? 170 : 0), height: 2, background: CREAM, opacity: 0.4 }),
    text({ display: "block", position: "absolute", ...side(MARGIN + qrShift), bottom: safe + 40, maxWidth: footerRoom, fontSize: footerSize, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: shadow }, footerLine),
    ...(data.signature.qr ? [box({ position: "absolute", ...(mirrored !== qrOnText ? { left: MARGIN } : { right: MARGIN }), bottom: safe }, qrCode(data.signature.qr, 150))] : []));
}

const QR_SMALL = 120;

/**
 * One small line of two parts, `name` and `link`, that stays on one row, with the QR code at its end when there is one.
 * The link keeps its width as far as the room allows; the name gives way first (keeping up to 40 % of the room), and both end in
 * an ellipsis when cut. The pixel budgets come from the real font widths.
 */
const smallLine = (name: string, link: string, qr: string | undefined, width: number, colourOn: string, style: Style = {}) => {
  const part = { fontSize: 32, fontWeight: 700, color: colourOn, whiteSpace: "nowrap" } as const;
  const cut = { ...part, display: "block", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const room = width - (qr ? QR_SMALL + 32 : 0);
  const separator = name && link ? Math.ceil(textWidth("  ·  ", "extrabold", 32)) : 0;
  const nameWidth = name ? Math.ceil(textWidth(name, "extrabold", 32)) : 0;
  const linkWidth = link ? Math.ceil(textWidth(link, "extrabold", 32)) : 0;
  const cutName = nameWidth + separator + linkWidth > room;
  const linkBudget = Math.min(linkWidth, room - separator - Math.min(nameWidth, Math.round(room * 0.4)));
  const nameBudget = Math.min(nameWidth, room - separator - linkBudget);
  return box({ width, alignItems: "flex-end", justifyContent: "space-between", ...style },
    box({ maxWidth: room },
      ...(name ? [text({ ...cut, ...(cutName && { width: nameBudget }) }, name)] : []),
      ...(name && link ? [text({ ...part, whiteSpace: "pre" }, "  ·  ")] : []),
      ...(link ? [text({ ...cut, ...(cutName && { width: linkBudget }) }, link)] : [])),
    ...(qr ? [qrCode(qr, QR_SMALL)] : []));
};

/** The photo over the whole poster under a dark scrim: a big headline, one line, a booking pill and one small contact line. */
function fullPhotoTemplate(data: PosterData, width: number, height: number): PosterNode {
  const scale = SCALE[data.textSize];
  const tall = isStory(width, height);
  const room = width - 128;
  const shadow = "0 3px 18px rgba(0,0,0,0.45)";
  const mirrored = data.arrangement === "mirrored";
  const bottom = tall ? STORY_SAFE.bottom + 40 : MARGIN;
  const top = tall ? STORY_SAFE.top + 20 : MARGIN;
  const lineSize = Math.round(44 * scale);
  const line = data.price || data.detail;
  // The block's parts, from the salon's chip to the contact row (as tall as the QR code when there is one).
  const chip = 62 + 24;
  const contactRow = data.signature.qr ? QR_SMALL : 40;
  const fixed = chip + 32 + contactRow + (data.cta ? 36 + 88 : 0) + (line ? 24 + Math.round(lineSize * 1.25) : 0);
  // The text block stays within the poster's margins, and, mirrored, within the top 62 % that its panel may take.
  const maxBlock = mirrored ? Math.round(height * 0.62) - top - 48 : height - bottom - top;
  const { size, lines, spacing } = fitText({ text: data.headline, font: "black", room, max: Math.round(150 * scale), floor: Math.round(72 * scale), lineHeight: 0.98, maxLines: 2, maxHeight: maxBlock - fixed, tracking: TIGHT });
  const blockHeight = fixed + Math.round(size * 0.98 * lines);
  const blockTop = height - bottom - blockHeight;
  // The text block's height tells where the scrim has to start (or, mirrored, end): strong over the whole block.
  const percent = (y: number) => Math.max(0, Math.round((y / height) * 100));
  const scrim = `linear-gradient(to bottom, rgba(0,0,0,0) ${percent(blockTop - height * 0.12)}%, rgba(0,0,0,0.8) ${percent(blockTop)}%, rgba(0,0,0,0.9) 100%)`;
  // Mirrored, the text sits on its own dark panel at the top and the photo starts below it: text at the top of a photo
  // would cross a face in most portraits, so it never lies over the photo there.
  const panel = top + blockHeight + 48;
  return box({ width, height, position: "relative", fontFamily: "Inter", color: WHITE },
    ...(mirrored
      ? [box({ position: "absolute", left: 0, top: 0, width, height: panel, background: mixColour(data.colors.accent, "#000000", 0.72) }),
        image(photoOf(data), { position: "absolute", left: 0, top: panel, width, height: height - panel, objectFit: "cover", objectPosition: CROP[data.focus] })]
      : [image(photoOf(data), { position: "absolute", left: 0, top: 0, width, height, objectFit: "cover", objectPosition: CROP[data.focus] }),
        box({ position: "absolute", left: 0, top: 0, width, height, backgroundImage: scrim })]),
    box({ position: "absolute", left: MARGIN, ...(mirrored ? { top } : { bottom }), width: room, flexDirection: "column", alignItems: "flex-start", textShadow: shadow },
      // The salon's name rides on the text block, never over the photo.
      box({ maxWidth: room - 52, background: "rgba(255,255,255,0.82)", padding: "12px 26px", borderRadius: 999, marginBottom: 24, textShadow: "none" },
        text({ display: "block", color: "#111111", fontFamily: "Caladea", fontSize: 38, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, data.signature.salon)),
      text({ display: "block", width: room, fontFamily: "Inter Display", fontWeight: 900, letterSpacing: spacing, fontSize: size, lineHeight: 0.98, lineClamp: lines }, data.headline),
      ...(line ? [text({ display: "block", width: room, fontSize: lineSize, fontWeight: 700, lineHeight: 1.25, marginTop: 24, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, line)] : []),
      ...(data.cta ? [button(data.cta, WHITE, "#111111", room, 40, { marginTop: 36, textShadow: "none" })] : []),
      smallLine(data.signature.phone, data.signature.link, data.signature.qr, room, WHITE, { marginTop: 32 })));
}

/** Only words: a very large headline, the detail, a thin accent rule and the call to book, on the salon's background colour. */
function typographyTemplate(data: PosterData, width: number, height: number): PosterNode {
  const { accent, ink, background } = data.colors;
  const scale = SCALE[data.textSize];
  const room = width - 128;
  // The owner's ink when it reads on the background, otherwise the nearest colour that does.
  const readableInk = readable(ink, [background], 4.5);
  const face = headingFace(data);
  const columnHeight = height - 128 - 120;
  const detail = fitText({ text: data.detail, font: "semibold", room, max: Math.round(46 * scale), floor: 30, lineHeight: 1.25, maxLines: 3 });
  const rest = (data.detail ? 44 + Math.round(detail.lines * detail.size * 1.25) : 0) + 8 + 52 + (data.cta ? 52 + 88 : 0);
  const { size, lines, spacing } = fitText({ text: data.headline, font: face.font, room, max: Math.round(230 * scale), floor: Math.round(96 * scale), lineHeight: 0.98, maxLines: 3, maxHeight: columnHeight - rest - accentRise(face.font, Math.round(230 * scale)), tracking: face.tracking });
  const rise = accentRise(face.font, size);
  return box({ width, height, position: "relative", background, fontFamily: "Inter", color: readableInk },
    box({ position: "absolute", left: MARGIN, top: MARGIN + rise, width: room, height: columnHeight - rise, flexDirection: "column", justifyContent: "center", alignItems: "flex-start" },
      text({ display: "block", width: room, ...headingFont(data), letterSpacing: spacing, fontSize: size, lineHeight: 0.98, lineClamp: lines }, data.headline),
      ...(data.detail ? [text({ display: "block", width: room, fontSize: detail.size, fontWeight: 600, lineHeight: 1.25, marginTop: 44, lineClamp: detail.lines }, data.detail)] : []),
      box({ width: 160, height: 8, background: accent, marginTop: 52 }),
      ...(data.cta ? [button(data.cta, accent, onColour(accent), room, 40, { marginTop: 52 })] : [])),
    smallLine(data.signature.salon, data.signature.link, data.signature.qr, room, readableInk, { position: "absolute", left: MARGIN, bottom: MARGIN }));
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
