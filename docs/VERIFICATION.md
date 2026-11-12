# Verifiering — aktuell Epic 03-kandidat

2026-11-12, kod **18a4d736bd5435ed8d856ae87843cadcf237cfcc**, branch epic-03-dependency-security, bas dba05a2. Node 24.16.0 / npm 11.13.0 på Windows; ny PostgreSQL 18.6 på loopback 55449/booking_epic03_test. Serverns grundzon Europe/Paris, klientzon uttryckligen UTC. Syntetiska data; ingen push/merge/deploy. Groks oberoende slut-QA pågår, ingen slutbedömning antas.

## Aktuell resultattabell

| Kommando / kontroll | Faktiskt resultat på kandidaten |
| --- | --- |
| npm ci | **PASS**, exit 0, added 568 / audited 569 i 1 min. ESLint9 deprecation-varning;7 moderate. |
| npx prisma generate | PASS, Generated Prisma Client v7.10.1,126 ms. |
| npm run db:migrate | PASS, alla3 oförändrade migrationer på ny databas. |
| npm run db:seed | PASS, exit 0, två syntetiska tjänster. |
| npm run lint | PASS, exit 0. |
| npx tsc --noEmit | PASS, exit 0 både före och efter fullmatris. |
| npm test | PASS, **51/51**,8 filer,2,24 s. |
| npm run test:integration ×3 | PASS, **31/31 ×3**,25,27 / 26,83 / 28,11 s,8 filer. |
| TRUST_PROXY_IP=0 npm run test:e2e | PASS, dev **12/12**,1,4 min. |
| TRUST_PROXY_IP=1 npm run test:e2e | PASS, dev **12/12**,35,7 s. |
| npm run build | PASS,3,6 s kompilering, TypeScript,8/8statiska sidor. |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e | PASS, **12/12**,29,2 s. |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 npm run test:e2e | PASS, **12/12**,25,2 s. |
| node --env-file=.env scripts/test-cleanup.mjs | PASS, wrapperexit 0: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS. |
| Slutaggregat/SQL-overlap/pg_stat_database | PASS: bookings0,campaigns0,sessions0,overlaps0,deadlocks0. |
| Syntetisk uppgraderingskopia från Epic 02 | PASS, templatekopia på55448/booking_epic03_upgrade_test:3 migrationer inga väntande, Booking/Campaign/Session bevarade, ORM-update exakt UTC-epoch. |
| npm audit --json | **FAIL exit 1,7 moderate,0 high/critical**. Ingen override eller allowlist. |
| npm audit --omit=dev --json | **PASS exit 0,0 fynd**. CLI kan ändå installeras via optionalpeer. |
| Byggspårning |10 server-nft-filer,0 elkjs/Studio/prisma-build-referenser. Inte full distributionsklarering. |
| Ny demo, extern CI, Docker, riktig TLS/proxy/flerinstans | **EJ KÖRT**. Ingen synlig produktändring/ingen push; Docker saknas. Senaste video är äldre Epic 02-kod. |
| Grok QA | **PÅGÅR** på fryst 18a4d73, med egen miljö. Inget PASS antas före läst rapport. |

Alla faktiska körloggar utanför Git i C:/Users/<user>/booking-lab-pg-test/: epic03-ci/generate/migrate/seed.log; epic03-final-lint/tsc/unit/integration-1/2/3/e2e-dev-0/1/build/e2e-prod-0/1/cleanup/tsc-after.log; epic03-final-audit.json och epic03-final-audit-production.json. Uppgraderingsproben: epic03-upgrade-clone.log. De angivna tiderna/countsen kommer från faktisk output; inga CI-resultat tillskrivs lokal körning.

## Fel som fångades och begränsningar

