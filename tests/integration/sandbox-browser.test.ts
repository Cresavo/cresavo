import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { addressProof } from "../../scripts/client-address.mjs";
import { pinnedContext, startHosted } from "../../scripts/sandbox/gateway-adapter.mjs";
import { sandboxPage } from "@/lib/agent-api/sandbox/browser-page";
import { decideSandboxPhone, pairSandboxBrowser, readSandboxPhone, redeemSandboxPhone } from "@/lib/agent-api/sandbox/phone";
import { sandboxAgentRoute } from "@/lib/agent-api/sandbox/api";
import { AGENT_SCOPES } from "@/lib/agent-api/keys";
import { sandboxTransaction } from "@/lib/agent-api/sandbox/store";

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("LOCAL_LISTENER_REQUIRED");
  return "https://127.0.0.1:" + address.port;
}

it.skipIf(!process.env.SANDBOX_BROWSER_TLS || !process.env.SANDBOX_GATEWAY_CHECKOUT)(
  "checks the real browser approval path and keeps credentials on their selected origins",
  async () => {
    const tlsDir = process.env.SANDBOX_BROWSER_TLS!;
    const tls = { key: readFileSync(join(tlsDir, "local-key.pem")), cert: readFileSync(join(tlsDir, "local-cert.pem")) };
    const credentials = { service: randomBytes(32).toString("hex"), socket: randomBytes(32).toString("hex") };
    let providerOrigin = "";
    let unreachableRequests = 0;
    const provider = createServer(tls, async (incoming, outgoing) => {
      try {
        const url = new URL(incoming.url ?? "/", providerOrigin);
        if (url.pathname === "/redirect") {
          outgoing.writeHead(302, { location: "/unexpected-target" }).end();
          return;
        }
        if (url.pathname === "/unexpected-target") { unreachableRequests++; outgoing.writeHead(404).end(); return; }
        const headers = new Headers(incoming.headers as Record<string, string>);
        headers.set("x-booking-client-ip", "192.0.2.150");
        headers.set("x-booking-client-proof", addressProof("192.0.2.150", credentials.socket));
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const request = new Request(url, { method: incoming.method, headers, body: chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined });
        const browserRoutes = {
          "/sandbox": () => sandboxPage(request, false),
          "/sandbox/phone": () => sandboxPage(request, true),
          "/api/sandbox/pair": () => pairSandboxBrowser(request),
          "/api/sandbox/phone": () => readSandboxPhone(request),
          "/api/sandbox/phone/redeem": () => redeemSandboxPhone(request),
          "/api/sandbox/phone/decision": () => decideSandboxPhone(request),
        } as Record<string, () => Response | Promise<Response>>;
        const handler = browserRoutes[url.pathname];
        const route = incoming.method + " " + url.pathname.replace(/(\/api\/v1\/(?:proposals|bookings))\/[^/]+$/, "$1/{id}");
        const response = handler ? await handler() : await sandboxAgentRoute(request, route, AGENT_SCOPES);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.writeHead(500).end();
      }
    });
    let gatewayApp: import("node:http").Server | undefined;
    const gatewayServer = createServer(tls, (req, res) => { gatewayApp?.emit("request", req, res); });
    try {
      providerOrigin = await listen(provider);
      const gatewayOrigin = await listen(gatewayServer);
      for (const [key, value] of Object.entries({
        BOOKING_SANDBOX: "1", BOOKING_CONSENT_DELIVERY: "sandbox-demo-phone", BOOKING_SANDBOX_ORIGIN: providerOrigin,
        BOOKING_SANDBOX_DB_ID: process.env.SANDBOX_TEST_INSTALLATION_ID, BOOKING_SERVICE_ROLE: "salon", BOOKING_RUNTIME: "local",
        BOOKING_ADDRESS_SECRET: credentials.socket, BOOKING_PUBLIC_ORIGIN: gatewayOrigin, GATEWAY_SERVICE_TOKEN: credentials.service,
        BOOKING_SANDBOX_IP_KEY: randomBytes(32).toString("hex"), SESSION_SECRET: randomBytes(32).toString("hex"),
        SANDBOX_PROVIDER_ORIGIN: providerOrigin,
      })) vi.stubEnv(key, value);
      const gatewayCheckout = process.env.SANDBOX_GATEWAY_CHECKOUT!;
      const { gateway } = await import(pathToFileURL(resolve(gatewayCheckout, "src/server.js")).href);
      gatewayApp = gateway(providerOrigin, credentials.service, { publicOrigin: gatewayOrigin });
      const browser = await chromium.launch();
      try {
        const context = await pinnedContext(browser, providerOrigin);
        const page = await context.newPage();
        await expect(page.goto(providerOrigin + "/redirect")).rejects.toThrow();
        expect(unreachableRequests).toBe(0);
      } finally { await browser.close(); }
      const before = await sandboxTransaction(tx => tx.sandboxSession.count());
      await expect(startHosted({ gatewayOrigin: "https://wrong.example.test" })).rejects.toThrow("SANDBOX_BROWSER_PAIR_FAILED");
      expect(await sandboxTransaction(tx => tx.sandboxSession.count())).toBe(before);

      const child = spawn(process.execPath, [
        "scripts/e2e.js", "--gateway", gatewayOrigin, "--adapter", resolve("scripts/sandbox/gateway-adapter.mjs"),
      ], { cwd: gatewayCheckout, stdio: ["ignore", "pipe", "ignore"], env: {
        NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
        SystemRoot: process.env.SystemRoot, LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
        NODE_EXTRA_CA_CERTS: join(tlsDir, "local-cert.pem"), SANDBOX_PROVIDER_ORIGIN: providerOrigin,
      } });
      const chunks: Buffer[] = [];
      child.stdout.on("data", chunk => chunks.push(chunk));
      const killTimer = setTimeout(() => child.kill(), 40_000);
      try {
        const [code] = await once(child, "close");
        const output = Buffer.concat(chunks).toString("utf8");
        // Only fixed messages from the kit may reach the log.
        const result = output.split("\n").filter(line => /^\[e2e\] (?:PASS|FAIL|RESULT)\b/.test(line));
        for (const line of result) console.info(line);
        expect(code).toBe(0);
        expect(result.filter(line => line.startsWith("[e2e] PASS"))).toHaveLength(2);
      } finally { clearTimeout(killTimer); }
    } finally {
      vi.unstubAllEnvs();
      for (const server of [provider, gatewayServer]) {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    }
  }, 60_000,
);
