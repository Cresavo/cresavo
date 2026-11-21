import { expect, it } from "vitest";
import { site } from "@/concept/site/en";
import { sv } from "@/concept/site/sv";

function placeholders(text: string) {
  return (text.match(/\{\w+\}/g) ?? []).sort();
}

function checkTranslation(english: Record<string, string>, swedish: Record<string, string>) {
  expect(Object.keys(swedish).sort()).toEqual(Object.keys(english).sort());
  for (const [key, source] of Object.entries(english)) {
    expect(swedish[key].trim(), key).not.toBe("");
    expect(placeholders(swedish[key]), key).toEqual(placeholders(source));
  }
}

it("keeps all Swedish site keys and placeholders in step with English", () => {
  checkTranslation(site, sv);
});
