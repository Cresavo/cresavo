# Epic 03 — beroendesäkerhet

2026-11-12, bas dba05a2. Kandidat under verifiering; inget publicerat. Detta dokument skiljer paketadvisories, faktisk användning och licensvillkor. Ett grönt audit-resultat är inte ett säkerhets- eller licensgodkännande.

## Beslut

Matchande **prisma/@prisma/client/@prisma/adapter-pg 7.10.1** låses exakt. Adaptern är det enda nya direkta runtimeberoendet och är nödvändig för Prisma 7:s PostgreSQL-anslutning. Dess pg-driver används transitivt; appen importerar inte pg direkt. Inget nytt env-bibliotek läggs till. CLI:t drar dock med sig ett större Studio/dev-beroendeträd: ren npm ci installerade 568 paket jämfört med QA:s 462 före uppgraderingen. Detta är en faktisk underhållskostnad, inte en förenkling av hela verktygskedjan.

Vi behåller den fortfarande fungerande `prisma-client-js`-generatorn och importerna från @prisma/client för att begränsa ändringen, med adapter även för den generatorn. Framtida borttagning av denna generator kräver separat byte till explicita genererade källor; inga genererade filer checkas in. `type:module` följer v7:s ESM-inriktning. Schemafält/tabeller och samtliga historiska migrationer är identiska; endast datasource-URL har flyttats till CLI-konfiguration.

`prisma.config.ts` laddar uttryckligen .env för CLI om filen finns och använder Node:s inbyggda loadEnvFile. Exporterade miljövärden prioriteras. Runtime/MCP importerar inte konfigurationen; klientfabriken kräver uttrycklig DATABASE_URL och laddar ingen .env. Detta avhjälper den tidigare Prisma-autoladdningen, men är fortfarande inte OS-processisolering eller behörighet för externa agenter.

## Advisory-bedömning

| Kedja | Före | Kandidat / beslut |
| --- | --- | --- |
| prisma → @prisma/config → deepmerge-ts | 3 high i audit; deepmerge-ts 7.1.5 | Prisma 7.10.1 använder deepmerge-ts 8.0.2. Kandidatens fulla audit har 0 high; egen Prisma-probe hade 0 samtliga. |
| eslint-config-next → typescript-eslint → minimatch | 7 moderate, minimatch 10.2.6 | Kvar. Latest typescript-eslint 8.72.2 kräver ^10.2.2; rättningen är i minimatch 11.0.1. Ingen upstream-kompatibel rättad kedja verifierad. E03-3 blockerat av upstream, ingen major-override eller borttagna lintregler. |

[deepmerge-advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): kraschen kräver cykliska objektgrafer; vanlig JSON skapar inte detta själv. Kodgranskningen hittade ingen direkt användning i bokningsdomänen. Detta begränsar den observerade anropsytan men ersätter inte rättningen.

[minimatch-advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249): resursförbrukning vid angriparkontrollerade globmönster/optimering. Appen tar inte emot globmönster; kedjan är lintverktyg. Fynden lämnas synliga i full audit och CI. Det finns ingen generell garanti att en utvecklar-/CI-installation är opåverkbar. ESLint 9.39.5 ger dessutom deprecation-varning; framtida ESLint-major kräver Next-konfigens kompatibilitet.

Preliminärt faktiskt audit: full **exit 1, 7 moderate, 0 high/critical**; `--omit=dev` **exit 0, 0 fynd**. Detta betyder inte att Prisma CLI/Studio saknas i produktionsinstallation: klientens optional peer kan dra med CLI även där (`npm ls --omit=dev elkjs prisma` visade kedjan). Ingen Studio/dev-server startas av appen.

## PostgreSQL och verkliga regressioner

En gemensam `scripts/database.mjs` skapar Prisma-klienter för app, seed och test-/demoverktyg. Per klient: max 5 anslutningar, anslutning/poolväntan 5 s, inaktiv anslutning 10 s; $disconnect stänger poolen. Domänens maxWait/timeout 30 s och låsordning är oförändrade. Varje process/klient har egen budget; detta är ingen global flerinstansbudget. PG:s normala certifikatverifiering behålls, ingen rejectUnauthorized:false.

