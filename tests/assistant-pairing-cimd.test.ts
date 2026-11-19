import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { resolveClient } from "../src/concept/pairing/clients";

const { lookup, get } = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:https", () => ({ get }));
afterEach(() => { vi.clearAllMocks(); });

const id = "https://assistant.example.test/identity";
const metadata = { client_name: "Example", client_id: id, redirect_uris: ["https://assistant.example.test/return"] };
function document(status: number, content: string) {
  lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  get.mockImplementation((_options, receive) => {
    const req = Object.assign(new EventEmitter(), { destroy: (error: Error) => req.emit("error", error) });
    queueMicrotask(() => {
      const res = Object.assign(new PassThrough(), { statusCode: status, headers: { "content-type": "application/json" } });
      receive(res);
      res.end(content);
    });
    return req;
  });
}
it("pins the public DNS answer, checks the original TLS name and bounds the complete request", async () => {
  document(200, JSON.stringify(metadata));
  expect(await resolveClient(id)).toEqual({ id, name: "Example", redirects: metadata.redirect_uris });
  expect(get).toHaveBeenCalledWith(expect.objectContaining({
    hostname: "1.1.1.1", port: 443, servername: "assistant.example.test", path: "/identity", agent: false,
    signal: expect.any(AbortSignal),
  }), expect.any(Function));
  expect(lookup).toHaveBeenCalledTimes(1);
});
it("refuses a mixed DNS answer before opening any connection", async () => {
  lookup.mockResolvedValue([{ address: "1.1.1.1" }, { address: "10.0.0.1" }]);
  await expect(resolveClient(id)).rejects.toThrow("invalid_client_metadata");
  expect(get).not.toHaveBeenCalled();
});
it.each([
  [302, ""],
  [200, JSON.stringify({ ...metadata, client_id: "https://other.example.test/identity" })],
  [200, JSON.stringify({ ...metadata, extra: "x".repeat(16384) })],
] as const)("rejects redirects, mismatched identity and oversized documents", async (status, payload) => {
  document(status, payload);
  await expect(resolveClient(id)).rejects.toThrow("invalid_client_metadata");
  expect(get).toHaveBeenCalledTimes(1);
});
