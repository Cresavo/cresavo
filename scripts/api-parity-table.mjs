import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CORE_API } from "../src/concept/modules/api-parity.ts";
import { MODULES } from "../src/concept/modules/registry.ts";

const startMarker = "<!-- api-parity:start -->";
const endMarker = "<!-- api-parity:end -->";

export function updateApiParityTable(markdown) {
  const [before, section, extraStart] = markdown.split(startMarker);
  const [, after, extraEnd] = section?.split(endMarker) ?? [];
  if (after === undefined || extraStart !== undefined || extraEnd !== undefined) {
    throw new Error("Expected one API parity table between the start and end markers.");
  }

  const groups = [{ id: "core", api: CORE_API }, ...MODULES];
  const rows = groups.flatMap(({ id, api }) => api.map(({ resource, read, write, mcp, events }) =>
    `| ${id} | ${resource} | ${read} | ${write} | ${mcp} | ${events} |`,
  ));
  const table = [
    "| Area | Resource | REST read | Write | MCP | Events |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");

  return `${before}${startMarker}\n${table}\n${endMarker}${after}`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const path = new URL("../docs/design/API_PLATFORM.md", import.meta.url);
  const markdown = readFileSync(path, "utf8");
  const updated = updateApiParityTable(markdown);
  if (updated !== markdown) writeFileSync(path, updated);
}
