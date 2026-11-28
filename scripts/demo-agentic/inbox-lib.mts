import { lstatSync, realpathSync, mkdtempSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve, sep, join } from "node:path";

export function inboxDir(directory = process.env.BOOKING_CONSENT_INBOX_DIR) {
  if (!directory || !isAbsolute(directory)) throw new Error("A private inbox directory is required");
  const path = resolve(directory), root = realpathSync(tmpdir());
  if (!path.startsWith(root + sep + "booking-consent-inbox-") || realpathSync(path) !== path) throw new Error("Invalid inbox directory");
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) throw new Error("Inbox must be a private directory");
  return path;
}
export function initInbox() {
  const path = mkdtempSync(join(realpathSync(tmpdir()), "booking-consent-inbox-"));
  chmodSync(path, 0o700);
  return inboxDir(path);
}
