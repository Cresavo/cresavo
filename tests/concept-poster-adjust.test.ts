import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Poster } from "@/concept/studio/campaigns/poster";
import type { CampaignPoster } from "@/concept/data/types";

// The owner's poster adjustments: text size and which part of the photo stays in view.

const base: CampaignPoster = { style: "photo", image: "/demo/salon.webp", headline: "Höst", detail: "Spa-fotvård och massage" };
const render = (poster: CampaignPoster) =>
  renderToStaticMarkup(createElement(Poster, { poster, format: "post", kicker: "Höst", until: "Till 30 nov", footer: ["Studio", "boka.example"], label: "Poster" }));
const sizes = (markup: string) => [...markup.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));

describe("poster adjustments", () => {
  it("makes the headline and detail larger or smaller, never wider than the poster", () => {
    const [normal, small, large] = [render(base), render({ ...base, textSize: "small" }), render({ ...base, textSize: "large" })].map(sizes);
    expect(Math.max(...small)).toBeLessThan(Math.max(...normal));
    expect(Math.max(...large)).toBeGreaterThan(Math.max(...normal));
    const long = sizes(render({ ...base, headline: "Höstens skönaste fötter", textSize: "large" }));
    expect(Math.max(...long)).toBeLessThanOrEqual(Math.max(...sizes(render({ ...base, headline: "Höstens skönaste fötter" }))) * 1.18);
  });

  it("keeps the chosen part of the photo in view", () => {
    expect(render(base)).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(render({ ...base, focus: "top" })).toContain('preserveAspectRatio="xMidYMin slice"');
    expect(render({ ...base, focus: "bottom" })).toContain('preserveAspectRatio="xMidYMax slice"');
  });
});
