# Webbläsarregressioner · aktuell verifiering · 2026-11-15

Gren `fix/gateway-service-auth`, produkt/testcommit `4162ec94e0814828a3868b4648fcf55608471056`.
Återställer befintlig publicerad kampanjvisning på Salong Ekos kundspår med
befintlig Stockholm-datumfiltrering. Smalare kortmarginaler vid högst 480 px ger
kalenderknapparna plats. Tester går via salongsvalet och mobilens kundflik,
använder etiketter och avgränsar kundformuläret från agentsimuleringen.
Boknings-, auth-, API- och databasregler har samma innehåll som före rättningen.

| Lokal kontroll | Kommando | Resultat |
| --- | --- | --- |
| Migrering och syntetisk seed | npm run db:migrate; npm run db:seed | exit 0 på ny loopback gateway_boundary_test |
| Lint | npm run lint | exit 0 |
| Unit | npm test | 392/392, exit 0 |
| Build | npm run build | exit 0 |
| Webbläsare | node node_modules/@playwright/test/cli.js test med E2E_PRODUCTION=1 | 64/64, desktop+mobil, 2.4 min, exit 0 |
| Typer | node node_modules/typescript/bin/tsc --noEmit | exit 0 |

Lokala loggar `<local-state>/codex/e2e-nav-iorhtydp/`, koordinator
`<local-scratch>/e2e-nav-verify.py`. Ingen .env lästes.
Första devförsöket avbröts efter fel i den nya navigationshjälpen och en kallstarts-
timeout. Nästa produktionsförsök gav 58 PASS / 6 FAIL och identifierade de återstående
UI-regressionerna och den tvetydiga sammanfattningsselektorn. Slutkörningen ovan
gick 64/64 med ursprungliga assertions för bokning, publicering, språk, tryckytor,
retry, behörigheter och städning. Inga tester skippades eller timeoutgränser höjdes.

CI efter push väntar vid denna dokumentrevision. Full integration, npm ci och
utvecklingslägets E2 E körs i befintlig feature-CI. Full audit och en ny Grok-granskning
är NOT RUN i denna omgång. Groks tidigare godkännande gäller tjänsteidentiteten på
c7eeda6/a239275, före denna UI-rättning. Ingen fysisk iPhone eller driftverifiering.

## Tidigare verifiering

# Gateway/salong · aktuell lokal verifiering · 2026-11-15

Gren `fix/gateway-service-auth`, salongens testcommit `587d84a55475da0f173a1720970de5fea36360b8`.
Produktkod i salongen `c7eeda6f9a1d32e67866082b941dffb2ea5e621f`,
gateway `a2392754df0c28df300e38a44a514e57087075a5`.
Senaste ändringen omfattar enbart sekretesskontroller i tester.
Fast syntetisk enhetsnyckel slutar på `_o`; hela 43-teckenshemligheten
kontrolleras i lagring, listor och loggar. Slumpade integrationsnycklar behålls.

| Kört kommando | Faktiskt utfall |
| --- | --- |
| node node_modules/prisma/build/index.js generate | exit 0 |
| npm run db:migrate | exit 0, ny isolerad gateway_boundary_test |
| npm run db:seed | exit 0, syntetiska grunddata |
| npm run lint | exit 0 |
| npm test | 392/392, 41 filer, exit 0 |
| npm run test:integration | 205/205, 37 filer, exit 0 |
| npm run build | exit 0 |
| node node_modules/typescript/bin/tsc --noEmit | exit 0 |
| npm run agent:proof | 10/10 PASS, exit 0, produktionsbygge med separat gateway och Chromium-kalender |
| Gamla assertions med samma fasta nyckel i tillfällig testkopia | förväntad exit 1, 2 fel / 14 godkända; kopian borttagen |

Loggar sparade lokalt i `<local-state>/codex/gsqa1-lgzod0e_/`.
Koordinator `<local-scratch>/gsqa1-verify.py` skapar en ny PostgreSQL-instans på
loopback med slumpade processhemligheter, tillämpar DB-vakten och stoppar egna processer.
Ingen .env lästes. Produktfiler, beroenden och migrationer har samma innehåll som
den granskade produktrevisionen.

Groks [originalrapport](qa/QA-REPORT-GS-QA-1-a239275-c7eeda6.md) gäller produktrevisionerna
ovan. GS-QA-1 stängd; egna SDK-bokningen öppnades genom kalenderklick med exakt samma id.
Grok fick 391/392 och 204/205 i sina ursprungliga grindar på grund av suffixfelet.
Dessa röda originalutfall består i rapporten. Den senare testrättningen har
verifierats av Codex; ingen ny Grok-granskning av testcommitten är utförd.

NOT RUN i denna omgång: npm ci, gatewayens oförändrade separata svit, npm audit,
full webb-E2E, CI, deployment, TLS, fysisk iPhone och ChatGPT som klient.
Tidigare gateway 8/8 och build har oberoende Grok-bevis i rapporten.
Kvarvarande Low/Info inkluderar saknad logg för nekad tjänsteidentitet och
konfigurationsdrift till äldre samlat läge. Pilotgodkännande kvarstår.

## Tidigare verifiering

# Public read-only cleanup · 2026-11-15

Lokal branch `codex/public-readonly-cleanup`, bas
`84a811c90b9d5f1991432571afab742329699b7a`. Fyra avgränsade rättningar:

- Landningens svenska/engelska footer beskriver läsdemo med påhittade data.
- `/` och `/product` döljer ägarnas adminingångar endast i PUBLIC_READONLY.
  Normal demoinloggningslogik är oförändrad.
- Gemensam proxy sätter `X-Robots-Tag: noindex, nofollow` när flaggan är `1`,
  även för landningssidor, framtida sidor och blockerade svar. Utan flaggan
  tillkommer ingen indexeringsregel; landningens befintliga meta består.
- Söndag 2026-11-15 saknar korrekt tider: Anna/Erik har enbart vardagstider.
  UI valde tidigare idag. Servern väljer nu första datum med faktisk
  fixturetillgänglighet för vald behandling/utförare (måndag 2026-11-16).
  Giltigt uttryckligt `?date=` bevaras, även stängda dagar. Ingen ändring av
  scheduledSlots, veckotidsberäkning, överlapp, mandat eller gateway.

Ändrade produktfiler: `src/components/landing/Landing.tsx`, `src/app/page.tsx`,
`src/app/product/relay.tsx`, `src/lib/public-fixtures.ts`, `src/proxy.ts`.
Nya tester: `tests/public-readonly-ux.test.ts` (11). Befintliga
`tests/preview-files.test.ts` kontrollerar nu känsliga filnamn virtuellt med
Git ignore-regler, utan att skapa miljö- eller nyckelfiler.

Faktiska slutresultat (exit 0):

```text
> booking-lab-se@0.1.0 lint
> eslint .
```

`npx tsc --noEmit`: ingen utskrift, exit 0.

```text
 Test Files  28 passed (28)
      Tests  206 passed (206)
```

Första kontrollen hade TypeScript-fel för Luxons infererade giltighetsparameter
samt 2 nya testfel vid serialisering av React-komponenttyper
(`2 failed | 204 passed (206)`). Explicit DateTime-typ och inspektion av
props/barn utan komponenttyper rättade dessa; inga befintliga assertioner togs bort.
Befintliga 403-skydd och databasfria negativa tester passerar.

Inte verifierat: build, browser/visuell kontroll, integration, E2E eller faktisk
HTTP/deploy. Ingen server/port, DB-provisionering, push, PR, merge eller deploy.
Inga miljö-/hemlighetsfiler lästes eller skapades. Endast lokal commit ingår.
Äldre resultat nedan gäller sina egna grenar/revisioner.

---

# Public read-only preview · aktuell lokal gren · 2026-11-15

`codex/public-readonly-preview` från `e890b69`. PUBLIC_READONLY=1 ger
syntetiska fixtures utan DB, server-403 för skrivning/admin/live och spärrad
HTTP-MCP. Landningsskissen är bevarad. Lint/tsc/build PASS; unit **195/195,
27 filer**, inklusive 41 nya databasfria tester. Build i Vercel-läge utan DB-URL
eller sessionshemlighet PASS. Ingen server, integration/E2E, push eller deploy.

Detaljer, filgrupper, kommandoutfall och begränsningar:
[PUBLIC_READONLY_PREVIEW](PUBLIC_READONLY_PREVIEW.md).
Äldre verifiering nedan gäller andra grenar/revisioner, inte denna leverans.

---

# Aktuell verifiering · Agentprov 2, rättningsvarv 1 · 2026-11-15

Produkt **9e1c929a9246d4cad8c3385cfe5a12afbc20d333**, codex/agentprov-2.
Efterföljande rapportcommits ändrar inte denna produktkod. Ingen push/deploy.
Windows/Node24.16.0/PostgreSQL18.6, ny agentprov_2_fix1_test på127.0.0.1:55468.
Ingen .env läst. Råoutput i <local-scratch>/agentprov-2/fix1-*.

| Faktisk kontroll | Resultat |
| --- | --- |
| Prisma generate / migrate deploy / seed | exit0; klient7.10.1, alla14migrationer på ny DB; fix1-generate/migrate/seed.txt. |
| npm run lint | exit0, inga fel; fix1-lint.txt. |
| node node_modules/typescript/bin/tsc --noEmit | exit0; fix1-types.txt. |
| npm test | `Test Files 27 passed (27)` / `Tests 171 passed (171)`;33.90s, fix1-unit.txt. |
| npm run test:integration | `Test Files 31 passed (31)` / `Tests 139 passed (139)`;140.69s, fix1-integration.txt. |
| npm run build | exit0, `Compiled successfully in 74s`; fix1-build.txt. |
| Nya negativa regressioner, sedan rättning | Före:7fail/9pass. Efter:16/16; fix1-red/targeted.txt. |
| Filurval + runtime-COPY | OpenAPI vald av previewFiles och explicit i Dockerfile:s runtime; fix1-packaging-check.json. Statisk kontroll, inte Docker/HTTP. |
| SQL-städning |0 Booking/BookingEvent/AgentClient/AgentApiKey/AgentMandate/AgentBooking/AgentApiEvent/Customer; fix1-cleanup.txt. |
| Oberoende Grok på c9c5e49 / produkt9e1c929 |171/171unit,139/139integration,75/75 HTTP-MCP,240 originanrop utan reflektion,5/5 negativa kontroller fångade. Paketerad filsimulering: OpenAPI200, utan YAML500. Se originalrapporten nedan. |

Ny clean npm ci är inte omkörd: tidigare installation572paket/573auditerade
gäller samma oförändrade package-lock. Inga dependencies/licenser ändrades.
Ingen ny auditkörning; tidigare7moderate är separat från funktionstesterna.

Groks original [QA2-bcae82b-01](qa/QA-REPORT-agentprov2-bcae82b.md) gäller
**föregående** bcae82b:166/139,75/75 HTTP,8/8 migration, scoped lokalGO men
paketerad previewNO-GO på AP2-QA-1. Rapportens slut-LF återställdes efter
webbkopiering; SHA256 matchar116ff870b1588ed2fa149fe44a5f136139fb84c8d206704ffdc19513e9750a53.
Fix1 rättar AP2-QA-1/2/3 och den separat reproducerade Vercel+loopbackHTTP-luckan.
Återkontrollen [QA2-F1-c9c5e49](qa/QA-REPORT-agentprov2-f1-c9c5e49.md) gäller
fryst c9c5e490c8429798470370fcc1d68b4db8c56db3 / produkt9e1c929.
**Scoped GO för syntetisk lokal POC och filpaketerad simulering**, inga kvarvarande
blockerare i uppdraget efter ett samlat rättningsvarv. Originalets21835byte och
SHA634fc825e6accc2a94d45807e8eded285e4716ce3a89a7e430c1c6b66a221dbf
matchar den sparade webbkopian efter återställd slut-LF. Senare ändringar är
enbart rapport/dokumentation, ingen ny produktkod och inget nytt QA-varv.

Grok körde på sin Linux/Node24.22.1-box, separat syntetisk nätverksnamnrymd och
egen testDB. Han verifierade inte denna PC:s råloggar/Git-historik. Hans
filpaketeringssimulering kör riktig Node-HTTP men **inte** Docker-image,
runtime omit-install/native-binding/USER node eller faktisk Vercel-ingress.
AP2-QA-1/2/3/6 är stängda inom denna avgränsning. Kvarvarande backlogg:
DB-CHECK/härledd plats/extra unit-täckning (Info4/5/7), OpenAPI:s ärvda
localhost:3000-servers (Low), https-loopback i Vercel och ignoretestets
git-semantik (Info). Lokal npm start-origin förtydligas i protokollnoterna.
Ingen ny fixloop för dessa icke-blockerande idéer. Pilot/produktion: NO-GO.

NOT RUN lokalt: paketerad runtime-HTTP, Docker, full E2E/fyra lägen,
personliga assistenter, fysisk iPhone, Actions, moln/TLS/deploy. Extra npm start
stoppades tidigare före processstart av automatisk granskning: `blocked by policy`.
Ingen alternativ start eller försvagning av skydd gjordes. Groks separata
syntetiska HTTP-prov är hans verifiering, inte ett lokalt prov på denna PC.
Webbkopierad slutrapport är hämtad med matchande hash. Ett försök att spara
QA-konversationens skärmdump fick timeout; inget sådant bildbevis påstås.

## Historik · Agentprov 2 före rättning, 2026-11-15

Produkt **17ce75bb92f2d5c14b3cc017d7343d99b6f918bd**, lokal branch
codex/agentprov-2, separat worktree från e890b69. Senare Markdown-commits
ändrar inte testad produktkod. Windows, faktisk Nodev24.16.0, lokal isolerad
PostgreSQL18.6 på127.0.0.1:55468. Ingen .env/hemlighetsläsning, Docker,
molnmiljö eller extern publicering. Råloggar: <local-scratch>/agentprov-2/.

| Faktiskt kommando/kontroll | Resultat och riktig output |
| --- | --- |
| npm ci --no-fund | exit0; `added 572 packages, and audited 573 packages in 3m`; npm-ci.txt. Rapporterade7moderate, inget audit fix kört. |
| node node_modules/prisma/build/index.js generate | exit0; `Generated Prisma Client (v7.10.1)`; generate.txt. |
| node node_modules/prisma/build/index.js migrate deploy | exit0;14migrationer på ny agentprov_2_final_test; `All migrations have been successfully applied.`; final-migrate.txt. |
| node --import tsx prisma/seed.ts | exit0, inga fel; final-seed.txt. |
| npm run lint | exit0; `eslint .`, inga fel; final-lint.txt. |
| node node_modules/typescript/bin/tsc --noEmit | exit0, tom feloutput; final-types.txt. |
| npm test | `Test Files 27 passed (27)` / `Tests 166 passed (166)`,9.10s; final-unit.txt. |
| npm run test:integration | `Test Files 31 passed (31)` / `Tests 139 passed (139)`,141.87s; final-integration.txt. |
| npm run build | exit0; Next16.4.6, nya profil/llms/schema-routes byggda; final-build.txt. |
| Separat13→14-uppgradering med äldre mandat | `PASS UPGRADE_EXISTING_SCOPE_PRESERVED`; upgrade-before/after/verify.txt. Ägare, tjänst, utförare, tider och pristak bevarades; samma implicita plats/schema blev explicita. |
| Policy konfliktkontroll | Förväntad exit1:5dokumentkonflikter. Ingen merge genomförd; policy-merge-tree.txt och POLICY_MERGE_PLAN.md. |

`final-checks.json` innehåller build/unit/types/lint=0. Full integration gjordes
efter riktade MCP-prov4/4 och mot en **ny** migrerad/seedad testdatabas, utan
samtidigt bygge. Nytt MCP-prov använder riktig SDK+HTTP-handler med in-process
fetch-brygga: det är inte en verklig nätverksklient eller en personlig assistent.
Det provar alla fem alias, gamla namn, scopes/BOLA, manipulerat mandat/consent,
plats/schema/tjänst/utförare/tid/pris, gemensam replay/status och kontrollerad krock.
Byggmanifestet innehåller alla fyra nya metadata-routes och NFT-spårningen
inkluderar OpenAPI-filen (build-route-check.json). SQL efter sviten visar0 i
Booking/BookingEvent/AgentClient/AgentApiKey/AgentMandate/AgentBooking/
AgentApiEvent/Customer (cleanup.txt). Detta är inte ett runtime-HTTP-prov.

Inledande riktad unitkörning gav31/33: två exakta DTO-förväntningar saknade de
nya additiva platsfälten. Förväntningarna utökades och behåller exakt toEqual;
ingen assertion, säkerhetsregel eller timeout sänktes. Därefter43/43 riktade
och166/166 i fullsviten. Alla13historiska migrationsfiler är oförändrade mot
fryst e890b69. Inga dependencies, lockfiler eller legacyfunktioner togs bort.

**NOT RUN:** riktig HTTP-process/produktionssmoke, full browser-E2E/fyra lägen,
Node22, fysisk iPhone, personlig agentklient, ny Grok-QA på agentprov-2,
upstream full USP/OSBP-konformitetskit, Actions, hosted DB, TLS/proxy/deploy.
Extra lokal `npm start` stoppades före processstart av automatisk säkerhets-
granskning, med enbart skälet `blocked by policy`. Ingen alternativ start eller
försvagning av skydd gjordes. Ingen runtime-HTTP-verifiering påstås.

Profilen beskriver upptäckbarhet och native namnalias, inte full USP-wire eller
OSBP-konformitet. Köra tester är inte kundpilot-/samtyckesgodkännande.

## Historik: fryst Agentprov 1 (andra revisioner)

# Aktuell verifiering · Agentprov 1 · 2026-11-15

Produktrevision **570de3abc886bb1dc8f313ea27e986e0b5fe83c9**, lokal
codex/agentprov-1 från bf7b6c3. Dokumentationscommits efter denna revision
ändrar inte den verifierade produkten. Windows, Node24.16.0, PostgreSQL18.6.
Inga `.env`-filer eller Docker användes; inga gamla credentials lästes.
Råa lokala kommandoutfall: `<local-scratch>/` (inte Git-/CI-artefakter).

| Kört kommando/kontroll | Resultat | Observerat underlag |
| --- | --- | --- |
| `npm ci --no-fund` | PASS exit0 | 572 installerade/573 granskade; npm-ci.txt. Samma oförändrade dependency-lock som slutrevisionen. |
| `node node_modules/prisma/build/index.js generate` | PASS exit0 | Prisma7.10.1; contract-generate-retry.txt. |
| `node node_modules/prisma/build/index.js migrate deploy` | PASS exit0 | 13 migrationer, delivery-migrate.txt; ny isolerad agentprov_delivery_test på127.0.0.1:55467. |
| `node --import tsx prisma/seed.ts` | PASS exit0 | delivery-seed.txt, två tjänster/två utförare, inga kundkort. |
| `npm run lint` | PASS exit0 | delivery-lint.txt. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS exit0 | delivery-types.txt; nya .mts-klienter inkluderade uttryckligen. |
| `npm test` | PASS154/154,26filer | delivery-unit.txt,8.40s. |
| `npm run test:integration` | PASS135/135,30filer | delivery-integration.txt,135.36s; färsk DB med slutlig ny migration. |
| `npm run build` | PASS exit0 | delivery-build.txt, Next16.4.6; /, /admin, /product, /live och agentroutes byggda. |
| `npm run agent:proof` mot produktionswrapper | PASS exit0 | delivery-agentproof.txt; två separata processer, verklig HTTP-MCP SDK + fristående fetch REST, samma nya DB. |
| Negativ testdatabasvakt | PASS: avsiktlig exit1 | Vitest med icke-loopback-URL stoppade med TEST_DATABASE_REFUSED innan dataåtkomst; test-db-guard-negative.txt. |
| HTTP-smoke | PASS7/7 | /, /admin, /product, /live:200; utan nyckel services/MCP:401; publish utan admin:403. delivery-http-smoke.json. Detta är inte en browserklicktest. |
| SQL-städning efter provet | PASS | Booking, BookingEvent, AgentClient, AgentApiKey, AgentMandate, AgentBooking, Customer:0 var; delivery-cleanup.txt. |
| `npm audit --json` | FAIL exit1 | 7moderate,0high/critical; minimatch/typescript-eslint-kedjan. final-audit.json. Inga dependencyändringar/overrides. |
| `npm audit --omit=dev --json` | PASS exit0 | 0fynd; final-audit-production.json. Inte ett generellt säkerhetsgodkännande. |

`delivery-checks.json` har lint/types/unit/build=0. Ny migration är additiv och
explicit transaktionell; alla 12 historiska migrationer/exklusionsvillkoret är
oförändrade mot bf7b6c3. Bred legacy-parking är inte genomförd; snapshotbranch
park/legacy är bf7b6c3. Bara oanvänd product/scene.tsx har säkert tagits bort.

## Tidigare försök i detta uppdrag — bevarad felhistorik

- Baslinje före implementation:129/129unit, lint/tsc/build PASS.
- Första nya generate FAILP1012: saknade sammansatta unika 1:1-relationsindex.
  Rättat innan verifieringen ovan. Tidiga tsc/lintfel i nya fixtures/klienter
  rättades; inga assertions eller timeouts sänktes/togs bort.
- Första initdb med gamla preview-binärer FAIL: saknad share/postgres.bki.
  Kompletta redan installerade embedded-binärer användes därefter; ingen
  installation, ny tjänst eller Windows-behörighetsändring.
- Första fulla integrationen avbröts efter .env-krav i gamla stdio-teststarter.
  Dessa och E2E:s samma subprocessargument använder nu valfri env-fil.
- Nästa fulla körning133/135: kunddatans 20-retry-test nådde5s och efterföljaren
  såg403 i stället409. Samtidigt bygge kördes då. Exakt rotorsak är inte bevisad;
  separat kunddatasvit gick8/8, två senare färska fulla sviter gick135/135 utan
  deadline-/assertionsändring (155.26s respektive135.36s). Behåll som möjlig
  resurs-/timeoutkänslighet, inte ett bevisat produktionsfel eller dold fix.
- Första transportprovet FAIL med generisk kod, cleanup PASS; fas kunde inte
  fastställas. Statiska fasfelkoder tillkom. Fyra följande körningar PASS; det
  sista provet mot slutligt produktionsbygge och nya DB:n gick också PASS.

## Inte kört / inte påstått

Full browser-E2E/4lägen, fysisk iPhone/Safari, native personlig assistent,
ny Grok-QA, GitHub Actions, hosted Neon, Vercel-deploy/protection/TLS,
backup/restore och migration på ett historiskt verkligt datainnehåll: **NOT RUN**.
Ingen push/PR eller molnåtkomst. Äldre UI/Grok/Actions-resultat nedan får inte
räknas som verifiering av denna kod. Vercel/Neon-preflight är en enhetstestad
read-only kontroll av konfigurationsform, inte ett åtkomstskyddstest.

## Bilaga: historik före Agentprov 1

# Aktuell verifiering — premiumdemo

## Agentklient och A2A-historik · 14 november 2026

Fryst produkt cced2112349f0d1bd60fd1ba7e6a37bda36c68fa,
feature/agent-client-pilot-readiness från7998056. Ny isolerad lokal PostgreSQL
agent_readiness_1794660393451_test, alla10historiska migrationer och seed.
Inga schema-/paket-/rättighetsändringar.

| Kontroll | Faktiskt utfall |
| --- | --- |
| Prisma generate/migrate/seed på ny databas | PASS |
| npm run lint / npx tsc --noEmit / npm run build | PASS |
| npm test | 114/114 |
| Full integration efter korrigering | 128/128 |
| Full webb, produktionsbygge, proxy0 | 64/64 desktop + mobil |
| npm audit --json | FAIL7moderate dev,0high/critical |
| npm audit --omit=dev --json | PASS0 |
| Verklig klient list_services / get_availability / show_time_picker | PASS för läsning; bookingEnabled=true i kortsvaret |
| Verklig klientbekräftelse | NOT RUN; ingen apppanel, nativecapture timeout |
| Full Actions43597108005 på fryst revision | PASS fyra jobb,64webb vardera;114unit/128integration/13kort |
| Grok på fryst revision | Scoped GO endast syntetiskt lokalt; inga Medium/High |

Integrationskommandot var node --env-file=.vercel/agent-readiness-test.env
node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts.
Webbkommandot var node --env-file=.vercel/agent-readiness-test.env
node_modules/@playwright/test/cli.js test med E2E_PRODUCTION=1/TRUST_PROXY_IP=0.
Ingen lokal npmci i denna uppföljning; låsta paket är oförändrade, ren installation
körs i CI. Tidigare körning127/128 FAIL: första patchen försökte ny actorKind och
databasens befintliga CHECK nekade. Rättningen använder befintligt actorId,
behåller actorKind public och ändrar ingen migration eller constraint.
Originalfelet bevaras separat från slutlig PASS, inga tester försvagades.

Plugin Creator metadata visar privat booking-lab-time-card0.3.0 och aktuell
release pluginrel_6af7418393e88191bb5834222b306ab3. Launcher läser befintlig
lokalprofil; kontroller visade opt-in1, lokal demodatabas och befintlig secret.
Inga secretvärden lästes ut i logg/rapport. Bookingverktyg är app-only: frånvaro
i modellens verktygslista bevisar inte att UI-bokning saknas. MCPkortsvaret
bekräftade opt-in men rendering/klick i ny klientvy har inte verifierats.

Ingen fysisk iPhone/Safari, extern modell-A2A, fjärr-MCP, Dockerlokalt,
ny previewdeployment, verklig kunddata eller pilotverifiering utförd.

[Lokala kommandon och logghashar](qa/evidence-agent-client-cced211/local-results.json) ·
[CI och logghashar](qa/evidence-agent-client-cced211/ci-results.json) ·
[Faktiska klientobservationer](qa/evidence-agent-client-cced211/client-observations.json).
[Full audit](qa/evidence-agent-client-cced211/audit-full.json) ·
[Produktionsaudit](qa/evidence-agent-client-cced211/audit-production.json).

[Groks byte-identiska original](qa/QA-REPORT-booking-day-client-cced211.md), SHA256
3d3500d38c13d687f05b408199659c3aa6992c55b75ef0651bd37148837c6cec.
Egen QA körde ren npmci,nyDB,lint/types/build,114unit/128integration,
A2A3/3×3,64produktionswebb och actor-prov28/28. Gamla rader skapades med
riktig d8562b8-kod;4/4händelser och3/3bokningar byte-oförändrade.
Negativa kontroller: egen probe fångar4/4; repots tester fångar2/4.
AC-QA-1 Low: tester saknas för rått kanal-id i HTML och actorId från payload;
nuvarande produkt nekade samtliga förfalskningar/läckage i Groks egna prov.
Detta är öppen testbacklogg, ingen verifierad aktuell läcka.
AC-QA-2 Low: eftersläpande dokumentation/klientprov kompletteras här efter QA.
Info AC-QA-3/4: etiketten är kanal, inte person; actorId ska stanna i serverkomponenten.
Grok verifierade inte CI eller PC. Codex kontrollerade Actions exaktSHA och
git diff --exit-code d8562b8 7998056 -- src tests scripts prisma package.json
package-lock.json next.config.ts (exit0) för den dokumentationsbas som saknades
i Groks historiklösa export. QA-bedömningen avser produkt cced211; senare docs
och lokalt genererade bilder är separata. Ingen produktfix efter QA.


## Komplett bokningsdag och lokalt A2A · 14 november 2026