- Första integration:24PASS/1FAIL/5SKIPPED. Verklig exclusion gav ny adapter-meta; DST-fixturens check bröts p.g.a. offsetlös serialisering i annan PG-sessionzon. Rättat med strukturerad mapping och UTC-session, inte ändrade datum/testgränser/DB-spärrar. Sedan31/31 och slutmatrisen ovan. Logg epic03-initial-integration.log.
- Första externa licensinventering använde ConvertFrom-Json utan -AsHashtable på npm:s tomma rotkey; metadata kom inte fram. Korrigerad inventering har129ändrade poster. Saknad LICENSE i @prisma/dev-rot dokumenteras, ingen full bundled-licensklarering påstås.
- pg_dump/pg_restore-proben gav exit 1 eftersom binärerna saknas. Ingen backup/restore är verifierad. Egen testfixture städades; templatekopian genomfördes sedan med PASS. Loggar för båda finns kvar.
- ESLint9 deprecation och NO_COLOR/FORCE_COLOR-varning kvar. Vites tidigare CJS/ESM-configvarning uppträder inte efter type:module. Audit7 moderate är kvar/upstreamblockerat, inte grönt.
- Ingen nätverksfångst, full OS-processisolering, skarp backup/rollback eller binär/containerlicensgranskning. [Beslut och risker](DEPENDENCY_REVIEW.md).

## Bilaga — Epic 02 verifieringshistorik

## Epic 02: slutgodkänd lokal POC

Verifierad kod **3cd633b99e5aa990d002dc5563aed4bfe6bfe4a6**, branch `epic-02-local-agent-booking`, 2026-11-12. Bas `02edeaf`. Node 24.16.0/npm 11.13.0 på Windows. Ny isolerad PostgreSQL 18.6, `127.0.0.1:55448/booking_epic02_test`; separat `booking_epic02_demo` för inspelning. Endast syntetiska uppgifter. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1 sattes före CLI/byggprocesserna. Inga nya paket, migrationer eller ändrat HTTP-kontrakt. Ingen push/merge/deploy.

### Historisk resultattabell Epic 02

| Kommando / kontroll | Faktiskt resultat |
| --- | --- |
| npm ci | **EJ KÖRT lokalt i Epic 02**; befintlig installation/låsfil återanvänd. Grok körde ren npm ci på fc83a70: PASS, 462 paket. Låsfil och manifest är identiska på slutkoden. |
| npx prisma generate | PASS, Prisma 6.19.3 |
| npm run db:migrate | PASS, samtliga 3 oförändrade historiska migrationer på ny testdatabas; även ny separat demodatabas migrerad |
| npm run db:seed | PASS på test och demo |
| npm run lint | PASS, exit 0 |
| npx tsc --noEmit | PASS, exit 0 |
| npm test | PASS, **43/43**, 7 filer, 2,70 s |
| npm run test:integration, tre körningar efter QA-rättning | PASS, **30/30 ×3**, 24,86 / 28,22 / 26,62 s |
| TRUST_PROXY_IP=0 npm run test:e2e (dev) | PASS, **12/12**, 1,3 min |
| TRUST_PROXY_IP=1 npm run test:e2e (dev) | PASS, **12/12**, 31,6 s |
| npm run build | PASS, produktion, TypeScript och 8/8 statiska sidor |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e | PASS, **12/12**, 21,1 s |
| E2E_PRODUCTION=1 TRUST_PROXY_IP=1 npm run test:e2e | PASS, **12/12**, 20,9 s |
| node --env-file=.env scripts/test-cleanup.mjs | PASS: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0. Wrapper exit 0; barnets avsiktliga timeout är inte ett testsvitfel. |
| Aggregat på testdatabasen efter sviten | PASS: 0 bokningar, 0 kampanjer, 0 sessioner, 0 överlapp, pg_stat_database.deadlocks=0 |
| npm audit --json | **FAIL, exit 1**: 3 höga + 7 måttliga, 0 kritiska. Omkört efter QA-rättning, epic02-qa-audit.json; inga automatiska uppgraderingar/overrides. |
| npm run demo:record | **PASS 4/4**, 1,2 min, produktionsbygge, ren **7a65aee** (samma kod som 3cd633b), dirty=false. **14 PNG, 4 WebM**. Första misslyckade försök bevaras separat. |
| Grok slut-QA | **PASS, Epic 02 kan stängas som lokal POC** på cad997b, 01:34–01:44 CET. Ren npm ci/Prisma/lint/tsc/build, 43 unit, 30 integration ×3, 12 E2E ×4 och cleanup PASS i egen miljö. Audit FAIL 3/7. QA-1 stängt; inga blockerande nya fynd. [Originalrapport](qa/QA-REPORT-epic02-cad997b.md). |
| GitHub Actions på Epic 02 | **EJ KÖRT**: ingen push tillåten. Epic 01:s CI är inte bevis för Epic 02. |
| Docker Compose, riktig TLS/proxy, IPv6-transport/fler serverinstanser | **EJ KÖRT**. Docker saknas i PATH. Loopback-simulering av proxy i E2E ersätter inte driftverifiering. |

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

