import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { salonFactsNote } from "@/concept/receptionist/facts";
import { studioStoreHost } from "@/concept/receptionist/host";
import { callerPhone, salonDialing, spokenPhone } from "@/concept/receptionist/phone";
import { newCallMemory, runReceptionistTool } from "@/concept/receptionist/tools";
import { salonClock } from "@/concept/tools/clock";
import { MemoryStudioStore } from "@/concept/store/memory-studio-store";

describe("caller phone numbers", () => {
  it("keeps the leading 0, writes +46 and 0046 the Swedish way and keeps other countries' numbers", () => {
    expect(callerPhone("0123456789")).toEqual({ ok: true, phone: "0123456789" });
    expect(callerPhone(" 070-987 65 43 ")).toEqual({ ok: true, phone: "0709876543" });
    expect(callerPhone("+46 70 987 65 43")).toEqual({ ok: true, phone: "0709876543" });
    expect(callerPhone("+46 (0)70 987 65 43")).toEqual({ ok: true, phone: "0709876543" });
    expect(callerPhone("0046701234567")).toEqual({ ok: true, phone: "0701234567" });
    expect(callerPhone("+44 20 7946 0958")).toEqual({ ok: true, phone: "+442079460958" });
    expect(callerPhone("+44 (0)20 7946 0958")).toEqual({ ok: true, phone: "+442079460958" });
    expect(callerPhone("+39 02 1234 5678")).toEqual({ ok: true, phone: "+390212345678" });
  });

  it("refuses a number heard without its 0, and numbers that are not numbers", () => {
    expect(callerPhone("123456789")).toEqual({ ok: false, reason: "missing_zero" });
    expect(callerPhone("1111111")).toEqual({ ok: false, reason: "unclear" });
    expect(callerPhone("070 12")).toEqual({ ok: false, reason: "unclear" });
    expect(callerPhone("070-abc")).toEqual({ ok: false, reason: "unclear" });
    // A salon outside Sweden: national numbers without a 0 in front are kept, +46 keeps its country code.
    const us = salonDialing("+1 212 555 0100", "USD");
    expect(us).toEqual({ trunkZero: false, swedish: false });
    expect(callerPhone("2125550123", us)).toEqual({ ok: true, phone: "2125550123" });
    expect(callerPhone("123456789012", us)).toEqual({ ok: true, phone: "123456789012" });
    expect(callerPhone("+46 70 987 65 43", us)).toEqual({ ok: true, phone: "+46709876543" });
    expect(salonDialing("001 212 555 0100", "USD")).toEqual({ trunkZero: false, swedish: false });
    expect(salonDialing("+47 22 12 34 56", "NOK")).toEqual({ trunkZero: false, swedish: false });
    expect(salonDialing("+44 20 7946 0958", "GBP")).toEqual({ trunkZero: true, swedish: false });
    expect(callerPhone("+45 01 23 45 67")).toEqual({ ok: true, phone: "+4501234567" });
    expect(callerPhone("22123456", salonDialing("+47 22 12 34 56", "NOK"))).toEqual({ ok: true, phone: "22123456" });
    // A UK salon written the national way: trunk zero, but not Sweden.
    const uk = salonDialing("020 7946 0958", "GBP");
    expect(uk).toEqual({ trunkZero: true, swedish: false });
    expect(callerPhone("+46 (0)70 987 65 43", uk)).toEqual({ ok: true, phone: "+46709876543" });
    expect(callerPhone("7946 0958", uk)).toEqual({ ok: false, reason: "missing_zero" });
    expect(salonDialing("08-123 45 67", "SEK")).toEqual({ trunkZero: true, swedish: true });
    expect(salonDialing("+46 8 123 45 67", "EUR")).toEqual({ trunkZero: true, swedish: true });
    expect(salonDialing("0046 8 123 45 67", "SEK")).toEqual({ trunkZero: true, swedish: true });
    expect(callerPhone("012345678901")).toEqual({ ok: false, reason: "unclear" });
  });

  it("reads a number back smoothly in groups, always starting with noll", () => {
    expect(spokenPhone("0703456780", "sv")).toBe("noll sjuttio, tre fyrtiofem, sextiosju åttio");
    expect(spokenPhone("0123456789", "sv")).toBe("noll tolv, tre fyrtiofem, sextiosju åttionio");
    expect(spokenPhone("081234567", "sv")).toBe("noll åtta, ett tjugotre, fyrtiofem sextiosju");
    expect(spokenPhone("0701050607", "sv")).toBe("noll sjuttio, ett noll fem, noll sex noll sju");
    expect(spokenPhone("2125550123", "en")).toBe("two twelve, five fifty-five, zero one twenty-three");
    expect(spokenPhone("0709876543", "en")).toBe("zero seventy, nine eighty-seven, sixty-five forty-three");
    expect(spokenPhone("+442079460958", "sv")).toBe("plus fyrtiofyra, två noll sju, nio fyrtiosex, noll nio femtioåtta");
  });
});

