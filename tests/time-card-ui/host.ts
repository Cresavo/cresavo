import { expect, type Page } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/client";

type ToolCall = { name: string; arguments?: Record<string, unknown> };

// This is an explicit test host, never evidence of native ChatGPT rendering.
export async function mountTimeCard(
  page: Page,
  client: Client,
  html: string,
  initial: unknown,
  hooks: {
    call?: (args: ToolCall, next: () => Promise<unknown>) => Promise<unknown>;
  } = {},
) {
  const contexts: unknown[] = [];
  const calls: ToolCall[] = [];
  await page.exposeFunction(
    "cardBridge",
    async (message: { method: string; params: Record<string, unknown> }) => {
      if (message.method === "ui/initialize")
        return {
          protocolVersion: "2026-01-26",
          hostCapabilities: { updateModelContext: { text: true } },
          hostInfo: { name: "test-harness-not-chatgpt", version: "1" },
        };
      if (message.method === "ui/update-model-context") {
        contexts.push(message.params);
        return {};
      }
      if (message.method === "tools/call") {
        const args = message.params as ToolCall;
        calls.push(structuredClone(args));
        const next = () => client.callTool(args);
        return hooks.call ? hooks.call(args, next) : next();
      }
      return {};
    },
  );
  await page.setContent(
    '<iframe title="MCP Apps testvärd" style="width:100%;height:1600px;border:0" sandbox="allow-scripts allow-same-origin"></iframe>',
  );
  await page.evaluate((html) => {
    const frame = document.querySelector("iframe")!;
    window.addEventListener("message", async (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.method === "ui/notifications/size-changed") {
        frame.style.height = `${event.data.params.height}px`;
        return;
      }
      if (!event.data?.id) return;
      try {
        const result = await (
          window as unknown as {
            cardBridge: (message: unknown) => Promise<unknown>;
          }
        ).cardBridge(event.data);
        frame.contentWindow!.postMessage(
          { jsonrpc: "2.0", id: event.data.id, result },
          "*",
        );
      } catch {
        frame.contentWindow!.postMessage(
          {
            jsonrpc: "2.0",
            id: event.data.id,
            error: { code: -32000, message: "Synthetic transport failure" },
          },
          "*",
        );
      }
    });
    frame.srcdoc = html;
  }, html);
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("status")).toContainText(
    "Hämtar lediga demotider",
  );
  await page.evaluate(
    (result) =>
      document.querySelector("iframe")!.contentWindow!.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: result,
        },
        "*",
      ),
    initial,
  );
  await expect(
    frame.getByRole("heading", { name: "En stund för dig." }),
  ).toBeVisible();
  return { frame, contexts, calls };
}
