# Epic 01 – slutförd QA batch 3

## Slutgodkännande efter dc15023

Epic 01 är **avslutad som lokal POC** enligt Booking Lab QA:s lästa slutrapport `QA-REPORT-epic01-dc15023.md`. M2/L9/L8 godkända, inga nya fynd eller regressioner. CI 43114326682 har fyra gröna E2E-jobb; endast känd audit är röd. Detta ersätter äldre uppgifter nedan om väntande extern CI och slutgranskning. [Slutstatus, rapporterade QA-resultat och backlogg](PROJECT_STATUS.md).

Epic 02: GO för fortsatt planering, inget nytt arbete startat. Pilot: NO-GO av fem dokumenterade skäl. Ingen ny fixomgång eller demo behövs. Denna ändring är enbart dokumentation; inga tester har körts på nytt. Ingen merge eller push görs med avslutningsnoteringen.

## Tidigare verifiering och arbetsomgångar

## Uppföljning M2/L8 och CI – 2026-11-11

Kod **01e80ed**, bas **8b83a40**. Bokningsförsök låses per anställd/dag före tillgänglighetsläsning; strukturerade insert-konflikter ger befintligt domänfel. IPv6-proxynät som också litar på IPv4 nekas. Tre historiska migrationer och exclusion bevarade. CI är konfigurerat för fyra E2E-lägen; extern körning återstår tills push godkänns.

Verifierat lokalt: 28/28 unit, 18/18 integration fem gånger, totalt 100 stressomgångar à20 anrop med en framgång/omgång, <2 s/omgång och 0 överlapp/deadlocks. Alla fyra E2E-lägen 8/8, lint/tsc/build och cleanup PASS; slutdatabas 0 bokningar/0 kampanjer/0 sessioner. [Exakta kommandon, resultat och begränsningar](VERIFICATION.md).

Ingen ny demo enligt produktägarens beslut; senaste inspelning avser äldre kod. Ingen push/merge eller Epic 02-funktion. Visa e-post fortsatt undantagen. Audit omkördes inte; senast 3 high/7 moderate. Pilot fortsatt NO-GO av tidigare skäl. Nästa steg: oberoende kontroll av M2/L8, fyrfälts-CI efter godkänd push och därefter beslutad Epic 02. Inga observerade regressioner i sluttester.

## Historik före denna uppföljning

Beställning: bas 056d0c2, punkter 1–5 och små förbättringar i punkt 6. Kod a364bda. Visa e-post fortsatt undantagen. Lokala commits utan push/merge. Inga subagenter, inga nya produktfunktioner/beroenden/migrationer.

1. Loginspärr före lösenord och negativa samtidighetstester klara.
2. Proxyvarning, striktare nät och IPv6-/64 klara.
3. Begränsad sessionsgallring och fixture-städning klara.
4. Test-/demovakt och demo-/versionsdokumentation korrigerade.
5. Ren installation, ny isolerad PostgreSQL och full testmatris PASS; audit oförändrat FAIL.
6. Produktionsdemo från ren commit a364bda PASS; aktuell handoff/status/resultat dokumenterade.

Tidigt eget E2E-körfel rättades genom att köra hela matrisen sekventiellt. Nästa åtgärd är oberoende QA, inte Epic 02 eller pilot. [Verifiering](VERIFICATION.md).

## Historik före batch 3

# Epic 01 – arbetsplan

## Slutförd QA batch 2, bas b000481

Beställaren godkände punkterna 1–5 och 7–11, undantog punkt 6. Kod a84e48a, lokala commits utan push. En QA-omgång i taget mot ny isolerad PostgreSQL; inga subagenter eller parallella testserverkörningar.

Socket-/proxygräns, dagstak, sessionsåterkallelse, adminfilter, kampanjmeddelanden, full produktions-E2E, MCP-miljö, timeout-städning, UI-idempotens och datum/header-UX levererade. Gamla migrationer/exclusion och låsfil bevarade. 20 unit, 16 integration, åtta E2E i fyra lägen, lint/tsc/build och ren produktionsdemo PASS. Audit kvar röd. Ingen Epic 02. Aktuell output och kvarstående grindar finns överst i VERIFICATION/HANDOFF/PROJECT_STATUS; nedan är tidigare arbetsomgångar.

## Slutförd QA-fixbatch (inte ny Epic), bas ed1658a

