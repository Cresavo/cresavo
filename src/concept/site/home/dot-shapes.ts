import type { DotOptions } from "./dot-engine";

// The shapes the homepage draws in dots. Sources paint black for the main
// colour and red for the accent on the offscreen canvas; the engine samples
// the alpha and turns red pixels into accent dots.

const INK = "#000";
const ACCENT = "#f00";
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** The GitHub mark (Octicons, 16 × 16), drawn in dots and as the fallback icon. */
export const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

/** The wordmark's viewBox in ui/wordmark.tsx; its paths are read from the rendered fallback. */
const WORDMARK_BOX = { x: 62, y: -1081, w: 6992, h: 1107 };

type Shape = Omit<DotOptions, "palette">;

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};
const line = (g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
};
const pen = (g: CanvasRenderingContext2D, s: number) => {
  g.lineWidth = s * 0.075;
  g.strokeStyle = g.fillStyle = INK;
  g.lineCap = "round";
};

/** The moment icons, each drawn in a square of side s. */
const ICONS = {
  /** A booking page: three treatment rows, the chosen one in the accent. */
  list(g: CanvasRenderingContext2D, s: number) {
    pen(g, s);
    rr(g, s * 0.1, s * 0.12, s * 0.8, s * 0.76, s * 0.1);
    g.stroke();
    for (let r = 0; r < 3; r++) {
      const y = s * (0.32 + r * 0.18);
      g.fillStyle = g.strokeStyle = r === 1 ? ACCENT : INK;
      g.beginPath();
      g.arc(s * 0.27, y, s * 0.045, 0, Math.PI * 2);
      g.fill();
      line(g, s * 0.39, y, s * (r === 1 ? 0.58 : 0.72), y);
    }
  },
  cal(g: CanvasRenderingContext2D, s: number) {
    pen(g, s);
    rr(g, s * 0.14, s * 0.2, s * 0.72, s * 0.66, s * 0.1);
    g.stroke();
    g.fillRect(s * 0.14, s * 0.2, s * 0.72, s * 0.15);
    line(g, s * 0.34, s * 0.1, s * 0.34, s * 0.26);
    line(g, s * 0.66, s * 0.1, s * 0.66, s * 0.26);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      g.fillStyle = r === 1 && c === 1 ? ACCENT : INK;
      g.fillRect(s * (0.25 + c * 0.18), s * (0.47 + r * 0.17), s * 0.12, s * 0.1);
    }
  },
  phone(g: CanvasRenderingContext2D, s: number) {
    pen(g, s);
    rr(g, s * 0.24, s * 0.1, s * 0.38, s * 0.8, s * 0.09);
    g.stroke();
    line(g, s * 0.37, s * 0.2, s * 0.49, s * 0.2);
    g.beginPath();
    g.arc(s * 0.43, s * 0.78, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ACCENT;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(s * 0.6, s * 0.32, s * 0.17, -1.05, 0.25);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.6, s * 0.32, s * 0.29, -1.0, 0.2);
    g.stroke();
  },
  client(g: CanvasRenderingContext2D, s: number) {
    pen(g, s);
    rr(g, s * 0.08, s * 0.2, s * 0.84, s * 0.6, s * 0.09);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.32, s * 0.42, s * 0.085, 0, Math.PI * 2);
    g.fill();
    g.save();
    rr(g, s * 0.08, s * 0.2, s * 0.84, s * 0.6, s * 0.09);
    g.clip();
    g.beginPath();
    g.arc(s * 0.32, s * 0.7, s * 0.15, Math.PI, 0);
    g.fill();
    g.restore();
    line(g, s * 0.55, s * 0.4, s * 0.8, s * 0.4);
    g.strokeStyle = ACCENT;
    line(g, s * 0.55, s * 0.52, s * 0.72, s * 0.52);
    g.strokeStyle = INK;
    line(g, s * 0.55, s * 0.64, s * 0.76, s * 0.64);
  },
};

export type IconName = keyof typeof ICONS;

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

/** A moment icon that gathers from its centre as its row scrolls in. */
export function iconShape(name: IconName): Shape {
  return {
    intro: 1300, startAt: 0.6, maxMobile: 400, maxDesktop: 600, dotSize: 0.36,
    spacing: (w) => (w < 100 ? 3.7 : 4.2),
    hover: (w) => w * 0.45,
    order: (x, y, w, h) => Math.hypot(x - w / 2, y - h / 2) / (w * 0.7),
    source(g, w, h) {
      const s = Math.min(w, h);
      g.translate((w - s) / 2, (h - s) / 2);
      ICONS[name](g, s);
    },
  };
}

/** The GitHub mark, in the main colour with a sprinkle of ink and accent dots. */
export function githubShape(): Shape {
  return {
    intro: 1100, startAt: 0.55, maxMobile: 220, maxDesktop: 280, dotSize: 0.34,
    spacing: (w) => (w < 70 ? 3.4 : 3.8),
    hover: (w) => clamp(w * 0.4, 28, 56),
    order: (x, y, w) => Math.hypot(x - w / 2, y - w / 2) / (w / 2),
    tint: () => { const r = Math.random(); return r < 0.05 ? 1 : r < 0.3 ? 2 : 0; },
    radiusAt: (x, y, r, w, h) => r * (0.85 + 0.35 * (1 - Math.hypot(x - w / 2, y - h / 2) / (w / 2)) + Math.random() * 0.12),
    source(g, w, h) {
      const size = Math.min(w, h) * 0.92, sc = size / 16;
      g.translate((w - size) / 2, (h - size) / 2);
      g.scale(sc, sc);
      g.fillStyle = INK;
      g.fill(new Path2D(GITHUB_MARK));
    },
  };
}
