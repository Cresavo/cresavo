import { expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { previewFiles } from "../scripts/preview-files.mjs";

it("paketerar app, wrapper och migrationer, men aldrig hemligheter/tester/andra dokument", () => {
  const root = mkdtempSync(join(tmpdir(), "booking-preview-fixture-"));
  try {
    copyFileSync(".vercelignore", join(root, ".vercelignore"));
    const wanted = ["src/app/page.tsx", "scripts/server.mjs", "prisma/migrations/one/migration.sql", "docs/DEPENDENCY_REVIEW.md", "THIRD_PARTY_NATIVE_NOTICES.txt", ".env.example"];
    const rejected = [".env", ".env.local", "src/.env", "scripts/operator.private.json", "src/local.key", ".vercel/project.json", "node_modules/fake/index.js", "tests/synthetic.test.ts", "docs/HANDOFF.md", "docs/private/file.json"];
    for (const file of [...wanted, ...rejected]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "synthetic-fixture");
    }
    const files = previewFiles(root);
    for (const file of wanted) expect(files).toContain(file);
    for (const file of rejected) expect(files).not.toContain(file);
  } finally {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) ||
        !basename(root).startsWith("booking-preview-fixture-"))
      throw new Error("PREVIEW_FIXTURE_PATH_REFUSED");
    rmSync(root, { recursive: true, force: true });
  }
});
