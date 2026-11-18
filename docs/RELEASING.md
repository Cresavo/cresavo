# Releases, versions and storytelling

We build in public and want the repo to look professional at every moment,
including while things are in progress.

## Versions

- Semantic versioning, starting at `0.x` while the product is a concept:
  `0.MINOR.PATCH`. A feature milestone is usually a minor release (such as
  `0.2.0`). Fixes between milestones are patch releases.
- `1.0.0` is the first release a real salon can use (pilot gate in
  `docs/QUALITY_SECURITY.md` passed).
- The version lives in `package.json` and as a git tag `vX.Y.Z`.

## Commits

Conventional Commits, as already used: `feat(studio): ...`, `fix(intent): ...`,
`docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`. One logical change
per commit. This keeps the changelog readable and automatable later.

## Changelog

`CHANGELOG.md` (Keep a Changelog format). Every goal adds its user-visible
changes under `## [Unreleased]` as it goes: Added / Changed / Fixed /
Removed. Written for users, not for developers ("Owners can move a booking by
typing it", not "add parseMove()").

## Cutting a release

1. Move `[Unreleased]` entries into a new version section with today's date.
2. Bump `package.json`, commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`.
3. Create a GitHub release from the tag: a short story of what changed and
   why, 2–4 current screenshots, how to try it, and
   what's next. Mark `0.x` releases as pre-release.
4. Ask the maintainer to approve the release before publishing.

## Storytelling

- `README.md` tells the story in this order: the problem (salon owners
  want control of their time and data), the demo, the founder story, quick
  start, features and screenshots, and how to contribute.
- A clear status badge/label per area: **Working**, **In progress**,
  **Planned**. Work in progress is shown openly, not hidden; it's labelled.
- The [roadmap](ROADMAP.md) summarizes what works and what is planned.
- Each release is a small chapter of the story; release notes link back to
  the previous one.
- Screenshots and a short animated preview are refreshed every minor release.
