import { constants } from "node:os";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { publicReadonlyResponse } from "../../lib/public-readonly";
import { z } from "zod";
import { readCapped, waitlistClientKey } from "../site/waitlist-server";
import { pairingDb, type Tx } from "./db";
import { COOKIE, pairingOrigin } from "./policy";

export const minute = 60_000;
export const hour = 60 * minute;
export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
export class PairError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export function requirePair(test: unknown, code = "invalid_request", status = 400): asserts test {
  if (!test) throw new PairError(status, code);
}
export function ownerHash(request: Request) {
  const token = request.headers.get("cookie")?.split(/;\s*/).find(v => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return token && /^[\w-]{43}$/.test(token) ? digest(token) : "";
}
export function ipKey(request: Request) {
  const key = process.env.SESSION_SECRET;
  requirePair(key && key.length >= 32, "temporarily_unavailable", 503);
  return createHmac("sha256", key).update("pair:" + waitlistClientKey(request.headers)).digest("hex");
}
export function sameOrigin(request: Request, origin: string) {
  requirePair(request.headers.get("origin") === origin, "invalid_origin", 403);
}
export async function body(request: Request, mime: string) {
  requirePair(request.headers.get("content-type")?.split(";")[0].trim() === mime, "invalid_content_type", 415);
  const raw = await readCapped(request, 16_384);
  requirePair(raw !== "too-large", "request_too_large", 413);
  return raw;
}

export function params(raw: string) {
  const fields = new URLSearchParams(raw);
  requirePair([...fields.keys()].length === new Set(fields.keys()).size);
  return Object.fromEntries(fields);
}

export async function budget(tx: Tx, bucket: string, limit: number, period: number) {
  const end = (Math.floor(Date.now() / period) + 1) * period;
  const key = bucket + ":" + end;
  const [row] = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO "PairBudget" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(end)})
    ON CONFLICT ("key") DO UPDATE SET "count" = "PairBudget"."count" + 1
    WHERE "PairBudget"."count" < ${limit} RETURNING "count"`;
  requirePair(row, "rate_limited", 429);
}

// Charge failed credentials separately so anonymous traffic cannot consume workspace budgets.
export async function publicBudget(request: Request) {
  await pairingDb().$transaction(async tx => {
    await budget(tx, "public:" + ipKey(request), 180, minute);
    await budget(tx, "public", 30000, minute);
  });
}

export function logFailure(err: unknown) {
  const failure = err as { code?: unknown; errorCode?: unknown } | null;
  const code = failure?.code ?? failure?.errorCode;
  console.error(typeof code === "string" && (/^[0-9A-Z]{5}$/.test(code) || Object.hasOwn(constants.errno, code))
    ? code : "PAIRING_UNAVAILABLE");
}

// Credential routes charge valid identities themselves. MCP also handles its own anonymous challenge.
type Handler = (request: Request, origin: string) => Promise<Response> | Response;
export function endpoint(handle: Handler, budgetMode: "public" | "credential" | "handler" = "public") {
  return async (request: Request) => {
    const origin = pairingOrigin(request.headers);
    if (!origin) return publicReadonlyResponse(request) ?? new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    try {
      if (budgetMode === "public") await publicBudget(request);
      const response = await handle(request, origin);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    } catch (err) {
      if (budgetMode === "credential" && (err instanceof SyntaxError || err instanceof z.ZodError ||
          (err instanceof PairError && err.status < 500 && err.status !== 429))) {
        try { await publicBudget(request); } catch (limit) { err = limit; }
      }
      const known = err instanceof PairError ? err : null;
      const invalid = err instanceof z.ZodError || err instanceof SyntaxError;
      if (!known && !invalid) logFailure(err);
      const status = known ? known.status : invalid ? 400 : 503;
      return Response.json({ error: known ? known.code : invalid ? "invalid_request" : "temporarily_unavailable" }, {
        status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
      });
    }
  };
}
