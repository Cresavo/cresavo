import { describe, expect, it } from "vitest";
import { assertTimeCardDemo } from "../src/mcp/time-card/guard";
import { timeCardSchema } from "../src/mcp/time-card/data";
import { cardBookingSchema } from "../src/mcp/time-card/booking";

const local = {
  BOOKING_TIME_CARD_DEMO: "1",
  DATABASE_URL: "postgresql://synthetic@127.0.0.1:55451/card_demo",
};
describe("Tidvalskortets lokala gräns", () => {
  it("är opt-in och vägrar produktions- och Vercelmiljö", () => {
    expect(() => assertTimeCardDemo(local, [])).not.toThrow();
    for (const env of [
      { ...local, BOOKING_TIME_CARD_DEMO: "0" },
      { ...local, NODE_ENV: "production" },
      { ...local, VERCEL_ENV: "preview" },
      { ...local, VERCEL: "1" },
      { ...local, VERCEL_URL: "synthetic.vercel.app" },
    ])
      expect(() => assertTimeCardDemo(env, [])).toThrow(
        "TIME_CARD_DEMO_REFUSED",
      );
  });
  it("kräver separat opt-in, båda flaggor och hemlighet för bokningsprovet", () => {
    const enabled = {
      ...local,
      BOOKING_TIME_CARD_BOOKINGS: "1",
      SESSION_SECRET: "synthetic-secret".repeat(4),
    };
    expect(() =>
      assertTimeCardDemo(enabled, ["--admin", "--allow-bookings"]),
    ).not.toThrow();
    for (const flags of [
      [],
      ["--admin"],
      ["--allow-bookings"],
      ["--admin", "--allow-bookings", "--allow-workspace"],
    ])
      expect(() => assertTimeCardDemo(enabled, flags)).toThrow(
        "TIME_CARD_DEMO_REFUSED",
      );
    expect(() =>
      assertTimeCardDemo({ ...enabled, SESSION_SECRET: "short" }, [
        "--admin",
        "--allow-bookings",
      ]),
    ).toThrow("TIME_CARD_DEMO_REFUSED");
  });
  it("tar inte emot kontaktuppgifter, obekräftade anrop eller fria retry-nycklar", () => {
    const input = {
      serviceId: "massage",
      staffId: "staff-demo",
      serviceVersion: 1,
      start: "2026-11-16T09:00:00Z",
      clientRequestId: "a2fd936d-526b-4be4-90d5-355500c809ec",
      confirmed: true,
    };
    expect(cardBookingSchema.safeParse(input).success).toBe(true);
    for (const patch of [
      { customerEmail: "real@example.com" },
      { customerName: "Someone" },
      { customerId: "secret" },
      { confirmed: false },
      { confirmed: undefined },
      { clientRequestId: "x".repeat(65) },
      { start: "not-a-date" },
      { serviceVersion: undefined },
      { staffId: undefined },
    ])
      expect(cardBookingSchema.safeParse({ ...input, ...patch }).success).toBe(
        false,
      );
  });
  it("vägrar fjärrdatabas och alternativa hostparametrar", () => {
    for (const DATABASE_URL of [
      "postgresql://synthetic@remote.test/card_demo",
      "postgresql://synthetic@localhost/customer",
      local.DATABASE_URL + "?host=remote.test",
    ])
      expect(() => assertTimeCardDemo({ ...local, DATABASE_URL }, [])).toThrow(
        "TIME_CARD_DEMO_REFUSED",
      );
  });
  it("kan inte aktivera admin- eller skrivverktyg", () => {
    for (const flag of ["--admin", "--allow-bookings", "--allow-workspace"])
      expect(() => assertTimeCardDemo(local, [flag])).toThrow(
        "TIME_CARD_DEMO_REFUSED",
      );
  });
  it("avvisar extra fält, personuppgifter och omöjliga datum", () => {
    expect(timeCardSchema.safeParse({}).success).toBe(true);
    for (const args of [
      { date: "2027-02-30" },
      { date: "garbage" },
      { customerEmail: "canary@example.test" },
      { serviceId: "x".repeat(129) },
    ])
      expect(timeCardSchema.safeParse(args).success).toBe(false);
  });
});
