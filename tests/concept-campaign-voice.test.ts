import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_LIMIT, CHANNELS } from "@/concept/campaigns/channels";
import { rulesCopy } from "@/concept/campaigns/copy";
import { defaultPrefill, draftOffer, newDraft, newestReview, offerSignature, type Draft } from "@/concept/campaigns/draft";
import { applyVoice, hasVoice, NEUTRAL_VOICE, ownerVoice } from "@/concept/campaigns/voice";
import { createDemoState } from "@/concept/data/generate";
import type { Campaign, Channel, DemoState } from "@/concept/data/types";

// A Monday at 08:00 in Stockholm: the salon is open and nothing depends on the real date.
const today = "2026-11-16";
const link = "salongeko.example/c/test-abc";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T07:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const inLanguage = (language: "en" | "sv"): DemoState => {
  const base = createDemoState(today);
  return { ...base, localization: { ...base.localization, language } };
};

const draftFor = (state: DemoState, goal: NonNullable<Draft["goal"]>, extra: Partial<Draft> = {}): Draft => ({
  ...newDraft(defaultPrefill(state, today)),
  goal,
  name: "Kampanj",
  discountPercent: goal === "promote" ? 20 : 0,
  from: today,
  to: "2026-12-04",
  ...extra,
});

describe("goal offer sentence", () => {
  it("without a goal keeps today's discount sentence", () => {
    const state = inLanguage("en");
    expect(draftOffer(state, newDraft(defaultPrefill(state, today)))).toMatch(/10% off .* until 29 Nov 2026\./);
  });

  it("promote: the discount sentence", () => {
    const en = inLanguage("en");
    const sv = inLanguage("sv");
    expect(draftOffer(en, draftFor(en, "promote"))).toMatch(/^Kampanj: 20% off .* until 4 Dec 2026\.$/);
    expect(draftOffer(sv, draftFor(sv, "promote"))).toMatch(/^Kampanj: 20 % rabatt på .* till 4 december 2026\.$/);
  });

  it("fill: the day and the times of the free-times poster", () => {
    const en = inLanguage("en");
    const sv = inLanguage("sv");
    expect(draftOffer(en, draftFor(en, "fill"))).toMatch(/^Free times Monday 16 November: \d\d:\d\d(, \d\d:\d\d)*\.$/);
    expect(draftOffer(sv, draftFor(sv, "fill"))).toMatch(/^Lediga tider måndag 16 november: \d\d:\d\d(, \d\d:\d\d)*\.$/);
  });

  it("fill: falls back to the plain sentence when nothing is free in the period", () => {
    const state = inLanguage("en");
    expect(draftOffer(state, draftFor(state, "fill", { to: "2026-11-15" }))).toMatch(/^Kampanj: .* until 15 Nov 2026\.$/);
  });

  it("wellness: the treatments and the badges the owner picked", () => {
    const en = inLanguage("en");
    const sv = inLanguage("sv");
    expect(draftOffer(en, draftFor(en, "wellness", { posterEdits: { badges: ["Epassi", "Benify"] } }))).toMatch(/^Kampanj: .*\. Pay with Epassi, Benify\. Valid until 4 Dec 2026\.$/);
    expect(draftOffer(en, draftFor(en, "wellness"))).toContain("Pay with your wellness allowance");
    expect(draftOffer(sv, draftFor(sv, "wellness", { posterEdits: { badges: ["Epassi"] } }))).toMatch(/Betala med Epassi\. Gäller till 4 december 2026\.$/);
  });

  it("gift card: no price and no validity", () => {
    const en = draftOffer(inLanguage("en"), draftFor(inLanguage("en"), "giftcard"));
    expect(en).toBe("Kampanj: give someone time to relax. Ask us at the salon.");
    expect(en).not.toMatch(/\d/);
    expect(draftOffer(inLanguage("sv"), draftFor(inLanguage("sv"), "giftcard"))).toBe("Kampanj: ge bort en stund av avkoppling. Fråga i salongen.");
  });

  it("review: the first sentence of the newest review and the customer's public name", () => {
    for (const language of ["en", "sv"] as const) {
      const state = inLanguage(language);
      const review = newestReview(state)!;
      const sentence = draftOffer(state, draftFor(state, "review"));
      expect(sentence.startsWith("“")).toBe(true);
      expect(sentence).toContain(review.author);
      expect(sentence).toContain(review.text.split(/(?<=[.!?])\s/)[0].slice(0, 20));
    }
  });

  it("changing the goal changes the signature, so the texts are rewritten", () => {
    const state = inLanguage("en");
    expect(offerSignature(state, draftFor(state, "giftcard"))).not.toBe(offerSignature(state, draftFor(state, "wellness")));
  });
});

const campaign = (id: string, copy: Partial<Record<Channel, string>>, status: Campaign["status"] = "ended"): Campaign => ({
  id, name: id, serviceIds: [], discountPercent: 0, from: today, to: today, status, channels: CHANNELS, copy,
});
const stateWith = (...campaigns: Campaign[]) => ({ campaigns });

