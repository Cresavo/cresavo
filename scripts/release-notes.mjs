#!/usr/bin/env node
// Prints release notes for a version: docs/releases/v<version>.md if it exists,
// otherwise the "## [<version>]" section of CHANGELOG.md. Fails if neither exists.
import { existsSync, readFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error("Usage: node scripts/release-notes.mjs <version>");
  process.exit(2);
}

const notesFile = `docs/releases/v${version}.md`;
const changelogLink = "https://github.com/Cresavo/cresavo/blob/main/CHANGELOG.md";

if (existsSync(notesFile)) {
  process.stdout.write(readFileSync(notesFile, "utf8"));
  process.exit(0);
}

const lines = readFileSync("CHANGELOG.md", "utf8").split("\n");
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`No ${notesFile} and no "## [${version}]" section in CHANGELOG.md.`);
  process.exit(1);
}
const rest = lines.slice(start + 1);
const end = rest.findIndex((line) => line.startsWith("## ["));
const section = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
process.stdout.write(`${section}\n\nFull history: [CHANGELOG](${changelogLink}).\n`);
