# Dependency security review

## 2026-11-17 · finding #12: compatible remediation applied

`npm audit fix --ignore-scripts` updates the existing TypeScript-ESLint chain
from 8.72.2 to stable 8.73.0 within the current dependency requirements. Upstream
now supports minimatch `^11.0.1`; the lockfile resolves 11.0.9. The previous
seven moderate entries were one advisory (GHSA-g3hv-75wg-m249) and its dependency
chain. Full `npm audit` and `npm audit --omit=dev` now report **zero vulnerabilities**.

No direct dependency range changed. No override, prerelease, forced peer install,
ESLint major upgrade or disabled audit was used. Minimatch's transitive major
change is supported by the upstream TypeScript-ESLint minor release. Its new
transitive `@isaacs/nonrecursive-glob-match` 1.1.0 (BlueOak-1.0.0 per package
metadata) is a development-only dependency needed by that upstream fix. Other
changed packages stay within their existing compatible ranges.

ESLint 9 is retained: its replacement requires a separate plugin compatibility
review; an ESLint major is neither required nor used to fix this advisory.

## Distribution checks

Before distributing a binary or container, inventory the exact platform
artifact and the native libraries it includes. Preserve upstream licenses
and notices and verify any corresponding-source obligations. The Prisma
CLI and Studio toolchain includes EPL-2.0 code. Keep those tools out of the
runtime image where the supported setup allows it. The platform-specific
Argon2 and sharp/libvips artifacts need a separate bundled-code review.
See [third-party notices](../THIRD_PARTY_NOTICES.md) for package details.
