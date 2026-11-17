import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SlotCard } from "@/concept/booking/slot-card";
import { parseCampaignRequest } from "@/concept/campaigns/prefill";
import { commandExamples } from "@/concept/command/examples";
import { createDemoState } from "@/concept/data/generate";
import { formatDate } from "@/concept/i18n/format";
import { PosterView } from "@/concept/studio/campaigns/poster-view";

const today = "2026-11-17";
const state = createDemoState(today);
describe("customer and campaign date regressions (#8, #11)", () => {
  it("labels the end of a suggestion explicitly", () => {
    const service = state.services[0];
    const html = renderToStaticMarkup(createElement(SlotCard, { slot: { date: today, start: 810, staffId: "anna" }, service, staff: state.staff, today, onPick: () => {} }));
    expect(html).toContain("13:30");
    expect(html).toContain(`until ${String(Math.floor((810 + service.duration) / 60)).padStart(2, "0")}:${String((810 + service.duration) % 60).padStart(2, "0")}`);
  });
  it("keeps the year on future posters and campaign date labels", () => {
    expect(formatDate("2027-11-14")).toBe("14 Nov 2027");
    const html = renderToStaticMarkup(createElement(PosterView, { source: { name: "Father's Day", to: "2027-11-14", poster: { style: "calm", image: "/demo/massage.webp", headline: "15% off", detail: "Massage" } }, salon: state.salon, format: "post" }));
    expect(html).toContain("Until 14 Nov 2027");
  });
  it("uses the nearest upcoming holiday even if the stored list is unsorted or has expired entries", () => {
    const shuffled = { ...state, holidays: [...state.holidays].reverse() };
    shuffled.holidays.push({ ...state.holidays[0], id: "expired", date: "2026-11-01" });
    expect(parseCampaignRequest("make a seasonal holiday campaign", shuffled, today)?.holidayId).toBe("black-friday-2026");
    expect(commandExamples(shuffled, today)).toContain("Make a Black Friday campaign");
    expect(parseCampaignRequest("make a Father's Day campaign", shuffled, today)?.to).toBe("2027-11-14");
  });
});
