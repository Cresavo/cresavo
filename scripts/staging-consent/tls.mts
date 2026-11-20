// Ephemeral TLS for one staging run: a throwaway CA, one leaf per host name and a
// small HTTPS reverse proxy in front of each loopback process. Keys live only in the
// run's private temporary directory, which the runner deletes at exit.
import { execFileSync } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { createServer, request as httpsRequest, type Server } from "node:https";
import { join } from "node:path";

const openssl = (args: string[]) => execFileSync("openssl", args, { stdio: ["ignore", "ignore", "ignore"] });
const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes"];

export type Leaf = { key: Buffer; cert: Buffer; spki: string };
export function issueCertificates(dir: string, hosts: string[]) {
  const caKey = join(dir, "ca.key"), ca = join(dir, "ca.pem");
  openssl(["req", "-x509", ...ec, "-keyout", caKey, "-out", ca, "-days", "1", "-subj", "/CN=Cresavo staging run CA (ephemeral)",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0", "-addext", "keyUsage=critical,keyCertSign"]);
  const leaves: Record<string, Leaf> = {};
  for (const host of hosts) {
    const key = join(dir, `${host}.key`), csr = join(dir, `${host}.csr`), cert = join(dir, `${host}.pem`), ext = join(dir, `${host}.ext`);
    writeFileSync(ext, `subjectAltName=DNS:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n`, { mode: 0o600 });
    openssl(["req", ...ec, "-keyout", key, "-out", csr, "-subj", `/CN=${host}`]);
    openssl(["x509", "-req", "-in", csr, "-CA", ca, "-CAkey", caKey, "-CAcreateserial", "-days", "1", "-out", cert, "-extfile", ext]);
    const pem = readFileSync(cert);
    const spki = createHash("sha256").update(new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" })).digest("base64");
    leaves[host] = { key: readFileSync(key), cert: pem, spki };
  }
  return { caPath: ca, ca: readFileSync(ca), leaves };
}

/** Terminates TLS for one host name and forwards to a loopback HTTP port, keeping Host. */
export function tlsProxy(leaf: Leaf, target: number, client: "x-forwarded-for" | "x-real-ip") {
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
  return new Promise<{ server: Server; port: number }>(resolve =>
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port })));
}

/** HTTPS request from the operator process, resolving only the given host to loopback and trusting only the run CA. */
export function operatorFetch(ca: Buffer, url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const target = new URL(url);
  return new Promise<{ status: number; headers: IncomingHttpHeaders; text: string }>((resolve, reject) => {
    const req = httpsRequest({ host: target.hostname, port: target.port, path: target.pathname + target.search, method: init.method ?? "GET",
      headers: init.headers, ca, servername: target.hostname,
      lookup: ((_host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) =>
        options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4)) as never }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, text: Buffer.concat(chunks).toString("utf8") }));
      // A connection that closes after the headers but before the body is complete is reported on
      // the response, not the request: settle with a static code instead of waiting forever.
      const interrupted = () => reject(new Error("OPERATOR_FETCH_INTERRUPTED"));
      response.on("error", interrupted);
      response.on("aborted", interrupted);
      response.on("close", () => { if (!response.complete) interrupted(); });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("OPERATOR_FETCH_TIMEOUT")));
    req.end(init.body);
  });
}
