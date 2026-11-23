// Decorative backgrounds for the Portrait poster, drawn as SVG in the salon's
// accent colour. No people, no stock or AI images: they are free to use, follow
// the salon's colours and stay sharp at every size.

export const BACKDROPS = ["bloom", "leaves", "waves", "sun", "plain"] as const;
export type Backdrop = (typeof BACKDROPS)[number];

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
/** `a` moved `amount` (0–1) of the way towards `b`. */
export const mix = (a: string, b: string, amount: number) =>
  `#${[0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount).toString(16).padStart(2, "0")).join("")}`;

const WARM = "#f6a723";

/** A flower of two petal rings (the inner one lighter and offset half a petal), with a centre. */
function flower(cx: number, cy: number, radius: number, petals: number, fill: string, centre: string, turn = 0) {
  const ring = (r: number, colour: string, offset: number, opacity: number) => Array.from({ length: petals }, (_, i) =>
    `<path d="M${cx} ${cy} C ${cx - r * 0.42} ${cy - r * 0.35}, ${cx - r * 0.3} ${cy - r * 0.95}, ${cx} ${cy - r} C ${cx + r * 0.3} ${cy - r * 0.95}, ${cx + r * 0.42} ${cy - r * 0.35}, ${cx} ${cy}Z" fill="${colour}" opacity="${opacity}" transform="rotate(${turn + offset + (360 / petals) * i} ${cx} ${cy})"/>`).join("");
  const veins = Array.from({ length: petals }, (_, i) =>
    `<path d="M${cx} ${cy - radius * 0.2} L${cx} ${cy - radius * 0.85}" stroke="${centre}" stroke-width="${radius * 0.012}" opacity="0.35" transform="rotate(${turn + (360 / petals) * i} ${cx} ${cy})"/>`).join("");
  return ring(radius, fill, 0, 1) + veins + ring(radius * 0.62, mix(fill, "#ffffff", 0.22), 180 / petals, 0.9)
    + `<circle cx="${cx}" cy="${cy}" r="${radius * 0.14}" fill="${centre}"/><circle cx="${cx}" cy="${cy}" r="${radius * 0.08}" fill="${mix(centre, "#000000", 0.3)}"/>`;
}

function leaf(x: number, y: number, size: number, angle: number, fill: string) {
  return `<path d="M0 0 C ${size * 0.45} ${-size * 0.35}, ${size * 0.85} ${-size * 0.2}, ${size} 0 C ${size * 0.85} ${size * 0.2}, ${size * 0.45} ${size * 0.35}, 0 0Z" fill="${fill}" transform="translate(${x} ${y}) rotate(${angle})"/>`
    + `<path d="M0 0 L${size * 0.95} 0" stroke="${mix(fill, "#000000", 0.25)}" stroke-width="${size * 0.012}" transform="translate(${x} ${y}) rotate(${angle})"/>`;
}

/** The background as an SVG document of `width` × `height`, on a deep shade of the accent colour. */
export function backdropSvg(kind: Backdrop, width: number, height: number, accent: string): string {
  const deep = mix(accent, "#000000", 0.62);
  const deeper = mix(accent, "#000000", 0.75);
  const light = mix(accent, "#ffffff", 0.35);
  let art = "";
  if (kind === "bloom") {
    art = flower(width * 0.86, height * 0.12, width * 0.6, 9, mix(WARM, accent, 0.12), mix(WARM, "#a33a00", 0.55), 8)
      + `<g opacity="0.35">${flower(width * 0.02, height * 0.42, width * 0.16, 7, light, deeper, 20)}</g>`;
  } else if (kind === "leaves") {
    const leaves: [number, number, number, number][] = [[0.7, 0.04, 0.55, 140], [0.95, 0.22, 0.45, 200], [0.62, 0.3, 0.38, 115], [0.88, 0.5, 0.42, 165], [-0.05, 0.86, 0.4, -30], [0.1, 1.02, 0.35, -60]];
    art = leaves.map(([x, y, size, angle], i) => leaf(x * width, y * height, size * width, angle, i % 2 ? light : mix(accent, "#3d8a4f", 0.45))).join("");
  } else if (kind === "waves") {
    art = [0.55, 0.68, 0.8].map((top, i) => {
      const y = top * height;
      return `<path d="M0 ${y} C ${width * 0.3} ${y - 120}, ${width * 0.6} ${y + 120}, ${width} ${y - 40} V${height} H0Z" fill="${mix(accent, "#ffffff", 0.1 + i * 0.12)}" opacity="${0.35 + i * 0.15}"/>`;
    }).join("");
  } else if (kind === "sun") {
    const cx = width * 0.82, cy = height * 0.16, r = width * 0.26;
    const rays = Array.from({ length: 16 }, (_, i) =>
      `<path d="M${cx} ${cy - r * 1.25} L${cx - r * 0.09} ${cy - r * 1.9} L${cx + r * 0.09} ${cy - r * 1.9}Z" fill="${WARM}" opacity="0.8" transform="rotate(${i * 22.5} ${cx} ${cy})"/>`).join("");
    art = `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${WARM}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="${mix(WARM, "#ffffff", 0.25)}"/>`;
  }
  // "plain" draws nothing on the gradient: a calm background when the photo should carry the poster.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="${deeper}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>${art}</svg>`;
}
