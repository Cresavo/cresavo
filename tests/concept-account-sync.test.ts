import { afterEach, expect, it, vi } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { t } from "@/concept/i18n";

// When the server refuses an address another salon uses, the owner is told so in the studio's own words.

const ctx = vi.hoisted(() => ({ send: undefined as undefined | ((action: DemoAction) => void), toasts: [] as string[] }));
vi.mock("@/concept/account/hint", () => ({ ownerHintPresent: () => true }));
vi.mock("@/concept/store", () => ({
  openAccountSalon: (_state: unknown, send: (action: DemoAction) => void) => { ctx.send = send; return true; },
  replaceAccountSalon: () => undefined,
  closeAccountSalon: () => undefined,
}));
vi.mock("@/concept/ui/toast", () => ({ showToast: (text: string) => ctx.toasts.push(text) }));

afterEach(() => vi.unstubAllGlobals());

it("says the address is taken instead of a generic refusal", async () => {
  const salon = { state: createDemoState("2026-11-16"), version: 1 };
  const answers = [
    Response.json(salon),
    Response.json({ error: "slug_taken" }, { status: 422 }),
    Response.json(salon),
  ];
  vi.stubGlobal("document", { cookie: "hint=1" });
  vi.stubGlobal("fetch", vi.fn(async () => answers.shift()!));
  const { openSignedInSalon } = await import("@/concept/account/sync");
  expect(await openSignedInSalon()).toBe(true);
  ctx.send!({ type: "salon/slug", slug: "salong-upptagen" });
  await vi.waitFor(() => expect(ctx.toasts).toHaveLength(1));
  expect(ctx.toasts[0]).toBe(t("address.slug.taken"));
});

it("keeps the generic message for other refusals", async () => {
  ctx.toasts.length = 0;
  const salon = { state: createDemoState("2026-11-16"), version: 1 };
  const answers = [Response.json({ error: "rejected" }, { status: 422 }), Response.json(salon)];
  vi.stubGlobal("fetch", vi.fn(async () => answers.shift()!));
  ctx.send!({ type: "salon/slug", slug: "salong-annan" });
  await vi.waitFor(() => expect(ctx.toasts).toHaveLength(1));
  expect(ctx.toasts[0]).toBe(t("account.sync.refused"));
});
