import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { readCapped } from "../site/waitlist-server";
import { clientFromUserAgent, type AgentClient, type AgentProposal } from "../tools/agent-proposal";
import { ToolError } from "../tools/define";
import { conceptTools, findTool, type ConceptTool } from "../tools/registry";
import { createProposal, findProposal, toolContext } from "./demo-business";
import type { RequestLogContext } from "./logger";
import { createRateLimiter } from "./rate-limit";
import { checkBearer } from "./token";
import { BRAND } from "../brand";

// HTTP MCP adapter for the concept: registers every tool from the shared
// registry, checks the demo bearer token, limits calls per token and turns
// write tools into proposals in the owner's inbox. Stateless JSON responses,
// following the engine's /api/v1/mcp.

const MAX_BODY = 64 * 1024;
const takeCall = createRateLimiter({ max: 120, windowMs: 60_000 });

const idempotencyKey = z.string().min(8).max(128).regex(/^[A-Za-z0-9_.:-]+$/).describe("A unique key per intended change. Retrying with the same key and arguments returns the same proposal.");

interface Caller {
  /** Short hash of the token, for idempotency scope. */
  id: string;
  client: AgentClient;
}

type Body = Record<string, unknown>;

const ok = (body: Body) => ({ content: [{ type: "text" as const, text: JSON.stringify(body) }], structuredContent: body });

const fail = (code: string, message: string, extra: Body = {}) => ({
  isError: true,
  content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message, ...extra } }) }],
});

function failure(error: unknown) {
  if (error instanceof ToolError) return fail(error.code, error.message, error.alternatives ? { alternatives: error.alternatives } : {});
  return fail("internal_error", "The tool could not run.");
}

function proposalView(proposal: AgentProposal): Body {
  return {
    proposalId: proposal.id,
    status: proposal.status,
    title: proposal.title,
    changes: proposal.rows,
    message: proposal.status === "pending" ? `Waiting for the owner to approve or decline in ${BRAND.name} (Inbox).` : `The owner's decision: ${proposal.status}.`,
  };
}

const sortedJson = (value: Body) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));

function register(server: McpServer, tool: ConceptTool, caller: Caller) {
  if (tool.kind === "read") {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (input) => {
        try {
          return ok(tool.run(toolContext(), input));
        } catch (error) {
          return failure(error);
        }
      },
    );
    return;
  }
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: `${tool.description} Creates a proposal only; nothing changes until the owner approves.`,
      inputSchema: tool.input.extend({ idempotencyKey }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const { idempotencyKey: key, ...input } = args as Body & { idempotencyKey: string };
      try {
        const result = createProposal({
          caller: caller.id,
          key,
          tool: tool.name,
          client: caller.client,
          fingerprint: `${tool.name}:${sortedJson(input)}`,
          draft: () => tool.draft(toolContext(), input),
        });
        if ("conflict" in result) return fail("idempotency_conflict", "This idempotencyKey was already used for a different request.");
        return ok({ ...proposalView(result.proposal), replayed: result.replayed });
      } catch (error) {
        return failure(error);
      }
    },
  );
}

export function conceptMcpServer(caller: Caller) {
  const server = new McpServer({ name: "flerdo-concept-demo", version: "0.1.0" });
  for (const tool of conceptTools) register(server, tool, caller);
  server.registerTool(
    "get_proposal",
    {
      title: "Proposal status",
      description: "Whether the owner has approved or declined a proposal created by a propose_* tool.",
      inputSchema: z.object({ proposalId: z.string().min(1).max(64) }).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ proposalId }) => {
      const proposal = findProposal(proposalId);
      return proposal ? ok(proposalView(proposal)) : fail("not_found", "No such proposal today.");
    },
  );
  return server;
}

// One handler per process; it builds a fresh server for each request's caller.
const handler = createMcpHandler(
  ({ authInfo }) => conceptMcpServer({ id: authInfo?.token ?? "anonymous", client: (authInfo?.clientId as AgentClient | undefined) ?? "agent" }),
  { responseMode: "json", maxRequestBodySize: MAX_BODY },
);

const jsonError = (status: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** The called tool's name, for the log line. Only names in the registry are reported. */
function calledTool(text: string): string | undefined {
  try {
    const rpc = JSON.parse(text) as { method?: unknown; params?: { name?: unknown } };
    const name = rpc.method === "tools/call" ? rpc.params?.name : undefined;
    return typeof name === "string" && (findTool(name) || name === "get_proposal") ? name : undefined;
  } catch {
    return undefined;
  }
}

export async function handleConceptMcp(request: Request, log: RequestLogContext): Promise<Response> {
  if (isPublicReadonly()) return readonlyForbidden();
  const auth = checkBearer(request.headers);
  if (!auth.ok) {
    return auth.status === 401
      ? jsonError(401, "Missing or wrong bearer token", { "WWW-Authenticate": 'Bearer realm="flerdo-concept"' })
      : jsonError(503, "The concept MCP endpoint is closed until CONCEPT_MCP_TOKEN is set");
  }
  const limit = takeCall(auth.caller);
  if (!limit.ok) return jsonError(429, "Too many calls, try again shortly", { "Retry-After": String(limit.retryAfter) });
  if (request.method === "POST") {
    const body = await readCapped(request, MAX_BODY).catch(() => null);
    if (body === "too-large") return jsonError(413, "Request too large");
    if (body === null) return jsonError(400, "Unable to read request body");
    log.tool = calledTool(body);
    request = new Request(request.url, { method: request.method, headers: request.headers, signal: request.signal, body });
  }
  // authInfo carries the token's hash and the kind of client to the factory, never the token itself.
  return handler.fetch(request, { authInfo: { token: auth.caller, clientId: clientFromUserAgent(request.headers.get("user-agent")), scopes: [] } });
}
