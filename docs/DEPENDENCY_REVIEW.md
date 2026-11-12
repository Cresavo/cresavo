# Beroendesäkerhet

## Audit-återkontroll 2026-11-12 — rättning blockerad av stabil upstream

Ny avgränsad genomgång från 6acd2efdb909aff86245fc021e7c0c8cbc9541d4; produktkod d7bc47f och manifest/låsfil oförändrade. UI, molnpreview och dummydata ändras inte. Arbetsbranch chore/audit-review-2026-11-12. Ingen ny dependency, override, prerelease, borttagen lintregel eller ändrad licens.

- **Full audit FAIL exit1:**7moderate,0high/critical. Det är en advisory plus sex kedjeeffekter, inte sju oberoende sårbarheter. **Omit-dev PASS exit0:**0fynd. [Rådata och exitkoder](qa/evidence-audit-2026-11-12).
- Publicerat latest typescript-eslint / typescript-estree **8.72.2** kräver minimatch **^10.2.2**; installerat10.2.6. Senaste publicerade10.x är10.2.6. [Advisoryn](https://github.com/advisories/GHSA-g3hv-75wg-m249) anger drabbade>=7.0.0 <11.0.1 och rättad11.0.1.
- Upstream [main-manifest](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-estree/package.json) har ändrats till^11.0.1. Det är inte samma sak som en publicerad stabil tarball: registry-manifest/integrity och den faktiska npm pack-tarballens package.json kräver ännu10.x (MIT, oförändrad licens). Canary8.72.3-alpha.8 använder11.x, men förhandsversion väljs inte i denna försiktiga batch.
- **npm audit fix --dry-run --ignore-scripts --json** gav0added/changed/removed och kvar7moderate trots fixAvailable:true. Flaggan är därför inte bevis för en genomförbar kompatibel rättning. Inget riktigt audit fix/--force kördes.
- Installerat useProgramFromProjectService.js anropar minimatch med {dot:true}, inte optimizationLevel>=2 som advisoryns angrepp kräver. Minimatchs default är1. Repoets ESLintkonfig importerar Next-vitals/TypeScript, ingen egen allowDefaultProject. Inga globmönster tas emot av bokningswebb/API/MCP. Detta begränsar observerad exponering men upphäver varken advisoryn eller utvecklar-/CI-risken med obetrodd konfiguration. Kör inte okänd lintkonfiguration eller okända PR-skript med hemligheter.
- **Nästa säkra rättningsgrind:** publicerad stabil typescript-eslint-kedja som stöder11.0.1+ (eller verifierad10.x-backport), riktad lockfiluppdatering inom stödda semverintervall, granska exakt paket-/licensdiff, sedan ren npm ci, generate, lint/tsc/unit/integration/build och relevant E2E. Ingen automatisk bred npm update.

Nya kontroller på oförändrad bas: lint/tsc/build PASS, unit75/75(13.80s), integration75/75(74.86s) på ny loopback booking_audit_review_test efter alla6migrationer/seed. Egna bokningar/kampanjer/admins/sessioner/spärrposter/workspaceRequests0 efteråt. **NOT RUN denna batch:**npm ci/prisma generate (ingen paketändring), E2E/fyrmatris (oförändrad kod/låsfil), ny molnverifiering/deploy, video, fysisk iPhone och ny CI. Tidigare d7-matris är historiskt underlag, inte nya körningar. Integrationstester använder endast syntetisk data. Ingen kundpilot godkänns.


## Avgränsad Vercel-previewartefakt, 2026-11-12

Historiska distributionsgrindar nedan gäller den fulla installationen. För denna
preview gör Dockerfile.vercel en separat minimal runtime-installation med
oförändrad låsfil: 53 paket, utan CLI/Studio/elkjs, sharp/libvips eller TypeScript.
Genererad Prisma-klient och exakt Linux x64 GNU Argon2-binding kopieras från
byggsteget; nativefilens SHA-256 kontrolleras i Dockerfile. Ingen ny npm-dependency.
Next-konfigurationen kompileras från den befintliga TS-källan i byggsteget.

Fulla native-licenstexter, exakt källursprung och begränsningar finns i
[THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md) och
[native-notiserna](../THIRD_PARTY_NATIVE_NOTICES.txt). 57 registry-crate-arkiv
kontrollerades mot källans Cargo.lock; MIT-alternativ väljs där tillgängligt,
ISC/Unicode-notiser bevaras. Detta är en konservativ källinventering, inte en
fullständig länkad SBOM eller godkännande för andra plattformar. Provenance-payload
lästes, men dess signatur verifierades inte kryptografiskt. Appens licens ändras
inte. Slutimagen innehåller originalnotiser och arkiv av egen motsvarande källa.

Windows-prototyp utan CLI/Studio/ELK/sharp/TypeScript klarade24E2E. Därefter
gav Grok f2fdac7 kod/paketering-GO för just privat preview, med emulerade
Linuxsteg. Codex faktiska Vercel-Buildahbygge/linux-amd64 och skyddade driftprov
PASS; exakt image/revision i VERIFICATION. Detta generaliseras inte till andra
plattformar eller publik binärrelease. Grok verifierade57crate-checksummor,
men fullständighet mot det lokalt granskade Cargo.lock var inte oberoende
verifierbar; provenance-signatur och full SBOM är fortfarande inte verifierade.
Full audit: 7 måttliga utvecklingsfynd,
0 höga/kritiska; omit-dev-audit: 0. Inga overrides eller majoruppgraderingar.

2026-11-12, bas dba05a2, kod 18a4d73. Grok har godkänt uppgraderingen som lokal POC utan blockerande fynd; inget publicerat. Detta dokument skiljer paketadvisories, faktisk användning och licensvillkor. Ett grönt audit-resultat är inte ett säkerhets- eller licensgodkännande. [Oberoende slutrapport](qa/QA-REPORT-epic03-18a4d73.md).

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

Faktiskt slut-audit på 18a4d73: full **exit 1, 7 moderate, 0 high/critical**; `--omit=dev` **exit 0, 0 fynd**. Detta betyder inte att Prisma CLI/Studio saknas i produktionsinstallation: klientens optional peer kan dra med CLI även där (`npm ls --omit=dev elkjs prisma` visade kedjan). Ingen Studio/dev-server startas av appen.

## PostgreSQL och verkliga regressioner

En gemensam `scripts/database.mjs` skapar Prisma-klienter för app, seed och test-/demoverktyg. Per klient: max 5 anslutningar, anslutning/poolväntan 5 s, inaktiv anslutning 10 s; $disconnect stänger poolen. Domänens maxWait/timeout 30 s och låsordning är oförändrade. Varje process/klient har egen budget; detta är ingen global flerinstansbudget. PG:s normala certifikatverifiering behålls, ingen rejectUnauthorized:false.

Första integrationskörningen gav **24 PASS, 1 FAIL, 5 SKIPPED**: adapterfelens SQLSTATE låg nu i P2010.meta.driverAdapterError.cause.originalCode och DST-fixturen bröt DB:s endsAt>startsAt. PostgreSQL-servern hade Europe/Paris som standard. Adapterns mapArg/formatDateTime skriver Date-värden som UTC-klockslag utan offset; en annan sessionstidszon flyttade därför instanterna. Vi tvingar nu `-c timezone=UTC` sist i anslutningens options, även när URL anger annan zon. Testet kontrollerar verklig SHOW TIME ZONE, exakta UTC-instanter via ORM och rå SQL vid båda DST-bytena. Inga testdatum eller DB-spärrar lättades. Andra körningen **31/31 PASS**. Strukturerad SQLSTATE-mappning testas för rätta koder och ett annat fel som inte får döljas.

Uppgraderingskopian är en PostgreSQL-template-kopia av vår föregående Epic 02-testdatabas på 55448, med tre egna syntetiska Booking/Campaign/AdminSession-fixturer. Prisma 7 migrate deploy gav inga väntande migrationer; läsningar bevarade datum och fält, en ORM-uppdatering behöll exakt UTC-epoch över DST. **UPGRADE_COPY_PASS**, egna fixturer borttagna i båda databaser. Första försök med pg_dump/pg_restore kördes inte: de binärerna saknas i embedded-paketet, proben gav exit 1 och städade sina fixturer. Template-metoden verifierar databaskopian, inte en logisk backup/återställningsrutin.

En riktad extern driverprobe tvingade även verkliga SQLSTATE **40P01 och 40001** vid insert via temporärt skapad testtrigger i varsin återställd transaktion. Båda gav samma säkra DomainError/status400, och 0 triggerrester blev kvar. Inga produktmigrationer eller regler ändrades. Proben behövde först byta från .ts i verktygskatalogens CJS-kontext till .mts; första försöket gav TransformError före dataåtkomst. Godkänt resultat i epic03-conflict-probe-mts.log. Slutlig dataräkning/deadlocks är fortsatt separat kontrollerad.

## Licenser och distributionsgräns

Faktiska installerade LICENSE-filer för @prisma/client, prisma, @prisma/adapter-pg och @prisma/driver-adapter-utils innehåller **Apache-2.0**; pg och postgres-array **MIT**. Dessa komponenter kan användas med vår AGPL-3.0-only-kod med bibehållna notices enligt tidigare licensbeslut. Ingen upstream-kod har kopierats in i applikationen.

[Inventering av 129 nya/ändrade paketposter](EPIC_03_LICENSE_INVENTORY.md) jämför låsfiler och listar deklarerade licenser och rotfiler. Inventeringen innehåller Apache/MIT/ISC/BSD/Unlicense samt **elkjs 0.11.1 EPL-2.0** via Prisma → Studio. Faktisk LICENSE.md och elk.bundled.js kontrollerades: EPL-2.0, ingen konkret secondary-license-notis verifierad; generiska Exhibit A ger inte en sådan rätt. Vi påstår därför **inte** att EPL-koden får kombineras med vår AGPL-kod. Det används som oförändrad separat Prisma CLI/Studio-verktygskomponent, inte importerat i bokningsappen; ingen EPL-kod kopieras eller relikensieras. Ingen ny CLI-tjänst införs. [EPL-villkor](https://www.eclipse.org/legal/epl-2.0/) och [GNU om separata program/aggregat](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation).

Ingen distribution av node_modules, binärer eller container görs. Före sådan leverans: fastställ exakt artefakt, uteslut onödigt CLI/Studio där det kan göras med stödda installationsvägar, verifiera faktisk koppling och separat distribution samt uppfyll EPL:s källkods-/noticekrav. Licensinventeringen är ingen full granskning av alla bundlade filer; @prisma/dev anger ISC men saknar separat LICENSE i paketrot. Paketens originallicenser/notices och eventuella källkodserbjudanden måste bevaras/verifieras inför release. Saknad kontroll stoppar den leveransen; den ger ingen rätt att anta fri relikensiering. Tidigare sharp/libvips- och caniuse-notiser kvarstår.

Byggbevis på 18a4d73: de tio .next/server/*.nft.json-spårningsfilerna gav **0 referenser** till elkjs, @prisma/studio eller prisma/build. Detta stödjer bedömningen att verktyget inte är en del av det byggda appanropsträdet, men är inte en full licens-/distributionsklarering av en framtida image.

## Rollback och kvar

### Oberoende slutkontroll

Grok verifierade 51 unit, 31 integration ×3 och 12 E2E ×4 i egen Linux-miljö, svensk server-/Node-zon och extra unit/integration i New York. Dess riktiga Prisma 6→7→6-probe bevarade tidigare och nya data runt fyra DST-dagar. 220 blandade omgångar/4 400 anrop och poolbelastning gav 0 serverfel/överlappar och 0 deadlocks i **produktens låsta bokningsväg**. Dessa är QA:s rapporterade körningar, inte Codex extra tester.

E03-QA-1: testet med två direkta ORM-writes som avsiktligt kringgår bokningslåsen kan ge en förväntad PostgreSQL-deadlock där en transaktion avvisas. QA såg 4 sådana efter extra repetitioner; alla tester passerade och ingen dubbelbokning uppstod. Vår observerade lokala räknare 0 är ett körresultat, ingen garanti om globalt 0 under direkta writes. Dokumentation/testprecisering kan göras senare; inga produktlås eller tester mildras för att dölja detta. Kravet 0 deadlocks gäller produktvägens stressprober.

E03-QA-2 kvarstår som medium pilot-/distributionsgrind: CLI/Studio/elkjs finns även i produktionsinstallation. Ingen generell licensklarering följer av inventeringen. E03-QA-3: minimatch-rättningen finns i typescript-eslint-canary men ingen stabil version verifierad; ingen förhandsversion införs. E03-QA-4: första frågan efter avsiktligt dödade poolanslutningar kan fela en gång före återanslutning; ingen blind transaktionsretry införs. E03-QA-5: MCP:s pooluppvärmning påverkar kapplöpningens starttid, inte korrektheten. Den specifika .env-autoladdningen (E02-QA-2) är verifierat löst; OS-isolering återstår.

Eftersom ingen migration eller tabell ändrats sker kodrollback genom att återgå till dba05a2:s kod/manifest/låsfil och köra npm ci + prisma generate. Ingen återställning av kunddata behövs för schemaändring i denna batch; återgång över skarpa samtidiga skrivningar/backup har inte verifierats och ingen pilot är godkänd. Slutmatris och QA dokumenteras i VERIFICATION/HANDOFF efter körning. Kvarstående audit ska inte döljas eller flyttas till allowlist.
`nGroks oberoende [originalrapport](qa/AUDIT-REPORT-6acd2ef-minimatch.md), SHA256 dd7fa61626a3d76aefb913fbf0286c1033375cf36169afc8c11837d844033409, bekräftar ingen publicerad stabil rättning och avråder från canary/major-override. Grok körde egen npm pack/registry/anropsgranskning samt en override-probe endast i egen kopia (lint/tsc/audit grönt där, ändå inte rekommenderad). Ingen override infördes här. Grok läste inte nya PC-auditfiler och körde inte vår slutmatris. Manifestets radslut skiljer i gamla arkivet; normaliserat innehåll och låsfilshash matchar. Ompröva vid nästa stabila upstream-release eller senast 2026-11-26; ingen ny bevakningstjänst skapas.
