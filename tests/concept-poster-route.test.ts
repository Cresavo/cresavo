import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/concept/poster/route";

// The poster render route: same-origin only, strict input, SVG out. Fictional salon.

const photo = `data:image/jpeg;base64,${readFileSync("tests/fixtures/poster-photo.jpg").toString("base64")}`;
const body = {
  template: "price", format: "post",
  data: { headline: "Fotvård", price: "750 kr", detail: "60 min.", photo, colors: { accent: "#2f5d50", ink: "#1f2a26", background: "#f7f1e8" }, signature: { salon: "Salong Eko", phone: "070-123 45 67", link: "eko.example" } },
};
const post = (payload: unknown, headers: Record<string, string> = { origin: "http://localhost", "sec-fetch-site": "same-origin" }) =>
  POST(new Request("http://localhost/api/concept/poster", { method: "POST", body: typeof payload === "string" ? payload : JSON.stringify(payload), headers: { "content-type": "application/json", host: "localhost", ...headers } }), {});

describe("poster route", () => {
  it("renders an SVG for a valid same-origin request", async () => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toMatch(/^<svg/);
  }, 20_000);

  it("refuses other sites, broken JSON and unknown templates", async () => {
    expect((await post(body, { origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ ...body, template: "anything" })).status).toBe(400);
    expect((await post({ ...body, data: { ...body.data, photo: "data:image/webp;base64,AAAA" } })).status).toBe(400);
  });
});
