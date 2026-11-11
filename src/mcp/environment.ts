export function mcpEnvironment(
  options: { booking?: boolean } = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of [
    "DATABASE_URL",
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "NODE_EXTRA_CA_CERTS",
    "CHECKPOINT_DISABLE",
    "NEXT_TELEMETRY_DISABLED",
  ])
    if (process.env[name] !== undefined) result[name] = process.env[name]!;
  if (options.booking && process.env.SESSION_SECRET !== undefined)
    result.SESSION_SECRET = process.env.SESSION_SECRET;
  return result;
}
