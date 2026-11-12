# Handoff — Epic05 QA-godkänd lokal produktalpha

**Senaste, godkänd previewanpassning 2026-11-12:** separat kandidat på
preview/epic05-vercel-review. Gemensam PostgreSQL-spärr, explicit Vercel-ingress
och containerstart via befintlig wrapper. Ny sjätte migration, historiska
migrationer och npm-paket orörda.71unit/71integration/24E2E×4 PASS, lint/tsc/build
PASS. Fullaudit FAIL7moderate/0high,prod PASS0. Separat Vercel-projekt med skydd
på alla deployments och ny Neon Free-DB i Frankfurt är konfigurerade, ingen
appdeploy/länk. Grok-kandidatgranskning och faktisk drift återstår. Läs DEMO och
VERIFICATION före fortsatt arbete. Äldre blockeringsnotering nedan gäller
förstudien före Niclas uttryckliga godkännande.

**Previewtillägg 2026-11-12, dokumentation endast:** förstudie på separat
`preview/epic05-vercel-review`, bas `29ac297` (matchar originalbranchens remote).
Aktiv Vercel Pro och Neon-integration verifierade läsande, ingen Booking Lab-DB
ansluten eller skapad. Några få dollar extra Vercelförbrukning accepterat, inga
nya betalda tjänster. Groks riktade läsande förstudie: **NO-GO config-only Vercel**,
inte återkallat lokalt Epic05-GO. Processlokal spärr och overifierad socket/proxy
kräver separat beslut före produkt-/säkerhetsanpassning. Inga molnändringar,
deploys eller runtime-tester. [Fullt underlag/NOT RUN](DEMO.md).

2026-11-12. **epic-05-booking-workspace**, produktkod **4fc98d37fef805e041f8f8772a3fc37543d4ff04**, bas26b680d/plan5c9b07a. Grok har gett GO efter ett riktat fixvarv, E05-QA-1 stängd. Efterföljande dokumentcommits ändrar ingen app/test/schema. Privat leverans **c12b98a31f844f4dc50213a72feb57db02595794** är pushad; [Actions43210413097](CI_DELIVERY_2026_11_12.md) har4gröna E2E-jobb,24/24 vardera. Ingen mainmerge/deploy. Pilot NO-GO.

Byggt: faktisk dag-/veckokalender och mobil dag/lista; tjänsters pris/längd/buffert/aktiv/version; två personaler med tilldelning, arbetspass, pauser och datumundantag; manuellt skapa/öppna/flytta/avboka med snapshots/historik. Samma domänregler/lås/version/idempotens via API och lokal MCP. Femte nya framåtmigrationen bevarar gamla kolumner och ersätter exclusion atomärt med skydd för confirmed. Fyra historiska migrationer byteidentiska. Ingen ny npm-dependency/licensändring. Backfill använder migrationens katalogpris/namn, inte ett påhittat historiskt pris.

Viktig kod: prisma/schema.prisma och femte migrationen; lib/schedule,calendar,workspace-config,workspace-write,booking-mutations och domain; admin-kalender/editor/API; mcp/workspace,reply,workspace-client och explicit miljövitlista; motsvarande unit/integration/E2E/demoverktyg. [Kontrakt/lås](ARCHITECTURE.md), [data](DATA_FLOWS.md), [säkerhet](PRIVACY_SECURITY.md). Kundkontakt maskeras; nya MCP-listor/detaljer saknar kundnamn/e-post och är begränsade. Arbetsyteskrivningar kräver --admin --allow-workspace, confirmed och stabil request-id. --allow-bookings ger inte nya rättigheter.7klientfrågor är lokal hjälp, inte bevis för mänskligt samtycke.

QA-fixen separerar manuella adminbokningar:100nya per konto/Stockholm-skapandedag och60försök/15min, HMAC av konto-id, emailCapKeyNULL. Kund och lokal MCP behåller5/3/30 och deras budget påverkas inte av nya adminbokningar. Auth i transaktionen före replay, ursprunglig idempotens/versions-/lås-/exclusionlogik består. Äldre rader skrivs inte om och kan påverka gamla kundkvoten till skapandedagens slut. Ingen ny migration.

**Faktiskt testat:** ren npmci570/571 på samma oförändrade lockfile; generate7.10.1;5migrationer/seed på ny fix1_test;69unit/66integration/lint/tsc/build;24E2E×4;timeoutcleanup/aggregat0. Syntetisk Epic04-templatekopia4→5 bevarar gamla data och DST. Fullaudit FAIL7moderate/0high,prod PASS0. [Exakta kommandon/utdata/FAIL/NOT RUN](VERIFICATION.md). E2E-proxy är testfixturen127.0.0.10/32; inte verifierad extern drift. Grok loggade1deadlock i oförändrat avsiktligt direkt-ORM-bypasstest, inga i domänprober; detta döljs inte bakom vårt observerade0.

