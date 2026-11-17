import { toHex, type Rgb } from "./colour";

// The colours of a logo: what the assistant uses for "use the colours from
// our logo". Works on raw RGBA pixels, so it runs the same in tests.

const MIN_SATURATION = 40;
const MIN_DISTANCE = 70;

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Up to `count` distinct, saturated colours, the most common first. Transparent, near-white, near-black and grey pixels are ignored. */
export function dominantColours(pixels: ArrayLike<number>, count = 3): string[] {
  const buckets = new Map<number, { n: number; sum: Rgb }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (a < 128 || spread < MIN_SATURATION || Math.max(r, g, b) < 40 || Math.min(r, g, b) > 235) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] as Rgb };
    bucket.n++;
    bucket.sum = [bucket.sum[0] + r, bucket.sum[1] + g, bucket.sum[2] + b];
    buckets.set(key, bucket);
  }
  const picked: Rgb[] = [];
  for (const { n, sum } of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const colour: Rgb = [sum[0] / n, sum[1] / n, sum[2] / n];
    if (picked.every((other) => distance(other, colour) >= MIN_DISTANCE)) picked.push(colour);
    if (picked.length === count) break;
  }
  return picked.map(toHex);
}
