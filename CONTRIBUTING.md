# Contributing to Cresavo

Thanks for helping. Cresavo is an AI-native system for small service
businesses. It is early (0.x concept stage), so small, focused changes are
easiest to review.

## Run it

```bash
npm run demo         # installs dependencies, then http://localhost:3000/studio
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

Add or update tests where logic lives. For changes to the studio or booking
page, also run `npm run test:concept` and add before/after screenshots
(390 px and 1280 px) to the pull request. Playwright and integration test
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

Cresavo is AGPL-3.0-only. Contributions will need the
[Contributor License Agreement](docs/legal/CLA.md): the individual form for
contributions you own, the entity form for contributions made on behalf of an
organization. In short, you keep ownership, and the agreement also lets the
maintainer offer your contribution under commercial terms; everyone who
received it under the AGPL keeps that licence.

**The CLA is a draft, pending legal review. The project is not collecting
signatures on it yet.** You can open pull requests and comment on the draft,
but external pull requests are held for merge until the reviewed agreement and
its signing process (a bot on the pull request) are in place. Never post a
completed form or personal details in a pull request.

The [draft trademark policy](TRADEMARK.md) covers the Cresavo name, logo and
brand media, which are not covered by the AGPL.

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
