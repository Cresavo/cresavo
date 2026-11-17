# Headless intent and AI integration

## Evaluations

Run `npm run ai:eval` for the fixed-clock, fictional evaluation suite. The
default always uses rules, even when provider keys exist in `.env`. No API
requests or charges occur. Every task is represented; expected parameters,
numbers and factual content are checked without requiring identical prose.

Use `npm run ai:eval -- --task stock-forecast` to select one task, or append
`--json` for a machine-readable report. Reports include per-case pass/fail,
duration, provider/model, task prompt version, tokens and estimated USD cost.
They omit input payloads, generated text, keys and provider error messages.
Failures set exit code 1. Unknown charges remain null; `knownCostUsd` is only
the known subtotal, not a claim about the total bill.

After a real key has separately been configured and live testing is authorized,
`npm run ai:eval -- --live` uses the same router and task runner as the API.
This opt-in can incur provider charges. Rules fallback is always a failed live
evaluation, even if its answer matches the expectation. No real-key run has
been performed in this delivery; mocked provider tests cover the live path.

`evaluationCases` in `ai/evals/cases.ts` defines the scenarios;
`evaluateCases(cases, options)` in `ai/evals/evaluate.ts` returns a typed
`EvaluationReport`. Add semantic dot-path assertions in `expected` or
case-insensitive text checks in `contains` when adding scenarios.

## Engine integration

- Added `interpretCommand(text, context)` from `src/concept/intent/index.ts`; import `IntentContext`, `IntentResult`, `IntentAction` and `IntentParams` there. Map fixture fields into the small context (`durationMin`, `priceSek`, ISO booking `start`, ISO `now`; optional salon `timezone`, default Europe/Stockholm). No store dependency or mutations. Results contain `action`, `params`, `summary`, `confidence`; `action: "question"` also contains `question`. Show proposals for review, then map approved actions to the store. Booking proposals specify a date/time or day period; the UI/store must calculate and offer available slots before approval. Revenue/segment proposals specify query ranges; compute answers from fixture history. Range ends are exclusive; "since summer" means 1 September of the most recent completed summer. Bare weekdays include today, "next" advances a same-day weekday by seven days.
- Eight versioned tasks live in `src/concept/ai/registry.ts` (`tasks`, `TaskName`, `isTaskName`). Each entry exposes `input`, `output` (Zod schemas), `schema` (JSON Schema), `prompt`, `tier`, `version`, `fallback`. Input contracts are inspectable per task file. Use `POST /api/concept/ai/<task>` with the task input object directly as JSON; response is `{ output, log }`. For interpretation send `{ text, context }`. Invalid input returns 400, unknown tasks 404. The existing PUBLIC_READONLY policy blocks POST with 403; normal local concept mode leaves that flag unset.
- Server code can call typed `runTask(name, input)` from `ai/run-task.ts`. The browser should use the HTTP route and must not import server router/client modules. Without keys, every task runs deterministic rules and never calls fetch. With keys, output schemas and intent references are checked; network, timeout, JSON or validation failures fall back to rules. Tasks only produce drafts/proposals, never send messages or change records.
- `routeModel(tier)` in `ai/router.ts` uses OpenRouter, then OpenAI, then Anthropic when keys exist. Override with `CONCEPT_AI_FAST_PROVIDER`/`CONCEPT_AI_FAST_MODEL` (likewise SMART/IMAGE/SPEECH). The eight current tasks use text tiers; image/speech routing is reserved for separate modality adapters and this JSON client refuses those tiers. `getCostLog()`/`clearCostLog()` in `ai/cost-log.ts` expose the persisted last 1,000 calls; each route result includes its safe log entry for UI display. Costs are illustrative USD estimates (provider-reported cost preferred), null for unknown billing/failed calls, zero for rules without a provider. No keys or customer payloads are logged.
- Verification: 86 intent cases and 57 AI/router/schema/HTTP cases, all provider calls mocked. No new dependencies, pages or UI changes. Real-provider verification is deferred until an operator adds a key. No screenshots apply to this headless delivery. The cleanup pass fixed clock-sensitive fixture failures tracked in finding #6. Full-suite tests, lint, TypeScript and production build pass.

## UI wiring

`src/concept/command/` builds the interpreter context from the store (`intent-context.ts`), maps results to reviewable proposals (`proposal.ts`, `clarify.ts`) and calls `interpret-command` through `ai/api-client.ts` only when `GET /api/concept/ai` reports a configured provider. The same endpoint feeds More → Your data & AI (`ai/overview.ts`). The journal dictation calls `structure-journal` the same way.

## Business settings and persistence (demo)

More → Your data & AI saves one provider key for the server-selected fictional
business, `salong-eko`. Server helpers also accept separate business IDs; keys,
tier overrides and usage are isolated per business. The HTTP demo is deliberately
single-business, without production authentication; do not expose it to real
customers. Settings mutations require a same-origin request and respect
PUBLIC_READONLY.

Set `CONCEPT_KEY_SECRET` to a private random value of at least 32 characters
before adding a key. AES-256-GCM uses a fresh nonce per save and binds ciphertext
to business + provider. The secret is never saved with the data. Keep it across
restarts; losing/changing it makes saved keys unusable until replaced. Keys never
appear in responses/logs; overview returns provider, last four and usable status.
Removing a key restores platform routing. Business keys take priority over platform
keys and platform provider overrides. Each text task can select Fast or Smart.

`.data/concept-ai/<business>.json` (gitignored, files mode 0600) stores encrypted
keys, tier preferences and payload-free costs. `CONCEPT_AI_STORE_DIR` can relocate
it. Writes are atomic within the local single-process demo; this is not a shared
multi-worker production store. Monthly totals use UTC and include all persisted
calls; the recent-call API is bounded separately. Unknown charges, including
provider failures that fall back to rules, remain unknown rather than free.

`interpret-command` requests a single `propose_command` function/tool call from
OpenAI/OpenRouter or Anthropic. Its arguments are validated against the task schema
and context references before reaching the existing human approval UI. Unexpected
tools, multiple calls, malformed arguments and provider failures use rules. There
is no execution loop and no automatic mutation. Provider formats follow the
[OpenAI function-calling guide](https://developers.openai.com/api/docs/guides/function-calling)
and [Anthropic tool-use guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview).

Unit tests mock every provider across every evaluation task, plus encrypted disk
persistence, tampering, wrong secrets, isolation and HTTP validation. Default evals
explicitly ignore saved business keys/preferences as well as platform keys, so
`npm run ai:eval` remains offline. Real-key verification remains pending: no key
was available or used for this delivery.
