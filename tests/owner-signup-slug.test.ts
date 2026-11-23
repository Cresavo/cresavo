import { Prisma } from "@prisma/client";
import { afterEach, expect, it, vi } from "vitest";
import { checkSlug } from "@/concept/page/slug";
import { createOwnerAccount } from "@/lib/owner-accounts";

// Sign-up when every attempt loses the address race. The database is a double; no real accounts.

const ctx = vi.hoisted(() => ({ tries: [] as string[] }));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: async () => [],
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => [],
      tenantState: { create: async ({ data }: { data: { doc: { salon: { slug: string } } } }) => {
        ctx.tries.push(data.doc.salon.slug);
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the constraint: `tenant_state_salon_slug_key`', { code: "P2002", clientVersion: "test" });
      } },
    }),
  },
}));

afterEach(() => { ctx.tries.length = 0; });

it("ends with a handled error, not a 500, after five lost races, the last with a random ending", async () => {
  const result = await createOwnerAccount({ email: "ny@example.test", password: "a long fictional passphrase", salonName: "Salong Fiktiv", language: "sv" });
  expect(result).toEqual({ ok: false, reason: "slug_unavailable" });
  expect(ctx.tries).toHaveLength(5);
  expect(ctx.tries.slice(0, 4).every((slug) => slug === "salong-fiktiv")).toBe(true);
  expect(ctx.tries[4]).toMatch(/^salong-fiktiv-[0-9a-f]{4}$/);
  expect(checkSlug(ctx.tries[4]).ok).toBe(true);
});
