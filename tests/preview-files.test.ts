import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { previewFiles } from "../scripts/preview-files.mjs";

it.each([".vercelignore", ".dockerignore"])("%s inkluderar runtime-schemat men aldrig hemligheter/tester/andra dokument", (ignoreFile) => {
  const root = mkdtempSync(join(tmpdir(), "booking-preview-fixture-"));
  try {
    copyFileSync(ignoreFile, join(root, ".vercelignore"));
    const wanted = [
      "src/app/page.tsx",
      "scripts/server.mjs",
      "prisma/migrations/one/migration.sql",
      "docs/DEPENDENCY_REVIEW.md",
      "docs/agent-api-v1.openapi.yaml",
      "THIRD_PARTY_NATIVE_NOTICES.txt",
      "THIRD_PARTY_LUCIDE_LICENSE.txt",
    ];
    const rejected = [
      ".env",
      ".env.local",
      "src/.env",
      "scripts/operator.private.json",
      "src/local.key",
      ".vercel/project.json",
      "node_modules/fake/index.js",
      "tests/synthetic.test.ts",
      "docs/HANDOFF.md",
      "docs/private/file.json",
    ];
    // Check sensitive-looking names virtually; never create environment/key files.
    const virtual = rejected.filter((file) => /(?:\.env|private\.json|\.key)/.test(file));
    for (const file of [...wanted, ...rejected.filter((file) => !virtual.includes(file))]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "synthetic-fixture");
    }
    const ignored = spawnSync("git", ["-c", "core.excludesFile=", "-c", "init.templateDir=", "init", "--quiet", root]);
    expect(ignored.status).toBe(0);
    copyFileSync(".vercelignore", join(root, ".gitignore"));
    for (const file of virtual) {
      expect(spawnSync("git", ["-C", root, "check-ignore", "--no-index", file]).status).toBe(0);
    }
    expect(spawnSync("git", ["-C", root, "check-ignore", "--no-index", ".env.example"]).status).toBe(1);
    const files = previewFiles(root);
    for (const file of wanted) expect(files).toContain(file);
    for (const file of rejected) expect(files).not.toContain(file);
  } finally {
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + sep) ||
      !basename(root).startsWith("booking-preview-fixture-")
    )
      throw new Error("PREVIEW_FIXTURE_PATH_REFUSED");
    rmSync(root, { recursive: true, force: true });
  }
});

it("kopierar OpenAPI-filen till containerns runtime där routen läser den", () => {
  const runtime = readFileSync("Dockerfile.vercel", "utf8").replace(/\r\n/g, "\n").split(/^FROM /m).at(-1)!;
  expect(runtime).toMatch(/^COPY --from=build --chown=node:node \/app\/docs\/agent-api-v1\.openapi\.yaml \.\/docs\/agent-api-v1\.openapi\.yaml$/m);
});
