// Ctrl-C during a browser scenario, with a real Chromium. Skipped where no browser is installed.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { expect, it } from "vitest";
import { CLEANUP_SIGNALS } from "../scripts/staging-consent/lifecycle.mjs";

const executable = process.env.STAGING_CHROMIUM_PATH ?? chromium.executablePath();
const browsers = fileURLToPath(new URL("../scripts/staging-consent/browsers.mts", import.meta.url));

it("cleans up on every signal that can end a run, a closed terminal included", () => {
  expect([...CLEANUP_SIGNALS].sort()).toEqual(["SIGHUP", "SIGINT", "SIGTERM"]);
});

it.skipIf(process.platform === "win32" || !existsSync(executable)).each([...CLEANUP_SIGNALS])("lets the runner finish its cleanup on %s with a browser open", async signal => {
  const dir = mkdtempSync(join(tmpdir(), "cresavo-signal-test-"));
  try {
    const script = join(dir, "runner.mts");
    // Like the runner: a handler whose cleanup takes a while, then exits 130. The browser must
    // still be the runner's to close: Playwright's own handler would close or kill it first.
    writeFileSync(script, `import { launchBrowser } from ${JSON.stringify(browsers)};
      const browser = await launchBrowser("salon-demo.cresavo.test", 8443, "x");
      process.once(${JSON.stringify(signal)}, () => { setTimeout(async () => { console.log("CONNECTED_AT_CLEANUP=" + browser.isConnected()); await browser.close(); console.log("CLEANUP_DONE"); process.exit(130); }, 300); });
      console.log("READY");`);
    const child = spawn(process.execPath, ["--import", "tsx", script], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, STAGING_CHROMIUM_PATH: executable } });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("never ready")), 30_000);
      child.stdout.on("data", () => { if (output.includes("READY")) { clearTimeout(timer); resolve(); } });
    });
    child.kill(signal);
    const code = await new Promise<number | null>(resolve => child.once("exit", resolve));
    expect(output).toContain("CONNECTED_AT_CLEANUP=true");
    expect(output).toContain("CLEANUP_DONE");
    expect(code).toBe(130);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);
