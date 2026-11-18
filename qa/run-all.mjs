// Runs every QA script against an already running production build and writes out/summary.md.
// Usage: node --import tsx qa/run-all.mjs   (QA_PORT, QA_CHROMIUM, QA_AXE, QA_OUT optional)
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { OUT } from "./lib.mjs";

const dir = path.dirname(new URL(import.meta.url).pathname);
const scripts = ["hosts", "crawl", "nav", "flows", "axe", "tints"];
const only = process.argv.slice(2);
const lines = ["# QA run " + new Date().toISOString(), ""];
let failed = 0;
for (const name of scripts.filter(s => !only.length || only.includes(s))) {
  const t = Date.now();
  const run = spawnSync(process.execPath, ["--import", "tsx", path.join(dir, `${name}.mjs`)], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: process.env, timeout: 30 * 60 * 1000 });
  const fails = (run.stdout.match(/^FAIL .*/gm) ?? []);
  const tail = run.stdout.trim().split("\n").slice(-1)[0];
  if (run.status !== 0 || fails.length) failed++;
  lines.push(`## ${name} (${Math.round((Date.now() - t) / 1000)} s, exit ${run.status})`, "", ...fails.map(f => `- ${f}`), `- ${tail}`, "");
  if (run.stderr.trim()) lines.push("```", run.stderr.trim().slice(-1500), "```", "");
  console.log(`${name}: exit ${run.status}, ${fails.length} failing checks`);
}
writeFileSync(path.join(OUT, "summary.md"), lines.join("\n"));
console.log(`summary: ${path.join(OUT, "summary.md")}`);
process.exitCode = failed ? 1 : 0;
