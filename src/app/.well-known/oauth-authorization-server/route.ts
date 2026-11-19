import { metadata } from "@/lib/agent-api/oauth/server";
import { pairingOrigin } from "@/concept/pairing/policy";
import { authorizationServer } from "@/concept/pairing/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request?: Request) {
  const origin = request && pairingOrigin(request.headers);
  return request && origin ? authorizationServer(request, origin) : metadata("server");
}
