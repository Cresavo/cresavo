# Aktuellt arbete — Epic 05 bokningsarbetsyta

Start 2026-11-12. Godkänd plan5c9b07a på origin/epic-05-booking-workspace, verifierad föregångare26b680d. Arbetskopian var ren, endast en registrerad worktree; inga befintliga processer stoppas. Codex är enda skrivare. Separat agent gör endast läsande kontraktsgranskning. Ingen ny QA av oförändrad Epic01–04.

| Del | Faktiskt läge |
| --- | --- |
| E05-0 | Plan/roadmap/AGENTS lästa, rätt branch hämtad och vald; inga nyare remotecommits än5c9b07a vid start. |
| E05-1 | Domän/schema, adminvyer/API och lokal MCP implementerade. Pris/längd/snapshot och schemaändringar verifierade; slutinstallation/uppgraderingskopia/Grok återstår. |
| E05-2 | Domän och UI/API/MCP för atomär flytt/avbokning implementerade. Retry/stale och blandad HTTP/MCP-konkurrens testade. |
| E05-3 | Implementerad desktop dag/vecka och mobil lista med detalj-/inställningsvyer.20/20 E2E i alla4lägen PASS, inklusive manuella boknings-/utkast-/nätverksfall. Slutdemo/fysisk mobil/Safari ej verifierade. |
| E05-4 | Implementerad och delverifierad:68unit/64integration,22prod-E2E samt stärkt race2/2. Separat opt-in, kundfria svar och sju operatörsbekräftelser. Slutmatris på ren installation återstår. |
| E05-5 | Läsande inventering: ansluten Vercel-Pro-workspace finns men inget Booking Lab-projekt bland dess länkade projekt; ingen lokal Vercel-/Fly-/Railway-konfiguration i repot. Leverantörs-/runtimebedömning och konkret åtkomst/region/backup/kostnadsförslag återstår. Ingen resurs skapad eller deploy godkänd. |
| QA/demo/leverans | Inte påbörjad; sammanhängande kandidat fryses först efter implementation och egna kontroller. |

## Skärmstruktur

### MCP-delkontroll 2026-11-12

Nya arbetsyteverktyg och separat --allow-workspace implementerade med officiell befintlig SDK, samma domänfunktioner/lås och safeToolSchema. Inga nya beroenden/migrationer. GetStaff är en scope-avgränsad gemensam läsning; listServices begränsas till samma50resurser som konfigurationsskrivning. Äldre list_bookings behåller svarstyp men använder snapshots och enbart confirmed; det nya list_workspace_bookings har status/version, kundfria fält och samma paginerade kalenderlogik som UI. Komplett personalkonfiguration är en explicit bounded read för säker ersättning av max60datumundantag; vanlig schemaläsning ger bara önskat31dagarsfönster.

Faktiska kommandon på samma isolerade config2_test: npm run lint PASS utan varningar; npx tsc --noEmit PASS; npm test68/68(11filer,9.50s); npm run test:integration64/64(15filer,57.04s); npm run build PASS. E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e22/22 PASS(2.2m), därefter två stärkta assertions för racets förlorande konflikt. Riktad återkontroll av samma test med --grep 'HTTP och lokal MCP delar':2/2PASS(40.5s) desktop/mobil. Ingen full fyrfältsmatris för denna nya MCP-kod ännu; UI-delens tidigare20×4 gäller66f2796.

Testfallen omfattar separat flagga/kvothemlighet, okända/främmande resurser, för breda datum/limit, kundfria svar, snapshot-längd/pris,20identiska flytt-retries, ändrad payload, stale-version, avbokad status, schemaläsning jämfört med komplett konfiguration och20blandade anrop. Verklig HTTP/MCP-flytt/avbokning:exakt1vinnare, kontrollerad400/409 och0överlappar. Samtliga4nya skrivverktyg testas via stdio för saknad/falsk confirmed, saknad request-id och okänt fält, utan nya ledger- eller bokningsändringar. Scriptad CLI-probe kräver7ja; första nej/EOF och partiellt ja→EOF/nej bevarar bara redan bekräftade ändringar. Ingen manuell mänsklig operatör eller fysisk mobil påstås verifierad.

