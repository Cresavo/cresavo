// Kept apart from the database-backed route helpers, so a route that must answer 403 or 404 before touching the database can read a body with it.

/** The request's JSON, read with a byte cap while it streams: "too_large" past `maxBytes`, null when it is not JSON. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown | "too_large"> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return "too_large";
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}
