# QA-rapport Epic 05 fixvarv 1 – E05-QA-1 – kandidat 4fc98d3

**Granskare:** Grok Bot (oberoende, read-only) · **Datum:** 2026-11-12, 12:12–12:35 CET  
**Kandidat:** `4fc98d37fef805e041f8f8772a3fc37543d4ff04` · **Jämförd mot:** 7fc0e86 (min fullgranskning, `QA-REPORT-epic05-7fc0e86.md`)  
**Omfattning:** Riktad återkontroll av E05-QA-1 samt behörighets-, idempotens- och kvotregressioner. Inte en ny fullgranskning och ingen demoloop.

## Verdikt

- **E05-QA-1: STÄNGD.**
- **Begränsad lokal produktalfa: GO.**
- **Pilot: fortsatt NO-GO** (kända pilotblockerare enligt 7fc0e86-rapporten, avsnitt 6).
- Inga nya blockerare, så ingen fixbeställning.

## 1. Revision och miljö

- **Zip:**
  - SHA256 `537dd086e0b310698bd4d3413d7c37f8ac6b6da1eac20c1a16528106d7e2e32c`, zip-kommentar = `4fc98d3…`.
  - 172/172 filer matchar inventory.json (sha256). Ingen `.env`, `node_modules` eller `.next`.
- **Trädjämförelse mot 7fc0e86-extraktet (LF-normaliserat):**
  - Produktkod: endast `src/app/api/admin/bookings/route.ts`, `src/lib/domain.ts` och `src/lib/rate-limit.ts`.
  - Tester: `tests/e2e/workspace.spec.ts`, ny `tests/integration/admin-booking-limits.test.ts` och `tests/security.test.ts`.
  - Övrigt: dokument och `docs/qa/` med min originalrapport och fixbeställning. Rapporten har sha256 `03ea42f5…2ffa5`, identisk med mitt original. Fixbeställningen är också identisk.
  - LICENSE skiljer sig bara i CRLF.
  - **`package.json`, `package-lock.json` och hela `prisma/` (alla migrationer) är byte-identiska.** Alltså inga nya beroenden och ingen ny migration.
- **Miljö:**
  - Linux-box, Node v24.22.1, npm 11.21.1.
  - Egen ny embedded PostgreSQL 18.6 på 127.0.0.1:**55571**, timezone Europe/Stockholm.
  - Databaser: booking_f1_test (matris) och booking_f1probe_test (prober).
  - Egen slumpad `SESSION_SECRET` (≥32 tecken, inte utskriven) och exporterad `DATABASE_URL`.
  - Endast syntetisk @example.test-data. E2E på port 3000, prober på 3330. Allt kördes sekventiellt.

## 2. Kommandon (mina körningar)

| Steg | Resultat |
|---|---|
| npm ci | PASS (9 s) |
| prisma generate | PASS (7.10.1) |
| db:migrate | PASS (5 migrationer) |
| db:seed | PASS |
| lint | PASS |
| tsc --noEmit | PASS |
| npm test | PASS, **69/69** |
| npm run test:integration | PASS, **66/66** (16 filer) |
| Ny fil `admin-booking-limits.test.ts` ensam | PASS, 2/2 |
| build | PASS |
| test:e2e dev, TRUST_PROXY_IP=0 | PASS, 24/24 |
| test:e2e dev, TRUST_PROXY_IP=1 | PASS, 24/24 |
| test:e2e prod (E2E_PRODUCTION=1), TRUST_PROXY_IP=0 | PASS, 24/24 (inklusive nya "manuella adminbokningar har egen budget…") |
| test:e2e prod, TRUST_PROXY_IP=1 | PASS, 24/24 |
| npm audit --json | rc=1: 7 moderate, 0 high/critical (devDeps, oförändrat) |
| npm audit --omit=dev --json | PASS, 0 |
| Städning efter tester | 0 bokningar, 0 AdminUser, 0 WorkspaceRequest i matris-DB |

Proxylistan i E2E är fortfarande fixturens `127.0.0.10/32` (dokumenterat).

**Deadlock-not:** pg-loggen visar **1 deadlock** kl. 12:14:01 under `test:integration`.

- Den uppstod mellan två samtidiga *direkta* `db.booking.create` mot exclusion constraint.
- Det är det oförändrade testet `tests/integration/booking.test.ts:25–27`, som medvetet går förbi `createBooking`.
- PostgreSQL kan välja deadlock mellan konkurrerande exclusion-inserts. Testet godkänns (högst en vinnare) och appen mappar 40P01 till en kontrollerad konflikt.
- Ingen deadlock i mina prober eller i `createBooking`-vägen. Det är inte en regression från fixen, men det noteras.

## 3. Kodgranskning av fixen

- **Var adminpolicyn kommer ifrån:** `domain.ts` härleder `admin` enbart från parametern `actor?.kind === "admin"`. Den kommer bara från serverns `requireAdmin` i adminrouten.
  - Publik route (`api/bookings/route.ts`) och MCP (`mcp/server.ts:79`) skickar ingen actor. Body-fält ignoreras, eftersom schemat strippar okända nycklar.
  - `assertWorkspaceActor` körs fortfarande först i transaktionen, före replay och skrivning.
