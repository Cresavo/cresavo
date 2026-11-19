import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { applyAction } from "@/concept/log/capture";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { checkSalonDetails } from "@/concept/ops/salon-details";

const day = "2026-11-23";
const meta = { at: 0, actor: "owner", source: "button" } as const;

describe("editing the salon's details", () => {
  const base = createDemoState(day);

  it("accepts the demo salon's own details unchanged, so one field can be edited alone", () => {
    expect(checkSalonDetails(base.salon)).toMatchObject({ ok: true });
    const next = reduce(base, { type: "salon/details", details: { phone: "08-123 456 78" } });
    expect(next.salon).toEqual({ ...base.salon, phone: "08-123 456 78" });
  });

  it("trims what is typed and leaves the stored field names and the booking link as they were", () => {
    const next = reduce(base, { type: "salon/details", details: { name: "  Studio   Fern ", area: " Södermalm " } });
    expect(next.salon.name).toBe("Studio Fern");
    expect(next.salon.area).toBe("Södermalm");
    expect(next.salon.slug).toBe(base.salon.slug);
    expect(Object.keys(next.salon).sort()).toEqual(Object.keys(base.salon).sort());
  });

  it("refuses an empty name, a bad phone number or email, and too long text", () => {
    expect(checkSalonDetails({ name: "" })).toEqual({ ok: false, problems: { name: "required" } });
    expect(checkSalonDetails({ name: "A" })).toEqual({ ok: false, problems: { name: "short" } });
    expect(checkSalonDetails({ name: "Studio Fern", phone: "call me" })).toEqual({ ok: false, problems: { phone: "phone" } });
    expect(checkSalonDetails({ name: "Studio Fern", email: "studio.fern" })).toEqual({ ok: false, problems: { email: "email" } });
    expect(checkSalonDetails({ name: "x".repeat(61) })).toEqual({ ok: false, problems: { name: "long" } });
    expect(checkSalonDetails({ name: "Studio Fern", phone: "", email: "" })).toMatchObject({ ok: true });
    for (const details of [{ name: " " }, { phone: "12" }, { email: "nope@" }, { address: "x".repeat(101) }]) {
      expect(reduce(base, { type: "salon/details", details }), JSON.stringify(details)).toBe(base);
    }
    expect(reduce(base, { type: "salon/details", details: { name: base.salon.name } })).toBe(base);
  });

  it("is listed in History with the old and new name, and can be undone", () => {
    const updated = applyAction(base, { type: "salon/details", details: { name: "Studio Fern", email: "hello@studiofern.example" } }, meta);
    expect(updated.salon.name).toBe("Studio Fern");
    expect(updated.log[0]).toMatchObject({ type: "salon/details", summary: "Salon details changed: salon name, email", before: base.salon.name, after: "Studio Fern" });
    expect(updated.log[0].patch).toBeTruthy();
    const undone = applyAction(updated, { type: "log/undo", id: updated.log[0].id }, meta);
    expect(undone.salon).toEqual(base.salon);
  });

  it("works the same for a new salon of your own", () => {
    const own = createSalon(day, { ...salonDraft("en"), name: "Studio Vide" });
    const next = applyAction(own, { type: "salon/details", details: { phone: "070-123 45 67", address: "Fictional street 1" } }, meta);
    expect(next.salon).toMatchObject({ name: "Studio Vide", phone: "070-123 45 67", address: "Fictional street 1" });
    expect(next.log[0].summary).toBe("Salon details changed: phone, street address");
  });
});