Första integrationskörningen gav **24 PASS, 1 FAIL, 5 SKIPPED**: adapterfelens SQLSTATE låg nu i P2010.meta.driverAdapterError.cause.originalCode och DST-fixturen bröt DB:s endsAt>startsAt. PostgreSQL-servern hade Europe/Paris som standard. Adapterns mapArg/formatDateTime skriver Date-värden som UTC-klockslag utan offset; en annan sessionstidszon flyttade därför instanterna. Vi tvingar nu `-c timezone=UTC` sist i anslutningens options, även när URL anger annan zon. Testet kontrollerar verklig SHOW TIME ZONE, exakta UTC-instanter via ORM och rå SQL vid båda DST-bytena. Inga testdatum eller DB-spärrar lättades. Andra körningen **31/31 PASS**. Strukturerad SQLSTATE-mappning testas för rätta koder och ett annat fel som inte får döljas.

Uppgraderingskopian är en PostgreSQL-template-kopia av vår föregående Epic 02-testdatabas på 55448, med tre egna syntetiska Booking/Campaign/AdminSession-fixturer. Prisma 7 migrate deploy gav inga väntande migrationer; läsningar bevarade datum och fält, en ORM-uppdatering behöll exakt UTC-epoch över DST. **UPGRADE_COPY_PASS**, egna fixturer borttagna i båda databaser. Första försök med pg_dump/pg_restore kördes inte: de binärerna saknas i embedded-paketet, proben gav exit 1 och städade sina fixturer. Template-metoden verifierar databaskopian, inte en logisk backup/återställningsrutin.

## Licenser och distributionsgräns

Faktiska installerade LICENSE-filer för @prisma/client, prisma, @prisma/adapter-pg och @prisma/driver-adapter-utils innehåller **Apache-2.0**; pg och postgres-array **MIT**. Dessa komponenter kan användas med vår AGPL-3.0-only-kod med bibehållna notices enligt tidigare licensbeslut. Ingen upstream-kod har kopierats in i applikationen.

[Inventering av 129 nya/ändrade paketposter](EPIC_03_LICENSE_INVENTORY.md) jämför låsfiler och listar deklarerade licenser och rotfiler. Inventeringen innehåller Apache/MIT/ISC/BSD/Unlicense samt **elkjs 0.11.1 EPL-2.0** via Prisma → Studio. Faktisk LICENSE.md och elk.bundled.js kontrollerades: EPL-2.0, ingen konkret secondary-license-notis verifierad; generiska Exhibit A ger inte en sådan rätt. Vi påstår därför **inte** att EPL-koden får kombineras med vår AGPL-kod. Det används som oförändrad separat Prisma CLI/Studio-verktygskomponent, inte importerat i bokningsappen; ingen EPL-kod kopieras eller relikensieras. Ingen ny CLI-tjänst införs. [EPL-villkor](https://www.eclipse.org/legal/epl-2.0/) och [GNU om separata program/aggregat](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation).

Ingen distribution av node_modules, binärer eller container görs. Före sådan leverans: fastställ exakt artefakt, uteslut onödigt CLI/Studio där det kan göras med stödda installationsvägar, verifiera faktisk koppling och separat distribution samt uppfyll EPL:s källkods-/noticekrav. Licensinventeringen är ingen full granskning av alla bundlade filer; @prisma/dev anger ISC men saknar separat LICENSE i paketrot. Paketens originallicenser/notices och eventuella källkodserbjudanden måste bevaras/verifieras inför release. Saknad kontroll stoppar den leveransen; den ger ingen rätt att anta fri relikensiering. Tidigare sharp/libvips- och caniuse-notiser kvarstår.

## Rollback och kvar

Eftersom ingen migration eller tabell ändrats sker kodrollback genom att återgå till dba05a2:s kod/manifest/låsfil och köra npm ci + prisma generate. Ingen återställning av kunddata behövs för schemaändring i denna batch; återgång över skarpa samtidiga skrivningar/backup har inte verifierats och ingen pilot är godkänd. Slutmatris och QA dokumenteras i VERIFICATION/HANDOFF efter körning. Kvarstående audit ska inte döljas eller flyttas till allowlist.
