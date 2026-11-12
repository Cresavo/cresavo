# Handoff — Epic 03, lokal kandidat för QA

Kod **18a4d73**, bas **dba05a2** (Epic 02 godkänd), branch epic-03-dependency-security. Inget pushat/mergat/deployat; privat repo och main orörda.

Prisma/client/adapter-pg är exakt7.10.1. Ett nytt direkt adapterberoende; pg transitivt, ingen ny env-loader. Gemensam klientfabrik i scripts/database.mjs för webb/MCP/seed/test/demo, begränsad pool och explicit UTC-session. Endast CLI-konfigurationen laddar .env; runtime kräver exporterad URL. Strukturerad v7-konfliktmappning. Schemafält, historiska migrationer, låsordning och HTTP/MCP-kontrakt bevarade. [Beslut/licenser/tidiga fel](DEPENDENCY_REVIEW.md).

Ändrade kodfiler: package.json/låsfil, prisma/schema.prisma (bara URL bort), ny prisma.config.ts och scripts/database.mjs, src/lib/db.ts/domain.ts, seed, demo-/cleanupskript och E2E-klientkonstruktioner. Nya database-unit/integrationstester och adapterfeltester; vitest.config.ts har en syntetisk aldrig ansluten unit-URL. Dokumentation/notices/licensinventering uppdaterad; exakt lista via git diff --name-status dba05a2 18a4d73.

Faktiskt PASS: ren npm ci/generate/3migrate/seed, lint/tsc/build,51 unit,31 integration×3,12 E2E×4,cleanup0 data/överlapp/deadlocks och syntetisk äldre DB-kopia. Full audit FAIL7 moderate/0 high; prod audit PASS0. E03-3 upstreamblockerat utan säker kompatibel minimatchfix; inga overrides/lintundantag. [Kommandon/loggar](VERIFICATION.md).

Grok granskar fryst 18a4d73 från ren separat klon och source-ZIP, SHA256 F18D8BB21354DFB9CD99B21161750DF37BF72AD81F9BB5B4CA04F4398D9F6F9A. Uppdrag skickat02:05CET; oberoende slutbedömning **återstår**. Ingen ny demo; äldre Epic 02-galleri har14 PNG / 4 WebM, filmer inte fullt genomtittade. Nuvarande beteende verifieras genom E2E, inte genom den äldre videon.

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
