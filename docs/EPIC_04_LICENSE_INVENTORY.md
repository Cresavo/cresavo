# Epic 04 — ändrade beroenden

2026-11-12. Bara nya poster jämfört med10175ed. Inga tredjepartsfiler kopieras till Git; egen kod kvar AGPL-3.0-only. Se THIRD_PARTY_NOTICES och ADR004 för native-/distributionsbegränsningar.

| Paket | Version | Låsfilens licens | Verifieringsnivå |
| --- | --- | --- | --- |
| @node-rs/argon2 | 2.2.2 | MIT | Wrapper, LICENSE läst |
| @node-rs/argon2-android-arm-eabi | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-android-arm64 | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-darwin-arm64 | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-darwin-x64 | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-freebsd-x64 | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-linux-arm-gnueabihf | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-linux-arm64-gnu | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-linux-arm64-musl | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-linux-x64-gnu | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-linux-x64-musl | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-win32-arm64-msvc | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-win32-ia32-msvc | 2.2.2 | MIT | Valfritt plattformspaket i låsfil; ej installerat här |
| @node-rs/argon2-win32-x64-msvc | 2.2.2 | MIT | Installerad Windowsbindning, metadata läst |

Root-MIT är kompatibel med att använda paketet i vår AGPL-applikation; behåll originallicenser. Ingen full licensklarering av framtida binär/container påstås. Ingen Better Auth-dependency tillkom. Audit: full7moderate/0high, prod0, separat Argon2-probe0.

Oberoende QA körde dessutom Linux x64 GNU2.2.2. Metadata MIT men ingen egen LICENSE-fil; delvis observerade länkade crates ersätter inte komplett käll-/notisinventering. Se QA-REPORT-epic04-3419973 och THIRD_PARTY_NOTICES. Inget binär-/containerpaket är distributionsklarerat.
