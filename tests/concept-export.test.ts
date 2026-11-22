import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { bookingsCsv, customersCsv, defuseFormula, toCsv } from "@/concept/studio/more/export";

describe("concept data export", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", 3]])).toBe('a,"say ""hi""","x,y",3');
  });

  it("defuses free text, writes phone numbers and amounts as values and quotes CR", () => {
    expect(defuseFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(defuseFormula("-3 + 4")).toBe("'-3 + 4");
    expect(defuseFormula("Maja")).toBe("Maja");
    expect(toCsv([["first\rsecond", -3.5, "-3.50"]])).toBe('"first\rsecond",-3.5,-3.50');
    const state = createDemoState("2026-11-16");
    const csv = customersCsv({ ...state, customers: [{ ...state.customers[0], firstName: "=cmd", phone: "+46 70 900 00 00", email: "+desk@mail.example", note: "-1+1" }] });
    expect(csv.split("\n")[1]).toContain("'=cmd");
    expect(csv).toContain(",+46 70 900 00 00,'+desk@mail.example,");
    expect(csv).toContain("'-1+1");
  });

  it("exports one row per customer and booking plus a header", () => {
    const state = createDemoState("2026-11-16");
    expect(customersCsv(state).split("\n")).toHaveLength(state.customers.length + 1);
    expect(bookingsCsv(state).split("\n")[0]).toBe("id,date,time,minutes,customer_id,service,staff,price_sek,status");
  });
});
