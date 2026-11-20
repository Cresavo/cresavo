// The staging runner's operator HTTPS client, against a local server with a throwaway CA.
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
    // A valid 253-character host name (labels of 61, 61, 61 and 62 characters and "test"): far over OpenSSL's
    // 64 for a CN, and with ".key" appended over a file system's 255-byte name limit.
    const long = `${"a".repeat(61)}.${"b".repeat(61)}.${"c".repeat(61)}.${"d".repeat(62)}.test`;
    expect(long.length).toBe(253);
    const leafDir = mkdtempSync(join(tmpdir(), "cresavo-tls-test-"));
    try {
      const issued = issueCertificates(leafDir, [long, "short.cresavo.test"]);
      const cert = new X509Certificate(issued.leaves[long].cert);
      expect(new X509Certificate(issued.leaves["short.cresavo.test"].cert).subjectAltName).toBe("DNS:short.cresavo.test");
      for (const name of readdirSync(leafDir)) expect(name.length).toBeLessThan(40);
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
  it("checks the certificate itself, even with NODE_TLS_REJECT_UNAUTHORIZED=0 in this process", async () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    try {
      // A certificate for another name, and one from a CA other than the run's.
      await expect(operatorFetch(ca, `https://other.cresavo.test:${port}/whole`)).rejects.toThrow(/^OPERATOR_FETCH_FAILED$/);
      const otherDir = mkdtempSync(join(tmpdir(), "cresavo-tls-test-"));
      try {
        const otherCa = issueCertificates(otherDir, [host]).ca;
        await expect(operatorFetch(otherCa, `https://${host}:${port}/whole`)).rejects.toThrow(/^OPERATOR_FETCH_FAILED$/);
      } finally { rmSync(otherDir, { recursive: true, force: true }); }
      await expect(operatorFetch(ca, `https://${host}:${port}/whole`)).resolves.toMatchObject({ status: 200 });
    } finally { vi.unstubAllEnvs(); }
  });
  it("connects directly, never through a proxy configured in the environment", async () => {
    // A stand-in proxy that only counts connections.
    let connections = 0;
    const proxy = createTcpServer(socket => { connections++; socket.destroy(); });
    await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve));
    const proxyUrl = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;
    const caPath = join(dir, "probe-ca.pem"), script = join(dir, "probe.mts");
    writeFileSync(caPath, ca);
    writeFileSync(script, `import { readFileSync } from "node:fs";
      import { operatorFetch } from ${JSON.stringify(join(process.cwd(), "scripts/staging-consent/tls.mts"))};
      const ca = readFileSync(${JSON.stringify(caPath)});
      const direct = await operatorFetch(ca, ${JSON.stringify(`https://${host}:${port}/whole`)});
      // The same request through the global agent, to show the proxy setting is in effect here.
      const https = await import("node:https");
      const viaGlobal = await new Promise(resolve => https.get({ host: ${JSON.stringify(host)}, port: ${port}, path: "/whole", ca }, () => resolve("direct")).on("error", () => resolve("proxied")));
      console.log(JSON.stringify({ text: direct.text, viaGlobal }));`);
    try {
      const out = await new Promise<string>((resolve, reject) => execFile(process.execPath, ["--import", "tsx", script], {
        cwd: process.cwd(), timeout: 30_000,
        env: { PATH: process.env.PATH ?? "", HOME: dir, NODE_USE_ENV_PROXY: "1", HTTPS_PROXY: proxyUrl, https_proxy: proxyUrl } as unknown as NodeJS.ProcessEnv,
      }, (error, stdout) => error ? reject(error) : resolve(String(stdout))));
      const result = JSON.parse(out.trim().split("\n").pop()!);
      expect(result.text).toBe("complete");
      // The global agent went to the proxy (once); the operator probe did not.
      expect(result.viaGlobal).toBe("proxied");
      expect(connections).toBe(1);
    } finally { proxy.close(); }
  }, 40_000);
  it("rejects, with a static code, when the body is cut off after the headers", async () => {
    const started = Date.now();
    await expect(operatorFetch(ca, `https://${host}:${port}/cut`)).rejects.toThrow(/^OPERATOR_FETCH_INTERRUPTED$/);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 10_000);
});
