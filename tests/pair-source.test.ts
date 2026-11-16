import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const pin = JSON.parse(readFileSync("scripts/integration/pair.json", "utf8"));
const bundle = Buffer.from("synthetic invalid bundle");
const valid = { gateway_revision: pin.gatewayRevision,
  gateway_bundle_hash: createHash("sha256").update(bundle).digest("hex"), gateway_bundle: bundle.toString("base64") };

it.each([
  { ...valid, gateway_revision: "../../other" },
  { ...valid, gateway_revision: "0".repeat(40) },
  { ...valid, gateway_bundle: "not base64!" },
  { ...valid, gateway_bundle: "A".repeat(60004) },
  { ...valid, gateway_bundle_hash: "0".repeat(64) },
  valid, // Matching digest is insufficient: Git must validate the actual bundle.
])("refuses invalid or unpinned CI source without echoing input", input => {
  const root = resolve(tmpdir());
  const dir = mkdtempSync(join(root, "booking-source-test-"));
  try {
    const event = join(dir, "event.json");
    writeFileSync(event, JSON.stringify({ inputs: input }));
    const result = spawnSync(process.execPath, ["scripts/integration/unpack-gateway.mjs"], {
      encoding: "utf8", timeout: 15000,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test",
        GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: join(dir, "output") },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("FAIL GATEWAY_BUNDLE_REFUSED");
  } finally {
    if (!resolve(dir).startsWith(root + sep)) throw new Error("TEST_TEMP_PATH_REFUSED");
    rmSync(dir, { recursive: true });
  }
});
