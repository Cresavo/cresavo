# Contributing to Cresavo

Thanks for helping. Cresavo is an open-source booking workspace for small
service businesses, starting with salons and clinics. The concept demo is
early, and a clear bug report or a quickstart you tried from scratch can help
as much as a patch.

## Your first contribution

Start with the [good first issues](https://github.com/Cresavo/cresavo/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
Leave a short comment if you'd like to take one so the maintainer can confirm
the scope and avoid duplicating work. You're welcome to ask for help in
[Discussions](https://github.com/Cresavo/cresavo/discussions).

With Node.js 22.12+ (or 24+) and a clone of this repo, run this from the
repository root:

```bash
npm run demo         # installs dependencies, then http://localhost:3000/studio
```

The concept demo needs no database and no AI key. See the README for the
booking engine (Prisma, Postgres) setup.

Open a small pull request and link the issue if there is one. Tell the
maintainer what changed and how you checked it. Niclas reviews PRs in batches
and will leave next steps in the thread. If you get stuck or need to step away,
a short note is plenty.

The [CLA](#license-and-cla) is a draft pending legal review. You can open a PR
now, and signatures are closed while the draft is under review. External PRs
can be reviewed but are held for merge until the reviewed agreement and
signing process are in place.

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

Cresavo uses an AI-assisted workflow documented in [AGENTS.md](AGENTS.md) and [.claude/](.claude/).

Read [AGENTS.md](AGENTS.md) (short) and
[docs/QUALITY_SECURITY.md](docs/QUALITY_SECURITY.md). In short: small
readable files, validate on the server, AI only proposes and the person
approves, all UI text in the i18n dictionary (English first), no secrets or
personal data in logs.

## Adding a language

English is the default for the studio and new booking pages. Choose Swedish
explicitly in tests that exercise Swedish UI or booking copy.

1. Add new UI keys to `src/concept/i18n/en.ts` first. Use `t()` for copy,
   `tc()` for counts and the format helpers for dates, times and money.
2. In the new dictionary, match every English key and keep the placeholders
   in each plural form. Values with two forms use `one|many`.
3. Register the locale and its Intl language tag in `src/lib/locale.ts`,
   add the dictionary to `src/concept/i18n/index.ts`, and include the locale
   in the studio and booking language controls. Add industry vocabulary
   with its singular, plural and definite forms where the language needs them.
4. Use the explicit business locale for customer templates and calendar
   downloads. Keep user-authored content and stored booking values intact.
5. Run `npx vitest run tests/concept-i18n.test.ts` and
   `npm run test:concept -- i18n.spec.ts --trace off`. The smoke runs at 390
   and 1440 px. Set `CONCEPT_SCREENSHOTS=1` to capture the mobile JPEGs.

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
