# Releasing Cresavo

Releases let people follow what has changed without reading every pull request. Each release has
short, readable notes; the [CHANGELOG](../CHANGELOG.md) keeps the full detail.

## When

Cut a release when a batch of user-visible work has merged, typically once a week while Cresavo is a
concept demo. Security fixes can ship on their own at any time.

Versions follow [Semantic Versioning](https://semver.org/). While the version is `0.x`, minor
releases (`0.5.0`) carry features and patch releases (`0.5.1`) carry fixes only. Every `0.x`
release is published as a GitHub pre-release.

## How

1. Open a pull request named `Release 0.5.0` that:
   - sets `"version"` in `package.json` (and `package-lock.json`) to the new version;
   - renames `## [Unreleased]` in `CHANGELOG.md` to `## [0.5.0] - YYYY-MM-DD` and adds a new empty
     `## [Unreleased]` above it;
   - adds `docs/releases/v0.5.0.md` with the release notes (see below).
2. Check the notes locally: `node scripts/release-notes.mjs 0.5.0`.
3. Merge the pull request. The [Release workflow](../.github/workflows/release.yml) sees the new
   version, creates the `v0.5.0` tag on that commit and publishes the GitHub release with the notes.
   It does nothing if the release already exists, and it can be re-run from the Actions tab.

If `docs/releases/v<version>.md` is missing, the workflow uses that version's CHANGELOG section.

## Release notes

Write for salon owners, contributors and curious visitors, not for reviewers:

- Start with one or two sentences on what this release is about.
- Then "New since 0.4.0": the five to eight changes people will notice, each with a bold lead-in.
  Add a screenshot or a short clip from `docs/design/` when it helps.
- Then "Try it" with the demo link and the three local commands.
- End with a link to the full changelog and thanks to contributors by GitHub handle.
- Keep the pre-release line: concept demo, fictional data, not ready for real customers.
- Use fictional data only, and do not name other booking products.

## Following along

- **Watch → Custom → Releases** on GitHub to get one notification per release.
- The releases feed is available as Atom: `https://github.com/Cresavo/cresavo/releases.atom`.
- Day-to-day discussion happens in [Discussions](https://github.com/Cresavo/cresavo/discussions).
