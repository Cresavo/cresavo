# Booking Lab SE – Epic 01 handoff

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
