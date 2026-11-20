import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma, SandboxSession } from "@prisma/client";
import { z } from "zod";
import { clientLimitKey, vercelClientAddress, verifiedClientAddress } from "../../../../scripts/client-address.mjs";
import { AgentApiError } from "../errors";
import { publicReadonlyResponse } from "../../public-readonly";
import { proposalView } from "../proposals";
import { SANDBOX_CHANNEL, SANDBOX_CUSTOMER, sandboxConfig, sandboxHost, sandboxRequested } from "./config";
import { decideSandboxProposal } from "./ledger";
import { createSandboxSession, sandboxJson, sandboxNow, sandboxTransaction } from "./store";

const PHONE_COOKIE = "__Host-cresavo-sandbox-";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenSchema = z.object({ token: z.string().regex(tokenPattern) }).strict();
const decisionSchema = z.object({
  id: z.uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(["yes", "no"]),
}).strict();
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const token = () => randomBytes(32).toString("base64url");
const digest = (context: string, value: string) => createHash("sha256").update("cresavo-sandbox:" + context + ":" + value).digest("hex");
const csrf = (raw: string) => digest("csrf", raw);

function equalDigest(presented: string | null, expected: string) {
  return presented !== null && /^[a-f0-9]{64}$/.test(presented) &&
    timingSafeEqual(Buffer.from(presented, "hex"), Buffer.from(expected, "hex"));
}

export function sandboxBrowserOrigin(request: Request) {
  if (!sandboxRequested()) throw new AgentApiError("booking_not_found");
  const { origin } = sandboxConfig();
  if (!sandboxHost(request, origin) || new URL(request.url).origin !== origin) throw new AgentApiError("booking_not_found");
  if (request.headers.has("authorization") || request.headers.has("x-api-key") || request.headers.has("x-booking-gateway-token") ||
      (request.method === "POST" && request.headers.get("origin") !== origin) ||
      (request.headers.has("sec-fetch-site") && !["same-origin", "none"].includes(request.headers.get("sec-fetch-site")!)))
    throw new AgentApiError("mandate_denied");
  return origin;
}

function privateResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...privateHeaders, ...headers } });
}

async function browserRequest(request: Request, run: () => Promise<Response>) {
  const readonly = publicReadonlyResponse(request);
  if (readonly) return readonly;
  try { return await run(); }
  catch (error) {
    const known = error instanceof AgentApiError ? error : error instanceof z.ZodError
      ? new AgentApiError("invalid_request") : new AgentApiError("provider_configuration_invalid");
    return privateResponse({ error: known.code }, known.status, known.retryAfter ? { "Retry-After": String(known.retryAfter) } : {});
  }
}

function clientQuotaDigest(request: Request) {
  const secret = process.env.BOOKING_SANDBOX_IP_KEY;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new AgentApiError("provider_configuration_invalid");
  try {
    const bucket = process.env.BOOKING_RUNTIME === "vercel"
      ? clientLimitKey(vercelClientAddress({ "x-real-ip": request.headers.get("x-real-ip") }))
      : verifiedClientAddress(request.headers, process.env.BOOKING_ADDRESS_SECRET);
    return createHmac("sha256", secret).update("cresavo-sandbox:pair:" + bucket).digest("hex");
  } catch {
    throw new AgentApiError("mandate_denied");
  }
}

