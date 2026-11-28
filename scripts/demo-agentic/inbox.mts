import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inboxDir, initInbox } from "./inbox-lib.mjs";
try {
  if (process.argv.includes("--init")) {
    const dir = initInbox();
    console.log(`export BOOKING_CONSENT_INBOX_DIR='${dir.replaceAll("'", "'\\''")}'`);
  } else {
    const dir = inboxDir();
    const files = readdirSync(dir).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
    for (const file of files) {
      const message = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (message.proposalId === file.slice(0, -5) && /^\d{6}$/.test(message.code) && /^[a-z0-9]\*\*\*@example\.test$/.test(message.contactEmailMask)) console.log(`${message.proposalId} ${message.contactEmailMask}: ${message.code}`);
    }
    if (!files.length) console.log("Inbox is empty.");
  }
} catch { console.error("Inbox unavailable or unsafe."); process.exitCode = 1; }
