# Open-source launch (goal 13)

Status 2026-11-18: **ready for launch.** The repository is prepared to be
made public as it is (`niclasvestlund-YT/booking-lab-se`, published under the
Cresavo name). The remaining steps are GitHub settings and decisions that only
Niclas can make; they are listed in order, with click paths, in
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md). Agents never change repository
settings or visibility. Name and naming rules: [BRAND.md](BRAND.md).

## Done in the repo

- [x] Product name Cresavo in all user-facing text; technical identifiers keep
      their earlier names on purpose ([BRAND.md](BRAND.md)).
- [x] README for the public: what it is, live demo, tour video, screenshots,
      status, quick start, self-hosting, architecture, contributing, security,
      licence and trademark.
- [x] LICENSE (AGPL-3.0-only), CONTRIBUTING, CODE_OF_CONDUCT (Contributor
      Covenant 2.1, reports through GitHub's private channels, no personal
      email), SECURITY (supported versions, private vulnerability reporting).
- [x] Issue forms (`bug.yml`, `feature.yml`, `config.yml` with blank issues
      off and security reports routed to SECURITY.md), PR template with the
      CLA tick, tests and screenshots, and `CODEOWNERS`.
- [x] Draft individual and entity CLA ([legal/CLA.md](legal/CLA.md)) and draft
      trademark policy ([TRADEMARK.md](../TRADEMARK.md)), both marked
      "Draft, pending legal review". TRADEMARK.md also states that the brand
      assets and `docs/media/**` are not covered by the AGPL.
- [x] Third-party notices, including the AI-generated demo images
      (`public/demo/manifest.json`).
- [x] gitleaks in CI (`secret-scan.yml`, `.gitleaks.toml`), OpenSSF Scorecard
      and Dependabot config. Tree and full history scanned 2026-11-18: no leaks.
- [x] Public-readiness sweep 2026-11-18: raw evidence logs removed from
      `docs/archive/`; private preview URLs, deployment IDs, local paths and
      the owner's surname redacted in the remaining archive. Fixtures are
      synthetic, the demo photos are AI-generated, demo data is fictional.

## Known limits (accepted for a concept demo)

- Many internal docs (`docs/ARCHITECTURE.md`, `docs/DATA_FLOWS.md`,
  `docs/STATUS.md`, `docs/archive/**`) are still in Swedish. Goal 29 moves the
  current docs to English; the archive stays as history.
- Git history still contains the removed evidence files and 13 commits
  authored with a personal email address; see the decision in
  [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## Deliberately left with earlier names

- `package.json` name and `package-lock.json`; plugin folder
  `plugins/booking-lab-time-card` and its manifest.
- Engine identifiers and descriptions: `src/lib/agent-api/*` (`/api/v1`,
  discovery text, OpenRPC title), `src/mcp/*` (MCP server names), the A2A auth
  realm, concept MCP names (`flerdo-demo`, `x-flerdo`), storage keys and
  export file names.
- Scripts, Dockerfile, `.gitignore` and the tests that assert these identifiers.
- History in `docs/archive/`, `docs/history/` and `design/brand/`.
