export function resizeCanvas(node: HTMLCanvasElement) {
  const ctx = node.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = node.clientWidth;
  const height = node.clientHeight;
  if (width <= 0 || height <= 0) return null;
  if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) {
    node.width = Math.round(width * dpr);
    node.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

export function inkOf(node: HTMLElement) {
  return getComputedStyle(node).color;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
