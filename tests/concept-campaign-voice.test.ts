import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleCopy, CHANNEL_LIMIT, CHANNELS } from "@/concept/campaigns/channels";
import { postRequest, rulesCopy } from "@/concept/campaigns/copy";
import { defaultPrefill, draftOffer, newDraft, newestReview, offerSignature, refreshCopy, editCopy, canApplyAiText, type Draft } from "@/concept/campaigns/draft";
import { applyVoice, NEUTRAL_VOICE, ownerVoice, styleHints } from "@/concept/campaigns/voice";
import { isHashtag, voiceSchema } from "@/concept/ai/tasks/write-post";
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

const campaign = (id: string, copy: Partial<Record<Channel, string>>, status: Campaign["status"] = "ended", channels: Channel[] = CHANNELS): Campaign => ({
  id, name: `Campaign ${id}`, serviceIds: [], discountPercent: 0, from: today, to: today, status, channels, copy,
});
const customers = [{ firstName: "Mira", lastName: "Quist" }] as DemoState["customers"];
const stateWith = (...campaigns: Campaign[]) => ({ campaigns, customers, reviews: [] as DemoState["reviews"] });

describe("ownerVoice", () => {
  it("is neutral without published campaigns", () => {
    expect(ownerVoice(stateWith())).toEqual(NEUTRAL_VOICE);
    expect(ownerVoice(stateWith(campaign("a", { instagram: "x" }, "draft")))).toEqual(NEUTRAL_VOICE);
    expect(styleHints(NEUTRAL_VOICE)).toBeUndefined();
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

  it("drops emoji only when the owner never uses them", () => {
    expect(applyVoice({ text: "Treat yourself ✨ today", hashtags: [] }, voice).text).toBe("Treat yourself today");
    expect(applyVoice({ text: "Treat yourself ✨", hashtags: [] }, { ...voice, emoji: true }).text).toBe("Treat yourself ✨");
  });

  it.each(CHANNELS)("%s: rules caption stays within the limit and keeps the link", (channel) => {
    const text = rulesCopy(channel, "Big offer. ".repeat(200), link, "en", { ...voice, signOff: "Warm regards, Anna" });
    expect(text.length).toBeLessThanOrEqual(CHANNEL_LIMIT[channel]);
    expect(text).toContain(link);
  });

  it.each(CHANNELS.filter((channel) => channel !== "sms"))("%s: the sign-off goes before the link when it fits", (channel) => {
    const text = rulesCopy(channel, "Offer.", link, "en", voice);
    expect(text).toContain(`Warm regards, Anna\n${channel === "facebook" || channel === "newsletter" ? "" : "Link in bio: "}${link}`);
  });

  it("changes nothing for a neutral voice", () => {
    expect(rulesCopy("instagram", "Offer.", link, "en", NEUTRAL_VOICE)).toBe(`Offer.\nBook your time online.\nLink in bio: ${link}\n#Salon #SelfCare`);
    expect(rulesCopy("instagram", "Offer.", link, "en", voice)).toBe(`Offer.\nBook your time online.\nWarm regards, Anna\nLink in bio: ${link}\n#EkoGlow #Salon #SelfCare`);
  });
});

describe("what teaches the voice", () => {
  const review = (id: string) => campaign(id, { instagram: `Review ${id}.\n“Loved it.” – Mira Q.\nLink in bio: ${link}` }, "ended");

  it("never learns a testimonial, a credit, the campaign's name or a customer's name as the sign-off", () => {
    const voice = ownerVoice(stateWith(review("a"), review("b")));
    expect(voice.signOff).toBeUndefined();
    for (const line of ["Loved it. – Mira Q.", "“Loved it.”", "He said \"great\"", "«Bra»", "— Anna", "Thanks, Mira", "Hugs from Quist"]) {
      const copy = (id: string) => ({ instagram: `Offer ${id}.\n${line}\n${link}` });
      expect(ownerVoice(stateWith(campaign("a", copy("a")), campaign("b", copy("b")))).signOff).toBeUndefined();
    }
    const named = (id: string) => ({ ...campaign(id, { instagram: `Offer ${id}.\nBook Spring Glow today\n${link}` }), name: "Spring Glow" });
    expect(ownerVoice(stateWith(named("a"), named("b"))).signOff).toBeUndefined();
  });

  it("does not put a customer's name on a later gift card caption", () => {
    const voice = ownerVoice(stateWith(review("a"), review("b")));
    const gift = rulesCopy("instagram", "Give someone time to relax.", link, "en", voice);
    expect(gift).not.toMatch(/Mira|Loved it/);
  });

  it("keeps a plain sign-off with a comma", () => {
    expect(ownerVoice(stateWith(campaign("a", { instagram: `A\nWarm regards, Anna\n${link}` }), campaign("b", { instagram: `B\nWarm regards, Anna\n${link}` }))).signOff).toBe("Warm regards, Anna");
  });

  it("ignores planned campaigns and drafts", () => {
    const copy = { instagram: `A\nWarm regards, Anna\n${link} ✨ #EkoGlow` };
    expect(ownerVoice(stateWith(campaign("a", copy, "planned"), campaign("b", copy, "planned"), campaign("c", copy, "draft")))).toEqual(NEUTRAL_VOICE);
    expect(ownerVoice(stateWith(campaign("a", copy, "active"), campaign("b", copy, "ended"))).signOff).toBe("Warm regards, Anna");
  });

  it("reads only the channels the campaign went out on", () => {
    const sms = (id: string) => campaign(id, { sms: `Hi ${id}!\n${link}`, instagram: `${"x".repeat(400)}\nUnused sign-off\n#Unused ✨` }, "ended", ["sms"]);
    const voice = ownerVoice(stateWith(sms("a"), sms("b")));
    expect(voice).toEqual({ hashtags: [], emoji: false });
  });
});

describe("hashtags", () => {
  it("accepts # and 1-29 letters, digits or underscores", () => {
    expect(isHashtag(`#${"a".repeat(29)}`)).toBe(true);
    expect(isHashtag(`#${"a".repeat(30)}`)).toBe(false);
    expect(isHashtag("#Självvård_åäö1")).toBe(true);
    expect(isHashtag("#")).toBe(false);
    expect(isHashtag("#a-b")).toBe(false);
  });

  it("learns a recurring tag of 30 characters but not one of 31", () => {
    const ok = `#${"a".repeat(29)}`;
    const long = `#${"b".repeat(30)}`;
    const copy = { instagram: `A\n${link}\n${ok} ${long}` };
    expect(ownerVoice(stateWith(campaign("a", copy), campaign("b", copy))).hashtags).toEqual([ok]);
  });

  it("discards invalid tags before taking the top three", () => {
    const long = `#${"b".repeat(30)}`;
    const copy = { instagram: `A\n${link}\n${long} #One #Two #Three` };
    expect(ownerVoice(stateWith(campaign("a", copy), campaign("b", copy))).hashtags).toEqual(["#One", "#Two", "#Three"]);
  });

  it("the task schema takes the same rule", () => {
    expect(voiceSchema.safeParse({ emoji: true, length: "short" }).success).toBe(true);
    expect(voiceSchema.safeParse({ emoji: true, signOff: "x", hashtags: [] }).success).toBe(false);
  });
});

describe("emoji", () => {
  const without = { hashtags: [], emoji: false };
  it.each([["🇸🇪", "flag"], ["👍🏽", "skin tone"], ["👩‍👩‍👧", "family"], ["✨", "sparkles"]])("%s (%s) is detected and removed whole", (emoji) => {
    expect(ownerVoice(stateWith(campaign("a", { instagram: `Hej ${emoji}\n${link}` }))).emoji).toBe(true);
    expect(applyVoice({ text: `Hello ${emoji} world`, hashtags: [] }, without).text).toBe("Hello world");
    expect(applyVoice({ text: `Hello${emoji}`, hashtags: [] }, without).text).toBe("Hello");
  });
});

describe("sign-off and channel limits", () => {
  const longLink = `https://salongeko.example/boka?campaign=${"x".repeat(100)}`;

  it("never gives an SMS a sign-off", () => {
    expect(assembleCopy("sms", "Offer.", [], link, "en", "Warm regards, Anna")).not.toContain("Warm regards");
    expect(rulesCopy("sms", "Offer.", link, "en", { hashtags: [], emoji: true, signOff: "Warm regards, Anna" })).not.toContain("Warm regards");
  });

  it("keeps the offer and the whole link in an SMS with a long link", () => {
    const text = rulesCopy("sms", "20% off massage.", longLink, "en", { hashtags: [], emoji: true, signOff: "Warm regards, Anna" });
    expect(text.length).toBeLessThanOrEqual(CHANNEL_LIMIT.sms);
    expect(text).toContain(longLink);
    expect(text).toContain("20% off");
  });

  it("omits the sign-off rather than cutting the offer or the link", () => {
    const body = "o".repeat(CHANNEL_LIMIT.facebook - longLink.length - 10);
    const text = assembleCopy("facebook", body, [], longLink, "en", "Warm regards, Anna");
    expect(text).toBe(`${body}\n${longLink}`);
  });

  it("does not repeat a sign-off the text already ends with", () => {
    const text = assembleCopy("facebook", "Offer.\nWarm regards, Anna", [], link, "en", "Warm regards, Anna");
    expect(text).toBe(`Offer.\nWarm regards, Anna\n${link}`);
  });
});

describe("texts that follow the offer", () => {
  const state = inLanguage("en");

  it("regenerates only the channels the owner has not edited and lists the edited ones", () => {
    const first = draftFor(state, "promote");
    const written = refreshCopy(state, first, NEUTRAL_VOICE);
    const edited: Draft = { ...first, ...written, copy: { ...written.copy, instagram: "My own words" }, copyEdited: ["instagram"] };
    const next = refreshCopy(state, { ...edited, discountPercent: 30 }, NEUTRAL_VOICE);
    expect(next.copy.instagram).toBe("My own words");
    expect(next.copy.facebook).toContain("30% off");
    expect(next.regenerated).toEqual(["facebook", "tiktok", "newsletter", "sms"]);
    expect(next.stale).toEqual(["instagram"]);
    expect(next.copyFor).toBe(offerSignature(state, { ...edited, discountPercent: 30 }));
  });

  it("writes every channel when nothing was edited", () => {
    expect(refreshCopy(state, draftFor(state, "promote"), NEUTRAL_VOICE)).toMatchObject({ regenerated: CHANNELS, stale: [] });
  });

  it("sees a change from poster badges as a new offer", () => {
    const wellness = draftFor(state, "wellness");
    expect(offerSignature(state, { ...wellness, posterEdits: { badges: ["Epassi"] } })).not.toBe(offerSignature(state, wellness));
  });
});

describe("what the AI is sent", () => {
  const voice = { signOff: "Warm regards, Anna", hashtags: ["#EkoGlow"], emoji: false, length: "short" as const };

  it("sends only style hints, never the sign-off or hashtags", () => {
    expect(postRequest("promote", "Offer.", "instagram", "en", voice)).toEqual({ offer: "Offer.", channel: "instagram", locale: "en", voice: { emoji: false, length: "short" } });
  });

  it("sends the length even without a sign-off or hashtags", () => {
    expect(postRequest(undefined, "Offer.", "sms", "en", { hashtags: [], emoji: true, length: "long" })?.voice).toEqual({ emoji: true, length: "long" });
    expect(postRequest(undefined, "Offer.", "sms", "en", NEUTRAL_VOICE)).toEqual({ offer: "Offer.", channel: "sms", locale: "en" });
  });

  it("never sends a review to the AI", () => {
    expect(postRequest("review", "“Loved it.” – Mira Q.", "instagram", "en", voice)).toBeNull();
  });
});

describe("closing lines that are not the owner's", () => {
  const pair = (line: string, name = "Spring offer") => [1, 2].map((n) => ({ ...campaign(`c${n}`, { instagram: `Offer ${n}.\n${line}\n${link}` }), name }));

  it("rejects each word of a multi-word customer name", () => {
    const state = { ...stateWith(...pair("See you soon, Mary")), customers: [{ firstName: "Mary Jane", lastName: "van der Berg" }] as DemoState["customers"] };
    expect(ownerVoice(state).signOff).toBeUndefined();
    expect(ownerVoice({ ...state, customers: [] }).signOff).toBe("See you soon, Mary");
  });

  it("rejects a closing line that is an unquoted review", () => {
    const text = "Best massage I have ever had. Truly relaxing.";
    const reviews = [{ text }] as DemoState["reviews"];
    for (const line of ["Best massage I have ever had.", text.toUpperCase()]) {
      expect(ownerVoice({ ...stateWith(...pair(line)), reviews }).signOff).toBeUndefined();
    }
    expect(ownerVoice({ ...stateWith(...pair("Best massage I have ever had.")), reviews: [] }).signOff).toBe("Best massage I have ever had.");
  });

  it("matches a campaign name only with 4 characters or more and at word boundaries", () => {
    expect(ownerVoice(stateWith(...pair("Good luck!", "Go"))).signOff).toBe("Good luck!");
    expect(ownerVoice(stateWith(...pair("Book Glow today", "Glow"))).signOff).toBeUndefined();
    expect(ownerVoice(stateWith(...pair("Glowing regards", "Glow"))).signOff).toBe("Glowing regards");
  });
});

describe("keycap emoji", () => {
  it("is detected and removed", () => {
    expect(ownerVoice(stateWith(campaign("a", { instagram: `Top 1️⃣ pick\n${link}` }))).emoji).toBe(true);
    expect(applyVoice({ text: "Top 1️⃣ pick", hashtags: [] }, { hashtags: [], emoji: false }).text).toBe("Top pick");
  });
});

describe("sign-off removal keeps words whole", () => {
  it("only removes a sign-off that starts a line or follows whitespace", () => {
    expect(assembleCopy("facebook", "Book with StudioEko", [], link, "en", "Eko")).toBe(`Book with StudioEko\nEko\n${link}`);
    expect(assembleCopy("facebook", "Book now Eko", [], link, "en", "Eko")).toBe(`Book now\nEko\n${link}`);
  });
});

describe("edits and late AI texts", () => {
  const state = inLanguage("en");
  const base = () => {
    const first = draftFor(state, "promote");
    return { ...first, ...refreshCopy(state, first, NEUTRAL_VOICE) } as Draft;
  };

  it("an edit marks the channel edited and no longer stale", () => {
    const draft = { ...base(), copyEdited: ["instagram" as const], copyStale: ["instagram" as const, "facebook" as const] };
    const patch = editCopy(draft, "instagram", "Mine");
    expect(patch).toMatchObject({ copy: { instagram: "Mine" }, copyEdited: ["instagram"], copyStale: ["facebook"] });
  });

  it("an edited channel stays stale when the offer changes, until it is edited again", () => {
    const first = base();
    const edited: Draft = { ...first, ...editCopy(first, "instagram", "At 20 percent") };
    const changed: Draft = { ...edited, discountPercent: 30 };
    const next = refreshCopy(state, changed, NEUTRAL_VOICE);
    expect(next.stale).toEqual(["instagram"]);
    expect(next.copyFor).not.toBe(edited.copyFor);
    expect(editCopy({ ...changed, copyStale: next.stale }, "instagram", "Now 30").copyStale).toEqual([]);
  });

  it("a late AI text never replaces an edited channel or an outdated one", () => {
    const draft = base();
    const written = draft.copy.facebook;
    expect(canApplyAiText(draft, "facebook", draft.copyFor, written)).toBe(true);
    expect(canApplyAiText({ ...draft, copyEdited: ["facebook"] }, "facebook", draft.copyFor, written)).toBe(false);
    expect(canApplyAiText(draft, "facebook", "other", written)).toBe(false);
    expect(canApplyAiText({ ...draft, copy: { ...draft.copy, facebook: "x" } }, "facebook", draft.copyFor, written)).toBe(false);
  });
});
