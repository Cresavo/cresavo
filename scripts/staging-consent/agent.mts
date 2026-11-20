// The agent: a real MCP SDK client in its own process. It is given only the gateway's public
// HTTPS origin and its own agent key: no database URL, session secret, salon origin or inbox.
// It runs as the operator's OS user on the same machine; this limits its configuration and the
// API it is pointed at, not what the operating system would let it reach.
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