1. Bevara historisk migration; ny migration för idempotens, skapandetid och kampanjdatumkontroll.
2. Implementera missbruksskydd, sessionsversion/utloggning, begränsad adminlista, idempotens och strukturerade konfliktfel.
3. Kampanjregler, säkerhetsheaders, bekräftelse/prisformat och testdatabasgrind.
4. Regression: 20 samtidiga anrop, 150 listposter, negativa HTTP/session/kampanjfall; produktionsdemo.
5. Prettier utan nytt projektberoende, notices, separat auditjobb och framtida Prisma 7-plan.
6. Ren installation och hela sviten på ny lokal booking_qa_test, sedan aktuella resultat/handoff och lokala commits. Inget publiceras.

## Historik före QA-batchen

Efterföljande uppdrag 2026-11-11: Visual Progress & Demo Delivery färdigt. PROJECT_STATUS, DEMO och PRODUCT_OWNER_REPORT samt npm run demo:record tillagda; samma E2E-flöde återanvänds, inga produktfunktioner/beroenden. Slutlig demo 2/2, E2E 4/4, unit 8/8, integration 8/8, lint/TypeScript/build PASS. Felaktigt demo-filter och screenshot/hydration-problem korrigerades; full historik i VERIFICATION. Bilder/video och manifest är lokala och ignorerade av Git. AGENTS kräver status/demo/produktägarrapport efter kommande Epics.

Arbetsbranch: `epic-01-foundation-hardening`. Start 2026-11-11 från `2596ea6` med 10 modifierade och fyra ospårade filer. Befintliga ändringar har lästs: tidigare kodstädning, integritetsdokumentation och MCP-minimering. De bevaras som egen bascommit efter kontroll; inga hemligheter eller genererade artefakter ska ingå.

## Milstolpar

- A: verifiera MCP-kontrakt; sanera HTTP/MCP/domänfel och loggar; regressionstester.
- B: kontrollera aktuell audit och kompatibla rättningar; små sessionsförbättringar; konkret plan för individuell identitet och verksamhetsisolering.
- C: ren npm ci, Prisma generate/migrate/seed på isolerad PostgreSQL, unit/integration/desktop/mobil/tsc/lint/build; undersök kall Playwright-start; lokal CI-konfiguration.
- D: dataminimering i availability, samtidiga direkta DB-writes, kodkarta och dokumenterade mätpunkter för index/pooler.

Tre oberoende read-only-granskare granskar säkerhet, databas respektive kodkvalitet/licenser. Huvudagenten gör alla ändringar.

## Status och avgränsning

Slutförd lokalt med dokumenterade audit-risker. Docker saknas i PATH; Compose och GitHub-CI är inte verifierade. Separat lokal PostgreSQL användes utan att ändra tidigare testkluster. Inga nya produktfunktioner, extern publicering, fjärr-MCP eller riktiga kunduppgifter.

## Genomförande och commits

- `726fbce`: bevarad, genomläst MCP-/integritetsbas och tidigare kodstädning. Tidigare testhistorik finns i VERIFICATION. Inga ändringar återställdes/stashades. Git saknade identitet: första commitförsöket avvisades, därefter användes kommandolokal `Codex <codex@localhost>` utan global konfigurationsändring.
- `5b26cde`: säkra felgränser, striktare lokal session, dataminimerad availability och regressionstester.
- `d960a0d`: isolerad Playwright-server, negativa HTTP-tester och lokal CI-definition.
- Slutlig dokumentationscommit: se `git log -1`; innehåller WORKPLAN, HANDOFF och uppdaterade granskningar.

**A klar:** MCP lämnar inte kundnamn/e-post; datum, sidor och lokal adminbehörighet är testade. HTTP/MCP/SSR-dataladdning sanerar oväntade fel. Alla fyra MCP-verktyg testas med verkligt databasanslutningsfel och syntetiska läckagemarkörer. SDK:s schemafel före callback kan fortfarande spegla klientens egna indata; ingen total sekretessgaranti ges.

**B klar med risker:** audit och registry kontrollerade; ingen kompatibel rättning hittad. Inga major-uppgraderingar, overrides eller nya npm-beroenden. Sessionens format/livslängd och lösenordslängd skärpta. Konkret plan för individuella konton, återkallelse, origin/proxy och verksamhetsrelationer finns i ARCHITECTURE.

**C klar lokalt:** ren installation, ny databas och hela testkedjan körd. CI har read-only behörighet, låsta actionrevisioner och inga deploy-/artefaktuppladdningar. Audit-steget blir avsiktligt rött med nuvarande sårbarheter. CI och Docker behöver senare extern verifiering.

**D klar:** availability väljer bara tidsfält. Direkta samtidiga DB-writes och angränsande intervall testade; historiska migrationer oförändrade. Listor, relationer, index och poolbudget dokumenterade, inga spekulativa optimeringar.

