// Server-side secret access for connections. Keys come only from server
// configuration; nothing here is ever imported by browser code, and no
// NEXT_PUBLIC_ variable can be read as a secret.
//
// TODO(goal 11): once a real database exists, add an encrypted per-business
// store (AES-256-GCM like src/concept/ai/business-settings.ts, ciphertext bound
// to business + secret name, key from a KMS or CONCEPT_KEY_SECRET) and pick it
// in `secretStoreFor`. The env store stays for self-hosters with one business.

export interface SecretStore {
  /** The secret for this business, or undefined. Never throws with the value in the message. */
  get(business: string, name: string): Promise<string | undefined>;
  /** Whether a value exists, without reading it into the caller. */
  has(business: string, name: string): Promise<boolean>;
}

const NAME = /^[A-Z][A-Z0-9_]{2,63}$/;

export function isSecretName(name: string): boolean {
  return NAME.test(name) && !name.startsWith("NEXT_PUBLIC_");
}

/** Reads `name` from the process environment. One platform-wide value; the business id is ignored. */
export function envSecretStore(env: Record<string, string | undefined> = process.env): SecretStore {
  const read = (name: string) => {
    if (!isSecretName(name)) return undefined;
    const value = env[name]?.trim();
    return value ? value : undefined;
  };
  return {
    get: async (_business, name) => read(name),
    has: async (_business, name) => read(name) !== undefined,
  };
}

/** Test and preview helper with fixed values. */
export function memorySecretStore(values: Record<string, string>): SecretStore {
  return envSecretStore(values);
}
