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
      title: "My workday",
      description:
        "View a team member’s workday, next visit and availability for the selected treatment in the local demo. Up to 20 bookings per page, with no contact details or writes.",
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
              text: `${result.date}: ${result.bookings.length} bookings on this page for ${result.selectedStaff?.name ?? "no active team member"}. ${result.nextCursor ? "More bookings are available." : ""} ${result.notice}`,
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
