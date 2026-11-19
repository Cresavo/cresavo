import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { Button, ButtonLink, IconButton } from "@/concept/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/concept/ui/controls";
import { PageHeader } from "@/concept/ui/page-header";
import { ListRow } from "@/concept/ui/list-row";
import { ConsentSheet } from "@/concept/ui/consent-sheet";

it("keeps both loading buttons named, busy and disabled", () => {
  for (const html of [
    render(h(Button, { loading: true }, "Save")),
    render(h(IconButton, { label: "Save", loading: true, children: "+" })),
  ]) {
    expect(html).toContain("Save");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('type="button"');
  }
});

it("associates hint and error with each field and preserves other descriptions", () => {
  const described = { "aria-describedby": "external" };
  for (const control of [h(Input, described), h(Select, described), h(Textarea, described)]) {
    const html = render(h(Field, { label: "Name", hint: "Public name", error: "Enter a name",
      children: control }));
    const ids = html.match(/aria-describedby="external ([^"]+)"/)?.[1].split(" ");
    expect(ids).toHaveLength(2);
    for (const id of ids!) expect(html).toContain('id="' + id + '"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<label[^>]*>.*Name.*<(input|select|textarea)/);
  }
});

it.each(["date", "number", "short"] as const)("caps %s fields from md while keeping them fluid below it", (width) => {
  const control = h(Input);
  const field = render(h(Field, { label: "Value", width, children: control }));
  expect(field).toMatch(new RegExp(`^<div class="[^"]*w-full [^"]*md:max-w-field-${width}`));
  expect(render(h(Input, { width }))).toContain(`md:max-w-field-${width}`);
  expect(render(h(Field, { label: "Value", children: control }))).not.toContain("max-w-field");
});

it("lets form actions fill the row below sm and fit their content from sm", () => {
  expect(render(h(Button, { width: "responsive" }, "Save"))).toContain("w-full sm:w-fit");
  expect(render(h(ButtonLink, { href: "/studio", width: "responsive", children: "Continue" }))).toContain("w-full sm:w-fit");
  expect(render(h(Button, {}, "Save"))).not.toMatch(/ w-full[ "]/);
});

it("renders one primary header action and one native target for each list row", () => {
  expect(render(h(PageHeader, { title: "Calendar", primaryAction: { label: "Book", onClick: vi.fn() } })).match(/<button /g)).toHaveLength(1);
  expect(render(h(ListRow, { href: "/studio", title: "Studio" }))).toContain('<a ');
  const onClick = vi.fn();
  const row = ListRow({ title: "Change", meta: "Tomorrow", onClick });
  row.props.onClick();
  expect(onClick).toHaveBeenCalledOnce();
  expect(render(row)).toMatch(/<button[^>]*>.*Change.*Tomorrow.*<\/button>/);
  expect(render(h(Switch, { label: "Reminders", checked: false, disabled: true, onChange: vi.fn() }))).toContain('aria-checked="false"');
});

it("finishes a row removal after its own exit animation", () => {
  const onExited = vi.fn();
  const row = ListRow({ title: "Remove", onClick: vi.fn(), motion: "exit", onExited });
  const target = {};
  expect(row.props.inert).toBe(true);
  row.props.onAnimationEnd({ target: {}, currentTarget: target });
  expect(onExited).not.toHaveBeenCalled();
  row.props.onAnimationEnd({ target, currentTarget: target });
  expect(onExited).toHaveBeenCalledOnce();
});

it("requires an unchecked acknowledgement only for high-risk consent", () => {
  const props = { open: true, title: "Review", summary: "Schedule access", grants: ["Read appointments"], verb: "Allow access", onConfirm: vi.fn(), onClose: vi.fn() };
  const high = render(h(ConsentSheet, { ...props, highRisk: true }));
  expect(high).toContain("<li>Read appointments</li>");
  expect(high).toContain('type="checkbox"');
  expect(high).not.toContain('checked=""');
  expect(high).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Allow access/);
  expect(render(h(ConsentSheet, props))).not.toMatch(/checkbox|disabled=""/);
});

afterEach(() => vi.unstubAllEnvs());
it.each([
  ["development", "", "", "localhost", 200],
  ["production", "", "", "localhost", 404],
  ["development", "1", "", "localhost", 404],
  ["development", "", "1", "localhost", 404],
  ["development", "", "", "demo.example.test", 404],
] as const)("gates gallery HTTP responses for %s/demo=%s/readonly=%s/%s", (mode, demo, readonly, host, status) => {
  vi.stubEnv("NODE_ENV", mode);
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO", demo);
  vi.stubEnv("PUBLIC_READONLY", readonly);
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", "example.test");
  for (const path of ["/studio/_gallery", "/studio/%5Fgallery/"]) {
    expect(proxy(new NextRequest("http://" + host + path, { headers: { host } })).status).toBe(status);
  }
});
