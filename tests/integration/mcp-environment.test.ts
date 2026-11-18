import { it, expect } from "vitest";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";

it("MCP uses the exported DATABASE_URL even when the env file points to another database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "booking-mcp-env-"));
  const file = join(directory, ".env");
  const title = `mcp-env-${randomUUID()}`;
  const client = new Client({ name: "env-regression", version: "1" });
  try {
    await writeFile(
      file,
      'DATABASE_URL="postgresql://synthetic:synthetic@127.0.0.1:1/unreachable_test"',
    );
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--env-file",
          file,
          "--import",
          "tsx",
          "src/mcp/server.ts",
          "--admin",
        ],
        env: mcpEnvironment(),
      }),
    );
    const result = await client.callTool({
      name: "create_campaign_draft",
      arguments: {
        serviceId: "fotvard",
        title,
        discountPercent: 20,
        validFrom: "2030-01-01",
        validUntil: "2030-01-02",
      },
    });
    expect(result.isError).not.toBeTruthy();
    expect(await db.campaign.count({ where: { title } })).toBe(1);
  } finally {
    await client.close();
    await db.campaign.deleteMany({ where: { title } });
    await db.$disconnect();
    await unlink(file);
    await rmdir(directory);
  }
}, 30000);
