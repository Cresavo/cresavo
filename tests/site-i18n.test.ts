import { expect, it } from "vitest";
import { channelExamples as englishExamples, site } from "@/concept/site/en";
import { channelExamples as swedishExamples, sv } from "@/concept/site/sv";

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

it("translates every channel story and preserves its time and availability", () => {
  expect(swedishExamples).toHaveLength(englishExamples.length);
  englishExamples.forEach((source, i) => {
    const target = swedishExamples[i];
    expect("comingSoon" in target).toBe("comingSoon" in source);
    expect(target.time).toBe(source.time);
    const copy = (entry: typeof source | typeof target) => Object.fromEntries(
      Object.entries(entry).filter((pair): pair is [string, string] => typeof pair[1] === "string")
    );
    checkTranslation(copy(source), copy(target));
  });
});
