import { describe, it, expect } from "vitest";
import { bookingCalendarFile } from "../src/mcp/time-card/calendar-file";
import { assertOwnerCard, workdaySchema } from "../src/mcp/owner-card/data";
import { cardHistorySchema } from "../src/mcp/time-card/recovery";

describe("Kalenderfil och avgränsad ägarprofil", () => {
  it("har stabil UID, UTC över DST-gränser och behandlingslängd utan buffert", () => {
    for (const start of ["2027-03-28T00:30:00Z", "2027-10-31T00:30:00Z"]) {
      const b = {
        id: "synthetic",
        serviceName: "Fotvård",
        staffName: "Demo",
        startsAt: start,
        duration: 60,
        version: 2,
      };
      const ics = bookingCalendarFile(b, new Date("2026-11-13T12:00:00Z"));
      expect(ics).toContain("UID:synthetic@booking-lab.example.test\r\n");
      expect(ics).toContain(
        `DTSTART:${start.slice(0, 10).replace(/-/g, "")}T003000Z`,
      );
      expect(ics).toContain(
        `DTEND:${start.slice(0, 10).replace(/-/g, "")}T013000Z`,
      );
      expect(ics).toContain("SEQUENCE:2");
      expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
      expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|mailto|VALARM/);
    }
  });
  it("escapar innehåll, hindrar radinjektion och viker UTF-8 korrekt", () => {
    const ics = bookingCalendarFile({
      id: "demo",
      serviceName: "Massage, lätt; rygg\\\r\nATTENDEE:bad",
      staffName: "Å".repeat(90),
      startsAt: "2026-11-16T08:00:00Z",
      duration: 30,
      version: 1,
    });
    expect(ics).toContain("Massage\\, lätt\\; rygg\\\\\\nATTENDEE:bad");
    expect(ics).not.toContain("\r\nATTENDEE:");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(
      true,
    );
    expect(ics).not.toContain("�");
  });
  it("ägarprofil kräver uttrycklig lokal opt-in och kan inte blandas med skrivprofil", () => {
    const env = {
      BOOKING_OWNER_CARD_DEMO: "1",
      SESSION_SECRET: "synthetic".repeat(8),
      DATABASE_URL: "postgresql://synthetic@localhost/workday_test",
    };
    const flags = ["--admin", "--workday-card"];
    expect(() => assertOwnerCard(env, flags)).not.toThrow();
    for (const patch of [
      { BOOKING_OWNER_CARD_DEMO: "0" },
      { NODE_ENV: "production" },
      { VERCEL_REGION: "fra1" },
      { DATABASE_URL: "postgresql://synthetic@remote.test/workday_test" },
      { SESSION_SECRET: "short" },
      { BOOKING_OWNER_WEB_ORIGIN: "https://attacker.test" },
    ])
      expect(() => assertOwnerCard({ ...env, ...patch }, flags)).toThrow(
        "OWNER_CARD_DEMO_REFUSED",
      );
    for (const args of [
      [],
      ["--workday-card"],
      [...flags, "--allow-workspace"],
      [...flags, "--allow-bookings"],
    ])
      expect(() => assertOwnerCard(env, args)).toThrow();
  });
  it("tillåter inte id/e-post/aktör i återläsnings- eller ägarschema", () => {
    for (const v of [
      { id: "known" },
      { email: "canary@example.test" },
      { scope: "forged" },
      { actor: "admin" },
    ]) {
      expect(cardHistorySchema.safeParse(v).success).toBe(false);
      expect(workdaySchema.safeParse(v).success).toBe(false);
    }
    expect(workdaySchema.safeParse({ date: "2027-02-30" }).success).toBe(false);
  });
});
