// A database double for unit tests of code that runs its store statements in a
// row-level security scope (src/concept/store/tenant-scope.ts): a transaction
// runs on the double itself, and the scope's set_config statement is answered
// here, so the test's own `$queryRaw` sees only the statements it scripts.

type Raw = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

const isScope = (strings: TemplateStringsArray) => strings.join("").includes("set_config('cresavo.");

export function withStoreScopes<T extends { $queryRaw: Raw }>(db: T) {
  const tx = { ...db, $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => (isScope(strings) ? Promise.resolve([]) : db.$queryRaw(strings, ...values)) };
  return { ...tx, $transaction: (work: (client: typeof tx) => unknown) => work(tx) };
}
