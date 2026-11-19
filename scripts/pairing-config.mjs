export function pairingDatabaseUrl(env) {
  if (env.NODE_ENV === "production" || env.VERCEL === "1") return env.PAIRING_DATABASE_URL;
  return env.PAIRING_DATABASE_URL ?? env.DATABASE_URL;
}

export function configuredPairingOrigin(value) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return value === url.origin && (url.protocol === "https:" || local) ? url.origin : null;
}
