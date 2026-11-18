# Cresavo (repo: booking-lab-se)

**More time. On your terms.** An AI-native system for small service businesses,
starting with salons and clinics: you say what you want and approve the
proposal. Everything also works with plain buttons, and AI is never required.

> **Status: concept demo (0.x).** The studio and customer pages run on
> fictional data in your browser. The booking engine underneath is a tested
> local proof of concept with synthetic data. Nothing here is ready for real
> customers yet; see [STATUS](docs/STATUS.md) and
> [QUALITY_SECURITY](docs/QUALITY_SECURITY.md).

- Live demo: <https://demo.cresavo.com> (read-only, fictional data)
- Product site: <https://cresavo.com> (coming soon and waiting list)

![The owner's day at a glance](docs/concept/screens/today-1280.png)

The public agent gateway (REST/MCP for external agents) lives in the separate
repository [booking-lab-gateway](https://github.com/niclasvestlund-YT/booking-lab-gateway);
the contract is in [GATEWAY_SPLIT](docs/GATEWAY_SPLIT.md).

## Try the demo locally

Requires Node.js 22.12+ (or 24+). One command installs what is needed and opens
the studio:

```bash
npm run demo                   # on Windows you can also double-click start-demo.cmd
```

Open <http://localhost:3000/studio> (owner) and
<http://localhost:3000/boka/salong-eko> (customer booking page). The studio
keeps its demo state in your browser; **More → Settings → Reset demo** starts
over. Optional AI: set `OPENROUTER_API_KEY`, `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` in `.env`; without a key every task runs its built-in rules.

## Booking engine (PostgreSQL)

The engine behind `/admin`, `/api/v1` and the owner MCP needs Docker with
Compose and free ports 5432 and 3000:

```bash
cp -n .env.example .env        # set SESSION_SECRET (at least 32 random characters)
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run admin:manage -- create admin@example.test
npm run dev                    # always use the npm scripts, not next dev directly
```

Owner MCP (local only, the server does not listen on the network):

```bash
npm run mcp:client                         # read-only: services and free times
npm run mcp:client -- --admin --workspace  # workspace, every write requires "yes"
```

## Checks

```bash
npm run lint
npx tsc --noEmit
npm test                       # unit tests
npm run test:concept           # concept demo browser tests
npm run qa                     # QA scripts against a running demo build (QA_BASE_URL defaults to http://localhost:3100)
npm run test:integration       # needs a local database whose name ends in _test
npx playwright install chromium && npm run test:e2e
npm run build
npm run ai:eval                # AI tasks against fixed scenarios
```

Integration and E2E tests refuse to run against anything but a local database
whose name ends in `_test` or `_demo`.

## Where things are

| Path | Contents |
|---|---|
| `src/app/studio/`, `src/app/boka/` | Concept demo: owner studio and customer booking page |
| `src/concept/` | Concept logic: brand, fixtures, AI tasks, site pages, host routing |
| `src/pages/` | Product site: demo landing, coming soon, privacy |
| `src/proxy.ts` | Host routing: product domain, demo subdomain, business addresses |
| `src/app/admin/`, `src/app/page.tsx` | Booking engine web: workspace and legacy customer booking |
| `src/lib/domain.ts` | Booking rules shared by web, API and MCP |
| `src/mcp/`, `src/lib/agent-api/` | Owner MCP and agent rules: keys, mandates, proposals, log |
| `prisma/` | Data model and migrations |
| `tests/` | Unit, integration, E2E and concept tests |

## Documentation

- [STATUS](docs/STATUS.md) and [ROADMAP](docs/ROADMAP.md)
- [Concept](docs/concept/CONCEPT.md) · [Progress log](docs/concept/PROGRESS.md) ·
  [Goal queue](docs/goals/QUEUE.md) · [Changelog](CHANGELOG.md)
- [Brand](docs/BRAND.md) · [Deploying the demo](docs/DEPLOY_DEMO.md) ·
  [Waiting list](docs/WAITLIST.md)
- [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATA_FLOWS](docs/DATA_FLOWS.md) ·
  [PRIVACY_SECURITY](docs/PRIVACY_SECURITY.md) ·
  [ENGINEERING_PRINCIPLES](docs/ENGINEERING_PRINCIPLES.md)
- [docs/archive](docs/archive/README.md) and [docs/history](docs/history/):
  earlier plans, QA reports and evidence (history only, no assignments)

## Licence

AGPL-3.0-only, see [LICENSE](LICENSE) and [CONTRIBUTING](CONTRIBUTING.md). Read
[AGENTS.md](AGENTS.md) for how we work; it applies to people as much as to AI agents.
