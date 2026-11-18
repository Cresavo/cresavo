import { mcpEnvironment } from "./environment";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { ZONE } from "../lib/time";
import { formatBookingTime } from "../lib/format";
import { runWorkspaceDemo } from "./workspace-client";
async function main() {
  const admin = process.argv.includes("--admin");
  const book = process.argv.includes("--book");
  const workspace = process.argv.includes("--workspace");
  if (book && !admin) throw new Error("MCP_CLIENT_BOOKING_REQUIRES_ADMIN");
  if (workspace && (!admin || book))
    throw new Error("MCP_CLIENT_WORKSPACE_CONFIG_INVALID");
  const client = new Client({
    name: "booking-lab-test-client",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    env: mcpEnvironment({ booking: book, workspace }),
    args: [
      "--import",
      "tsx",
      "src/mcp/server.ts",
      ...(admin ? ["--admin"] : []),
      ...(book ? ["--allow-bookings"] : []),
      ...(workspace ? ["--allow-workspace"] : []),
    ],
  });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    console.log("Tools:", tools.tools.map((t) => t.name).join(", "));
    if (workspace) {
      await runWorkspaceDemo(client);
      return;
    }
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
        console.log("There are no available times for a test booking.");
        return;
      }
      const start = available[0];
      const key = randomUUID();
      console.log("Test booking: Fotvård");
      console.log(`Time: ${formatBookingTime(start)} (${ZONE})`);
      console.log("Customer: Syntetisk MCP-testkund (example.test)");
      console.log(`Booking key: ${key}`);
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise<string>((resolve) => {
        readline.once("line", resolve);
        readline.once("close", () => resolve(""));
        process.stdout.write("Type ja to confirm the test booking: ");
      });
      readline.close();
      if (answer.trim().toLowerCase() !== "ja") {
        console.log("Cancelled before creating the booking.");
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