Tidiga fel: tsc krävde NODE_ENV i de två nya testernas spawn-miljö (Nexts globala ProcessEnv-typ). Första fulla integrationskörningen57/59 hade två5s-timeouter i oförändrade admin-CLI-test; isolerad3/3PASS följdes av59/59,60/60och slutlig64/64PASS. Inga testgränser sänktes. Läsande intern delgranskning hittade ingen konkret blockerande kodbugg men två täckningsluckor, båda kompletterade enligt ovan. Detta är inte Groks slut-QA och startar ingen ny full foundationgranskning.

Extern slutprobe efter test: booking/event/requestledger/session/admin/campaign=0,service/staff=2/2,activeOverlaps0, databaseDeadlocks0; endast probens1anslutning. Alla originalutdata lokalt i booking-lab-pg-test/epic05-mcp-*.log. Återstår: ren npmci/generate och ny sluttest-DB, verifierad uppgraderingskopia4→5, full slutmatris, produktionsdemo/provguide, konkret previewförslag och fryst Grok-QA. Ingen implementationpush gjord.

### Avgränsad CI-kostnadsändring, 2026-11-12

Ny styrning från produktägaren tillämpas på aktuell Epic05-branch; den historiska Epic01-listan återimplementeras inte påb000481. Befintlig produktkod66f2796 och godkännanden bevaras. Visa kund-e-post införs inte genom den gamla listan; tidigare scopebeslut gäller i väntan på förtydligande. Underlagets /workspace/ci-savings/booking-lab-verify.patch och README finns inte på denna Windowsvärd; ingen påstådd läsning/applicering av den patchen. Ändringen bygger på den uttryckliga sexpunktsbeställningen och faktisk workflow.

- Verify POC ignorerar docs/** och **/*.md vid push/PR, kör dev/proxy0 på feature och hela4 på main/workflow_dispatch. Samma-repo PR-jobb hoppas över eftersom push redan körs; fork-PR verifieras. Concurrency avbryter äldre körningar per ref/PR utom main.
- npm-cache via setup-node; endast Playwright-binärer cachas med OS/arkitektur/låsfil som exakt nyckel, aldrig node_modules/.env/authdata. Linux systempaket installeras fortsatt varje körning. Playwright rekommenderar normalt inte browsercache eftersom återställning kan kosta lika mycket som nedladdning; ingen garanterad tidsvinst påstås. Ny cache-actionv5 är SHA-pinnad, dess MIT-LICENSE läst; inget npm-beroende tillagt.
- Separat dependency-audit.yml schemalägger måndag06:00 Europe/Stockholm med GitHubs IANA-tidszonstöd. Full npm audit behåller sitt röda step-utfall via explicit continue-on-error och visas i jobbsammanfattning; npm audit --audit-level=high avgör veckojobbets status. Detta är operativ prioritering, inte löst moderate eller pilot-GO. Manuellt auditstöd finns. Schemat är INTE aktivt på featurebranch och kräver att workflow senare finns på main; ingen merge görs.
- Senast läst faktisk Actions:43181684018 på5c9b07a, alla4E2E PASS, endast dependency-audit FAIL. Uppgiften om10samtliga tidigare runs har inte oberoende räknats om här. Nya workflowen är inte pushad eller körd på GitHub.

Lokal verifiering: officiell actionlint1.7.12 Windows-amd64, release-ZIP SHA2566e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9 verifierad mot GitHubs releasedigest; actionlint -color PASS exit0 för båda filer. Körning sker med externt QA-verktyg, ingen appinstallation eller låsfil ändrad. Shellcheck/GitHub-runner/Docker-runtime för nya workflowen NOT RUN. Ingen ny produktkod eller DB-migration: npmci/generate/migrate/seed, produktmatris och demo körs inte om för enbart CI-policy; föregående verkliga UI-matris gäller fortsatt66f2796.

Audit omkörd: npm audit --json FAIL exit1,7moderate/0high/0critical; npm audit --audit-level=high --json PASS exit0 med samma7moderate; npm audit --omit=dev --json PASS exit0,0fynd. Stabil typescript-eslint8.72.2 använder fortfarande typescript-estree8.72.2 → minimatch^10.2.2. Senaste10version är10.2.6; audit anger>=7 <11.0.1 som sårbart, aktuell senaste11.0.8 ligger utanför stödd range. Ingen major/override eller canary införs.