Tre read-only-granskare kontrollerade säkerhet/integritet, databas/skalbarhet och kodkvalitet/licenser. Säkerhetsgranskaren läste slutdiffen utan blockerande fynd. Huvudagenten gjorde alla ändringar och körde tester. React-granskning enligt vercel:react-best-practices bekräftade bibehållen parallell dataladdning och auth före adminfrågor.

## Faktiskt körd verifiering

Windows, Node 24.16.0/npm 11.13.0. Ny PostgreSQL 18.6 via befintligt separat embedded-postgres-testverktyg, databas `booking_epic01` på loopback port 55442. Endast syntetiska uppgifter. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1 sattes före Next-/Prisma-körning.

Efter verifieringen stoppades databasen (`pg_ctl status`: no server running), hjälpprocessen avslutades och den egen skapade temporära `.env` togs bort. Testdata/traces och flyttad byggcache finns endast lokalt utanför repot. Ingen historisk migration eller tidigare testdatabas ändrades. `.env`, node_modules, .next och test-results verifierades ignorerade; inga nyckel-, databas- eller arkivfiler är spårade.

| Kommando | Resultat |
|---|---|
| npm ci | PASS, ren installation, 461 paket; ESLint 9 deprecated-varning |
| npx prisma generate | PASS, 6.19.3 |
| npm run db:migrate | PASS, historisk migration på ny databas |
| npm run db:seed | PASS |
| npm test | PASS, 8 tester |
| npm run test:integration | PASS, 8 tester; MCP och samtidiga domän-/DB-anrop |
| npm run lint | PASS |
| npx tsc --noEmit | PASS före och efter build |
| npm run test:e2e | PASS, 4 tester på desktop/mobil, varm och tom Next-cache |
| npm run build | PASS |
| npm audit / npm audit --omit=dev | FAIL, 10 respektive 3 poster; se VERIFICATION |
| git diff --check | PASS |
| Docker Compose / GitHub-CI | EJ KÖRT: Docker saknas, ingen publicering tillåten |

Workflowens YAML-syntax kontrollerades med befintliga `js-yaml`: PASS. Ett första hjälparkommando försökte använda paketet `yaml`, som inte är installerat, och misslyckades; inget beroende lades till. Syntaxkontrollen är inte en GitHub-/Compose-körning.

## Playwright-utredning

Tom Next-cache och `npm run test:e2e -- --timeout=30000`: FAIL, 2 tester. Desktop nådde timeout under page-fixture (cirka 29 986 ms); mobil hade navigation cirka 20 418 ms och förbrukade sedan totalbudgeten. Traces finns utanför repo i lokal testverktygskatalog. Detta visar miljö-/browserfördröjning men bevisar inte orsaken till den historiska page.goto-timeouten.

Första 60-sekunderskörningen med nya negativa HTTP-tester: 2 fullflöden PASS, 2 negativa tester FAIL eftersom Playwright JSON-kodade strängen som skulle varit trasig JSON. Testet rättades till Buffer med råa bytes. Därefter PASS 4/4 på 13,9 s; ny tom Next-cache PASS 4/4 på 14,8 s. Ingen ytterligare timeoutökning eller retry infördes. Belastad värd kan fortfarande orsaka instabilitet; trace vid fel och egen server förenklar felsökning. Vitests befintliga Vite-loader-varning och Playwrights färgvariabelvarning kvarstår.

## Blockerare före riktig pilot

Audit-risker, individuell autentisering/återkallelse och missbruksskydd, driftens TLS/cache/loggar/backuper, GDPR-ansvar/rättslig grund/gallring och agentmottagare måste hanteras. Flera verksamheter kräver serverhärledd kontext, relationell integritet och negativa isolationstester. Epicens lokala kriterier innebär inte produktionsgodkännande.

## Epic 01 QA fix batch – slutförd 2026-11-11

Kod 26ea617 på befintlig branch, bas ed1658a. Inga nya Epics eller beroenden. Fynd 1–13 implementerade/rapporterade, gammal migration och exclusion oförändrade. Aktuella kommandon/output, rättade fel och ej körda kontroller finns överst i [VERIFICATION](VERIFICATION.md); tidigare avsnitt här är historik. 14 unit, 14 integration, 6 E2E, lint, tsc, build PASS. Produktionsdemo 2/2 PASS. Audit kvar FAIL: 3 höga + 7 måttliga; separat märkt CI-jobb och framtida Prisma 7-plan. Docker/CI och verklig drift ej körda. [HANDOFF](HANDOFF.md) och [PROJECT_STATUS](PROJECT_STATUS.md) gäller denna batch.
