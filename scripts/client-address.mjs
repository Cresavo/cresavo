import { BlockList, isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

// Vercel is an explicit ingress trust model, never inferred from request headers.
// Only use it in a Vercel Function protected at project level on every URL.
export function runtimePolicy(env) {
  const runtime = env.BOOKING_RUNTIME ?? "local";
  if (!["local", "vercel"].includes(runtime) ||
      (env.VERCEL === "1" && runtime !== "vercel") ||
      (runtime === "vercel" &&
        (env.VERCEL !== "1" || env.RATE_LIMIT_STORE !== "postgres" ||
         (env.TRUST_PROXY_IP !== undefined && env.TRUST_PROXY_IP !== "0"))))
    throw new Error("BOOKING_RUNTIME_CONFIG_INVALID");
  return runtime;
}

export function vercelClientAddress(headers) {
  // Vercel documents x-real-ip as its overwritten client address. Do not fall
  // back to caller-controlled forwarding chains or internal proof headers.
  return normalizeIp(typeof headers["x-real-ip"] === "string"
    ? headers["x-real-ip"] : undefined);
}

export function normalizeIp(value) {
  if (!value || !isIP(value)) throw new Error("CLIENT_ADDRESS_INVALID");
  if (value.startsWith("::ffff:") && isIP(value.slice(7)) === 4)
    return value.slice(7);
  const normalized =
    isIP(value) === 6
      ? new URL(`http://[${value}]/`).hostname.slice(1, -1)
      : value;
  const mapped = normalized.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
  if (mapped) {
    const high = parseInt(mapped[1], 16),
      low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return normalized;
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
      if (
        Number(prefix) < (family === "ipv4" ? 8 : 32) ||
        Number(prefix) > (family === "ipv4" ? 32 : 128)
      )
        throw new Error("PROXY_CONFIG_INVALID");
      // Node matches IPv4 peers against IPv6 subnets containing mapped IPv4 space.
      // Validate each candidate separately so legitimate IPv4 entries do not interfere.
      if (family === "ipv6") {
        const candidate = new BlockList();
        candidate.addSubnet(ip, Number(prefix), family);
        if (
          candidate.check("0.0.0.0", "ipv4") ||
          candidate.check("255.255.255.255", "ipv4")
        )
          throw new Error("PROXY_CONFIG_INVALID");
      }
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

// One warning per HTTP process, never log addresses or incoming header values.
export function proxyWarning(enabled, trusted, log = console.warn) {
  let warned = false;
  return (remote, headers) => {
    const real = headers["x-real-ip"];
    const forwarding =
      real !== undefined || headers["x-forwarded-for"] !== undefined;
    const missingIdentity =
      trusted(normalizeIp(remote)) && !(typeof real === "string" && isIP(real));
    if (!warned && ((enabled !== "1" && forwarding) || missingIdentity)) {
      warned = true;
      log("PROXY_CLIENT_IDENTITY_COLLAPSED");
    }
  };
}

export function clientLimitKey(value) {
  const ip = normalizeIp(value);
  if (isIP(ip) === 4) return ip;
  const [left, right] = ip.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? start
      : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  return (
    groups
      .slice(0, 4)
      .map((group) => parseInt(group, 16).toString(16))
      .join(":") + "::/64"
  );
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
  return clientLimitKey(ip);
}
