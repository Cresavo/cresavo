// The staging runner's operator HTTPS client, against a local server with a throwaway CA.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueCertificates, operatorFetch } from "../scripts/staging-consent/tls.mjs";

const hasOpenssl = (() => { try { execFileSync("openssl", ["version"], { stdio: "ignore" }); return true; } catch { return false; } })();

describe.skipIf(!hasOpenssl)("operator HTTPS requests", () => {
  const host = "probe.cresavo.test";
  let dir = "", server: Server, port = 0, ca: Buffer;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "cresavo-tls-test-"));
    const tls = issueCertificates(dir, [host]);
    ca = tls.ca;
    server = createServer({ key: tls.leaves[host].key, cert: tls.leaves[host].cert }, (req, res) => {
      if (req.url === "/whole") { res.writeHead(200, { "content-type": "text/plain" }); res.end("complete"); return; }
      // Headers and part of the body, then the connection drops.
      res.writeHead(200, { "content-type": "text/plain", "content-length": "1000" });
      res.write("partial");
      setTimeout(() => res.socket?.destroy(), 50);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => { server?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

  it("returns a complete response", async () => {
    await expect(operatorFetch(ca, `https://${host}:${port}/whole`)).resolves.toMatchObject({ status: 200, text: "complete" });
  });
  it("rejects when a TLS listener cannot bind, so the runner reaches its cleanup", async () => {
    const { tlsProxy } = await import("../scripts/staging-consent/tls.mjs");
    const leaf = issueCertificates(dir, [host]).leaves[host];
    // The probe server already holds this port.
    await expect(tlsProxy(leaf, 1, "x-real-ip", port)).rejects.toThrow(/^TLS_PROXY_LISTEN_FAILED$/);
  });
  it("rejects, with a static code, when the body is cut off after the headers", async () => {
    const started = Date.now();
    await expect(operatorFetch(ca, `https://${host}:${port}/cut`)).rejects.toThrow(/^OPERATOR_FETCH_INTERRUPTED$/);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 10_000);
});
