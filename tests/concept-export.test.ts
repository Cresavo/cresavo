import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { bookingsCsv, customersCsv, defuseFormula, toCsv } from "@/concept/studio/more/export";

describe("concept data export", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", 3]])).toBe('a,"say ""hi""","x,y",3');
  });

  it("defuses every text column, ids, dates and phones included, and quotes CR", () => {
    expect(defuseFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(defuseFormula("-3 + 4")).toBe("'-3 + 4");
    expect(defuseFormula("Maja")).toBe("Maja");
    expect(toCsv([["first\rsecond", -3.5, "-3.50"]])).toBe('"first\rsecond",-3.5,-3.50');
    const state = createDemoState("2026-11-16");
    const customer = { ...state.customers[0], id: "@id", firstName: "=cmd", phone: "+46 70 900 00 00", since: "@2026-01-01" as const, note: "-1+1" };
    const row = customersCsv({ ...state, customers: [customer] }).split("\n")[1];
    expect(row).toBe(`'@id,'=cmd,${customer.lastName},'+46 70 900 00 00,${customer.email},'@2026-01-01,${customer.tags.join("; ")},'-1+1`);
    expect(customersCsv({ ...state, customers: [{ ...customer, phone: "070-111 11 11" }] })).toContain(",070-111 11 11,");
    const booking = { ...state.bookings[0], id: "=b1", customerId: "@c1" };
    expect(bookingsCsv({ ...state, bookings: [booking] }).split("\n")[1].startsWith("'=b1,")).toBe(true);
  });

  it("exports one row per customer and booking plus a header", () => {
    const state = createDemoState("2026-11-16");
    expect(customersCsv(state).split("\n")).toHaveLength(state.customers.length + 1);
    expect(bookingsCsv(state).split("\n")[0]).toBe("id,date,time,minutes,customer_id,service,staff,price_sek,status");
  });
});
