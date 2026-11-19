import { timingSafeEqual, createHash } from "node:crypto";
import { pairingDb, sweep } from "@/concept/pairing/db";
import { logFailure } from "@/concept/pairing/http";

const hash = (s: string) => createHash("sha256").update(s).digest();
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.ASSISTANT_PAIRING !== "1") return new Response(null, { status: 404, headers });
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(hash(request.headers.get("authorization") ?? ""), hash("Bearer " + secret)))
    return new Response(null, { status: 401, headers });
  try {
    await pairingDb().$transaction(tx => sweep(tx));
    return new Response(null, { status: 204, headers });
  } catch (err) {
    logFailure(err);
    return new Response(null, { status: 503, headers });
  }
}
