import { createHash, createHmac, randomBytes } from "node:crypto";
import { publicReadonlyResponse } from "../../lib/public-readonly";
import { z } from "zod";
import { readCapped, waitlistClientKey } from "../site/waitlist-server";
import { pairingDb, sweep, type Tx } from "./db";
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

type Handler = (request: Request, origin: string) => Promise<Response> | Response;
export function endpoint(handle: Handler) {
  return async (request: Request) => {
    const origin = pairingOrigin(request.headers);
    if (!origin) return publicReadonlyResponse(request) ?? new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    try {
      await pairingDb().$transaction(async tx => {
        await budget(tx, "global", 3000, minute);
        await budget(tx, ipKey(request), 180, minute);
        const tick = await tx.pairBudget.createMany({ data: {
          key: "sweep:" + Math.floor(Date.now() / minute), count: 1, expiresAt: new Date(Date.now() + minute),
        }, skipDuplicates: true });
        if (tick.count) await sweep(tx);
      });
      const response = await handle(request, origin);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    } catch (err) {
      const known = err instanceof PairError;
      const invalid = err instanceof z.ZodError || err instanceof SyntaxError;
      const status = known ? err.status : invalid ? 400 : 503;
      return Response.json({ error: known ? err.code : invalid ? "invalid_request" : "temporarily_unavailable" }, {
        status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
      });
    }
  };
}
