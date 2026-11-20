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
      // A response that never ends: a little data every 50 ms, so no idle timeout fires.
      if (req.url === "/trickle") { res.writeHead(200, { "content-type": "text/plain" }); const timer = setInterval(() => res.write("."), 50); res.on("close", () => clearInterval(timer)); return; }
      if (req.url === "/huge") { res.writeHead(200, { "content-type": "text/plain" }); res.end("x".repeat(64 * 1024)); return; }
      // Headers and part of the body, then the connection drops.
      res.writeHead(200, { "content-type": "text/plain", "content-length": "1000" });
      res.write("partial");
      setTimeout(() => res.socket?.destroy(), 50);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => { server?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

  it("issues certificates for host names longer than a certificate common name allows", async () => {
    const { X509Certificate } = await import("node:crypto");
    // 4 labels of 60 characters: a valid 247-character host name, far over OpenSSL's 64 for a CN.
    const long = `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.test`;
    const leafDir = mkdtempSync(join(tmpdir(), "cresavo-tls-test-"));
    try {
      const cert = new X509Certificate(issueCertificates(leafDir, [long]).leaves[long].cert);
      expect(cert.subjectAltName).toBe(`DNS:${long}`);
      expect(cert.subject).toBe("CN=cresavo-staging-leaf");
      expect(cert.checkHost(long)).toBe(long);
    } finally { rmSync(leafDir, { recursive: true, force: true }); }
  });
  it("returns a complete response", async () => {
    await expect(operatorFetch(ca, `https://${host}:${port}/whole`)).resolves.toMatchObject({ status: 200, text: "complete" });
  });
  it("bounds the whole response in time and size, with static codes", async () => {
    const started = Date.now();
    await expect(operatorFetch(ca, `https://${host}:${port}/trickle`, { timeoutMs: 400 })).rejects.toThrow(/^OPERATOR_FETCH_TIMEOUT$/);
    expect(Date.now() - started).toBeLessThan(3000);
    await expect(operatorFetch(ca, `https://${host}:${port}/huge`, { maxBytes: 1024 })).rejects.toThrow(/^OPERATOR_FETCH_TOO_LARGE$/);
    await expect(operatorFetch(ca, `https://${host}:${port}/huge`)).resolves.toMatchObject({ status: 200 });
  }, 10_000);
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
