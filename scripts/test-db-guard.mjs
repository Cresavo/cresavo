export function assertTestDatabase(value = process.env.DATABASE_URL) {
  try {
    const url = new URL(value ?? "");
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/[a-zA-Z0-9_]+_(test|demo)$/.test(url.pathname)
    )
      throw new Error();
  } catch {
    throw new Error("TEST_DATABASE_REFUSED: lokal *_test eller *_demo krävs");
  }
}
