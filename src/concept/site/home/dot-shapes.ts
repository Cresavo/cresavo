import type { DotOptions } from "./dot-engine";

// The shape the homepage draws in dots: the hero wordmark. The source paints
// black on an offscreen canvas; the engine samples its alpha.

const INK = "#000";
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** The wordmark's viewBox in ui/wordmark.tsx; its paths are read from the rendered fallback. */
const WORDMARK_BOX = { x: 62, y: -1081, w: 6992, h: 1107 };

type Shape = Omit<DotOptions, "palette">;

/** The hero wordmark, drawn from the paths of the fallback wordmark inside the stage. */
export function wordmarkShape(stage: HTMLElement): Shape {
  const paths = [...stage.querySelectorAll("svg path")].map((p) => new Path2D(p.getAttribute("d") ?? ""));
  return {
    intro: 1700, far: true, startAt: 0.2, maxMobile: 700, maxDesktop: 2200, dotSize: 0.36, breathe: true,
    spacing: (w) => (w < 600 ? 2.4 : 3.2),
    hover: (w) => (w < 600 ? 70 : clamp(w * 0.1, 120, 160)),
    source(g, w, h) {
      const fit = w < 600 ? 0.88 : 0.82;
      const ww = Math.min(w * fit, 1120, (h * 0.86 * WORDMARK_BOX.w) / WORDMARK_BOX.h);
      const scale = ww / WORDMARK_BOX.w;
      g.translate((w - ww) / 2, (h - WORDMARK_BOX.h * scale) / 2);
      g.scale(scale, scale);
      g.translate(-WORDMARK_BOX.x, -WORDMARK_BOX.y);
      g.fillStyle = INK;
      paths.forEach((p) => g.fill(p));
    },
  };
}
