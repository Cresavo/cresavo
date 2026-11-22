import type { PosterTone } from "../../data/types";

/** The most the owner can move each slider, in percent, either way. */
export const TONE_RANGE: Record<keyof PosterTone, number> = { light: 15, contrast: 10, warmth: 10 };

export const NEUTRAL_TONE: PosterTone = { light: 0, contrast: 0, warmth: 0 };

const clamp = (value: number, max: number) => Math.min(max, Math.max(-max, Number.isFinite(value) ? value : 0));

/** A tone with every value inside its range. */
export const clampTone = (tone: PosterTone): PosterTone => ({
  light: clamp(tone.light, TONE_RANGE.light),
  contrast: clamp(tone.contrast, TONE_RANGE.contrast),
  warmth: clamp(tone.warmth, TONE_RANGE.warmth),
});

export const isNeutralTone = (tone: PosterTone | undefined) => !tone || (tone.light === 0 && tone.contrast === 0 && tone.warmth === 0);

/** Part of a cache key: identical for every neutral tone. */
export const toneKey = (tone: PosterTone | undefined) => (tone && !isNeutralTone(tone) ? `${tone.light},${tone.contrast},${tone.warmth}` : "");

/** The canvas filter for light and contrast, or "none". */
export function toneFilter(tone: PosterTone | undefined): string {
  if (!tone || isNeutralTone(tone)) return "none";
  const { light, contrast } = clampTone(tone);
  return `brightness(${100 + light}%) contrast(${100 + contrast}%)`;
}

/** Warmth in place on RGBA pixels: positive raises red and lowers blue by that percent, negative the other way. */
export function applyWarmth(pixels: Uint8ClampedArray, warmth: number): void {
  const amount = clamp(warmth, TONE_RANGE.warmth) / 100;
  if (amount === 0) return;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i] * (1 + amount);
    pixels[i + 2] = pixels[i + 2] * (1 - amount);
  }
}