Fryst slutrevision `d8562b8190f52e7b76f3d4682ec6f3b84fd35732`,
branch `feature/complete-booking-day`, från `d015141`.
[Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43593764129)
är grön på exakt revision. Varje jobb använder ny PostgreSQL-testdatabas.

| Kontroll | Faktiskt resultat |
| --- | --- |
| npm ci, Prisma generate/migrate/seed i CI | PASS i slutmatrisen |
| Lint, tsc och build | PASS lokalt och CI |
| Unit | 114/114 i CI |
| Integration | 128/128 i CI |
| MCP-korttester | 13/13 i CI |
| Webb dev/prod med proxy 0/1 | 62/62 i vart och ett av fyra jobb |
| Riktad slutlig A2A-suite | 3/3, tre lokala körningar i rad |
| Terminalprov BOKA → bokning → ägaravbokning | PASS på slutrevisionen |
| Full audit | FAIL 7 moderate dev; 0 high/critical |
| Produktionsaudit, omit-dev | PASS 0 fynd |
| Riktad Grok-QA | GO endast syntetiskt lokalt på fryst d8562b8; inga Medium/High |

[CI-resultat och logghashar](qa/evidence-booking-day-d8562b8/ci-results.json).
[Lokala kommandon och logghashar](qa/evidence-booking-day-d8562b8/local-results.json).
[Full audit](qa/evidence-booking-day-d8562b8/audit-full.json) ·
[produktionsaudit](qa/evidence-booking-day-d8562b8/audit-production.json).

Utvecklingsfel som rättades. Första direkta SDK-transportanropet saknade
A2A-Version; officiell ClientFactory sköter nu versionen. TypeScript fångade ett
felaktigt antaget SDK-fältnamn. EOF i första terminalprovet hanterades först som
fel; itererad inläsning avslutar nu utan bokning. Den första 413-rättningen
kunde fortfarande ge ECONNRESET. Slutversionen dränerar överskjutande bytes utan
att buffra eller parsa dem och svarar därefter med Connection close. Tester
täcker Content-Length, chunkad body, 2 MB och ett efterföljande giltigt anrop.

Första Grok-granskningen gav scoped GO på4438941, egen probe60/64 med fyra Low-fel.
[Oförändrat original](qa/QA-REPORT-booking-day-4438941.md).
[Slutrapport i original](qa/QA-REPORT-booking-day-f1-d8562b8.md), SHA256
`99003d5fe6ec201a0eb309817ac331452b8c73d4e2ae16027b8afc66ed27ac0f`.
Grok verifierade själv ren npm ci, sex nya DB, lint/tsc/build, 114 unit,
128 integration, A2A 3/3 ×3, 24 produktionswebbtester och CLI 22/22.
Dess wire-probe gav 63/64 ×3: minneströskeln föll, men separat skalningsprov
upp till 500 MB bekräftade icke-proportionell minnesanvändning. Ingen dold grön omtolkning
av probeutfallet. Grok läste inte CI; fyrmatrisen ovan är Codex verifiering av Actions.
Nytt Low: överstor autentiserad body dräneras tills den är färdig eller Nodes timeout.
Info: olika HTTP-status för egna respektive SDK:s JSON-RPC-fel. Dessa är backlogg.
Rapportens Info om saknade A2A-resultat i VERIFICATION åtgärdas med denna
dokumentationsändring efter QA, utan produktkodändring.

NOT RUN lokalt: ren npm ci efter paketändringen (utförd i CI), hela fyrmatrisen
(utförd i CI). Lokalt kördes de relevanta 24 webbfallen i produktion, separat
full integrationssvit och nya A2A-fall. Ingen ny deployment, verklig modell,
native/tredjeparts A2A-klient, fjärr-MCP/A2A eller fysisk iPhone/Safari.



## API och lokal MCP · 14 november 2026

Testrevision `dbe1e1f`, branch `backend/api-mcp-pilot-proof`, kumulativ bas
`56579bd`. Ingen produktkod, migration eller beroendeändring.

| Kontroll | Faktiskt kommando / omfattning | Resultat |
| --- | --- | --- |
| Ny isolerad loopbackdatabas | prisma migrate deploy, sedan node --import tsx prisma/seed.ts | PASS |
| Integration | vitest run --config vitest.integration.config.ts | 125/125 PASS |
| Parallella avbokningsretries | samma Vitest-konfig med tests/integration/mcp-workspace.test.ts efter ändringen | 5/5 PASS |
| Unit | npm test | 114/114 PASS |
| HTTP/MCP | Playwright workspace.spec.ts, grep HTTP och lokal MCP, E2E_PRODUCTION=1 | 2/2 PASS desktop/mobil |
| Lint / typer / bygge | npm run lint, tsc --noEmit, npm run build | PASS |
| Dev HTTP/MCP | samma Playwright-filter utan E2E_PRODUCTION | STARTFEL; äldre dev-server håller arbetskopians lås |
| Full audit | npm audit --json | FAIL 7 moderate dev; 0 high/critical |
| Produktionsaudit | npm audit --omit=dev --json | PASS 0 fynd |

Alla databasberoende lokala kommandon ovan ärvde DATABASE_URL från den ignorerade
`.vercel/backend-test.env`, aldrig från molndemon. Efter provet var bokningar,
händelser, kampanjer, adminkonton, sessioner, workspaceRequests och spärrposter 0.
[Resultat och logghashar](qa/evidence-backend-dbe1e1f/local-results.json).
[Full audit](qa/evidence-backend-dbe1e1f/audit-full.json) och
[produktionsaudit](qa/evidence-backend-dbe1e1f/audit-production.json).

NOT RUN lokalt i denna omgång: npm ci och prisma generate (inga paket-/schemaändringar),
hela webbmatrisen (körs i Actions), nya native-MCP-klick, fysisk mobil och deployment.
[Actions 43581522275](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43581522275)
passerade på dbe1e1f: 62 webbtester i alla fyra lägen, 114 unit, 125 integration
och 13 korttester. [CI-bevis](qa/evidence-backend-dbe1e1f/ci-results.json).
Grok godkände samma frysta revision som lokal syntetisk backend.
[Originalrapport](qa/QA-REPORT-backend-dbe1e1f.md). Den lokala dev-låsningen
reproducerades inte i Groks rena kopia. Fjärr-/native-klientprov och pilot
ingår inte i godkännandet.


