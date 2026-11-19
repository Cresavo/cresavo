import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pairingDb } from "./db";
import { body, budget, hour, ipKey, PairError, requirePair } from "./http";

export function secureUrl(raw: string, callback = false) {
  requirePair(raw.length <= 2048 && !/[\s\\#]/.test(raw));
  const url = URL.canParse(raw) ? new URL(raw) : null;
  const local = callback &&
    url?.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname) && loopbackParts(raw) !== null;
  requirePair(url && (url.protocol === "https:" || local) && !url.username && !url.password);
  requirePair(local || url.hostname.length <= 253 && url.hostname.split(".").every(
    label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
  ));
  return url;
}

// Use IPv4 transport only. Fail closed for special-use, shared and reserved ranges.
export function publicAddress(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return a > 0 && a < 224 && ![10, 127].includes(a)
    && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    && !(a === 203 && b === 0 && c === 113);
}

export async function fetchDocument(id: string) {
  const url = secureUrl(id);
  requirePair(!url.port && !url.search && url.pathname !== "/" && !isIP(url.hostname) && !url.hostname.includes(":"));
  const signal = AbortSignal.timeout(3500);
  // DNS and TLS share the same absolute deadline. Connect to the checked
  // address itself, with the original TLS servername and HTTP Host.
  try {
    const answers = await Promise.race([
      lookup(url.hostname, { family: 4, all: true }),
      new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
    ]);
    requirePair(answers.length && answers.every(a => publicAddress(a.address)));
    return await new Promise<unknown>((resolve, reject) => {
      const req = get({
        hostname: answers[0].address, servername: url.hostname, path: url.pathname, port: 443,
        agent: false, signal, headers: { Host: url.host, Accept: "application/json" },
      }, res => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("error", reject);
        if (res.statusCode !== 200 || !/^application\/json(?:;|$)/i.test(res.headers["content-type"] ?? "")) {
          req.destroy(new Error("invalid_metadata_response"));
          return;
        }
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 16_384) req.destroy(new Error("metadata_too_large"));
          else chunks.push(chunk);
        });
        res.on("end", () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (err) { reject(err); }
        });
      });
      req.on("error", reject);
    });
  } catch {
    throw new PairError(400, "invalid_client_metadata");
  }
}

// Preserve the exact registered spelling of every component except the ephemeral port.
function loopbackParts(uri: string) {
  return /^http:\/\/(127\.0\.0\.1|\[::1\])(?::[0-9]+)?([/?][^#]*)?$/.exec(uri);
}

export function exactRedirect(registered: string[], requested: string) {
  const loop = loopbackParts(requested);
  return registered.some(uri => {
    if (uri === requested) return true;
    const other = loopbackParts(uri);
    return !!loop && !!other && loop[1] === other[1] && loop[2] === other[2];
  });
}

export const cleanClientName = (name: string) => name.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();

const metadata = z.object({
  client_id: z.string().optional(),
  client_name: z.string().max(100).transform(cleanClientName).pipe(z.string().min(1)),
  redirect_uris: z.array(z.string().max(2048)).min(1).max(16),
  token_endpoint_auth_method: z.literal("none").optional(),
});

export async function resolveClient(id: string) {
  if (id.startsWith("https://")) {
    const doc = metadata.parse(await fetchDocument(id));
    requirePair(doc.client_id === id, "invalid_client_metadata");
    return { id, name: doc.client_name, redirects: doc.redirect_uris };
  }
  const client = await pairingDb().pairClient.findUnique({ where: { id } });
  requirePair(client && client.expiresAt > new Date(), "invalid_client");
  return { ...client, name: cleanClientName(client.name) };
}

export async function register(request: Request) {
  const doc = metadata.parse(JSON.parse(await body(request, "application/json")));
  doc.redirect_uris.forEach(uri => secureUrl(uri, true));
  const redirects = [...new Set(doc.redirect_uris)].sort();
  const id = await pairingDb().$transaction(async tx => {
    const identity = JSON.stringify([doc.client_name, redirects]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 7923))`;
    const existing = await tx.pairClient.findFirst({ where: {
      name: doc.client_name, redirects: { equals: redirects }, expiresAt: { gt: new Date() },
    }, select: { id: true } });
    if (existing) return existing.id;
    const id = randomUUID();
    await budget(tx, "dcr:" + ipKey(request), 600, hour);
    await budget(tx, "registrations", 20000, 24 * hour);
    await tx.pairClient.create({ data: { id, name: doc.client_name, redirects, expiresAt: new Date(Date.now() + 24 * hour) } });
    return id;
  });
  return Response.json({ client_id: id, client_name: doc.client_name, redirect_uris: doc.redirect_uris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, { status: 201 });
}
