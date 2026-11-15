// Trusted operator binding, never accepted from registration JSON or token input.
const bindings = new Map<string, "lab-partner">();
export function registerLabOAuthBusiness(clientId: string, businessId: "lab-partner") {
  if (businessId !== "lab-partner" || process.env.BOOKING_RUNTIME === "vercel") throw new Error("LAB_BINDING_REFUSED");
  bindings.set(clientId, businessId);
}
export function clearLabOAuthBusinesses() { bindings.clear(); }
export function labOAuthBusiness(clientId: string) { return bindings.get(clientId) ?? "demo"; }