- **Budget och kollisionsrisk:** Adminbudgeten är `HMAC-SHA256(SESSION_SECRET, "admin:<konto-id>")`. Publik `clientIp` ger alltid en validerad IP eller /64, så en publik adress kan inte kollidera med prefixet `admin:`.
- **E-posttak:** E-postlås och e-posttak hoppas över för admin, och `emailCapKey` blir NULL.
- **Lås och kontroller:** Samma client/day-lås gäller. Låsordning, admin-idempotensnamnrymd, serviceVersion och exclusion är oförändrade.
- **Inga nya läckor:** inga nya loggar eller felvägar och ingen ny exponering av hemligheter. Adminrouten skickar inte längre IP.
- **Info, ingen regression:** Adminbegäran som faller på routens zod-schema räknas inte mot admin-bucketen, eftersom parsningen sker före `createBooking`. Det var likadant före fixen och gäller en autentiserad aktör.

## 4. E05-QA-1 – bevis (egna prober mot produktionsbuild, `logs/p-fix.json`, `logs/p-fix2.json`)

| Kontroll | Utfall |
|---|---|
| (1) 8 admin-create, samma IP och samma kund-e-post | 8×201. Raderna har `emailCapKey` NULL och en gemensam clientKey. |
| (1) Admin A upp till taket | 100×201 (en serverrestart vid 60 för att nollställa 60/15 min-bucketen); **den 101:a gav 429**, Retry-After ≈ 41 896 s (till midnatt). DB: 100 create-events för A. |
| (1) Annan admin efter att A nått taket | 201 |
| (2) Publik route, samma IP efter 8 adminbokningar | Samma e-post: 201, 201, 201, sedan 4:e **429**. Andra e-postadresser: 201, 201 (totalt 5). 6:e **429 även med giltig admincookie och förfalskat `actor`/`actorKind` i body**. 7:e 429. 5 publika rader. |
| (3) Admin efter att det publika IP-taket är slut | 201. Admin förbrukar inte och blockeras inte av kundbudgeten. |
| (4) Identiska retries | 20 parallella med samma nyckel: 20×201 med samma id; create-events oförändrade (2→2). Samma nyckel med annan payload: **409**. Replay efter att kontot inaktiverats via CLI: **403**. |
| (4) Replay förbrukar inte bucketen | 52 förbrukade försök, därefter 20 replays, sedan exakt **8** giltiga 201 och därefter 429. Replays är alltså gratis. |
| (5) admin-bookings 60/15 min | 60 försök mot upptagen tid (400) gör att det 61:a giltiga får **429**. Annan admin på samma IP: 201. Publik på samma IP: 201. |
| (6) MCP create_booking | Samma e-post: ok, ok, ok, sedan 4:e 429. Andra e-postadresser: ok, ok, sedan 429 (kanaltaket 5/dag). Kundtaken gäller som förut. |
| (7) Stickprov flytt och avbokning | create 201, move 200, stale 409, upptagen tid 400, cancel 200, utan cookie 403 |
| (8) Samtidighet nära taket | Admin på 95, sedan 12 parallella: **exakt 5×201 och 7×429**, totalt 100 |
| Integritet | 0 överlapp, 0 deadlocks i probe-DB |

## 5. Nya fynd

| ID | Svårighetsgrad | Beskrivning |
|---|---|---|
| E05-QA-8 | Låg (UX) | Adminens dagstak (100) och 60/15 min-spärren ger samma generiska "För många försök. Försök igen senare." som kundtaket. Admin får ingen förklaring av att det är kontots dagstak, och Retry-After är timmar. Förslag: specifik svensk text för adminbudgeten. Inte blockerande. |

E05-QA-2..7 är backlog och oförändrade, enligt t34u. DEMO-noten om 09-bilderna lästes inte om, eftersom det ligger utanför omfattningen.

## 6. Codex påståenden

| Påstående | Status |
|---|---|
| Adminpolicy från serverns WorkspaceActor; aktiv admin verifieras i transaktionen före replay och skrivning | Bekräftat (kod + 403 vid replay efter spärr) |
| Admin-clientKey = HMAC(admin:<id>), emailCapKey NULL | Bekräftat (kod + DB) |
| 100 per konto och Stockholmsdag med samma client/day-lås | Bekräftat (101:a 429; samtidighet stannar på 100) |
| admin-bookings 60/15 min, separat bucket | Bekräftat |
| Adminrouten skickar inte IP | Bekräftat (diff) |
| Kund och MCP: 5/dag, 3 per e-post, 30/15 min; cookie eller actor ger inget undantag | Bekräftat (30/15 min-koden är oförändrad; inte separat probad nu) |
| 20 identiska retries ger samma 201/id utan kvotåtgång | Bekräftat |
| Idempotensnamnrymd, serviceVersion, version, låsordning och exclusion oförändrade | Bekräftat (diff + stickprov) |
| Ingen ny migration eller dependency | Bekräftat |
| Äldre lagrade adminrader ändras inte | Bekräftat via diff (ingen migration). Påverkan på gamla dagens kundkvot är inte probad. |
| 69 unit / 66 integration / 24×4 E2E | Bekräftat |
| Audit 7 moderate / 0 high; prod 0 | Bekräftat |

## 7. Återanvänt och NOT RUN

- **Återanvänt från 7fc0e86-fullgranskningen** (oförändrad kod enligt trädjämförelsen):
  - snapshots, schema och personal;
  - exclusion- och direkt-DB-tester;
  - MCP-verktygsmatris och strikt schema;
  - guidad klient, uppgradering 4→5;
  - UI och tangentbord, demo.
- **NOT RUN:**
  - ny demoloop (ej beställd);
  - fysisk iOS;
  - CI-status på GitHub;
  - separat 30/15 min-prob för kund (koden är oförändrad);
  - prob av äldre adminrader med IP-baserad clientKey.

## 8. Städning

Alla servrar och MCP-processer är stoppade, och Postgres 55571 är stoppad. Portarna 3000, 3330 och 55571 är verifierat stängda. Databaskatalogen ligger kvar i `run-4fc98d3/pgdata`.
