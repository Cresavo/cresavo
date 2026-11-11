import { execFileSync } from "node:child_process";

export function demoRevision(exec = execFileSync) {
  try {
    return {
      revision: exec("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
      dirty: Boolean(
        exec("git", ["status", "--porcelain"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim(),
      ),
    };
  } catch {
    return { revision: "unknown", dirty: null };
  }
}
