import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rebookLink } from "../booking/links";
import { field, ToolError } from "../tools/define";
import { getAvailability, listServices } from "../tools/read";
import { toolContext } from "./demo-business";
import { createRateLimiter } from "./rate-limit";

// A minimal A2A 1.0 JSON-RPC endpoint for a customer's assistant: only
// `SendMessage`, with one JSON text part. Read-only: it lists services and
// free times and hands back a booking page link, because the person confirms
// a booking themselves. No tasks, streaming or push notifications.

const MAX_BODY = 16 * 1024;
const takeCall = createRateLimiter({ max: 300, windowMs: 60_000 });

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("services") }).strict(),
  z.object({ action: z.literal("availability"), serviceId: field.id, date: field.date, staffId: field.staffId.optional() }).strict(),
  z.object({ action: z.literal("book"), serviceId: field.id }).strict(),
]);

const HELP = 'Send one text part with JSON: {"action":"services"}, {"action":"availability","serviceId":"…","date":"YYYY-MM-DD"} or {"action":"book","serviceId":"…"}.';

type RpcId = string | number | null;

const rpcError = (id: RpcId, code: number, message: string, status = 400) => Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

function answer(input: unknown, origin: string): Record<string, unknown> {
  const parsed = command.safeParse(input);
  if (!parsed.success) return { error: { code: "invalid_request", message: HELP } };
  const context = toolContext();
  try {
    switch (parsed.data.action) {
      case "services":
        return listServices.run(context, {});
      case "availability":
        return getAvailability.run(context, parsed.data);
      case "book": {
        const { serviceId } = parsed.data;
        if (!context.state.services.some((s) => s.id === serviceId)) throw new ToolError("not_found", "Unknown serviceId.");
        return { bookingUrl: `${origin}${rebookLink(context.state.salon.slug, serviceId)}`, note: "Open this link for the person: they pick the time and confirm on the booking page." };
      }
    }
  } catch (error) {
    if (error instanceof ToolError) return { error: { code: error.code, message: error.message } };
    throw error;
  }
}

function readCommand(params: unknown): unknown {
  const parts = (params as { message?: { parts?: { text?: unknown }[] } } | undefined)?.message?.parts;
  if (!Array.isArray(parts) || parts.length !== 1 || typeof parts[0]?.text !== "string") return undefined;
  try {
    return JSON.parse(parts[0].text);
  } catch {
    return undefined;
  }
}

export async function handleConceptA2a(request: Request, origin: string): Promise<Response> {
  const limit = takeCall("public");
  if (!limit.ok) return Response.json({ error: "Too many calls" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const text = await request.text();
  if (text.length > MAX_BODY) return rpcError(null, -32600, "Request too large", 413);
  let rpc: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  try {
    rpc = JSON.parse(text);
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const id: RpcId = typeof rpc?.id === "string" || typeof rpc?.id === "number" ? rpc.id : null;
  if (!rpc || typeof rpc !== "object" || rpc.jsonrpc !== "2.0") return rpcError(id, -32600, "Invalid Request");
  const version = request.headers.get("a2a-version");
  if (version && version !== "1.0") return rpcError(id, -32009, "Only A2A 1.0 is supported");
  if (rpc.method !== "SendMessage") return rpcError(id, -32601, "Method not found");
  const result = answer(readCommand(rpc.params), origin);
  return Response.json({
    jsonrpc: "2.0",
    id,
    result: { message: { messageId: randomUUID(), role: "ROLE_AGENT", parts: [{ text: JSON.stringify(result) }] } },
  });
}