**Oberoende QA:** [fullrapport7fc0e86](qa/QA-REPORT-epic05-7fc0e86.md) (NO-GO på adminbudget), [fixbeställning](qa/FIX-REQUEST-epic05-7fc0e86.md), [slutrapport4fc98d3](qa/QA-REPORT-epic05-4fc98d3.md) (GO). Originalfiler bevarade. Slutrapport SHA2568a47bdad37dab70a573e68b9f4910f7cd6071bd3ca146a7633e30ac663449cf6. Grok verifierade172filhashar/revision i egen kopia, ny isolerad DB och egna69/66/24×4 samt riktade prober:8admin201,101:a429,12samtidiga vid95→exakt5vinnare,20retries/gratisbudget,annanpayload409/spärradadmin403 och oförändrade kund/MCP-tak. En fixomgång av högst två använd.

**Demo/prova:** [Windowsguide](LOCAL_DEMO_WINDOWS.md), [galleri/revision](DEMO.md). Produktionsdemo7fc0e86 dirty=false6/6PASS,28PNG/6WebM;26funktionsbilder+2ogiltiga09-laddningsbilder.13visar riktig detalj. Äldre än osynlig kvotfix, inte nytt kodbevis för4fc98d3. Ingen full ny inspelning. Filmer avkodade, stillrutor granskade, inte helt genomtittade. Artefakter ignorerade; Grok fick separat rensat paket.

Komplett ändringslista mot godkänd föregångare: `git diff --name-status 26b680d 4fc98d3`; senare ändringar är enbart dokumentation.

Käll-ZIP4fc98d3 med172filer/inventering/patch: C:/Users/<user>/booking-lab-pg-test/epic05-qa-fix1-4fc98d3, SHA256537dd086e0b310698bd4d3413d7c37f8ac6b6da1eac20c1a16528106d7e2e32c. Inga .env/auth-state/dependencies/build/data. Grok har faktisk åtkomst i egen miljö, inte bara en C:-sökväg.

**Leverans:** feature-push43209758207 PASS på4m01s, full manuell43210413097 PASS på exaktc12b98a.69unit/66integration/24E2E×4 också verifierade i Ubuntu/Docker-DB. Senare dokumentcommits ändrar endast Markdown; inga nya kod-/test-/schemaändringar efter QA. Docs-only-push7e8f901 är verifierad:0Actions-körningar. Produktkod4fc98d3 är identisk efter alla dokumentuppdateringar. Mobilpreviewförslag klart men faktisk miljö kräver samlat beslut om leverantör/HEL1/backup/budget/domän/namngivna konton. Pilotblockerare i PROJECT_STATUS. QA-2–8 är mindre backlogg; inga nya Epics/andra fixvarv startas för dem. CI-besparing är konfigurerad, actionlintPASS och feature/fullmatris/cache verifierade externt; veckoschema kan inte aktiveras på featurebranch och inget mainmerge är tillåtet.

## Verifierad föregångare — Epic04

# Handoff — Epic 04 godkänd lokal POC

2026-11-12. Branch **epic-04-individual-admin**. Produktkod **471f91fa11ad27c19ecd43244bcc90ba3f0b2489**; första kod3419973, bas10175ed. Efterföljande leveranscommits ändrar dokument. Groks full-QA och riktade återkontroll gav GO; E04-QA-1 stängd, inga nya fynd. Pilot NO-GO.

Byggt: AdminUser med saltad Argon2id-hash, aktiv status och credentialVersion; sessionskoppling via additiv fjärde migration. Strikt email/password-login utan ADMIN_PASSWORD-fallback. Kontoradlås och versionskontroll hindrar äldre verifieringar från att återinföra sessioner efter reset/spärr. Lokal dold create/disable/reset-CLI. Kapacitetsavslag återlämnar bara den egna försöksreservationen. [Beslut](ADR_004_ADMIN_IDENTITY.md) · [operatörsguide](ADMIN_OPERATIONS.md).

Ändrade huvudfiler: prisma/schema.prisma och fjärde migrationen; src/lib/admin-accounts.ts,password.ts,config.ts,auth.ts,rate-limit.ts,errors.ts; admin/loginroute och UI; scripts/admin.mts och fixturecleanup; tester i password/security/admin-accounts/admin-cli/e2e; package.json/lockfile, envexempel, CI-env och dokument. Domänens enda ändring delar konstanten demo. De3 tidigare migrationerna, bokningsreglerna och exclusion är oförändrade.

Faktiska resultat efter fix: lint/tsc/build PASS;61 unit;40 integration på ny DB;14 E2E i samtliga4 lägen;cleanup och aggregat0. Basen fick dessutom ren npmci/generate,3 integrationsvarv och separat uppgraderingskontroll3→4; samma lockfile/schema efter fix. Grok körde egen ren installation,61unit/40integration och riktade prod/proxy/flodprober; egen full E2E-matris på bas3419973. Full audit FAIL7måttliga/0höga,prod PASS0. [Exakta kommandon/utdata och NOT RUN](VERIFICATION.md) · [full-QA](qa/QA-REPORT-epic04-3419973.md) · [slut-QA](qa/QA-REPORT-epic04-471f91f.md).

Nytt beroende: exakt @node-rs/argon2 2.2.2, wrapperns faktiska MIT-LICENSE läst. [Inventering](EPIC_04_LICENSE_INVENTORY.md). Linux-nativepaketet saknar egen LICENSE-fil enligt QA; komplett native/Cargo-inventering krävs före binär/containerdistribution. Inga binärer eller dependencies i Git. Ingen automatisk majoruppgradering.