Acceptans ej bevisad externt: docs-push ger0runs, feature tar≤5min, manuell/main kör4gröna samt schemalagd audit körs. Dessa kräver framtida tillåten push och default-branchaktivering, inte lokala påståenden. Fram till dess är ändringen lokalt syntaxkontrollerad.

Primärkällor: [GitHub workflowfilter/tidszoner](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Playwright om browsercache](https://playwright.dev/docs/ci#caching-browsers), [pinnad cache-LICENSE](https://raw.githubusercontent.com/actions/cache/caa296126883cff596d87d8935842f9db880ef25/LICENSE). Registry- och auditfrågor körda2026-11-12.

### UI/API-delkontroll 2026-11-12

Slutkontroll för denna del efter datumfält och testväljarfix:20/20 E2E i samtliga4lägen, prod/proxy0=1.5m,prod/proxy1=45.3s,dev/proxy0=2.1m,dev/proxy1=1.8m. Samma60s testtimeout och alla assertioner kvar. Slutaggregat via extern epic05-aggregate.mjs: booking0,bookingEvent0,workspaceRequest0,adminSession0,adminUser0,campaign0; endast2seedtjänster/2seedpersonal; activeOverlaps0 och databasens deadlockräknare0. Inga kvarvarande testposter. Git-diff för beroenden och migrationer mot66e2a4d är tom.

Fulla tidigare prodkörningar17/20 respektive18/20 är bevarade i loggarna: först en fixtureanslutningstimeout före bokningsanrop och två tvetydiga länkväljare, därefter två väljare som även hittade Nexts route-announcer-alert. Korrigerat till avsedd länk och appens main-alert, utan borttagna kontroller. Därefter manuell bokning2/2 och full fyrfältsmatris20/20 vardera. De tidiga dev-startproblemen reproducerades inte i slutmatrisen; inga generella startgarantier härleds från detta.

Arbetskod efter backendcommit66e2a4d (ännu ej fryst slutkandidat): npm test65/65 PASS(8.72s); npm run test:integration53/53 PASS(62.76s),13filer. Inkluderar 150 syntetiska kalenderbokningar,100+50-paginering, datum/företag/status och bevarade utelämnade konfigurationsfält. Lint och npx tsc --noEmit PASS. Produktionsbuild PASS. Med E2E_PRODUCTION=1: npm run test:e2e -- tests/e2e/workspace.spec.ts gav4/4 PASS(1.7m), full skapa/ändra-schema/flytta/avboka plus negativa admin-API-fall på desktop/mobil. Ett ytterligare manuellt boknings-/nätverks-/utkasttest och konsekventa datumfält tillkom därefter och är under ny verifiering;4/4 gäller den tidigare UI-revisionen, inte dessa ändringar.

Två tidiga dev/desktopkörningar FAIL60s vid första sidladdning/tidsval. Trace visar att första sidladdning/webbläsarstart förbrukade tidsbudgeten; ingen timeout eller kontroll sänktes. Dev/mobil PASS21.9s. Produktionskörning ovan lyckades på båda. Full dev/prod×proxy-matris återstår, därför är dev-startproblemen inte deklarerade slutligt lösta. Riktiga produktionsbilder togs och kalenderbilderna granskades visuellt; artefakter ligger lokalt i test-results och är preliminära, inte den slutliga Epic-demon. Inga beroenden tillagda, ingen push/Grokbeställning gjord.

Desktop: Kalender som huvudvy → datum/idag/föregående/nästa, dag/vecka och personalfilter → tidsskala med bokningsblock. Ny bokning öppnar ett fokuserat formulär. Bokningsblock öppnar detaljvy med Flytta/Avboka. Inställningar innehåller Tjänster och Personal/tider, kampanjflödet finns kvar i separat vy. Mobil visar dag och kronologiska bokningskort, samma primära handlingar utan horisontellt beroende. Ingen AI-panel/KPI-vägg, inga nya bilder eller UI-beroenden planeras.

## Tekniska beslut under implementation

- Behåll gamla HTTP-arrayen för availability och201{id} för kundbokning. Valfri staffId utan default i hashunderlaget; legacy väljer staff-demo. getAvailability:s tredje transaktionsklient behålls, personalval är separat argument.
- Booking sparar tjänstens namn/pris/längd/buffert som snapshot. Äldre backfill representerar endast tjänstedata vid migrationen; okänt historiskt pris kan inte återställas. Befintliga start/slut bevaras.
- Personalens veckoperioder och pauser samt datumundantag sparas som strikt begränsad JSON per versionsstyrd personalrad. Inga fria journalfält. Datumundantag ersätter just den dagens veckoschema.
- Lägg gemensamt konfigurationslås före befintliga bokningslås: boknings-/flyttväg använder shared, konfigurationsändring exclusive. Befintlig relativ låsordning för idempotens/kvot/personal bevaras. Flytt låser alla berörda personal/dagnycklar sorterat före bokningsraden.
- Avbokning blir status, dagstaken fortsätter räkna skapade rader även efter avbokning. Ny migration ersätter exclusion atomärt med samma halvöppna skydd för aktiva rader; inga historiska migrationer ändras.

## Verifierad backenddel, 2026-11-12

Ny egen PostgreSQL18.6 på127.0.0.1:55451, booking_epic05_config2_test (migrerad/seedad från tom DB). Prisma generate7.10.1 PASS; fem migrationer/seed PASS; lint, tsc och npm run build PASS; npm test65/65 PASS(10.70s); npm run test:integration50/50 PASS(42.39s). Ny SQL-migrations checksumma motsvarar tillämpad DB. Basens tester kördes som relevanta regressioner eftersom bokningslogik ändrats. Inga tester sänkta.

Tidiga fel rättade: Luxons generiska DateTime-typ krävde uttrycklig now-typ i schemahjälparen. Första migrationsutkastet skapade tom standardtilldelning före seed på tom DB; ny ännu ej committad migration korrigerades och verifierades på ny separat config2-databas (ingen reset/omsrkrivning av historiska filer). Ett retrytest jämförde JSON-nyckelordning från JSONB; ändrat till full semantisk likhet för alla20 svar, samma version och exakt en händelse krävs fortsatt.

Riktade testfall: historiska snapshots, två personaler, paus/ledighet, schemaändring med bokad tid, avbokad tid/frigjord kapacitet, bibehållen skapandekvot, stale-version, resurs-/dygnsflytt, 20retry/20konkurrerande flyttar, direkt-DB-exclusion, generiska fel och minimerade bokningsdetaljer. Datumregeln nekar obefintliga/tvetydiga lokala starttider vid DST i stället för att flytta dem tyst.

Aktuell implementation är inte verifierad produktleverans. API/UI/MCP, uppgraderingskopia, nya E2E, full slutmatris, demo, previewförslag och extern QA återstår. Ingen Epic05-push gjord. Hela AC1–AC10 och previewbeslutet kvarstår enligt EPIC_05_PLAN.

## Bilaga — föregående verifierad leverans

# Aktuellt arbete — Epic 02–04 färdigställda som lokal POC

Produktkod471f91f, branch epic-04-individual-admin. Full-QA på3419973 och riktad återkontroll på471f91f gav GO; kapacitetsfyndet stängt. Lokal slutmatris61unit/40integration/14E2E×4 PASS. Demo4/4 PASS, märkt äldre än osynlig fix. Epic02/03 pushade med4 gröna CI-E2E vardera; känt audit-undantag synligt. Epic04 pushad199d326, Actions43172522203 verifierad med4×14E2E PASS och känt audit-undantag. [CI-bevis](CI_DELIVERY_2026_11_12.md). Ingen mainmerge/deploy.

[Godkänt arbetsmål](GOAL_EPIC_02_04.md) · [resultat](VERIFICATION.md) · [handoff](HANDOFF.md) · [slut-QA](qa/QA-REPORT-epic04-471f91f.md). Framtida GDPR/MFA/drift-Epics är rekommendationer, inte påbörjade.


## Bilaga — föregående arbetsomgång

# Aktuellt arbete — Epic 03 beroendesäkerhet

Epic 02 avslutad i dba05a2 med oberoende QA. Aktuell kod 18a4d73 på separat branch epic-03-dependency-security; full lokal slutmatris PASS, full audit FAIL 7 moderate och0 high. E03-0–2/4/5/6 PASS som lokal POC efter läst Grok-slutrapport; E03-3 upstreamblockerat och fortsatt dokumenterat. Ingen fixbeställning behövdes. [Plan](EPIC_03_PLAN.md),[resultat](VERIFICATION.md),[handoff](HANDOFF.md). Endast lokala commits, ingen publicering eller nya produktfunktioner.

## Bilaga — Epic 01

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
