import { describe, expect, it } from "vitest";
import { assertTimeCardDemo } from "../src/mcp/time-card/guard";
import { timeCardSchema } from "../src/mcp/time-card/data";

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
    ])
      expect(() => assertTimeCardDemo(env, [])).toThrow(
        "TIME_CARD_DEMO_REFUSED",
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
