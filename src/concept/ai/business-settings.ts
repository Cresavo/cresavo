import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { DEMO_BUSINESS, readBusinessAi, updateBusinessAi } from "./demo-store";
import { isTaskName } from "./registry";
import type { AiEnvironment, Provider } from "./router";

export const settingsInput = z.union([
  z.object({ provider: z.enum(["openrouter", "openai", "anthropic"]), key: z.string().trim().min(8).max(4096).regex(/^\S+$/) }).strict(),
  z.object({ task: z.string().refine(isTaskName), tier: z.enum(["fast", "smart"]) }).strict(),
]);
function encryptionKey(env: AiEnvironment) {
  const secret = env.CONCEPT_KEY_SECRET;
  if (!secret || secret.length < 32) throw new Error("Encryption secret unavailable");
  return createHash("sha256").update(secret).digest();
}
export function canStoreKey(env: AiEnvironment = process.env) { return !!env.CONCEPT_KEY_SECRET && env.CONCEPT_KEY_SECRET.length >= 32; }
export function saveBusinessKey(business: string, provider: Provider, key: string, env: AiEnvironment = process.env) {
  const parsed = settingsInput.parse({ provider, key });
  if (!("key" in parsed)) throw new Error("Invalid key input");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(`${business}:${provider}`));
  const ciphertext = Buffer.concat([cipher.update(parsed.key, "utf8"), cipher.final()]);
  updateBusinessAi(business, data => { data.key = { provider, last4: parsed.key.slice(-4), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }; });
}
export function businessKey(business: string, env: AiEnvironment = process.env): { provider: Provider; apiKey: string } | null {
  const saved = readBusinessAi(business).key;
  if (!saved) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), Buffer.from(saved.iv, "base64"));
    decipher.setAAD(Buffer.from(`${business}:${saved.provider}`));
    decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
    const apiKey = Buffer.concat([decipher.update(Buffer.from(saved.ciphertext, "base64")), decipher.final()]).toString("utf8");
    return { provider: saved.provider, apiKey };
  } catch { return null; } // Changed/missing secrets never expose ciphertext or errors.
}
export function removeBusinessKey(business = DEMO_BUSINESS) { updateBusinessAi(business, data => { delete data.key; }); }
