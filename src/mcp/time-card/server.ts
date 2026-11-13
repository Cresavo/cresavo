import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { assertTimeCardDemo } from "./guard";
import { timeCardData, timeCardSchema, timeCardServices } from "./data";
import { db } from "../../lib/db";
import { safeToolSchema } from "../reply";
import { safeFailure } from "../../lib/errors";

try {
  assertTimeCardDemo();
} catch {
  console.error("TIME_CARD_DEMO_REFUSED");
  process.exit(1);
}
const uri = "ui://booking-lab/time-card-v1.html";
const ui = {
  prefersBorder: false,
  csp: {
    connectDomains: [],
    resourceDomains: [],
    frameDomains: [],
    baseUriDomains: [],
  },
};

serveStdio(() => {
  const server = new McpServer({
    name: "booking-lab-time-card-demo",
    version: "0.1.0",
  });
  server.registerResource(
    "time-card",
    uri,
    { mimeType: "text/html;profile=mcp-app", _meta: { ui } },
    async () => ({
      contents: [
        {
          uri,
          mimeType: "text/html;profile=mcp-app",
          text: readFileSync(new URL("./ui.html", import.meta.url), "utf8"),
          _meta: { ui },
        },
      ],
    }),
  );
  server.registerTool(
    "show_time_picker",
    {
      title: "Välj en demotid",
      description:
        "Visa ett interaktivt svenskt tidvalskort för syntetiska behandlingar. Endast läsning: ett tidsval är aldrig en bokning. Sök högst 28 dagar från idag. Omittera staffId vid byte av serviceId.",
      inputSchema: safeToolSchema(timeCardSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: uri },
        "openai/outputTemplate": uri,
        "openai/widgetAccessible": true,
      },
    },
    async (input) => {
      try {
        const result = await timeCardData(input);
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `${result.service.name}, ${result.service.duration} minuter, ${result.service.priceOre / 100} SEK hos ${result.selectedStaff.name}. ${result.date}: ${result.slots.map(({ start }) => start).join(", ") || "Inga lediga tider denna dag; välj nästa dag."} ${result.notice}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: safeFailure(error).message },
          ],
        };
      }
    },
  );
  server.registerTool(
    "list_services",
    {
      description: "Lista demobehandlingar utan kunddata",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const services = await timeCardServices();
        return {
          structuredContent: { services },
          content: [{ type: "text" as const, text: JSON.stringify(services) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: safeFailure(error).message },
          ],
        };
      }
    },
  );
  server.server.onclose = () => {
    void db
      .$disconnect()
      .catch(() => console.error("TIME_CARD_DISCONNECT_FAILED"));
  };
  return server;
});
