import { assertWritable } from "./public-readonly";
import { z } from "zod";
import { db } from "./db";
import { DEMO_BUSINESS_ID } from "./config";
import { hashPassword, verifyPasswordHash } from "./password";

export const adminEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
  .refine((v) => v.endsWith("@example.test"));
export type AdminIdentity = { id: string; credentialVersion: number };

export async function verifyAdminCredentials(
  input: unknown,
): Promise<AdminIdentity | null> {
  assertWritable();
  const parsed = z
    .object({ email: adminEmailSchema, password: z.string().min(1).max(128) })
    .strict()
    .safeParse(input);
  if (!parsed.success) return null;
  const account = await db.adminUser.findUnique({
    where: { email: parsed.data.email },
  });
  const eligible = account?.active && account.businessId === DEMO_BUSINESS_ID;
  const valid = await verifyPasswordHash(
    eligible ? account.passwordHash : undefined,
    parsed.data.password,
  );
  return eligible && valid
    ? { id: account.id, credentialVersion: account.credentialVersion }
    : null;
}

export async function createAdminUser(email: string, password: string) {
  assertWritable();
  const normalized = adminEmailSchema.parse(email);
  const passwordHash = await hashPassword(password);
  const account = await db.adminUser.create({
    data: { email: normalized, passwordHash, businessId: DEMO_BUSINESS_ID },
    select: { id: true },
  });
  return account;
}

// Updating the account locks its row before touching sessions, matching login's lock order.
export async function disableAdminUser(email: string) {
  assertWritable();
  const normalized = adminEmailSchema.parse(email);
  await db.$transaction(async (tx) => {
    const account = await tx.adminUser.update({
      where: { email: normalized, businessId: DEMO_BUSINESS_ID },
      data: { active: false, credentialVersion: { increment: 1 } },
      select: { id: true },
    });
    await tx.adminSession.updateMany({
      where: { userId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function resetAdminPassword(email: string, password: string) {
  assertWritable();
  const normalized = adminEmailSchema.parse(email);
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const account = await tx.adminUser.update({
      where: { email: normalized, businessId: DEMO_BUSINESS_ID, active: true },
      data: { passwordHash, credentialVersion: { increment: 1 } },
      select: { id: true },
    });
    await tx.adminSession.updateMany({
      where: { userId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
