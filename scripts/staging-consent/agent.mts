// The agent: a real MCP SDK client in its own process. It knows only the gateway's
// public HTTPS origin and its own agent key. It has no database, inbox or salon access.
import { createInterface } from "node:readline";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.env.STAGING_AGENT_GATEWAY;
const key = process.env.STAGING_AGENT_KEY;
if (!base || !key) throw new Error("AGENT_CONFIG_MISSING");
const client = new Client({ name: "cresavo-staging-agent", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/v1/mcp", base), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  }));
  for await (const line of createInterface({ input: process.stdin })) {
    let id: unknown;
    try {
      const request = JSON.parse(line);
      id = request.id;
      if (request.list) {
        const tools = (await client.listTools()).tools.map(tool => tool.name);
        process.stdout.write(JSON.stringify({ id, tools }) + "\n");
        continue;
      }
      const result = await client.callTool({ name: request.name, arguments: request.args });
      const text = (result.content as { type: string; text?: string }[]).find(c => c.type === "text")?.text ?? "{}";
      process.stdout.write(JSON.stringify({ id, isError: Boolean(result.isError), body: result.structuredContent ?? JSON.parse(text), text }) + "\n");
    } catch {
      process.stdout.write(JSON.stringify({ id, failure: "MCP_TRANSPORT_FAILED" }) + "\n");
    }
  }
} finally {
  await client.close();
}
