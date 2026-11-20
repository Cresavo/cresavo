// Ephemeral TLS for one staging run: a throwaway CA, one leaf per host name and a
// small HTTPS reverse proxy in front of each loopback process. Keys live only in the
// run's private temporary directory, which the runner deletes at exit.
import { execFileSync } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { Agent as HttpsAgent, type AgentOptions, createServer, request as httpsRequest, type Server } from "node:https";
import { join } from "node:path";

const openssl = (args: string[]) => execFileSync("openssl", args, { stdio: ["ignore", "ignore", "ignore"] });
const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes"];

export type Leaf = { key: Buffer; cert: Buffer; spki: string };
export function issueCertificates(dir: string, hosts: string[]) {
  const caKey = join(dir, "ca.key"), ca = join(dir, "ca.pem");
  openssl(["req", "-x509", ...ec, "-keyout", caKey, "-out", ca, "-days", "1", "-subj", "/CN=Cresavo staging run CA (ephemeral)",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0", "-addext", "keyUsage=critical,keyCertSign"]);
  const leaves: Record<string, Leaf> = {};
  for (const [index, host] of hosts.entries()) {
    // Short file names (a host name may be 253 characters, a file name component at most 255
    // bytes): the full host name is only in the certificate's subjectAltName and the map below.
    const base = join(dir, `leaf-${index}`);
    const key = `${base}.key`, csr = `${base}.csr`, cert = `${base}.pem`, ext = `${base}.ext`;
    writeFileSync(ext, `subjectAltName=DNS:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n`, { mode: 0o600 });
    // A fixed short common name: OpenSSL caps it at 64 characters, host names may be 253. TLS
    // checks the subjectAltName, which carries the full host name.
    openssl(["req", ...ec, "-keyout", key, "-out", csr, "-subj", "/CN=cresavo-staging-leaf"]);
    openssl(["x509", "-req", "-in", csr, "-CA", ca, "-CAkey", caKey, "-CAcreateserial", "-days", "1", "-out", cert, "-extfile", ext]);
    const pem = readFileSync(cert);
    const spki = createHash("sha256").update(new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" })).digest("base64");
    leaves[host] = { key: readFileSync(key), cert: pem, spki };
  }
  return { caPath: ca, ca: readFileSync(ca), leaves };
}

/** Terminates TLS for one host name and forwards to a loopback HTTP port, keeping Host. */
export function tlsProxy(leaf: Leaf, target: number, client: "x-forwarded-for" | "x-real-ip", listenPort = 0) {
  const server = createServer({ key: leaf.key, cert: leaf.cert, minVersion: "TLSv1.2" }, (req, res) => {
    const headers: IncomingHttpHeaders = { ...req.headers };
    // The proxy owns the client identity headers; client-supplied values are discarded.
    for (const name of ["x-forwarded-for", "x-real-ip", "x-forwarded-host", "x-forwarded-proto"]) delete headers[name];
    headers[client] = req.socket.remoteAddress?.replace(/^::ffff:/, "") ?? "127.0.0.1";
    headers["x-forwarded-proto"] = "https";
    const upstream = httpRequest({ host: "127.0.0.1", port: target, method: req.method, path: req.url, headers }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  // A failed bind emits `error`, not the listen callback: reject, so the runner reaches its cleanup.
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    server.once("error", () => reject(new Error("TLS_PROXY_LISTEN_FAILED")));
    server.listen(listenPort, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

// Operator probes connect directly to the loopback listener, never through the caller's proxy: the
// global agent follows HTTPS_PROXY when NODE_USE_ENV_PROXY is set, a dedicated agent with an empty
// proxy environment does not. No kept-alive sockets, so nothing outlives a probe.
const directAgent = new HttpsAgent({ keepAlive: false, proxyEnv: {} } as AgentOptions & { proxyEnv: Record<string, never> });

/**
 * HTTPS request from the operator process, resolving only the given host to loopback and trusting
 * only the run CA. Certificate checks are explicit, not left to NODE_TLS_REJECT_UNAUTHORIZED.
 */
export function operatorFetch(ca: Buffer, url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number } = {}) {
  const target = new URL(url);
  // The whole exchange is bounded, not only idle time: a response that keeps trickling data
  // or grows without end is cut off with a static code, so the runner always reaches cleanup.
  const timeoutMs = init.timeoutMs ?? 20_000, maxBytes = init.maxBytes ?? 4 * 1024 * 1024;
  return new Promise<{ status: number; headers: IncomingHttpHeaders; text: string }>((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, value?: { status: number; headers: IncomingHttpHeaders; text: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) { req.destroy(); reject(error); } else resolve(value!);
    };
    const req = httpsRequest({ host: target.hostname, port: target.port, path: target.pathname + target.search, method: init.method ?? "GET",
      headers: init.headers, ca, servername: target.hostname, rejectUnauthorized: true, agent: directAgent,
      lookup: ((_host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) =>
        options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4)) as never }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) return finish(new Error("OPERATOR_FETCH_TOO_LARGE"));
        chunks.push(chunk);
      });
      response.on("end", () => finish(null, { status: response.statusCode ?? 0, headers: response.headers, text: Buffer.concat(chunks).toString("utf8") }));
      // A connection that closes after the headers but before the body is complete is reported on
      // the response, not the request: settle with a static code instead of waiting forever.
      const interrupted = () => finish(new Error("OPERATOR_FETCH_INTERRUPTED"));
      response.on("error", interrupted);
      response.on("aborted", interrupted);
      response.on("close", () => { if (!response.complete) interrupted(); });
    });
    const deadline = setTimeout(() => finish(new Error("OPERATOR_FETCH_TIMEOUT")), timeoutMs);
    req.on("error", () => finish(new Error("OPERATOR_FETCH_FAILED")));
    req.end(init.body);
  });
}
