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

describe("poster brand", () => {
  const branded = (style: CampaignPoster["style"]) => renderToStaticMarkup(createElement(Poster, {
    poster: { ...base, style }, format: "post", kicker: "Höst", until: "Till 30 nov", footer: ["Studio"], label: "Poster",
    brand: { colors: { background: "#faf1ef", text: "#3d2f30", accent: "#a14a5b" }, heading: "Georgia, serif" },
  }));

  it("uses the salon's colours and heading font instead of the template's", () => {
    const calm = branded("calm");
    expect(calm).toContain('fill="#faf1ef"');
    expect(calm).toContain('fill="#a14a5b"');
    expect(calm).toContain('font-family="Georgia, serif"');
    expect(calm).not.toContain("#2F5D50");
    expect(branded("bold")).toContain('fill="#a14a5b"');
  });

  it("keeps the template colours without a brand", () => {
    expect(render({ ...base, style: "calm" })).toContain("#2F5D50");
  });
});
