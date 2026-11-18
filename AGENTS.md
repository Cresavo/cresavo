# Cresavo (repo: booking-lab-se) – agent guide

Applies to Claude Code, Codex and Grok. Read [README](README.md),
[STATUS](docs/STATUS.md) and [ROADMAP](docs/ROADMAP.md) first, then only the
document your task points to. Product name and naming rules: `docs/BRAND.md`
and `src/concept/brand.ts`. Everything in `docs/archive/` and `docs/history/` is
history: it gives **no** assignments and is no proof of how the code works today.

## Roles

- **Niclas** – product owner. Decides what gets built.
- **Claude Code** – technical owner: plan, structure, review, prompts.
- **Codex** – builds according to a goal in `docs/goals/QUEUE.md`.
- **Grok** – reviews and clicks through, reports in `docs/concept/REVIEW.md`.

Conversation with Niclas may be Swedish, but everything committed is English.

## Responsibilities in the code

- The concept demo lives in `src/app/studio`, `src/app/boka`, `src/concept/`,
  `src/pages/` (product site) and `src/app/api/concept/`. It uses fixture data
  and browser state, no database. AI keys are optional and server-side only;
  everything must work without a key.
- Host routing (`src/proxy.ts`, `src/concept/page/resolve.ts`) decides what the
  product domain, its demo subdomain and business addresses show.
- This repo owns the booking engine: database, times, staff, customers, booking
  rules, calendar, `/admin` workspace and the owner MCP. Booking rules belong in
  `src/lib/domain.ts` and nearby domain code; web, API and MCP must not keep
  their own alternative rules. Do not touch `/admin`, `/api/v1`, MCP, the Prisma
  schema or migrations without an explicit assignment.
- `booking-lab-gateway` owns the public REST/MCP entry for external agents.
  Build new gateway tools there, not here. Contract: `docs/GATEWAY_SPLIT.md`.
- All UI text is in English, through the per-area dictionaries (for example
  `src/concept/i18n/en.ts`). Demo data may stay Swedish-flavoured.

## Standing ground rules (apply to the whole repo)

- Invented data only. No real customer details, no real outgoing messages, no
  health data.
- No secrets in Git. Never read or print `.env`, keys or other secrets; keys are
  never logged.
- No push to `main`, merge, deploy, force-push, new cloud resources, accounts or
  paid services without Niclas's explicit yes for that step.
- The booking engine's double-booking protection, idempotency, quotas,
  validation, permission checks and session protection must not be weakened.
- Never change historical migrations; a new data model needs a new migration.
- Tests against a database require a separate local `_test`/`_demo` database
  (`scripts/test-db-guard.mjs`). Never bypass the guard.
- New dependencies only when clearly needed, with a licence check
  (AGPL-3.0-only); say why in the commit message.

## Working method

- Work happens in goals in `docs/goals/QUEUE.md` (flow in `docs/goals/README.md`).
  Things outside your goal become a GitHub issue labelled `finding`.
- Small, coherent commits on your own branch, Conventional Commits, and
  user-visible changes in `CHANGELOG.md` under `[Unreleased]` (`docs/RELEASING.md`).
- Run `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`, plus
  `npm run test:concept`, integration or E2E when the change touches them.
  Report actual results and what was not run.
- Keep code simple: small focused files, no dead or commented-out code, no
  leftover scratch files; tests where logic lives. `docs/QUALITY_SECURITY.md`
  lists the habits and the pilot gate before real customers.
- After a larger step, update `docs/concept/PROGRESS.md` and `docs/STATUS.md`
  briefly. Do not create new plan or report files in `docs/` for every task;
  use commit messages and PR text.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
