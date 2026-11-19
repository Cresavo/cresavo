import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = "scripts/release-notes.mjs";

describe("release notes", () => {
  it("uses docs/releases/v<version>.md when it exists", () => {
    const notes = execFileSync("node", [script, "0.4.0"], { encoding: "utf8" });
    expect(notes).toBe(readFileSync("docs/releases/v0.4.0.md", "utf8"));
  });

  it("falls back to the CHANGELOG section of that version", () => {
    const notes = execFileSync("node", [script, "0.1.0"], { encoding: "utf8" });
    expect(notes).toContain("Booking engine proof of concept");
    expect(notes).not.toContain("## [");
    expect(notes).toContain("Full history: [CHANGELOG]");
  });

  it("fails for an unknown or malformed version", () => {
    expect(spawnSync("node", [script, "9.9.9"]).status).toBe(1);
    expect(spawnSync("node", [script, "latest"]).status).toBe(2);
  });

  it("has notes for the version in package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(spawnSync("node", [script, version]).status).toBe(0);
  });
});
