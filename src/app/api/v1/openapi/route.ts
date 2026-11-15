import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
export async function GET() {
  const yaml = await readFile(join(process.cwd(), "docs/agent-api-v1.openapi.yaml"), "utf8");
  return new Response(yaml, { headers: { "Content-Type": "application/yaml; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
