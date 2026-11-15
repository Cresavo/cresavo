# Epic 03 — beroendesäkerhet, avgränsad lokal uppgradering

Slutstatus 2026-11-12: **godkänd som lokal POC** på 18a4d73 efter full lokal och oberoende Grok-matris. E03-0–2/4–6 uppfyllda; E03-3 dokumenterat upstreamblockerat (7 moderate kvar, ingen stödd stabil rättning). Inga blockerande nya produktfynd; pilot/distribution NO-GO. [Original-QA](qa/QA-REPORT-epic03-18a4d73.md), [faktiska resultat](VERIFICATION.md), [morgonrapport](MORNING_REPORT.md).

Arbetsinriktning 2026-11-12 efter produktägarens uppdrag att fortsätta med Epic 03 när Epic 02 är klar. Beroendesäkerhet valdes som minsta fristående pilotblockerare; inga nya produktfunktioner. Epic 02 måste först få sin slutbedömning. Ingen push, merge, deploy eller riktig kunddata.

## Acceptanskriterier och små steg

| ID | Uppgift | Observerbart klart-kriterium |
| --- | --- | --- |
| E03-0 | Frys Epic 02, separat lokal branch, läs aktuell audit och upstream | Ren bas/revision dokumenterad; varje advisory kopplad till verklig beroendekedja, rättad version och begränsning. |
| E03-1 | Bedöm Prisma 7.10.1 och PostgreSQL-adaptern | Matchande CLI/klient/adapter, faktiska licensfiler och nya transitiva paket inventerade; pool/anslutningstimeout och explicit miljöladdning beslutade. Ingen blind major-override. |
| E03-2 | Minsta verifierbara Prisma-uppgradering | Samma SQL, historiska migrationer, schemafält, HTTP/MCP-kontrakt och låsordning. Nya nödvändiga adapterberoenden motiverade. Inga produkttabeller eller migrationsändringar. CLI/generering/seed/start fungerar. |
| E03-3 | ESLint/minimatch | Uppgradera endast med upstream-kompatibel deklarerad kedja. Om rättad version kräver osupporterad major-override: dokumentera kvarvarande fynd och blockera delsteget. Ta inte bort lintregler eller audit för att få grönt. |
| E03-4 | Ren installation och databasregression | npm ci, generation, tre oförändrade migrationer på ny isolerad *_test och uppgraderingskontroll mot tidigare schema; unit/integration ×3, tvångskonflikt, idempotens, 20-parallell och HTTP/MCP utan överlapp/serverfel. |
| E03-5 | Slutmatris och oberoende QA | lint/tsc/build, E2E dev/prod × proxy 0/1, cleanup, full/prod audit med exakta exitkoder. Grok kontrollerar fryst revision i egen miljö; endast konkreta regressioner/blockerade kriterier rättas. |
| E03-6 | Handoff och rollback | Uppdaterade notices/startsteg/status/morgonrapport. Visa oförändrade migrationer och återgång till Epic 02-kod/låsfil utan DB-återställning. Ingen ny demo behövs för osynlig dependencyändring; senaste Epic 02-demo länkas som äldre kod. |

## Beslut och begränsningar

- Ingen `npm audit fix --force`, major-override, förhandsversion eller Prisma 8. Prisma 7 är en avsiktlig separat migrering enligt befintlig PRISMA_7_PLAN, inte en automatisk versionshöjning.
- Befintliga Node 24/TypeScript uppfyller v7:s minimikrav. Bevara TLS-certifikatverifiering; använd aldrig rejectUnauthorized:false. Lokal loopback-testning bevisar inte riktig TLS.
- PostgreSQL-driveradapter krävs av v7. Lägg endast till den adapter/driver som faktiskt används; ingen ny env-loader behövs om Node:s befintliga --env-file används. Granska faktiska paket före beslut om behållande.
- En anslutningspool per Prisma-klient, tydligt begränsad. Undvik hängande anslutning med explicit timeout och behåll domänens befintliga transaktionsgränser. Rå PostgreSQL SQLSTATE kan få annan strukturerad felrepresentation i v7; testa verklig exclusion, inte strängmatchning.
- Explicit miljöladdning ska ta bort Prismas oavsiktliga .env-autoladdning. Detta är fortfarande inte OS-processisolering eller säker fjärr-MCP.
- Audit ska alltid vara synlig och får vara FAIL med exakta kvarvarande fynd. Pilot kräver fortsatt individuell admin/GDPR/riktig driftverifiering/beslut om kundkontakt.
- Större oförklarade kontrakts-/säkerhetsregressioner stoppar uppgraderingen. Behåll forskningsunderlag separat; beskriv inte en misslyckad kandidat som färdig Epic.

## Källor kontrollerade inför arbetet

- [Prisma v7-guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7): adapter, ESM, miljöladdning, generator och poolskillnader.
- [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): deepmerge-ts före 8.0.0, rekursiva objektgrafers stackuttömning. Vanlig JSON skapar inte själv cykler.
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): minimatch >=7 <11.0.1; användarkontrollerade globmönster kan orsaka resursförbrukning.
- npm-registret 2026-11-12: Prisma 6 slutar vid 6.19.3; audit föreslår 7.10.1. typescript-eslint 8.72.2 deklarerar minimatch ^10.2.2, eslint-config-next 16.4.6 är latest. Därför finns ännu ingen verifierad kompatibel minimatch-fix i denna kedja.
