import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // A public concept-demo deployment (flag inlined at build, see vercel.json)
    // has no database: run the booking engine read-only on Vercel. Explicit
    // runtime settings on the project still win.
    if (process.env.NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO === "1") {
      process.env.PUBLIC_READONLY ??= "1";
      process.env.BOOKING_RUNTIME ??= process.env.VERCEL === "1" ? "vercel" : "local";
    }
    const { runtimePolicy } = await import("../scripts/client-address.mjs");
    runtimePolicy(process.env);
  }
}

// Errors Next.js catches in rendering, route handlers and actions that no
// wrapper handled. Inert without ERROR_REPORT_DSN. The request (path, headers)
// is never read: only the route pattern and the error's class and stack go on.
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/error-report");
  const { log } = await import("./lib/log");
  log.error("REQUEST_ERROR", { route: context.routePath, errorName: error instanceof Error ? error.constructor.name : undefined });
  reportError(error, { code: "REQUEST_ERROR", route: context.routePath });
};
