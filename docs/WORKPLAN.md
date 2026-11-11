# Epic 01 – arbetsplan

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