| Kommando/kontroll | Faktiskt resultat |
| --- | --- |
| `npx prisma generate` | PASS: Generated Prisma Client (v6.19.3). |
| `npm run db:migrate`, `npm run db:seed` | PASS, exit 0: tre befintliga migrationer på ny isolerad booking_followup_test. |
| `npm run lint`, `npx tsc --noEmit` | PASS, exit 0; tsc även efter hela E2E-matrisen. |
| `npm test` | PASS: Test Files 5 passed (5), Tests 28 passed (28), 1.57 s. |
| `npm run test:integration`, fem sekventiella körningar | PASS 18/18 i alla fem. Tider 12.12, 11.11, 10.97, 11.55, 11.21 s. |
| Stressregression i varje integrationskörning | 20 omgångar ×20 blandade 30/60-minutersanrop: exakt en framgång/omgång, övriga DomainError ”Tiden är inte tillgänglig”, varje omgång <2000 ms, SQL-kontroll visar 0 överlapp. Totalt 100 omgångar/2000 anrop över fem körningar. |
| PostgreSQL-logg efter integration och efter E2E | POSTGRES_DEADLOCK_COUNT=0. |
| `npm run test:e2e`, dev/proxy=0 | PASS: 8 passed (1.2m). |
| `npm run test:e2e`, dev/proxy=1 | PASS: 8 passed (24.7s). |
| `npm run build` | PASS: Compiled successfully in 1913ms; statiska sidor 8/8. |
| `npm run test:e2e`, E2E_PRODUCTION=1/proxy=0 | PASS: 8 passed (16.0s). |
| `npm run test:e2e`, E2E_PRODUCTION=1/proxy=1 | PASS: 8 passed (16.2s). |
| `node --env-file=.env scripts/test-cleanup.mjs` | PASS, exit 0: CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS. |
| Slutlig Prisma-räkning | {"booking":0,"campaign":0,"adminSession":0}. Ingen manuell datarensning. |
| `node --env-file=.env scripts/server.mjs`, TRUST_PROXY_IP=1, TRUSTED_PROXY_IPS=::/32 | Negativ kontroll PASS: BOOKING_SERVER_CONFIG_FAILED, exit 1 före lyssning. |
| YAML-parsning med befintlig js-yaml | PASS: mode=[dev,production], proxy=[0,1], fyra kombinationer. Det är inte en extern Actions-körning. |
| Prettier 3.6.2 check på ändrade kod-/CI-filer | PASS: All matched files use Prettier code style! Inget projektberoende tillagt. |
| Diff-check, package.json/låsfil/tre migrationer mot 8b83a40 | PASS; skyddade filer oförändrade. |

## Ändringar och testgränser

createBooking tar advisory lock per verksamhet/anställd/bokningsdag före tillgänglighetskontroll och insert. Låsordningen är idempotens → klient/skapandedag → e-post/skapandedag → anställd/bokningsdag. Exclusion är oförändrad. Strukturerade P2010/meta.code 23P01/40P01/40001 mappas till befintlig DomainError; unit testar samtliga samt att andra databasfel inte maskeras som konflikt. Inga riktiga deadlocks framkallades för felmappningstestet; det använder konstruerade Prisma-fel. Stressregressionen kör riktig PostgreSQL och observerade inga deadlocks.

Proxyvalideringen avvisar IPv6-subnät som matchar IPv4-ändpunkterna via Node BlockList. Unit inkluderar ::/32, ::/64, ::/80 och bevarad giltig IPv4, IPv6-adress och 2001:db8::/32. Serverstart med ::/32 är provad separat. CI-matrisen bygger och kör E2E i fyra isolerade runner-/DB-miljöer; lint/unit/integration körs i dev/0. Audit är separat och oförändrat.

## Miljö och reproduktion

