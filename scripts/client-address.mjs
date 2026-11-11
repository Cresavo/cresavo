import { BlockList, isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

export function normalizeIp(value) {
  if (!value || !isIP(value)) throw new Error("CLIENT_ADDRESS_INVALID");
  if (value.startsWith("::ffff:") && isIP(value.slice(7)) === 4)
    return value.slice(7);
  return isIP(value) === 6
    ? new URL(`http://[${value}]/`).hostname.slice(1, -1)
    : value;
}

export function proxyPolicy(enabled, addresses = "") {
  const list = new BlockList();
  if (enabled !== "0" && enabled !== "1" && enabled !== undefined)
    throw new Error("PROXY_CONFIG_INVALID");
  if (enabled !== "1") return () => false;
  if (!addresses.trim()) throw new Error("PROXY_CONFIG_REQUIRED");
  for (const entry of addresses.split(",")) {
    const [raw, prefix, extra] = entry.trim().split("/");
    const ip = normalizeIp(raw);
    const family = isIP(ip) === 4 ? "ipv4" : "ipv6";
    if (extra !== undefined) throw new Error("PROXY_CONFIG_INVALID");
    if (prefix === undefined) list.addAddress(ip, family);
    else {
      if (!/^\d+$/.test(prefix)) throw new Error("PROXY_CONFIG_INVALID");
      list.addSubnet(ip, Number(prefix), family);
    }
  }
  return (ip) =>
    list.check(normalizeIp(ip), isIP(normalizeIp(ip)) === 4 ? "ipv4" : "ipv6");
}

export function resolveClientAddress(remote, forwarded, trusted) {
  const peer = normalizeIp(remote);
  return trusted(peer) && typeof forwarded === "string" && isIP(forwarded)
    ? normalizeIp(forwarded)
    : peer;
}

export function addressProof(ip, secret) {
  if (!secret) throw new Error("SOCKET_SERVER_REQUIRED");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function verifiedClientAddress(headers, secret) {
  const ip = normalizeIp(headers.get("x-booking-client-ip"));
  const proof = headers.get("x-booking-client-proof") ?? "";
  const expected = addressProof(ip, secret);
  if (
    !/^[a-f0-9]{64}$/.test(proof) ||
    !timingSafeEqual(Buffer.from(proof), Buffer.from(expected))
  )
    throw new Error("CLIENT_ADDRESS_UNVERIFIED");
  return ip;
}