export function pairSandboxBrowser(request: Request) {
  return browserRequest(request, async () => {
    const origin = sandboxBrowserOrigin(request);
    z.strictObject({}).parse(await sandboxJson(request));
    const ipDigest = clientQuotaDigest(request);
    const result = await sandboxTransaction(async (tx, installation) => {
      const now = await sandboxNow(tx);
      const day = now.toISOString().slice(0, 10);
      const [quota] = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO "SandboxPairBudget" ("day", "ipDigest", "count") VALUES (${day}::date, ${ipDigest}, 1)
        ON CONFLICT ("day", "ipDigest") DO UPDATE SET "count" = "SandboxPairBudget"."count" + 1
        WHERE "SandboxPairBudget"."count" < 3 RETURNING "count"
      `;
      if (!quota) {
        const tomorrow = Date.parse(day + "T00:00:00Z") + 86400000;
        throw new AgentApiError("rate_limited", Math.max(1, Math.ceil((tomorrow - +now) / 1000)));
      }
      const { key, session } = await createSandboxSession(tx, installation);
      const link = token();
      await tx.sandboxPhone.create({ data: { sessionId: session.id, linkHash: digest("link", link) } });
      return { agentKey: key, phoneUrl: origin + "/sandbox/phone#" + link, expiresAt: session.expiresAt.toISOString() };
    });
    return privateResponse(result, 201);
  });
}

export function redeemSandboxPhone(request: Request) {
  return browserRequest(request, async () => {
    sandboxBrowserOrigin(request);
    const input = tokenSchema.parse(await sandboxJson(request));
    const browser = token();
    const { phoneId, expiresAt } = await sandboxTransaction(async (tx, installation) => {
      const [match] = await tx.$queryRaw<{ sessionId: string; expiresAt: Date }[]>`
        SELECT p."sessionId", s."expiresAt" FROM "SandboxPhone" p JOIN "SandboxSession" s ON s.id = p."sessionId"
        WHERE p."linkHash" = ${digest("link", input.token)} AND p."redeemedAt" IS NULL
          AND s.generation = ${installation.generation}
        FOR UPDATE OF p, s
      `;
      const now = await sandboxNow(tx);
      if (!match || match.expiresAt <= now) throw new AgentApiError("mandate_denied");
      await tx.sandboxPhone.update({ where: { sessionId: match.sessionId }, data: { browserHash: digest("browser", browser), redeemedAt: now } });
      return { phoneId: match.sessionId, expiresAt: match.expiresAt };
    });
    return privateResponse({ phoneId }, 200, {
      "Set-Cookie": `${PHONE_COOKIE}${phoneId}=${browser}; Path=/; Secure; HttpOnly; SameSite=Strict; Expires=${expiresAt.toUTCString()}`,
    });
  });
}

function phoneCredential(request: Request) {
  const parsed = z.uuid().safeParse(new URL(request.url).searchParams.get("phone"));
  if (!parsed.success) throw new AgentApiError("mandate_denied");
  const id = parsed.data;
  const name = PHONE_COOKIE + id + "=";
  const matches = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim())
    .filter(part => part.startsWith(name));
  const raw = matches[0]?.slice(name.length);
  if (matches.length !== 1 || !raw || !tokenPattern.test(raw)) throw new AgentApiError("mandate_denied");
  return { id, raw };
}

async function phoneTransaction<T>(request: Request, run: (tx: Prisma.TransactionClient, session: SandboxSession, raw: string) => Promise<T>) {
  const { id, raw } = phoneCredential(request);
  return sandboxTransaction(async (tx, installation) => {
    // Both lock paths acquire the session row before accessing proposals.
    const [session] = await tx.$queryRaw<(SandboxSession & { phoneRequests: number })[]>`
      SELECT s.*, p.requests AS "phoneRequests" FROM "SandboxSession" s
      JOIN "SandboxPhone" p ON p."sessionId" = s.id
      WHERE p."sessionId" = ${id}::uuid AND p."browserHash" = ${digest("browser", raw)} AND s.generation = ${installation.generation}
      FOR UPDATE OF s,p
    `;
    const now = await sandboxNow(tx);
    if (!session || session.expiresAt <= now) throw new AgentApiError("mandate_denied");
    if (session.phoneRequests >= 128)
      throw new AgentApiError("rate_limited", Math.max(1, Math.ceil((+session.expiresAt - +now) / 1000)));
    await tx.sandboxPhone.update({ where: { sessionId: session.id }, data: { requests: { increment: 1 } } });
    return run(tx, session, raw);
  });
}

export function readSandboxPhone(request: Request) {
  return browserRequest(request, async () => {
    sandboxBrowserOrigin(request);
    const result = await phoneTransaction(request, async (tx, session, raw) => {
      const now = await sandboxNow(tx);
      const { businessId, clientId } = session;
      const proposals = await tx.agentProposal.findMany({ where: {
        businessId, clientId, status: "pending", consentDelivery: SANDBOX_CHANNEL, expiresAt: { gt: now },
      }, orderBy: { createdAt: "asc" }, take: 20 });
      const linked = await tx.agentBooking.findMany({ where: { businessId, clientId }, include: { booking: true }, take: 20 });
      return {
        csrf: csrf(raw), customer: SANDBOX_CUSTOMER.name,
        proposals: proposals.map(row => ({ ...proposalView(row, now), proposalHash: row.proposalHash })),
        bookings: linked.flatMap(({ booking }) => booking ? [{
          id: booking.id, service: booking.serviceName, start: booking.startsAt.toISOString(), durationMinutes: booking.duration,
        }] : []),
      };
    });
    return privateResponse(result);
  });
}

export function decideSandboxPhone(request: Request) {
  return browserRequest(request, async () => {
    sandboxBrowserOrigin(request);
    const input = decisionSchema.parse(await sandboxJson(request));
    const { raw } = phoneCredential(request);
    if (!equalDigest(request.headers.get("x-sandbox-csrf"), csrf(raw))) throw new AgentApiError("mandate_denied");
    const result = await phoneTransaction(request, async (tx, session) => {
      await tx.$executeRaw`SAVEPOINT sandbox_decision`;
      try {
        const result = await decideSandboxProposal(tx, session, input.id, input.hash, input.decision);
        await tx.sandboxAudit.create({ data: { sessionId: session.id, event: "phone.decision", outcome: result.status } });
        return { success: true as const, result };
      } catch (error) {
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT sandbox_decision`;
        if (!(error instanceof AgentApiError)) throw error;
        await tx.sandboxAudit.create({ data: { sessionId: session.id, event: "phone.decision", outcome: error.code } });
        return { success: false as const, error };
      }
    });
    if (!result.success) throw result.error;
    return privateResponse(result.result);
  });
}
