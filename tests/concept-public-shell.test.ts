import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookShell } from "@/concept/booking/shell";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import { ServerSalonProvider } from "@/concept/server-salon";

// A live salon is stored and looked up in lower case; a page opened with capitals still gets its own frame.

const nav = vi.hoisted(() => ({ path: "/boka/Salong-Fiktiv" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "Salong-Fiktiv" }), usePathname: () => nav.path, useRouter: () => ({ push: () => undefined }) }));
// The language boundary waits for the browser; here the frame itself is under test.
vi.mock("@/concept/i18n/boundary", () => ({ ConceptLanguage: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children) }));

const base = createDemoState("2026-11-16");
const stored = { ...base, industry: "other" as const, salon: { ...base.salon, slug: "salong-fiktiv" }, localization: { ...base.localization, bilingual: true } };
const state = publicSalonView(stored, new Date("2026-11-16T10:00:00+01:00"));
const Server = ServerSalonProvider as unknown as ComponentType<{ state: typeof state; issuedAt: string; children?: ReactNode }>;
const Shell = BookShell as unknown as ComponentType<{ visitorLanguage: null; children?: ReactNode }>;
const render = () => renderToString(createElement(Server, { state, issuedAt: "fictional-token" }, createElement(Shell, { visitorLanguage: null }, createElement("p", null, "Fictional content"))));

afterEach(() => { nav.path = "/boka/Salong-Fiktiv"; });

describe("the booking frame for a live salon opened with capitals in its address", () => {
  it("is not the unknown-address page, and the home page keeps its language selector", () => {
    const html = render();
    expect(html).toContain("Fictional content");
    expect(html).toContain("<select");
  });

  it("is the bare widget layout on the widget path", () => {
    nav.path = "/boka/Salong-Fiktiv/widget";
    const html = render();
    expect(html).toContain("Fictional content");
    expect(html).not.toContain("<header");
  });
});
