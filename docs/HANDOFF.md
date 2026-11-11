# Handoff – Epic 01 QA fix batch

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