describe("ownerVoice", () => {
  it("is neutral without published campaigns", () => {
    expect(ownerVoice(stateWith())).toEqual(NEUTRAL_VOICE);
    expect(ownerVoice(stateWith(campaign("a", { instagram: "x" }, "draft")))).toEqual(NEUTRAL_VOICE);
    expect(hasVoice(NEUTRAL_VOICE)).toBe(false);
  });

  it("finds a sign-off that repeats", () => {
    const voice = ownerVoice(stateWith(
      campaign("a", { instagram: `Autumn offer.\nWarm regards, Anna\nLink in bio: ${link}`, sms: `Hi!\nWarm regards, Anna\n${link}` }),
      campaign("b", { instagram: `Winter offer.\nWarm regards, Anna\nLink in bio: ${link}\n#Salon`, facebook: `Only this once.\n${link}` }),
    ));
    expect(voice.signOff).toBe("Warm regards, Anna");
  });

  it("does not take a one-off line as a sign-off", () => {
    const voice = ownerVoice(stateWith(
      campaign("a", { instagram: `Autumn offer.\nWarm regards, Anna\n${link}` }),
      campaign("b", { instagram: `Winter offer.\nSee you soon!\n${link}` }),
    ));
    expect(voice.signOff).toBeUndefined();
  });

  it("does not take the writer's own closing line or hashtags as the owner's habit", () => {
    const stock = (offer: string) => `${offer}\nBook your time online.\nLink in bio: ${link}\n#Salon #SelfCare`;
    const voice = ownerVoice(stateWith(campaign("a", { instagram: stock("Autumn offer.") }), campaign("b", { instagram: stock("Winter offer.") })));
    expect(voice.signOff).toBeUndefined();
    expect(voice.hashtags).toEqual([]);
  });

  it("finds recurring hashtags the owner added", () => {
    const voice = ownerVoice(stateWith(
      campaign("a", { instagram: `A\nLink in bio: ${link}\n#Salon #EkoGlow #HöstHud` }),
      campaign("b", { instagram: `B\nLink in bio: ${link}\n#ekoglow #Salon #Vinter` }),
      campaign("c", { instagram: `C\nLink in bio: ${link}\n#EkoGlow #Salon` }),
    ));
    expect(voice.hashtags).toEqual(["#EkoGlow"]);
  });

  it("detects whether the owner uses emoji", () => {
    expect(ownerVoice(stateWith(campaign("a", { instagram: `Treat yourself ✨\n${link}` }))).emoji).toBe(true);
    expect(ownerVoice(stateWith(campaign("a", { instagram: `Treat yourself\n${link}` }))).emoji).toBe(false);
  });

  it("describes the usual caption length", () => {
    expect(ownerVoice(stateWith(campaign("a", { instagram: "Short." }))).length).toBe("short");
    expect(ownerVoice(stateWith(campaign("a", { instagram: "x".repeat(200) }))).length).toBe("medium");
    expect(ownerVoice(stateWith(campaign("a", { instagram: "x".repeat(500) }))).length).toBe("long");
  });
});

describe("applyVoice", () => {
  const voice = { signOff: "Warm regards, Anna", hashtags: ["#EkoGlow"], emoji: false };

  it("puts the owner's hashtags first without duplicates and keeps the sign-off apart", () => {
    expect(applyVoice({ text: "Hi", hashtags: ["#ekoglow", "#Salon"] }, voice)).toEqual({ text: "Hi", hashtags: ["#EkoGlow", "#Salon"], signOff: "Warm regards, Anna" });
  });

  it("drops emoji only when the owner never uses them, and does not repeat a sign-off", () => {
    expect(applyVoice({ text: "Treat yourself ✨ today", hashtags: [] }, voice).text).toBe("Treat yourself today");
    expect(applyVoice({ text: "Treat yourself ✨", hashtags: [] }, { ...voice, emoji: true }).text).toBe("Treat yourself ✨");
    expect(applyVoice({ text: "Hi\nWarm regards, Anna", hashtags: [] }, voice).signOff).toBeUndefined();
  });

  it.each(CHANNELS)("%s: rules caption stays within the limit and keeps sign-off and link", (channel) => {
    const signOff = "Warm regards from all of us at the salon, Anna and the team".padEnd(80, "!");
    const text = rulesCopy(channel, "Big offer. ".repeat(200), link, "en", { ...voice, signOff });
    expect(text.length).toBeLessThanOrEqual(CHANNEL_LIMIT[channel]);
    expect(text).toContain(signOff);
    expect(text).toContain(link);
  });

  it("changes nothing for a neutral voice", () => {
    expect(rulesCopy("instagram", "Offer.", link, "en", NEUTRAL_VOICE)).toBe(`Offer.\nBook your time online.\nLink in bio: ${link}\n#Salon #SelfCare`);
    expect(rulesCopy("instagram", "Offer.", link, "en", voice)).toBe(`Offer.\nBook your time online.\nWarm regards, Anna\nLink in bio: ${link}\n#EkoGlow #Salon #SelfCare`);
  });
});
