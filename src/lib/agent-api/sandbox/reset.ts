import type { PrismaClient } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { createDatabaseClient } from "../../../../scripts/database.mjs";
import { assertTestDatabase } from "../../../../scripts/test-db-guard.mjs";
import { sandboxConfig, sandboxCronHost, sandboxRequested } from "./config";

let resetClient: PrismaClient | undefined;
const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function runSandboxReset(request: Request) {
  if (!sandboxRequested() || request.method !== "GET") return new Response(null, { status: 404, headers: noStore });
  try {
    const config = sandboxConfig();
    if (!sandboxCronHost(request, config.origin)) return new Response(null, { status: 404, headers: noStore });
    const secret = process.env.CRON_SECRET;
    const supplied = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw Error("SANDBOX_RESET_NOT_CONFIGURED");
    if (!supplied || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied)))
      return new Response(null, { status: 401, headers: noStore });
    const url = process.env.BOOKING_SANDBOX_RESET_DATABASE_URL;
    if (!url) throw Error("SANDBOX_RESET_NOT_CONFIGURED");
    if (process.env.BOOKING_RUNTIME === "local") assertTestDatabase(url);
    resetClient ??= createDatabaseClient(url, 1, "sandbox");
    const [result] = await resetClient.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '15s'`;
      return tx.$queryRaw<{ changed: boolean }[]>`
        SELECT changed FROM cresavo_sandbox.reset(${config.installation}::uuid, ${config.revision}::integer)
      `;
    }, { maxWait: 3000, timeout: 18000 });
    if (!result) throw Error("SANDBOX_RESET_FAILED");
    return Response.json({ reset: result.changed }, { headers: noStore });
  } catch {
    return Response.json({ error: "sandbox_reset_unavailable" }, { status: 503, headers: noStore });
  }
}
