import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import config from "../next.config";
import { site } from "@/concept/site/en";
import { WaitlistForm } from "@/concept/site/waitlist-form";

describe("old links", () => {
  it("sends /en/landing permanently to /landing", async () => {
    expect(await config.redirects!()).toContainEqual({ source: "/en/landing", destination: "/landing", permanent: true });
  });
});

describe("waiting list status line", () => {
  const status = (html: string) => html.match(/<p[^>]*role="status"[^>]*>(.*?)<\/p>/);

  it("is mounted before there is an answer, so the answer is announced", () => {
    const html = renderToStaticMarkup(createElement(WaitlistForm, { from: "/landing" }));
    expect(html).toContain("<form");
    const line = status(html);
    expect(line).not.toBeNull();
    expect(line![0]).toContain('tabindex="-1"');
    expect(line![1]).toBe("");
  });

  it("carries the answer when the form is gone", () => {
    const html = renderToStaticMarkup(createElement(WaitlistForm, { from: "/landing", initial: "not-open" }));
    expect(html).not.toContain("<form");
    expect(status(html)![1]).toBe(site["waitlist.outcome.not-open"]);
  });

  it("is never hidden from the accessibility tree while empty", () => {
    const css = readFileSync(new URL("../src/concept/site/site.module.css", import.meta.url), "utf8");
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/display:\s*none|visibility:\s*hidden/.test(rule[2])) continue;
      const selector = rule[1].trim();
      if (!/\.waitlist(?:Answer)?\b/.test(selector)) continue;
      expect(selector.includes("waitlistAnswer") || (/p:empty/.test(selector) && !/:not\(\[role="status"\]\)/.test(selector)), selector).toBe(false);
    }
  });
});
