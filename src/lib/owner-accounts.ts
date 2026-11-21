import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createSalon, salonDraft, suggestedSlug } from "@/concept/onboarding/salon";
import { salonClock } from "@/concept/tools/clock";
import { db } from "./db";
import { hashPassword, newPasswordSchema, verifyPasswordHash } from "./password";
import { assertWritable } from "./public-readonly";

// Owner accounts for real salons: one account owns one salon, stored as a
// `salon` row in tenant_state behind StudioStore (ADR 1). Off unless
// OWNER_ACCOUNTS_ENABLED=1, so the public demo exposes nothing until the
// pilot gate in docs/QUALITY_SECURITY.md is passed.

export const ownerAccountsEnabled = () => process.env.OWNER_ACCOUNTS_ENABLED === "1";

export const ownerEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const signupSchema = z.object({
  email: ownerEmailSchema,
  password: newPasswordSchema,
  salonName: z.string().trim().min(1).max(80),
  language: z.enum(["en", "sv"]),
}).strict();

const loginSchema = z.object({ email: ownerEmailSchema, password: z.string().min(1).max(128) }).strict();

export type OwnerIdentity = { id: string; credentialVersion: number };

export type SignupResult =
  | { ok: true; identity: OwnerIdentity; tenantId: string }
  | { ok: false; reason: "invalid" | "email_taken" };

/** Creates the account and its salon in one transaction. Nothing is created when either part fails. */
export async function createOwnerAccount(input: unknown, now = new Date()): Promise<SignupResult> {
  assertWritable();
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { email, password, salonName, language } = parsed.data;
  const passwordHash = await hashPassword(password);
  const draft = { ...salonDraft(language), name: salonName, industry: "other" as const, treatments: [] };
  const salon = createSalon(salonClock(now).today, { ...draft, slug: suggestedSlug(draft) });
  const tenantId = `salon_${randomUUID()}`;
  try {
    const account = await db.$transaction(async (tx) => {
      await tx.tenantState.create({ data: { tenantId, kind: "salon", doc: salon as unknown as Prisma.InputJsonValue } });
      return tx.ownerAccount.create({ data: { email, passwordHash, tenantId }, select: { id: true, credentialVersion: true } });
    });
    return { ok: true, identity: account, tenantId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "email_taken" };
    throw error;
  }
}

/** Unknown emails pay the same password cost as known ones, so timing does not reveal accounts. */
export async function verifyOwnerCredentials(input: unknown): Promise<OwnerIdentity | null> {
  assertWritable();
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  const account = await db.ownerAccount.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPasswordHash(account?.active ? account.passwordHash : undefined, parsed.data.password);
  return account?.active && valid ? { id: account.id, credentialVersion: account.credentialVersion } : null;
}
