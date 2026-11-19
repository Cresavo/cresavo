import { ESLint } from "eslint";
import { expect, it } from "vitest";

const eslint = new ESLint();
const warn = (source: string, filePath: string) => eslint.lintText(source, { filePath }).then(([file]) =>
  file.messages.filter(message => message.ruleId?.startsWith("design-system/")).map(message => message.ruleId));

it("checks native controls only outside the kit and development gallery", async () => {
  const raw = "export const form = <dialog><button /><input /><select /><textarea /></dialog>;";
  expect(await warn(raw, "src/app/studio/page.tsx")).toEqual(Array(5).fill("design-system/shared-controls"));
  expect(await warn(raw, "src/concept/ui/controls.tsx")).toEqual([]);
  expect(await warn(raw, "src/app/(development)/studio/%5Fgallery/gallery.tsx")).toEqual([]);
});

it("counts arbitrary sizes and literal hex styles inside expressions, including in the kit", async () => {
  const source = 'export const item = <div className={cx("p-[13px] sm:text-[15px]", active && "bg-[#aabbcc]")} style={{ color: active ? "#fff" : "var(--ui-text)" }} />;';
  expect((await warn(source, "src/concept/ui/card.tsx")).sort()).toEqual([
    "design-system/no-hex", "design-system/no-hex", "design-system/token-sizes", "design-system/token-sizes",
  ]);
  expect(await warn('export const link = <a href="#abc" className="p-3 text-body" />;', "src/app/studio/page.tsx")).toEqual([]);
});
