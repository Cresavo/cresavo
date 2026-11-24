import { createHmac } from "node:crypto";
// A loopback request signed the way the supported server wrapper signs a client address.
export const origin = "http://127.0.0.1:3229";
export function labRequest(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-booking-client-ip", "127.0.0.1");
  headers.set("x-booking-client-proof", createHmac("sha256", "synthetic-oauth-socket-proof").update("127.0.0.1").digest("hex"));
  return new Request(input, { ...init, headers });
}
export async function rpcBody(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text.split("\n").filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
    return data.find(message => message.id === 1);
  }
  return JSON.parse(text);
}
