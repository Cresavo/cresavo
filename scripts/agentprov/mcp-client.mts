// Real SDK transport client; this is not a claim that an AI assistant ran it.
import { createInterface } from "node:readline";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.env.AGENTPROV_BASE_URL!;
const key = process.env.AGENTPROV_KEY!;
if (!base || !key) throw new Error("PROOF_CONFIG_MISSING");
const client = new Client({ name: "agentprov-http-mcp", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/v1/mcp", base), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  }));
  for await (const line of createInterface({ input: process.stdin })) {
    try {
      const { id, name, args } = JSON.parse(line);
      const result = await client.callTool({ name, arguments: args });
      const body = result.structuredContent ?? JSON.parse(
        (result.content as { type: string; text?: string }[]).find(c => c.type === "text")?.text ?? "{}",
      );
      process.stdout.write(JSON.stringify({ id, isError: Boolean(result.isError), body }) + "\n");
    } catch {
      process.stdout.write(JSON.stringify({ failure: "MCP_TRANSPORT_FAILED" }) + "\n");
    }
  }
} finally {
  await client.close();
}
