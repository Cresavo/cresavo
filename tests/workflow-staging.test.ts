// The CI job that runs the staging runner with private gateway code: only ever on main.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");

/** The `staging-consent` job's block: from its key to the next job key at the same indent. */
function job(name: string) {
  const lines = workflow.split("\n"), start = lines.indexOf(`  ${name}:`);
  expect(start, `job ${name}`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line));
  return lines.slice(start, end === -1 ? undefined : end);
}

it("runs the staging job with the gateway token only on main, for a push or a manual run there", () => {
  const conditions = job("staging-consent").filter(line => /^ {4}if:/.test(line)).map(line => line.replace(/^ {4}if:\s*/, "").trim());
  expect(conditions).toEqual(["github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')"]);
  // The token is read only inside this job, and only by a step that the job condition covers.
  const uses = workflow.split("\n").filter(line => line.includes("secrets.GATEWAY_READ_TOKEN")).length;
  expect(job("staging-consent").filter(line => line.includes("secrets.GATEWAY_READ_TOKEN")).length).toBe(uses);
  expect(uses).toBeGreaterThan(0);
});
