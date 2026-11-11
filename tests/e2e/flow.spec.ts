import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
test("HTTP avvisar obehöriga anrop och ogiltig JSON utan feldetaljer", async ({ request }) => {
    const origin = { origin: "http://localhost:3000" };
    for (const data of [null, {}, { password: "wrong" }, { password: "x".repeat(1025) }]) {
        const response = await request.post("/api/admin/login", { data, headers: origin });
        // A null Playwright body may be sent as empty JSON; both are rejected safely.
        expect([400, 401]).toContain(response.status());
        expect(await response.text()).not.toMatch(/TypeError|SyntaxError|stack|password/);
    }
    const malformed = await request.post("/api/admin/login", { data: Buffer.from("{CANARY"), headers: { ...origin, "content-type": "application/json" } });
    expect(malformed.status()).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Kontrollera uppgifterna" });
    const denied = await request.post("/api/admin/login", { data: { password: process.env.ADMIN_PASSWORD }, headers: { origin: "http://foreign.test" } });
    expect(denied.status()).toBe(403);
    const publish = await request.post("/api/admin/publish", { data: { id: "synthetic" }, headers: origin });
    expect(publish.status()).toBe(403);
});
test("bokning, skyddad administration och MCP-utkast som publiceras", async ({ page, request }) => {
    const marker = `e2e-${Date.now()}`, email = `${marker}@example.test`;
    const client = new Client({ name: "e2e", version: "1.0.0" });
    try {
        await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--env-file=.env", "--import", "tsx", "src/mcp/server.ts", "--admin"] }));
        const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!;
        const draft = await client.callTool({ name: "create_campaign_draft", arguments: { serviceId: "fotvard", title: marker, discountPercent: 20, validFrom: today, validUntil: today } });
        expect(draft.isError).not.toBeTruthy();
        let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 5 }).startOf("day");
        while (day.weekday > 5)
            day = day.plus({ days: 1 });
        const availability = await client.callTool({ name: "get_availability", arguments: { serviceId: "fotvard", date: day.toISODate() } });
        expect(availability.isError).not.toBeTruthy();
        const forbidden = await request.post("/api/admin/publish", { data: { id: "fake" }, headers: { origin: "http://localhost:3000" } });
        expect(forbidden.status()).toBe(403);
        await page.goto("/");
        await expect(page.getByText(marker)).toHaveCount(0);
        await page.locator("#service").selectOption("fotvard");
        await page.locator("#date").fill(day.toISODate()!);
        await page.getByRole("button", { name: "Visa lediga tider" }).click();
        await expect(page.locator("#slot option").nth(1)).toBeAttached();
        const slot = await page.locator("#slot option").nth(1).getAttribute("value");
        await page.locator("#slot").selectOption(slot!);
        await page.locator("#name").fill("Testkund");
        await page.locator("#email").fill(email);
        await page.getByRole("button", { name: "Bekräfta testbokning" }).click();
        await expect(page.getByText("Din testbokning är registrerad.")).toBeVisible();
        await page.goto("/admin");
        await page.locator("#password").fill(process.env.ADMIN_PASSWORD!);
        await page.getByRole("button", { name: "Logga in" }).click();
        await expect(page.getByText(email)).toBeVisible();
        const campaign = page.locator("div", { has: page.getByText(marker, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Publicera" }) }).last();
        await campaign.getByRole("button", { name: "Publicera" }).click();
        await expect(page.getByText("Publicerad")).toBeVisible();
        await page.goto("/");
        await expect(page.getByText(marker)).toBeVisible();
    }
    finally {
        await client.close();
        await db.booking.deleteMany({ where: { customerEmail: email } });
        await db.campaign.deleteMany({ where: { title: marker } });
        await db.$disconnect();
    }
});
