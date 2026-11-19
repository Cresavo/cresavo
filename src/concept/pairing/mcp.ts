import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { PairGrant } from "@prisma/client";
import { z } from "zod";
import { readCapped } from "../site/waitlist-server";
import { ToolError } from "../tools/define";
import { snapshotWorkspace } from "./owner-workspace";
import { pairingDb, type Tx } from "./db";
import { budget, digest, minute, publicBudget, PairError, requirePair } from "./http";
import { permitted, registerCatalogue, type RegisterTool } from "./catalogue";
import { t, type MessageKey } from "../i18n";
import { lockWorkspace } from "./workspace";

async function authorizeToken(tx: Tx, accessHash: string, audience: string) {
  const where = { accessHash, grant: { audience, revoked: false }, rotated: false, expiresAt: { gt: new Date() } };
  const candidate = await tx.pairGrantToken.findFirst({ where, select: { grant: { select: { workspaceId: true } } } });
  requirePair(candidate, "invalid_token", 401);
  await lockWorkspace(tx, candidate.grant.workspaceId);
  const token = await tx.pairGrantToken.findFirst({ where: { ...where, expiresAt: { gt: new Date() } }, include: { grant: true } });
  requirePair(token, "invalid_token", 401);
  return token.grant;
}

const guidance: Partial<Record<string, MessageKey>> = {
  booking_not_found: "pair.error.booking", proposal_not_found: "pair.error.proposal",
  idempotency_conflict: "pair.error.key", proposal_limit: "pair.error.limit", choose_another_slot: "pair.error.move",
  item_not_found: "pair.error.inbox", item_handled: "pair.error.inbox", service_not_found: "pair.error.service",
  staff_not_found: "pair.error.staff", customer_not_found: "pair.error.customer", choose_customer: "pair.error.customerChoice",
  choose_reply: "pair.error.replyChoice", slot_unavailable: "pair.error.slot", block_unavailable: "pair.error.block",
  choose_upcoming_date: "pair.error.date", invalid_date_range: "pair.error.range", unchanged: "pair.error.unchanged",
  booking_unavailable: "pair.error.booking", insufficient_scope: "pair.error.scope",
};

function serverFor(accessHash: string, audience: string, scopes: string[]) {
  const server = new McpServer({ name: "cresavo-paired-owner", version: "1.0.0" }, {
    instructions: t("pair.instructions"),
  });
  const tool: RegisterTool = (name, scope, schema, run, readOnly = true) => {
    if (!permitted(scope, scopes)) return;
    server.registerTool(name, { description: t(`pair.tool.${name}`), inputSchema: schema as z.ZodObject,
      annotations: { readOnlyHint: readOnly, destructiveHint: false, openWorldHint: false, idempotentHint: true } },
    async (args) => {
      try {
        const result = await pairingDb().$transaction(async tx => {
          const current = await authorizeToken(tx, accessHash, audience);
          requirePair(permitted(scope, current.scopes.split(" ")), "insufficient_scope", 403);
          const w = await tx.pairWorkspace.findUniqueOrThrow({ where: { id: current.workspaceId } });
          return await run({ grant: current, workspace: snapshotWorkspace(tx, w) }, schema.parse(args)) as Record<string, unknown>;
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      } catch (err) {
        const code = err instanceof PairError || err instanceof ToolError ? err.code : "temporarily_unavailable";
        const message = err instanceof ToolError ? t("pair.error.move") : t(guidance[code] ?? "pair.error.refresh");
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ code, message }) }] };
      }
    });
  };
  registerCatalogue(tool);
  return server;
}

const handler = createMcpHandler(({ authInfo }) => {
  if (!authInfo?.resource) throw new Error("missing_pairing_grant");
  return serverFor(authInfo.token, authInfo.resource.href, authInfo.scopes);
}, { responseMode: "json", maxRequestBodySize: 32768 });

export async function mcp(request: Request, origin: string) {
  requirePair(!request.headers.has("origin") || request.headers.get("origin") === origin, "invalid_origin", 403);
  const match = /^Bearer ([\w-]{43})$/i.exec(request.headers.get("authorization") ?? "");
  let grant: PairGrant;
  try {
    requirePair(match, "invalid_token", 401);
    grant = await pairingDb().$transaction(async tx => {
      const token = await authorizeToken(tx, digest(match[1]), origin + "/mcp/owner");
      await budget(tx, "mcp:" + token.workspaceId, 100, minute);
      return token;
    });
  } catch (err) {
    if (!(err instanceof PairError) || err.status !== 401) throw err;
    await publicBudget(request);
    return Response.json({ error: "invalid_token" }, { status: 401, headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp/owner"`,
    } });
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const raw = await readCapped(request, 32768);
  requirePair(raw !== "too-large", "request_too_large", 413);
  return handler.fetch(new Request(request.url, { method: "POST", headers: request.headers, body: raw }), {
    authInfo: { token: digest(match![1]), clientId: grant.clientId, scopes: grant.scopes.split(" "), resource: new URL(grant.audience) },
  });
}
