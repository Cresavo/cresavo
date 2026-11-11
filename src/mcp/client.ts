import { mcpEnvironment } from "./environment";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { ZONE } from "../lib/time";
import { formatBookingTime } from "../lib/format";
async function main() {
  const admin = process.argv.includes("--admin");
  const book = process.argv.includes("--book");
  if (book && !admin) throw new Error("MCP_CLIENT_BOOKING_REQUIRES_ADMIN");
  const client = new Client({
    name: "booking-lab-test-client",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    env: mcpEnvironment({ booking: book }),
    args: [
      "--import",
      "tsx",
      "src/mcp/server.ts",
      ...(admin ? ["--admin"] : []),
      ...(book ? ["--allow-bookings"] : []),
    ],
  });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    console.log("Verktyg:", tools.tools.map((t) => t.name).join(", "));
    let day = DateTime.now()
      .setZone("Europe/Stockholm")
      .plus({ days: 1 })
      .startOf("day");
    while (day.weekday > 5) day = day.plus({ days: 1 });
    let available: string[] = [];
    for (const [name, args] of [
      ["list_services", {}],
      ["get_availability", { serviceId: "fotvard", date: day.toISODate() }],
      ...(admin && !book
        ? [
            [
              "create_campaign_draft",
              {
                serviceId: "fotvard",
                title: "Fotvårdserbjudande",
                discountPercent: 20,
                validFrom: day.toISODate(),
                validUntil: day.plus({ days: 6 }).toISODate(),
              },
            ],
          ]
        : []),
    ] as [string, Record<string, unknown>][]) {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(JSON.stringify(result));
      if (name === "get_availability") {
        const block = result.content[0];
        if (block.type !== "text") throw new Error("MCP_CLIENT_INVALID_RESULT");
        available = JSON.parse(block.text) as string[];
      }
      console.log(name, JSON.stringify(result.content));
    }
    if (book) {
      if (!available.length) {
        console.log("Ingen ledig tid för testbokningen. Ingen bokning skapad.");
        return;
      }
      const start = available[0];
      const key = randomUUID();
      console.log("Testbokning: Fotvård");
      console.log(`Tid: ${formatBookingTime(start)} (${ZONE})`);
      console.log("Kund: Syntetisk MCP-testkund (example.test)");
      console.log(`Bokningsnyckel: ${key}`);
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise<string>((resolve) => {
        readline.once("line", resolve);
        readline.once("close", () => resolve(""));
        process.stdout.write("Bekräfta testbokning genom att skriva ja: ");
      });
      readline.close();
      if (answer.trim().toLowerCase() !== "ja") {
        console.log("Avbruten. Ingen bokning skapad.");
        return;
      }
      const result = await client.callTool({
        name: "create_booking",
        arguments: {
          serviceId: "fotvard",
          start,
          customerName: "Syntetisk MCP-testkund",
          customerEmail: `mcp-demo-${key}@example.test`,
          clientRequestId: key,
          confirmed: true,
        },
      });
      if (result.isError) throw new Error("MCP_CLIENT_BOOKING_FAILED");
      console.log("create_booking", JSON.stringify(result.content));
    }
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error("MCP_CLIENT_FAILED");
  process.exitCode = 1;
});
