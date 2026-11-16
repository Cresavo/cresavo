# Booking Lab SE – agent guide

Applies to Claude Code, Codex and Grok. Short on purpose: read this, then only
the document your task points to. Older history lives in
`docs/history/AGENTS_2026-11-16.md` – it gives **no** assignments or rules.

## Roles

- **Niclas** – product owner. Decides what gets built.
- **Claude Code** – technical owner: plan, structure, review, prompts.
- **Codex** – builds according to a goal prompt in `docs/concept/`.
- **Grok** – reviews and clicks through, reports in `docs/concept/REVIEW.md`.

Conversation with Niclas may be Swedish, but everything committed is English.

## Current goal: clickable AI-native demo

Read `docs/concept/CONCEPT.md`. Speed and feel come before full correctness.
Work on branch `concept/ai-native-demo` (or a branch off it).

- Build in `src/app/studio`, `src/app/boka`, `src/concept/` and
  `src/app/api/concept/`. Do not touch the existing `/admin`, `/api/v1`, MCP,
  Prisma schema or migrations without an explicit assignment.
- The concept uses fixture data + browser state, no database.
- AI keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are optional and used
  only on the server. Everything must work without a key.
- All UI text is in English. Every user-facing string lives in a per-area
  dictionary (e.g. `src/concept/i18n/en.ts` with a small `t()` helper) so
  Swedish (`sv`) can be added later without touching components. Demo data may
  stay Swedish-flavoured (Stockholm salon, Swedish names, SEK). Dates en-GB,
  24h clock.

## Working method: goals and issues

- Work happens in **goals** in the queue `docs/goals/QUEUE.md`. Take the topmost
  open one, work until "Done when" is met, then take the **next one without
  asking**. Empty queue: cleanup pass (issues). Flow, template and model
  choice: `docs/goals/README.md`.
- Do not fix things outside your goal. **Create a GitHub issue** with the
  label `finding` (command in `docs/goals/README.md`), or write it under
  "Findings" in PROGRESS.md if you lack GitHub access.

## Quality and security

`docs/QUALITY_SECURITY.md` lists the habits that apply to all code now
(tests where logic lives, server-side validation, AI only proposes, no
secrets or personal data in logs) and the pilot gate before real customers.

## Code principles

- Keep it simple and readable for humans and agents: small focused files,
  clear names, one responsibility per module.
- No dead code, commented-out code, unused exports, speculative abstractions
  or leftover scratch/debug files. When you replace something, delete the old
  version in the same commit.
- Types live next to the code that uses them; shared types only when actually
  shared.
- Follow existing patterns before inventing new ones; prefer the platform and
  existing deps over new dependencies.
- Every feature gets tests where logic lives (parsers, store actions, AI task
  schemas); UI is verified with screenshots.
- Leave the code cleaner than you found it, but only within your goal; other
  cleanups become issues.
- English for code, comments, commits and docs.

## How Niclas sees what is happening

After each larger step:
1. Update `docs/concept/PROGRESS.md`: date, what is done, how to try it
   (URL path), what remains. Short, in English.
2. Take mobile (390 px) and desktop (1280 px) screenshots of new pages and put
   them in `docs/concept/screens/` (png, max ~400 kB each). Link them in PROGRESS.
3. Commit often with clear messages and push the branch.

## Standing ground rules (apply to the whole repo)

- Invented data only. No real customer details, no real outgoing messages.
- No secrets in Git. `.env` is ignored; keys are never logged.
- No deploy, no merge to `main`, no force-push without Niclas's yes.
- The existing booking engine (`src/lib/domain.ts`, Prisma, MCP, `/api/v1`)
  has double-booking protection, idempotency and quotas that must not be
  weakened. Tests against a database require a separate `_test`/`_demo`
  database (`scripts/test-db-guard.mjs`).
- New dependencies only when clearly needed; say why in the commit message.

## Commands

```bash
npm run dev          # http://localhost:3000 (needs .env with DATABASE_URL for existing parts)
npm run lint
npx tsc --noEmit
npm test             # unit
npm run build
```

The concept pages (`/studio`, `/boka/salong-eko`) must work even without a database.

## Map of existing code (feel free to reuse ideas)

- `src/lib/domain.ts`, `time.ts`, `schedule.ts` – booking rules and times.
- `src/lib/capacity.ts` – proactive suggestions for gaps/campaigns.
- `src/app/admin/` – current admin (calendar, customers, services, staff,
  overview, campaigns). Works but feels cluttered – the concept replaces its UX.
- `src/app/api/v1/`, `src/mcp/` – agent API and MCP (Claude/ChatGPT).
- `docs/ARCHITECTURE.md`, `docs/PRIVACY_SECURITY.md` – when you touch the engine.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