Ny PostgreSQL 18.6 via tidigare installerat externt embedded-postgres: 127.0.0.1:55447, kluster C:\Users\<user>\booking-lab-pg-test\qa-followup-20261111. Windows, Node 24.16.0, npm 11.13.0. Samma nya *_test-databas användes för fem sekventiella körningar; testerna städar sina egna data. Full E2E kördes därefter i ett sekventiellt skript med stopp vid fel. NEXT_TELEMETRY_DISABLED=1 och CHECKPOINT_DISABLE=1; bara syntetiska uppgifter. Reproducerbara testkommandon finns i README; integrationsupprepning: `1..5 | ForEach-Object { npm run test:integration; if ($LASTEXITCODE -ne 0) { throw 'Integration failed' } }`.

Råloggar utanför Git: C:\Users\<user>\booking-lab-pg-test\followup-integration-1.log till -5.log, followup-pg.log, followup-e2e-dev-0.log, followup-e2e-dev-1.log, followup-build.log, followup-e2e-prod-0.log och followup-e2e-prod-1.log. Samtliga testkörningar passerade första försöket i denna uppföljning. En hjälpkontroll av YAML försökte först använda modulen yaml som inte fanns; den kördes om med redan installerad js-yaml och passerade. Inga paket installerades för detta.

**Inte kört:** npm ci och npm audit på nytt (paket/låsfil oförändrade, senaste verifierade audit var 3 high/7 moderate), demo:record enligt ny överenskommen policy, nya GitHub Actions-jobb (ingen push), Docker/PG16 lokalt, riktig TLS/proxy, riktiga IPv6-sockets eller flera appinstanser. CI-acceptansen ”fyra gröna jobb” är därför ännu inte verifierad externt. Senaste demo avser äldre a364bda och används inte som bevis för denna kod.

M2/L8 har riktade regressionsbevis; inga funktionella regressioner observerades. Pilot fortfarande NO-GO: delat adminlösenord, kund-GDPR-livscykel, audit, verklig drift/TLS/proxy och kontaktvägsbeslut återstår. Processlokal limiter och dagbaserad serialisering är POC-avvägningar. Befintliga lokala ändringar av demopolicyn i AGENTS/DEMO bevarades och ingår i kodcommiten.

Efter verifieringen stoppades egen PostgreSQL och hjälpprocess (server stopped; pg_ctl: no server running). Inga lyssnare på 3000/55447 återstod. Egen tillfällig syntetisk .env togs bort efter adresskontroll; klusterfiler/loggar behölls lokalt.

<details>
<summary>Bilaga: historiska verifieringsomgångar</summary>

# Verifiering – Epic 01 QA fix batch 3

Verifierat 2026-11-11 cirka 22:48–22:54 Europe/Stockholm. Kodrevision **a364bda73850c2983212684e94e9690d100d1d9b**, bas **056d0c2**, branch `epic-01-foundation-hardening`. Dokumentationscommit följer. Beställt: punkter 1–5 och små förbättringar i punkt 6. Visa e-post är fortsatt undantagen. Ingen push, merge, deploy eller Epic 02.

## Aktuell resultattabell

| Kommando/kontroll | Faktiskt resultat |
| --- | --- |
| `npm ci` | PASS, exit 0: `added 461 packages, and audited 462 packages in 1m`; 10 vulnerabilities. |
| `npx prisma generate` | PASS: `Generated Prisma Client (v6.19.3)`. |
| `npm run db:migrate` | PASS på nya test/demo: `3 migrations found`; `All migrations have been successfully applied.` Alla tre migrationer oförändrade. |
| `npm run db:seed` | PASS, exit 0 på båda databaserna. |
| `npm run lint` | PASS, exit 0 utan diagnostik. |
| `npx tsc --noEmit` | PASS, exit 0; även efter hela E2E-matrisen. |
| `npm test` | PASS: `Test Files 4 passed (4)`; `Tests 24 passed (24)`; 2.07 s. |
| `npm run test:integration` | PASS: `Test Files 5 passed (5)`; `Tests 17 passed (17)`; 10.21 s. |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=0 | PASS: `8 passed (25.6s)`. |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=1 | PASS: `8 passed (24.7s)`. |
| `npm run build` | PASS: `Compiled successfully in 1966ms`; statiska sidor 8/8. |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=0 | PASS: `8 passed (16.0s)`. |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=1 | PASS: `8 passed (16.0s)`. |
| `node --env-file=.env scripts/test-cleanup.mjs` | PASS, exit 0: `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS`. Inkluderar nu sessionen. |
| DB-räkning efter full matris och cleanup | PASS: `{"booking":0,"campaign":0,"adminSession":0}`. Ingen manuell rensning behövdes. |
| `npm run demo:record`, exporterad `_demo`-URL | PASS: `2 passed (25.4s)`, 12 PNG och 2 WebM, ren a364bda, production. Därefter demo-DB 0/0/0. |
| `npm audit --json` | FAIL, exit 1: `{"info":0,"low":0,"moderate":7,"high":3,"critical":0,"total":10}`. |
| `npm audit --omit=dev --json` | FAIL, exit 1: 3 high, 3 totalt. Oförändrade beroendekedjor. |
| `npx --yes prettier@3.6.2 --check` på ändrade TS/MJS | PASS: `All matched files use Prettier code style!`. Verktyget kördes externt, inget paket tillagt. |
| `git diff --exit-code 056d0c2 -- package.json package-lock.json prisma/migrations` | PASS, oförändrat; inga nya migrationer eller beroenden. |
| `git diff --check` | PASS efter borttagning av extra tomma slutrader i dokument. |

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

