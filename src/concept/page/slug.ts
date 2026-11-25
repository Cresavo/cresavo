// The part of the booking address the business picks: `<slug>.<product domain>`
// and `/boka/<slug>`. One checker is used by Settings, the reducer and the
// host resolver, so a name that is refused in one place is refused everywhere.

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/** Names that belong to the product itself or are commonly used for infrastructure. */
export const RESERVED_SLUGS: readonly string[] = [
  "www", "app", "api", "admin", "studio", "boka", "book", "booking", "bookings", "mail", "smtp", "imap", "pop", "ftp",
  "ns", "ns1", "ns2", "dns", "cname", "mx", "status", "support", "help", "docs", "blog", "news", "login", "logout",
  "signin", "signup", "register", "account", "accounts", "billing", "pay", "payments", "static", "assets", "cdn",
  "demo", "test", "staging", "dev", "preview", "localhost", "root", "system", "security", "abuse", "postmaster",
  "webmaster", "hostmaster", "noreply", "info", "welcome", "landing", "widget", "me", "gift", "unknown-address",
  "inbox", "email", "web", "site", "home", "about", "legal", "privacy", "terms", "pricing", "press", "jobs", "careers",
  "partners", "developers", "auth", "sso", "get", "try", "beta", "sandbox", "coming-soon",
  "own-domain", "showcase",
];

export type SlugProblem = "empty" | "short" | "long" | "characters" | "edges" | "reserved" | "taken";

export type SlugCheck = { ok: true; slug: string } | { ok: false; problem: SlugProblem };

/** "Salong Eko!" becomes "salong-eko": what the owner probably meant while typing. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

/** `taken` lists slugs of other businesses; the caller leaves out the business's own. */
export function checkSlug(input: string, taken: readonly string[] = []): SlugCheck {
  const slug = input.trim().toLowerCase();
  if (!slug) return { ok: false, problem: "empty" };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, problem: "characters" };
  if (slug.startsWith("xn--")) return { ok: false, problem: "reserved" };
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) return { ok: false, problem: "edges" };
  if (slug.length < SLUG_MIN) return { ok: false, problem: "short" };
  if (slug.length > SLUG_MAX) return { ok: false, problem: "long" };
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, problem: "reserved" };
  if (taken.includes(slug)) return { ok: false, problem: "taken" };
  return { ok: true, slug };
}
