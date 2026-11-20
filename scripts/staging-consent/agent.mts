// The agent: a real MCP SDK client in its own process. It knows only the gateway's
// public HTTPS origin and its own agent key. It has no database, inbox or salon access.
import { createInterface } from "node:readline";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { agentReply } from "./agent-reply.mjs";

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
        const listed = await client.listTools();
        process.stdout.write(JSON.stringify({ id, tools: listed.tools.map(tool => tool.name), raw: JSON.stringify(listed) }) + "\n");
        continue;
      }
      const result = await client.callTool({ name: request.name, arguments: request.args });
      process.stdout.write(agentReply(id, result) + "\n");
    } catch {
      process.stdout.write(JSON.stringify({ id, failure: "MCP_TRANSPORT_FAILED" }) + "\n");
    }
  }
} finally {
  await client.close();
}
