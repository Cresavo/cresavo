// Test-only resolver preload for the staging runner's child processes. It maps exactly
// the host names in STAGING_LOOPBACK_HOSTS to 127.0.0.1 and leaves every other lookup alone.
import dns from "node:dns";

const hosts = new Set((process.env.STAGING_LOOPBACK_HOSTS ?? "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean));
const original = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  if (typeof options === "function") { callback = options; options = {}; }
  if (!hosts.has(String(hostname).toLowerCase())) return original.call(dns, hostname, options, callback);
  const all = typeof options === "object" && options !== null && options.all;
  process.nextTick(() => all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4));
};
