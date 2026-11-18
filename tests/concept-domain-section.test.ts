import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { applyPageAction, type PageAction } from "@/concept/page/actions";
import { DomainSection } from "@/concept/studio/page/domain-section";

const { showToast, useState, fetcher } = vi.hoisted(() => ({
  showToast: vi.fn(), useState: vi.fn(), fetcher: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => undefined,
  useState,
}));
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => ({ state }) }));
vi.mock("@/concept/ui/toast", () => ({ showToast }));
vi.mock("@/concept/store", () => ({
  dispatch: (action: PageAction) => {
    const next = applyPageAction(state, action);
    if (next === state) return false;
    state = next;
    return true;
  },
}));

let state: DemoState;
const connection = { host: "book.salon.example", status: "waiting-dns" } as const;

beforeEach(() => {
  const base = createDemoState("2026-11-16");
  state = { ...base, modules: { ...base.modules, domain: true }, domain: connection };
  useState.mockReset().mockImplementation((initial) => [initial, vi.fn()]);
  fetcher.mockReset();
  showToast.mockClear();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

type Props = { children?: ReactNode; onClick?: () => Promise<void> };

function click(tree: ReactNode, label: string): Promise<void> {
  function find(node: ReactNode): Props["onClick"] {
    if (!isValidElement<Props>(node)) return undefined;
    if (node.props.children === label) return node.props.onClick;
    return Children.toArray(node.props.children).map(find).find(Boolean);
  }
  const handler = find(tree);
  if (!handler) throw new Error(`Missing domain control: ${label}`);
  return handler();
}

function renderDomain(live: boolean, host?: string) {
  useState.mockReturnValueOnce([live, vi.fn()]);
  if (host) useState.mockReturnValueOnce([host, vi.fn()]);
  const section = DomainSection() as ReactElement<{ live: boolean }, (props: { live: boolean }) => ReactElement>;
  return section.type(section.props);
}

it("leaves the domain unconnected when the live connect request fails", async () => {
  state = { ...state, domain: null };
  fetcher.mockRejectedValueOnce(new TypeError("Network unavailable"));
  const form = renderDomain(true, connection.host).props as { children: ReactElement[] };
  const submit = form.children.find((child) => child.type === "form")!.props as { onSubmit: (event: { preventDefault: () => void }) => void };
  submit.onSubmit({ preventDefault: vi.fn() });
  await vi.waitFor(() => {
    expect(state.domain).toBeNull();
    expect(showToast).toHaveBeenLastCalledWith(t("domain.operationFailed"));
  });
});

it("keeps the last confirmed status after failed live checks and advances explicit simulation", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ enabled: true, error: "unavailable" }, { status: 502 }));
  fetcher.mockResolvedValueOnce(Response.json({ enabled: false }));
  const live = renderDomain(true);
  await click(live, t("domain.check"));
  await click(live, t("domain.check"));
  expect(state.domain).toEqual(connection);
  expect(showToast).toHaveBeenCalledTimes(2);

  await click(renderDomain(false), t("domain.check"));
  expect(state.domain?.status).toBe("verifying");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("waits for live DELETE before removing the domain or showing success", async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
  const live = renderDomain(true);
  const pending = click(live, t("domain.remove"));
  expect(state.domain).toEqual(connection);
  expect(showToast).not.toHaveBeenCalled();
  resolve(Response.json({ enabled: true, error: "unavailable" }, { status: 502 }));
  await pending;
  expect(state.domain).toEqual(connection);
  expect(showToast).toHaveBeenLastCalledWith(t("domain.operationFailed"));

  fetcher.mockResolvedValueOnce(Response.json({ enabled: true, status: "waiting-dns" }));
  await click(live, t("domain.remove"));
  expect(state.domain).toBeNull();
  expect(showToast).toHaveBeenLastCalledWith(t("domain.removed"));
});
