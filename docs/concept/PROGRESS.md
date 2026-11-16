# Framsteg · AI-native demo

## 2026-11-17 · Codex · goal 7 headless evaluations

- Continued on `goal/7-ai-evals` from the latest concept branch, carrying the
  completed engine commits forward. Added `npm run ai:eval`: 25 fixed-clock,
  fictional scenarios covering all seven tasks; rules mode passes 25/25 with
  no network or API cost, even if keys are configured. `--task <name>` filters
  cases and `--json` exports accuracy, timings, safe model/token/cost metadata.
- Added 39 evaluation tests, including mocked live success, fallback counted
  as failure, unknown costs, private-error redaction and CLI behavior. No live
  provider calls made. Full verification: 620 tests, lint, TypeScript and production build pass. Integration: `src/concept/ai/README.md`.
- Goal 7 remains in progress: evaluation tooling is delivered; real-key
  verification, encrypted BYOK storage, persisted cost history and UI/function
  calling integration remain. Reserved UI/data/store/i18n files are unchanged.

## 2026-11-17 · Codex · intent/AI engine and cleanup

- Night 1 steps 3/3b engine is ready: rule-based English intent interpreter, seven versioned AI tasks, JSON schemas, provider router, fetch adapters, bounded in-memory cost log and `POST /api/concept/ai/[task]`. No UI, fixture/store changes or new dependencies. No keys used; provider tests mock fetch.
- Wire the UI with `interpretCommand(text, context)` and `IntentContext`/`IntentResult` from `src/concept/intent`. Map fixture fields into that context, display the proposal/question, and apply approved actions through the store. Calculate free slot suggestions and revenue/segment answers from fixtures. All date-range ends are exclusive.
- For AI, POST each task's input object directly; response is `{ output, log }`. Import `tasks`/`TaskName` from `ai/registry.ts` to inspect contracts, and `runTask()` or `getCostLog()` on the server. Browser code uses HTTP. Integration details, tier overrides and cost limitations: `src/concept/ai/README.md`. PUBLIC_READONLY blocks POST by the existing policy.
- Cleanup: no queued goal fits wholly within the allowed areas. Finding #6 fixes mixed fixture clocks and freezes legacy test dates; no pages changed. Verification: 568 tests pass (86 intent, 57 AI plus existing suites), lint and TypeScript pass. Production build passes in database-free PUBLIC_READONLY mode; normal build verification uses an inert synthetic database URL. A real HTTP request against the production server also returned a zero-cost rule fallback. Real-key testing remains for later; no screenshots apply to engine-only work.
Senaste överst. Varje post: datum, vem, klart, prova så här, kvar.

## 2026-11-16 · Claude Code · plan och upprensning

- Klart: konceptplan (`CONCEPT.md`), ny kort `AGENTS.md` (gamla arkiverad i
  `docs/history/`), goal-prompt för Codex natt 1 (`CODEX_GOAL_NIGHT1.md`).
- Prova: inget att klicka på än. Codex bygger `/studio` och `/boka/salong-eko`.
- Kvar: allt byggande. Claude granskar Codex arbete på morgonen.
