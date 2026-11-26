import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { t } from "@/concept/i18n";
import { CalendarFeed } from "@/concept/studio/more/calendar-feed";

afterEach(() => vi.unstubAllGlobals());

function texts(node: ReactNode): string[] {
  if (typeof node === "string") return [node];
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return Children.toArray(node.props.children).flatMap(texts);
}

it("says the subscription shows the demo's sample schedule, not the studio's edits", () => {
  vi.stubGlobal("window", { location: { origin: "https://demo.example" } });
  const shown = texts(CalendarFeed({ name: "Erik", path: "/api/concept/calendar/erik.ics?token=x" }));
  expect(shown).toContain(t("feed.sample"));
});
