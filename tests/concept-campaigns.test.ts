import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { monthGrid, postDay, shiftMonth } from "@/concept/campaigns/calendar";
import { assembleCopy, CHANNEL_LIMIT, CHANNELS, isOverLimit } from "@/concept/campaigns/channels";
import { listServices, offerText, rulesCopy } from "@/concept/campaigns/copy";
import { defaultPrefill, draftLink, draftOffer, newDraft, resolvePoster } from "@/concept/campaigns/draft";
import { campaignCode, trackingLink } from "@/concept/campaigns/links";
import { fitFontSize, wrapText } from "@/concept/campaigns/poster-layout";
import { parseCampaignRequest, prefillForHoliday, prefillFromQuery, studioHref } from "@/concept/campaigns/prefill";
import { quietDay } from "@/concept/campaigns/quiet-day";
import { estimateAd, reachByChannel, simulateStats } from "@/concept/campaigns/simulate";
import { createDemoState } from "@/concept/data/generate";
import type { Channel } from "@/concept/data/types";

const today = "2026-11-16";
const state = createDemoState(today);
const link = "salongeko.example/c/test-abc";
const longText = "Treat yourself to something calm this autumn. ".repeat(60);

describe("channel copy", () => {
  it.each(CHANNELS)("%s stays within its limit and keeps the link", (channel) => {
    const text = assembleCopy(channel, longText, ["#a", "#b", "#c", "#d", "#e", "#f", "#g"], link);
    expect(text.length).toBeLessThanOrEqual(CHANNEL_LIMIT[channel]);
    expect(text).toContain(link);
    expect(isOverLimit(channel, text)).toBe(false);
  });

  it("keeps a short body whole and adds hashtags only where they belong", () => {
    expect(assembleCopy("instagram", "Hello", ["#Salon"], link)).toBe(`Hello\nLink in bio: ${link}\n#Salon`);
    expect(assembleCopy("sms", "Hello", ["#Salon"], link)).toBe(`Hello\n${link}`);
    expect(assembleCopy("facebook", "Hello", ["#Salon"], link)).not.toContain("#");
  });

  it("allows at most five hashtags", () => {
    const text = assembleCopy("instagram", "Hi", Array.from({ length: 10 }, (_, i) => `#t${i}`), link);
    expect(text.match(/#t\d/g)).toHaveLength(5);
  });

  it("flags a hand-edited text that is too long", () => {
    expect(isOverLimit("sms", "x".repeat(161))).toBe(true);
    expect(isOverLimit("sms", "x".repeat(160))).toBe(false);
  });

  it("writes every channel from the rule-based draft, within limits", () => {
    const offer = offerText({ name: "Father's Day offer", serviceNames: ["Deep tissue massage"], discountPercent: 15, to: "2027-11-14" });
    expect(offer).toBe("Father's Day offer: 15% off Deep tissue massage until 14 Nov 2027.");
    for (const channel of CHANNELS) {
      const text = rulesCopy(channel, offer, link);
      expect(text).toContain("15% off");
      expect(text).toContain(link);
      expect(isOverLimit(channel, text)).toBe(false);
    }
  });

  it("leaves the discount out of an offer without one and shortens long lists of treatments", () => {
    expect(offerText({ name: "Gift cards", serviceNames: ["A"], discountPercent: 0, to: "2026-12-24" })).toBe("Gift cards: A until 24 Dec 2026.");
    expect(listServices(["A", "B"])).toBe("A and B");
    expect(listServices(["A", "B", "C"])).toBe("A and 2 more");
  });
});

describe("tracking link and simulated results", () => {
  it("makes a stable, readable link per campaign", () => {
    expect(trackingLink("Father's Day offer", "2027-10-24")).toBe(trackingLink("Father's Day offer", "2027-10-24"));
    expect(trackingLink("Father's Day offer", "2027-10-24")).toMatch(/^salongeko\.example\/c\/fathers-day-[0-9a-z]{3}$/);
    expect(campaignCode("Father's Day offer", "2027-10-24")).not.toBe(campaignCode("Mother's Day offer", "2027-10-24"));
    expect(campaignCode("???", "2026-01-01")).toMatch(/^offer-/);
  });

  const input = { seed: "Father's Day offer", channels: ["instagram", "facebook", "sms"] as Channel[], discountPercent: 15, avgPrice: 800 };

  it("is deterministic and keeps the funnel in order", () => {
    const stats = simulateStats(input);
    expect(simulateStats(input)).toEqual(stats);
    expect(stats.reach).toBeGreaterThan(stats.clicks);
    expect(stats.clicks).toBeGreaterThan(stats.bookings);
    expect(stats.bookings).toBeGreaterThan(0);
    expect(stats.revenue).toBe(Math.round(stats.bookings * 800 * 0.85));
  });

  it("reaches more people on more channels and has no bookings without channels", () => {
    expect(simulateStats({ ...input, channels: [...CHANNELS] }).reach).toBeGreaterThan(simulateStats(input).reach);
    expect(simulateStats({ ...input, channels: [] })).toEqual({ reach: 0, clicks: 0, bookings: 0, revenue: 0 });
  });

  it("splits the reach over the channels that were used", () => {
    const stats = simulateStats(input);
    const split = reachByChannel({ channels: input.channels, stats });
    expect(split.map((s) => s.channel)).toEqual(["instagram", "facebook", "sms"]);
    expect(Math.abs(split.reduce((sum, s) => sum + s.reach, 0) - stats.reach)).toBeLessThanOrEqual(2);
  });

  it("estimates more reach for a bigger budget, and a range around it", () => {
    const small = estimateAd({ budget: 200, days: 7, radiusKm: 5 });
    const big = estimateAd({ budget: 1000, days: 7, radiusKm: 5 });
    expect(big.reachLow).toBeGreaterThan(small.reachHigh);
    expect(small.reachLow).toBeLessThan(small.reachHigh);
    expect(small.bookings).toBeGreaterThanOrEqual(1);
    expect(estimateAd({ budget: 500, days: 14, radiusKm: 5 }).reachLow).toBeGreaterThan(estimateAd({ budget: 500, days: 3, radiusKm: 5 }).reachLow);
  });
});

describe("campaign requests", () => {
  it("turns a holiday into an offer that starts before the day", () => {
    const fathers = state.holidays.find((h) => h.name === "Father's Day")!;
    const prefill = prefillForHoliday(state, fathers, today);
    expect(prefill).toMatchObject({ name: "Father's Day offer", discountPercent: 15, to: fathers.date, holidayId: fathers.id });
    expect(prefill.from < fathers.date).toBe(true);
    expect(prefillForHoliday(state, state.holidays.find((h) => h.name === "Black Friday")!, today).discountPercent).toBe(20);
  });

  it("reads 'make a Father's Day campaign'", () => {
    const prefill = parseCampaignRequest("make a Father's Day campaign", state, today)!;
    expect(prefill.holidayId).toMatch(/^father-s-day/);
    expect(parseCampaignRequest("Make a poster for fathers day", state, today)?.holidayId).toBe(prefill.holidayId);
  });

  it("reads '20% off massage all of March' as every massage in March next year", () => {
    const prefill = parseCampaignRequest("20% off massage all of March", state, today)!;
    expect(prefill).toMatchObject({ discountPercent: 20, from: "2027-03-01", to: "2027-03-31", name: "20% off Massage" });
    expect(prefill.serviceIds.sort()).toEqual(state.services.filter((s) => s.category === "massage").map((s) => s.id).sort());
  });

  it("reads a named treatment and this month", () => {
    const prefill = parseCampaignRequest("15% off Deep tissue massage this month", state, today)!;
    expect(prefill).toMatchObject({ serviceIds: ["deep-tissue"], from: today, to: "2026-11-30", name: "15% off Deep tissue massage" });
  });

  it("ignores text that is not a campaign", () => {
    expect(parseCampaignRequest("Book Anna tomorrow at 10", state, today)).toBeNull();
    expect(parseCampaignRequest("Move my 10:00 off Friday", state, today)).toBeNull();
    expect(parseCampaignRequest("offer 20% on unicorns", state, today)).toBeNull();
    expect(parseCampaignRequest("150% off massage", state, today)).toBeNull();
  });

  it("round-trips through the studio address", () => {
    const prefill = parseCampaignRequest("20% off massage all of March", state, today)!;
    expect(prefillFromQuery(new URL(studioHref(prefill), "https://x.test").searchParams, state, today)).toEqual({ ...prefill, holidayId: undefined });
    const holiday = prefillForHoliday(state, state.holidays[0], today);
    expect(studioHref(holiday, true)).toBe(`/studio/more/campaigns/new?holiday=${state.holidays[0].id}`);
    expect(prefillFromQuery(new URL(studioHref(holiday, true), "https://x.test").searchParams, state, today)).toEqual(holiday);
  });

  it("rejects an invalid studio address", () => {
    const query = (qs: string) => prefillFromQuery(new URLSearchParams(qs), state, today);
    expect(query("")).toBeNull();
    expect(query("name=X&services=nope&percent=10&from=2026-11-16&to=2026-11-20")).toBeNull();
    expect(query("name=X&services=classic-60&percent=200&from=2026-11-16&to=2026-11-20")).toBeNull();
    expect(query("name=X&services=classic-60&percent=10&from=2026-11-20&to=2026-11-16")).toBeNull();
    expect(query("name=X&services=classic-60&percent=10&from=tomorrow&to=2026-11-16")).toBeNull();
  });
});

describe("campaign store actions", () => {
  const draft = newDraft({ ...defaultPrefill(state, today), name: "Test offer" });
  const campaign = { name: "Test offer", serviceIds: ["classic-60"], discountPercent: 20, from: today, to: "2026-11-30", channels: ["instagram", "sms"] as Channel[], publishOn: today, link, copy: { instagram: "Hi" } };

  it("publishing today starts the campaign with simulated results, first in the list", () => {
    const next = reduce(state, { type: "campaign/launch", today, campaign });
    expect(next.campaigns).toHaveLength(state.campaigns.length + 1);
    expect(next.campaigns[0]).toMatchObject({ name: "Test offer", status: "active", link });
    expect(next.campaigns[0].stats?.bookings).toBeGreaterThan(0);
    expect(next.campaigns[0].stats?.revenue).toBeGreaterThan(0);
  });

  it("scheduling for a later day plans the posts without results", () => {
    const next = reduce(state, { type: "campaign/launch", today, campaign: { ...campaign, publishOn: "2026-11-20" } });
    expect(next.campaigns[0]).toMatchObject({ status: "planned", stats: undefined });
  });

  it("refuses a campaign with no name or channel", () => {
    expect(reduce(state, { type: "campaign/launch", today, campaign: { ...campaign, name: " " } })).toBe(state);
    expect(reduce(state, { type: "campaign/launch", today, campaign: { ...campaign, channels: [] } })).toBe(state);
  });

  it("adds an ad's expected results once", () => {
    const launched = reduce(state, { type: "campaign/launch", today, campaign });
    const id = launched.campaigns[0].id;
    const ad = { budget: 500, days: 7, radiusKm: 5 };
    const boosted = reduce(launched, { type: "campaign/ad", id, ad });
    expect(boosted.campaigns[0].ad).toEqual(ad);
    expect(boosted.campaigns[0].stats!.reach).toBeGreaterThan(launched.campaigns[0].stats!.reach);
    expect(boosted.campaigns[0].stats!.bookings).toBeGreaterThan(launched.campaigns[0].stats!.bookings);
    expect(reduce(boosted, { type: "campaign/ad", id, ad })).toBe(boosted);
    expect(reduce(launched, { type: "campaign/ad", id, ad: { ...ad, budget: 0 } })).toBe(launched);
  });

  it("builds a draft's offer sentence and poster from the offer, with the owner's edits on top", () => {
    expect(draftOffer(state, draft)).toBe("Test offer: 10% off Medical foot care until 29 Nov 2026.");
    const swedish = { ...state, localization: { ...state.localization, language: "sv" as const } };
    expect(draftOffer(swedish, draft)).toBe("Test offer: 10 % rabatt på Medicinsk fotvård till 29 november 2026.");
    const poster = resolvePoster(state, draft);
    expect(poster).toMatchObject({ style: "calm", image: "/demo/salon.webp", headline: "−10%", detail: state.services[0].name });
    expect(resolvePoster(state, { ...draft, serviceIds: ["deep-tissue"], posterEdits: { headline: "Gift" } })).toMatchObject({ image: "/demo/massage.webp", headline: "Gift" });
  });
});

describe("content calendar", () => {
  it("covers whole weeks starting Monday and puts holidays and posts on their days", () => {
    const christmas = state.holidays.find((h) => h.name === "Christmas")!;
    const weeks = monthGrid("2026-12", state.holidays, [{ ...state.campaigns[0], id: "c-x", publishOn: "2026-12-03", status: "planned" }]);
    const days = weeks.flat();
    expect(days.length % 7).toBe(0);
    expect(days[0].date).toBe("2026-11-30");
    expect(days.filter((d) => d.inMonth)).toHaveLength(31);
    expect(days.find((d) => d.date === christmas.date)?.holidays).toHaveLength(1);
    expect(days.find((d) => d.date === "2026-12-03")?.posts).toMatchObject([{ campaignId: "c-x", planned: true }]);
  });

  it("falls back to the start day for campaigns without a stored publishing day and shifts months", () => {
    expect(postDay({ ...state.campaigns[0], publishOn: undefined })).toBe(state.campaigns[0].from);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("quiet days and poster layout", () => {
  it("finds a quiet day within a week, or none when the week is full", () => {
    const quiet = quietDay(state, today);
    if (quiet) {
      expect(quiet.date > today).toBe(true);
      expect(quiet.freeMinutes).toBeGreaterThanOrEqual(240);
    }
    const full = { ...state, bookings: [], staff: [] };
    expect(quietDay(full, today)).toBeNull();
    expect(quietDay({ ...state, bookings: [] }, today)?.service).toBeDefined();
  });

  it("wraps words without cutting them and ends long text with an ellipsis", () => {
    expect(wrapText("Deep tissue massage and Classic massage", 20)).toEqual(["Deep tissue massage", "and Classic massage"]);
    expect(wrapText("one two three four five six", 8, 2)).toEqual(["one two", "three f…"]);
    expect(wrapText("   ", 10)).toEqual([]);
  });

  it("shrinks a long headline to fit the width", () => {
    expect(fitFontSize("−15%", 900, 160)).toBe(160);
    expect(fitFontSize("A very long headline indeed", 900, 160)).toBeLessThan(60);
  });
});

it("links a local campaign to its salon's booking page on this origin", () => {
  const offer = { name: "Autumn offer", from: today };
  const salon = { ...state, industry: "hair" as const, salon: { ...state.salon, slug: "studio-vide" } };
  const origin = "https://studio.example";
  expect(draftLink(salon, offer, origin)).toBe(`${origin}/boka/studio-vide?campaign=${campaignCode(offer.name, today)}`);
  expect(draftLink(state, offer, origin)).toBe(trackingLink(offer.name, today));
});
