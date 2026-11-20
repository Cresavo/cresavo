// The staging runner's browser launch, with Playwright replaced: nothing is started.
import { afterEach, expect, it, vi } from "vitest";

const launch = vi.fn().mockResolvedValue({ close: async () => {} });
vi.mock("@playwright/test", () => ({ chromium: { launch: (...args: unknown[]) => launch(...args) } }));
const { launchBrowser } = await import("../scripts/staging-consent/browsers.mjs");
afterEach(() => { launch.mockClear(); vi.unstubAllEnvs(); });

it("leaves SIGINT, SIGTERM and SIGHUP to the runner, so Ctrl-C still runs its cleanup", async () => {
  for (const name of Object.keys(process.env)) if (/^(SELENIUM_REMOTE_|PW_TEST_CONNECT_)/i.test(name)) vi.stubEnv(name, undefined);
  await launchBrowser("salon-demo.cresavo.test", 8443, "x");
  expect(launch).toHaveBeenCalledTimes(1);
  expect(launch.mock.calls[0][0]).toMatchObject({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false });
  // Only the salon host and TLS port, and a closed environment for the browser.
  const options = launch.mock.calls[0][0] as { args: string[]; env: Record<string, string> };
  expect(options.args).toContain("--host-rules=MAP salon-demo.cresavo.test:8443 127.0.0.1:8443, MAP * ~NOTFOUND");
  expect(Object.keys(options.env).sort()).toEqual(["HOME", "PATH"]);
});
