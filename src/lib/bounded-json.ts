// Kept apart from the database-backed route helpers, so a route that must answer 403 or 404 before touching the database can read a body with it.

/** The request's body, read with a byte cap while it streams: "too_large" as soon as it passes `maxBytes` (declared or read). */
export async function readBoundedBytes(request: Request, maxBytes: number): Promise<Buffer | "too_large"> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return "too_large";
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
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
  return Buffer.concat(chunks);
}

/** The request's JSON, read with a byte cap while it streams: "too_large" past `maxBytes`, null when it is not JSON. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown | "too_large"> {
  if (!request.body) return null;
  const body = await readBoundedBytes(request, maxBytes);
  if (body === "too_large") return body;
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
}
