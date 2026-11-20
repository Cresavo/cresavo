import { assertWritable } from "./public-readonly";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID } from "./config";
import { DomainError } from "./errors";
import { idempotencyKeySchema } from "./validation";

export const LOCAL_WORKSPACE_ACTOR = {
  kind: "local-mcp",
  id: "local-workspace-channel:v1",
} as const;
export type WorkspaceActor =
  | { kind: "admin"; id: string }
  | typeof LOCAL_WORKSPACE_ACTOR;

export async function lockConfiguration(
  tx: Prisma.TransactionClient,
  exclusive = false,
  businessId: string = DEMO_BUSINESS_ID,
) {
  const key = `${businessId}:configuration`;
  if (exclusive)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  else
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${key}))`;
}

export async function assertWorkspaceActor(
  tx: Prisma.TransactionClient,
  actor: WorkspaceActor,
) {
  if (actor.kind === "local-mcp" && actor.id === LOCAL_WORKSPACE_ACTOR.id)
    return;
  if (
    actor.kind === "admin" &&
    (await tx.adminUser.findFirst({
      where: { id: actor.id, active: true, businessId: DEMO_BUSINESS_ID },
      select: { id: true },
    }))
  )
    return;
  throw new DomainError("Access denied.", 403);
}

// A bounded, explicit mutation ledger; results contain no customer fields or secrets.
export async function workspaceWrite<T extends Prisma.InputJsonValue>(
  operation: string,
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
  exclusive: boolean,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  assertWritable();
  const key = idempotencyKeySchema.parse(requestId);
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ operation, actor, input }))
    .digest("hex");
  const scopedKey = createHash("sha256")
    .update(`${actor.kind}:${actor.id}:${key}`)
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await lockConfiguration(tx, exclusive);
      await assertWorkspaceActor(tx, actor); // Authorisation always precedes a replay.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${DEMO_BUSINESS_ID}:workspace:${scopedKey}`}))`;
      const existing = await tx.workspaceRequest.findUnique({
        where: {
          businessId_key: { businessId: DEMO_BUSINESS_ID, key: scopedKey },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new DomainError(
            "This booking attempt was already used with different details.",
            409,
          );
        return existing.result as T;
      }
      const result = await write(tx);
      await tx.workspaceRequest.create({
        data: {
          businessId: DEMO_BUSINESS_ID,
          key: scopedKey,
          requestHash,
          result,
        },
      });
      return result;
    },
    { maxWait: 30000, timeout: 30000 },
  );
}
