// Operator CLI for agent API keys. The plaintext key is printed once on create
// and never stored; list/revoke only ever show the public prefix.
//   npm run agent-keys -- create --agent "Codex test" --owner "Niclas" --contact "niclas@example.test" [--business demo] [--scopes services:read,availability:read,bookings:read,bookings:write] [--kind demo-script|registered-client|verified-agent-proof]
//   npm run agent-keys -- list [--business demo]
//   npm run agent-keys -- revoke <id|blk_prefix>
import { parseArgs } from "node:util";
import { stdout } from "node:process";
import { ZodError } from "zod";
import { db } from "../src/lib/db";
import { DEMO_BUSINESS_ID } from "../src/lib/config";
import { createAgentApiKey, listAgentApiKeys, revokeAgentApiKey } from "../src/lib/agent-api/keys";

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "string" },
      owner: { type: "string" },
      contact: { type: "string" },
      business: { type: "string" },
      scopes: { type: "string" },
      kind: { type: "string" },
      json: { type: "boolean" },
    },
  });
  if (action === "create") {
    const businessId = values.business ?? DEMO_BUSINESS_ID;
    // v1 engine serves one synthetic business; refuse keys that could never work.
    if (businessId !== DEMO_BUSINESS_ID) throw new Error("AGENT_KEY_UNKNOWN_BUSINESS");
    const { key, record } = await createAgentApiKey(
      {
        businessId,
        agentName: values.agent,
        ownerName: values.owner,
        ownerContact: values.contact,
        ...(values.scopes && { scopes: values.scopes.split(",").map((s) => s.trim()) }),
        ...(values.kind && { kind: values.kind }),
      },
      db,
    );
    stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    stdout.write("\nNote: the agent name and kind are shown publicly on /live.\n");
    stdout.write(`\nAPI key (shown once, store it securely now):\n${key}\n`);
  } else if (action === "list") {
    const rows = await listAgentApiKeys(db, values.business);
    if (values.json) stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    else
      for (const r of rows)
        stdout.write(
          `${r.keyPrefix}\t${r.revokedAt ? "REVOKED" : "active"}\t${r.kind}\t${r.businessId}\t${r.agentName}\t${r.ownerName} <${r.ownerContact}>\t${r.scopes.join(",")}\tlastUsed=${r.lastUsedAt ?? "never"}\n`,
        );
  } else if (action === "revoke" && positionals.length === 1) {
    const count = await revokeAgentApiKey(positionals[0], db);
    if (!count) throw new Error("AGENT_KEY_NOT_FOUND");
    stdout.write("AGENT_KEY_REVOKED\n");
  } else throw new Error("AGENT_KEY_COMMAND_INVALID");
}

try {
  await main();
} catch (error) {
  const known = ["AGENT_KEY_UNKNOWN_BUSINESS", "AGENT_KEY_NOT_FOUND", "AGENT_KEY_COMMAND_INVALID"];
  console.error(
    error instanceof ZodError
      ? "AGENT_KEY_INPUT_INVALID"
      : error instanceof Error && known.includes(error.message)
        ? error.message
        : error instanceof TypeError
          ? "AGENT_KEY_COMMAND_INVALID"
          : "AGENT_KEY_COMMAND_FAILED",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect().catch(() => undefined);
}