Prova: följ README eller LOCAL_DEMO_WINDOWS; migrera/seeda; kör npm run admin:manage -- create admin@example.test och välj eget dolt testlösenord; starta npm run dev och öppna /admin. Testa ett andra konto separat. Ingen standardadmin seedas. Bara syntetiska example.test-uppgifter. [Produktionsdemo](DEMO.md):4/4 PASS på9282cdc, före osynlig limiterfix;14PNG/4WebM. Utvalda bilder granskade, videor avkodade utan fel men inte helt visuellt genomtittade. Artefakter lokala/ignorerade, inte i GitHub.

GitHub: färdiga Epic02 dba05a2 och Epic03 10175ed är pushade på privata brancher. Actions43168794400 respektive43169125103 har4 gröna E2E-jobb och känt rött audit-jobb. Epic04 är pushad som199d326 och Actions43172522203 verifierad:4×14E2E PASS,61unit/40integration PASS, endast kändaudit röd. [CI-bevis](CI_DELIVERY_2026_11_12.md). [Branchens Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions?query=branch%3Aepic-04-individual-admin). Ingen merge till main(b000481), deploy eller verklig data.

Kvar: MFA/livscykel, kund-GDPR, riktig TLS/proxy/flerinstans, kontobunden/distribuerad spärr, audit och distributionslicenser samt produktbeslut Visa kund-e-post. Kvarvarande låga QA-fynd i EPIC_04_QA_FOLLOWUP. Nästa tre mål: avgränsa kund-GDPR; välj MFA/recovery-modell; definiera och verifiera drift-/distributionsgrinden. Inga framtida Epics startas på antaganden. [Kort text till ChatGPT](CHATGPT_REVIEW_HANDOFF.md).


## Bilaga — tidigare verifierad historik

# Handoff — Epic 03 godkänd som lokal POC

Kod **18a4d73**, bas **dba05a2** (Epic 02 godkänd), branch epic-03-dependency-security. Inget pushat/mergat/deployat; privat repo och main orörda.

Prisma/client/adapter-pg är exakt 7.10.1. Ett nytt direkt adapterberoende; pg transitivt, ingen ny env-loader. Gemensam klientfabrik i scripts/database.mjs för webb/MCP/seed/test/demo, begränsad pool och explicit UTC-session. Endast CLI-konfigurationen laddar .env; runtime kräver exporterad URL. Strukturerad v7-konfliktmappning. Schemafält, historiska migrationer, låsordning och HTTP/MCP-kontrakt bevarade. [Beslut/licenser/tidiga fel](DEPENDENCY_REVIEW.md).

Ändrade kodfiler: package.json/låsfil, prisma/schema.prisma (bara URL bort), ny prisma.config.ts och scripts/database.mjs, src/lib/db.ts/domain.ts, seed, demo-/cleanupskript och E2E-klientkonstruktioner. Nya database-unit/integrationstester och adapterfeltester; vitest.config.ts har en syntetisk aldrig ansluten unit-URL. Dokumentation/notices/licensinventering uppdaterad; exakt lista via git diff --name-status dba05a2 18a4d73.

Faktiskt PASS: ren npm ci, generate/tre migrationer/seed, lint/tsc/build, 51 unit, 31 integration ×3, 12 E2E ×4, cleanup och syntetisk äldre DB-kopia. Lokalt 0 kvarvarande data/överlapp/deadlocks. Full audit FAIL: 7 moderate / 0 high; prod audit PASS: 0. E03-3 upstreamblockerat utan säker kompatibel minimatchfix; inga overrides/lintundantag. [Kommandon/loggar](VERIFICATION.md).

Grok godkände **18a4d73** som lokal POC kl. 02:25 CET; inget blockerande fynd eller fixbeställning. [Groks originalrapport](qa/QA-REPORT-epic03-18a4d73.md). QA körde hela matrisen i egen miljö, extra New York-zon, riktig Prisma 6→7→6 och 4 400 blandade anrop med 0 produktvägsdeadlocks/överlappar/serverfel. Fyra deadlocks sågs enbart i det avsiktligt låsförbigående direkt-ORM-testet; dokumenterad testbegränsning, inte en produktregression. Kod och tester är oförändrade efter QA-snapshoten.

