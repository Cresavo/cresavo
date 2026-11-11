import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { DateTime } from "luxon";
async function main() {
  const admin = process.argv.includes("--admin");
  const client = new Client({
    name: "booking-lab-test-client",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--env-file=.env",
      "--import",
      "tsx",
      "src/mcp/server.ts",
      ...(admin ? ["--admin"] : []),
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
    for (const [name, args] of [
      ["list_services", {}],
      ["get_availability", { serviceId: "fotvard", date: day.toISODate() }],
      ...(admin
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
      console.log(name, JSON.stringify(result.content));
    }
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error("MCP_CLIENT_FAILED");
  process.exitCode = 1;
});
