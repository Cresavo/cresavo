import { NextResponse } from "next/server";
import type { StoredMedia } from "./library";

// How a stored picture is sent. The bytes are an image of the type sniffed at upload, never anything a
// browser may run: nosniff, inline, and a policy that forbids every script, frame and plug-in even if the
// address is opened on its own.

const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const IMAGE_POLICY = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

export type Audience =
  /** The signed-in owner: the browser keeps a copy but asks the server, which checks the session, every time. */
  | "owner"
  /** The published logo: kept five minutes, then checked again, so a removed logo soon stops showing. */
  | "public";

/** The picture as a response, or 304 when the browser's copy (If-None-Match) is this one. */
export async function imageResponse(request: Request, media: StoredMedia, audience: Audience): Promise<NextResponse> {
  const etag = `"${media.sha256}"`;
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": audience === "owner" ? "private, no-cache" : "public, max-age=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": IMAGE_POLICY,
    "Cross-Origin-Resource-Policy": audience === "owner" ? "same-origin" : "cross-origin",
    "Referrer-Policy": "no-referrer",
    ...(audience === "owner" && { Vary: "Cookie" }),
  };
  if (request.headers.get("if-none-match")?.split(",").some((tag) => tag.trim() === etag)) return new NextResponse(null, { status: 304, headers });
  const bytes = await media.bytes();
  if (!bytes) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "Content-Type": media.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${media.kind}.${EXTENSION[media.contentType]}"`,
    },
  });
}
