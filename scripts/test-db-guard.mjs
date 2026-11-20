export function assertTestDatabase(value = process.env.DATABASE_URL) {
  try {
    const url = new URL(value ?? "");
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/[a-zA-Z0-9_]+_(test|demo)$/.test(url.pathname) ||
      [...url.searchParams.keys()].some((key) =>
        ["host", "hostaddr"].includes(key.toLowerCase()),
      )
    )
      throw new Error();
  } catch {
    throw new Error("TEST_DATABASE_REFUSED: lokal *_test eller *_demo krävs");
  }
}

/**
 * Database tests write real approval links and other bearer material. Prisma reads `DEBUG` once,
 * when it is first loaded, and then prints every query with its arguments: refused before any test
 * file (and so any Prisma client) is loaded, since clearing it later in a test is too late.
 * @param {Record<string, string | undefined>} [env]
 */
export function assertNoQueryLogging(env = process.env) {
  if (env.DEBUG) throw new Error("TEST_DEBUG_REFUSED: unset DEBUG; Prisma would log query arguments");
}
