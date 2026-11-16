# Releases, versions and storytelling

We build in public and want the repo to look professional at every moment,
including while things are in progress.

## Versions

- Semantic versioning, starting at `0.x` while the product is a concept:
  `0.MINOR.PATCH`. A finished goal from `docs/goals/QUEUE.md` is usually a
  minor release (`0.2.0`); fixes between goals are patch releases.
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

## Cutting a release (Claude Code does this when a goal is done)

1. Move `[Unreleased]` entries into a new version section with today's date.
2. Bump `package.json`, commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`.
3. Create a GitHub release from the tag: a short story of what changed and
   why, 2–4 screenshots from `docs/concept/screens/`, how to try it, and
   what's next. Mark `0.x` releases as pre-release.
4. Niclas approves before a release is published while repos are private
   drafts are fine.

## Storytelling

- `README.md` tells the story in this order: the problem (salon owners
  click around too much, own none of their data), the idea (say what you
  want, approve the proposal, AI-native but never AI-required), what works
  today (screenshots / short GIF), what's in progress, quick start, how to
  contribute.
- A clear status badge/label per area: **Working**, **In progress**,
  **Planned**. Work in progress is shown openly, not hidden; it's labelled.
- `docs/ROADMAP.md` (public, short) mirrors the goal queue in plain words.
- Each release is a small chapter of the story; release notes link back to
  the previous one.
- Screenshots and a 20–40 second demo GIF are refreshed every minor release.
