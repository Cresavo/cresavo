import { PrismaClient } from "@prisma/client";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// No existing data is deleted to prepare a recording. Use a dedicated database.
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/^\/[a-z0-9_]+_demo$/.test(url.pathname))
    throw new Error("Demon kräver en lokal databas vars namn slutar med _demo.");
  const db = new PrismaClient();
  try {
    const [bookings, campaigns, services] = await Promise.all([
      db.booking.count(), db.campaign.count(), db.service.findMany({ orderBy: { id: "asc" } })
    ]);
    const expected = [
      { id: "fotvard", businessId: "demo", name: "Fotvård", duration: 60, priceOre: 65000 },
      { id: "massage", businessId: "demo", name: "Massage", duration: 30, priceOre: 45000 }
    ];
    if (bookings || campaigns || services.length !== 2 || services.some((s, i) => Object.entries(expected[i]).some(([k, v]) => s[k] !== v)))
      throw new Error("Demon kräver bara de två seedade tjänsterna och inga bokningar/kampanjer. Använd en ny demodatabas.");
  } finally { await db.$disconnect(); }

  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim());
  const startedAt = new Date().toISOString();
  const output = path.resolve("demo-artifacts", startedAt.replace(/[:.]/g, "-"));
  await mkdir(output, { recursive: true });
  const run = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.demo.config.ts"], {
    stdio: "inherit",
    env: { ...process.env, BOOKING_DEMO: "1", BOOKING_DEMO_OUTPUT: output, NEXT_TELEMETRY_DISABLED: "1", CHECKPOINT_DISABLE: "1" }
  });
  const files = (await readdir(output, { recursive: true })).filter(f => /\.(png|webm)$/.test(f)).sort();
  const status = run.status === 0 ? "PASS" : "FAIL";
  await writeFile(path.join(output, "manifest.json"), JSON.stringify({ revision, dirty, startedAt, status, command: "npm run demo:record", files }, null, 2));
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const gallery = files.map(file => {
    const href = file.split(path.sep).map(encodeURIComponent).join("/");
    return `<section><h2>${escape(file)}</h2>${file.endsWith(".png") ? `<a href="${href}"><img src="${href}" alt="${escape(file)}" loading="lazy"></a>` : `<video controls src="${href}"></video>`}</section>`;
  }).join("\n");
  await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="sv"><meta charset="utf-8"><title>Booking Lab SE – lokal demo</title><style>body{font:18px system-ui;max-width:1100px;margin:32px auto;padding:16px;background:#faf8f4;color:#222}img,video{max-width:100%;max-height:850px}section{margin:40px 0}h2{font-size:18px;overflow-wrap:anywhere}</style><h1>Booking Lab SE – syntetisk POC-demo</h1><p>${status} · ${startedAt} · revision ${revision} · arbetsändringar: ${dirty}</p><p>Ingen riktig kunddata. Inte produktionsklar. Bilderna följer bokning, bekräftelse, admin, kampanjutkast och publicering. Video saknar ljud. MCP-anropet sker via lokal testklient och syns genom utkastet i adminvyn.</p>${gallery}</html>`);
  console.log(`Demo ${status}: ${path.join(output, "index.html")}`);
  process.exitCode = run.status === 0 ? 0 : 1;
}

main().catch(() => {
  // Do not print connection errors, URLs or database contents.
  console.error("Demo kunde inte köras. Kontrollera lokal *_demo-databas, migration, endast seeddata, ledig port 3000 och docs/DEMO.md.");
  process.exitCode = 1;
});
