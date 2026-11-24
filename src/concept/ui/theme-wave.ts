// The studio's theme wave: the new theme washes over the page from right to
// left behind a soft, wavy edge that starts at the toggle. It is a View
// Transition whose new snapshot is masked by an SVG and the mask slides across
// (studio.css). Only mask-position animates, so the SVG is drawn once per switch.
// Without View Transitions the swap is instant; reduced motion gets a short fade.

export interface Point { x: number; y: number }

export interface Wave {
  /** The mask as a CSS url(). */
  image: string;
  /** mask-position at the start (the edge at the origin) and the end (the edge past the left side). */
  from: string;
  to: string;
}

const STEPS = 40;
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A mask for a viewport of `width` × `height`: opaque to the right of a liquid edge, clear to its left.
 * The edge leans out furthest at the origin's height, so the wave starts at the toggle and spreads from there,
 * with a gentle ripple along it. The image is one ripple taller than the viewport and drifts down by that much
 * while it crosses, which makes the edge flow rather than slide.
 */
export function wave(width: number, height: number, origin: Point): Wave {
  const band = Math.min(200, Math.max(56, width * 0.16));
  const length = Math.min(420, Math.max(220, height * 0.42));
  const ripple = band * 0.2;
  const lean = band * 0.75;
  const centre = origin.y + length;
  const spread = Math.max(height, 320) * 0.55;
  const edge = (y: number) =>
    lean * (1 - Math.exp(-(((y - centre) / spread) ** 2))) + ripple * (0.5 + 0.5 * Math.sin((2 * Math.PI * y) / length));
  const w = Math.ceil(width + 2 * band);
  const h = Math.ceil(height + length);
  const points = Array.from({ length: STEPS + 1 }, (_, i) => ({ x: edge((h * i) / STEPS), y: (h * i) / STEPS }));
  // A smooth curve through the points: each point is a control point and the midpoints are the anchors.
  let d = `M${w} 0L${round(points[0].x)} 0`;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    d += `Q${round(a.x)} ${round(a.y)} ${round((a.x + b.x) / 2)} ${round((a.y + b.y) / 2)}`;
  }
  d += `L${round(points[STEPS].x)} ${h}L${w} ${h}Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="${d}"/></svg>`;
  return {
    image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    from: `${round(origin.x - edge(centre))}px ${-length}px`,
    to: `${-Math.ceil(lean + ripple + 1)}px 0px`,
  };
}

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

let current = 0;

/** Runs `apply` (which changes the theme) behind the wave from `origin`, a fade under reduced motion, or at once. */
export function waveTheme(apply: () => void, origin: Point) {
  const doc = document as TransitionDocument;
  if (!doc.startViewTransition) return apply();
  const root = doc.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const id = ++current;
  if (reduce) {
    root.dataset.themeTransition = "fade";
  } else {
    const { image, from, to } = wave(window.innerWidth, window.innerHeight, origin);
    root.style.setProperty("--theme-wave", image);
    root.style.setProperty("--theme-wave-from", from);
    root.style.setProperty("--theme-wave-to", to);
    root.dataset.themeTransition = "wave";
  }
  doc.startViewTransition(apply).finished.finally(() => {
    // A second tap skips the first transition; only the latest one cleans up.
    if (id !== current) return;
    delete root.dataset.themeTransition;
    for (const name of ["--theme-wave", "--theme-wave-from", "--theme-wave-to"]) root.style.removeProperty(name);
  });
}
