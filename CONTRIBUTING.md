# Contributing to Flerdo

Thanks for helping. Flerdo is an AI-native system for small service
businesses. It is early (0.x concept stage), so small, focused changes are
easiest to review.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, studio at /studio
```

The concept demo needs no database and no AI key. See the README for the
booking engine (Prisma, Postgres) setup.

## Check your change

```bash
npm run lint
npx tsc --noEmit
npm test             # unit tests
npm run ai:eval      # AI task scenarios
npm run build
```

Add or update tests where logic lives. Playwright and integration test
commands are in the README.

## Code principles

Read [AGENTS.md](AGENTS.md) (short) and
[docs/QUALITY_SECURITY.md](docs/QUALITY_SECURITY.md). In short: small
readable files, validate on the server, AI only proposes and the person
approves, all UI text in the i18n dictionary (English first), no secrets or
personal data in logs.

## Commits and releases

Use [Conventional Commits](https://www.conventional-commits.org/)
(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Add user-visible
changes to `CHANGELOG.md` under `[Unreleased]`. See
[docs/RELEASING.md](docs/RELEASING.md).

## Synthetic data only

Never commit real customer data, real names, phone numbers, e-mail addresses
or keys. Fixtures and screenshots use fictional people and the fictional
business "Salong Eko". Do not copy code or assets without a documented,
compatible license.

## License and CLA

Flerdo is AGPL-3.0-only. Before we can merge your first pull request you
must agree to the Contributor License Agreement (individual, or entity if you
contribute on behalf of an employer). The CLA Assistant bot will ask you on
the pull request. The text is in [docs/legal/CLA.md](docs/legal/CLA.md)
(currently a draft pending legal review).

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
