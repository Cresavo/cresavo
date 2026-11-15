export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runtimePolicy } = await import("../scripts/client-address.mjs");
    runtimePolicy(process.env);
  }
}
