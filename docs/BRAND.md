# Brand and naming

Decided by Niclas 2026-11-17. **Update (goal 18): the product is now called
Libovo** (brand kit v0.9 in `design/brand/libovo-v0.9/`, provisional and not
trademark-cleared); the assistant keeps "Ask Flerdo" until Niclas decides.
Both names live in `src/concept/brand.ts` (`BRAND`, `ASSISTANT`); the design
system is in `docs/design/LIBOVO.md`. The sections below describe the earlier
Flerdo naming and still apply to technical identifiers, which were not renamed.

**Name:** Flerdo. Swedish "fler" (more) + "do". **Tagline:** "Do more, click less."

One brand. No sub-brands towards customers: inside the product, areas use
plain words.

| Level | Name | Example |
|---|---|---|
| Product | **Flerdo** | "Flerdo – do more, click less" |
| Areas in the app | Plain words | Calendar, Customers, Journal, Campaigns, Stock, Finance |
| Industry packs | "Flerdo for …" | Flerdo for salons, Flerdo for clinics, later Flerdo for shops |
| Customer booking page | "Book with Flerdo" | `book.flerdo.com/<business>` or the business's own domain |
| Command box / assistant | **Ask Flerdo** | Placeholder "Ask Flerdo… what would you like to do?" |
| Paid integration service | **Flerdo Connect** | SMS, payments, social publishing, ads (private repo) |
| Code packages | `@flerdo/*` | `@flerdo/gateway`, `@flerdo/ai`, `@flerdo/mcp` |

## On "AI" in the name

No "AI" in the product name: many owners are wary of AI, the product never
requires AI, and "AI" in names dates quickly. AI shows up as "Ask Flerdo" and
as an optional usage line in pricing. flerdo.ai is registered defensively.

## Repositories (target, see goal 13)

- GitHub org `flerdo`, public monorepo `flerdo/flerdo`:
  `apps/web` (studio, customer pages, API), `packages/gateway` (REST, MCP,
  A2A, USP; today's booking-lab-gateway), `packages/ai` (tasks, router, evals),
  `docs/`.
- Private `flerdo/connect` for the paid integration service.
- `booking-lab-se` and `booking-lab-gateway` become private archives.

## Rules for agents

- New user-facing text says "Flerdo", never "Booking Lab".
- The demo business stays "Salong Eko" (a fictional customer of Flerdo).
- The rename of existing code, UI and package names happens in goal 13, in
  one pass, not piecemeal.

## Owner to-dos (only Niclas)

- [ ] Domain: flerdo.com (+ flerdo.app, flerdo.se, flerdo.ai)
- [ ] GitHub org: github.com/flerdo
- [ ] npm scope: @flerdo
- [ ] Trademark search: EUIPO TMview, classes 9 and 42
