// Read the private, operator-dispatched source bundle. No cross-repo credentials.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

let source;
const prefix = join(resolve(tmpdir()), "booking-gateway-");
try {
  const pin = JSON.parse(readFileSync(new URL("./pair.json", import.meta.url), "utf8"));
  const { inputs } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  assert(/^[a-f0-9]{40}$/.test(inputs.gateway_revision));
  assert.equal(inputs.gateway_revision, pin.gatewayRevision);
  assert(/^[a-f0-9]{64}$/.test(inputs.gateway_bundle_hash));
  assert(inputs.gateway_bundle.length <= 60000 && inputs.gateway_bundle.length % 4 === 0);
  assert(/^[A-Za-z0-9+/]+={0,2}$/.test(inputs.gateway_bundle));
  const bundle = Buffer.from(inputs.gateway_bundle, "base64");
  assert.equal(createHash("sha256").update(bundle).digest("hex"), inputs.gateway_bundle_hash);
  source = mkdtempSync(prefix);
  const bundlePath = join(source, "source.bundle");
  writeFileSync(bundlePath, bundle);
  const git = (...args) => execFileSync("git", args, { cwd: source, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("bundle", "verify", bundlePath);
  git("fetch", "--quiet", bundlePath, "HEAD");
  git("checkout", "--quiet", "--detach", inputs.gateway_revision);
  assert.equal(git("rev-parse", "HEAD"), pin.gatewayRevision);
  // The bundle is outside the tracked source tree during the proof.
  appendFileSync(join(source, ".git/info/exclude"), "\n/source.bundle\n");
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(JSON.parse(readFileSync(join(source, "package.json"), "utf8")).name, "booking-lab-gateway");
  appendFileSync(process.env.GITHUB_OUTPUT, `path=${source}\n`);
  console.log("PASS PINNED_GATEWAY_BUNDLE_VERIFIED");
} catch {
  if (source && resolve(source).startsWith(prefix)) rmSync(source, { recursive: true });
  console.error("FAIL GATEWAY_BUNDLE_REFUSED"); process.exitCode = 1;
}
