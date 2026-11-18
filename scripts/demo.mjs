// One command to run the concept demo locally: `npm run demo`.
// Installs dependencies if needed, prepares .env and the Prisma client,
// then starts the dev server and opens the studio in the browser.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const base = `http://localhost:${process.env.PORT ?? 3000}`;
const url = `${base}/studio`;

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Node.js 22 or newer is required (you have ${process.versions.node}). Install it from https://nodejs.org`);
  process.exit(1);
}

// Reinstall when dependencies are missing or older than the lockfile (e.g. after switching branch).
const installed = "node_modules/.package-lock.json";
const stale = !existsSync(installed) || statSync("package-lock.json").mtimeMs > statSync(installed).mtimeMs;
if (stale) {
  console.log("Installing dependencies (first run or after an update)…");
  run(npm, ["ci", "--no-fund", "--no-audit"]);
}
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}
if (stale || !existsSync("node_modules/.prisma/client")) {
  run(npx, ["prisma", "generate"]);
}

console.log(`\nStarting the demo… it opens ${url} when ready. Keep this window open; press Ctrl+C to stop.\n`);
const server = spawn(npm, ["run", "dev"], { stdio: ["inherit", "pipe", "inherit"], shell: process.platform === "win32" });
let opened = false;
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!opened && chunk.toString().includes("BOOKING_SERVER_READY")) {
    opened = true;
    console.log(`\nReady: ${url}  (customer page: ${base}/boka/salong-eko)\n`);
    const open = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(open[0], open[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
});
server.on("exit", (code) => process.exit(code ?? 0));
