import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { Countdown } from "@/concept/studio/waitlist/waitlist-page";

afterEach(() => vi.useRealTimers());

it("renders an offer's time left on its own, so the page's matching does not rerun every second", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-11-19T10:00:00+01:00"));
  expect(renderToStaticMarkup(createElement(Countdown, { until: Date.now() + 90_500 }))).toBe("1:31 left");
  expect(renderToStaticMarkup(createElement(Countdown, { until: Date.now() - 1 }))).toBe("0:00 left");
});