Ingen ny demo; äldre Epic 02-galleri har 14 PNG / 4 WebM, filmer inte fullt genomtittade. Nuvarande beteende verifieras genom E2E, inte genom den äldre videon. Egen PG 55448/55449 och webben är stoppade, 0 lyssnare; ignorerad syntetisk .env pekar på separat seedad demo. [Windows-start](LOCAL_DEMO_WINDOWS.md). Privat [GitHub-repo](https://github.com/niclasvestlund-YT/booking-lab-se); remote main läsverifierad b000481, ingen lokal main-branch eller push.

Pilot fortsatt NO-GO. Identitet/MFA, kund-GDPR, audit/upstream, riktig drift/processisolering och kundkontaktbeslut kvar. EPL2 elkjs är separat Prisma Studio-verktyg, ingen kompatibilitet med AGPL påstås; framtida artefakt-/källkods-/noticegranskning krävs före binärdistribution. Rollback: tidigare kod/låsfil +npm ci/generate, ingen DB-migration att återställa. Ingen skarp rollback eller logisk backup/restore verifierad.

## Bilaga — Epic 02 godkänd som lokal POC

Kod **3cd633b99e5aa990d002dc5563aed4bfe6bfe4a6**, lokal branch `epic-02-local-agent-booking`, bas 02edeaf. Ingen push eller merge. Projektet och remote förblir privata; main har inte ändrats av arbetet.

Byggt: ett opt-in lokalt MCP-verktyg create_booking, gemensamt strikt indataavtal/domänmotor, fasta serverkvoter, minimerade svar och en syntetisk ja/nej/EOF-testklient. Befintlig webb/admin/kampanjflöde bevarade. README innehåller kommandot `npm run mcp:client -- --admin --book`. Standardklienten skriver ingen bokning; enbart --admin behåller befintligt kampanjutkastflöde.

Verifierat: lint, tsc, build; 43 unit; 30 integration tre gånger; 12 E2E i alla fyra lägen; cleanup och 0 kvarvarande testposter/överlappar/deadlocks. Audit är FAIL 3 höga/7 måttliga. Lokal npm ci, Docker och extern CI ej körda i denna Epic; ingen push tillåten. [Kommandon, loggar, tidiga fel och begränsningar](VERIFICATION.md).

Grok har granskat fc83a70 och godkänt E02-1–3 med ett lågt fel inför slutgrinden. E02-QA-1 är rättat i 3cd633b via SDK:s publika Standard Schema-gränssnitt och exakt stdio-regression. E02-QA-2 (.env-autoladdning) och E02-QA-3 (delad idempotensnamnrymd) dokumenteras; inga garantier om miljöisolering eller nya namnrymder. [Originalrapport](qa/QA-REPORT-epic02-fc83a70.md), [rättningsnotering](EPIC_02_QA_FOLLOWUP.md).

Slutdemo: **4/4 PASS**, 14 bilder/4 videor, produktion från ren 7a65aee (kod 3cd633b). [Galleri och reproduktion](DEMO.md). Agentens desktop-/mobilbilder granskade, videor inte genomtittade i sin helhet. Första inspelningsförsöket var FAIL och ligger kvar separat; dess rotorsak är inte fastställd.

**Slutkontroll klar:** Grok godkände cad997b som lokal POC 2026-11-12 kl. 01:44 CET. Ren npm ci, generation/migration/seed, lint/tsc/build, 43 unit, 30 integration ×3, 12 E2E ×4, cleanup och egna samtidighetsprober PASS. QA-1 stängt, inga blockerande fynd. Full [originalrapport](qa/QA-REPORT-epic02-cad997b.md) sparad. Tre nya Low/Info-idéer gäller SDK:s __proto__-normalisering, protokollfel och pipe-bekräftelse; de dokumenteras, ingen extra fixloop. Pilot fortsatt NO-GO, inklusive Prisma-autoladdning/processisolering och beslut om kundkontakt. Inga tester omkörda för denna dokumentationsavslutning.

## Bilaga — tidigare Epic 01-handoff

## Slutgodkännande efter dc15023

Epic 01 är **avslutad som lokal POC** enligt Booking Lab QA:s lästa slutrapport `QA-REPORT-epic01-dc15023.md`. M2/L9/L8 godkända, inga nya fynd eller regressioner. CI 43114326682 har fyra gröna E2E-jobb; endast känd audit är röd. Detta ersätter äldre uppgifter nedan om väntande extern CI och slutgranskning. [Slutstatus, rapporterade QA-resultat och backlogg](PROJECT_STATUS.md).

Epic 02: GO för fortsatt planering, inget nytt arbete startat. Pilot: NO-GO av fem dokumenterade skäl. Ingen ny fixomgång eller demo behövs. Denna ändring är enbart dokumentation; inga tester har körts på nytt. Ingen merge eller push görs med avslutningsnoteringen.

## Tidigare verifiering och arbetsomgångar

## Uppföljning M2/L8 och CI – 2026-11-11

Kod **01e80ed**, bas **8b83a40**. Bokningsförsök låses per anställd/dag före tillgänglighetsläsning; strukturerade insert-konflikter ger befintligt domänfel. IPv6-proxynät som också litar på IPv4 nekas. Tre historiska migrationer och exclusion bevarade. CI är konfigurerat för fyra E2E-lägen; extern körning återstår tills push godkänns.

Verifierat lokalt: 28/28 unit, 18/18 integration fem gånger, totalt 100 stressomgångar à20 anrop med en framgång/omgång, <2 s/omgång och 0 överlapp/deadlocks. Alla fyra E2E-lägen 8/8, lint/tsc/build och cleanup PASS; slutdatabas 0 bokningar/0 kampanjer/0 sessioner. [Exakta kommandon, resultat och begränsningar](VERIFICATION.md).

Ingen ny demo enligt produktägarens beslut; senaste inspelning avser äldre kod. Ingen push/merge eller Epic 02-funktion. Visa e-post fortsatt undantagen. Audit omkördes inte; senast 3 high/7 moderate. Pilot fortsatt NO-GO av tidigare skäl. Nästa steg: oberoende kontroll av M2/L8, fyrfälts-CI efter godkänd push och därefter beslutad Epic 02. Inga observerade regressioner i sluttester.

## Historik före denna uppföljning

Bas **056d0c2**, kodcommit **a364bda73850c2983212684e94e9690d100d1d9b**, branch `epic-01-foundation-hardening`. Dokumentationscommit följer kodcommiten. Fixbeställning 1–5 och små förbättringar i punkt 6 genomförda. Visa e-post fortsatt undantagen. Inga nya dependencies, migrationer, Epic 02, deploys, pushar eller merge. Arbetsnamnet är booking-lab-se och repot ska förbli privat.

## Ändrat

- `src/lib/rate-limit.ts`, `src/app/api/admin/login/route.ts`: synkron reservation/spärr före lösenordsjämförelse; 100 ms för felaktiga och spärrade försök; korrekt lösenord från spärrad klient nekas också. Framgång återför sin reservation.
- `scripts/client-address.mjs`, `scripts/server.mjs`: statisk engångsvarning för kollapsad proxyidentitet, minsta proxy-prefix /8 respektive /32, IPv6-/64 för limiter/dagstak, normaliserad IPv4-mappning. Rå socket används fortsatt för proxyförtroende.
- `src/lib/auth.ts`: gallra högst 100 utgångna/återkallade rader vid lyckad login. Versionsnumret får endast höjas, dokumenterat i `.env.example`, README och säkerhetsdokumenten.
- `scripts/test-db-guard.mjs`, `scripts/record-demo.mjs`: avvisa host/hostaddr-parametrar före dataåtkomst även i demo.
- `tests/security.test.ts`, `tests/client-address.test.ts`, nya `tests/integration/sessions.test.ts`: negativa spärrtester, konfigurationsvarningar, /64, databasvakt och sessionsgallring mot riktig DB.
- `tests/e2e/fixtures.ts`, `flow.spec.ts`, `cleanup.probe.ts`, `scripts/test-cleanup.mjs`: egna sessionshashar spåras/städas, timeout inkluderar session, 50 spärrade försök mäts och korta namn visas i demo.
- AGENTS, README, ARCHITECTURE, DATA_FLOWS, PRIVACY_SECURITY, DEMO, VERIFICATION, PROJECT_STATUS, PRODUCT_OWNER_REPORT och WORKPLAN uppdaterade. Exakt fillista: `git diff --name-status 056d0c2 HEAD`.

## Verifierat och reproducera

24/24 unit, 17/17 integration, 8/8 E2E i alla fyra kombinationer dev/prod × TRUST_PROXY_IP=0/1. Ren npm ci, Prisma generate/tre migrationer/seed, lint, tsc, build och timeout-probe PASS. Test/demo lämnar 0 Booking, 0 Campaign och 0 AdminSession. Audit fortsatt FAIL 3 high/7 moderate, runtime 3 high. [Kommandon, riktig output och det tidiga E2E-körfelet](VERIFICATION.md).

Följ README för ny lokal *_test-databas, `.env` och npm-kommandon; kör en QA-omgång åt gången. Produktions-HTTP måste startas via `npm run start`, inte rått `next start`. `_demo` ska vara separat och innehålla enbart seedtjänster. [Demo](DEMO.md) från ren a364bda innehåller 12 PNG/2 WebM; lokala genererade filer är inte med i Git. Videorna är inte fullständigt granskade.

## Kvarstående risker och nästa granskning

Granska särskilt att spärren kontrolleras före varje lösenordsjämförelse och samtidiga försök inte kan passera; att riktiga klienter separeras i korrekt proxykonfiguration; att fixture-städning och 100-raders sessionsgallring bevarar andra aktiva sessioner. IPv6-/64 täcks av unit, inte verkligt nätverks-E2E. Processlokal limiter, kapacitetseviktering, NAT och flera adresser är fortsatt POC-begränsningar. Sänkt sessionsversion kan återvalidera gamla cookies; höj endast. Ingen schemalagd sessionsretention. Gamla IPv6-/128-nycklar migreras inte.

Pilot fortfarande NO-GO: delat lösenord, kund-GDPR-livscykel saknas, audit-fynd, verklig TLS/proxy/drift samt separat kontaktvägsbeslut. CI för denna lokala revision är inte körd; föregående 056d0c2 hade grön verify och röd audit. Tre nästa mål: oberoende QA av batch 3; avgränsad beroende-/driftåtgärd; individuella adminkonton och GDPR-livscykel före pilot.

## Historik före batch 3

# Handoff – Epic 01 QA fix batch 2

2026-11-11. Kodcommit **a84e48a32a874a4392c13bb4f32437d06b317c45**, bas b000481, branch epic-01-foundation-hardening. Arbetskopian var ren före arbetet. Beställaren godkände punkterna 1–5 och 7–11, undantog punkt 6 och tillät bara lokala commits. Ingen push, deploy, publik MCP eller Epic 02. Repo ska förbli privat.

## Ändringar och tekniska beslut

- scripts/server.mjs + client-address.mjs: Node-wrapper runt samma Next-app ger verklig socketadress. Standardläget ignorerar forwarding, proxyläge kräver socketmatch mot IP/CIDR-lista. Interna signerade adressheaders skrivs över; rått next start är inte längre en stödd startväg. npm run dev/start är dokumenterad väg. Inga nya npm-paket.
- rate-limit.ts och login-rutten: fem fel/adress/15 min med progressiv 100–500 ms fördröjning, korrekt lösenord får passera, äldsta bucket evikteras vid 10 000. Bokningsreplays räknas inte mot försök/dagstak.
- domain.ts och ny migration 20261111020000_sessions_client_caps: fem bokningar per verifierad klient/Stockholmsdag, tre per normaliserad e-postnyckel; transaktionslås. Plus-taggen behålls i kontaktadressen men tas bort i taknyckeln. clientKey är HMAC av IP. Båda gamla migrationer och exclusion constraint är oförändrade.
- auth.ts: hashat slumpmässigt sessionstoken i AdminSession, revoke-on-logout, global version kvar. Kopierade cookies avvisas; DB-fel nekar åtkomst med statisk logg. Gamla cookies är avsiktligt inkompatibla. Inga individuella konton eller gallringsjobb.
- Admin: felaktiga datumfilter ger statiskt meddelande/standardintervall, logout i header och YYYY-MM-DD. Punkt 6 inte byggd; e-postmaskering kvar.
- BookingForm: UUID per payload återanvänds efter tappat svar och dubbelsubmit. Textdatum med servervalidering; ingen ny UI-dependency. Nyckeln bevaras inte efter sidomladdning.
- Kampanjvalidering har två skilda säkra felmeddelanden. 100 % tillåts uttryckligen som informationsrabatt i POC, utan betalning. Max 90 dagar/strict/DB CHECK består.
- mcp/environment.ts: explicit whitelist och förälderns DATABASE_URL till subprocesser. Automatisk regression bevisar att annan env-fil inte styr bort kampanjen.
- Playwright: verkliga socketklienter, full dev/prod × direkt/proxy-matris, auto-fixture med egen teardown-budget, separat avsiktlig timeout-probe och UI-retrytest. run-production-e2e.mjs bygger och kör hela sviten.

Exakt fillista: `git diff --name-status b000481 HEAD`. Läs README/ARCHITECTURE för ändrat startavtal och DATA_FLOWS/PRIVACY_SECURITY för nya lagrade nycklar/sessioner. Låsfilen och licensinventeringen är oförändrade; inga nya beroenden eller Prisma-major.

## Faktisk verifiering och demo

[VERIFICATION](VERIFICATION.md) innehåller aktuell resultattabell, riktig output, rättade fel och ej körda kontroller. Ren npm ci och tre migrationer/seed på nya PostgreSQL 18.6-databaser PASS; 20 unit, 16 integration, lint/tsc/build PASS. Alla åtta E2E PASS i vardera av fyra lägen. Timeout-probe: förväntad child exit 1 och noll syntetiska bokningar/kampanjer. Audit oförändrat FAIL: 3 höga/7 måttliga, runtime 3 höga.

[Ny produktionsdemo](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html) och [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json): 2/2 PASS, 12 PNG/2 WebM, **a84e48a och dirty=false**. Inspelat efter kodcommit. Två bilder visuellt granskade; videometadata verifierade, ingen full genomtittning. Artefakterna är endast lokala; de har inte skickats till QA eller GitHub. [Reproduktion](DEMO.md).

## Begränsningar och nästa steg

NO-GO för riktiga kunder: delat adminlösenord, ingen GDPR-export/radering/gallring eller sessionsgallring, kvarvarande audit, ej verifierad drift. Processlokal räknare är inte distribuerat skydd; IP/NAT är inte personidentitet och olika IP kan kringgå dagstak. CSP unsafe-inline och obegränsad kampanjlista består. Fixture-städning garanterar inte processkill, DB-avbrott eller strömavbrott. Verklig TLS/reverse proxy, Docker/PG16 och extern CI har inte körts i denna batch.

Tre nästa mål: oberoende QA av a84e48a, separat audit-/driftverifiering, därefter individuell adminåtkomst och beslutad datalivscykel före pilot. Punkt 6 kräver nytt produktbeslut. Ingen push förrän beställaren ber om det.

## Bilaga – tidigare handoff (historik)

# Handoff – Epic 01 QA fix batch 1

Senaste kodrevision: `3b3309d` (endast återstående formatering efter funktionellt testade `26ea617`); lint/tsc/build/Prettier omkörda PASS.

2026-11-11. Lokal kodcommit `26ea6171de05fe17ce4d8bd1e4a4d931d9d5bc82` på `epic-01-foundation-hardening`, bas `ed1658a`. Ingen ny Epic, inga nya produktområden, npm-beroenden, remote eller publicering. Arbetskopian var ren vid start. Historiska migrationen och databasens exclusion constraint är oförändrade; en ny migration tillkommer.

## Leverans och filer

- `src/lib/rate-limit.ts`, login/bookings-rutter, `domain.ts`: processlokal rate limit, statisk 429/Retry-After, tre bokningar per normaliserad e-post/skapandedag i Stockholm. Säker konservativ gemensam bucket utan betrodd proxy.
- `src/lib/auth.ts`, ny logout-rutt, admin UI: Logga ut + serverkonfigurerad ADMIN_SESSION_VERSION. Höj version och starta om alla processer för global återkallelse utan byte av SESSION_SECRET.
- `domain.ts`, admin sida: inkluderande datumintervall, standard idag till idag+14 dagar, max 31 dagar, max 100/sida, maskerad e-post. MCP behåller minimerat svar och obligatoriskt intervall.
- Prisma schema + `20261111010000_qa_hardening`: createdAt, idempotencyKey/requestHash, unik verksamhet/nyckel, index för dagstak, CHECK kampanjdatum. Valfri Idempotency-Key, max 64 ASCII-tecken; samma normaliserade payload ger 201/samma ID, annan 409.
- Parameteriserad INSERT behövs eftersom Prisma6 ORM-create ger UnknownRequestError vid exclusion. `$queryRaw` ger strukturerat P2010/meta.code23P01; forcerat DB-test bevisar DomainError400. Advisory locks för idempotens/e-post kompletterar, ersätter aldrig exclusion constraint.
- `next.config.ts`: CSP/frame-ancestors, nosniff, referrer, HSTS i production, admin no-store, ingen powered-by. CSP tillåter unsafe-inline; starkare nonce-policy är separat arbete.
- `scripts/test-db-guard.mjs` och testkonfig: endast loopback + *_test/_demo före datatillgång. `tests/integration/qa.test.ts`, `tests/db-guard.test.ts`, utökade unit/MCP/E2E täcker negativa fall och20 parallella anrop.
- Kampanjschema strict, max 90 inklusive kalenderdagar; framtida publicerad kampanj syns först validFrom i Stockholm. `src/lib/format.ts` delas för SEK och bekräftelse. Formuläret väntar på hydration innan interaktion.
- `scripts/record-demo.mjs`, `demo-revision.mjs`, demo-config: produktionsbygge, en enda prodserver, revision unknown utan Git, statiska felkoder. Befintliga enradiga filer Prettier-formaterade.
- `.github/workflows/verify.yml`: eget märkt audit-jobb, korrekt *_test-databas. `THIRD_PARTY_NOTICES.md` och `docs/PRISMA_7_PLAN.md`: licensbegränsningar och separat framtida migrering.

Exakt fillista: `git diff --name-status ed1658a HEAD`. Dokumentationen uppdateras i en separat lokal commit efter kodcommiten.

## Faktisk verifiering och prova själv

[VERIFICATION](VERIFICATION.md) har den enda aktuella kommandotabellen, faktisk output, rättade fel och ej körda kontroller. Ren npm ci, generate/migrate/seed på nya isolerade PostgreSQL-databaser, lint/tsc/build PASS; 14 unit, 14 integration, 6 E2E PASS; produktionsdemo 2/2 PASS. Audit FAIL: 3 höga + 7 måttliga; runtime 3 höga. Ingen Prisma-major eller riskabel autofix.

[Demoanvisning](DEMO.md), [galleri](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json). Inspelningen gjordes före commit och anger ärligt ed1658a/dirty=true; koden motsvarar 26ea617. README beskriver ny *_test-databas och återkallelse. Genererade artefakter är ignorerade och lokala.

## Begränsningar och nästa steg

Delat adminlösenord, ingen individuell återkallelse; kopierad cookie gäller till versionbyte/utgång även efter browserlogout. IP-spärren är processlokal och kräver betrodd överskrivande proxy för separata klienter. E-posttak kan inte verifiera identitet och nycklar/hashar är inte anonymisering. Databasdagstak räknar skapandetid; historiska rader får migrationstid. Idempotensnycklar finns kvar så länge bokningen finns, ingen TTL eller UI-genererad nyckel. Kampanjlistan saknar ännu paginering. Native datumformat och generiska filterfel behöver UX-arbete.

Ingen Docker/extern CI/verklig TLS/proxy/lasttest/backupövning har körts. POC:n är inte kundklar. Tre nästa mål: (1) extern QA + Docker/CI och separat auditåtgärd, (2) individuella adminsessioner och verifierad driftgräns, (3) syntetisk backup-/gallrings-/dataskyddsövning. Ingen av dessa har påbörjats som ny Epic.

## Bilaga – tidigare handoff (historik)

# Booking Lab SE – Epic 01 handoff

Efterföljande visuell leverans: [produktägarrapport](PRODUCT_OWNER_REPORT.md), [aktuell projektstatus](PROJECT_STATUS.md) och [lokal demo/instruktioner](DEMO.md). Denna tekniska Epic 01-rapport bevaras som historik.

2026-11-11. Epicen är färdig lokalt med dokumenterade beroenderisker och externa verifieringsluckor. Ingen ny produktfunktion, npm-dependency, licensändring, remote, publicering eller fjärr-MCP. Endast syntetiska uppgifter.

## Levererat

- Befintliga ocommittade GDPR-/underhålls-/MCP-ändringar bevarades och fick egen bascommit. MCP:s 31-dagarsintervall, 20/100 resultat per sida, scoped cursor och frånvaro av kundnamn/e-post är verifierade.
- Gemensam liten felklassificering för HTTP/MCP och SSR-dataladdning. Okända fel ger statisk loggkod och generiskt svar; godkända domänmeddelanden behålls. Seed/testklient/processavslut använder statiska felkoder. Test med riktig trasig DB-anslutning täcker alla MCP-verktyg och stderr.
- Strikt sessionsformat/signatur/utgångstid, högst åtta timmar, högst 1024 lösenordstecken och robustare hantering av null/felaktig JSON. Delat lösenord och lokal --admin kvarstår.
- Tillgänglighet hämtar bara start/slut. PostgreSQL-skydd och historiska migrationer är oförändrade. Nytt test gör två samtidiga direkta writes och kontrollerar angränsande intervall.
- Playwright använder egen loopback-server, svensk locale och trace vid fel. Minimal framtida GitHub-CI med låsta officiella actions, Compose, tester och synlig audit-grind; inga uppladdningar/deploys.
- Tre oberoende read-only-granskningar samt konkret auth-/verksamhetsplan och mätpunkter för framtida index/pooler.

## Git

Branch `epic-01-foundation-hardening`, ingen remote. Utgångspunkt `2596ea6` plus befintliga arbetsändringar.

| Commit | Innehåll |
|---|---|
| `726fbce` | Bevarad MCP-minimering, integritet och tidigare städning |
| `5b26cde` | Sanerade felgränser, lokal sessionsförstärkning och regressionstester |
| `d960a0d` | Isolerad Playwright och CI-definition |
| `git log -1` | Dokumentationscommit med denna handoff och slutresultat |

Commits använder kommandolokal `Codex <codex@localhost>` eftersom Git saknade författaridentitet. Ingen global konfiguration ändrades.

## Ändrade filer

- Fel/auth/domän: `src/lib/errors.ts` (ny), `http.ts`, `auth.ts`, `domain.ts`.
- Gränssnitt: `src/mcp/server.ts`, `src/mcp/client.ts`, `src/app/page.tsx`, `src/app/admin/page.tsx`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/publish/route.ts`, `prisma/seed.ts`.
- Verifiering: `tests/security.test.ts` (ny), `tests/integration/booking.test.ts`, `tests/integration/mcp.test.ts`, `tests/e2e/flow.spec.ts`, `playwright.config.ts`, `.github/workflows/verify.yml` (ny).
- Dokumentation: `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `DATA_FLOWS.md`, `PRIVACY_SECURITY.md`, `VERIFICATION.md`, `WORKPLAN.md` och `HANDOFF.md`.
- Bascommiten bevarar dessutom `docs/ENGINEERING_PRINCIPLES.md`, `docs/MAINTENANCE_REVIEW.md` och tidigare borttagning av direkt `@eslint/eslintrc` i package.json/låsfil. Inga ytterligare paketändringar gjordes i epicen.

## Testresultat och reproduktion

PASS: `npm ci`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm test` (8), `npm run test:integration` (8), `npm run test:e2e` (4), `npm run lint`, `npx tsc --noEmit`, `npm run build` och `git diff --check`.

FAIL: `npm audit` (3 high, 7 moderate), `npm audit --omit=dev` (3 high). Inga patch/minor-rättningar identifierades. Se [VERIFICATION](VERIFICATION.md) för uppströmskällor och riskbedömning.

Diagnostisk Playwright-körning med 30 s timeout: FAIL 2/2; browser-fixture och navigation tog lång tid. Ett nytt HTTP-test hade felaktig testpayload och korrigerades till råa bytes. Ordinarie slutlig körning: PASS 4/4 både varm och tom Next-cache. Ingen funktionell regression upptäcktes i de körda testerna; den historiska timeoutens exakta orsak är fortfarande osäker. Detaljer och tider finns i [WORKPLAN](WORKPLAN.md).

Testmiljö: Windows/Node 24, ny isolerad PostgreSQL 18.6 på loopback port 55442 via redan installerat separat testverktyg. Docker/Compose och själva GitHub-workflowen är **ej testade**. Testkluster och diagnostiska traces finns lokalt utanför repot; de är syntetiska men omfattas inte av någon automatisk gallring. Testdatabasen och hjälpprocessen är stoppade; den tillfälliga .env har tagits bort.

Lokal start: följ README med egen .env, Docker Compose eller egen tom PostgreSQL; kör npm ci, prisma generate, db:migrate, db:seed och npm run dev. Kör testerna endast på separat testdatabas och frigör port 3000 före E2E. Sätt NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1 i processen före Next/Prisma.

## Begränsningar och kompatibilitet

Den tidigare dokumenterade brytande MCP-ändringen kvarstår: list_bookings kräver from/to och returnerar minimerad paginerad struktur. Denna epic döljer råa MCP-fel, ger 400 för felaktig JSON och avvisar felaktiga sessionsformat; normala boknings-/kampanjkontrakt behålls.

SDK:s egna schemafel kan återge klientindata innan callback. Appens sanering är ingen garanti för databas-, proxy-, ramverks- eller externa agentloggar. ID/tider/tjänster kan fortfarande vara personuppgifter. Webbadministrationen är obegränsad och datamodellen saknar genomgående tenant-integritet. Full auth, rate limiting, TLS/cache, gallring, backup/återläsning, leverantörs- och GDPR-beslut krävs före verkliga kunder. Detaljer i [PRIVACY_SECURITY](PRIVACY_SECURITY.md) och [ARCHITECTURE](ARCHITECTURE.md).

## Nästa tre steg

1. Planera och verifiera Prisma-/lintuppgradering eller upstream-backport som tar bort audit-riskerna, inklusive faktiska licensartefakter. Kör samma regressionssvit.
2. Implementera individuella administratörer, återkallbara sessioner, missbruksskydd och verifierad origin/TLS/cache enligt arkitekturplanen; håll MCP lokalt.
3. Förbered en isolerad syntetisk pilotmiljö: verifiera Compose/CI, loggar, backup/återläsning och datalivscykel. Inför ingen flerföretagsdrift innan relationer och negativa isolationstester är klara.
