# Third-party notices

Inventory for the locked Booking Lab SE POC, reviewed 2026-11-11. Our application is AGPL-3.0-only; dependencies retain their own licenses. No third-party package source or binary is committed here. This file is an attribution and distribution checklist, not a claim that every future deployment artifact is license-cleared. Preserve the original LICENSE/NOTICE files with any redistributed packages.

## Sharp and libvips

- **sharp 0.35.5**, Lovell Fuller and contributors: [project](https://github.com/lovell/sharp), [installation and source-build instructions](https://sharp.pixelplumbing.com/install/). JavaScript/native binding source declares Apache-2.0. Installed `node_modules/sharp/LICENSE` contains Apache License 2.0.
- **@img/sharp-win32-x64 0.35.5**, Lovell Fuller and contributors: installed package metadata declares **Apache-2.0 AND LGPL-3.0-or-later**. Its `versions.json` lists **libvips 8.18.7** and other native libraries. This is not a blanket Apache-only binary. The inspected package LICENSE contains Apache text; that alone does not document all native library obligations.
- Optional **@img/sharp-libvips-* 1.3.4** packages in the lockfile declare **LGPL-3.0-or-later**. These platform packages were not all installed or audited file-by-file on Windows. [Packaging/build source](https://github.com/lovell/sharp-libvips), [libvips source and contributors](https://github.com/libvips/libvips), [LGPLv3 terms](https://www.gnu.org/licenses/lgpl-3.0.html).

Before distributing binaries or container images: inventory the exact platform artifact and bundled native libraries, preserve their notices and license texts, obtain/provide the required corresponding source for those exact binaries and verify the applicable replacement/relinking requirements. A general upstream link is not a complete corresponding-source delivery mechanism. The package metadata and this notice do not resolve the incomplete native-license material observed in the Windows package. Binary distribution remains a separate release check; no binaries are published in this batch.

## caniuse-lite

**caniuse-lite 1.0.30001826**, Ben Briggs and contributors, derived from Can I Use compatibility data: [caniuse-lite source](https://github.com/browserslist/caniuse-lite), [Can I Use data source](https://github.com/Fyrd/caniuse), [Can I Use](https://caniuse.com/). Licensed under **Creative Commons Attribution 4.0 International (CC-BY-4.0)**, as specified in the installed package and its LICENSE. [License and attribution conditions](https://creativecommons.org/licenses/by/4.0/).

Booking Lab SE uses this unmodified dependency in its build/browser-compatibility toolchain. No changes to the upstream data are made in this batch. Retain this attribution, source/license links and any upstream notices when redistributing the data; indicate any future modifications. The authors do not endorse this project.

## Other direct dependencies and tooling

Next.js, React, React DOM, Luxon and Zod declare MIT; Prisma and MCP SDK declare Apache-2.0. Exact versions and transitive dependencies are locked in package-lock.json. See docs/OPEN_SOURCE_REVIEW.md for the earlier inventory and limits. Do not replace the packages' actual license texts with this summary.

Prettier **3.6.2**, copyright James Long and contributors, **MIT**, was installed only in a separate local tooling directory to perform the requested formatting. Its LICENSE was read; its separate npm audit reported **0 vulnerabilities**. No Prettier dependency or runtime package was added to this project. All existing application dependency advisories remain separately reported in docs/VERIFICATION.md.
