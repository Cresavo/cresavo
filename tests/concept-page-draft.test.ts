import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Reviews } from "@/concept/booking/salon-info";
import { createDemoState } from "@/concept/data/generate";
import { DRAFT_MESSAGE } from "@/concept/booking/page-context";
import type { PageConfig } from "@/concept/page/config";

// The editor's preview frame shows a draft layout. It may only be applied where the full state is: in the
// owner's editor (browser state), never on the server's public view, which was projected for the saved layout.

const ctx = vi.hoisted(() => ({ server: false, slots: [] as unknown[], index: 0, listener: undefined as undefined | ((event: unknown) => void) }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: <S,>(initial?: S) => {
      const slot = ctx.index++;
      if (slot === ctx.slots.length) ctx.slots.push(initial);
      return [ctx.slots[slot] as S, (next: S) => { ctx.slots[slot] = next; }];
    },
    useEffect: (run: () => void) => { run(); },
  };
});
const base = createDemoState("2026-11-16");
vi.mock("@/concept/store", () => ({ usePublicDemo: () => base }));
vi.mock("@/concept/server-salon", () => ({ useServerSalon: () => ctx.server ? base : null }));

const parent = {};
const draft = (variant: string): PageConfig => ({ ...base.page, sections: [{ kind: "reviews", variant }] });

async function provide() {
  const { PageProvider } = await import("@/concept/booking/page-context");
  ctx.index = 0;
  return (PageProvider({ children: null }) as ReactElement<{ value: PageConfig }>).props.value;
}

beforeEach(() => {
  ctx.slots = [];
  ctx.listener = undefined;
  vi.stubGlobal("window", {
    parent, location: { search: "?preview=1", origin: "https://salon.example.test" },
    addEventListener: (_type: string, listener: (event: unknown) => void) => { ctx.listener = listener; },
    removeEventListener: () => undefined,
  });
  (window.parent as { postMessage?: unknown }).postMessage = () => undefined;
});
afterEach(() => vi.unstubAllGlobals());

const send = (page: PageConfig) => ctx.listener!({ origin: "https://salon.example.test", source: parent, data: { type: DRAFT_MESSAGE, page } });

it("previews a draft layout in the owner's editor, where the full state is present", async () => {
  ctx.server = false;
  await provide();
  send(draft("quote"));
  expect((await provide()).sections).toEqual([{ kind: "reviews", variant: "quote" }]);
  send(draft("cards"));
  expect((await provide()).sections).toEqual([{ kind: "reviews", variant: "cards" }]);
});

it("shows one review as a quote and three as cards from the full state", () => {
  const html = (variant: string) => renderToString(createElement(Reviews, { state: base, variant }));
  expect(html("cards").match(/<figure/g)).toHaveLength(3);
  expect(html("quote")).not.toContain("<figure");
  expect(html("quote")).toContain("“");
});

it("ignores a draft layout on the server's salon: no listener, the saved page stays", async () => {
  ctx.server = true;
  expect(await provide()).toBe(base.page);
  expect(ctx.listener).toBeUndefined();
});
