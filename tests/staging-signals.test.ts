// Ctrl-C during a browser scenario, with a real Chromium. Skipped where no browser is installed.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { expect, it } from "vitest";

const executable = process.env.STAGING_CHROMIUM_PATH ?? chromium.executablePath();
const browsers = fileURLToPath(new URL("../scripts/staging-consent/browsers.mts", import.meta.url));

it.skipIf(process.platform === "win32" || !existsSync(executable))("lets the runner finish its cleanup when Ctrl-C arrives with a browser open", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cresavo-signal-test-"));
  try {
    const script = join(dir, "runner.mts");
    // Like the runner: a SIGINT handler whose cleanup takes a while, then exits 130.
    writeFileSync(script, `import { launchBrowser } from ${JSON.stringify(browsers)};
      const browser = await launchBrowser("salon-demo.cresavo.test", 8443, "x");
      process.once("SIGINT", () => { setTimeout(async () => { await browser.close(); console.log("CLEANUP_DONE"); process.exit(130); }, 300); });
      console.log("READY");`);
    const child = spawn(process.execPath, ["--import", "tsx", script], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, STAGING_CHROMIUM_PATH: executable } });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("never ready")), 30_000);
      child.stdout.on("data", () => { if (output.includes("READY")) { clearTimeout(timer); resolve(); } });
    });
    child.kill("SIGINT");
    const code = await new Promise<number | null>(resolve => child.once("exit", resolve));
    expect(output).toContain("CLEANUP_DONE");
    expect(code).toBe(130);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);
