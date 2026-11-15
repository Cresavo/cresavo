// Git's ignore rules provide a dependency-free equivalent to the Vercel walk:
// ignored directories are never descended into. No file contents are read.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

export function previewFiles(root) {
  const temp = mkdtempSync(join(tmpdir(), "booking-preview-ignore-"));
  try {
    const git = (args, input) => {
      const result = spawnSync("git", ["-c", `core.excludesFile=${join(temp, "empty")}`, "-C", temp, ...args], { input, encoding: "utf8" });
      if (result.error || (result.status !== 0 && result.status !== 1))
        throw new Error("PREVIEW_IGNORE_CHECK_FAILED");
      return result.stdout;
    };
    writeFileSync(join(temp, "empty"), "");
    git(["-c", "init.templateDir=", "init", "--quiet"]);
    copyFileSync(join(root, ".vercelignore"), join(temp, ".gitignore"));
    const files = [];
    let directories = [""];
    while (directories.length) {
      const candidates = directories.flatMap((parent) =>
        readdirSync(join(root, parent), { withFileTypes: true }).map((entry) => ({
          path: parent ? `${parent}/${entry.name}` : entry.name,
          directory: entry.isDirectory(), symlink: entry.isSymbolicLink(),
        })),
      );
      if (!candidates.length) break;
      const ignored = new Set(git(["check-ignore", "--no-index", "--stdin", "-z"], candidates.map((e) => e.path).join("\0") + "\0").split("\0"));
      directories = [];
      for (const entry of candidates) {
        if (ignored.has(entry.path)) continue;
        if (entry.symlink) throw new Error("PREVIEW_SYMLINK_REFUSED");
        if (entry.directory) directories.push(entry.path);
        else files.push(entry.path);
      }
    }
    return files.sort();
  } finally {
    if (!resolve(temp).startsWith(resolve(tmpdir()) + sep) ||
        !basename(temp).startsWith("booking-preview-ignore-"))
      throw new Error("PREVIEW_TEMP_PATH_REFUSED");
    rmSync(temp, { recursive: true, force: true });
  }
}