describe("the salon as Maja says it", () => {
  const today = "2026-11-16";
  const NOW = Date.parse(`${today}T08:00:00Z`);

  it("names the demo treatments in the salon's language and books with the number as said, 0 and all", async () => {
    const store = new MemoryStudioStore({ tenants: { demo: createDemoState(today) }, now: () => NOW });
    const host = studioStoreHost(store, "demo", () => NOW);
    const stored = (await store.load("demo"))!.state;
    const view = { state: stored, clock: salonClock(new Date(NOW)), instant: NOW };
    // The demo's data is stored in English; a Swedish call hears the Swedish names, an English call the English ones.
    expect(salonFactsNote(view, "sv")).toContain("basic-foot-care: Enkel fotvård");
    expect(salonFactsNote(view, "sv")).toMatch(/måndag/);
    expect(salonFactsNote(view, "en")).toContain("basic-foot-care: Basic foot care");
    const handover = { title: "Call back", body: ({ reason }: { reason: string }) => reason };
    const memory = newCallMemory("call-sv");
    const run = (tool: string, args: object) => runReceptionistTool({ host, memory, handover, language: "sv" }, tool, JSON.stringify(args));
    let slot: { date: string; time: string; staffId: string } | undefined;
    for (let offset = 1; offset < 14 && !slot; offset++) {
      const date = new Date(NOW + offset * 86_400_000).toISOString().slice(0, 10);
      const free = await run("find_free_times", { serviceId: "basic-foot-care", date }) as { open?: boolean; treatment?: string; times?: { time: string; staffId: string }[] };
      if (free.times?.length) {
        expect(free.treatment).toBe("Enkel fotvård");
        slot = { date, ...free.times[0] };
      }
    }
    expect(slot).toBeDefined();
    const details = { serviceId: "basic-foot-care", staffId: slot!.staffId, date: slot!.date, time: slot!.time, callerName: "Daniel Milton", callerPhone: "0123456789" };
    expect(await run("book_appointment", { ...details, callerPhone: "123456789", confirmed: false })).toMatchObject({ ok: false, error: "phone_missing_zero" });
    const readBack = await run("book_appointment", { ...details, confirmed: false });
    expect(readBack).toMatchObject({ status: "needs_confirmation", readBack: { phone: "0123456789", phoneSpoken: { sv: "noll tolv, tre fyrtiofem, sextiosju åttionio", en: "zero twelve, three forty-five, sixty-seven eighty-nine" } } });
    // The caller switched to English between the read-back and the yes: the booking still goes through, now in English.
    expect(await run("book_appointment", { ...details, confirmed: true, spokenLanguage: "en" })).toMatchObject({ ok: true, status: "booked", treatment: "Basic foot care" });
    const after = (await store.load("demo"))!.state;
    // Stored data keeps its own names; the customer's number keeps its 0.
    expect(after.services.find((service) => service.id === "basic-foot-care")!.name).toBe(stored.services.find((service) => service.id === "basic-foot-care")!.name);
    expect(after.customers.some((customer) => customer.phone === "0123456789")).toBe(true);
  });
});
