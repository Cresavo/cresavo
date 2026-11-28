import { request } from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startPairingServer } from "../pairing/server";

let stop: () => Promise<void>;
beforeAll(async () => { stop = await startPairingServer(); }, 100000);
afterAll(async () => { await stop?.(); });

function post(path: string, headers: Record<string, string>) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: 3740, method: "POST", path, headers }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(2000, () => req.destroy(new Error("Entry point did not refuse the unfinished body")));
    req.on("error", reject);
    // Keep the body unfinished: the entry point must respond without reading it.
    req.flushHeaders();
  });
}

it("caps normalized login paths before reading HTTP bodies", async () => {
  for (const route of ["owner", "admin"]) {
    for (const path of [`/api/x/../${route}/login`, `/api/x/%2e%2e/${route}/login?test=1`, `/api/./${route}/login/`]) {
      expect(await post(path, { "content-length": "8193" })).toEqual({ status: 413, body: '{"error":"too_large"}' });
      expect(await post(path, { "transfer-encoding": "chunked" })).toEqual({ status: 411, body: '{"error":"length_required"}' });
    }
  }
}, 30000);
