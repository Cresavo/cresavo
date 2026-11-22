// The homepage's dot engine, ported from the landing design's shared dot field.
// A shape is drawn on an offscreen canvas and sampled into dots, which gather
// into the shape when it first scrolls into view. The canvas is padded beyond
// its host and fades softly at every edge, so no rectangle ever shows. Sizes
// come from the host element, never from the canvas itself, so the canvas
// cannot grow in a loop. Fields pause off screen, the frame loop sleeps once
// everything is settled, and reduced motion shows the finished shape at once.

export type DotSource = (g: CanvasRenderingContext2D, width: number, height: number) => void;

export interface DotOptions {
  source: DotSource;
  /** The dot colours, read when the field is built and again on retint. Index 1 is the accent. */
  palette: () => string[];
  spacing: (width: number) => number;
  maxMobile: number;
  maxDesktop: number;
  intro?: number;
  dotSize?: number;
  startAt?: number;
  /** Gather from far around the centre instead of a loose cloud around each dot. */
  far?: boolean;
  /** Slow swell, at most 3.5 % of a dot's radius, while the shape is on screen. */
  breathe?: boolean;
  /** The radius around a mouse pointer that pushes dots aside; none when absent. */
  hover?: (width: number) => number;
  order?: (x: number, y: number, w: number, h: number) => number;
  tint?: (accent: boolean) => number;
  radiusAt?: (x: number, y: number, r: number, w: number, h: number) => number;
}

export interface DotField {
  retint(): void;
  destroy(): void;
}

interface Running {
  visible: boolean;
  awake: boolean;
  lazy: boolean;
  lastDraw: number;
  step(): void;
  draw(): void;
  calm(): void;
  pointer(x: number, y: number): void;
  leave(): void;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const TAU = Math.PI * 2;

const fields = new Set<Running>();
const sprites = new Map<string, HTMLCanvasElement>();
let raf = 0;
let last = 0;
let motion: MediaQueryList | null = null;

const reduced = () => motion?.matches ?? false;

/** One pre-rendered dot per colour: drawImage is far cheaper than arc(). */
function sprite(color: string) {
  let dot = sprites.get(color);
  if (!dot) {
    dot = document.createElement("canvas");
    dot.width = dot.height = 64;
    const g = dot.getContext("2d");
    if (g) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(32, 32, 31, 0, TAU);
      g.fill();
    }
    sprites.set(color, dot);
  }
  return dot;
}

function loop(now: number) {
  raf = 0;
  const steps = clamp(Math.round((now - last) / 16.67), 1, 3);
  last = now;
  let busy = false;
  let budget = matchMedia("(pointer: coarse)").matches ? 2 : 3;
  for (const f of fields) {
    if (!f.visible || !f.awake) continue;
    if (budget-- <= 0) { busy = true; continue; }
    if (f.lazy && now - f.lastDraw < 32) { busy = true; continue; }
    for (let s = 0; s < steps; s++) f.step();
    f.draw();
    if (f.awake) busy = true;
  }
  if (busy) raf = requestAnimationFrame(loop);
}

function wake() {
  if (!raf && !reduced()) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

const onMotion = () => {
  if (reduced()) {
    cancelAnimationFrame(raf);
    raf = 0;
    fields.forEach((f) => f.calm());
  } else {
    fields.forEach((f) => { if (f.visible) f.awake = true; });
    wake();
  }
};
const onPointer = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return;
  fields.forEach((f) => { if (f.visible) f.pointer(e.clientX, e.clientY); });
  wake();
};
const onLeave = () => { fields.forEach((f) => f.leave()); wake(); };

/** The shared listeners live only while at least one field does. */
function track(f: Running) {
  if (!fields.size) {
    motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", onMotion);
    addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
  }
  fields.add(f);
}

function untrack(f: Running) {
  fields.delete(f);
  if (fields.size) return;
  motion?.removeEventListener("change", onMotion);
  removeEventListener("pointermove", onPointer);
  document.documentElement.removeEventListener("mouseleave", onLeave);
  cancelAnimationFrame(raf);
  raf = 0;
}

