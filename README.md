# Cresavo

**More time. On your terms.**

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Cresavo/cresavo/verify.yml?branch=main&label=CI)](https://github.com/Cresavo/cresavo/actions/workflows/verify.yml)
[![Secret scan](https://img.shields.io/github/actions/workflow/status/Cresavo/cresavo/secret-scan.yml?branch=main&label=secret%20scan)](https://github.com/Cresavo/cresavo/actions/workflows/secret-scan.yml)

Cresavo is a calm, open-source booking and business workspace for small
service businesses, starting with salons and clinics. Your calendar, your
customers and your booking page in one place. An optional assistant can
suggest the next step, but you approve every change, and everything works
with plain buttons and no AI at all.

> **Status: concept demo; work in progress; not production-ready.** The demo
> runs on fictional data in your browser. Do not use it with real customers
> yet; see [STATUS](docs/STATUS.md) and [QUALITY_SECURITY](docs/QUALITY_SECURITY.md).

- **Live demo:** <https://demo.cresavo.com> (fictional salon "Salong Eko", no sign-up)
- **Tour video (36 s):** [watch the tour](docs/media/cresavo-tour-16x9.mp4)

<a href="docs/media/cresavo-tour-16x9.mp4"><img src="docs/media/cresavo-tour-16x9-poster.jpg" alt="Poster frame of the Cresavo tour video: 'Run a salon, studio or clinic?' next to a phone full of booking messages" width="480"></a>

## Screenshots

| The owner's day | Dark mode |
|---|---|
| ![Today view: the day's schedule, the next customer and a short morning brief](docs/design/cresavo/screens/studio-today-desktop-after.jpg) | ![Today view in dark mode](docs/design/cresavo/screens/studio-today-desktop-dark-after.jpg) |

| Landing page | Customer booking page (mobile) |
|---|---|
| <img src="docs/design/cresavo/screens/landing-v2-desktop-light.png" alt="Cresavo landing page with the tagline and product sections" width="420"> | <img src="docs/design/cresavo/screens/booking-page-mobile-after.jpg" alt="Salong Eko's booking page on a phone: treatments, team, reviews and opening hours" width="200"> |

## Features

- **Today:** the day's schedule, the next customer and free slots at a glance;
  book a caller in a few taps ("Someone is calling").
- **Calendar:** drag a visit to move it; opening hours and lunch breaks per business.
- **Customers and journal:** visit history, preferences and treatment notes.
- **Inbox:** booking requests, cancellations and reviews, with drafted replies
  you check before sending.
- **Booking page:** each business gets its own page with treatments, team,
  hours and reviews; clients book, move and cancel themselves.
- **Treatments and prices, campaigns, gift cards, packages, stock and finance**
  as modules you switch on when you need them.
- **Undo and "What happened?":** changes are logged, and a change can be
  undone as long as nothing later stands in the way (for example a new booking
  in the same slot).
- **Your data is yours:** export it, connect other tools through an open API
  and an MCP endpoint, or host it yourself.
- **AI is optional:** bring your own key for OpenRouter, OpenAI or Anthropic;
  without a key every task runs built-in rules.

## Works with your AI assistant

Connect a compatible assistant to a local Cresavo test database to look up
treatments and open times. Try approved changes with the bundled walkthrough,
or review fictional proposals in a local copy of the demo studio.
[Connect your AI assistant](docs/CONNECT_AI_ASSISTANT.md).

## Quick start

Requires Node.js 22.12+ (or 24+).

```bash
git clone https://github.com/Cresavo/cresavo.git cresavo
cd cresavo
npm run demo        # installs dependencies and opens the studio
```

Open <http://localhost:3000/studio> (owner) and
<http://localhost:3000/boka/salong-eko> (customer booking page). Demo state
lives in your browser; **More → Settings → Reset demo** starts over. On
Windows you can also double-click `start-demo.cmd`. Optional AI: set
`OPENROUTER_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`.

## Self-hosting

- **Concept demo:** a plain Next.js app with no database or secrets. Build it
  the way the public demo is built (the database URL is a placeholder that is
  only needed to generate the Prisma client):

  ```bash
  npm ci && npx prisma generate
  DATABASE_URL=postgresql://build@127.0.0.1:1/build_test \
  NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1 NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=your-domain.example \
  npm run build
  npm start                      # http://localhost:3000
  ```

  To deploy on Vercel, see [DEPLOY_DEMO](docs/DEPLOY_DEMO.md) and change the
  product domain in `vercel.json` to one you control.
- **Booking engine** (`/admin`, `/api/v1`, owner MCP): needs PostgreSQL. With
  Docker Compose:

  ```bash
  cp -n .env.example .env        # set SESSION_SECRET (at least 32 random characters)
  docker compose up -d --wait
  npm ci && npx prisma generate
  npm run db:migrate && npm run db:seed
  npm run admin:manage -- create admin@example.test
  npm run dev                    # use the npm scripts, not next dev directly
  ```

  The owner MCP is local only: `npm run mcp:client` (read-only) or
  `npm run mcp:client -- --admin --workspace` (every write asks for "yes").

The booking engine is a tested proof of concept with synthetic data, not a
hardened production service.

## Architecture

- **Next.js 16 + TypeScript.** The concept demo (`src/app/studio`,
  `src/app/boka`, `src/concept/`) runs on fixture data and browser state;
  `src/proxy.ts` routes the product domain, the demo subdomain and business
  addresses.
- **Booking engine:** Prisma and PostgreSQL. Booking rules live once in
  `src/lib/domain.ts` and are shared by the web, the REST API and the MCP.
- **Agent gateway:** the public REST/MCP entry for external agents lives in a
  separate repository, `booking-lab-gateway`, which is not public yet
  (contract: [GATEWAY_SPLIT](docs/GATEWAY_SPLIT.md)).
- More: [ARCHITECTURE](docs/ARCHITECTURE.md), [DATA_FLOWS](docs/DATA_FLOWS.md),
  [PRIVACY_SECURITY](docs/PRIVACY_SECURITY.md), [ROADMAP](docs/ROADMAP.md),
  [CHANGELOG](CHANGELOG.md). Some engine docs are still in Swedish; moving
  them to English is planned.

## Checks

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
npm run test:concept           # concept demo browser tests (Playwright)
npm run test:integration       # needs a local database whose name ends in _test
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING](CONTRIBUTING.md) and
[AGENTS.md](AGENTS.md) (how we work; it applies to people and AI agents
alike). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Contributions will need a [Contributor License Agreement](docs/legal/CLA.md)
(individual or entity). It is a **draft, pending legal review**, and the
project is not collecting signatures yet: you are welcome to open issues and
pull requests and to comment on the draft, but external pull requests are held
for merge until the reviewed signing process is available.

## Security

Report vulnerabilities privately through GitHub Security Advisories, never in
a public issue. See [SECURITY](SECURITY.md).

## Licence and trademark

The source code is licensed under the
[GNU Affero General Public License v3.0 only](LICENSE) (AGPL-3.0-only),
including the design-token files and artwork the application needs to build
and run. If you modify Cresavo and users interact with it over a network,
prominently offer those users a free download of the Corresponding Source of
the version they are using, including the files and scripts needed to build
and run it. Third-party components keep their own licences:
[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

**Not covered by the AGPL:** trademark rights in the Cresavo name and logo,
the standalone brand kits in `design/brand/**` (except the token files the
build needs) and the media in `docs/media/**`; all rights in those are
reserved. You may fork the repository, keep its attribution and say truthfully
that your work is based on Cresavo. Use a distinct name and logo for an
independently offered modified product or service, and do not suggest it is
official. Details: [TRADEMARK.md](TRADEMARK.md) (draft, pending legal review).