| Kommando/kontroll | Faktiskt slutresultat |
|---|---|
| `npm ci` | PASS, exit 0: `added 461 packages, and audited 462 packages in 1m`; `10 vulnerabilities (7 moderate, 3 high)`. |
| `npx prisma generate` | PASS: `Generated Prisma Client (v6.19.3)`. |
| `npm run db:migrate` | PASS på nya `_test` och `_demo`: `3 migrations found`; `All migrations have been successfully applied.` |
| `npm run db:seed` | PASS, exit 0 på båda nya databaserna. Även separat decoy-databas migrerad/seedad för miljötest. |
| `npm run lint` | PASS, exit 0 utan diagnostik. |
| `npx tsc --noEmit` | PASS, exit 0; även efter sista produktions-E2E. |
| `npm test` | PASS: `Test Files 4 passed (4)` / `Tests 20 passed (20)`, 1.97 s. |
| `npm run test:integration` | PASS: `Test Files 4 passed (4)` / `Tests 16 passed (16)`, 9.85 s. |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=0 | PASS: `8 passed (1.2m)`. |
| `npm run test:e2e`, dev, TRUST_PROXY_IP=1 | PASS: `8 passed (27.0s)`. |
| `npm run build` | PASS: `Compiled successfully in 961ms`; statiska sidor `8/8` på 153 ms. |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=0 | PASS: `8 passed (19.5s)`. |
| `npm run test:e2e`, E2E_PRODUCTION=1, TRUST_PROXY_IP=1 | PASS: `8 passed (19.1s)`. |
| `node --env-file=.env scripts/test-cleanup.mjs` | PASS: `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS`. Den avsiktliga timeout-processen ska avslutas med 1; kontrollskriptet avslutades med 0. |
| `npm run demo:record`, ny `_demo` | PASS: produktionsbygge + `2 passed (24.2s)`, 12 PNG och 2 WebM. Manifest a84e48a, dirty=false. |
| `npm audit --json` | FAIL, exit 1: 3 high, 7 moderate, 10 total. |
| `npm audit --omit=dev --json` | FAIL, exit 1: 3 high, 0 moderate, 3 total. |
| Proxyläge utan TRUSTED_PROXY_IPS, `node scripts/server.mjs` | PASS negativ startkontroll: `BOOKING_SERVER_CONFIG_FAILED`, exit 1 före lyssning. |
| Extern Prettier 3.6.2 `--check` | PASS: `All matched files use Prettier code style!` på src/tests/scripts/config/seed. Inget nytt projektberoende. |
| Git-diff och skyddade filer | PASS: diff-check utan fel; package-lock och båda tidigare migrationer oförändrade mot b000481. `.env`, artefakter, resultat och dependencies ignorerade. |

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
{"info":0,"low":0,"moderate":7,"high":3,"critical":0,"total":10}
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

