import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_MAP } from "@/concept/help/map/entries";

// "Take me there" presses an entry's element, so a navigate entry must be anchored on one control. An anchor on a
// group (a row of filters, a tab list, a section) has several controls or none: such an entry is `pointOnly`, and
// the guide shows it and explains it instead. This reads which element carries each anchor in the source.

/** Elements that are one control: a click on them does what they say. */
const CONTROLS = new Set(["Button", "IconButton", "ButtonLink", "ListRow", "Link", "a", "button", "label", "input", "SearchInput", "ActionMenu", "Popover"]);
/** Object fields that become one control each: nav items, segmented options, action menu items. */
const FIELD_CONTROLS = /\b(?:value|href|run|id):/;

/** The JSX element whose own attribute list holds the text at `at`, or null when the anchor is an object field. */
export function owner(source: string, at: number): string | null {
  for (let start = source.lastIndexOf("<", at); start >= 0; start = source.lastIndexOf("<", start - 1)) {
    const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(start, start + 60))?.[1];
    if (!tag) continue;
    let depth = 0;
    let closed = false;
    let from = start + 1 + tag.length;
    // A type argument, as in <SegmentedControl<Filter>, belongs to the tag's name.
    if (source[from] === "<") from = source.indexOf(">", from) + 1;
    for (let i = from; i < at && !closed; i++) {
      const char = source[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) closed = true;
      if (depth < 0) break;
    }
    if (!closed && depth === 0) return tag;
  }
  return null;
}

type Anchor = { file: string; id: string; control: boolean; element: string };

function anchors(): Anchor[] {
  const found: Anchor[] = [];
  for (const root of ["src/app/studio", "src/concept/studio", "src/concept/ui"]) {
    for (const file of readdirSync(root, { encoding: "utf8", recursive: true })) {
      if (!/\.tsx?$/.test(file)) continue;
      const path = join(root, file);
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/(data-help-id|helpId)(\s*[=:])\s*\{?\s*"([^"]+)"/g)) {
        const field = match[2].trim() === ":";
        if (field) {
          const line = source.slice(source.lastIndexOf("\n", match.index) + 1, source.indexOf("\n", match.index));
          found.push({ file: path, id: match[3], control: FIELD_CONTROLS.test(line), element: "field" });
        } else {
          const element = owner(source, match.index) ?? "?";
          found.push({ file: path, id: match[3], control: CONTROLS.has(element), element });
        }
      }
    }
  }
  return found;
}

const all = anchors();

describe("Show me targets", () => {
  it("finds the element that carries each anchor", () => {
    const at = (source: string, anchor: string) => owner(source, source.indexOf(anchor));
    expect(at(`<Button variant="x" icon={<Plus size={1} />} data-help-id="a">`, "data-help-id")).toBe("Button");
    expect(at(`<div data-help-id="a"><ListRow helpId="b" /></div>`, "data-help-id")).toBe("div");
    expect(at(`<div data-help-id="a"><ListRow helpId="b" /></div>`, "helpId")).toBe("ListRow");
    expect(at(`<SegmentedControl<Filter>\n  label="x"\n  helpId="f"`, "helpId")).toBe("SegmentedControl");
    expect(all.every((anchor) => anchor.element !== "?")).toBe(true);
  });

  it("anchors every navigate entry on one control, or flags it point-only", () => {
    const grouped = HELP_MAP.filter((entry) => entry.safety === "navigate" && !entry.pointOnly)
      .flatMap((entry) => all.filter((anchor) => anchor.id === entry.id && !anchor.control))
      .map((anchor) => `${anchor.id} on <${anchor.element}> in ${anchor.file}`);
    expect(grouped).toEqual([]);
  });

  it("flags point-only only where the anchor really is a group, and never as a step on the way", () => {
    for (const entry of HELP_MAP.filter((item) => item.pointOnly)) {
      expect(all.some((anchor) => anchor.id === entry.id && !anchor.control), entry.id).toBe(true);
      expect(HELP_MAP.some((other) => other.path.includes(entry.id)), entry.id).toBe(false);
    }
  });
});
