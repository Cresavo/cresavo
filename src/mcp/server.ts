import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { listServices, getAvailability, listBookingsForMcp, bookingListSchema, createCampaign } from "../lib/domain";
import { safeFailure } from "../lib/errors";
import { db } from "../lib/db";
const admin = process.argv.includes("--admin");
async function reply(operation: () => Promise<unknown>) {
    try {
        return { content: [{ type: "text" as const, text: JSON.stringify(await operation()) }] };
    }
    catch (error) {
        return { isError: true, content: [{ type: "text" as const, text: safeFailure(error).message }] };
    }
}
serveStdio(() => {
    const server = new McpServer({ name: "booking-lab-se", version: "0.1.0" });
    server.registerTool("list_services", { description: "Lista demosalongens behandlingar", inputSchema: z.object({}) }, async () => reply(() => listServices()));
    server.registerTool("get_availability", { description: "Lediga tider för en behandling och ett lokalt datum YYYY-MM-DD", inputSchema: z.object({ serviceId: z.string(), date: z.string() }) }, async (v) => reply(() => getAvailability(v.serviceId, v.date)));
    if (admin) {
        server.registerTool("list_bookings", { description: "Lista minimerade bokningar i ett datumintervall; endast betrodd lokal administratör", inputSchema: bookingListSchema }, async (v) => reply(() => listBookingsForMcp(v)));
        server.registerTool("create_campaign_draft", { description: "Skapa opublicerat erbjudande. Datum anges YYYY-MM-DD; publicering sker manuellt i administrationen.", inputSchema: z.object({ serviceId: z.string(), title: z.string(), discountPercent: z.number().int(), validFrom: z.string(), validUntil: z.string() }) }, async (v) => reply(() => createCampaign(v)));
    }
    server.server.onclose = () => { void db.$disconnect().catch(() => { console.error("MCP_DISCONNECT_FAILED"); }); };
    return server;
});