| Kommando/kontroll | Faktiskt resultat |
|---|---|
| `npm ci` | PASS, exit 0; `added 461 packages in 1m`. Ren ominstallation från oförändrad låsfil. |
| `npx prisma generate` | PASS, Prisma Client 6.19.3. Första sandboxförsöket stoppades av nedladdningsåtkomst; godkänd omkörning passerade. |
| `npm run db:migrate` | PASS på två nya databaser; båda migrationerna applicerade. Historisk migration oförändrad. |
| `npm run db:seed` | PASS på båda databaserna, två syntetiska tjänster. |
| `npm run lint` | PASS, exit 0, inga lintfel. |
| `npx tsc --noEmit` | PASS, exit 0, ingen diagnostik. |
| `npm test` | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 1.18 s. |
| `npm run test:integration` | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 8.20 s. |
| `npm run test:e2e` | PASS: `6 passed (15.2s)`, Chromium desktop och Pixel 7-emulering, utvecklingsserver. |
| `npm run build` | PASS: `Compiled successfully in 3,6 s`, `Generating static pages (8/8) in 146ms`, exit 0. |
| `npm run demo:record` | PASS: produktionsbygge + `2 passed (25.7s)`, tolv PNG och två WebM. |
| `npm audit --json` | FAIL, exit 1: 3 high, 7 moderate, 10 total. |
| `npm audit --omit=dev --json` | FAIL, exit 1: 3 high, 0 moderate. |
| Extern Prettier 3.6.2 `--check` | PASS: `All matched files use Prettier code style!` på src (inklusive CSS), tests, scripts, TS/MJS-config och seed. ESLint-configens AST är oförändrat; CSS-diff granskad (radbrytningar och inledande nollor). |
| `git diff --check`; jämförelse av gammal migration, package.json och package-lock mot basen | PASS; inget innehåll ändrat i de skyddade filerna. |
| Docker Compose/PostgreSQL 16, GitHub Actions, verklig TLS/proxy/flerprocessdrift | EJ KÖRT. Docker saknas; ingen remote/publicering tillåten. |

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
{"info":0,"low":0,"moderate":7,"high":3,"critical":0,"total":10}
```

Prisma/config/deepmerge-ts står för de tre höga posterna, ESLint/typescript-eslint/minimatch för de sju måttliga. Det är beroendeposter, inte tio oberoende sårbarheter. Inga major-uppgraderingar, overrides eller `audit fix --force`. Se historisk advisoryanalys nedan och [separat Prisma 7-plan](PRISMA_7_PLAN.md). Audit ligger nu i eget märkt CI-jobb och kommer fortfarande att ge rött; detta döljs inte med `continue-on-error`.

## Vad acceptanstesterna faktiskt bevisar

- Fem felaktiga lösenordsförsök följs av 429 på sjätte/sjunde, statiskt svenskt fel och Retry-After. Tre bokningar per normaliserad e-post och skapandedag i Stockholm; fjärde nekas även med parallella anrop. Bokningsrutten spärrar efter 30 försök per 15 minuter.
- Utloggning visar loginform och efterföljande publicering ger 403. Sessionsversionstest ogiltigförklarar gammal signerad cookie utan byte av SESSION_SECRET.
- 150 syntetiska bokningar ger 100 + 50, korrekt sortering/datumavgränsning över Stockholms 25-timmarsdygn och maskerad e-post. MCP:s negativa datum-/behörighets-/sidtester finns kvar.
- Sekventiellt retry och 20 samtidiga anrop med samma nyckel ger en rad och samma ID; annan payload ger 409. Även 20 parallella HTTP-anrop testas.
- 20 samtidiga bokningar och en separat blandad 30/60-minutersgrupp ger exakt en framgång per konfliktfönster. SQL self-join med `tstzrange &&` hittar noll överlapp. Forcerad exclusion-överträdelse blir DomainError 400 med `Tiden är inte tillgänglig`.
- Verkliga Vitest-/Playwright-konfigurationsstarter med otillåten databas-URL avslutas med non-zero och `TEST_DATABASE_REFUSED` innan testinsamling/serverstart/dataåtkomst. Localhost samt *_test/*_demo krävs, men detta är ingen garanti för att data i en tillåten databas är syntetiska.
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

| Kontroll | Resultat |
|---|---|
| `npm ci` | PASS; ren ominstallation från låsfilen. |
| `npx prisma generate` | PASS. |
| `npm run db:migrate` | PASS på den nya databasen. |
| `npm run db:seed` | PASS. |
| `npm run lint` | PASS. |
| `npm test` | PASS, 3 enhetstester. |
| `npm run test:integration` | PASS, 3 integrationstester, inklusive samtidiga bokningsförsök och direkt kontroll av databasens överlappsspärr. |
| `npm run mcp:client -- --admin` | PASS; listade behandlingar, hämtade tillgänglighet och skapade utkast. |
| `npm run test:e2e` | Första körningen: FAIL för desktop, 30 sekunders timeout vid `page.goto`; mobil PASS. Efter att testets timeout ökats till 60 sekunder: PASS för både desktop och mobil. Orsaken till den första fördröjningen är inte fastställd. |
| `npm run build` | PASS, inklusive TypeScript-kontroll. |
| `npm audit` | FAIL (exit 1): 3 höga och 7 måttliga beroendeposter; se nedan. |
| `npm audit --omit=dev` | FAIL (exit 1): 3 höga poster i Prisma-kedjan. |
| Docker Compose / PostgreSQL 16 | EJ VERIFIERAT: Docker saknas på värden. |

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

| Kommando/kontroll | Resultat |
|---|---|
| `npm ci` | PASS; låsfilen accepterades. npm rapporterade fortfarande 3 höga och 7 måttliga auditposter samt en ESLint-varning. |
| `npx prisma validate` | PASS. |
| `npm run db:migrate`, `npm run db:seed` | PASS på den nya testdatabasen. |
| `npm run lint` | PASS. |
| `npm test` | PASS, 3 tester; Vite gav en konfigurationsvarning. |
| `npm run test:integration` | Första körningen FAIL eftersom `npm ci` hade ersatt Prisma-klienten och `prisma generate` ännu inte körts. Efter `npx prisma generate`: PASS, 3 tester. |
| `npm run test:e2e` | PASS, 2 körningar: desktop och mobil. |
| `npm run build` | PASS, inklusive TypeScript-kontroll. |
| TypeScript AST-jämförelse | PASS: `src/lib/domain.ts` och `src/lib/auth.ts` har samma syntaxträd som före läsbarhetsändringarna. |
| Manuell Chromium-kontroll | PASS för HTTP 200, rubrik, två tjänster och inga observerade konsol- eller nätverksfel. En skärmbild sparades utanför repot; datumfältets lokaliseringsfynd beskrivs i underhållsgranskningen. |

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

| Kommando/kontroll | Resultat |
|---|---|
| npm run demo:record | Slutlig PASS 2/2, desktop/mobil, 26,6 s |
| npm test | PASS 8/8 |
| npm run test:integration | PASS 8/8 |
| npm run test:e2e | PASS 4/4, 10,6 s |
| npm run lint | PASS |
| npm run build | PASS |
| npx tsc --noEmit | PASS |
| git diff --check | PASS |
| Demons preflight | PASS: fjärrvärd, fel databasnamn och befintligt syntetiskt utkast avvisades |
| Bild/video | 12 PNG och 2 WebM; Chromium läste videometadata: 10,00 s/800×450 och 10,16 s/392×800. Admin desktop och publicerat erbjudande mobil granskades visuellt |
| npm ci / npm audit | Ej omkörda: paketversioner/låsfil oförändrade; tidigare Epic-resultat gäller som historik |

Försök 1: FAIL, grep var felaktigt förankrat och hittade inga tester. Rättat. Försök 2: desktop PASS, mobil FAIL; Playwrights tillfälliga caret-stil för screenshot observerades i React hydration-varning, och en icke-exakt textsökning matchade även dev-overlay. Åtgärd: screenshot med caret initial och exakt bekräftelsetext. Försök 3: PASS på båda enheterna utan observerad hydration-varning. Produktkoden ändrades inte. Misslyckade artefakter är märkta FAIL och ska inte förväxlas med slutleveransen.

Slutlig [lokal demo](../demo-artifacts/2026-11-11T17-17-11-326Z/index.html) och [manifest](../demo-artifacts/2026-11-11T17-17-11-326Z/manifest.json). Endast syntetiska uppgifter; inspelningarna saknar ljud. Trace är avstängt i demo för att undvika request-/sessionsdata i artefakter. Bilder/video är Git-ignorerade och har inte publicerats. Manuell reproduktion finns i DEMO.md. Observerad UX-begränsning: datumfältets placeholder är mm/dd/yyyy även med sv-SE; admin är en enkel agenda. Verifierad demo innebär inte produktionsberedskap.

Efter körningen stoppades testdatabasen (pg_ctl: no server running) och hjälpprocessen. Den egen skapade tillfälliga .env togs bort. Kluster och demoartefakter finns kvar lokalt; ingen automatisk gallring görs.

</details>

</details>
