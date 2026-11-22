import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createSalon, salonDraft, suggestedSlug } from "@/concept/onboarding/salon";
import { checkSlug, SLUG_MAX } from "@/concept/page/slug";
import { salonClock } from "@/concept/tools/clock";
import { db } from "./db";
import { hashPassword, newPasswordSchema, verifyPasswordHash } from "./password";
import { findSalonTenant } from "./public-booking";
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
  | { ok: false; reason: "invalid" | "email_taken" | "slug_unavailable" };

const MAX_SLUG_VARIANTS = 100;
const SIGNUP_ATTEMPTS = 5;

/** The slug, or the first "-2", "-3", … variant that is a valid address no salon uses yet; null when the first hundred are taken. */
export async function availableSlug(slug: string, taken: (candidate: string) => Promise<unknown> = findSalonTenant) {
  for (let n = 1; n <= MAX_SLUG_VARIANTS; n++) {
    const suffix = `-${n}`;
    const candidate = n === 1 ? slug : `${slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (checkSlug(candidate).ok && !(await taken(candidate))) return candidate;
  }
  return null;
}

/** A valid address with a short random ending, for when the numbered variants keep colliding. */
export const randomSlug = (slug: string) => `${slug.slice(0, SLUG_MAX - 5).replace(/-+$/, "")}-${randomBytes(2).toString("hex")}`;

const violates = (error: unknown, constraint: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && error.message.includes(constraint);

/** Creates the account and its salon in one transaction. Nothing is created when either part fails. */
export async function createOwnerAccount(input: unknown, now = new Date()): Promise<SignupResult> {
  assertWritable();
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { email, password, salonName, language } = parsed.data;
  const passwordHash = await hashPassword(password);
  const draft = { ...salonDraft(language), name: salonName, industry: "other" as const, treatments: [] };
  const tenantId = `salon_${randomUUID()}`;
  // Two sign-ups for one name can pick the same free address; the loser's transaction fails on the unique index and runs again with the next one.
  // The last attempt does not queue for a number: it takes a random ending.
  for (let attempt = 1; attempt <= SIGNUP_ATTEMPTS; attempt++) {
    const base = suggestedSlug(draft);
    const slug = (attempt < SIGNUP_ATTEMPTS && await availableSlug(base)) || randomSlug(base);
    const salon = createSalon(salonClock(now).today, { ...draft, slug });
    try {
      const account = await db.$transaction(async (tx) => {
        await tx.tenantState.create({ data: { tenantId, kind: "salon", doc: salon as unknown as Prisma.InputJsonValue } });
        return tx.ownerAccount.create({ data: { email, passwordHash, tenantId }, select: { id: true, credentialVersion: true } });
      });
      return { ok: true, identity: account, tenantId };
    } catch (error) {
      if (violates(error, "owner_account_email_key")) return { ok: false, reason: "email_taken" };
      if (!violates(error, "tenant_state_salon_slug_key")) throw error;
    }
  }
  return { ok: false, reason: "slug_unavailable" };
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
