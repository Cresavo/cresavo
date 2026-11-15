import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import next from "next";
import {
  proxyPolicy,
  resolveClientAddress,
  addressProof,
  proxyWarning,
  runtimePolicy,
  vercelClientAddress,
} from "./client-address.mjs";

// The only supported HTTP entry point: Next routes do not expose socket.remoteAddress.
const dev = process.argv.includes("--dev");
process.env.NODE_ENV = dev ? "development" : "production";
process.env.BOOKING_ADDRESS_SECRET = randomBytes(32).toString("hex");
const hostnameIndex = process.argv.indexOf("--hostname");
const hostname =
  hostnameIndex >= 0 ? process.argv[hostnameIndex + 1] : "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
try {
  const runtime = runtimePolicy(process.env);
  if (runtime === "vercel" && dev) throw new Error("BOOKING_RUNTIME_CONFIG_INVALID");
  const trusted = proxyPolicy(
    process.env.TRUST_PROXY_IP,
    process.env.TRUSTED_PROXY_IPS,
  );
  const app = next({ dev, hostname, port });
  const warnProxy = proxyWarning(process.env.TRUST_PROXY_IP, trusted);
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = createServer((req, res) => {
    try {
      if (runtime === "local") warnProxy(req.socket.remoteAddress, req.headers);
      const ip = runtime === "vercel" ? vercelClientAddress(req.headers) : resolveClientAddress(
        req.socket.remoteAddress,
        req.headers["x-real-ip"],
        trusted,
      );
      // Always overwrite client-supplied internal headers; no unsigned fallback in routes.
      req.headers["x-booking-client-ip"] = ip;
      req.headers["x-booking-client-proof"] = addressProof(
        ip,
        process.env.BOOKING_ADDRESS_SECRET,
      );
      void handle(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    } catch {
      res.writeHead(400);
      res.end("Ogiltig anslutning");
    }
  });
  server.on("upgrade", app.getUpgradeHandler());
  server.listen(port, hostname, () => console.log("BOOKING_SERVER_READY"));
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close();
      server.closeAllConnections();
      void app.close().finally(() => process.exit(0));
    });
} catch {
  console.error("BOOKING_SERVER_CONFIG_FAILED");
  process.exitCode = 1;
}