**[Öppna den skyddade premiumdemon](https://booking-lab-se-preview.vercel.app/product)**. [Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43546809210): 62/62 webbtester i vart och ett av fyra gröna jobb. [Driftbevis](assets/premium/preview-final.json), [CI-loggarnas kontrollsummor](assets/premium/ci-final-proof.json) och [Groks original](qa/QA-REPORT-premium-5212b7a.md).

Vercel `dpl_<redacted>`, fra1. Fast alias och immutable preview kontrollerades: anonyma HTML/API/resurser stoppades; behörig Vercel-session utan appinloggning fick 403 för admin-API. Direktport 3000 gick inte att nå. Egen Chrome-klick: öppna demoadmin utan extra lösenord, välj gårdagens bokningar och läs bokningsdetaljen. [Alla åtta datatabeller oförändrade](assets/premium/preview-db-proof.json), inklusive 94 bokningar. Ingen mainmerge. Pilot och fysisk Safari ej godkända.

2026-11-14, `design/international-agent-ready`, produktrevision
`5212b7afb439ec22e36116f226b6db504cc7c5c3` från 46b261a.
Grok scoped GO på samma SHA; [Groks originalrapport](qa/QA-REPORT-premium-5212b7a.md). Original SHA256:
`864d63737d7caaf556b34e4eeb48a99da8534ca29e80f30f37eb0e0c67c86dda`.
Privat push klar. Full Actions 43546809210 verifierad på exakt produkt-SHA.
Skyddad preview levererad. Senare ändringar här är dokumentation.

| Kontroll | Faktiskt resultat |
| --- | --- |
| npm ci / prisma generate | PASS, befintlig lockfil och Prisma 7.10.1 |
| npx tsc --noEmit / npm run lint | PASS |
| npm test | PASS 114/114, 23 filer |
| prisma migrate deploy / seed, ny booking_premium_20261114_test | PASS, 10 historiska migrationer |
| vitest --config vitest.integration.config.ts | PASS 125/125, 26 filer; slutkörning på 5212b7a: 125,26 s |
| Slutlig read-only städkontroll på testdatabasen | PASS: 0 bokningar, kunder, kampanjer, admins och sessioner |
| next build | PASS efter korrigerad kommandostart (se nedan) |
| Playwright, produktion utan proxy, första körningen | FAIL 9 / PASS 53 av 62, 3,8 min; rättad, slutmatris nedan |
| Playwright, produktion utan proxy, efter rättningar | PASS 62/62, 2,2 min |
| Playwright, produktion med proxy, efter rättningar | PASS 62/62, 2,1 min |
| Agentkort, playwright.agent-workday.config.ts | PASS 13/13, 35,2 s; testvärd, inte fysisk klient |
| npm audit --json | FAIL: 7 moderate dev, 0 high/critical; ingen override/uppgradering |
| npm audit --omit=dev --json | PASS: 0 fynd |
| Dev med proxy, E2E_PRODUCTION helt borttagen | PASS 62/62, 4,2 min |
| Första verkliga dev/proxy0 | FAIL 1, PASS 61/62 (7,1 min), timeout i workspace-samtidighetstestets sidladdning |
| Samma avgränsade dev-test utan kod-/timeoutändring | PASS 1/1, själva testet 4,7 s (29,1 s inklusive serverstart) |
| Full dev/proxy0 efter riktad felsökning, oförändrad kod | PASS 62/62, 4,6 min |

Testmiljön laddas från ignorerad `.vercel/premium-test.env`. Byggkommandot
startas med `process.loadEnvFile` och `spawnSync(node, [next, build])` så att
Next inte ärver `--env-file` via NODE_OPTIONS. Första byggförsöket med flaggan
kompilerade men workerstart föll med exit9; det är inte dolt som PASS.

Matrisoperatörsfel: första skriptet satte E2E_PRODUCTION="0" för två avsedda
dev-ben. Befintlig konfiguration testar truthiness, så även de körde produktion
(62/62 vardera). De räknas INTE som dev-bevis. Riktiga dev-ben körs med variabeln
borttagen. Ursprungliga loggar behålls med sina felaktiga filnamn; separata
`premium-actual-dev-proxy*.log` och `premium-dev-matrix.json` visar rätt körning.

Första verkliga dev-felets trace: POST tog 10,4 s; efterföljande page.goto till
bokningsdetaljen avbröts efter 46,8 s av testets oförändrade 60 s-gräns.
Ingen dubbelbokningsassertion föll. Riktad omkörning passerade och Next varnade
för långsamt filsystem (493 ms benchmark). Orsaken är inte säkert fastställd;
originaltrace sparad som `.vercel/premium-dev-first-timeout.zip`. Fulla dev-ben
har därefter passerat, loggar `premium-dev0-final.log` och `premium-dev1-final.log`.

Slutliga båda dev-ben har nu PASS. Alla fyra webbkonfigurationer täcker 62
tester vardera på produktkoden i 5212b7a. Den genererade next-env-filen växlade
till .next/dev vid dev-körning och är återställd till den committade build-varianten.

Första webbsvitens fel: fyra inaktuella landningssideassertioner, två HTTP-
språkantaganden, två svenska bekräftelser som tappat ”kl.”, och ett mobiltest
för returposition (1120 väntat, 1108 faktiskt). Bekräftelsen har rättats och
språk/ny landningscopy görs explicit i testerna. Returtestets krav är oförändrat;
felet reproducerades även med oberoende mätning vid klicket. `pagehide` skrev
över den uttryckligt sparade returpositionen efter mobilens scrolljustering.
ContextLink bevarar nu klickets position; pagehide sparar fortsatt position för
annan navigation. Produktionsbygge PASS och exakt returtest PASS 2/2 på desktop
och mobil efter rättningen. Full fyrfältsmatris har därefter passerat, se aktuell tabell.
Ursprungliga spår
bevarade i ignorerad `.vercel/premium-first-e2e-failures/`.

Egen lokal klickkontroll: språkbyte behöll inskrivet namn; mobil 390px öppnade
bokning och återgick till rätt dag. Detta ersätter inte pixelprecisions-testet
för scroll eller fysisk iPhone/Safari. Bilder i `.vercel/premium-evidence/`.

## Tidigare leverans — visuell UI-polering
<!-- POLISH_CURRENT_START -->

Verifierat 2026-11-14. Branch **ui/salon-polish**, från 2c74a4b/produkt 51d54d4.
Produkt, slutlig Grok-revision, CI och deploy: **9840309df4d8addc3e4bf5f6c5da0f3802eb4a2d**.
Senare dokumentationscommit ändrar ingen produktkod. Main b000481 är orörd.
[Samma skyddade preview](https://booking-lab-se-preview.vercel.app/admin), deployment `dpl_<redacted>`, fra1.
Vercel-inloggning vid behov → **Öppna demoadmin**, inget andra lösenord.

**Funktionstester och avgränsad QA PASS; full audit FAIL; pilot NO-GO.**

| Faktiskt kört kommando/kontroll | Resultat |
| --- | --- |
| npm ci | PASS ren separat kopia 211s, oförändrad lock; även exakt SHA i CI. |
| node node_modules/prisma/build/index.js generate | PASS Prisma 7.10.1. |
| prisma migrate deploy; node --import tsx prisma/seed.ts | PASS 10 oförändrade migrationer på 7 nya loopbackdatabaser vid uppdragsstart; fixtures återanvända/städade mellan varv. Färsk Docker-PG i CI. |
| node node_modules/eslint/bin/eslint.js . | PASS; npm run lint även i CI. |
| node node_modules/typescript/bin/tsc --noEmit | PASS; npx tsc --noEmit även CI. |
| node node_modules/vitest/vitest.mjs run | PASS 106/106; npm test i CI. Fyra nya meningsfulla layoutfall. |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts | PASS 125/125; npm run test:integration även CI. |
| node node_modules/next/dist/bin/next build | PASS; npm run build även alla 4 CI-jobb. |
| node node_modules/@playwright/test/cli.js test --config playwright.agent-workday.config.ts | PASS 13/13; även CI, testvärd inte native-klientklick. |
| node node_modules/@playwright/test/cli.js test; produktion/proxy0 | PASS 58/58,121s; även 58/58CI. |
| Samma; produktion/proxy1 | PASS 58/58,118s; även 58/58CI. |
| Samma; dev/proxy0 | PASS 58/58,286s; även 58/58CI. |
| Samma; dev/proxy1 | PASS 58/58,218s; även 58/58CI. |
| npm audit --json | **FAIL exit 1: 7 moderate dev**,0 high/critical. Inga overrides eller uppgraderingar. |
| npm audit --omit=dev --json | PASS exit 0: 0 fynd. |
| Läsande teardown-kontroll | PASS alla 6 testdatabaser: 0 Booking/Campaign/AdminSession/CardBookingAttempt. |
| GitHub Actions 43529548681 | PASS 4/4 på exakt 984. Automatisk push 43529537054 avbröts av manuell fullmatris enligt befintlig concurrency. |
| Grok sista samlade varv 2/2 | Scoped GO, inga Medium+. Egna 106 unit/4 polish/prod/lint/tsc/build, 99 klickprober 0 FAIL, 62 geometrikontroller. Full 58×4/125 integration/13 kort på 984 INTE körda av Grok. |
| Faktisk skyddad preview | PASS exakt sourceSHA/arkivhash/fra1/SSO all, egna Chrome-klick, anonym HTML/API/CSS blockeras, adminAPI utan appcookie 403. Åtta affärstabeller oförändrade. |

## Spårbarhet och begränsningar

Lokala råutskrifter: <local-state>/codex/booking-lab-polish-evidence/ (full-*, cards-*,
matrix-*, audit-* och slutmarkören final-completion.json på 984). Privata explicita
env-profiler och separata booking_polish_*_test/_demo; aldrig molnet som fixtures.
[Exakta CI-loggar](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43529548681) är lästa per jobb: 58 vardera, dev0 även 106/125/13.
Lokal Docker NOT RUN; Docker är faktiskt kört i CI.

[Groks originalrapport](qa/QA-REPORT-polish-f2-9840309.md) är återpublicerad ordagrant
i befintlig Grok-konversation efter att download-knappen inte gav någon lokal fil.
DOM-text plus en avslutande LF ger exakt originalhash
640ae0b6d15ae6296084e5010492ace328c8cdbafe2bd44e338637f905b8a745 och 9691 byte.
Groks uppgift att filen saknade avslutande LF motsägs av den matchande hashen;
rapportens innehåll har inte redigerats. Grokgranskning är separat från Codex CI/
molnkontroll. Original 268 och F1 samt deras fynd ligger kvar i docs/qa.

Egna verkliga lokala klick: kalender/bokningsdetalj/flytta/Avbryt/retur, kundsökning
Mira/kort/retur, menyer, Om förslagen. 320/390/1179/1180/1440 emulering med 0 sidoscroll.
Efter 2 rättningsvarv: stabila 24 px kort med sidledskolumner där deras visuella ytor
annars krockar; hover/fokus ändrar aldrig klickytan. Synlig brun kundrad 5,48:1
(tidigare4,27); Grok mätte alla 4 toner och förfäders-opacity i dag/vecka/alla personal.

Tidiga FAIL bevarade: initial navbredd320px rättades; första fokusproben låg efter
en oberoende musprobe och ordnades om utan sänkta assertions; palettfixtur valde
felindex och rättades. Nytt kontrasttest verifierat rött på 1c (4,26679) och grönt
efter CSS-rättning. initial-268ebdf/ och f1-1c1ff5a/ bevarar tidigare råresultat.

Moln: anonym /,/product,/admin,/api/services,/api/admin/bookings,/demo/salon.webp
samt riktig CSS-resurs skyddade. Befintlig CLI-identitet får 200 HTML/tjänster,
403 admin-API utan appcookie. CSP/frame-ancestors none/nosniff/Referrer/HSTS/no-store
och frånvaro av powered-by verifierade. Port 3000 timeout; ingen fullportscan.
Read-only SQL: alla 8 affärstabeller/radhashar oförändrade, 94 bokningar bevarade.
Inga affärsdata ändrades i molnet. Demoåtkomsten skapade en vanlig administrativ
session. Egen Chrome-klick: demoknapp utan extra lösenord; kalender 13 nov →
Elli 09:30 → Flytta → Avbryt → samma kalenderdag. Kunder → Mira → kundkort →
samma sökning. Verkliga molnvyer 1440/390/320 utan dokumentöverflöde;
mobilens kalenderfält 16 px. Stabilt alias öppnades igen efter växlingen.
Två korta CUA/CDP-timeouts återhämtades genom läsning av aktuell sida; inga
åtkomstinställningar ändrades. Ett bildförsök gav 1080 px trots viewportbegäran;
filerna döptes efter verkligt mått. Nya slutbilder har verifierade 1440/390-mått.
Deploymentens källarkivSHA256:
`b62db312503585930f77f255bc4acf6003625938b8895405fd686292055d842c`.

**NOT RUN:** fysisk iPhone/Safari, WebKit/Firefox, skärmläsare, nya native MCP-klick,
ny backup/restore/omstart/flerinstansprov, full accessibility-certifiering och
produktägarens UX-acceptans. Ingen ny video. Senaste kort-/molnflöden från äldre
revision märks historik och används inte som ny nativebevisning.

Info/backlog: långa kort i smala kolumner klipper text (full aria/title/detalj),
24 px-kort kant i kant, färger upprepas efter 4 personal; textidentifiering finns.
Utöka kontrasttest till 4 toner/föräldraopacity senare. Äldre scrollgallring/korrupt
valfri sessionStorage-post och pilotgrindar kvar. Inget tredje fixvarv.
<!-- POLISH_CURRENT_END -->

## Bilaga — tidigare leveranser och resultat

<!-- COHERENT_CURRENT_START -->
# Aktuell verifiering — sammanhängande salongsupplevelse

2026-11-13. Produkt/Grok/CI/deploy **51d54d4696dd5fee51449acbd096f8529fbd3c5c**,
feature/coherent-salon-workspace. Senare Markdown ändrar ingen testad produktkod.
**Funktionstester och scoped QA gröna; full audit röd; ingen kundpilot.**

| Faktiskt kört kommando/kontroll | Resultat |
| --- | --- |
| npm ci | PASS ren separat kopia168 s; även PASS på exakt SHA i alla fyra CI-jobb. Lock oförändrad. |
| node node_modules/prisma/build/index.js generate | PASS 7.10.1 lokalt och i CI. |
| prisma migrate deploy + node --import tsx prisma/seed.ts | PASS 10 migrationer på7nya isolerade f1-databaser, och färsk Docker-PG i CI. |
| node node_modules/eslint/bin/eslint.js . / npm run lint i CI | PASS. |
| node node_modules/typescript/bin/tsc --noEmit / npx tsc --noEmit i CI | PASS. |
| node node_modules/vitest/vitest.mjs run / npm test i CI | PASS 102/102. |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts / npm run test:integration i CI | PASS 125/125, riktig PostgreSQL. |
| node node_modules/next/dist/bin/next build / npm run build i CI | PASS. |
| node node_modules/@playwright/test/cli.js test --config playwright.agent-workday.config.ts | PASS 13/13 lokalt och i CI. |
| node node_modules/@playwright/test/cli.js test; E2E_PRODUCTION=1, TRUST_PROXY_IP=0 | PASS 54/54,111 s lokalt;54/54 CI. |
| Samma; E2E_PRODUCTION=1, TRUST_PROXY_IP=1 | PASS 54/54,109 s;54/54 CI. |
| Samma; dev, TRUST_PROXY_IP=0 | PASS 54/54,203 s;54/54 CI. |
| Samma; dev, TRUST_PROXY_IP=1 | PASS 54/54,194 s;54/54 CI. |
| npm audit --json | **FAIL exit 1:**7 moderate dev,0 high/critical. Ingen override/uppgradering. |
| npm audit --omit=dev --json | PASS exit 0:0 fynd i produktionsberoenden. |
| Läsande teardown-kontroll | PASS 0 Booking / 0 Campaign / 0 AdminSession / 0 CardBookingAttempt i alla sex testdatabaser. |
| Egna lokala CUA-klick | PASS kalender/kund/retur/avbryt; mobil Bakåt 671→671px; bilder320/390/1280. |
| Grok återkontroll1/2 | Scoped GO. Egen matris102/125/13/build/54×4;72 extra coherence och 91 egna klickprober utan fel. |
| GitHub Actions 43502629318 | PASS 4/4 jobb, exakt SHA. Ingen jobbrerun. Automatisk pushkörning43502613523 avbröts av full manualmatris enligt befintlig concurrency. |
| Faktisk skyddad preview | PASS metadata/arkivhash/region/perimeter, eget Chrome-flöde och läsande SQL/HTTP enligt nedan. |

Kommandona använde explicita privata env-profiler, tom .env i testkopian och
separata loopbackdatabaser booking_coherence_f1_*_test. Sju nya databaser
migrerades/seedades; sex användes för tester. Molnet och gamla lokala PC-demon
användes aldrig som test-fixtures. CI kör Docker Compose; lokal Docker NOT RUN.

## Fyra skilda typer av bevis

1. **Lokalt/CI:** resultat ovan och råa kommandoutskrifter. Alla fyra CI-loggar
   innehåller 54 passed; dev0 även 102/125/13. [Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43502629318).
2. **Grok:** [oförändrat original](qa/QA-REPORT-coherent-f1-51d54d4.md), fryst SHA
   och egen syntetisk kopia. Headless Chromium320/390/1280; inte fysisk enhet.
   Originaldownload SHA256 f22d2d84563ed74d3c45735bc304f0e0cea7417c1f79d0b13789bb178fcc9795.
   Git kan normalisera radslut; innehållet har inte redigerats.
3. **Egen faktisk molnkontroll:** `dpl_<redacted>`, fra1,
   sourceRevision 51d54d4 och källarkivSHA256
   `2987c0f8991b9d1e7d2cbfecdc72a0bedc1c24261524fd8c943a9dcedad90a1b`.
   Samma skyddade alias verifierat mot deployment-id, inte mot ny branchspets.
4. **Fysisk iPhone/Safari och produktägarens UX-godkännande:** NOT RUN/återstår.

## Faktisk molnmiljö och data

På både unik deploymentadress och stabilt alias: anonyma /, /product, /admin,
/api/services, /api/admin/bookings och /demo/salon.webp ger 302 till Vercel-login.
En verklig CSS-resurs från HTML är också skyddad 302. Befintlig Vercel-CLI-identitet
mot exakt Preview får 200 på kund-/produkt-/admin-HTML och tjänste-API; admin-API
utan appcookie ger 403. CSP frame-ancestors none, nosniff, strict-origin-when-cross-origin,
HSTS, saknad powered-by och no-store på admin verifierade. TLS-validering kvar.
Port 3000 gav ETIMEDOUT: ingen direkt HTTP-tjänst observerad, ingen full portscan.

Egen Chrome-klick i 390 px emulering: public behandling/dag/tid→bekräftelse synlig
med fokus→Öppna demoadmin utan extra lösenord→rätt kalenderdag/Elias→avbryt flytt
utan sparande→flytt 09:30 till 10:30→Behåll återför fokus→avbokning→3 händelser→
omladdning med samma filter/status. Kundkort Mira: avbrutet namnbyte och
återgång till samma sökning. Tjänst: avbrutet namnbyte; personalschema läst/
stängt utan sparande. Rätt kampanjutkast fokuserat i bild (top 51 / bottom 114 vid 844 px),
åter till rätt förslagskort; ingen kampanj ändrad/publicerad. Logout visar
inloggningsvyn. Stabilt alias kontrollerat med ny demoingång / 3 huvudval/översikt.

Läsande SQL i samma isolerade demodatabas: 94 bokningar varav 93 originalrader
oförändrade; egen d1a15ab0-eea2-494b-bd14-665f7e7f22f4 är cancelled / version 3 med
create/move/cancel. Alla åtta originaltabellers radantal/hash matchar före-underlaget
när den egna bokningen/events undantas. 0 överlapp och 0 icke-syntetiska kontakter.
9 befintliga molnmigrationer har oförändrade checksummor; ingen ny migration/grant.
Lokal tionde MCP-tabell är inte använd av webben. Alla privata profiler/hemligheter
stannade utanför Git, QA-arkiv och kommandoutskrift.

## Bevarade tidiga fel och verktygsbegränsningar

- c0a5be6: prod 54/54 men båda dev 53/54 (scroll 774→0); Grok fann även vanlig
  Bakåt som tappade scroll. Rättat i 51d54d4. [Första originalet](qa/QA-REPORT-coherent-c0a5be6.md).
- Första f1-starten fick webServer 120 s timeout innan assertioner. Endast egen
  dev-cache flyttades till bevarad backup. Nästa fokusprov 5/6 föll när NYTT test
  evaluerade under native dokumentbyte. Väntan på verklig mål-URL/synlig kalender
  lades till; samma scrollprecision, StrictMode och timeouter kvar. Därefter 6/6
  och slutmatris 54×4. Tidiga Prisma-genererings-/testinteraktions-/kampanjmatchningsfel
  från ursprungsomgången är också bevarade i råloggen.
- GitHub CLI kunde inte lämna full logg under aktiv körning. Parallell logghämtning
  fick sedan en lokal cache-ZIP-krock; den loggen hämtades via per-job-API.
  Ingen CI/testomkörning behövdes. Curl-beta krävde cwd-baserad projektlänk i stället
  för vidarebefordrade globala flaggor. Slutliga HTTP-bevis ovan är PASS.
- Några CUA/CDP-evalueringsanrop fick 3 s timeout under sidbyte; färsk DOM visade
  korrekt laddad sida. Ingen skrivning upprepades av det skälet. Fullpage-capture
  fick 5 s timeout; verklig viewportbild användes. En övergångsbild under lokal
  viewportändring har sparats separat och används inte som fungerande bevis.

Rått lokalt underlag: <local-state>/codex/booking-lab-coherence-evidence/,
full-*,ui-*,matrix-*,audit-*,ci-*.txt,ci-final-proof.json,f1-cleanup-read.json,
preview-final.json,preview-db-proof.json,preview-http-proof*.json,cloud/ och
bildmanifest. QA-arkivets hash 9da224cf…1b6562 och evidens d340cca4…576a1f är
verifierade av Grok. Före/efter har faktisk individuell SHA; äldre bilder
utges inte för nya. Inga nya videor krävdes.

## Öppet / inte kört

Low CS-F1-QA-1: 20 posters gallring är inte kronologisk; äldre returposition kan
försvinna efter många besök. Info CS-F1-QA-2: korrupt post stoppar nytt scrollminne.
URL/filter/säker reservväg består. Äldre Info6–9 är backlogg; inget nytt fixvarv.
Fysisk iPhone/Safari, WebKit/Firefox, skärmläsare, ny backup-/återläsningskontroll,
serveromstart och flerinstanslast på nya deploymenten är NOT RUN. Browserreload
är verifierad, inte påstådd serverrestart. Pilot är fortsatt NO-GO.
<!-- COHERENT_CURRENT_END -->

## Bilaga — tidigare verifierade leveranser

# Verifiering — agentbokning och arbetsdagskort

Verifierat 2026-11-13. Branch **feature/agent-booking-workday** från e702838.
Produkt och slutlig Grok-revision: **05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1**. Senare dokumentationscommit ändrar ingen produktkod.

| Slutkontroll                           | Faktiskt resultat                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ren npm ci / generate / migrate / seed | PASS: ny ren installation, sju nya isolerade loopbackdatabaser, tio migrationer vardera.                                                                                                                                                                                                                                       |
| Lint / tsc / unit                      | PASS / PASS / 91 av 91.                                                                                                                                                                                                                                                                                                        |
| Integration                            | PASS: 125 av 125.                                                                                                                                                                                                                                                                                                              |
| Produktionsbyggda MCP-kort             | PASS: 13 av 13.                                                                                                                                                                                                                                                                                                                |
| Build                                  | PASS i testkopian och separat fryst runtime.                                                                                                                                                                                                                                                                                   |
| Webb-E2E                               | Slutligen PASS: 48 av 48 i prod0, prod1, dev0 och dev1; totalt 192. Dev0 hade först två äldre laddningstimeouter (46/48), sedan en starttimeout. Båda FAIL-körningarna bevaras. Ren genererad dev-cache gav 48/48 utan ändrad kod/assertion/tidsgräns.                                                                         |
| Begränsade SQL-roller/operatörswrapper | PASS: 21 riktiga begränsade SQL-prober, kontaktfritt ägarkort med ett läsverktyg, aktiv owner nekas emailkolumn med 42501. Verklig wrapper/konfig startad via SDK; ingen fjärråtkomst.                                                                                                                                         |
| Källmatchning/städning                 | PASS: 510 Git-filer i fryst runtime, noll kodavvikelser i testkopian och fem uttryckligt listade statusutkast. Genererad next-env undantagen. Sju F2-testdatabaser har noll affärs-, försöks-, admin- och sessionsfixtures. Åtta hashade limiterposter i integration och en i korttest kvar; övriga noll.                      |
| Befintliga bokningar                   | De två gamla syntetiska bokningarna och två create-händelserna är oförändrade, med identisk SHA256 före/efter migration och retry. Vanlig Chrome-admin laddades om på den nya runtime med samma individuella session och visade båda besöken. Aktiv publik HTTP-replay nekas med statiskt403 och admin-API utan cookie med403. |
| Full npm audit                         | **FAIL: exit 1, sju moderate i utvecklingsberoenden; noll high/critical.**                                                                                                                                                                                                                                                     |
| npm audit --omit=dev                   | PASS: exit 0, noll fynd.                                                                                                                                                                                                                                                                                                       |
| Grok                                   | Grok GO för lokal syntetisk POC på exakt 05e5eaf efter två samlade rättningsvarv. Egen separat kopia: 91 unit, 125 integration, 13 kort och 192 webbtester PASS; inga Medium/High. Övriga Low/Info är backlogg. [Groks originalrapport](qa/QA-REPORT-agent-workday-f2-05e5eaf.md).                                             |
| GitHub Actions                         | Verify POC på exakt 05e5eaf: alla fyra jobb gröna, 48 webbtester per jobb. Dev0 kör även 91 unit, 125 integration och 13 korttester. Docker/PostgreSQL användes i CI; det är inte ett lokalt Dockerprov. [Actions 43467138367](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43467138367).                  |

## Faktiska kommandon och utdata

Exakta Node/npm-CLI-anrop, exitkoder och tider finns i [installation](verification/agent-workday/setup-results.json), [lint/tsc/unit/integration](verification/agent-workday/full-results.json), [build/kort](verification/agent-workday/ui-results.json), [webbmatris](verification/agent-workday/matrix-results.json) och [audit](verification/agent-workday/audit-results.json). Node 24.16 och separat native PostgreSQL på loopback 55451 användes. Det är inte ett lokalt Dockerprov.

| Steg                           | Resultat/exit | Tid   |
| ------------------------------ | ------------- | ----- |
| npm-ci                         | PASS (0)      | 141 s |
| generate                       | PASS (0)      | 2 s   |
| migrate-integration            | PASS (0)      | 7 s   |
| seed-integration               | PASS (0)      | 0 s   |
| migrate-card                   | PASS (0)      | 2 s   |
| seed-card                      | PASS (0)      | 0 s   |
| migrate-prod0                  | PASS (0)      | 2 s   |
| seed-prod0                     | PASS (0)      | 0 s   |
| migrate-prod1                  | PASS (0)      | 2 s   |
| seed-prod1                     | PASS (0)      | 0 s   |
| migrate-dev0                   | PASS (0)      | 2 s   |
| seed-dev0                      | PASS (0)      | 0 s   |
| migrate-dev1                   | PASS (0)      | 2 s   |
| seed-dev1                      | PASS (0)      | 0 s   |
| migrate-demo                   | PASS (0)      | 2 s   |
| seed-demo                      | PASS (0)      | 0 s   |
| generate                       | PASS (0)      | 2 s   |
| lint                           | PASS (0)      | 8 s   |
| tsc                            | PASS (0)      | 4 s   |
| unit                           | PASS (0)      | 8 s   |
| integration                    | PASS (0)      | 114 s |
| build                          | PASS (0)      | 13 s  |
| cards                          | PASS (0)      | 31 s  |
| e2e-prod0                      | PASS (0)      | 96 s  |
| e2e-prod1                      | PASS (0)      | 100 s |
| e2e-dev0                       | FAIL (1)      | 275 s |
| e2e-dev0-unchanged-rerun       | FAIL (1)      | 126 s |
| e2e-dev0-unchanged-clean-cache | PASS (0)      | 197 s |
| e2e-dev1                       | PASS (0)      | 158 s |
| audit                          | FAIL (1)      | 5 s   |
| audit-production               | PASS (0)      | 1 s   |

[Full audit](verification/agent-workday/audit-full.json) · [produktionsaudit](verification/agent-workday/audit-production.json) · [SQL-prober](verification/agent-workday/restricted-role-probe.json) · [källmatchning/städning](verification/agent-workday/source-cleanup.json) · [aktivering/bevarade bokningar](verification/agent-workday/activation.json) · [CI-resultat](verification/agent-workday/ci-results.json).

Schema/migrationer är byte-identiska mellan c4e, F1 och F2. Separat 9→10-prov på c4e bevarade en befintlig bokning med identisk hash och städade endast sin egen fixture: [ursprungligt resultat](verification/agent-workday/upgrade-result.json). Inga gamla användarbokningar raderades för att skapa testutrymme.

Operatörsfel: fryst runtime kunde inte byggas med node_modules som kataloglänk utanför Turbopacks rot. Originalfelet bevaras i [FAIL-logg](verification/agent-workday/runtime-build-junction-failed.txt). Efter vanlig filkopia läste TypeScript även en tillfällig gammal beroendelänk i roten: 6 135 extra filer gav minnesfel. Länken flyttades reversibelt utanför roten; samma byggkommando och oförändrade kontroller passerade sedan. [Diagnos](verification/agent-workday/runtime-link-diagnosis.json). Inga byggskydd eller tester sänktes.

Windows-dev0: [första FAIL](verification/agent-workday/matrix-e2e-dev0-initial-failed.txt) visar två äldre UI-fall. Nätspår visade HTTP200/201 men kall laddning/omdirigering över testets femsekundersfönster; ett följande försök fick starttimeout och varning om långsamt filsystem. Exakt bakomliggande IO-orsak är inte verifierad. Den gamla genererade cachen lades reversibelt undan och full oförändrad dev0/dev1 gick igenom; detta är inte bevis att all Windows-flakighet är löst. CI och Groks separata fullmatriser gick grönt utan dessa fel.

Grok: download-event fick timeout trots att den verkliga filen sparades och SHA256 verifierades. Chrome-skärmbilds-API fick timeout två gånger; inget påhittat skärmbildsbevis eller QA-GO har skapats. Originalrapporten och faktisk AX-observation finns, medan de riktiga nya UI-bilderna kommer från den märkta testvärden.

NOT RUN: fysisk iPhone/Safari, ny native-kortklickning, riktig kalenderimport/synk, fjärr-MCP och ny TLS-/backup-/flerinstansmiljö. Faktiskt läsanrop från denna Codex-anslutning lyckades med bookingEnabled=true. Separata SDK-processer genom den riktiga lokala launchern och ägarkonfigurationen återläste båda gamla bokningarna; detta är inte native-klickning. Ingen app var exponerad i sidopanelen. Nya native-klick, ägarprofilens hot-reload, fysisk iPhone/Safari och kalenderimport är NOT RUN. Nästa inläsning av den lokala anslutningen kan behövas innan ägarkortet syns; inget manuellt QA-uppdrag lämnas till Niclas. Ingen ny full videoinspelning; aktuella riktade bilder har proveniens och filhashar. Docker lokalt ej kört; eventuell CI-Docker särredovisas i Actions.

Mindre fynd ligger kvar: gammal kalenderfil-notis efter statusändring (AW-QA-3), fokus vid ägarkortets fel (AW-QA-4), tidigare sökfönster 28/35 dagar (CB-QA-1) och övriga Info enligt originalrapporterna. Samma secret och lokala MCP-identitet är avsiktligt samma kanal. Inga ytterligare fixloopar startas.

<!-- AGENT_WORKDAY_CURRENT_END -->

## Historik — tidigare leverans

# Verifiering — lokalt MCP-kort till admin

2026-11-13. Produkt **8126410af712bdd71d6b6a42c0a1fcc58055d28d**, feature/mcp-card-booking-proof.
Riktig PostgreSQL på7nya loopback \*\_test/\_demo; inga historiska migrationer ändrade.

| Faktiskt kommando / kontroll                                                              | Resultat                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node npm-cli.js ci (officiell lokal npm CLI)                                              | PASS571Windows installerade,572auditerade; ren installation.                                                                                                                                                                                                                                                          |
| node node_modules/prisma/build/index.js generate                                          | PASS7.10.1.                                                                                                                                                                                                                                                                                                           |
| node node_modules/prisma/build/index.js migrate deploy; node --import tsx prisma/seed.ts  | PASS9migrationer/seed på7nya DB.                                                                                                                                                                                                                                                                                      |
| node node_modules/eslint/bin/eslint.js .                                                  | PASS.                                                                                                                                                                                                                                                                                                                 |
| node node_modules/typescript/bin/tsc --noEmit                                             | PASS.                                                                                                                                                                                                                                                                                                                 |
| node node_modules/vitest/vitest.mjs run                                                   | PASS85/85.                                                                                                                                                                                                                                                                                                            |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts             | PASS113/113,25filer.                                                                                                                                                                                                                                                                                                  |
| node node_modules/@playwright/test/cli.js test --config playwright.time-card.config.ts    | PASS3/3,320/390/1024; egen stdio-testvärd.                                                                                                                                                                                                                                                                            |
| node node_modules/next/dist/bin/next build                                                | PASS.                                                                                                                                                                                                                                                                                                                 |
| node node_modules/@playwright/test/cli.js test --config playwright.card-booking.config.ts | PASS4/4 från produktionsbygge; dubbeltryck390/1024, upptagen tid och tappat svar efter commit → samma id i riktig admin.                                                                                                                                                                                              |
| node node_modules/@playwright/test/cli.js test; E2E_PRODUCTION=1,TRUST_PROXY_IP=0         | PASS46/46.                                                                                                                                                                                                                                                                                                            |
| Samma, E2E_PRODUCTION=1,TRUST_PROXY_IP=1                                                  | PASS46/46.                                                                                                                                                                                                                                                                                                            |
| Samma, E2E_PRODUCTION tom,TRUST_PROXY_IP=0                                                | PASS46/46.                                                                                                                                                                                                                                                                                                            |
| Samma, E2E_PRODUCTION tom,TRUST_PROXY_IP=1                                                | PASS46/46.                                                                                                                                                                                                                                                                                                            |
| Riktig launcher och SQL-roll, tillfällig HOME                                             | PASS13kontroller,20retries och nekade register/admin/UPDATE/DELETE. Egen provrad städad,0kvar. Inte aktiv klient.                                                                                                                                                                                                     |
| Separat bekräftelsebildprov                                                               | PASS320/390/1024: consent krävs,0horisontell scroll,0bokningsanrop. Egen Chromiumvärd.                                                                                                                                                                                                                                |
| Fryst runtime / fixture-städning                                                          | PASS451källfiler,0avvikelser (UTF8-LF/exakta binärer; genererad next-env undantagen). Testaffärsrader0.15/1hashade spärrposter integration/card. Demo1avsiktlig admin/1session;0bokningar vid kontroll.                                                                                                               |
| Faktisk lokal webbadministration                                                          | PASSegen CUA vanlig login i Chrome. Anonym/admin visar login200; anonym publish403; endast127.0.0.1:3187.                                                                                                                                                                                                             |
| npm audit --package-lock-only --json                                                      | FAILexit1:7moderate dev,0high/critical.                                                                                                                                                                                                                                                                               |
| npm audit --package-lock-only --omit=dev --json                                           | PASSexit0:0fynd.                                                                                                                                                                                                                                                                                                      |
| Grok                                                                                      | GO för avgränsad syntetisk lokal POC;4Low/1Info i backlogg,0Medium+. [Groks originalrapport](qa/QA-REPORT-card-booking-8126410.md)                                                                                                                                                                                    |
| Faktisk PC-kortkedja                                                                      | PASSanrop efter PC-omstart: bookingEnabled=true och tjänsteversion1. Niclas bekräftade själv bokning i native-kortet; databasen har2skilda bokningar,1create-event vardera och0överlapp. Codex verifierade båda i faktisk skyddad Chrome-admin och öppnade10.00-bokningens detalj. Egen native-kortklickning NOT RUN. |
| Actions på exakt pushad SHA                                                               | [Actions43430009174](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43430009174) —4gröna jobb på8126410 efter1riktad omkörning av dev0 (första försöket112/113 i gammalt refundtest, anslutnings-/testtimeout; ingen kod/testgräns ändrad, rotorsak inte fastställd).                               |

Exakta subprocesskommandon/exit/tider i [full-results](verification/card-booking/full-results.json)
och [fyrmatris](verification/card-booking/matrix-results.json). [Alla råutdata](verification/card-booking/README.md).
Miljö laddades uttryckligen från separata ignorerade testprofiler; inga secrets i loggar/Git.
MCP-läsläge2verktyg; opt-in3inklusive app-only book_demo_time.21ändrade/nya
produkt-/test-/scopedokumentfiler; package/lock/schema/auth/motor byte-oförändrade.
Privat plugin uppdaterat/aktiverat med lokal bokningsprofil.

**NOT RUN:** fysisk iPhone/Safari, ny mobil-/fjärr-MCP/OAuth, kundpilot,
Docker lokalt och ny deployment. Ingen ny video: riktade bilder för bounded prov.
Pluginrelease, native klient och CI får inte antas PASS från SDK/testvärden.
Nuvarande Grok-original gäller endast angiven revision och dess egna kontroller.
Groks egna prober: guard36PASS/8FAIL (8andra ensamma plattformsmarkörer) och
1nekad med annat felmeddelande; MCP90PASS/1FAIL (bokning+35dagar), launcher15/0,
DST/read-only11/0 ochUI69/0. Dessa FAIL är redovisade Low-fynd, inte dolda PASS.
Backlogg: CB-QA-1 UI28dagar/motor60; CB-QA-2 övriga miljömarkörer; CB-QA-3
crypto.randomUUID saknas i osäker värd och ger tyst knapp; CB-QA-4 okänt utfall
döljer försökt tid; CB-QA-5 17Tab till consent. Inget nytt rättningsvarv krävs
för scopedGO. Native värd måste ändå provas; ingen generell klient-GO.

## Appendix — initiala fel och faktisk gräns

Kolon i ny nyckelprefix nekades av gamla regex; underscore rättade detta.
Desktoptest valde dold mobil-länk; väljer nu synlig riktig kalenderlänk.
Bildgranskning fångade falsk ändringsvarning eftersom historisk trigger alltid
fyller initialStartsAt. Befintlig Booking.version används och kvittotext testas.
Slutmatrisen ovan är EFTER dessa rättningar. Ingen assertion/säkerhet sänktes.
Fryst lokal webbkopia missade först3genererade Next-junctions; de återskapades
inom egen runtime, normal login/API kontrollerades därefter. Ingen kodrättning.
MCP-bekräftelse är klientens försäkran. Stängt kort tappar lokal retry-nyckel:
vid okänt utfall krävs adminkontroll innan ett nytt försök, inte automatisk ombokning.

<!-- CARD_BOOKING_CURRENT_END -->

## Historik — tidigare leverans

# Verifiering — lokalt MCP-tidvalskort

2026-11-13. Produkt8648316 med enbart separat testoutput ändrad i
**a65f0f2ee5750044dd46c5db50453db5602b79f2**. feature/mcp-time-card.

## Aktuell resultattabell

| Kommando / kontroll                                                                      | Faktiskt resultat                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                                                                                   | Lokalt NOT RUN denna omgång; oförändrad package/lock och verifierade befintliga beroenden. Ny CI43417840017: ren npmci572Linux PASS. Föregående rena Windows-körning571paket i historiken.                                                                                                  |
| node node_modules/prisma/build/index.js generate                                         | PASS7.10.1,2s.                                                                                                                                                                                                                                                                              |
| node node_modules/prisma/build/index.js migrate deploy; node --import tsx prisma/seed.ts | PASS9migrationer/seed på6nya loopback \*\_test/\_demo. Inga historiska migrationer ändrade.                                                                                                                                                                                                 |
| node node_modules/eslint/bin/eslint.js .                                                 | PASS14s; slutlig riktad körning exit0.                                                                                                                                                                                                                                                      |
| node node_modules/typescript/bin/tsc --noEmit                                            | PASS7s; slutlig körning exit0.                                                                                                                                                                                                                                                              |
| RATE_LIMIT_STORE=memory node node_modules/vitest/vitest.mjs run                          | PASS83/83,17filer.                                                                                                                                                                                                                                                                          |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts            | PASS105/105,24filer,126.70s efter extra processtest. Tidigare104/104 separat.                                                                                                                                                                                                               |
| node node_modules/@playwright/test/cli.js test --config playwright.time-card.config.ts   | PASS3/3 vid 320/390/1024,6s efter isolerad outputDir. Verklig stdio/HTML, egen testvärd, inte ChatGPT.                                                                                                                                                                                       |
| node node_modules/next/dist/bin/next build                                               | PASS14s.                                                                                                                                                                                                                                                                                    |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test         | PASS46/46,92s.                                                                                                                                                                                                                                                                              |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test         | PASS46/46,104s.                                                                                                                                                                                                                                                                             |
| E2E_PRODUCTION= TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test          | FörstFAIL45/46 pga delad artifactmapp/ENOENT. Efter isolering/sekventiell omkörning PASS46/46,182s.                                                                                                                                                                                         |
| E2E_PRODUCTION= TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test          | PASS46/46,171s.                                                                                                                                                                                                                                                                             |
| Gitblob vs testkopia                                                                     | PASS207filer,0mismatch (LF-text/exaktbinär); docs/AGENTS/genererad next-env undantagna.                                                                                                                                                                                                     |
| Faktisk exponerad plugin-MCP                                                             | PASS list_services/show_time_picker i denna konversation; Anna16/Erik12tider16nov,450kr/30min. Källa8648316, produktkod identisk i a65. Ingen SDK-ersättning.                                                                                                                               |
| SDK/DB-läsroll                                                                           | PASS2verktyg, UI-MIME/metadatakoppling, read-only=on; Customer/contact42501, UPDATE25006; ingen publik lyssnare.                                                                                                                                                                            |
| npm audit --package-lock-only --json                                                     | FAIL exit1:7moderate dev,0high/critical; inga overrides eller uppgraderingar.                                                                                                                                                                                                               |
| npm audit --package-lock-only --omit=dev --json                                          | PASS exit0,0fynd.                                                                                                                                                                                                                                                                           |
| Grok oberoende QA                                                                        | Scoped GO lokal syntetisk POC påa65f0f2: egna npmci572,83unit/105integration/3kort/46webb×4 PASS, MCP63/0. Guard20PASS/2FAIL och UI38PASS/2FAIL:3Low/5Info, ingaMedium+.                                                                                                                    |
| Faktisk PC-rendering / klick / mobil                                                     | PC-kort visas på Niclas foton. Nytt foto visade hämtningsfel; därefter bekräftade Niclas 2026-11-13 lyckad kontroll: ”Tiden är fortfarande ledig. Ingen bokning har skapats.” Oförändrad produkt/runtime8648316. Inte egen CUA-klickning eller Grok; felorsak okänd. Mobil olöst.           |
| Privat push / GitHub Actions / deploy                                                    | Push a65f0f2 efter scopedGrokGO. Full [43417840017](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43417840017) PASS:4gröna46/46 påsammaSHA. Ren npmci572Linux,9migrate/seed,83unit/105integration/build/lint/tsc verifierade. Ingen deploy; Vercel95f8071 är oförändrad. |

Råutdata och exitkoder: [verification/time-card](verification/time-card/).
[Slutlig källmatchning](verification/time-card/source-freeze-final.json),
[faktiskt klientanrop](verification/time-card/actual-tool-call.json),
[SQL-läsroll](verification/time-card/launcher-check.json),
[städning](verification/time-card/cleanup.json), [bildmanifest](assets/time-card/manifest.json).
Integration har16hashade RateLimitBucket kvar; alla egna Booking/Event/Customer/
DataAction/Campaign/Decision/AdminUser/Session/WorkspaceRequest0 i6miljöer.

**NOT RUN:** egen strukturerad fysisk iPhone/Safari/WebKit-provning, egen faktisk ChatGPT-klickning, ny video,
fjärr-MCP/OAuth/tunnel, kundpilot och ny produktionsdrift. Groks
[oförändrade originalrapport](qa/QA-REPORT-time-card-a65f0f2.md) redovisar egna kommandon. Ingen ny lokal Windows-npmci eller Dockerinstallationsprovning; CI körde ren npmci och Docker Compose på GitHub.
Nya kort-UI-konfigurationen körs uttryckligen separat; befintlig CI har ännu
ingen egen step för den. Lint/unit/integration/webb-E2E omfattas av gamla workflow.

Uppföljningen av användarens hämtningsfel ändrade endast dokumentation.
Inga tester, lint, build, audit eller CI kördes om för dessa textändringar.
Tidigare PASS gäller revisionerna ovan, inte ett nytt korrigerat klientbygge.
Ingen rättning eller stabilitetsgaranti tillskrivs den senare lyckade kontrollen.

## Appendix — QA, klientbevis och begränsningar

Grok har2UI-fail om tangentbordsfokus (Low1), vald hoverkontrast cirka1,15:1
(Low2),2guard-fail för VERCEL/VERCEL_URL ensamma (Low3). IngetMedium+.
Info: saknad DBURL ger säker stacktrace före guarden; ören avrundas i pris;
vald månadsrubrik täcker inte hela veckospannet (dagknapparna har månad);
klient utan tool-result saknar fallback; list_services saknar2extraannotations.
Dessa är backlogg, ingen ny fixloop. Ingen full kundpilot eller allmän
klientkompatibilitet är godkänd.

Senare i samtalet gav användaren riktiga PC-foton: rendering nu observerad
från dessa bilder, inte egna klick. Mobilen visar enligt användaren inget kort.
[Runtime/fotobevis](verification/time-card/runtime-and-user-photo-proof.json)
visar206matchade filer; endast Playwrightkonfig skiljer runtime864 motQAa65.
Fotooriginal är användarbilagor och kopior utanför Git. Inget nytt Grok-GO
tillskrivs dessa foton. Nedladdningshändelsen för QA-rapporten gav timeout,
men filen sparades faktiskt i Downloads; originalhashen kontrollerades.
Pluginsharing-API gav400 (USER-scope); ingen retry eller delningsändring.
PRIVATE/USER verifierades vid skapandet, ingen ny publik publicering.

## Appendix — operatörsfel och omkörningar

Första setup stoppade före DBskapande medECONNREFUSED: lokal PG var avstängd.
Native pg_ctl start återhämtade befintlig cluster och lät tidigare data bestå.
Första readerprov gav42501, eftersom Prisma även hämtar Booking.id. Endast id
lades till de5tids-/filterkolumnerna; kontaktkolumner förblev nekade.

Jag körde ett nytt Playwrightkorttest parallellt med webb-E2E i olika DB men
samma utmatningsmapp. Det raderade den andra körningens traceartefakt och gav
dev0 45/46/ENOENT vid context.close. a65f0f2 flyttar kortartefakter till
demo-artifacts/time-card/test-results. Alla omkörningar var sekventiella och
passerade utan sänkta assertions. Ursprunglig FAIL finns kvar i verification.json.

## Historik — föregående verifierade leverans

# Verifiering — kundlivscykel och verkligt lokalt agentprov

2026-11-13. Produkt **95f807196f9b15e0bae2afdcd89604837cf747dd**, feature/customer-lifecycle-agent-proof.
Dokumentation/bilder därefter är separata. Endast syntetiska data; pilot NO-GO.

## Aktuell resultattabell

| Körda kommandon / kontroll                                                               | Faktiskt resultat efter fix1                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --offline --no-fund --no-audit                                                    | PASS571Windows-paket,6m i ny lokal runtime. Oförändrad lockfil.                                                                                                                                                                                     |
| node node_modules/prisma/build/index.js generate                                         | PASS7.10.1,3s; även isolerad runtime.                                                                                                                                                                                                               |
| node node_modules/prisma/build/index.js migrate deploy; node --import tsx prisma/seed.ts | PASS9migrationer/seed på6nya loopback55451 \*\_test/\_demo. Historiska8oförändrade.                                                                                                                                                                 |
| node node_modules/eslint/bin/eslint.js .                                                 | PASS exit0,14s.                                                                                                                                                                                                                                     |
| node node_modules/typescript/bin/tsc --noEmit                                            | PASS exit0,8s.                                                                                                                                                                                                                                      |
| RATE_LIMIT_STORE=memory node node_modules/vitest/vitest.mjs run                          | PASS79/79,16filer.                                                                                                                                                                                                                                  |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts            | PASS99/99,23filer,89.81s. Nytt kvot-/kontaktregressionstest.                                                                                                                                                                                        |
| node node_modules/next/dist/bin/next build                                               | PASS exit0,17s.                                                                                                                                                                                                                                     |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test         | PASS46/46,119s.                                                                                                                                                                                                                                     |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test         | PASS46/46,113s.                                                                                                                                                                                                                                     |
| E2E_PRODUCTION= TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test          | PASS46/46,206s.                                                                                                                                                                                                                                     |
| E2E_PRODUCTION= TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test          | PASS46/46,164s.                                                                                                                                                                                                                                     |
| 8→9uppgradering/återseed efter fix1                                                      | PASS ny \*\_demo, äldre kolumner bevarade vid migration; efter manuell kontaktåtgärd även äldre råkvot→HMAC, teknisk historik/beslut består. Seed2gånger sammahashar,0överlapp.                                                                     |
| Gitblob mot testkopia                                                                    | PASS196produkt-/konfig-/test-/assetfiler,0mismatch, LF-normaliserad text/exaktbinär; docs/AGENTS/genererad next-env undantagna.                                                                                                                     |
| Städning                                                                                 | PASS5miljöer:0Booking/Event/Customer/DataAction/Campaign/Decision/AdminUser/Session/WorkspaceRequest. Integration10hashade RateLimitBucket kvar;4E2Emiljöer0.                                                                                       |
| Faktiska Codex MCP-verktyg                                                               | PASS read/inspect/draft/retry/changedretry/confirmedfalse/stale. MCPe2e0e39; server/workspace/capacity oförändrade i95f8071. Inte en shell-/SDK-ersättning.                                                                                         |
| Egen CUA+DB för agentprov                                                                | PASS samma opublicerade20%-utkast16november efterreload; kalender16nov/Sam, återbokning09viawebb95f8071, MCP/UIstale;1beslut/1ledger, nekade0,0överlapp. Negativconfirmedfalse är inte verkligt mänskligtnej.                                       |
| Egen CUA för kunddata                                                                    | PASS eget påhittat kort→förbereddexport→preview/disabled→kryss→bekräfta→reloadarkiverat. Mobilbild375×812; nedladdningsinnehåll separat E2E.                                                                                                        |
| npm audit --package-lock-only --json                                                     | FAIL exit1,7moderate dev,0high/critical. Inga paket-/lockändringar.                                                                                                                                                                                 |
| npm audit --package-lock-only --omit=dev --json                                          | PASS exit0,0fynd; inte pilotgodkännande.                                                                                                                                                                                                            |
| Oberoende Grok initial                                                                   | Syntetisk GO med MediumLC-QA-1 påe2e0e39. Egna79unit/98integration/46prod-E2E, API77/1(Medium), MCP27/0, UI52/0.                                                                                                                                    |
| Oberoende Grok fix1                                                                      | GO syntetisk POC på95f8071, LC-QA-1 stängt, inga Medium+. Egna79unit/99integration/46prod-E2E, LC-prob23/0, MCP27/0,8843→95fupgrade. Agentprovet endast underlagsgranskat.                                                                          |
| gh workflow run verify.yml --ref feature/customer-lifecycle-agent-proof                  | [43393207291](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43393207291) success på95f8071:4gröna46/46, npmci572Linux/generate/9migrationer/seed/lint/79unit/99integration/build/tsc. Push43393207637 cancelled av manualmatris. |
| Skyddad faktisk Vercel Preview och stabil alias                                          | PASS dpl_<redacted>, READY target=null, fra1, customsourceRevision95f8071 verifierad viaCLIAPI; exaktGitarchive. Stabil alias→sammaID.                                                                                            |
| Molnflöden                                                                               | PASS en demoknapp, exportdownload/100max/auth/origin/strict/no-store, framtida-besökguard, UIremove/20retries→1åtgärd och ändradretry409. Snapshot/version/pris består, logout/copiedcookie403.320/390/1440 PASS.                                   |
| Egen CUA i stabil preview                                                                | PASS färdigladdat borttaget kort och avbokad historik450kr. CSS390×844 verifierat; returneradbild247×844skalad. Fullpage-försök timeout, vanligbild lyckades. Ingen fysisk iPhone.                                                                  |
| Äldre molndata                                                                           | PASS92Booking/33Customer/107Event/4Campaign/3CapacityDecision/6Service/5Staff oförändrade. Slut93/34,0överlapp, endast example.test; eget provkort/1avbokadbokning tillkom.                                                                         |
| Perimeter/TLS/direktport                                                                 | PASS5READY-URL:er+stabilalias,24HTML/API/assetprober skyddade, newchunk skyddad, SSOall; TLS1.3certverifierat; port3000ejansluten inom5s, ingen fullportscan.                                                                                       |
| Krypterad backup/återläsning                                                             | PASS före12/efter13tabeller i nya lokala \*\_demo, alla radhashar matchar, AES-256-GCM/tampernekas, separat befintlignyckel bevarad; lokalPC, ejautomatiskoffsite.                                                                                  |
| Slutlig SDK-launcher95f8071                                                              | PASS6tool/4förslag/0writes; nästa befintliga registreringsstart pinnad95f8071. Faktiskt huvudklientprov e2e0e39/identisk kapacitetskod särredovisas.                                                                                                |

Råkommandon/exitkoder och utdata: [verification/lifecycle](verification/lifecycle/),
[matris](verification/lifecycle/verification.json), [källmatchning](verification/lifecycle/source-freeze.json),
[uppgradering](verification/lifecycle/upgrade-proof.json), [faktiska verktyg](verification/lifecycle/owner-tool-transcript.json),
[DB-kontroll](verification/lifecycle/owner-proof-db.json). Rawrot:
C:/Users/<user>/booking-lab-pg-test/lifecycle. Initiale2e0e39-resultat är
separat historik; data-/profil-/token-/dumpfiler ingår inte i underlaget.

**NOT RUN:** fysisk iPhone/Safari/WebKit/NiclasUX-godkännande, nyvideo, forceradVercelomstart/flerinstansfel, fjärr-MCP/OAuth, verkligt mänskligtnej i agentprov, automatisk gallring/externbackup och kundpilot. Grok hade ingen PC/Codex/previewåtkomst; deras övriga3E2Elägen NOT RUN. Nästa pinnadeMCP-start95f8071 är SDK-testad; huvudsaklig faktisk agentkörning e2e0e39/identisk kapacitetskod. Inga nya betaltjänster eller mainmerge.

[Grok original](qa/QA-REPORT-lifecycle-fix1-95f8071.md) SHA2561a07d93fb6eff74a8996882883537303ee33bcf7b5bb0cf3971bb14a2f7b4a9b. [CI med steg](verification/lifecycle/ci-43393207291.json), [CI-utdrag](verification/lifecycle/ci-selected-output.txt), [drift](verification/lifecycle/live-result.json), [stabil alias](verification/lifecycle/stable-alias.json), [slutläsning](verification/lifecycle/final-cloud-read.json), [backup](verification/lifecycle/after-migration-backup.json). [Bildmanifest](assets/lifecycle/manifest.json).

## Appendix — driftprober och efterföljande dokumentation

Driftkontrollen antog id på alla tabeller och stoppade före migration. Första95fbygget startades för tidigt av operatören och avbröts(CANCELED) utan aliasbyte; rättat script gav migrationPASS och nyttREADYbygge. Ingen produktkod ändrades eller ny QA-loop startades. Före-kontrollens första misslyckade försök hade0migrationssteg. Verklig driftprob använde först inaktiva basfixture-ID(400) och läste sedan pris ur bookingSummary, som saknar prisfält. [Attempt1](verification/lifecycle/attempt1-old-service-config.json) och [attempt2](verification/lifecycle/attempt2-summary-price-assumption.json) bevaras. Samma eget provkort återanvändes, rätt aktiva resurser lästes viaAPI och existerande exporterad snapshot blev prisreferens. Slutkontrollen PASS utan fler bokningar/borttagningar; inga produktassertions togs bort.

All kod förblev95f8071. Därefter ändrades endast Markdown/bilder/råa bevis. Arkitekturens äldre klartextbeskrivning rättades som dokumentation(LC-F1-QA-2), inget andra fixvarv.

## Appendix — LC-QA-1 och faktiska klientförsök

Initiale2e0e39 hade79/98/46×4PASS men missade rå emailCapKey i kopplad MCP-
bokning. Grok hittade detta. Fix1 lagrar nya HMAC och omkodar äldre kopplade
nycklar; kvoten räknar båda. Inga nya migrationer. Ursprunglig rapport och
fixrequest är bevarade, inte omskrivna som PASS. Infos LC-QA-2–7 är backlogg.
Formatering gjordes med temporär Prettier3.6.2CLI; inget projektberoende
eller lockfil lades till. Äldre ännu inte hanterade kvotrader kan ha rå e-post.

Ett nytt uppgraderingsförsök fick generiskt schemaenginefel innan migration
med ärvt--env-file; ny separat DB och explicit profilenv gav PASS utan
källändring. NativeAX fungerade men bildfångsttimeout hindrade settingsklick.
De6faktiska verktygen blev senare synliga utan att användaren behövde göra
något. Orsaken till den fördröjda klientomladdningen är inte fastställd.

## Appendix — tidigare försök i denna leverans

Första D:-matrisen79/98/46×4PASS. Därefter skyddades ett gammalt saved=1-
meddelande från att påstå att gamla kontakter är oförändrade efter explicit
kontaktborttagning. Ett nytt E2E-påstående verifierar detta. Ovan är sista
matrisen efter rättningen. Lokal data/-ignore var för bred och dolde den nya
API-rutten; den begränsades till rotens /data/ innan fryst arkiv/källmatchning.

Tidiga operatörsförsök: --env-file genom Nextbyggarens worker gav förbjuden
NODE_OPTIONS; explicit env gav vanlig buildPASS. Testwebben ärvde PORT3015
medan Playwright väntade3000; explicit PORT3000 i testwebserver rättade detta.
Ett nytt test matchade /customers/new för tidigt; väntan på kortets rubrik
rättades. Ett alert-påstående avgränsades till Kunddata. Ingen assertion eller
säkerhetskontroll sänktes. Första npm-ci-wrappern kvoterade inte ProgramFiles;
den startade inte npm. Direkt npmci ovan PASS. Försökt lokal formatter sökväg
saknade paket; inget nytt paket installerades, lilla rutten formaterades manuellt.
Git-jämförelsens första filtypslista missade .prisma/.mts/dotfiles; full LF-
normalisering för alla textformat gav0mismatch, inte ändrade produktfiler.

## Appendix — föregående verifierade leverans

# Verifiering — levererad proaktiv kapacitetsöversikt

2026-11-13. Produkt-/Grok-/CI-/deploykod **8843d06350c6478e375fb640579cb3ac4f7fe3dc**,
feature/proactive-capacity-overview från28a48fe. Dokument-/bildändringar efter
QA är separata. Endast syntetiska uppgifter. Pilot NO-GO.

## Historisk resultattabell (8843d06)

| Körda kommandon / kontroll                                                               | Faktiskt resultat                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --offline --no-fund --no-audit                                                    | PASS exit0,571paket,4m i tom Windows-testkopia på C:. Oförändrad lockfil; Linux/Grok/CI har plattformsberoende valfria paket.                                                                                                             |
| node node_modules/prisma/build/index.js generate                                         | PASS exit0,7.10.1.                                                                                                                                                                                                                        |
| node node_modules/prisma/build/index.js migrate deploy; node --import tsx prisma/seed.ts | PASS8migreringar/grundseed på6nya loopback_test/\_demo, separat prod0-v3_test vid sista körningen. Historiska7orörda.                                                                                                                     |
| BOOKING_DEMO_SEED=1 node --import tsx scripts/seed-capacity.ts                           | PASS lokal additiv demo och7→8uppgraderingskopia; andra seedens samtliga tabellhashar identiska,0överlapp.                                                                                                                                |
| node node_modules/eslint/bin/eslint.js .                                                 | PASS exit0,7s.                                                                                                                                                                                                                            |
| node node_modules/typescript/bin/tsc --noEmit                                            | PASS exit0,3s.                                                                                                                                                                                                                            |
| RATE_LIMIT_STORE=memory node node_modules/vitest/vitest.mjs run                          | PASS78/78,15filer,7.03s.                                                                                                                                                                                                                  |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts            | PASS90/90,21filer,77.26s, riktig PostgreSQL.                                                                                                                                                                                              |
| node node_modules/next/dist/bin/next build                                               | PASS exit0,7s; verkligt produktionsbygge.                                                                                                                                                                                                 |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test         | PASS42/42,86s.                                                                                                                                                                                                                            |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test         | PASS42/42,87s.                                                                                                                                                                                                                            |
| E2E_PRODUCTION= TRUST_PROXY_IP=0 node node_modules/@playwright/test/cli.js test          | PASS42/42,153s.                                                                                                                                                                                                                           |
| E2E_PRODUCTION= TRUST_PROXY_IP=1 node node_modules/@playwright/test/cli.js test          | PASS42/42,162s.                                                                                                                                                                                                                           |
| npm audit --package-lock-only --json                                                     | FAIL exit1:7moderate,0high/critical; enbart ESLint/typescript-eslint/minimatch-devkedjan.                                                                                                                                                 |
| npm audit --package-lock-only --omit=dev --json                                          | PASS exit0:0fynd. Inte ett generellt säkerhets- eller pilotgodkännande.                                                                                                                                                                   |
| Gitarchive mot testkopia                                                                 | PASS167kod-/konfig-/asset-/testfiler matchar8843d06; LF-normaliserad text och exakt binär jämförelse. Inga källändringar i testkopian.                                                                                                    |
| Teststädning                                                                             | Alla fem testmiljöer:0Booking/BookingEvent/Customer/Campaign/CapacityDecision/AdminUser/AdminSession/WorkspaceRequest. Integration har14hashade RateLimitBucket-rader kvar; fyra E2E-miljöer0.                                            |
| Oberoende Grok, fix1                                                                     | GO syntetisk POC; PRO-QA-1 stängt. Egna78unit/90integration/42prod-E2E, lint/tsc/build och51UI-prober PASS. Fyra mindre backlogfynd, inga blockerare/Medium+.                                                                             |
| gh workflow run verify.yml --ref feature/proactive-capacity-overview                     | [43353236981](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43353236981) success på8843d06: fyra42/42jobb,78unit/90integration, npmci/migrate/seed/lint/tsc/build. Push43353218140 avbröts av manuell fullmatris.      |
| Skyddad Vercel Preview och stabil alias                                                  | PASS READY dpl_<redacted>, sourceRevision8843d06, target=null, fra1; source archive av exakt Git-SHA. CLI API kompletterade connectorns utelämnade custom metadata.                                                     |
| Molnmigration/seed/historik                                                              | PASS8migreringar;84äldre bokningshashar identiska; seed två gånger identisk; slut92bokningar/33kunder/4kampanjer/3beslut;0överlapp och endast example.test.                                                                               |
| Verkliga driftflöden                                                                     | PASS ett demoklick, minimerad/bounded API, origin403,20samtidiga draft→1id, replay/ändrad payload409, UI/save/reload, rebook→stale, opublicerat utkast, logout/kopierad cookie403. Ingen publik MCP.                                      |
| HTML/API/resurser/TLS                                                                    | PASS alla4READY-URL:er+stabil alias kräver Vercel302 utan auth. Nya resurser/static chunk/POST skyddade. HTTPS/certifikat, säkerhetsheaders, HTTP308. Ingen TCP-anslutning till port3000 observerades inom5s; ingen full nätverkspentest. |
| Stabil alias, utan appsession                                                            | PASS produkt200 bakom befintlig Vercel-auth, capacityAPI403. Overview ger200 med Nexts streamade loginredirect och inga kapacitetsdata; HTTP200 betyder inte adminåtkomst.                                                                |
| Egen faktisk Computer Use i preview                                                      | PASS390px: demoinloggning, Översikt→16nov/Sam,20%-villkor/datumval→förhandsgranskning utan sparande, verkligt stale-kort. Nya faktiska390/1440-bilder granskade. Automatiskt layoutprov även320px.                                        |
| Krypterad backup/återläsning                                                             | PASS före migration11tabeller och efter drift12tabeller, alla radhashar identiska. AES-256-GCM, manipulerad data nekas, befintlig separat nyckel bevarad. Lokal PC-backup, inte automatisk offsite.                                       |

Råkommandon/exitkoder och oförändrade textkopior av utdata finns i [verification/proactive](verification/proactive/):
[lokal manifest](verification/proactive/final-local-manifest.json), [matris](verification/proactive/verification.json),
[unit](verification/proactive/unit.txt), [integration](verification/proactive/integration.txt),
[CI med steg](verification/proactive/ci-43353236981.json), [drift](verification/proactive/live-result.json)
och [slutlig molnläsning](verification/proactive/final-cloud-read.json).
Lokal manifest är tidsstämplad före QA/CI/deploy; dess dåvarande NOT RUN ersätts
av separata senare bevis, inte efterhandsändrad råhistorik. Full lokal rårot:
C:/Users/<user>/booking-lab-pg-test/proactive. Hemliga profiler/dumpar/nycklar
och browserstate ingår inte. Utvalda riktiga bilder i [DEMO](DEMO.md).

[Grok original8843d06](qa/QA-REPORT-proactive-fix1-8843d06.md), SHA256
24763222f4002aa0edf4b3b8e5dd0e75af4aa0c9335d067832095bc0acc9b639.
Initiala [956155f-rapporten](qa/QA-REPORT-proactive-956155f.md) och fixbeställning
bevaras. Groks9API/MCP-probfel och1HTML-probfel var fel i deras egna prober,
rättade enligt originalrapporten; de är inte dolda produktfel. Grok körde
inte egen fyrmatris eller preview. Codex egna resultat särredovisas ovan.

**NOT RUN:** fysisk iPhone/Safari/WebKit och Niclas UX-godkännande, ny video,
forcerad Vercelomstart/multi-instance-felinjektion, automatisk extern backup,
skarpa integrationer/kundpilot. Dessa kallas inte godkända. Inga nya paket,
audit-overrides, mainmerge, publik MCP eller betaltjänster införda.

## Appendix — initiala lokala försök och första QA

956155f hade78unit/89integration/42E2E×4 PASS. Första fix1-prod0 gav40PASS/2FAIL
eftersom nätverksmocken inte fångade nya queryparametrar. Adressmönstret
rättades utan sänkta assertions; därefter riktat2/2 och slutmatrisen ovan PASS.
Ett kopieringsförsök kördes från fel arbetskatalog innan exakt källfil synkades.
En första screenshot fångade laddning och används inte som produktbevis;
de valda färdigladdade bilderna är senare verifierade.

Tidigare operatörsförsök på belastad D:-disk avbröts. Separat ren C:-kopia
och kopierad betrodd browsercache gav full PASS; inga tidsgränser/assertions
sänktes. En tidig tsc kördes före avslutad installation, seedpoolens .$disconnect
rättades och en ny CHECK fick ett unikt namn före första leveransen; nya
v2databaser användes efter misslyckad v1migration, ingen historik omskrevs.
Unit ärvde tillfälligt postgres-env och fick8FAIL; rätt minnesenv gav78PASS.
Nya MCP-testets två faktiska kallstarter fick uttryckligt30s-fönster.
Lokalt efter faktisk serveromstart956155f fanns sparad kampanj kvar. Detta
är lokal historik, inte en påstådd omstart av den nya Vercelmiljön.

## Appendix — föregående Epic 06-verifiering (2026-11-12)

2026-11-12. Produkt-/QA-/deploykod **7c1407dce66910ef8ab304c882c90d90c173ca72**, branch **feature/epic06-customers-demo-product**.
Dokumentation/bildbevis efter QA är separata från produktkoden. Lokal faktisk
råutdata: C:/Users/<user>/booking-lab-pg-test/epic06. Utvalda råutdrag och JSON
i [evidence-epic06](qa/evidence-epic06); full CI-logg via [Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796).

### Historisk resultattabell

| Kommando/kontroll                                                            | Faktiskt utfall                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --no-fund --no-audit                                                  | PASS exit0,571 paket Windows, lucide-ci.log. ESLint9-deprecation kvar. Linux/Grok/build572; ingen manifestversionsskillnad.                                                                                                                               |
| npx prisma generate                                                          | PASS: 7.10.1. Lokalt körd via node node_modules/prisma/build/index.js generate; CI kör npx.                                                                                                                                                               |
| npm run db:migrate / db:seed                                                 | PASS: 7 migrationer+grundseed på nya booking*epic06_lucide*{integration,prod0}\_test. CLI via node Prisma/tsx; alla gamla migrationer oförändrade.                                                                                                        |
| npm run lint / npx tsc --noEmit / npm run build                              | PASS: 0; lokalt motsvarande installerade eslint/tsc/Next-CLI. Samma npm-kommandon även verifierade i CI.                                                                                                                                                  |
| npm test                                                                     | PASS: 76/76,14 filer,7.80s; node node_modules/vitest/vitest.mjs run lokalt.                                                                                                                                                                               |
| npm run test:integration                                                     | PASS: 84/84,20 filer,79.20s; node Vitest med vitest.integration.config.ts. Ny seed-CLI-test skapar/städar endast egen slumpad loopback_demo-databas.                                                                                                      |
| RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e | PASS: 40/40,1.8m, desktop+mobil på7c. Lokalt node Playwright-CLI.                                                                                                                                                                                         |
| Föregående samlade rättning aab9fdf, före Lucide                             | PASS: 40/40×4 i prod0/prod1/dev0/dev1,1.7m/1.2m/4.2m/3.0m. Redovisas inte som lokal fyrmatris på7c.                                                                                                                                                       |
| Slutstädning lokal7c                                                         | PASS: 0 egna bokningar/kunder/kampanjer/admins/sessioner/ledger/events/spärrposter i både integration och prod0.                                                                                                                                          |
| Actions43301797796 på7c                                                      | PASS: 4/4jobb:dev0 40/40(2.2m),dev1 40/40(2.6m),prod0 40/40(1.2m),prod1 40/40(1.2m). CI76 unit/84 integration/lint/tsc/build PASS; Docker Postgres faktiskt körd.                                                                                         |
| npm audit --json                                                             | **FAIL exit1:7 moderate,0 high/critical**. Samma upstream-blockerade minimatch/ESLint-kedja; ingen major/override/canary införd.                                                                                                                          |
| npm audit --omit=dev --json                                                  | **PASS exit0:0fynd**. Skilt från funktionstester och pilotbeslut.                                                                                                                                                                                         |
| Groks egen frysta återkontroll7c                                             | PASS: 76 unit/84 integration/40 prod-E2E och lint/tsc/build. Seedspoof/uppgradering,12 sökprov,33 gate-on-mätningar320/390/1440; verklig återbesöksklickning. GO syntetisk skyddad preview efter1fixvarv; NO-GO pilot.                                    |
| Lokal uppgraderingskopia                                                     | PASS: 37ursprungliga snapshots bevarade,83 bokningar/32 kort,0 överlapp; återseed0 nya och oförändrade hashvärden. Publik spoofad seednyckel förblir olänkad.                                                                                             |
| Molnmigration+seed                                                           | PASS: 7 migrationer,35 äldre snapshots bevarade.46 nya+33 befintliga; följande tre0 nya/79 befintliga. Sju tabellhashar identiska vid sista återkörningen.                                                                                                |
| Faktiskt Vercelbygge                                                         | PASS Linuxamd64,124 vitlistade filer,572 byggpaket/54 runtimepaket, Prisma+Nextbuild, ursprunglig nativehash och Lucide-notiser. READY Preview target=null, dpl_<redacted>, fra1; build cle1/USA.                                       |
| Faktisk perimeter/TLS                                                        | PASS stabil och immutable alias, HTML/admin/API/POSTdemo/AI-asset/statisk chunk skyddade. Vercel SSO alla deployments,1ägare. Giltig TLS1.3, appheaders och no-store; direkt3000ejnåbar(4s timeout). Ingen publik MCP.                                    |
| Faktiska kundflöden                                                          | PASS: 67 kontroller i faktisk skyddad deployment: demoentry, minimala listor, kort/historik, skapa+reload, kalender→kort, kontaktedit med gammal snapshot kvar, flytt/avbokning/återbesök/arkiv, publikt201 och ingen kundlänk.                           |
| Faktisk mobil/desktop                                                        | PASS: 320/390/1440inklusive långa synliga kontakter. Fem riktiga färdigladdade bilder tagna via stabil länk390×844; faktisk iPhone/Safari NOT RUN.                                                                                                        |
| Faktisk session/beständighet                                                 | PASS: samma bokningssvar/session efter90197 ms; logout och kopierad cookie403. Ingen framtvingad omstart; startup-loggar observerade men inte knutna till just persistensrequesten.                                                                       |
| Backup/återläsning                                                           | PASS före migrering10 tabeller och efter egna molnflöden11 tabeller, alla radantal/hashar identiska. pg_dump18.7 verify-full, AES256GCM, manipulering nekas. Befintlig separat nyckel bevarad. Lokal krypterad PC-backup, ingen automatisk offsitebackup. |

[Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md), SHA256 **5c1f5194d76fb2b88bb5ce05b7c3c7c0b3a68a4451cc50fd71c12bbcfc8a4381**. Grok hade ingen moln- eller GitHub-åtkomst.
Moln-/CI-bevisen ovan är Codex egna, inte tillskrivna Grok. Den manuella
fyrmatrisen ersatte push-jobbet43301798348 som avbröts av concurrency.

## Avvikelser och NOT RUN

Initial024-körning på Windows fick dev-starttimeout120s/slow filesystem;
genererad cache bevarades genom namnbyte, oförändrade tidsgränser och samma
kod passerade sedan38×4. Första nya seedtestets ProcessEnv-typ nekades av
build; rättat med explicit NODE_ENV:test, utan ignorerade typer. Slut7c är grön.
Groks egna miljömissar med ärvt NODE_ENV/namespace finns i originalrapporten.

Operatörens första avslutande moln-SQL använde reserverat alias overlaps och
föll EFTER lyckad migration och tre seedkörningar. Endast kontrollfrågan
rättades; ingen reset eller ny migration. En extra återseed med hashjämförelse
passerade. Tidig återbesöksbild visade laddning och kasserades som bevis;
slutbilderna visar vald tid och aktiv bokningshandling.

NOT RUN: fysisk iPhone/Safari, WebKit/Firefox/screenreader, framtvingad omstart,
kommersiell last-/flerinstanscertifiering, exakt fakturaförbrukning, automatisk
extern backup och ny fullvideo. Lokal Docker Desktop ej körd; CI körde faktisk
Docker Postgres och Vercel körde verkligt containerbygge. Normal individuell
inloggning testad positivt lokalt/CI/Grok, endast normalform plus demoaktör i
nya molnet; inga nya mänskliga konton skapades. Lokal slut7c-E2E körde prod0;
övriga tre slutlägen är verifierade i exakt7c-CI, inte påstått körda lokalt igen.

Inga tester försvagades och inga riskabla paketuppgraderingar gjordes.
Pilot för riktiga kunder är fortsatt NO-GO.

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Verifiering — användbarhet och förenklad demoåtkomst

## Avgränsad auditomgång 2026-11-12

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.

2026-11-12. Produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**, branch ui/epic05-booking-usability. Enbart dokumentation/bilder tillkommer efter fryst QA. Alla kommandoutdata finns utanför Git i C:/Users/<user>/booking-lab-pg-test/ui-usability. Utvalda maskinresultat i [evidence-ui](qa/evidence-ui).

### Historisk resultattabell d7bc47f

| Kommando/kontroll                                  | Faktiskt resultat                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --no-fund --no-audit                        | PASS570packages; oförändrad lockfile, ESLint9 deprecation kvar.                                                                                                                                                                                                                                                                  |
| npx prisma generate                                | PASS7.10.1.                                                                                                                                                                                                                                                                                                                      |
| npm run db:migrate; npm run db:seed                | PASS sex oförändrade migrationer och seed på nya isolerade loopback \*\_test-databaser för slutmatrisen.                                                                                                                                                                                                                         |
| npm run lint; npx tsc --noEmit                     | PASS exit0, lint-fix2-final.log / tsc-fix2-final.log.                                                                                                                                                                                                                                                                            |
| npm test                                           | PASS75/75, unit-fix2.log.                                                                                                                                                                                                                                                                                                        |
| npm run test:integration                           | PASS75/75,75.24s. Ytterligare helt ny delivery_integration_test75/75,68.8s.                                                                                                                                                                                                                                                      |
| npm run build                                      | PASS Next16.4.6 / Prisma7.10.1, build-fix2.log.                                                                                                                                                                                                                                                                                  |
| RATE_LIMIT_STORE=postgres npm run test:e2e (prod0) | PASS34/34,1.2m, egen booking_ui_fix2_prod0_test.                                                                                                                                                                                                                                                                                 |
| Samma prod1                                        | PASS34/34,58.6s, egen booking_ui_fix2_prod1_test.                                                                                                                                                                                                                                                                                |
| Samma dev0                                         | PASS34/34,6.7m (lokal filcachekompaktering), egen booking_ui_fix2_dev0_test.                                                                                                                                                                                                                                                     |
| Samma dev1                                         | PASS34/34,1.8m, egen booking_ui_fix2_dev1_test.                                                                                                                                                                                                                                                                                  |
| Slutstädning                                       | PASS0 egna bokningar/kampanjer/admins/sessioner/spärrposter/workspaceRequests/events i samtliga fyra test-DB.                                                                                                                                                                                                                    |
| npm audit --json                                   | FAIL exit1,7moderate,0high/critical; inga riskabla overrides/majorbyten.                                                                                                                                                                                                                                                         |
| npm audit --omit=dev --json                        | PASS0fynd. Separat från funktionstester.                                                                                                                                                                                                                                                                                         |
| Actions43275980287                                 | PASS exakt d7:dev0 34/34(1.4m),dev1 34/34(1.5m),prod0 34/34(52.0s),prod1 34/34(39.5s). HTTP memory-default i CI; lokal matris postgres.                                                                                                                                                                                          |
| Grok fryst slutrevision                            | GO för skyddad syntetisk preview, NO-GO pilot. Egna75unit/lint/tsc/build,34prod0,2riktade dev+prod; slutlig riktig hjul-/tangentbordsprovning av kalender. Föregående fix1 hade75integration och66HTTP-gateprober; oförändrad auth återtestades inte i slutvarvet. Ingen cloudåtkomst eller granskning av våra aktuella Actions. |
| Verkligt Vercel containerbygge                     | PASS Buildah Linuxamd64,105källfiler, Prisma/Nextbuild och minimalruntime53paket; revision d7, deployment dpl_<redacted>. Preview target=null, fra1; build cle1/USA.                                                                                                                                           |
| Faktisk perimeter                                  | PASS stabil alias och immutable deployment; HTML, API, demoPOST, favicon och verklig statisk resurs kräver Vercel-auth. SSO alla deployments, endast Niclas.                                                                                                                                                                     |
| Faktisk säkerhet                                   | PASS giltig HTTPS-certifikatkedja, CSP/HSTS/nosniff/no-powered-by/admin no-store, Secure/HttpOnly/Strict-cookie, same-origin, separat appbehörighet, session reuse, logout och kopierad-cookie403. Port3000 ej nåbar; /mcp,/api/mcp,/sse404.                                                                                     |
| Faktisk användarprovning                           | PASS Chromium: demoknapp, kundbokning+tom dag→nästa lediga, sammanfattning/bekräftelse; ägare skapa/flytta/avboka; ändra och återställ pris, lägg ledighet, publicera kampanj. Alla fyra adminmenyer utan sid-overflow vid 320/390/1440. Se live/result.json.                                                                     |
| Faktisk beständighet                               | PASS samma session och bokningssvar efter99sekunders inaktivitet, därefter probe-session revokerad. Kompletterande Vercellogg BOOKING_SERVER_READY för samma boknings-GET200 vid18:30:52.888Z (cnm4m-1794508252888-208cb974d6b6) styrker ny instans efter inaktiviteten; ingen framtvingad omstart. Se cold-start.json.          |
| Backup/återläsning efter UI-prov                   | PASS pg_dump18.7 verify-full, AES256GCM, tamper nekas; ny lokal booking_ui_live_restore_demo, alla10tabellers antal/rowhash identiska,35bokningar. Krypterad fil på operatörens PC, inte automatiserad offsitebackup.                                                                                                            |

**NOT RUN:** fysisk iPhone/Safari, WebKit/Firefox/screenreader, framtvingad omstart/lastcertifiering, exakt fakturakostnad, ny fullvideo och automatisk offsitebackup. Nya instansbevis finns i cold-start.json; gamla kallstartsbevis återanvänds inte. Normal individuell login verifieras positivt lokalt/integration/Grok; nya molnflödet använder demoaktören, vanlig loginform kontrollerad men inget nytt lösenordskonto skapat i moln-DB.

## Mellanresultat och rättningar

Initial tsc/build hittade nullable auth/seedclosure; rättat. Första E2E30/32 hittade engelskt nätfel och alertlocator; rättat. Dev-hydration gav test-race; väntar nu enabled/focus. Mänskliga datum krävde nya exakta Stockholm-assertioner. Scrolltestets inputdriver behövde stabil mätning; sluttest verifierar tangentbord och full geometri, verkligt hjul verifierat separat. Inga misslyckade mellanresultat räknas som PASS. Två samlade produktfixvarv, ingen tredje loop.

## Bilaga — tidigare preview- och Epicresultat

# Verifiering — levererad skyddad Vercel-preview

2026-11-12. Separat branch preview/epic05-vercel-review från29ac297. Endast
syntetiska data. Driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7.
Lokalt, Grok, Actions och faktisk drift skiljs åt nedan. Senare dokumentations-
commits ändrar inte den granskade/driftsatta koden.

### Historisk resultattabell f2fdac7

| Kommando/kontroll                                             | Faktiskt utfall                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm ci --no-fund --no-audit                                   | PASS, added570packages in1m; oförändrad lockfile. ESLint9 deprecation-varning, ingen automatisk uppgradering.                                                                                                                                                                                    |
| npx prisma generate                                           | PASS7.10.1,154ms.                                                                                                                                                                                                                                                                                |
| npm run db:migrate / npm run db:seed                          | PASS på ny loopback booking_preview_vercel_test: sex migrationer, ny sjätte rate-store-migration; seed exit0.                                                                                                                                                                                    |
| npm run lint                                                  | PASS exit0.                                                                                                                                                                                                                                                                                      |
| npx tsc --noEmit                                              | PASS efter rättat testsubprocess-env NODE_ENV. Första körningen FAIL på testets ProcessEnv-typ, ingen ignorerad typkontroll.                                                                                                                                                                     |
| npm test                                                      | PASS72/72,13filer,9.39s efter rättningsvarv1.                                                                                                                                                                                                                                                    |
| npm run test:integration                                      | PASS72/72,17filer,61.71s efter rättningsvarv1.                                                                                                                                                                                                                                                   |
| Riktat preview-rate-limit.test.ts                             | PASS6/6,5.78s efter rättningsvarv1. Fyra riktiga Node-processer delar högst5lösenordskontroller,15av20spärras; korrekt lösenord från spärrad klient kontrolleras aldrig. Refund/generation/expiry/no-memory-fallback testade.                                                                    |
| RATE_LIMIT_STORE=postgres, TRUST_PROXY_IP=0, npm run test:e2e | PASS24/24,fix1r2 dev0,1.5m på ny booking_preview_fix1r2_dev0_test.                                                                                                                                                                                                                               |
| Samma med TRUST_PROXY_IP=1                                    | PASS24/24,fix1r2 dev1,1.4m på ny booking_preview_fix1r2_dev1_test.                                                                                                                                                                                                                               |
| E2E_PRODUCTION=1 och TRUST_PROXY_IP=0                         | PASS24/24,fix1r2 prod0,45.7s på ny booking_preview_fix1r2_prod0_test.                                                                                                                                                                                                                            |
| E2E_PRODUCTION=1 och TRUST_PROXY_IP=1                         | PASS24/24,fix1r2 prod1,44.4s på ny booking_preview_fix1r2_prod1_test.                                                                                                                                                                                                                            |
| npm run build                                                 | PASS, Next16.4.6,compile9.7s/TypeScript8.9s; routes listade korrekt. Separat bygge med dummy-URL till loopbackport1 PASS utan databas. Ny fix1-build PASS.                                                                                                                                       |
| npm audit --json                                              | FAIL exit1,7moderate,0high/critical. Inga overrides/majoruppgraderingar.                                                                                                                                                                                                                         |
| npm audit --omit=dev --json                                   | PASS exit0,0fynd. Minimal runtime-installation utesluter utveckling/peer/optional; exakt native-binding kopieras separat.                                                                                                                                                                        |
| git diff --check                                              | Egna kodändringar PASS. Original-Grokrapport har trailing whitespace och original-native-notis blankrad vid EOF; dessa källbytes bevaras uttryckligen, inte falskt grönt diff-check.                                                                                                             |
| Ny Neon-preview, läsande kontroll                             | PASS:18.6,UTC,initialt0publictabeller; därefter6migrationer/seed och begränsat appkonto. Ingen testsvit eller testvakt kringgås mot moln-DB.                                                                                                                                                     |
| Vercel-projekt/perimeter                                      | PASS separat projekt, Container/fra1, ssoProtection.enabled=true/deploymentType=all; enbart Niclas. HTML/API/favicon och verklig statisk JS-resurs ger302, POST401 utan Vercel-auth; appdata exponeras inte.                                                                                     |
| Grok återkontroll f2fdac7                                     | GO kod/paketering efter1samlat rättningsvarv:72unit/72integration/6riktade/24E2E×4 på egna DB med RATE_LIMIT_STORE=postgres. Ingen driftåtkomst. [Oförändrad originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md), SHA2565751d5f2cd6245b25b549f6466db91cdfb30f8296c4f88bd0392cb8aacaea0b4.   |
| Privat push / Actions43243542749                              | PASS exakt f2fdac7, alla4jobb gröna:dev0=24/24(1.1m),dev1=24/24(1.3m),prod0=24/24(34.6s),prod1=24/24(33.7s). CI använder memory-default för HTTP; lokala/Groks fyrfältsmatriser ovan använder postgres. [Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749). |
| Faktiskt containerbygge                                       | PASS Buildah/linux-amd64 på Vercel,97källfiler; fullbuild571paket/minimalruntime53. Prisma7.10.1/generate, Next16.4.6/build, nativeSHA-guard, USERnode/chown och sourcearchive PASS. Image281bf3df713ae12726f42dfa67d310239d1ca5fe669a9a8a7ebaf9f2c092db5d.                                      |
| Faktisk TLS/headers/direktport                                | PASS verifierat TLS1.3-certifikat; CSP,HSTS,nosniff,referrer,no-powered-by,admin no-store. Port3000 ej nåbar. NeonPG är autentiserad managed TLS-endpoint, inte nätverksstängd5432.                                                                                                              |
| Faktisk UI och API                                            | PASS individuell login, Secure/HttpOnly/SameSiteStrict-cookie, kundbokning, kalender, tjänster/personal, flytt, avbokning, logout och replay403 (även POSTpublish). MobilChromium390×844.                                                                                                        |
| Faktisk header/spärr                                          | PASS fem401 med roterande falska x-real-ip/x-forwarded-for/internIP/proof, därefter429 + Retry-After833; rätt lösenord med ny falsk IP också429. Testspärrar och testsessioner städade före överlämning.                                                                                         |
| Faktisk kallstart/beständighet                                | PASS baseline15:08:23Z →15:09:53Z. Logg BOOKING_SERVER_READY15:09:52.602Z för vf5xk-1794496190186-a50e23ad4309 i fra1. Samma session/bokning/statuscancelled/version3/starttid kvar.                                                                                                             |
| Backup efter driftflöden                                      | PASS pg_dump18.7 verify-full, AES-256-GCM befintlig separat nyckel bevarad, tamper nekas; pg_restore till ny lokal booking_preview_live_restore_demo. Alla10tabellers antal/hash lika:1booking,3events,2workspaceRequests,1admin,0session/rate.                                                  |
| Faktiskt MCP-perimeter                                        | PASS auktoriserade /mcp,/api/mcp,/sse ger404. Ingen publik MCPserver.                                                                                                                                                                                                                            |

E2E-/migrations-/auditloggar finns lokalt utanför Git under
C:/Users/<user>/booking-lab-pg-test/preview-vercel-review. Övriga kommandoutdata
observerades i Codex-verktygsresultat. Historiska5migrationer och package/lockfile
är oförändrade. Ingen ny demo/video behövs för osynlig driftanpassning.

**NOT RUN / begränsningar:** fysisk iPhone/Safari, framtvingad omstart av alla
instanser, full lastcertifiering, automatiserad extern backup och exakt fakturerad
projektkostnad. Grok körde chroot-emulerade Dockersteg som root, inte äkta
Dockerimage eller USERnode; dessa delar testades sedan av Codex genom det
faktiska Vercelbygget/driften. Ingen ny full video behövs; riktiga driftbilder
är granskade. Pilot fortfarande NO-GO.

Första live-proben FAIL efter godkänd kalender: selector main träffade både
Next-loading och sidans main under övergång. Operatörsproben ändrades till
sidans specifika formulärfält och återupptog SAMMA bokning; ingen produktkod
ändrades, inget nytt bokningsförsök dolde felet. Resten av driftflödet PASS.
En misslyckad lokal PowerShell-ersättning av provskriptets regex nekades av
parsern innan något ändrades; rättad med patch.

Vercels första deploy blev automatiskt Production trots --target preview: den
avbröts innan appstart, dpl_<redacted> CANCELED.
--skip-domain avvisades sedan lokalt som production-only. Ny deploy fick
Preview/target=null, dpl_<redacted> READY och metadata
sourceRevision=f2fdac7. Projektets all-deployment-skydd var alltid aktivt; inga
previewhemligheter fördes till production. Buildregion cle1, runtime fra1.
Prisma varnade om OpenSSL-detektion i byggsteget men generate/build/runtime
PASS; ingen blind paket-/basimageuppgradering. Feature-pushens CI ersattes
av samma SHAs fulla manuella fyrfältsmatris via befintlig concurrency.

Lokala kommandon för egna driftprober (operatörsfiler utanför Git, inga nya
appdependencies): node verify-live.mjs (första FAIL), node resume-live.mjs PASS,
node persistence-setup.mjs PASS, node persistence-check.mjs PASS,
node --env-file=.env backup-live.mjs PASS, node verify-network.mjs PASS.
Alla ligger under artefaktkatalogen ovan; privata loggar/token/cookies bara i
ignorerad .vercel. Loggar: fix1r2-_-e2e.log, fix1-integration.log,
fix1-build.log, fix1-audit-_.json, vercel-build-f2fdac7.log, actions-f2fdac7.log.
Bevis: live-verification.json, persistence-before/after.json,
live-backup-restore.json, live-final-network.json och live-\*.png.
Screenshots visar samma kod och faktisk skyddad runtime; inte gamla Epicar.
Backup är lokalt krypterad, inte offsite i Tyskland.

Låga fynd i backlogg: PV-QA-4 eviktion av aktiv bucket vid10000rader;
PV-QA-7 åtta memory-unit-tester ger64/72 med global RATE_LIMIT_STORE=postgres
(standardkörningen är72/72; ingen testgrind sänks). PV-QA-8: källkodserbjudande
enligt AGPL§13 före åtkomst för andra än Niclas. Native-Cargo-inventeringen
är kontrollerad av Codex, Grok kunde kontrollera57crates checksummor men inte
fullständighet mot Cargo.lock som inte skickades. Kryptografisk provenance,
full SBOM och bredare publicerings-/basimagegrindar återstår före binaryrelease.
Ingen annan mänsklig/agentåtkomst är tilldelad.

Slutmatrisen ovan gäller fryst kod f2fdac700125df2d212e824555758b8ed6d6a7a7.
Dessa uppdaterade resultat är enbart dokumentationsändringar efter frysning.

## Previewns oberoende QA och rättningsvarv1

Fryst b46da1321532ef683e971181d5404f54368e1b95: Grok gav kod-GO men
konfigurations-NO-GO. Vercels faktiska filinsamlare tog bara15rotfiler på grund
av ignorerade föräldramappar. [Originalrapport](qa/QA-REPORT-preview-vercel-b46da13.md)
och [fixunderlag](qa/FIX-REQUEST-preview-vercel-b46da13.md) är oförändrade.
Grok körde71unit/71integration och24E2E i varje läge; prod0 hade först
MCP-timeout23/24, sedan24/24 två gånger. Detta är QA:s körningar, inte våra.

Rättningsvarv1 använder rotförankrad vitlista och nytt filurvalstest. Första
testet fångade en felaktig slash i den lokala insamlingsproben, därefter rättat.
Minimal53pakets Windows-runtime utan CLI/ELK/sharp/TypeScript klarade24/24E2E
på egen booking_preview_pruned_test; inte bevis för Linuxcontainer/Vercel.
Refund-race serialiseras och har riktat regressionstest. E2E global teardown
städar delade rate-buckets i den testdatabas som den befintliga vakten godkänt.
Kapacitetstestets första omkörning föll på redan existerande smoke-buckets;
fixture tar nu hänsyn till existerande antal och DB-expiry, produktgränsen
10000 är oförändrad. Aktiv spärr kan fortfarande evikteras vid mättat lager
(samma tidigare policy); lågprioriterad skalningsfråga, ingen kundpilot.

Backup: pg_dump18.7 mot nya syntetiska Neon18.6 med sslmode=verify-full,
AES-256-GCM, manipulationsprov avvisat. Första pg_restore utan explicit
--dbname FAIL och0tabeller; rättad återläsning till ny lokal
booking_preview_restore_demo PASS, alla10tabellers antal och innehållshashar
matchar. Krypterad fil på operatörens PC, separat nyckel i ignorerad .vercel.
Ingen automatisk extern/Tysklandsbackup eller återläsning efter driftprov ännu.

En lokal matrislauncher nekades först av Node för C:-import utan file:///;
rättad innan databas skapades. Ingen testvakt eller produktkod försvagades.

## Bilaga — tidigare Epic05 QA-fixvarv1

2026-11-12. Branch epic-05-booking-workspace; fryst fixkod **4fc98d37fef805e041f8f8772a3fc37543d4ff04** efter7fc0e86/b331cb1, E05-QA-1. Ny loopback booking_epic05_fix1_test på55451, PostgreSQL18.6. Original-QA7fc0e86 gav NO-GO på adminbudgeten; riktad återkontroll på4fc98d3 stängde E05-QA-1 och gav GO för lokal alpha. Historiska migrationer/dependencies oförändrade. Privat pushc12b98a och full manuell CI43210413097 PASS; ingen mainmerge/deploy.

### Historisk resultattabell för Epic05-fixen

| Kommando/kontroll                                                           | Faktiskt resultat efter fix                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --no-fund                                                            | Lokalt återanvänd ren570/571PASS på oförändrad lockfile. Ny ren CI-installation påc12b98a PASS:571/572paket,54s på kall feature-körning.                                                                                                                          |
| npx prisma generate                                                         | PASS7.10.1,124ms.                                                                                                                                                                                                                                                 |
| npm run db:migrate / npm run db:seed                                        | PASS på ny fix1_test:5migrations,2tjänster/2personal,0standardkonton.                                                                                                                                                                                             |
| npm run lint / npx tsc --noEmit                                             | PASS före och efter formatering med befintlig cachad Prettier3.9.9(MIT); ingen ny dependency/install.                                                                                                                                                             |
| npm test                                                                    | PASS69/69,11filer,7.21s.                                                                                                                                                                                                                                          |
| npm run test:integration                                                    | PASS66/66,16filer,58.36s.                                                                                                                                                                                                                                         |
| npm run build                                                               | PASS även ny build från fryst4fc98d3:compiled1507ms,TypeScript3.5s.                                                                                                                                                                                               |
| Ny HTTP-E2E / full dev-prod×proxy0-1                                        | PASS24/24 i alla4lägen på4fc98d3:prod0=1.3m,prod1=43.1s,dev0=1.5m,dev1=1.2m. Testet verifierar7adminbokningar, oförändrade kundtak/förfalskad actor och20identiska adminretries.                                                                                  |
| npm audit full / produktion                                                 | Omkörd efter fix:full FAILexit1,7moderate/0high/critical;produktion PASSexit0,0fynd. Inga overrides eller dependencies ändrade.                                                                                                                                   |
| node --env-file=.env scripts/test-cleanup.mjs / extern epic05-aggregate.mjs | PASS:CLEANUP_TIMEOUT_EXPECTED_EXIT=1;REMAINING_SYNTHETIC_ROWS=0. Därefter0booking/event/request/session/admin/campaign,2service/2staff,0aktivaöverlappar/observeradedeadlocks.                                                                                    |
| Grok-QA                                                                     | PASS:original7fc0e86:NO-GO;slutrapport4fc98d3:GO efter1fixvarv. Grok egen ren installation,69unit/66integration/24E2E×4 och kvot/auth/retry/MCP/samtidighetsprober. [Originalslutrapport](qa/QA-REPORT-epic05-4fc98d3.md).                                        |
| GitHub Actions, c12b98a                                                     | PASS feature43209758207:1jobb,4m01s. Full manuell43210413097:4gröna jobb/24E2E vardera,69unit/66integration i dev0. Ren Compose-DB/generate/migrate/seed/lint/build/tsc PASS. [Jobb/loggbevis](CI_DELIVERY_2026_11_12.md). Veckoaudit ej aktiv på default-branch. |
| Docs-only-push7e8f901                                                       | PASS:0Actions-körningar efter push, endast Markdown ändrat. Båda gröna testkörningarna gäller fortfarande exaktc12b98a. Inga tester beställdes om för dokumentation.                                                                                              |
| Demo / preview / CI                                                         | Demo är äldre7fc0e86; ingen ny full inspelning för osynlig fix.09-bilderna är laddningsbilder, inte funktionsbevis. Preview BLOCKERAD miljöbeslut. CI43210413097 påc12b98a PASS med4×24E2E; se separat CI-bevis.                                                  |

Grok observerade **1deadlock i oförändrat avsiktligt direkt-ORM-bypasstest** (booking.test.ts25–27); testet PASS, inga deadlocks i domänprober. Vårt eget observerade0 gäller våra körningar och är ingen global garanti. Mindre QA-2–8 är backlogg, inte nya blockerare.

Två första riktade DB-test FAIL på felaktigt överlappande fixtures(60minbehandling i30minsteg); fixturen byttes till befintlig30min-Massage och2/2PASS utan ändrade produktregler, sedan hela66/66PASS. Första försöket att använda createdb.exe kördes inte eftersom externa QA-paketet saknar filen; Nodepg hjälparen skapade sedan ny DB, inget reset. Behåll dessa skillnader från produktfel. Alla originalkörningar/loggar beskrivs i WORKPLAN.

Faktisk E2E-proxy är **127.0.0.10/32**, hårdkodad testfixture matchande socketClient; exporterad TRUSTED_PROXY_IPS skriver inte över detta. Riktig TLS/proxy/fysisk mobil NOT RUN. Grok GO4fc98d3 och exakt push-CIc12b98a är nu verifierade. Pilot NO-GO.

## Bilaga — kandidat7fc0e86, före QA-fix

# Verifiering — Epic 05, fryst kandidat inför Grok-QA

2026-11-12. Branch **epic-05-booking-workspace**, kandidat **7fc0e866f0ef457bf9eaef4ca153e7a69b30b3d0**, produktkod **4099d9d**. Windows, Node24.16.0/npm11.13.0, Prisma7.10.1, egen PostgreSQL18.6 på127.0.0.1:55451. Ren installation och ny **booking_epic05_final_test**; separat **booking_epic05_delivery_demo**. Endast syntetiskt. Kandidaten innehåller efter produktkoden test-/demoverktyg och dokument, ingen ytterligare app-/schemaändring. Efterföljande resultatdokument ändrar ingen kod. Grok-QA skickad, inget GO ännu. Ingen implementationpush/mainmerge/deploy.

### Historisk resultattabell

| Kommando/kontroll                                        | Faktiskt resultat                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci --no-fund                                         | PASS exit0: added570 packages, audited571 in2m; ESLint9-deprecation och7moderate.                                                                                                                                                                                                                                                                                                                              |
| npx prisma generate                                      | PASS: Prisma Client7.10.1,125ms.                                                                                                                                                                                                                                                                                                                                                                               |
| npm run db:migrate / npm run db:seed                     | PASS på ny final_test:5migrationer,2tjänster/2personal,0standardkonton.4historiska SQL-filer byteidentiska mot26b680d.                                                                                                                                                                                                                                                                                         |
| npm run lint / npx tsc --noEmit                          | PASS exit0 utan diagnostik; även efter nya demo-/tangentbordstester.                                                                                                                                                                                                                                                                                                                                           |
| npm test                                                 | PASS68/68,11filer,8.16s på oförändrad produktkod4099d9d.                                                                                                                                                                                                                                                                                                                                                       |
| npm run test:integration                                 | PASS64/64,15filer,56.84s på ny final_test.                                                                                                                                                                                                                                                                                                                                                                     |
| npm run build                                            | PASS exit0; samtliga nya admin/API-vägar byggda. Även demokörningen byggde produktion från7fc0e86.                                                                                                                                                                                                                                                                                                             |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e       | PASS22/22,2.4m på ren slutinstallation före de nya tangentbordsassertionerna.                                                                                                                                                                                                                                                                                                                                  |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 npm run test:e2e       | PASS22/22,38.9s, samma slutinstallation.                                                                                                                                                                                                                                                                                                                                                                       |
| TRUST_PROXY_IP=0 npm run test:e2e (E2E_PRODUCTION tom)   | PASS22/22,1.3m, samma slutinstallation.                                                                                                                                                                                                                                                                                                                                                                        |
| TRUST_PROXY_IP=1 npm run test:e2e (E2E_PRODUCTION tom)   | PASS22/22,1.1m, samma slutinstallation.                                                                                                                                                                                                                                                                                                                                                                        |
| Kandidat7fc0e86, samma fyra E2E-kommandon                | PASS22/22 i alla4lägen på exakt7fc0e86:prod/proxy0=43.6s,prod/proxy1=42.7s,dev/proxy0=1.3m,dev/proxy1=1.4m. Inkluderar Tab/fokus/Enter; samma gränser/assertions. Slutaggregat åter0kund-/konto-/mutationsrader,0överlappar/deadlocks.                                                                                                                                                                         |
| node --env-file=.env scripts/test-cleanup.mjs            | PASS: CLEANUP_TIMEOUT_EXPECTED_EXIT=1, REMAINING_SYNTHETIC_ROWS=0. Avsiktlig timeout är kontrollens förväntade barnutfall.                                                                                                                                                                                                                                                                                     |
| Extern node epic05-upgrade-verify.mjs                    | PASS riktig PostgreSQL-templatekopia4→5 av syntetisk Epic04-DB. Gamla scalarfält/UTC/DST-bokningar/kampanj/konto/session bevarade;5SQL-checksummor matchar. Snapshotpris/namn är migrationstidens katalogvärden, faktisk bokad längd bevaras. Aktiv direktöverlapp ger23P01, cancelled-overlap tillåts. Källans4migrationer/data oförändrade. Egna provrader städade. Inte pg_dump/restore eller skarp backup. |
| Extern node epic05-aggregate.mjs                         | PASS efter fullmatris och efter demo:0booking/event/workspaceRequest/session/admin/campaign,2services/2staff,0activeOverlaps och0observeradeDBdeadlocks.1anslutning är proben.                                                                                                                                                                                                                                 |
| npm audit --json                                         | **FAIL exit1:7moderate,0high/critical.** Känd lint/minimatchkedja, inga overrides/majoruppgraderingar.                                                                                                                                                                                                                                                                                                         |
| npm audit --omit=dev --json                              | PASS exit0:0fynd. Inte en distributionslicens- eller pilotklarering.                                                                                                                                                                                                                                                                                                                                           |
| npm audit --audit-level=high --json                      | PASS exit0 med samma7moderate; separat synlig veckogrind, ingen påstådd åtgärd av fynden.                                                                                                                                                                                                                                                                                                                      |
| npm run demo:record                                      | PASS6/6,52.8s,produktion7fc0e86,dirty=false;28PNG/6WebM. [Manifest/galleri](DEMO.md). Alla6videor probe/avkodade exit0; utvalda verkliga bilder granskade. Inte helt visuellt genomtittade videor.                                                                                                                                                                                                             |
| Demovakt mot egen inaktiv syntetisk adminrad             | PASS: DEMO_DATABASE_NOT_EMPTY_OR_SYNTHETIC före build, ingen rå identifierare/hash i fel, raden raderades inte. Bara provets egen rad togs bort efteråt.                                                                                                                                                                                                                                                       |
| actionlint1.7.12, verify/audit-workflow                  | PASS exit0. Externt officiellt verktyg, ingen appdependency. Shellcheck NOT RUN.                                                                                                                                                                                                                                                                                                                               |
| Grok-QA / Actions / CI-kostnadsacceptans                 | QA skickad till verifierad befintlig bot; Grok bekräftade faktisk mottagning7fc0e86, alla169filhashar/bas/demo och separat DB i egen miljö. Originalslutrapport inväntas. Implementationpush/Actions NOT RUN. Feature≤5min och docs-ignore ej externt bevisade. Veckoschema kräver default-branch, ingen mainmerge.                                                                                            |
| Privat mobilpreview / fysisk iPhone/Safari / skarp drift | BLOCKERAD miljöbeslut respektive NOT RUN. [Konkreta miljö-/kostnads-/åtkomstval](DEMO.md). Ingen deploy/tunnel. Kundpilot NO-GO.                                                                                                                                                                                                                                                                               |

Exporterad DATABASE_URL går före .env. Kör en matris åt gången, exportera TRUSTED_PROXY_IPS=127.0.0.1,::1 och växla TRUST_PROXY_IP=0/1 samt E2E_PRODUCTION tom/1. Bygg före produktion. Historik/testkategorier och låsbeslut i [WORKPLAN](WORKPLAN.md), [arkitektur](ARCHITECTURE.md). Lokala råutdata: C:/Users/<user>/booking-lab-pg-test/epic05-final-_.log/json, epic05-candidate-_.log/json, epic05-demo-record-1.log och epic05-video-check.json. Käll-ZIP från7fc0e86:169filer, SHA256 **154dda086409cd810049cfb72b3f19b993fdb1d959f4d892b98a2bf0e74ed458**. Innehåll inventerat, inga .env/hemligheter/buildfiler/data.

## Bilaga — tidigare Epic05-delkörningar och FAIL

Tidiga UI FAIL: dev/desktop60s vid första browser-/sidstart; fullprod17/20 (en fixtureDB-anslutningstimeout före bokning, två tvetydiga länkväljare), sedan18/20 (Next route-announcer valdes också som alert). Väljare rättade till avsedd länk och main-alert; sedan20×4 och nya MCP22×4 PASS utan sänkta gränser/assertions. MCP:s första fullintegration57/59 föll på två5s-timeouter i oförändrad admin-CLI, isolerad3/3 och därefter59/59,60/60,64/64 PASS. NODE_ENV behövde sättas uttryckligt i nya testsubprocessers ProcessEnv. Ursprungliga loggar epic05-ui-_/epic05-mcp-_ kvar lokalt. Intern läsgranskning hittade två negativa täckningsluckor, kompletterade via riktig stdio; den är inte Groks oberoende QA.

Oförändrade Epic01–04 beställs inte för ny full QA. Docker lokalt Windows, riktig TLS/proxy, extern IPv6, flerinstansdrift, full penetrationstestning, komplett native/Cargo-distributionsinventering och fysisk mobil är NOT RUN i denna Epic05-leverans. Inget pilot-GO härleds från lokala gröna tester.

## Bilaga — Epic 04:s verifierade slutleverans

2026-11-12. Produktkod **471f91fa11ad27c19ecd43244bcc90ba3f0b2489**, QA-fixvarv 1 ovanpå3419973, branch epic-04-individual-admin, bas10175ed. Windows, Node24.16.0/npm11.13.0, Prisma7.10.1, PostgreSQL18.6. Ny isolerad loopbackdatabas booking_epic04_fix_test på55450; endast syntetiska data. Groks fulla QA på3419973 gav GO; riktad återkontroll på471f91f stängde E04-QA-1 utan nya fynd. Pilot NO-GO. Epic02/03 har nu pushats efter uttryckligt nytt uppdrag; Epic04 är pushad och extern CI kontrollerad. Ingen merge/deploy.

## Resultattabell Epic 04 (historik)

| Kommando/kontroll                             | Faktisk utdata / resultat                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm ci --no-fund                              | PASS exit0: added570 packages, audited571 in2m; ESLint9-deprecation och7moderate. Ingen npm audit fix körd.                                                                                                                                                                    |
| npx prisma generate                           | PASS: Generated Prisma Client v7.10.1,118ms.                                                                                                                                                                                                                                   |
| npm run db:migrate                            | PASS på ny DB: alla4 migrationer applied. De3 tidigare byteidentiska mot10175ed.                                                                                                                                                                                               |
| npm run db:seed                               | PASS exit0: två tjänster, inga standardadminer.                                                                                                                                                                                                                                |
| npm run lint                                  | PASS exit0, ingen ESLint-diagnostik.                                                                                                                                                                                                                                           |
| npx tsc --noEmit                              | PASS exit0, ingen diagnostik.                                                                                                                                                                                                                                                  |
| npm test                                      | PASS:9files,61/61tests,9.75s efter fixen.                                                                                                                                                                                                                                      |
| npm run test:integration                      | PASS:10files,40/40,35.65s efter fixen på ny DB. Bas3419973 hade dessutom3PASS-varv; se original-QA.                                                                                                                                                                            |
| npm run test:e2e, TRUST_PROXY_IP=0, dev       | PASS14/14,1.4m.                                                                                                                                                                                                                                                                |
| npm run test:e2e, TRUST_PROXY_IP=1, dev       | PASS14/14,44.9s.                                                                                                                                                                                                                                                               |
| npm run build                                 | PASS exit0: Compiled successfully; TypeScript och8sidor färdiga, befintliga routes kvar.                                                                                                                                                                                       |
| E2E_PRODUCTION=1 npm run test:e2e, proxy0     | PASS14/14,26.8s.                                                                                                                                                                                                                                                               |
| E2E_PRODUCTION=1 npm run test:e2e, proxy1     | PASS14/14,25.4s.                                                                                                                                                                                                                                                               |
| node --env-file=.env scripts/test-cleanup.mjs | PASS: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0. Avsiktligt timeout-test räknas inte som produktfel.                                                                                                                                                         |
| Slutaggregat, separat SQL/ORM                 | PASS: bookings0,campaigns0,sessions0,admins0,overlaps0; observedDeadlocks0. Det sista är denna körnings observation, inte garanti för direkt-ORM-bypass.                                                                                                                       |
| Uppgradering med extern epic04-upgrade.mjs    | PASS:3→4migrationer, syntetisk bokningsdata/UTC-tid, publicerad kampanj och äldre sessionsrad bevarade; userIdNULL;0autoadminer; exclusion kvar. Egna provposter borttagna.                                                                                                    |
| Verklig Windows-TTY, admin-CLI                | PASS: lösenord/upprepning syntes inte i utdata, ADMIN_COMMAND_OK och exit0; endast eget provkonto borttaget. CLI-stdin/EOF/felkoder dessutom3integrationstester.                                                                                                               |
| npm audit --json                              | **FAIL exit1:**7moderate,0high/critical. Känd ESLint/minimatchkedja; exakt JSON sparad lokalt.                                                                                                                                                                                 |
| npm audit --omit=dev --json                   | PASS exit0:0vulnerabilities. Detta är inte en distributionslicensgranskning.                                                                                                                                                                                                   |
| npm run demo:record                           | PASS4/4,34.6s,14PNG/4WebM; revision9282cdc,dirty=false,produktion; före osynlig limiterfix471f91f. Se DEMO. Alla videor avkodade utan fel; ej full visuell genomtittning.                                                                                                      |
| Grok oberoende QA                             | GO för3419973: egen58unit/40integration×3/14E2E×4 och riktade prober. E04-QA-1 stängd på471f91f efter egen ren installation,61unit/40integration och riktade prod/proxy/flodprober. [Slutrapport](qa/QA-REPORT-epic04-471f91f.md). [Original](qa/QA-REPORT-epic04-3419973.md). |

## Reproducera och avgränsa

Exportera DATABASE_URL till egen migrerad loopback-DB med suffix \_test; exporterad miljö går före .env. Följ README, ADMIN_OPERATIONS och testkommandona i tabellen. Växla TRUST_PROXY_IP mellan0/1, E2E_PRODUCTION mellan tomt/1; kör npm run build före produktionsmatrisen. Kör en matris åt gången. Manuella konton provisioneras genom dold CLI, aldrig standardlösenord. Ny lokal demo-DB heter booking_epic04_demo, port55450; Windowsguiden anger exakt start/stopp.

Ren npm ci/generate/audit utfördes före den begränsade limiterfixen; lockfile och schema är identiska sedan dess. Ny fix-DB fick alla4 migrationer och seed. Inga nya beroenden i rättningsvarvet.

Lokala råloggar efter fix: C:\Users\<user>\booking-lab-pg-test\epic04-fix-_.log; tidigare slutmatris: C:\Users\<user>\booking-lab-pg-test\epic04-final-_.log/json; separat epic04-upgrade.log och epic04-demo-record.log. Inga .env, lösenord eller cookies kopieras till Git. Rensad fryst käll-ZIP3419973 har SHA2568757E056A47A8DE48CBE59A6BC086F5C99B4D4C5C69811551B9E59053AE68515.

Tidiga fel före slutmatris: tsc fångade const-enumåtkomst under isolatedModules, äldre login-testanrop och saknat NODE_ENV i CLI-testmiljön. Dessa rättades före slutkörningen; de tidiga felen räknas inte som PASS. Ingen produktions-/testtimeout höjdes för att få grön matris.

Första nya regressionstestet föll på för exakt Retry-After900 när899sekunder återstod. Testförväntan rättades; produkttider ändrades inte. [Fixbeslut och kvarvarande QA-fynd](EPIC_04_QA_FOLLOWUP.md).

## Ej körda kontroller / kvarstående grindar

Epic04 Actions43172522203 på199d326 är verifierad:4 gröna E2E-jobb,14/14 vardera;61unit/40integration PASS; känt audit-jobb rött med7moderate/0high. [Exakt CI-bevis](CI_DELIVERY_2026_11_12.md). Se [branchens körningar](https://github.com/niclasvestlund-YT/booking-lab-se/actions?query=branch%3Aepic-04-individual-admin) och leveransens exakta körningslänk. Docker Compose och Ubuntu-native körda i CI. Lokal Windows-Docker, komplett distributionscontainer, riktig TLS/proxy, extern IPv6 och flerinstansdrift ej körda. Ingen penetrationstestning, full GDPR-/MFA-bedömning, nätverksfångst eller komplett Cargo/native-binärlicensinventering. Produktionsaudit0 är inte pilotklarering. Se ADR004, DATA_FLOWS och PRIVACY_SECURITY.

## Extern CI efter godkänd push

Epic02 dba05a2: körning43168794400, fyra E2E-jobb success, audit failure med7moderate/3high; logg läst av Codex. Epic03 10175ed: körning43169125103 färdig, fyraE2E-jobb success, audit failure med7moderate/0high; loggen läst. main är fortsatt b000481. Dessa är separata revisioner, inte bevis för Epic04.

## Bilaga — tidigare verifierad historik

# Verifiering — aktuell Epic 03, godkänd lokal POC

2026-11-12, kod **18a4d736bd5435ed8d856ae87843cadcf237cfcc**, branch epic-03-dependency-security, bas dba05a2. Node 24.16.0 / npm 11.13.0 på Windows; ny PostgreSQL 18.6 på loopback 55449/booking_epic03_test. Serverns grundzon Europe/Paris, klientzon uttryckligen UTC. Syntetiska data; ingen push/merge/deploy. Groks oberoende slut-QA gav GO som lokal POC kl. 02:25 CET. Inga blockerande fynd; E03-3 är fortsatt upstreamblockerat. Pilot NO-GO.

### Historisk resultattabell

| Kommando / kontroll                                      | Faktiskt resultat på kandidaten                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                                                   | **PASS**, exit 0, added 568 / audited 569 i 1 min. ESLint9 deprecation-varning; 7 moderate.                                                                                                                                                                           |
| npx prisma generate                                      | PASS, Generated Prisma Client v7.10.1,126 ms.                                                                                                                                                                                                                         |
| npm run db:migrate                                       | PASS, alla 3 oförändrade migrationer på ny databas.                                                                                                                                                                                                                   |
| npm run db:seed                                          | PASS, exit 0, två syntetiska tjänster.                                                                                                                                                                                                                                |
| npm run lint                                             | PASS, exit 0.                                                                                                                                                                                                                                                         |
| npx tsc --noEmit                                         | PASS, exit 0 både före och efter fullmatris.                                                                                                                                                                                                                          |
| npm test                                                 | PASS, **51/51**,8 filer,2,24 s.                                                                                                                                                                                                                                       |
| npm run test:integration ×3                              | PASS, **31/31 ×3**,25,27 / 26,83 / 28,11 s,8 filer.                                                                                                                                                                                                                   |
| TRUST_PROXY_IP=0 npm run test:e2e                        | PASS, dev **12/12**,1,4 min.                                                                                                                                                                                                                                          |
| TRUST_PROXY_IP=1 npm run test:e2e                        | PASS, dev **12/12**,35,7 s.                                                                                                                                                                                                                                           |
| npm run build                                            | PASS,3,6 s kompilering, TypeScript,8/8 statiska sidor.                                                                                                                                                                                                                |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e       | PASS, **12/12**,29,2 s.                                                                                                                                                                                                                                               |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 npm run test:e2e       | PASS, **12/12**,25,2 s.                                                                                                                                                                                                                                               |
| node --env-file=.env scripts/test-cleanup.mjs            | PASS, wrapperexit 0: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS.                                                                                                                                                                               |
| Slutaggregat/SQL-overlap/pg_stat_database                | PASS: bokningar 0, kampanjer 0, sessioner 0, överlapp 0, deadlocks 0 (lokal observation).                                                                                                                                                                             |
| Syntetisk uppgraderingskopia från Epic 02                | PASS, templatekopia på 55448/booking_epic03_upgrade_test: 3 migrationer inga väntande, Booking/Campaign/Session bevarade, ORM-update exakt UTC-epoch.                                                                                                                 |
| Riktig SQLSTATE-probe vid insert                         | PASS: tvingade 40P01 och 40001 gav DomainError/status 400; 0 testtriggerrester. Extern .mts-probe, inte ytterligare två testfall i svitens 31.                                                                                                                        |
| Separat lokal demodatabas / produktionsstart             | PASS: ny booking_epic03_demo migrerad/seedad. ROOT_STATUS=200, ADMIN_STATUS=200 med loginform, SERVICE_COUNT=2; egen smoke-server stoppad, därefter 0 bokningar/kampanjer/sessioner/överlapp/deadlocks. Ingen video inspelad. [Windows-guide](LOCAL_DEMO_WINDOWS.md). |
| npm audit --json                                         | **FAIL exit 1,7 moderate,0 high/critical**. Ingen override eller allowlist.                                                                                                                                                                                           |
| npm audit --omit=dev --json                              | **PASS exit 0,0 fynd**. CLI kan ändå installeras via optional peer.                                                                                                                                                                                                   |
| Byggspårning                                             | 10 server-nft-filer, 0 elkjs/Studio/prisma-build-referenser. Inte full distributionsklarering.                                                                                                                                                                        |
| Ny demo, extern CI, Docker, riktig TLS/proxy/flerinstans | **EJ KÖRT**. Ingen synlig produktändring/ingen push; Docker saknas. Senaste video är äldre Epic 02-kod.                                                                                                                                                               |
| Grok QA                                                  | **PASS, lokal POC** på 18a4d73. Ren installation, 51 unit, 31 integration ×3, 12 E2E ×4; extra NY-tidszon, Prisma 6→7→6 och 4 400 blandade anrop. Full audit FAIL 7 moderate, prod PASS 0. [Groks originalrapport](qa/QA-REPORT-epic03-18a4d73.md).                   |

Alla faktiska körloggar utanför Git i C:/Users/<user>/booking-lab-pg-test/: epic03-ci/generate/migrate/seed.log; epic03-final-lint/tsc/unit/integration-1/2/3/e2e-dev-0/1/build/e2e-prod-0/1/cleanup/tsc-after.log; epic03-final-audit.json och epic03-final-audit-production.json. Uppgraderingsproben: epic03-upgrade-clone.log. De angivna tiderna/countsen kommer från faktisk output; inga CI-resultat tillskrivs lokal körning.

## Oberoende QA och deadlock-avgränsning

QA:s ordinarie matris hade också deadlocks=0. Efter extra repetitioner såg QA däremot **4 deadlocks i det avsiktligt låsförbigående direkt-ORM-testet**; en transaktion avvisas och integritetskravet håller. Den låsta produktvägen hade 0 deadlocks/överlappar/serverfel i QA:s stressprober. Vår lokala räknare 0 ovan är faktiskt observerad, ingen garanti för globalt 0 under direkta DB-writes. E03-QA-1 är en dokumenterad testprecisering i backloggen; inga lås eller testgränser ändras för att dölja detta.

QA bekräftade även poolens max 5 vid återanslutning, explicit env utan Prisma-autoladdning och exakt 129 inventeringsposter. E03-QA-2 är en fortsatt distributions-/pilotgrind för CLI/Studio/EPL; E03-QA-3–5 gäller väntad stabil minimatchfix, första frågans fel efter dödad anslutning och pooluppvärmning. Inget nytt rättningsvarv behövdes. Plattformsskillnader: QA installerade 569 paket och såg 12 nft-filer på Linux, mot våra 568 och 10 på Windows; samma versioner/resultat och 0 Studio/elkjs-byggreferenser.

## Fel som fångades och begränsningar

- Första integration:24 PASS / 1 FAIL / 5 SKIPPED. Verklig exclusion gav ny adapter-meta; DST-fixturens check bröts p.g.a. offsetlös serialisering i annan PG-sessionzon. Rättat med strukturerad mapping och UTC-session, inte ändrade datum/testgränser/DB-spärrar. Sedan 31/31 och slutmatrisen ovan. Logg epic03-initial-integration.log.
- Första externa licensinventering använde ConvertFrom-Json utan -AsHashtable på npm:s tomma rotkey; metadata kom inte fram. Korrigerad inventering har 129 ändrade poster. Saknad LICENSE i @prisma/dev-rot dokumenteras, ingen full bundled-licensklarering påstås.
- pg_dump/pg_restore-proben gav exit 1 eftersom binärerna saknas. Ingen backup/restore är verifierad. Egen testfixture städades; templatekopian genomfördes sedan med PASS. Loggar för båda finns kvar.
- ESLint9 deprecation och NO_COLOR/FORCE_COLOR-varning kvar. Vites tidigare CJS/ESM-configvarning uppträder inte efter type:module. Audit 7 moderate är kvar/upstreamblockerat, inte grönt.
- Ingen nätverksfångst, full OS-processisolering, skarp backup/rollback eller binär/containerlicensgranskning. [Beslut och risker](DEPENDENCY_REVIEW.md).

## Bilaga — Epic 02 verifieringshistorik

## Epic 02: slutgodkänd lokal POC

Verifierad kod **3cd633b99e5aa990d002dc5563aed4bfe6bfe4a6**, branch `epic-02-local-agent-booking`, 2026-11-12. Bas `02edeaf`. Node 24.16.0/npm 11.13.0 på Windows. Ny isolerad PostgreSQL 18.6, `127.0.0.1:55448/booking_epic02_test`; separat `booking_epic02_demo` för inspelning. Endast syntetiska uppgifter. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1 sattes före CLI/byggprocesserna. Inga nya paket, migrationer eller ändrat HTTP-kontrakt. Ingen push/merge/deploy.

### Historisk resultattabell Epic 02

| Kommando / kontroll                                                   | Faktiskt resultat                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm ci                                                                | **EJ KÖRT lokalt i Epic 02**; befintlig installation/låsfil återanvänd. Grok körde ren npm ci på fc83a70: PASS, 462 paket. Låsfil och manifest är identiska på slutkoden.                                                                                                                  |
| npx prisma generate                                                   | PASS, Prisma 6.19.3                                                                                                                                                                                                                                                                        |
| npm run db:migrate                                                    | PASS, samtliga 3 oförändrade historiska migrationer på ny testdatabas; även ny separat demodatabas migrerad                                                                                                                                                                                |
| npm run db:seed                                                       | PASS på test och demo                                                                                                                                                                                                                                                                      |
| npm run lint                                                          | PASS, exit 0                                                                                                                                                                                                                                                                               |
| npx tsc --noEmit                                                      | PASS, exit 0                                                                                                                                                                                                                                                                               |
| npm test                                                              | PASS, **43/43**, 7 filer, 2,70 s                                                                                                                                                                                                                                                           |
| npm run test:integration, tre körningar efter QA-rättning             | PASS, **30/30 ×3**, 24,86 / 28,22 / 26,62 s                                                                                                                                                                                                                                                |
| TRUST_PROXY_IP=0 npm run test:e2e (dev)                               | PASS, **12/12**, 1,3 min                                                                                                                                                                                                                                                                   |
| TRUST_PROXY_IP=1 npm run test:e2e (dev)                               | PASS, **12/12**, 31,6 s                                                                                                                                                                                                                                                                    |
| npm run build                                                         | PASS, produktion, TypeScript och 8/8 statiska sidor                                                                                                                                                                                                                                        |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e                    | PASS, **12/12**, 21,1 s                                                                                                                                                                                                                                                                    |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 npm run test:e2e                    | PASS, **12/12**, 20,9 s                                                                                                                                                                                                                                                                    |
| node --env-file=.env scripts/test-cleanup.mjs                         | PASS: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0. Wrapper exit 0; barnets avsiktliga timeout är inte ett testsvitfel.                                                                                                                                                     |
| Aggregat på testdatabasen efter sviten                                | PASS: 0 bokningar, 0 kampanjer, 0 sessioner, 0 överlapp, pg_stat_database.deadlocks=0                                                                                                                                                                                                      |
| npm audit --json                                                      | **FAIL, exit 1**: 3 höga + 7 måttliga, 0 kritiska. Omkört efter QA-rättning, epic02-qa-audit.json; inga automatiska uppgraderingar/overrides.                                                                                                                                              |
| npm run demo:record                                                   | **PASS 4/4**, 1,2 min, produktionsbygge, ren **7a65aee** (samma kod som 3cd633b), dirty=false. **14 PNG, 4 WebM**. Första misslyckade försök bevaras separat.                                                                                                                              |
| Grok slut-QA                                                          | **PASS, Epic 02 kan stängas som lokal POC** på cad997b, 01:34–01:44 CET. Ren npm ci/Prisma/lint/tsc/build, 43 unit, 30 integration ×3, 12 E2E ×4 och cleanup PASS i egen miljö. Audit FAIL 3/7. QA-1 stängt; inga blockerande nya fynd. [Originalrapport](qa/QA-REPORT-epic02-cad997b.md). |
| GitHub Actions på Epic 02                                             | **EJ KÖRT**: ingen push tillåten. Epic 01:s CI är inte bevis för Epic 02.                                                                                                                                                                                                                  |
| Docker Compose, riktig TLS/proxy, IPv6-transport/fler serverinstanser | **EJ KÖRT**. Docker saknas i PATH. Loopback-simulering av proxy i E2E ersätter inte driftverifiering.                                                                                                                                                                                      |

Kommandologgar finns lokalt i `C:\Users\<user>\booking-lab-pg-test\`: `epic02-qa-final-lint.log`, `epic02-qa-final-tsc.log`, `epic02-qa-final-unit.log`, `epic02-qa-final-integration-1/2/3.log`, `epic02-qa-final-e2e-dev-0/1.log`, `epic02-qa-final-build.log`, `epic02-qa-final-e2e-prod-0/1.log`, `epic02-qa-cleanup.log`. De är testartefakter utanför Git. Prisma/migrering/seed-output observerades direkt i körningen; återgiven ovan, ingen falsk lokal npm ci-status.

## Vad testerna bevisar

Verklig lokal stdio med båda flaggorna; nekad skrivning annars; strikt annonserat schema; exakt statisk svensk feltext; minimerade svar; bokning till admin med maskerad e-post; ja/nej/EOF i testklienten; bevarade kvoter över processomstart och replay efter tak; 20 parallella retries/1 rad. Både domän/MCP och **riktig HTTP/MCP** konkurrerar om 30/60-minutersöverlapp med exakt en vinnare och endast förväntade konfliktfel. SQL-self-join måste ge 0 överlapp. Befintlig 20-omgångars stressregression och historisk exclusion är kvar. Sommar-/vintertid täcks av befintliga slot-tester och tre testfall för den gemensamma webb-/MCP-formatteraren.

Grok körde därutöver egna prober (60 MCP- och 160 blandade HTTP/MCP-omgångar) på fc83a70 i sin egen miljö. Dessa är **Groks rapporterade resultat**, inte nya Codex-körningar. [Originalrapport](qa/QA-REPORT-epic02-fc83a70.md).

## Avvikelser och begränsningar

- Första tsc-körningen stoppade vid testets subprocess-env-typ (NODE_ENV saknades). Testet rättades; samtliga senare tsc och build PASS.
- Första riktade nya E2E-körningen blev 0/2: desktop såg ännu loginformen efter UI-klick; mobilens förväntade datumtext matchade inte adminvyns svenska fullformat. Det fokuserade MCP→admin-testet väntar nu på verifierad API-login och navigerar sedan till admin; befintlig UI-login/utloggning i fullflödet är kvar. Datumförväntan använder rätt visningsformat. Därefter riktat 2/2 och samtliga fulla matriser PASS. Första feltraces skrevs över av efterföljande testkörning; sammanfattningen kommer från faktiskt observerad output, inte en bevarad tracefil.
- Första fulla demo på 18b2ac5 blev FAIL 1/4 vid desktopens nya screenshot, efter godkända funktionella kontroller. Ingen produktions-/bokningsregel ändrades för inspelningen. Riktad diagnostik av samma flöde PASS; rotorsaken är inte fastställd. [Detaljer och partiella artefakter](EPIC_02_QA_FOLLOWUP.md).
- Slutdemon på 7a65aee blev 4/4 PASS utan ändrade timeoutgränser eller någon inspelningsspecifik produktändring. [Galleri](../demo-artifacts/2026-11-12T00-27-19-502Z/index.html) och [manifest](../demo-artifacts/2026-11-12T00-27-19-502Z/manifest.json). Desktop/mobilens 07-bilder visuellt granskade: syntetisk agentkund, rätt Stockholmstid, maskerad e-post, SEK och ingen utvecklarbadge. Videorna är **inte genomtittade i sin helhet**. Efter demo: 0 bokningar/kampanjer/sessioner och 0 deadlocks i demodatabasen. Första inspelningsfelets rotorsak är fortsatt okänd; den lyckade körningen bevisar inte att felet är permanent löst.
- Prisma kan autoläsa .env trots explicit miljövitlistning; ingen processisolering påstås. Gemensam idempotensnamnrymd är avsiktlig i denna POC. [Arkitektur](ARCHITECTURE.md).
- Vites befintliga configLoader-varning och Playwrights NO_COLOR/FORCE_COLOR-varning kvarstår. Ingen varning har dolts genom ändrade testgränser.

## Bilaga A — Epic 01 och tidigare körningar

## Slutgodkännande efter dc15023

Epic 01 är **avslutad som lokal POC** enligt Booking Lab QA:s lästa slutrapport `QA-REPORT-epic01-dc15023.md`. M2/L9/L8 godkända, inga nya fynd eller regressioner. CI 43114326682 har fyra gröna E2E-jobb; endast känd audit är röd. Detta ersätter äldre uppgifter nedan om väntande extern CI och slutgranskning. [Slutstatus, rapporterade QA-resultat och backlogg](PROJECT_STATUS.md).

Epic 02: GO för fortsatt planering, inget nytt arbete startat. Pilot: NO-GO av fem dokumenterade skäl. Ingen ny fixomgång eller demo behövs. Denna ändring är enbart dokumentation; inga tester har körts på nytt. Ingen merge eller push görs med avslutningsnoteringen.

## Tidigare verifiering och arbetsomgångar

Verifierat 2026-11-11 cirka 23:33–23:39 Europe/Stockholm. Kod **01e80ed08a95101cf8e8eb7e899d82e979a4b46b**, bas **8b83a40**, branch epic-01-foundation-hardening. Inga nya produktfunktioner/beroenden/migrationer. Visa e-post undantaget. Ingen push, merge eller ny demo.

| Kommando/kontroll                                                                    | Faktiskt resultat                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prisma generate`                                                                | PASS: Generated Prisma Client (v6.19.3).                                                                                                                                                                                         |
| `npm run db:migrate`, `npm run db:seed`                                              | PASS, exit 0: tre befintliga migrationer på ny isolerad booking_followup_test.                                                                                                                                                   |
| `npm run lint`, `npx tsc --noEmit`                                                   | PASS, exit 0; tsc även efter hela E2E-matrisen.                                                                                                                                                                                  |
| `npm test`                                                                           | PASS: Test Files 5 passed (5), Tests 28 passed (28), 1.57 s.                                                                                                                                                                     |
| `npm run test:integration`, fem sekventiella körningar                               | PASS 18/18 i alla fem. Tider 12.12, 11.11, 10.97, 11.55, 11.21 s.                                                                                                                                                                |
| Stressregression i varje integrationskörning                                         | 20 omgångar ×20 blandade 30/60-minutersanrop: exakt en framgång/omgång, övriga DomainError ”Tiden är inte tillgänglig”, varje omgång <2000 ms, SQL-kontroll visar 0 överlapp. Totalt 100 omgångar/2000 anrop över fem körningar. |
| PostgreSQL-logg efter integration och efter E2E                                      | POSTGRES_DEADLOCK_COUNT=0.                                                                                                                                                                                                       |
| `npm run test:e2e`, dev/proxy=0                                                      | PASS: 8 passed (1.2m).                                                                                                                                                                                                           |
| `npm run test:e2e`, dev/proxy=1                                                      | PASS: 8 passed (24.7s).                                                                                                                                                                                                          |
| `npm run build`                                                                      | PASS: Compiled successfully in 1913ms; statiska sidor 8/8.                                                                                                                                                                       |
| `npm run test:e2e`, E2E_PRODUCTION=1/proxy=0                                         | PASS: 8 passed (16.0s).                                                                                                                                                                                                          |
| `npm run test:e2e`, E2E_PRODUCTION=1/proxy=1                                         | PASS: 8 passed (16.2s).                                                                                                                                                                                                          |
| `node --env-file=.env scripts/test-cleanup.mjs`                                      | PASS, exit 0: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS.                                                                                                                                                 |
| Slutlig Prisma-räkning                                                               | {"booking":0,"campaign":0,"adminSession":0}. Ingen manuell datarensning.                                                                                                                                                         |
| `node --env-file=.env scripts/server.mjs`, TRUST_PROXY_IP=1, TRUSTED_PROXY_IPS=::/32 | Negativ kontroll PASS: BOOKING_SERVER_CONFIG_FAILED, exit 1 före lyssning.                                                                                                                                                       |
| YAML-parsning med befintlig js-yaml                                                  | PASS: mode=[dev,production], proxy=[0,1], fyra kombinationer. Det är inte en extern Actions-körning.                                                                                                                             |
| Prettier 3.6.2 check på ändrade kod-/CI-filer                                        | PASS: All matched files use Prettier code style! Inget projektberoende tillagt.                                                                                                                                                  |
| Diff-check, package.json/låsfil/tre migrationer mot 8b83a40                          | PASS; skyddade filer oförändrade.                                                                                                                                                                                                |

## Ändringar och testgränser

createBooking tar advisory lock per verksamhet/anställd/bokningsdag före tillgänglighetskontroll och insert. Låsordningen är idempotens → klient/skapandedag → e-post/skapandedag → anställd/bokningsdag. Exclusion är oförändrad. Strukturerade P2010/meta.code 23P01/40P01/40001 mappas till befintlig DomainError; unit testar samtliga samt att andra databasfel inte maskeras som konflikt. Inga riktiga deadlocks framkallades för felmappningstestet; det använder konstruerade Prisma-fel. Stressregressionen kör riktig PostgreSQL och observerade inga deadlocks.

Proxyvalideringen avvisar IPv6-subnät som matchar IPv4-ändpunkterna via Node BlockList. Unit inkluderar ::/32, ::/64, ::/80 och bevarad giltig IPv4, IPv6-adress och 2001:db8::/32. Serverstart med ::/32 är provad separat. CI-matrisen bygger och kör E2E i fyra isolerade runner-/DB-miljöer; lint/unit/integration körs i dev/0. Audit är separat och oförändrat.

## Miljö och reproduktion

Ny PostgreSQL 18.6 via tidigare installerat externt embedded-postgres: 127.0.0.1:55447, kluster C:\Users\<user>\booking-lab-pg-test\qa-followup-20261111. Windows, Node 24.16.0, npm 11.13.0. Samma nya \*\_test-databas användes för fem sekventiella körningar; testerna städar sina egna data. Full E2E kördes därefter i ett sekventiellt skript med stopp vid fel. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1; bara syntetiska uppgifter. Reproducerbara testkommandon finns i README; integrationsupprepning: `1..5 | ForEach-Object { npm run test:integration; if ($LASTEXITCODE -ne 0) { throw 'Integration failed' } }`.

Råloggar utanför Git: C:\Users\<user>\booking-lab-pg-test\followup-integration-1.log till -5.log, followup-pg.log, followup-e2e-dev-0.log, followup-e2e-dev-1.log, followup-build.log, followup-e2e-prod-0.log och followup-e2e-prod-1.log. Samtliga testkörningar passerade första försöket i denna uppföljning. En hjälpkontroll av YAML försökte först använda modulen yaml som inte fanns; den kördes om med redan installerad js-yaml och passerade. Inga paket installerades för detta.

**Inte kört:** npm ci och npm audit på nytt (paket/låsfil oförändrade, senaste verifierade audit var 3 high/7 moderate), demo:record enligt ny överenskommen policy, nya GitHub Actions-jobb (ingen push), Docker/PG16 lokalt, riktig TLS/proxy, riktiga IPv6-sockets eller flera appinstanser. CI-acceptansen ”fyra gröna jobb” är därför ännu inte verifierad externt. Senaste demo avser äldre a364bda och används inte som bevis för denna kod.

M2/L8 har riktade regressionsbevis; inga funktionella regressioner observerades. Pilot fortfarande NO-GO: delat adminlösenord, kund-GDPR-livscykel, audit, verklig drift/TLS/proxy och kontaktvägsbeslut återstår. Processlokal limiter och dagbaserad serialisering är POC-avvägningar. Befintliga lokala ändringar av demopolicyn i AGENTS/DEMO bevarades och ingår i kodcommiten.

Efter verifieringen stoppades egen PostgreSQL och hjälpprocess (server stopped; pg_ctl: no server running). Inga lyssnare på 3000/55447 återstod. Egen tillfällig syntetisk .env togs bort efter adresskontroll; klusterfiler/loggar behölls lokalt.

<details>
<summary>Bilaga: historiska verifieringsomgångar</summary>

# Verifiering – Epic 01 QA fix batch 3

Verifierat 2026-11-11 cirka 22:48–22:54 Europe/Stockholm. Kodrevision **a364bda73850c2983212684e94e9690d100d1d9b**, bas **056d0c2**, branch `epic-01-foundation-hardening`. Dokumentationscommit följer. Beställt: punkter 1–5 och små förbättringar i punkt 6. Visa e-post är fortsatt undantagen. Ingen push, merge, deploy eller Epic 02.

### Historisk resultattabell

| Kommando/kontroll                                                                  | Faktiskt resultat                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                           | PASS, exit 0: `added 461 packages, and audited 462 packages in 1m`; 10 vulnerabilities.                                         |
| `npx prisma generate`                                                              | PASS: `Generated Prisma Client (v6.19.3)`.                                                                                      |
| `npm run db:migrate`                                                               | PASS på nya test/demo: `3 migrations found`; `All migrations have been successfully applied.` Alla tre migrationer oförändrade. |
| `npm run db:seed`                                                                  | PASS, exit 0 på båda databaserna.                                                                                               |
| `npm run lint`                                                                     | PASS, exit 0 utan diagnostik.                                                                                                   |
| `npx tsc --noEmit`                                                                 | PASS, exit 0; även efter hela E2E-matrisen.                                                                                     |
| `npm test`                                                                         | PASS: `Test Files 4 passed (4)`; `Tests 24 passed (24)`; 2.07 s.                                                                |
| `npm run test:integration`                                                         | PASS: `Test Files 5 passed (5)`; `Tests 17 passed (17)`; 10.21 s.                                                               |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=0                                          | PASS: `8 passed (25.6s)`.                                                                                                       |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=1                                          | PASS: `8 passed (24.7s)`.                                                                                                       |
| `npm run build`                                                                    | PASS: `Compiled successfully in 1966ms`; statiska sidor 8/8.                                                                    |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=0                             | PASS: `8 passed (16.0s)`.                                                                                                       |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=1                             | PASS: `8 passed (16.0s)`.                                                                                                       |
| `node --env-file=.env scripts/test-cleanup.mjs`                                    | PASS, exit 0: `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS`. Inkluderar nu sessionen.                     |
| DB-räkning efter full matris och cleanup                                           | PASS: `{"booking":0,"campaign":0,"adminSession":0}`. Ingen manuell rensning behövdes.                                           |
| `npm run demo:record`, exporterad `_demo`-URL                                      | PASS: `2 passed (25.4s)`, 12 PNG och 2 WebM, ren a364bda, production. Därefter demo-DB 0/0/0.                                   |
| `npm audit --json`                                                                 | FAIL, exit 1: `{"info":0,"low":0,"moderate":7,"high":3,"critical":0,"total":10}`.                                               |
| `npm audit --omit=dev --json`                                                      | FAIL, exit 1: 3 high, 3 totalt. Oförändrade beroendekedjor.                                                                     |
| `npx --yes prettier@3.6.2 --check` på ändrade TS/MJS                               | PASS: `All matched files use Prettier code style!`. Verktyget kördes externt, inget paket tillagt.                              |
| `git diff --exit-code 056d0c2 -- package.json package-lock.json prisma/migrations` | PASS, oförändrat; inga nya migrationer eller beroenden.                                                                         |
| `git diff --check`                                                                 | PASS efter borttagning av extra tomma slutrader i dokument.                                                                     |

## Acceptanskriterier och bevis

1. Loginspärren reserverar synkront före lösenordsjämförelse. Unit: 20 samtidiga försök leder till exakt fem anrop av lösenordskontrollen; en senare korrekt kontroll anropas aldrig för spärrad klient. E2E i fyra lägen och två viewport-profiler: fem fel → korrekt lösenord ger 429 utan cookie; 50 ytterligare samtidiga försök (rätt/fel blandat) ger alla 429, ingen cookie och uppmätt svarstid minst 100 ms; annan klient ger 200. Retry-After och statiskt svenskt meddelande bevarade. Lyckade försök förbrukar inte felkvoten.
2. Unit verifierar engångsvarningen `PROXY_CLIENT_IDENTITY_COLLAPSED` utan IP/headerinnehåll i standardläge med forwarding och betrodd proxy utan X-Real-IP. Driftmatris i README. Varningen är diagnostik: felkonfiguration måste fortfarande åtgärdas av operatören.
3. Unit avvisar `0.0.0.0/0`, `::/0`, IPv4 /7, IPv6 /31 samt överstora prefix med `PROXY_CONFIG_INVALID`.
4. Unit och riktig PostgreSQL-integration provar avgränsad sessionsgallring (100 rader), utgångna/återkallade rader samt bevarad aktiv session. E2E spårar och raderar endast egna sessionshashar, inklusive timeout-proben. ADMIN_SESSION_VERSION får bara höjas; sänkning kan återvalidera gamla cookies.
5. Testvakten avvisar host/hostaddr-parametrar, även URL-kodad nyckel; demo anropar samma vakt före Prisma-åtkomst. Dokumentation använder npm-startpunkten.
6. Unit verifierar IPv6-/64, separata prefix och normalisering av IPv4-mappad IPv6. HTTP använder den verifierade identiteten både i limiter och bokningskontext. Demobilderna visar Testkund Anna/Erik; slumpmässig e-postmarkör behålls för säker teststädning.

Befintliga integrationstester för samtidighet, idempotens, exclusion, bokningstak, datum, MCP-miljö och kampanjer passerar. Inga observerade funktionella regressioner i slutkörningen.

## Miljö, körordning och avvikelser

Windows x64, Node 24.16.0, npm 11.13.0, PostgreSQL 18.6 via redan installerat externt embedded-postgres-verktyg. Nytt kluster `C:\Users\<user>\booking-lab-pg-test\qa-batch3-20261111`, endast 127.0.0.1:55446, databaser `booking_qa3_test` och `booking_qa3_demo`. Endast syntetiska uppgifter. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1. Ingen nätverksfångst eller ny juridisk bedömning.

Kommandon enligt README: ren installation → generate/migrate/seed → lint/tsc/unit/integration → dev direkt/proxy → build → prod direkt/proxy → timeout-probe/DB-räkning → ren kodcommit → produktionsdemo. Testmatrisen kördes slutligen i ett sekventiellt skript med stopp vid fel, workers=1. Demo använde exporterad DATABASE_URL framför projektets test-.env. Inga befintliga ocommittade ändringar fanns vid start.

**Misslyckat första försök redovisas:** nästa E2E startades av misstag innan föregående process avslutats. Portvakten stoppade den andra körningen, men dess start hade redan stört Playwrights gemensamma trace-katalog. Första körningen slutade 7 PASS/1 FAIL med ENOENT för trace-filer; andra exit 1 för upptagen port. Hela matrisen kördes därefter om sekventiellt med resultaten ovan. Ingen produktkod ändrades för att dölja felet. Git-commit saknade initialt identitet; omkörd med samma kommandolokala `Codex <codex@localhost>` som tidigare commits, utan global konfigurationsändring.

Lokala råloggar utanför Git: `C:\Users\<user>\booking-lab-pg-test\qa3-ci.log`, `qa3-integration.log`, `qa3-final-dev-direct.log`, `qa3-final-dev-proxy.log`, `qa3-build.log`, `qa3-final-prod-direct.log`, `qa3-final-prod-proxy.log`, `qa3-cleanup.log`, `qa3-demo.log`, `qa3-audit.json`, `qa3-audit-runtime.json`. Tidiga misslyckanden finns i `qa3-e2e-dev-direct.log` och `qa3-e2e-dev-proxy.log`.

## Demo och kvarvarande begränsningar

[Lokalt galleri](../demo-artifacts/2026-11-11T21-53-01-311Z/index.html), [manifest](../demo-artifacts/2026-11-11T21-53-01-311Z/manifest.json): a364bda, dirty=false, startedAt 2026-11-11T21:53:01.311Z. Desktop- och mobilbild 04-admin-och-utkast granskade visuellt: korta syntetiska namn, maskerad e-post, ingen N-badge eller observerat layoutöverflöd. Videorna skapades men har **inte** granskats i sin helhet. Artefakterna är lokala och ignoreras av Git.

**Inte körda här:** extern CI för a364bda (ingen push), Docker/PG16, riktig TLS-/reverse-proxydrift, IPv6 via riktiga nätverkssockets, flera serverprocesser, andra webbläsarmotorer, full videogranskning, nätverksfångst, ny licensskanning eller Prisma-major. GitHub Actions verify för föregående 056d0c2 är sedan tidigare verifierat grönt, audit rött; det bevisar inte CI för denna revision.

**Fortsatt NO-GO för pilot:** delat adminlösenord, ingen kund-GDPR-export/radering/retention, oförändrad audit (3 high/7 moderate), processlokal limiter med kapacitetseviktering och IP/NAT-begränsningar, korrekt driftkonfiguration/TLS ej verifierad. Sessionsgallring körs bara vid lyckad login och är ingen generell retentionlösning. Befintliga /128-nycklar räknas inte retroaktivt mot nytt /64-tak. Visa e-post är fortsatt ett separat produktbeslut. Ingen Epic 02 har påbörjats.

Efter verifieringen stoppades det egna klustret (`server stopped`, därefter `pg_ctl: no server running`) och dess egen hjälpprocess. Inga lyssnare återstod på 3000/55446. Den tillfälliga syntetiska .env-filen togs bort efter kontroll av testadressen. Testkluster och demoartefakter behölls lokalt.

<details>
<summary>Bilaga: tidigare verifiering, historiska resultat och tidigare felaktiga säkerhetsantaganden</summary>

# Verifiering – Epic 01 QA fix batch 2

## Aktuella resultat 2026-11-11

Kodrevision **a84e48a32a874a4392c13bb4f32437d06b317c45**, bas b000481, branch epic-01-foundation-hardening. Dokumentationscommit följer kodcommiten. Punkterna 1–5 och 7–11 godkända av beställaren; punkt 6 uttryckligen undantagen. Endast lokala commits, ingen push/deploy. Windows x64, Node 24.16.0, npm 11.13.0, Prisma 6.19.3, Next 16.4.6 och ny isolerad PostgreSQL 18.6. Detta är en testad POC, inte pilotgodkännande.

| Kommando/kontroll                                           | Faktiskt slutresultat                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`                                                    | PASS, exit 0: `added 461 packages, and audited 462 packages in 1m`; `10 vulnerabilities (7 moderate, 3 high)`.                                                     |
| `npx prisma generate`                                       | PASS: `Generated Prisma Client (v6.19.3)`.                                                                                                                         |
| `npm run db:migrate`                                        | PASS på nya `_test` och `_demo`: `3 migrations found`; `All migrations have been successfully applied.`                                                            |
| `npm run db:seed`                                           | PASS, exit 0 på båda nya databaserna. Även separat decoy-databas migrerad/seedad för miljötest.                                                                    |
| `npm run lint`                                              | PASS, exit 0 utan diagnostik.                                                                                                                                      |
| `npx tsc --noEmit`                                          | PASS, exit 0; även efter sista produktions-E2E.                                                                                                                    |
| `npm test`                                                  | PASS: `Test Files 4 passed (4)` / `Tests 20 passed (20)`, 1.97 s.                                                                                                  |
| `npm run test:integration`                                  | PASS: `Test Files 4 passed (4)` / `Tests 16 passed (16)`, 9.85 s.                                                                                                  |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=0                   | PASS: `8 passed (1.2m)`.                                                                                                                                           |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=1                   | PASS: `8 passed (27.0s)`.                                                                                                                                          |
| `npm run build`                                             | PASS: `Compiled successfully in 961ms`; statiska sidor `8/8` på 153 ms.                                                                                            |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=0      | PASS: `8 passed (19.5s)`.                                                                                                                                          |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=1      | PASS: `8 passed (19.1s)`.                                                                                                                                          |
| `node --env-file=.env scripts/test-cleanup.mjs`             | PASS: `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS`. Den avsiktliga timeout-processen ska avslutas med 1; kontrollskriptet avslutades med 0. |
| `npm run demo:record`, ny `_demo`                           | PASS: produktionsbygge + `2 passed (24.2s)`, 12 PNG och 2 WebM. Manifest a84e48a, dirty=false.                                                                     |
| `npm audit --json`                                          | FAIL, exit 1: 3 high, 7 moderate, 10 total.                                                                                                                        |
| `npm audit --omit=dev --json`                               | FAIL, exit 1: 3 high, 0 moderate, 3 total.                                                                                                                         |
| Proxyläge utan TRUSTED_PROXY_IPS, `node scripts/server.mjs` | PASS negativ startkontroll: `BOOKING_SERVER_CONFIG_FAILED`, exit 1 före lyssning.                                                                                  |
| Extern Prettier 3.6.2 `--check`                             | PASS: `All matched files use Prettier code style!` på src/tests/scripts/config/seed. Inget nytt projektberoende.                                                   |
| Git-diff och skyddade filer                                 | PASS: diff-check utan fel; package-lock och båda tidigare migrationer oförändrade mot b000481. `.env`, artefakter, resultat och dependencies ignorerade.           |

## Vad som faktiskt ändrades och bevisades

1. **Klientgräns och rate limit:** egen liten Node-startpunkt läser socketadress. Separata riktiga källadresser används i HTTP-tester, inte bara godtyckliga headers. Standardläge har ingen global bucket; korrekt lösenord fungerar efter fem fel, annan klient får inte 429 efter 30 anrop. Felaktiga login fördröjs progressivt och sjätte nekas. 20 samtidiga retries plus ytterligare 35 retries lämnar plats för nya bokningar och återger samma ID.
2. **Betrodd proxy:** IP/CIDR-lista valideras före start; header accepteras bara från matchande socket. Roterad X-Real-IP och förfalskade interna headers från olistad adress når fortfarande 429. Kapacitetstest fyller mer än 10 000 buckets och ny klient släpps in. CIDR/IPv6-normalisering är unit-testad; HTTP-matrisen använder IPv4-loopback.
3. **Dagstak:** sex samtidiga nya bokningar från samma klient med olika adresser ger fem framgångar; ytterligare bokning nekas. Tre plus-taggar delar samma e-posttak, även basadressen nekas efteråt. Kontaktadressen ändras inte utöver befintlig gemenisering.
4. **Serverlogout:** E2E kopierar cookie, loggar ut och provar publicering/admin med kopian: 403 respektive loginform. Global version/signatur/utgång och DB-fel som stänger åtkomst täcks också. Endast hash av sessionstoken lagras.
5. **Adminfilter:** garbage, över 31 dagar och omvända datum ger 200 med statiskt meddelande/standardintervall. Valideringshjälparen skriver ingen fellogg; inga serverfel observerades i flödet.
6. **Visa e-post:** inte byggt, enligt beställarens uttryckliga undantag. Maskeringen kvarstår.
7. **Kampanj:** separata säkra meddelanden för omvända datum och längre än 90 dagar. 100 % tillåts uttryckligen som informationsrabatt i POC:n; unit-test verifierar beslutet. Gamla DB CHECK är orörd.
8. **Full produktions-E2E:** alla åtta flöden i både direkt/proxyläge. Produktionsservern är nu `npm run start` med kompilerad Next dev:false via socket-wrappern, inte rått `next start`. Detta avsteg behövs för verklig socketadress. `npm run test:e2e:production` erbjuder bygge+hela sviten och provades också under arbetet; slutmatrisen ovan kördes med explicit build och E2E_PRODUCTION.
9. **MCP-miljö:** ett nytt integrationstest skapar en separat env-fil med oanvändbar annan databas och verifierar utkast i den exporterade testdatabasen. Dessutom kördes integration/E2E/demo med exporterad DATABASE_URL som skilde sig från projektets tillfälliga .env. Decoy-databasen hade noll bokningar/kampanjer/sessioner efteråt.
10. **Timeout/retry:** riktig avsiktlig Playwright-timeout lämnar noll egna bokningar/kampanjer via fixture med separat teardown-tid. UI-test tappar första svaret efter serverns commit, skickar sedan två submit-events och ser tre 201 med samma UUID/ID, en DB-rad och lyckad bekräftelse.
11. **UX/demo:** YYYY-MM-DD i kund/admin, logout i sidhuvudet. Mobil-admin och desktop-bekräftelse visuellt granskade utan observerat överflöd eller N-badge. Hela produktionsdemon passerade.

## Miljö, körordning och output

Ny portabel PostgreSQL-instans skapades med UTF-8 på 127.0.0.1:55445, kluster `C:\Users\<user>\booking-lab-pg-test\qa-batch2-20261111`. Separata nya databaser: booking_qa2_test, booking_qa2_demo och booking_mcp_decoy_test. Befintligt externt testverktyg embedded-postgres användes; inget npm-beroende lades till i projektet. Varje gransknings-/testkommando kördes sekventiellt, Playwright workers=1. Ingen annan arbetskopia eller databas återanvändes.

Efter migration/seed kördes lint, tsc, unit, integration, timeout-probe och fyra E2E-lägen enligt README. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1 sattes före bygg-/Prisma-/testprocesserna. Projektets tillfälliga .env pekade efter första körningen på decoy medan exporterad DATABASE_URL pekade på aktuell test-/demodatabas. Ingen nätverksfångst gjordes.

Sista databaskontroll (läsning): test 0 bokningar/0 kampanjer/36 syntetiska sessionsrader; demo 0/0/2; decoy 0/0/0. Sessionsrader har ingen automatisk gallring i denna batch. Testklusterfiler bevaras lokalt.

Efter verifieringen stoppades det egna klustret (`server stopped`, därefter `pg_ctl: no server running`) och den identifierade egna hjälpprocessen avslutades. Den tillfälliga syntetiska .env-filen togs bort efter kontroll av dess testadress. Ingen webbserver lyssnade längre på port 3000. Kluster och demoartefakter behölls lokalt; ingen extern överföring gjordes.

Audit-output sparades lokalt utanför repot i `C:\Users\<user>\booking-lab-pg-test\qa2-audit.json` och `qa2-audit-runtime.json`. Full audits faktiska metadata:

```json
{ "info": 0, "low": 0, "moderate": 7, "high": 3, "critical": 0, "total": 10 }
```

Inga nya dependencies, overrides eller major-uppgraderingar. Advisoryanalys och licensbegränsningar från tidigare granskning består. Se [Prisma 7-plan](PRISMA_7_PLAN.md) och [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md).

## Rättade fel under denna arbetsomgång

- Första tsc upptäckte dubbelt env-fält i det befintliga MCP-feltestet efter ändringen; rättat till en explicit whitelist plus avsiktlig test-override.
- ESLint tolkade Playwright-fixturens parameter `use` som React-hook i try/finally; den heter nu `provide`.
- Första E2E: 4/6 PASS, två tester misslyckades eftersom en bred alert-locator också träffade Nexts route announcer. Produktens filter gav redan 200; testet avgränsades till formulärets p[role=alert]. Senare slutmatris 8/8 i samtliga lägen.
- Ett unit-test antog att DATABASE_URL saknades. När sviten kördes med exporterad testdatabas föll just missing-env-fallet. Testet nollställer nu uttryckligen miljön i det fallet; grinden ändrades inte. Slutresultat 20/20.
- Befintliga ESLint-versions-, Vite-loader- och NO_COLOR/FORCE_COLOR-varningar kvarstår. Inga retries eller längre test-timeouter lades till för att dölja fel.

## Demo och ej körda kontroller

[Galleri](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html), [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json), start kl. 22:04:56 svensk tid. Kodcommiten gjordes före inspelning: a84e48a/dirty=false. Tolv PNG och två WebM. Chromium kunde läsa videorna: 10,68 s, 800×450 och 10,72 s, 392×800. Två representativa bilder granskades; videorna är inte genomtittade i sin helhet. Artefakterna finns lokalt, inte i Git eller uppladdade till QA.

**Ej kört/inte infört:** Docker/PG16, extern CI, verklig TLS/reverse proxy, andra webbläsare än Chromium, flerprocess-/serverlessdrift, penetration/load/backup-restore, full egressmätning, GDPR export/radering/gallring, individuella adminkonton, Prisma 7, nonce-CSP och punkt 6. Rått next start är avsiktligt ersatt av dokumenterad socket-startpunkt. En emulerad betrodd socket är inte verifierad driftinfrastruktur. Ingen push eller extern publicering. POC:n är fortfarande NO-GO för riktiga kunder.

## Bilaga – tidigare QA-batch och verifieringar (historik)

Allt nedan gäller tidigare revisioner. Äldre resultat och begränsningar är inte dagens status.

# Verifiering – Epic 01 QA fix batch 1

## Aktuellt resultat, 2026-11-11

Kodrevision: `26ea6171de05fe17ce4d8bd1e4a4d931d9d5bc82`, branch `epic-01-foundation-hardening`, bas `ed1658a`. Efterföljande kodrevision `3b3309df290cb9b3d6e9ec64c16adf51c32516ac` formaterar bara ESLint-config och CSS. Lint, tsc, build och Prettier kördes igen efter den formateringen; fullsvit/demobeteende gäller 26ea617. Dokumentationscommiten följer dessa commits. Endast syntetiska uppgifter. Windows x64, Node 24.16.0, npm 11.13.0, Prisma 6.19.3, Next 16.4.6. **Testad POC, inte produktionsgodkännande.**

| Kommando/kontroll                                                                           | Faktiskt resultat                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                    | PASS, exit 0; `added 461 packages in 1m`. Ren ominstallation från oförändrad låsfil.                                                                                                                           |
| `npx prisma generate`                                                                       | PASS, Prisma Client 6.19.3. Första sandboxförsöket stoppades av nedladdningsåtkomst; godkänd omkörning passerade.                                                                                              |
| `npm run db:migrate`                                                                        | PASS på två nya databaser; båda migrationerna applicerade. Historisk migration oförändrad.                                                                                                                     |
| `npm run db:seed`                                                                           | PASS på båda databaserna, två syntetiska tjänster.                                                                                                                                                             |
| `npm run lint`                                                                              | PASS, exit 0, inga lintfel.                                                                                                                                                                                    |
| `npx tsc --noEmit`                                                                          | PASS, exit 0, ingen diagnostik.                                                                                                                                                                                |
| `npm test`                                                                                  | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 1.18 s.                                                                                                                              |
| `npm run test:integration`                                                                  | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 8.20 s.                                                                                                                              |
| `npm run test:e2e`                                                                          | PASS: `6 passed (15.2s)`, Chromium desktop och Pixel 7-emulering, utvecklingsserver.                                                                                                                           |
| `npm run build`                                                                             | PASS: `Compiled successfully in 3,6 s`, `Generating static pages (8/8) in 146ms`, exit 0.                                                                                                                      |
| `npm run demo:record`                                                                       | PASS: produktionsbygge + `2 passed (25.7s)`, tolv PNG och två WebM.                                                                                                                                            |
| `npm audit --json`                                                                          | FAIL, exit 1: 3 high, 7 moderate, 10 total.                                                                                                                                                                    |
| `npm audit --omit=dev --json`                                                               | FAIL, exit 1: 3 high, 0 moderate.                                                                                                                                                                              |
| Extern Prettier 3.6.2 `--check`                                                             | PASS: `All matched files use Prettier code style!` på src (inklusive CSS), tests, scripts, TS/MJS-config och seed. ESLint-configens AST är oförändrat; CSS-diff granskad (radbrytningar och inledande nollor). |
| `git diff --check`; jämförelse av gammal migration, package.json och package-lock mot basen | PASS; inget innehåll ändrat i de skyddade filerna.                                                                                                                                                             |
| Docker Compose/PostgreSQL 16, GitHub Actions, verklig TLS/proxy/flerprocessdrift            | EJ KÖRT. Docker saknas; ingen remote/publicering tillåten.                                                                                                                                                     |

## Isolerad miljö och kommandon

En ny PostgreSQL 18.6-instans initierades med UTF-8 i `C:\Users\<user>\booking-lab-pg-test\qa-batch-20261111`, endast `127.0.0.1:55444`. `embedded-postgres@18.6.0-beta.19` är ett befintligt separat lokalt testverktyg, inget npm-beroende i projektet. Databaserna `booking_qa_test` och därefter `booking_qa_demo` skapades tomma, migrerades och seedades. Hela ordinarie sviten kördes mot testdatabasen. Produktionsinspelning och slutlig omkörning av unit/integration/build använde demodatabasen i samma isolerade kluster. Ingen befintlig användardatabas återanvändes. Efter verifieringen stoppades det egna klustret (`pg_ctl status`: `no server running`) och den tillfälliga egna .env-filen togs bort. Klusterfilerna behölls lokalt; ingen användardata raderades.

`NEXT_TELEMETRY_DISABLED=1` och `CHECKPOINT_DISABLE=1` sattes för bygg-/test-/Prisma-processerna. Tillfällig ignorerad `.env` innehöll endast syntetisk lokal konfiguration. Ingen nätverksfångst eller fullständig tredjepartsgranskning gjordes.

Körordning från projektroten (skapa först en ny lokal `*_test` enligt README):

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:CHECKPOINT_DISABLE='1'
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
npm run test:e2e
npm run build
npm audit --json
npm audit --omit=dev --json
# Byt till en separat, ny, migrerad och seedad *_demo:
npm run demo:record
```

Audit-JSON sparades utanför repot i `C:\Users\<user>\booking-lab-pg-test\qa-audit.json` och `qa-audit-runtime.json`. Faktisk metadata för full audit:

```json
{ "info": 0, "low": 0, "moderate": 7, "high": 3, "critical": 0, "total": 10 }
```

Prisma/config/deepmerge-ts står för de tre höga posterna, ESLint/typescript-eslint/minimatch för de sju måttliga. Det är beroendeposter, inte tio oberoende sårbarheter. Inga major-uppgraderingar, overrides eller `audit fix --force`. Se historisk advisoryanalys nedan och [separat Prisma 7-plan](PRISMA_7_PLAN.md). Audit ligger nu i eget märkt CI-jobb och kommer fortfarande att ge rött; detta döljs inte med `continue-on-error`.

## Vad acceptanstesterna faktiskt bevisar

- Fem felaktiga lösenordsförsök följs av 429 på sjätte/sjunde, statiskt svenskt fel och Retry-After. Tre bokningar per normaliserad e-post och skapandedag i Stockholm; fjärde nekas även med parallella anrop. Bokningsrutten spärrar efter 30 försök per 15 minuter.
- Utloggning visar loginform och efterföljande publicering ger 403. Sessionsversionstest ogiltigförklarar gammal signerad cookie utan byte av SESSION_SECRET.
- 150 syntetiska bokningar ger 100 + 50, korrekt sortering/datumavgränsning över Stockholms 25-timmarsdygn och maskerad e-post. MCP:s negativa datum-/behörighets-/sidtester finns kvar.
- Sekventiellt retry och 20 samtidiga anrop med samma nyckel ger en rad och samma ID; annan payload ger 409. Även 20 parallella HTTP-anrop testas.
- 20 samtidiga bokningar och en separat blandad 30/60-minutersgrupp ger exakt en framgång per konfliktfönster. SQL self-join med `tstzrange &&` hittar noll överlapp. Forcerad exclusion-överträdelse blir DomainError 400 med `Tiden är inte tillgänglig`.
- Verkliga Vitest-/Playwright-konfigurationsstarter med otillåten databas-URL avslutas med non-zero och `TEST_DATABASE_REFUSED` innan testinsamling/serverstart/dataåtkomst. Localhost samt _\_test/_\_demo krävs, men detta är ingen garanti för att data i en tillåten databas är syntetiska.
- Kampanj med framtida validFrom visas inte före giltighetsdagen. Okänt MCP-fält, för långt (>90 kalenderdagar) eller omvänt intervall avvisas; DB CHECK stoppar omvända datum även vid direkt INSERT.
- Headers kontrolleras på `/`, `/admin`, `/api/services`. Produktionsdemon kontrollerar även HSTS. Browserfel/CSP-blockeringar observeras av flödestestet. Bekräftelsen innehåller tjänst + lokal tid + Europe/Stockholm, och utloggning ingår.

## Faktiska fel under arbetet och rättningar

1. Första unit-körningens gamla sessionsfixture signerade utan version: testet uppdaterades för nya avtalet.
2. Första integrationens 150-radersfixture använde samma personal för en gränsrad och träffade korrekt exclusion constraint: fixture separerades; produktskyddet ändrades inte.
3. Kall desktop-E2E skickade formuläret innan hydration: bokningsval är nu inaktiverade tills React kan hantera formuläret. Därefter 6/6 PASS utan retry eller ökad timeout.
4. Första produktionsdemon startade både dev och prod därför att Playwrights `defineConfig(base, override)` konkatenerar webServer. Ändrat till ett sammansatt config-objekt med en enda prodserver. Därefter 2/2 PASS.
5. `createdb.exe` saknades i den portabla distributionen. Den nya demodatabasen skapades i stället med ett konstant administrativt CREATE DATABASE mot det egna isolerade klustret. Ingen produktkod för detta tillkom.

Vite varnar för framtida native configLoader/ESM, ESLint 9 gav versionsvarning vid installation och Playwright varnar för NO_COLOR/FORCE_COLOR. Dessa varningar kvarstår. Prettier installerades utanför repot: MIT, separat audit 0 sårbarheter. Inga nya projektberoenden.

## Demo, kvarvarande risker och ej körda kontroller

[Produktionsgalleri](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html) och [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json). Manifestet anger basrevision ed1658a + dirty=true: den verifierade arbetskopians kod är nu committad som 26ea617. Artefakterna ändras inte för att låtsas vara inspelade efter commit. Båda videorna kunde läsas i Chromium: 10,88 s (800×450) och 10,60 s (392×800). Två representativa bilder granskades: mobil bekräftelse och desktop admin, utan N-badge; samma SEK-format. Native datumfält syns i testmiljön som MM/DD/YYYY, trots sv-SE-inställningen.

Full svit i produktionsläge har inte körts; produktionsdemon återanvänder de två fullflödestesterna, medan samtliga sex E2E kördes mot dev. Ingen Docker/PostgreSQL 16, extern CI, andra webbläsare än Chromium, verklig reverse proxy/TLS, distribuerat rate limiting, penetrations-/lasttest eller backup/restore har verifierats. Manuell `mcp:client` har inte körts igen i denna batch; riktig stdio-klient används automatiskt i integration och E2E. Simulerat saknat Git är unit-testat, men alla demofelkoder har inte var för sig framkallats. Inget externt repo, deploy eller publicering.

Rate limiter är processlokal och använder gemensam konservativ bucket utan betrodd proxy-IP. CSP tillåter unsafe-inline för Next; ingen nonce-policy. Utloggning raderar browsercookien, inte en redan stulen kopia; höj ADMIN_SESSION_VERSION och starta om alla processer för global återkallelse. Individuella konton, gallring, flerföretagsisolering och drift-/GDPR-beslut återstår. Se [PRIVACY_SECURITY](PRIVACY_SECURITY.md).

## Bilaga – tidigare verifieringar (historik, inte aktuell status)

Följande tidigare resultat bevaras för spårbarhet. Deras äldre kommandon, databasnamn och begränsningar gäller respektive dåvarande revision.

# Lokal verifiering 2026-11-11

Verifierat på Windows x64 med Node 24.16.0 och npm 11.13.0. Docker, Podman och vanlig PostgreSQL-installation fanns inte tillgängliga. Testerna kördes i stället mot en **ny separat PostgreSQL 18.6-instans**, skapad med `embedded-postgres@18.6.0-beta.19` utanför projektet. Instansen använde UTF-8 och lyssnade endast på `127.0.0.1:55439`. En tillfällig ignorerad `.env` pekade på en ny tom testdatabas. Databasen stoppades och `.env` togs bort efter verifieringen. Detta verifierar PostgreSQL-alternativet, inte Docker Compose-konfigurationen.

| Kontroll                        | Resultat                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                        | PASS; ren ominstallation från låsfilen.                                                                                                                                                                                            |
| `npx prisma generate`           | PASS.                                                                                                                                                                                                                              |
| `npm run db:migrate`            | PASS på den nya databasen.                                                                                                                                                                                                         |
| `npm run db:seed`               | PASS.                                                                                                                                                                                                                              |
| `npm run lint`                  | PASS.                                                                                                                                                                                                                              |
| `npm test`                      | PASS, 3 enhetstester.                                                                                                                                                                                                              |
| `npm run test:integration`      | PASS, 3 integrationstester, inklusive samtidiga bokningsförsök och direkt kontroll av databasens överlappsspärr.                                                                                                                   |
| `npm run mcp:client -- --admin` | PASS; listade behandlingar, hämtade tillgänglighet och skapade utkast.                                                                                                                                                             |
| `npm run test:e2e`              | Första körningen: FAIL för desktop, 30 sekunders timeout vid `page.goto`; mobil PASS. Efter att testets timeout ökats till 60 sekunder: PASS för både desktop och mobil. Orsaken till den första fördröjningen är inte fastställd. |
| `npm run build`                 | PASS, inklusive TypeScript-kontroll.                                                                                                                                                                                               |
| `npm audit`                     | FAIL (exit 1): 3 höga och 7 måttliga beroendeposter; se nedan.                                                                                                                                                                     |
| `npm audit --omit=dev`          | FAIL (exit 1): 3 höga poster i Prisma-kedjan.                                                                                                                                                                                      |
| Docker Compose / PostgreSQL 16  | EJ VERIFIERAT: Docker saknas på värden.                                                                                                                                                                                            |

`npm ci` och Vitest gav varningar om stödet för ESLint 9 respektive framtida Vite-konfigurationsladdning. De påverkade inte testresultaten men bör följas upp.

## Alternativ utan Docker

En vanlig lokal PostgreSQL-server kan användas. Skapa en **ny tom databas**, exempelvis `createdb -h 127.0.0.1 -U postgres booking_lab_verify`, och konfigurera `DATABASE_URL` i en lokal `.env` med en användare som har rätt att köra migrationen och skapa `btree_gist`. Kör sedan `npm ci`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed` och `npm run dev` enligt README. Använd aldrig produktionsdatabasen för testerna. Detta alternativ med vanlig PostgreSQL-installation har inte testats på just denna värd.

Den faktiskt använda alternativa testmiljön byggde på `embedded-postgres@18.6.0-beta.19` installerat i en separat katalog utanför projektet. En ny katalog för dataklustret initierades med UTF-8, PostgreSQL startades bundet till `127.0.0.1` på port 55439 och en ny databas skapades med paketets `createDatabase`-API. Paketet är ett separat testverktyg, inte ett projektberoende eller del av ZIP-leveransen. Använd en ny katalog och ledig port om metoden upprepas; återanvänd eller radera inte befintliga datakluster av misstag.

## Beroendegranskning

Audit-resultatet räknar påverkade paket i beroendekedjor, inte tio oberoende sårbarheter:

- **Hög:** `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`. [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) gäller stackutmattning när särskilda rekursiva objektgrafer slås ihop; vanlig JSON skapar inte sådana cykler. Den installerade Prisma-konfigurationskoden laddar paketet vid hantering av konfiguration. Det har inte visats att webbens användarindata når den vägen. Auditens föreslagna fix är Prisma 7.10.1, en major-uppgradering som kräver en separat migrering och tester. `--omit=dev` rapporterar också kedjan eftersom `@prisma/client` kan dra in Prisma; anta inte att produktionsinstallation automatiskt saknar den.
- **Måttlig:** `eslint-config-next` → `typescript-eslint@8.72.2` → `@typescript-eslint/typescript-estree` → `minimatch@10.2.6`. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) beskriver resursutmattning med ett angriparstyrt glob-mönster och vissa inställningar. Kedjan används i utvecklings-/lintverktyg; ingen extern angreppsväg till applikationen har verifierats. Vid kontrollen deklarerade aktuell `typescript-estree` fortfarande `minimatch ^10.2.2`, medan rådgivningen anger 11.0.1 som korrigerad version. Även om npm anger att en automatisk fix finns har en fungerande semver-kompatibel lösning inte verifierats här.

Inga automatiska major-uppgraderingar eller overrides gjordes. Kör inte utvecklingsverktyg på opålitlig kod eller konfiguration, och gör en separat uppgradering med riskbedömning och ny fullständig testning. POC:n är inte produktionssäker.

## Git och sekretess

Den första lokala commiten skapades efter att `.gitignore` utökats och en riktad sökning efter vanliga tokenformat, privata nycklar och anslutningssträngar bland 48 källfiler inte gav några träffar. Sökningen är inte en garanti för att alla slags hemligheter eller personuppgifter upptäcks. Endast syntetiska testdata har avsiktligt använts. Ingen remote eller extern publicering skapades.

## Underhållsgranskning 2026-11-11

Efter kod- och beroendestädningen verifierades projektet på Windows med Node 24.16.0 mot en ny, isolerad lokal PostgreSQL 18.6-databas. Den historiska migrationen applicerades och demodata seedades; Docker Compose verifierades inte.

| Kommando/kontroll                       | Resultat                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                | PASS; låsfilen accepterades. npm rapporterade fortfarande 3 höga och 7 måttliga auditposter samt en ESLint-varning.                                                                            |
| `npx prisma validate`                   | PASS.                                                                                                                                                                                          |
| `npm run db:migrate`, `npm run db:seed` | PASS på den nya testdatabasen.                                                                                                                                                                 |
| `npm run lint`                          | PASS.                                                                                                                                                                                          |
| `npm test`                              | PASS, 3 tester; Vite gav en konfigurationsvarning.                                                                                                                                             |
| `npm run test:integration`              | Första körningen FAIL eftersom `npm ci` hade ersatt Prisma-klienten och `prisma generate` ännu inte körts. Efter `npx prisma generate`: PASS, 3 tester.                                        |
| `npm run test:e2e`                      | PASS, 2 körningar: desktop och mobil.                                                                                                                                                          |
| `npm run build`                         | PASS, inklusive TypeScript-kontroll.                                                                                                                                                           |
| TypeScript AST-jämförelse               | PASS: `src/lib/domain.ts` och `src/lib/auth.ts` har samma syntaxträd som före läsbarhetsändringarna.                                                                                           |
| Manuell Chromium-kontroll               | PASS för HTTP 200, rubrik, två tjänster och inga observerade konsol- eller nätverksfel. En skärmbild sparades utanför repot; datumfältets lokaliseringsfynd beskrivs i underhållsgranskningen. |

E2E-testet följde bokningssida → tillgänglighet och boknings-API → PostgreSQL → administrationsagenda samt MCP-utkast → publicering → bokningssida. Testerna använde syntetiska uppgifter. Den tillfälliga `.env`-filen togs bort och testdatabasen stoppades efteråt. Resultaten innebär inte att POC:n är produktionssäker.

## MCP-dataminimering 2026-11-11

På Windows med Node 24 och en ny separat lokal PostgreSQL 18.6-databas kördes migration och seedning med enbart syntetiska uppgifter. `npm run lint`, `npm test` (3 tester), `npm run test:integration` (6 tester), `npx tsc --noEmit`, `npm run test:e2e` (desktop och mobil) och `npm run build` passerade. Next.js-telemetri var avstängd för E2E och build genom processvariabel; Prisma checkpoint var avstängd vid migration. Vitest gav sin befintliga varning om framtida Vite-konfigurationsladdning. Docker Compose har inte verifierats.

Integrationstesterna använder den lokala MCP-protokollklienten och 105 syntetiska bokningar. De täcker avsaknad av adminverktyg utan `--admin`, krav på giltiga datum, 31-dagarsgräns, avvisande av för stor sida och extra fält, sidstorlekar och fortsättningsmarkörer, sortering vid lika starttider, datumgränser kring sommartid och frånvaro av kundnamn/e-post i svaret. Testerna kontrollerar nuvarande `demo`-filter men bevisar inte fullständig tenant-isolering. Boknings- och webbflödet kontrollerades också med befintliga integrationstester och Playwright.

## Epic 01 – 2026-11-11

Aktuell kommandotabell, fel och omkörningar finns i [WORKPLAN.md](WORKPLAN.md). Ren npm ci, Prisma generate/migrate/seed, 8 unit + 8 integration + 4 Playwright, lint, TypeScript och build passerade på ny isolerad PostgreSQL 18.6. Docker Compose och GitHub-workflowen har inte körts här. Den historiska 30-sekundersgränsen gav timeout igen; trace visade även långsam browser-fixture. Ordinarie 60 sekunder passerade med varm och tom Next-cache. Ett fel i det nya testets råa JSON-payload rättades innan slutlig PASS.

### Uppdaterad beroendebedömning

`npm audit --json` och `npm audit --omit=dev --json` gav exit 1 med 3 höga + 7 måttliga respektive 3 höga. Registrykontroll: `npm view prisma@6 version --json` slutar på 6.19.3; @prisma/config@6.19.3 kräver exakt deepmerge-ts 7.1.5. typescript-eslint latest är 8.72.2; typescript-estree kräver minimatch ^10.2.2 och senaste 10.x är 10.2.6. Ingen patch/minor-lösning identifierades.

- [Deepmerge-advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): rättad från 8.0.0, kräver cykliska objektgrafer; vanlig JSON skapar inte sådana. Prisma-konfigurationskedjan är berörd, inte någon verifierad väg från bokningsformuläret. CLI finns även i omit=dev-trädet via klienten; runtime-installationen är alltså inte audit-ren. npm föreslår Prisma 7.10.1, en separat ORM-/driver-/konfigurationsmigrering, inte en säker POC-patch.
- [Minimatch-advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249): rättad i 11.0.1; angriparstyrda glob-mönster kan förbruka resurser vid optimizationLevel >=2. Kedjan används av ESLint/TypeScript ESLint, inte som applikationsfunktion. Ingen fjärrväg har verifierats. En major-override skulle åsidosätta upstream-kontraktet och behöver separat verifiering.

Registry anger BSD-3-Clause för deepmerge-ts 8 och BlueOak-1.0.0 för minimatch 11.0.1. Metadata är inte klarering av faktiska artefakter. Ingen av versionerna infördes och projektlicensen ändrades inte. Kör endast verktygen på betrodd kod/konfiguration; använd inte POC:n publikt eller med riktiga uppgifter. Följ upp upstream-backport eller planera testad Prisma-/lintmigrering före pilot. Risken är dokumenterad, inte eliminerad eller accepterad för produktion.

CI använder officiella [checkout](https://github.com/actions/checkout) och [setup-node](https://github.com/actions/setup-node), båda MIT enligt projekten, låsta till kontrollerade v6-revisioner. Syftet är reproducerbar installation/Compose/testning utan nya npm-paket. GitHub-körning, runnerkompatibilitet och Compose måste verifieras när publicering senare tillåts. Audit är ett felande slutsteg, inte dolt med continue-on-error.

## Visual Progress & Demo Delivery – 2026-11-11

Basrevision `6535b596c4a7be56f091d0d20e88390238dc8caf`, med ocommittad demo-/dokumentationsinstrumentering under körningen (redovisas i manifest). Ingen produktkod eller beroendeversion ändrades. Startläget var rent. Ny lokal PostgreSQL 18.6, databas booking_visual_demo på 127.0.0.1:55443, skapades med tidigare befintligt separat testverktyg. Migration/seed PASS. Docker/Compose är fortfarande ej testat.

| Kommando/kontroll        | Resultat                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run demo:record      | Slutlig PASS 2/2, desktop/mobil, 26,6 s                                                                                                                 |
| npm test                 | PASS 8/8                                                                                                                                                |
| npm run test:integration | PASS 8/8                                                                                                                                                |
| npm run test:e2e         | PASS 4/4, 10,6 s                                                                                                                                        |
| npm run lint             | PASS                                                                                                                                                    |
| npm run build            | PASS                                                                                                                                                    |
| npx tsc --noEmit         | PASS                                                                                                                                                    |
| git diff --check         | PASS                                                                                                                                                    |
| Demons preflight         | PASS: fjärrvärd, fel databasnamn och befintligt syntetiskt utkast avvisades                                                                             |
| Bild/video               | 12 PNG och 2 WebM; Chromium läste videometadata: 10,00 s/800×450 och 10,16 s/392×800. Admin desktop och publicerat erbjudande mobil granskades visuellt |
| npm ci / npm audit       | Ej omkörda: paketversioner/låsfil oförändrade; tidigare Epic-resultat gäller som historik                                                               |

Försök 1: FAIL, grep var felaktigt förankrat och hittade inga tester. Rättat. Försök 2: desktop PASS, mobil FAIL; Playwrights tillfälliga caret-stil för screenshot observerades i React hydration-varning, och en icke-exakt textsökning matchade även dev-overlay. Åtgärd: screenshot med caret initial och exakt bekräftelsetext. Försök 3: PASS på båda enheterna utan observerad hydration-varning. Produktkoden ändrades inte. Misslyckade artefakter är märkta FAIL och ska inte förväxlas med slutleveransen.

Slutlig [lokal demo](../demo-artifacts/2026-11-11T17-17-11-326Z/index.html) och [manifest](../demo-artifacts/2026-11-11T17-17-11-326Z/manifest.json). Endast syntetiska uppgifter; inspelningarna saknar ljud. Trace är avstängt i demo för att undvika request-/sessionsdata i artefakter. Bilder/video är Git-ignorerade och har inte publicerats. Manuell reproduktion finns i DEMO.md. Observerad UX-begränsning: datumfältets placeholder är mm/dd/yyyy även med sv-SE; admin är en enkel agenda. Verifierad demo innebär inte produktionsberedskap.

Efter körningen stoppades testdatabasen (pg_ctl: no server running) och hjälpprocessen. Den egen skapade tillfälliga .env togs bort. Kluster och demoartefakter finns kvar lokalt; ingen automatisk gallring görs.

</details>

</details>
