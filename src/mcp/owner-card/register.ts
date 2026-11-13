import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/server";
import { assertOwnerCard, ownerWorkday, workdaySchema } from "./data";
import { safeToolSchema } from "../reply";
import { safeFailure } from "../../lib/errors";

export function registerOwnerCard(server: McpServer) {
  assertOwnerCard();
  const resourceUri = "ui://booking-lab/workday-v1.html";
  const ui = {
    csp: {
      connectDomains: [],
      resourceDomains: [],
      frameDomains: [],
      baseUriDomains: [],
    },
  };
  server.registerResource(
    "workday-card",
    resourceUri,
    { mimeType: "text/html;profile=mcp-app", _meta: { ui } },
    async () => ({
      contents: [
        {
          uri: resourceUri,
          mimeType: "text/html;profile=mcp-app",
          text: readFileSync(new URL("./ui.html", import.meta.url), "utf8"),
          _meta: { ui },
        },
      ],
    }),
  );
  server.registerTool(
    "show_workday",
    {
      title: "Min arbetsdag",
      description:
        "Läs en vald medarbetares arbetsdag, nästa besök och lediga tider för vald behandling i lokal syntetisk demo. Max20 bokningar/sida. Inga kontaktuppgifter eller skrivningar.",
      inputSchema: safeToolSchema(workdaySchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri },
        "openai/outputTemplate": resourceUri,
        "openai/widgetAccessible": true,
      },
    },
    async (input) => {
      try {
        const result = await ownerWorkday(input);
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `${result.date}: ${result.bookings.length} bokningar på denna sida för ${result.selectedStaff?.name ?? "ingen aktiv personal"}. ${result.nextCursor ? "Fler bokningar finns." : ""} ${result.notice}`,
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: safeFailure(e).message }],
        };
      }
    },
  );
}