/** Draws the shape on `canvas`, sized from `box`. Returns null when the canvas cannot be drawn on. */
export function createDotField(canvas: HTMLCanvasElement, box: HTMLElement, o: DotOptions): DotField | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (!fields.size) motion = matchMedia("(prefers-reduced-motion: reduce)");
  let spr = o.palette().map(sprite);
  let W = 0, H = 0, cW = 0, cH = 0, pad = 0, fade = 0, dpr = 1, n = 0, el = 0;
  let introDone = reduced(), started = false;
  let hx = new Float32Array(0), hy = hx, sx = hx, sy = hx, del = hx, rad = hx;
  let dx = hx, dy = hx, vx = hx, vy = hx, sw = hx;
  let col = new Uint8Array(0);
  const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, s: 0, ts: 0 };
  const introSteps = (o.intro ?? 1200) / 16.67;

  const measure = () => {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height || r.width > 2400 || r.height > 2400) return false;
    cW = r.width;
    cH = r.height;
    pad = Math.round(Math.min(40, Math.max(20, Math.min(cW, cH) * 0.28)));
    fade = Math.max(pad, 24);
    W = cW + pad * 2;
    H = cH + pad * 2;
    return true;
  };

  const sample = () => {
    const max = innerWidth < 700 ? o.maxMobile : o.maxDesktop;
    const S = 2;
    const off = document.createElement("canvas");
    const ow = (off.width = Math.ceil(W * S));
    off.height = Math.ceil(H * S);
    const g = off.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.scale(S, S);
    g.translate(pad, pad);
    o.source(g, cW, cH);
    const data = g.getImageData(0, 0, off.width, off.height).data;
    let gap = o.spacing(W);
    let pts: [number, number, boolean][] = [];
    for (let pass = 0; pass < 4; pass++) {
      pts = [];
      const rowH = gap * 0.866;
      for (let y = gap / 2, row = 0; y < H; y += rowH, row++) {
        for (let x = gap / 2 + (row % 2 ? gap / 2 : 0); x < W; x += gap) {
          const k = (((y * S) | 0) * ow + ((x * S) | 0)) * 4;
          if (data[k + 3] > 128) pts.push([x, y, data[k] > 160 && data[k + 1] < 90]);
        }
      }
      if (pts.length <= max) break;
      gap *= Math.sqrt(pts.length / max) * 1.02;
    }
    return { pts, gap };
  };

  const build = () => {
    if (!measure()) return false;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    Object.assign(canvas.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${W}px`, height: `${H}px` });
    const res = sample();
    if (!res) return false;
    n = res.pts.length;
    [hx, hy, sx, sy, del, rad, dx, dy, vx, vy, sw] = Array.from({ length: 11 }, () => new Float32Array(n));
    col = new Uint8Array(n);
    const baseR = res.gap * (o.dotSize ?? 0.36);
    res.pts.forEach(([x, y, accent], i) => {
      hx[i] = x;
      hy[i] = y;
      const c = o.tint ? o.tint(accent) : accent ? 1 : 0;
      col[i] = c < spr.length ? c : 0;
      rad[i] = o.radiusAt ? o.radiusAt(x, y, baseR, W, H) : baseR;
      if (o.far) {
        const a = Math.random() * TAU, d = (0.25 + Math.random() * 0.55) * Math.max(cW, cH) * 0.55;
        sx[i] = W / 2 + Math.cos(a) * d;
        sy[i] = H / 2 + Math.sin(a) * d * 0.7;
      } else {
        sx[i] = x + (Math.random() - 0.5) * cW * 0.7;
        sy[i] = y + (Math.random() - 0.5) * cH * 0.7;
      }
      del[i] = (o.order ? o.order(x, y, W, H) : Math.hypot(x - sx[i], y - sy[i]) / Math.max(W, H)) * 0.5 + Math.random() * 0.22;
    });
    return true;
  };

  const edgeA = (x: number, y: number) => {
    const d = Math.min(x, y, W - x, H - y);
    if (d >= fade) return 1;
    if (d <= 0) return 0;
    const t = d / fade;
    return t * t * (3 - 2 * t);
  };

  const f: Running = {
    visible: false,
    awake: false,
    lazy: false,
    lastDraw: 0,
    step() {
      if (!introDone) {
        el += 1 / introSteps;
        if (el >= 1.6) introDone = true;
      }
      ptr.x += (ptr.tx - ptr.x) * 0.14;
      ptr.y += (ptr.ty - ptr.y) * 0.14;
      ptr.s += (ptr.ts - ptr.s) * 0.08;
      const R = o.hover ? o.hover(W) : 0, R2 = R * R, sig2 = R2 * 0.28, push = R * 0.22;
      let energy = 0;
      for (let i = 0; i < n; i++) {
        let tx = 0, ty = 0, infl = 0;
        if (ptr.s > 0.002) {
          const qx = hx[i] - ptr.x, qy = hy[i] - ptr.y, q2 = qx * qx + qy * qy;
          if (q2 < R2) {
            const q = Math.sqrt(q2) || 1, w = Math.exp(-q2 / sig2) * ptr.s;
            tx = (qx / q) * w * push;
            ty = (qy / q) * w * push;
            infl = w;
          }
        }
        vx[i] = (vx[i] + (tx - dx[i]) * 0.085) * 0.78;
        vy[i] = (vy[i] + (ty - dy[i]) * 0.085) * 0.78;
        dx[i] += vx[i];
        dy[i] += vy[i];
        sw[i] += (infl - sw[i]) * 0.14;
        energy += Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(sw[i] - infl);
      }
      const active = !introDone || energy / Math.max(1, n) > 0.0015 || ptr.s > 0.002 || Math.abs(ptr.s - ptr.ts) > 0.002;
      f.lazy = !active;
      f.awake = active || (!!o.breathe && !reduced());
    },
    draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const intro = !introDone;
      const bt = o.breathe && introDone && !reduced() ? performance.now() * 0.0013 : 0;
      f.lastDraw = performance.now();
      for (let i = 0; i < n; i++) {
        let x = hx[i], y = hy[i], g = 1;
        if (intro) {
          const e = easeOut(clamp((el - del[i]) / 0.8, 0, 1));
          x = sx[i] + (x - sx[i]) * e;
          y = sy[i] + (y - sy[i]) * e;
          g = 0.35 + 0.65 * e;
        }
        x += dx[i];
        y += dy[i];
        const ea = edgeA(x, y);
        if (ea <= 0.01) continue;
        const r = rad[i] * g * (1 + 0.55 * sw[i]) * (bt ? 1 + 0.035 * Math.sin(bt - hx[i] * 0.011) : 1);
        ctx.globalAlpha = ea;
        ctx.drawImage(spr[col[i]], x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    },
    calm() {
      started = true;
      settle();
    },
    pointer(cx, cy) {
      if (!o.hover || !started) return;
      const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
      if (x > 0 && y > 0 && x < W && y < H) {
        ptr.tx = x;
        ptr.ty = y;
        if (ptr.s < 0.01) { ptr.x = x; ptr.y = y; }
        ptr.ts = 1;
        f.awake = true;
        f.lazy = false;
      } else f.leave();
    },
    leave() {
      if (!ptr.ts) return;
      ptr.ts = 0;
      f.awake = true;
      f.lazy = false;
    },
  };

  /** Never leave a half-formed shape: off screen, all motion stops and the shape is whole. */
  const settle = () => {
    dx.fill(0); dy.fill(0); vx.fill(0); vy.fill(0); sw.fill(0);
    ptr.ts = ptr.s = 0;
    f.awake = false;
    if (started) { introDone = true; el = 2; }
    f.draw();
  };
  const start = () => {
    if (started) return;
    started = true;
    if (reduced()) { settle(); return; }
    f.awake = true;
    wake();
  };

  if (!build()) return null;
  f.draw();
  if (reduced()) started = true;

  let resizeFrame = 0;
  const resize = new ResizeObserver(() => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const r = box.getBoundingClientRect();
      if (Math.abs(r.width - cW) <= 1 && Math.abs(r.height - cH) <= 1) return;
      if (build()) { f.draw(); if (started && !reduced()) { f.awake = true; wake(); } }
    });
  });
  resize.observe(box);

  const startAt = o.startAt ?? 0.25;
  const seen = new IntersectionObserver(([e]) => {
    f.visible = e.isIntersecting;
    if (!f.visible) { settle(); return; }
    if (e.intersectionRatio >= startAt || e.boundingClientRect.height > innerHeight) start();
    if (started && o.breathe) f.awake = true;
    wake();
  }, { threshold: [0, startAt, 0.6] });
  seen.observe(box);
  track(f);

  return {
    retint() {
      spr = o.palette().map(sprite);
      f.draw();
    },
    destroy() {
      untrack(f);
      seen.disconnect();
      resize.disconnect();
      cancelAnimationFrame(resizeFrame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
