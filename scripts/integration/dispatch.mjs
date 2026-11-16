// Uses the operator's existing gh login. No credential is read or transmitted by this script.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const gateway = resolve(process.argv[2] ?? "../booking-lab-gateway");
const ref = process.argv[3];
assert(ref && /^[A-Za-z0-9/_-]+$/.test(ref), "Specify an explicit pushed salon branch");
const pin = JSON.parse(readFileSync(new URL("./pair.json", import.meta.url), "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: gateway, encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain"), "", "Gateway source must be clean");
assert.equal(git("rev-parse", "HEAD"), pin.gatewayRevision, "Gateway revision must match pair.json");
const temp = mkdtempSync(join(tmpdir(), "booking-pair-dispatch-"));
const bundlePath = join(temp, "gateway.bundle");
git("bundle", "create", bundlePath, "HEAD");
const bundle = readFileSync(bundlePath);
const payload = JSON.stringify({ ref, inputs: {
  gateway_revision: pin.gatewayRevision,
  gateway_bundle_hash: createHash("sha256").update(bundle).digest("hex"),
  gateway_bundle: bundle.toString("base64"),
} });
assert(Buffer.byteLength(payload) < 65000, "Bundle exceeds dispatch limit; use reviewed repository read access instead");
const body = join(temp, "request.json");
writeFileSync(body, payload, { mode: 0o600 });
execFileSync("gh", ["api", "--method", "POST",
  "repos/niclasvestlund-YT/booking-lab-se/actions/workflows/verify.yml/dispatches", "--input", body], { stdio: "inherit" });
console.log("PAIR_DISPATCHED " + pin.gatewayRevision);
