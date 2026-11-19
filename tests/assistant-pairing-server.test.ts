import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { startPairingServer } from "./pairing/server";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("refuses a failed bind even when a different process responds on the expected URL", async () => {
  const database = "postgresql://test@localhost/pair_test";
  vi.stubEnv("DATABASE_URL", database);
  vi.stubEnv("PAIRING_DATABASE_URL", database);
  const foreign = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ready"));
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), exitCode: 1, signalCode: null });
  vi.mocked(spawn).mockImplementation(() => {
    queueMicrotask(() => child.emit("exit", 1)); // EADDRINUSE before the listen callback
    return child as unknown as ReturnType<typeof spawn>;
  });
  await expect(startPairingServer()).rejects.toThrow("exited before listening");
  expect(foreign).not.toHaveBeenCalled();
  expect(spawn).toHaveBeenCalledWith(process.execPath, expect.arrayContaining(["tests/pairing/serve.mjs"]),
    expect.objectContaining({ env: expect.objectContaining({ DATABASE_URL: database, PAIRING_DATABASE_URL: database }) }));
});
