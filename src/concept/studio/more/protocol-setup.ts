import type { TokenSource } from "../../server/token";

// What More > Your data & AI needs to show the copy-paste setup per AI client.
// The server only ever sends the public development token, never a configured one.

export interface ProtocolInfo {
  paths: { mcp: string; a2a: string; agentCard: string; usp: string };
  mcp: { token: TokenSource; devToken?: string };
}

export const SERVER_NAME = "flerdo-demo";

export async function fetchProtocolInfo(): Promise<ProtocolInfo> {
  const response = await fetch("/api/concept/protocols", { cache: "no-store" });
  if (!response.ok) throw new Error(`Protocol info failed with ${response.status}`);
  return (await response.json()) as ProtocolInfo;
}

/** The token as it goes into a shell command: the demo token itself, or the variable that holds the configured one. */
export function shellToken(info: ProtocolInfo): string {
  return info.mcp.devToken ?? "$CONCEPT_MCP_TOKEN";
}

export function claudeCodeCommand(endpoint: string, token: string): string {
  return `claude mcp add --transport http ${SERVER_NAME} ${endpoint} --header "Authorization: Bearer ${token}"`;
}

/** Claude Desktop reaches a remote server with a bearer token through the `mcp-remote` bridge. */
export function claudeDesktopConfig(endpoint: string, info: ProtocolInfo): string {
  const token = info.mcp.devToken ?? "<your CONCEPT_MCP_TOKEN>";
  const server = { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", "Authorization:${AUTH_HEADER}"], env: { AUTH_HEADER: `Bearer ${token}` } };
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: server } }, null, 2);
}
