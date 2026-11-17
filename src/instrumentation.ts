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
