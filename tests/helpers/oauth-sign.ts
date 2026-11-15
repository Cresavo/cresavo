import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
export function resign(token: string, claims: Record<string, unknown>, head: Record<string,unknown> = {}, foreign = false) {
  const [h,p] = token.split(".");
  const header = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(h,"base64url").toString()),...head})).toString("base64url");
  const payload = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(p,"base64url").toString()),...claims})).toString("base64url");
  const state = (globalThis as typeof globalThis & { bookingOAuthLab: { key: { privateKey: KeyObject } } }).bookingOAuthLab;
  const input = `${header}.${payload}`;
  return `${input}.${sign(null,Buffer.from(input),foreign ? generateKeyPairSync("ed25519").privateKey : state.key.privateKey).toString("base64url")}`;
}
