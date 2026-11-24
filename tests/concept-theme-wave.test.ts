import { describe, expect, it } from "vitest";
import { wave } from "@/concept/ui/theme-wave";

const px = (position: string) => position.split(" ").map((part) => Number(part.replace("px", "")));
const size = (image: string) => {
  const svg = decodeURIComponent(image.slice('url("data:image/svg+xml,'.length, -2));
  return [Number(/width="(\d+)"/.exec(svg)![1]), Number(/height="(\d+)"/.exec(svg)![1])];
};

describe("theme wave mask", () => {
  for (const [width, height, origin] of [[390, 844, { x: 360, y: 30 }], [1280, 900, { x: 1240, y: 60 }], [320, 568, { x: 290, y: 28 }]] as const) {
    it(`starts at the toggle and ends covering the whole ${width}×${height} viewport`, () => {
      const { image, from, to } = wave(width, height, origin);
      const [w, h] = size(image);
      const [fromX, fromY] = px(from);
      const [toX, toY] = px(to);
      // The edge's leading point sits at the toggle when the wave starts.
      expect(fromX).toBeLessThanOrEqual(origin.x);
      expect(fromX).toBeGreaterThan(origin.x - w * 0.2);
      // The image covers the viewport vertically at both ends of the drift.
      expect(fromY + h).toBeGreaterThanOrEqual(height);
      expect(toY).toBe(0);
      expect(h).toBeGreaterThanOrEqual(height);
      // At the end the edge is past the left side and the opaque part still reaches the right side.
      expect(toX + w).toBeGreaterThan(width);
      expect(toX).toBeLessThan(0);
    });
  }

  it("draws one closed path and nothing else", () => {
    const svg = decodeURIComponent(wave(390, 844, { x: 360, y: 30 }).image);
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).toMatch(/Z"\/><\/svg>/);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
