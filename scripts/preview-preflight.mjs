// Read-only configuration check. Does not load .env, connect, set secrets or deploy.
import { runtimePolicy } from "./client-address.mjs";

const failures = [];
if (process.env.VERCEL_ENV !== "preview") failures.push("PREVIEW_ENV_REQUIRED");
try { if (runtimePolicy(process.env) !== "vercel") throw new Error(); }
catch { failures.push("PREVIEW_RUNTIME_INVALID"); }
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!url.hostname.endsWith(".neon.tech") || !url.pathname.endsWith("_demo") ||
      !["require", "verify-full"].includes(url.searchParams.get("sslmode")) ||
      [...url.searchParams.keys()].some(k => ["host", "hostaddr"].includes(k.toLowerCase()))) throw new Error();
} catch { failures.push("PREVIEW_DATABASE_INVALID"); }
for (const name of ["BOOKING_CARD_DEMO", "BOOKING_OWNER_CARD_DEMO", "BOOKING_DEMO_ACCESS", "BOOKING_A2A_DEMO"]) {
  if (process.env[name] === "1") failures.push("PREVIEW_LOCAL_DEMO_FLAG_REFUSED");
}
for (const code of [...new Set(failures)]) console.error(code);
if (failures.length) process.exitCode = 1;
else console.log("PREVIEW_CONFIG_SHAPE_OK_PROTECTION_NOT_VERIFIED");
