import type { PortName } from "../core";
import type { WebhookRequest } from "../ports/webhook";
import { PROVIDERS } from "../providers";
import { createRegistry } from "./registry";

// Verifies an incoming provider webhook. Only a live, selected adapter can
// verify; everything else (the public demo, simulated or unknown providers)
// answers 404 so the endpoint reveals nothing. Verified events are not acted
// on yet: the answer is 501 so the provider keeps retrying instead of the
// event being dropped. Wire the handling before registering webhooks.

const MAX_BODY = 256 * 1024;
const WEBHOOK_PORTS: PortName[] = ["sms", "email", "payments"];

/** The URL the provider signed. Behind a proxy, set CONCEPT_CONNECTIONS_PUBLIC_ORIGIN (e.g. https://book.example.com). */
function publicUrl(request: Request, env: Record<string, string | undefined>): string {
  const url = new URL(request.url);
  const origin = env.CONCEPT_CONNECTIONS_PUBLIC_ORIGIN?.trim();
  if (!origin) return url.toString();
  try {
    const base = new URL(origin);
    return base.protocol === "https:" ? `${base.origin}${url.pathname}${url.search}` : url.toString();
  } catch {
    return url.toString();
  }
}

export async function handleWebhook(request: Request, provider: string, business: string, registry = createRegistry(), env: Record<string, string | undefined> = process.env): Promise<Response> {
  const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
  const definition = PROVIDERS.find((d) => d.info.provider === provider && WEBHOOK_PORTS.includes(d.info.port));
  if (!definition) return notFound();
  const resolution = await registry.resolve(definition.info.port, business);
  const adapter = resolution.adapter as { info: { provider: string }; verifyWebhook?: (webhook: WebhookRequest) => Promise<{ ok: boolean }> };
  if (!resolution.live || adapter.info.provider !== provider || !adapter.verifyWebhook) return notFound();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const verified = await adapter.verifyWebhook({ url: publicUrl(request, env), method: request.method, headers, rawBody });
  if (!verified.ok) return Response.json({ error: "Invalid signature" }, { status: 400 });
  return Response.json({ verified: true, handled: false }, { status: 501 });
}
