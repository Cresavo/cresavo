# Third-party notices

The application code is AGPL-3.0-only (see [LICENSE](LICENSE)), including the
token files and artwork it needs to build and run. Dependencies keep their own
licences. Trademark rights in the Cresavo name and logo, the standalone brand
kits in `design/brand/**` and the media in `docs/media/**` are described in
[TRADEMARK.md](TRADEMARK.md).

## Demo images

The photos in `public/demo/*.webp` (two fictional staff portraits and three
salon still lifes) were AI-generated on 2026-11-12 for this demo. The
portraits depict fictional characters and were not intended to portray
identifiable people; the prompts excluded brands and text. Each file, its
prompt summary, alt text, size and SHA-256 is recorded in
[public/demo/manifest.json](public/demo/manifest.json). To the extent any
copyright exists in them, they are distributed under AGPL-3.0-only with the
code. `public/demo/*.png` are screenshots of the demo itself, and
`public/site/**` holds screen recordings and stills of the demo, all with
fictional data; see [TRADEMARK.md](TRADEMARK.md) for the brand they show.

## Fonts

**Inter** (Copyright 2016 The Inter Project Authors,
<https://github.com/rsms/inter>) is loaded through `next/font/google` and
self-hosted at build time, so a build serves the font files. Inter is licensed
under the [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/);
the upstream copyright notice and licence are in
[Inter's LICENSE.txt](https://github.com/rsms/inter/blob/master/LICENSE.txt),
and the served font files carry the copyright notice and a link to the OFL in
their metadata (checked on a 2026-11-18 build). The font is not committed to
this repository; anyone distributing a build should include the OFL text.

## Epic 06 icon subset

`lucide-react` 1.72.0: ISC; Feather-derived icons retain the additional MIT
copyright and permission notice. Complete tarball LICENSE is preserved in
[THIRD_PARTY_LUCIDE_LICENSE.txt](THIRD_PARTY_LUCIDE_LICENSE.txt). No additional
runtime dependencies; existing React peer. The application's AGPL-3.0-only
license is unchanged. Original package notices also remain in node_modules.

## Restricted Vercel preview artifact (2026-11-12)

This earlier baseline section qualifies the historical distribution gates below for the exact
Linux x64 GNU preview artifact. The application remains AGPL-3.0-only. No npm
versions or upstream code were changed at that gate. Epic 06 adds only the
Lucide package described above. This is not clearance for other
platforms or a public binary release.

`Dockerfile.vercel` installs the locked production tree with
`--omit=dev --omit=peer --omit=optional --ignore-scripts`. It excludes Prisma
CLI/Studio/elkjs, sharp/libvips and TypeScript from the final runtime. The build
stage retains the original toolchain. The generated Prisma client and the one
required Argon2 Linux binding are copied explicitly. Original package notices
remain in node_modules; Node/Debian retain their own notices. The final image
also includes our LICENSE, these notices, the native notice bundle and a
credential-free archive of the corresponding application source.

**@node-rs/argon2-linux-x64-gnu 2.2.2:** the Docker build refuses a different
architecture or native binary SHA-256 from
`0f4e6088e351149af677044c0570bdd8a1a10517069811744e48170366e714b2`.
The registry tarball integrity was checked. Published provenance identifies
node-rs source commit `b706e3035f5d4d487ae66ea0549a041cd509e5d4`;
its signature was not independently cryptographically verified.

[THIRD_PARTY_NATIVE_NOTICES.txt](THIRD_PARTY_NATIVE_NOTICES.txt) preserves full
upstream license/copyright material for the wrapper, Rust standard library and
the source Cargo graph (57 checksum-verified registry crates plus workspace
packages). Missing package-root texts were retrieved from the exact upstream
source commits recorded in the bundle. This is a conservative source dependency
inventory, not a claim that every crate is linked or a complete binary SBOM.
MIT is selected where offered as an alternative; ISC and Unicode-3.0 notices
are preserved. Unicode-3.0 is listed as GPL-compatible by
[GNU](https://www.gnu.org/licenses/license-list.html#Unicode-3.0); GNU's
[compatibility guidance](https://www.gnu.org/licenses/gpl-faq.html#AllCompatibility)
also addresses AGPLv3. No LGPL option is selected where MIT is available.

The old CLI/ELK and sharp/libvips gates still apply if those components are
included in another artifact. Do not generalise this narrower preview packaging
decision to the full development installation or future optional bindings.

## Epic 04 password hashing (2026-11-12)

**@node-rs/argon2 2.2.2**, copyright LongYinan, MIT: the installed wrapper LICENSE was read; retain its full text and attribution. Installed **@node-rs/argon2-win32-x64-msvc 2.2.2** declares MIT and supplies a native binding. [Source and license](https://github.com/napi-rs/node-rs), [package source](https://github.com/napi-rs/node-rs/tree/main/packages/argon2). No upstream source/binary is copied into Git. One new direct dependency is justified by a maintained Argon2id implementation; see [ADR004](docs/decisions/ADR_004_ADMIN_IDENTITY.md).

The upstream Rust manifest uses argon2-rust, napi and allocator dependencies. Root MIT metadata alone does not clear every platform build's bundled sources/notices. Before binary/container distribution inventory the exact native artifact and Cargo source/dependency versions, preserve applicable MIT/Apache notices and verify corresponding obligations. Windows local installation is tested. Independent Grok QA additionally ran the Linux x64 GNU binding2.2.2: its package declares MIT but contains no LICENSE file; strings identify some linked Rust crates (argon2-rust1.1.0,napi3.12.1,rand0.10.2). This is partial evidence, not a complete SBOM or license clearance. Other optional platforms remain untested lockfile entries. Existing sharp/libvips and EPL distribution gates remain.

Separate probe audit: zero findings. Application full audit after installation: seven moderate development-tool findings, zero high; production audit zero. This is not cryptographic certification or production clearance. No Better Auth probe package was added to the project.


## Epic 03 verified local POC — Prisma 7 (2026-11-12)

Prisma CLI, Client, PostgreSQL adapter and driver-adapter-utils **7.10.1**: installed LICENSE texts declare **Apache-2.0**. The new direct adapter is required by Prisma 7; its transitive **pg** driver (Brian Carlson and contributors) and **postgres-array** (Ben Drucker and contributors) carry **MIT** license texts. Preserve those original texts/copyright notices. [Prisma source](https://github.com/prisma/prisma), [adapter source](https://github.com/prisma/prisma/tree/main/packages/adapter-pg), [node-postgres source](https://github.com/brianc/node-postgres).

The larger Prisma CLI/Studio tool tree also installs **elkjs 0.11.1, EPL-2.0**. Actual LICENSE.md and bundled SPDX headers were inspected; no concrete GPL secondary-license notice was verified. Do not assume GPL/AGPL compatibility or copy/relicense its code into our application. It remains an unmodified separate tool component, not an application import. Even `npm ls --omit=dev` may include this CLI tree via the optional Prisma peer; do not assume a production install excludes it. Before binary/container distribution, verify the exact artifact, separation and EPL source/notice obligations. No such artifact is distributed here. [elkjs source](https://github.com/kieler/elkjs), [EPL terms](https://www.eclipse.org/legal/epl-2.0/).

See [changed dependency inventory](docs/archive/EPIC_03_LICENSE_INVENTORY.md) and [review and unresolved distribution checks](docs/DEPENDENCY_REVIEW.md). This is not full bundled-code clearance; @prisma/dev's ISC metadata lacks a separate root LICENSE. Earlier sharp/libvips and caniuse obligations below still apply. The application remains AGPL-3.0-only; the old Prisma 6 version statement is historical.

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

Next.js, React, React DOM, Luxon and Zod declare MIT; Prisma and MCP SDK declare Apache-2.0. Exact versions and transitive dependencies are locked in package-lock.json. See [docs/archive/OPEN_SOURCE_REVIEW.md](docs/archive/OPEN_SOURCE_REVIEW.md) (historical) for the earlier inventory and limits. Do not replace the packages' actual license texts with this summary.

Prettier **3.6.2**, copyright James Long and contributors, **MIT**, was installed only in a separate local tooling directory to perform the requested formatting. Its LICENSE was read; its separate npm audit reported **0 vulnerabilities**. No Prettier dependency or runtime package was added to this project. All existing application dependency advisories remain separately reported in [docs/archive/VERIFICATION.md](docs/archive/VERIFICATION.md) (historical).


## jose (transitive dependency)

jose 6.2.17, MIT, Copyright (c) 2018 Filip Skokan.
The original licence is in node_modules/jose/LICENSE.md.
The licence text and applicable notices must accompany the package if it is
distributed. It is installed by npm; no source code was copied into the
project's own files. @a2a-js/sdk was removed on 2026-11-16 together with the
local A2A demo tool.

## Tour video music

The music in `docs/media/cresavo-tour-16x9.mp4` is generated in code by
`scripts/media/promo-music.py` (MIT licence, Copyright (c) 2026 Cresavo
contributors) from oscillators and noise, with no samples, loops or music
services. The click and whoosh sounds are synthesized as well.
