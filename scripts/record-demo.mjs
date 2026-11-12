import { createDatabaseClient } from "./database.mjs";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { demoRevision } from "./demo-revision.mjs";
import { assertTestDatabase } from "./test-db-guard.mjs";
let step = "DEMO_CONFIG_INVALID";

// No existing data is deleted to prepare a recording. Use a dedicated database.
async function main() {
  assertTestDatabase();
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_demo$/.test(url.pathname)
  )
    throw new Error(
      "Demon kräver en lokal databas vars namn slutar med _demo.",
    );
  step = "DEMO_DATABASE_UNAVAILABLE";
  const db = createDatabaseClient();
  try {
    const [
      bookings,
      campaigns,
      services,
      staff,
      admins,
      sessions,
      events,
      requests,
    ] = await Promise.all([
      db.booking.count(),
      db.campaign.count(),
      db.service.findMany({ orderBy: { id: "asc" } }),
      db.staff.findMany({ orderBy: { id: "asc" } }),
      db.adminUser.count(),
      db.adminSession.count(),
      db.bookingEvent.count(),
      db.workspaceRequest.count(),
    ]);
    const expected = [
      {
        id: "fotvard",
        businessId: "demo",
        name: "Fotvård",
        duration: 60,
        priceOre: 65000,
        active: true,
        buffer: 0,
        version: 1,
      },
      {
        id: "massage",
        businessId: "demo",
        name: "Massage",
        duration: 30,
        priceOre: 45000,
        active: true,
        buffer: 0,
        version: 1,
      },
    ];
    const expectedStaff = [
      { id: "staff-demo", name: "Anna", start: "09:00", end: "17:00" },
      { id: "staff-erik", name: "Erik", start: "10:00", end: "16:00" },
    ].map(({ id, name, start, end }) => ({
      id,
      name,
      businessId: "demo",
      active: true,
      version: 1,
      serviceIds: ["fotvard", "massage"],
      exceptions: [],
      weekly: [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        periods: [{ start, end }],
        breaks: [],
      })),
    }));
    step = "DEMO_DATABASE_NOT_EMPTY_OR_SYNTHETIC";
    if (
      bookings ||
      campaigns ||
      admins ||
      sessions ||
      events ||
      requests ||
      staff.length !== 2 ||
      staff.some((person, i) =>
        Object.entries(expectedStaff[i]).some(
          ([key, value]) => !isDeepStrictEqual(person[key], value),
        ),
      ) ||
      services.length !== 2 ||
      services.some((s, i) =>
        Object.entries(expected[i]).some(([k, v]) => s[k] !== v),
      )
    )
      throw new Error("Demon kräver en tom, nyseedad demodatabas.");
  } finally {
    await db.$disconnect();
  }

  const { revision, dirty } = demoRevision();
  step = "DEMO_BUILD_FAILED";
  const build = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "build"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        CHECKPOINT_DISABLE: "1",
      },
    },
  );
  if (build.status !== 0) throw new Error();
  step = "DEMO_OUTPUT_FAILED";
  const startedAt = new Date().toISOString();
  const output = path.resolve(
    "demo-artifacts",
    startedAt.replace(/[:.]/g, "-"),
  );
  await mkdir(output, { recursive: true });
  step = "DEMO_RECORDING_FAILED";
  const run = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.demo.config.ts",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        BOOKING_DEMO: "1",
        BOOKING_DEMO_OUTPUT: output,
        NEXT_TELEMETRY_DISABLED: "1",
        CHECKPOINT_DISABLE: "1",
      },
    },
  );
  if (run.status !== 0) console.error("DEMO_RECORDING_FAILED");
  step = "DEMO_OUTPUT_FAILED";
  const files = (await readdir(output, { recursive: true }))
    .filter((f) => /\.(png|webm)$/.test(f))
    .sort();
  const status = run.status === 0 ? "PASS" : "FAIL";
  await writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(
      {
        revision,
        dirty,
        startedAt,
        status,
        command: "npm run demo:record",
        build: "production",
        files,
      },
      null,
      2,
    ),
  );
  const escape = (value) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const labels = {
    "01-bokningssida.png": "Kundens bokningssida",
    "02-vald-tid.png": "Behandling och vald tid",
    "03-bekraftelse.png": "Bokningsbekräftelse",
    "04-admin-och-utkast.png": "Kampanjutkast i administrationen",
    "05-publicerad-i-admin.png": "Publicerad kampanj",
    "06-publikt-erbjudande.png": "Erbjudandet på bokningssidan",
    "07-agentbokning-i-admin.png": "Lokal agentbokning i kalendern",
    "epic05-calendar.png": "Kalender med kundbokning",
    "09-bokningsdetalj.png": "Bokningsdetaljer och lagrat pris",
    "10-tjanst-andrad.png": "Ändrad behandling, tid och pris",
    "11-veckoschema-med-paus.png": "Veckoschema med paus",
    "12-ledigt-datum.png": "Ledighet på ett datum",
    "13-flyttad-bokning.png": "Flyttad bokning",
    "epic05-cancelled-booking.png": "Avbokning och bevarad historik",
  };
  const gallery = files
    .map((file) => {
      const href = file.split(path.sep).map(encodeURIComponent).join("/");
      const device = file.includes("mobile") ? "Mobil" : "Dator";
      const video = file.includes("workspace")
        ? "Video: bokningsarbetsytan"
        : file.includes("lokal-MCP")
          ? "Video: lokal agentbokning"
          : "Video: kundbokning och kampanj";
      const label = `${device} · ${labels[path.basename(file)] ?? video}`;
      return `<section><h2>${escape(label)}</h2>${file.endsWith(".png") ? `<a href="${href}"><img src="${href}" alt="${escape(label)}" loading="lazy"></a>` : `<video controls src="${href}"></video>`}</section>`;
    })
    .join("\n");
  await writeFile(
    path.join(output, "index.html"),
    `<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking Lab SE – lokal demo</title><style>body{font:18px system-ui;max-width:1100px;margin:32px auto;padding:16px;background:#faf8f4;color:#222}img,video{max-width:100%;max-height:850px}section{margin:40px 0}h2{font-size:18px;overflow-wrap:anywhere}</style><h1>Booking Lab SE – syntetisk POC-demo</h1><p>${status} · ${startedAt} · revision ${revision} · arbetsändringar: ${dirty}</p><p>Automatiskt verifierade flöden, inga riktiga kunduppgifter och inte produktionsklart. Kundbokning, kalender, behandlingar, schema, flytt, avbokning och kampanj visas på dator och emulerad mobil. Video saknar ljud. Lokala MCP-anrop syns genom bokningen och kampanjutkastet i admin; ingen extern modellchatt spelas in. Detta lokala galleri är ingen mobilåtkomlig testsite.</p>${gallery}</html>`,
  );
  console.log(`Demo ${status}: ${path.join(output, "index.html")}`);
  process.exitCode = run.status === 0 ? 0 : 1;
}

main().catch(() => {
  // Do not print connection errors, URLs or database contents.
  console.error(step);
  process.exitCode = 1;
});
