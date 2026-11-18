# QA-rapport Epic 05 – Booking Lab SE – kandidat 7fc0e86

**Granskare:** Grok Bot (oberoende read-only QA/säkerhet/arkitektur)  
**Datum:** 2026-11-12, 11:35–11:55 CET (Europe/Stockholm)  
**Kandidat:** `7fc0e866f0ef457bf9eaef4ca153e7a69b30b3d0` · **Bas:** `26b680d73f95255473d07b073ab8e06a43d294f0`  
**Plan:** docs/EPIC_05_PLAN.md (E05-1..E05-4, AC1..AC10). Epic 01–04-logik som inte ändrats har inte granskats om.

## Sammanfattning / verdikt

- **Begränsad lokal produktalfa: NO-GO, men bara på grund av en enda konkret och liten blockerare: E05-QA-1.** Manuell adminbokning omfattas av kundtakets 5 nya bokningar per klient-IP och dag. Den delar dessutom den budgeten med kundsidan från samma adress. Efter rättning och en kort omkörning bedömer jag GO.
- **Pilot: fortsatt NO-GO.** Kända pilotblockerare finns kvar, se avsnitt 6.
- Den tekniska kärnan håller i alla mina prober:
  - snapshots, version/stale, atomär flytt och avbokning;
  - exclusion constraint med `WHERE status='confirmed'`;
  - MCP-gränser och uppgradering 4→5.
- Resultat: 0 överlapp och 0 deadlocks i blandad webb/MCP-trafik. Hela matrisen var grön.

## 1. Revision och miljö

| Punkt | Värde |
|---|---|
| Källzip | SHA256 `154dda08…e74ed458`, zip-kommentar `7fc0e86…`. Inventering: 169/169 filer matchar sha256. Endast `.env.example`; ingen `.env`, `node_modules` eller `.next`. |
| Baszip | `be49e2ca…a9c0`, kommentar `26b680d…` |
| Patch | `epic05-vs-epic04.patch` `909af739…bcfcb`. 70 fil-diffar och 0 commit-huvuden. På LF-normaliserad bas ger den ett träd identiskt med kandidaten. |
| Demo-zip | `0ed04f1d…e587`. Manifest: revision 7fc0e86, dirty false, status PASS, build production. |
| CRLF | Zipparna är CRLF (git archive med autocrlf). Jag arbetade på LF-normaliserade kopior; originalen ligger kvar i `raw-crlf/` och `raw-base-crlf/`. |
| Plattform | Linux 6.12 (box), Node v24.22.1, npm 11.21.1, Playwright 1.65.0 (Chromium headless) |
| Databas | Egen embedded PostgreSQL 18.6 på 127.0.0.1:**55561**, timezone Europe/Stockholm |
| DB-namn | booking_e5_test (matris), booking_e5probe_test (prober), booking_e5up_test (uppgradering), booking_e5mcp_test (guidad klient) |
| Hemligheter | `DATABASE_URL` exporterad. Egen slumpad `SESSION_SECRET` (≥32 tecken), aldrig utskriven. Codex `.env` har inte lästs. |
| Data | Endast syntetisk @example.test-data. Ingen PC, inga betaltjänster, ingen commit/push. |
| Portar | E2E på 3000, sekventiellt. Mina prober på 3320. All lokal MCP via stdio (ingen port). |

## 2. Kommandon (mina körningar)

| Steg | Resultat | Detalj |
|---|---|---|
| npm ci | **PASS** | 571 paket, 10 s |
| prisma generate | **PASS** | Prisma 7.10.1 |
| db:migrate | **PASS** | 5 migrationer på ny DB |
| db:seed | **PASS** | Anna 09–17 och Erik 10–16, mån–fre |
| lint | **PASS** | |
| tsc | **PASS** | |
| npm test (unit) | **PASS** | 68/68 (11 filer) |
| test:integration | **PASS** | 64/64 (15 filer) |
| build | **PASS** | |
| test:e2e dev, TRUST_PROXY_IP=0 | **PASS** | 22/22 (48,8 s) |
| test:e2e dev, TRUST_PROXY_IP=1 | **PASS** | 22/22 (46,2 s) |
| test:e2e prod (E2E_PRODUCTION=1), TRUST_PROXY_IP=0 | **PASS** | 22/22 (29,5 s) |
| test:e2e prod, TRUST_PROXY_IP=1 | **PASS** | 22/22 (25,8 s) |
| npm audit --json | rc=1 (förväntat) | 7 moderate, 0 high/critical (typescript-eslint-kedjan och minimatch, devDeps) |
| npm audit --omit=dev --json | **PASS** | 0 |
| Städning efter tester | **PASS** | Matris-DB efter E2E: 0 bokningar, 0 AdminUser, 0 sessioner, 0 WorkspaceRequest, 0 BookingEvent |
| Deadlocks under matrisen | 0 | `pg_stat_database` och pg.log |

Anmärkning om proxyläget: `playwright.config.ts:36` hårdkodar `TRUSTED_PROXY_IPS: "127.0.0.10/32"` i webServer-env. Den värdet går före mitt beställda `127.0.0.1,::1`, så TRUST_PROXY_IP=1-lägena körde med testens egen lista.

## 3. Diff, migrationer, beroenden

- **Beroenden:** `package.json` och `package-lock.json` är byte-identiska med basen. → Inga nya npm-beroenden (**bekräftat**).
- **Migrationer:** De fyra äldre migrationerna är byte-identiska (cmp). Den femte migrationen (`20261112040000_booking_workspace`) är ny.
  - Den gör `LOCK TABLE Booking ACCESS EXCLUSIVE` och lägger till kolumner på Service och Booking.
  - Den skapar tabellerna Staff, BookingEvent och WorkspaceRequest och lägger in staff-demo "Anna".
  - Den backfillar snapshots och lägger till en BEFORE INSERT-trigger för äldre direktinserts.
  - **Den gör DROP + ADD av `booking_no_overlap` med `WHERE status='confirmed'` inom samma transaktion.** Den är alltså inte strikt "endast additiv", men den gör samma halvöppna intervallskydd för aktiva rader. Det har jag bevisat empiriskt (avsnitt 4.7).
- **"Produktkod slutar vid 4099d9d":** **Kan inte verifieras.** Underlaget har ingen git-historik; patchen är en platt diff utan commits. Per filtyp bedömer jag ändringarna så här:
  - Icke-produkt: docs/*, README/AGENTS, `.github/workflows/*`, `playwright.demo.config.ts`, `scripts/record-demo.mjs`, tests/*.
  - Produkt: prisma/*, src/*, seed.ts.
  - Vilken commit som rörde vad kan jag inte avgöra.
- **CI-ändringar (observation):**
  - `verify.yml` kör nu bara dev/proxy=0-E2E på PR och icke-main-push; full 4-lägesmatris körs bara på main och workflow_dispatch.
  - npm audit har flyttats från verify till ett veckoschema (`dependency-audit.yml`, permissions read, pinnade actions).

## 4. Funktionella och säkerhetsprober (mina egna, `run-7fc0e86/probes/`, loggar i `logs/`)

### 4.1 Snapshots och tjänster (AC2) – PASS

- **Gamla bokningar ändras inte:** Fotvård 650 kr/60 min ändrades till 750 kr/90 min + 15 min buffert. Den gamla bokningen ligger kvar som `Fotvård|65000|60|0` (60 min). En ny bokning får `Fotvård QA|75000|90|15` och blocket blir 105 min.
- **Versionskontroll:** Stale `serviceVersion` vid create ger 409. Stale `expectedVersion` på tjänst ger 409.
- **Inaktiverad tjänst:**
  - den försvinner ur publika `/api/services`;
  - availability och ny bokning ger "Tjänsten finns inte";
  - den befintliga bokningen förblir confirmed.

### 4.2 Två medarbetare, pauser, ledighet (AC3) – PASS

- **Isolering:** När Anna har en bokning 10:00 finns Erik fortfarande ledig 10:00. Anna blockeras 10:00 och 09:30, eftersom 60 min-tjänsten överlappar.
- **Paus:** Erik med paus 12–13 har massage 11:30 ledig. 12:00 och 12:30 är borta, och fotvård 11:30 blockeras.
- **Ledighet:** Ett datumundantag med tomma pass ger 0 tider.
- **Gränser:** Helg, tid efter stängning, ojämn minut, passerad tid och mer än 60 dagar fram avvisas alla.
- **Sommartid:** Icke-existerande lokal tid (2027-03-28 02:30) avvisas.

### 4.3 Schemaändring mot bokade tider – PASS

Med en bokning 15:00 hos Erik ger alla tre ändringarna nedan 409 "Ändringen berör bokade tider. Flytta eller avboka dem först." Bokningen är orörd efteråt.

- förkorta passet till 10–14;
- inaktivera Erik;
- ta bort massage från Erik.

### 4.4 Flytt (AC4) – PASS

- **Lyckad flytt:** Flytt till ledig tid och annan medarbetare ger 200 och version 2. BookingEvent `create:admin, move:admin`.
- **Replay och nyckelåteranvändning:**
  - identisk replay med samma nyckel ger samma resultat (deep-equal);
  - samma nyckel med annan payload ger 409.
- **Stale version:** ger 409 "Uppgifterna har ändrats".
- **Ogiltiga mål:** upptagen/överlappande tid ger 400. Okänd personal ger 400, okänd bokning 400. Originalbokningen bevaras.
- **Samtidighet:**
  - 10 samtidiga flyttar med samma version gav 1×200 och 9×409; exakt 1 move-event.
  - Flytt och avbokning samtidigt: avbokningen vann, flytten fick 409 och raden är konsistent.
  - Två olika bokningar flyttades samtidigt till samma tid: 200 + 400, och 1 aktiv rad.

### 4.5 Avbokning (AC5) – PASS

- **Första avbokningen:** 200, status cancelled och version 2.
- **Upprepade försök:**
  - replay med samma nyckel ger samma svar;
  - ny nyckel med gammal version ger 409;
  - ny nyckel med aktuell version ger 200 med oförändrad summary (dokumenterat stabilt).
- **Flytt av avbokad bokning:** 409.
- **Tiden frigörs:** tiden blir ledig och kunden kan boka om publikt (201).
- **Historik:** `create, cancel` finns kvar.

### 4.6 Behörighet och maskning – PASS

- **Utan inloggning:** GET kalender, detalj, staff och services samt POST bokning/tjänst/availability utan cookie ger alla 403.
- **Origin:** Utan Origin eller med främmande Origin ger 403.
- **Validering:** Saknad Idempotency-Key ger 400. Extra fält (`businessId`) ger 400 "Kontrollera uppgifterna".
- **Annan verksamhet:** En bokning med `businessId='other'` ger "Bokningen finns inte" både vid GET och cancel. Den syns inte i kalendern och förblir confirmed.
- **Gränser:** Kalender >31 dagar ger 400; limit=500 ger 400.
- **Inaktiverat adminkonto:** Ett konto som inaktiverats via CLI ger 403 på både GET och POST med befintlig cookie.
- **Maskning:**
  - detaljvyn visar e-post som `***@***`;
  - kalender-JSON innehåller inte e-post, och adminsidans HTML innehåller inte kundens e-post.
- **Publika kontrakt:**
  - `/api/availability` utan staffId använder fortfarande staff-demo;
  - `/api/services` har nu även fälten `buffer/active/version`, vilket är additivt;
  - `/api/staff` är ny och publik (id, name, serviceIds).

### 4.7 Direkt-DB mot exclusion constraint (AC7) – PASS

Constraint: `EXCLUDE USING gist (businessId =, staffId =, tstzrange(startsAt,endsAt,'[)') &&) WHERE status='confirmed'`.

| Försök | Utfall |
|---|---|
| Överlappande confirmed-insert | 23P01 |
| Avbokad överlappande rad | Tillåts |
| UPDATE av den raden till confirmed | 23P01 |
| UPDATE av tid + status till överlapp | 23P01 |
| Annan personal, samma tid | Tillåts |
| Angränsande intervall `[)` | Tillåts |
| status='pending' | CHECK-fel |
| endsAt<startsAt | CHECK-fel |

Triggern fyller snapshot för en direktinsert. Allt kördes i en transaktion med ROLLBACK.

### 4.8 Blandad HTTP + MCP-samtidighet (AC7) – PASS

Sex rundor gjordes, varje på en egen dag. Varje runda körde samtidigt:

- 6 publika create mot 3 heta tider;
- admin-move och admin-create;
- 2 MCP-move (stdio);
- en konkurrerande tjänsteprisändring (exclusive konfigurationslås).

Utfall:

- Exakt en aktiv bokning per tid i alla rundor.
- **Överlapp totalt 0. Deadlocks 0** (`pg_stat_database` 0→0, 0 "deadlock detected" i pg.log).
- Inga serverfel.
- Prissnapshots följer den pris som gällde vid varje create.

Ett första försök (runda 0–1) innehöll även MCP-create. Det stoppades av MCP-kanalens **dokumenterade** dagstak (5/kanal/dag). Det tolkar jag som avsett beteende, inte ett fel.

### 4.9 MCP över lokal stdio – PASS

- **Verktygslistor per flagga:**

  | Flaggor | Verktyg |
  |---|---|
  | inga | list_services, get_availability |
  | `--admin` | + 7 läsverktyg och list_bookings/create_campaign_draft, inga skrivverktyg |
  | `--admin --allow-bookings` | + create_booking |
  | `--admin --allow-workspace` | + create_booking, move_booking, cancel_booking, save_service, save_staff |

- **Felaktig konfiguration:** `--allow-workspace` utan `--admin`, utan secret eller med en 31-teckens secret ger exit 1 med `MCP_WORKSPACE_CONFIG_INVALID`.
- **Tidsfönster:** `get_staff_schedule` med 31 dagar ger OK och filtrerar undantag till fönstret. 32 dagar ger "Kontrollera uppgifterna", och omvänt intervall avvisas. `get_staff_configuration` ger hela snapshoten, inklusive undantag 40 och 55 dagar fram.
- **Listgränser och strikt schema:** `list_workspace_bookings` 31 dagar/limit 100 ger OK. 32 dagar, limit 101 och extra nyckel avvisas med statisk text. Svaren saknar kundnamn och e-post (nycklar: id, serviceId, staffId, startsAt, endsAt, status, version). get_booking saknar också kundfält.
- **Skrivfel ändrar ingenting:** Utan write-opt-in finns inte move_booking. Följande ger statiska fel och lämnar DB-räknarna (Booking, BookingEvent, WorkspaceRequest, staff- och serviceversioner) oförändrade:
  - saknad eller falsk `confirmed`;
  - extra `actor`;
  - stale version;
  - okänt id och SQL-liknande id;
  - extra `businessId` till save_service;
  - ogiltig veckodag.
- **Skrivflöde via MCP:**
  - create → move ger version 2; replay är deep-equal, och samma nyckel med annan payload ger 409;
  - stale cancel ger 409, och cancel ger OK;
  - events loggas som `create/move/cancel:local-mcp`;
  - save_staff replay är deep-equal, och utelämnade `exceptions` bevaras.
- Ingen stderr-läcka.

### 4.10 Guidad klient `npm run mcp:client -- --admin --workspace` – PASS

| Inmatning | Utfall |
|---|---|
| 7× `ja` | 7 skrivningar: tjänst, personal, bokning, flytt, avbokning, inaktivera personal, inaktivera tjänst |
| `ja, ja, nej` | 2 skrivningar, sedan "Avbruten…"; ingen bokning |
| `ja` + EOF | 1 skrivning, sedan stopp |
| `jaa` | 0 skrivningar |
| ` JA `/`Ja` | Godtas (trim + gemener) |
| `--workspace` utan `--admin` | rc=1 |

Tidigare bekräftade skrivningar ligger kvar, precis som klienten säger.

### 4.11 Uppgradering 4→5 med syntetisk Epic 04-data (AC9) – PASS

- **Uppsättning:** Basträdet migrerades till 4 migrationer. Jag lade in tjänster, en kampanj, AdminUser och en session, samt 7 bokningar:
  - DST höst 2026-10-25 00:30Z–01:30Z;
  - DST vår 2027-03-28 00:30Z–01:30Z;
  - DST höst 2027-10-31;
  - en udda varaktighet på 44,5 min;
  - okänd `legacy-staff`;
  - en annan businessId.
- **Gamla fält oförändrade:** md5 över alla gamla kolumner i Booking, Service, Campaign, AdminUser och AdminSession är **identisk före och efter**.
- **Backfill:** Snapshots kommer från tjänsten med varaktighet = verklig längd. Udda 44,5 min blir 45 och DST-höstens 60 min blir 60. Alla rader blev confirmed, version 1 och initial* = nuvarande tid.
- **Ny Staff-rad:** staff-demo med alla tjänster.
- **Migrationsstatus:** `migrate status` är ren och alla 5 migrationer är klara.
- **Appen efter uppgradering:**
  - kalender, detalj (maskerad) och DST-bokning visas;
  - `legacy-staff`-bokningen visas som "Tidigare medarbetare" och kan flyttas till staff-demo;
  - exclusion och trigger fungerar.

### 4.12 Verklig UI, tangentbord, mobil och dator (AC1/AC8) – PASS med mindre backlog

- **Mina screenshots:** Playwright Chromium, desktop 1440×900 och Pixel 7, 22 bilder i `run-7fc0e86/shots/`. Jag har tittat på:
  - desktop-calendar-week, mobile-calendar-day, desktop-staff;
  - mobile-kb-new-filled, mobile-kb-moved, desktop-kb-confirm-cancel;
  - desktop-booking-detail-cancelled. Den bilden visar bara laddningstillståndet, eftersom min skript tog bilden innan laddningen var klar (harnessfel, inte produktfel).
- **Ingen horisontell scroll** på någon sida i någon viewport (scrollWidth−clientWidth = 0).
- **Tangentbordsflöde, båda viewports:** Tab, Enter och piltangenter räckte för hela kedjan. Startpunkten var kalender-URL:en, och fokus/val gjordes enbart med tangenter.
  - Kalender → "Ny bokning" (8 Tab).
  - Behandling, Medarbetare och "Visa lediga tider" → tid → namn → e-post → "Skapa bokning". Bokningen skapades i DB.
  - "Flytta" → "Visa lediga tider" → tid → "Spara flytt". DB version 2, status "Bokningen har flyttats."
  - "Avboka". Bekräftelsen autofokuserar "Ja, avboka" med synlig fokusring; Enter ger DB cancelled v3 och "Bokningen är avbokad."
- Fokusring syns på alla interaktiva element i Tab-ordningen. Inga konsolfel och inga pageerror.

## 5. Fynd

### Blockerare

**E05-QA-1 – Manuell adminbokning begränsas av kundens IP- och e-posttak (Medel, blockerande för produktalfa)**

- **Var:**
  - `src/app/api/admin/bookings/route.ts:44` skickar `clientIp(request.headers)` till `createBooking(...)`;
  - `src/lib/domain.ts:255` (checkRateLimit 30/15 min), `:263–275` (5 per clientKey och skapandedag) och `:284` (3 per e-post och dag) gäller därmed även admin.
- **Repro (verifierat):** Inloggad admin gör 7 `action:create` från samma adress, med olika kunder, tider och personal. Utfall: 201 ×5, sedan **429 "För många försök. Försök igen senare."** ×2, med Retry-After till midnatt. Se `logs/p-work.json` → `adminCreateCapSameIp`.
- **Följd:**
  - En salong kan lägga in högst 5 telefonbokningar per dag och dator.
  - På en lokal alfa delar admin och kundsida samma 127.0.0.1-budget.
  - En kund kan inte få fler än 3 manuella bokningar per dag på samma e-post, till exempel familj eller paket.
  - Avbokade bokningar fortsätter att räknas.
  - Felet syns som "För många försök" utan förklaring.
  - Detta är inte dokumenterat för admin. ARCHITECTURE och README beskriver taken som kund- och MCP-skydd. Det bryter mot E05-2 och AC1/AC4 i praktisk användning.
- **Riktning:**
  - För en verifierad, aktiv adminaktör: hoppa över anonym-IP- och e-posttaken, eller använd en separat, betydligt högre och dokumenterad gräns per adminkonto.
  - Behåll auth före replay, Idempotency-Key, låsordning och exclusion.
  - Lägg till ett integrationstest: minst 6 admin-create samma dag från samma IP ger 201, och kundtaket för samma IP påverkas inte.

### Mindre backlog (inte blockerande)

| ID | Svårighetsgrad | Beskrivning |
|---|---|---|
| E05-QA-2 | Låg (a11y) | Fokus tappas till `<body>` efter "Flytta" och efter sparad flytt, eftersom knappen tas bort ur DOM (`bookings/editor.tsx:221` och flödet runt `save`). Status-meddelandet har role=status, men fokus bör flyttas till formulärets rubrik eller notisen. |
| E05-QA-3 | Låg (UX) | Avbokningsbekräftelsen autofokuserar den destruktiva knappen "Ja, avboka" (`editor.tsx:246`), och Escape stänger inte panelen. Ett dubbeltryck på Enter kan avboka. Överväg fokus på "Behåll bokningen" eller rubriken. |
| E05-QA-4 | Låg (UX) | Två "Till kalendern"-länkar på `/admin/bookings/new` (`new/page.tsx:30` och `editor.tsx:174`). |
| E05-QA-5 | Låg (DB-hygien) | `Booking.buffer` har bara `CHECK >= 0` (migration rad 28), medan Service har 0–120. En direkt UPDATE buffer=500 accepterades. Bara via direkt DB; API:t begränsar. |
| E05-QA-6 | Låg (process) | `playwright.config.ts:36` hårdkodar `TRUSTED_PROXY_IPS`, så E2E-proxyläget kan inte styras utifrån. CI kör full 4-lägesmatris bara på main, och audit körs nu veckovis i stället för per push. Dokumentera det, eller kör audit även på PR. |
| E05-QA-7 | Låg (demo) | Demo 09-bokningsdetalj (desktop och mobil) visar bara "Hämtar arbetsytan…". Bilden togs innan laddningen var klar, så beviset för bokningsdetaljen saknas i just den bilden. Bild 08 saknas i numreringen. |
| Not | Info | Publika `/api/services` och MCP `list_services` exponerar nu `buffer/active/version` (additivt). `/api/staff` är ny publik endpoint. MCP-replay ger deep-equal JSON men med jsonb-omordnade nycklar (inte byte-identisk text). |

## 6. Kända pilotblockerare (oförändrade, inte nya fynd)

Pilot förblir **NO-GO** av följande skäl:

- E04-QA-2 (ingen kontobunden inloggningskvot), E04-QA-3 (korrupt hash ger 500), E04-QA-4 (nativt paket saknar LICENSE) och fast port 3000 / E04-QA-5.
- Inga riktiga notiser/e-post och ingen kundsjälvservice.
- Ingen fysisk iPhone/Safari-test (all mobil här är Chromium-emulering).
- Ingen fjärr-MCP.
- Inget helgdags-/öppettidsregister utöver manuella undantag.
- Privat mobilpreview (E05-5) är inte granskad här.

## 7. E05- och AC-bedömning

| Krav | Bedömning | Grund |
|---|---|---|
| E05-1 Tjänster och personaltider | **PASS** | 4.1–4.3, 4.11 |
| E05-2 Skapa, flytta, avboka utan korruption | **PASS med blockerare E05-QA-1** | 4.4–4.8. Datakorrektheten håller, men manuell admin-create stryps efter 5 per dag. |
| E05-3 Kalender och mobilflöden | **PASS** (mindre backlog QA-2..4) | 4.12, egna screenshots |
| E05-4 Lokala agenter | **PASS** | 4.9–4.10 |
| AC1 Bokning syns i adminkalender med rätt behandling, personal och tid | **VERIFIED** | Mobilbokning via UI syns med Stockholmstid. Kund-till-admin via API/DB och kalender-JSON. |
| AC2 Snapshots och inaktiv tjänst | **VERIFIED** | 4.1 |
| AC3 Två medarbetare och ledighet | **VERIFIED** | 4.2 |
| AC4 Flytt, stale, samtidighet | **VERIFIED** | 4.4 |
| AC5 Avbokning frigör tid, historik, stabil retry | **VERIFIED** | 4.5 |
| AC6 MCP ändrar samma kalender; nekad/ogiltig ändrar inget | **VERIFIED** | 4.9 |
| AC7 Blandad trafik och direkt-DB | **VERIFIED** | 4.7–4.8 (0 överlapp, 0 deadlocks) |
| AC8 Tangentbord, mobil och dator | **VERIFIED** (Chromium) | 4.12. Fysisk iOS: NOT RUN. |
| AC9 Ren installation och uppgradering 4→5 | **VERIFIED** | Matris och 4.11 |
| AC10 Fryst revision granskad; CI på levererad SHA | **Delvis** | Revision verifierad. CI-status för SHA: NOT VERIFIED (ingen CI-åtkomst begärd). Blockeraren är explicit kvar. |

## 8. Codex påståenden kontra mina körningar

| Codex påstår | Status | Min observation |
|---|---|---|
| Produktkod slutar vid 4099d9d; senare commits är demo/test/docs | **Ej verifierbart** | Ingen git-historik i underlaget. Bara filtypsindelning möjlig (avsnitt 3). |
| Inga nya npm-beroenden | **Bekräftat** | package.json och lock är byte-identiska |
| 5:e migrationen additiv; 4 gamla byte-identiska | **Bekräftat med nyans** | De gamla är identiska. Den nya byter constraint (DROP+ADD med statusvillkor) men bevarar skyddet. |
| npm ci 570/571 | **Bekräftat** | 571 paket (572 auditerade inklusive root) |
| generate 7.10.1 | **Bekräftat** | |
| 5 migrationer och seed | **Bekräftat** | |
| lint, tsc, build | **Bekräftat** | |
| 68 unit / 64 integration | **Bekräftat** | 68/68, 64/64 |
| 22 E2E ×4 | **Bekräftat** | 22/22 i alla fyra lägen (proxylistan hårdkodad, se avsnitt 2) |
| cleanup 0 | **Bekräftat** | |
| Uppgradering 4→5 med DST-data | **Bekräftat av egen test** | 4.11 |
| Tangentbordstest 2/2 prod | **Bekräftat indirekt** | Ingår i 22/22 prod. Egen tangentbordsprob godkänd. |
| Demo 6/6 | **Bekräftat (artefakter)** | 6 WebM avkodade, manifest PASS. Två PNG visar bara laddning (QA-7). |
| 7 moderate / 0 high; prod 0 | **Bekräftat** | |

## 9. Demo

- **Manifest:** revision 7fc0e86, dirty false, status PASS, build production. Innehåll: 28 PNG, 6 WebM, index.html och .last-run.json.
- **PNG – alla 28 öppnade och granskade individuellt:**
  - flow-bokning desktop 01–06;
  - flow-bokning mobile 01–06;
  - flow-lokal-MCP desktop 07 och mobile 07;
  - workspace desktop 09, 10, 11, 12, 13, epic05-calendar, epic05-cancelled-booking;
  - workspace mobile, samma 7 bilder.
- **Vad bilderna visar:**
  - Bokningsflödet med Stockholmstid och adminkampanjen (utkast → publicerad → publik).
  - MCP-bokningen i adminvyn med maskerad e-post.
  - Tjänsteändring (725,50 kr, 45 min + 15 min buffert) och veckoschema med paus 12–13.
  - Ledigt datum 2026-11-17 och flyttad bokning (16/11 09:00 → 18/11 10:00, Demo Erik).
  - Avbokad bokning med historik (Skapad, Flyttad, Avbokad 2026-11-12 11:29).
  - Mobil kalenderlista utan sidscroll.
- **Avvikelser:** Båda 09-bokningsdetalj visar bara "Hämtar arbetsytan…" (QA-7).
- **WebM, avkodade med ffprobe:** vp9, 25 fps.

  | Video | Upplösning | Längd | Frames |
  |---|---|---|---|
  | flow-bokning desktop | 800×450 | 11,16 s | 279 |
  | flow-bokning mobile | 392×800 | 10,64 s | 266 |
  | lokal-MCP desktop | 800×450 | 5,56 s | 139 |
  | lokal-MCP mobile | 392×800 | 3,32 s | 83 |
  | workspace desktop | 800×450 | 9,48 s | 237 |
  | workspace mobile | 392×800 | 9,56 s | 239 |

- **Videorna är inte "tittade" i realtid.** Jag samplade 3 bildrutor per video (20/50/90 %) och tittade på dem.
  - De visar bokningssida, adminlogin, kalender, bokningsdetaljer, personal och avbokad historik.
  - I flow-bokning desktop (50 %) syns adminkalendern med den röda bannern "Ogiltigt datumfilter. Visar standardintervallet…". Det är troligen ett avsiktligt negativt steg i det äldre flödet, men det redovisas som observation.

## 10. NOT RUN och begränsningar

- Fysisk iPhone/Safari: NOT RUN (Chromium-emulering av Pixel 7).
- CI-status för SHA på GitHub: NOT RUN (ingen extern åtkomst begärd).
- Commit-attribuering efter 4099d9d: NOT RUN (ingen git-historik).
- Offline/nätverksfel i UI: inte egen prob; täcks av Codex E2E "bevarar utkast och request-id vid nätverksfel", som passerade i min matris.
- Tidiga probfel som rättades (harness, inte produkt):
  - Default-param gjorde att mitt "utan cookie"-anrop faktiskt skickade cookie; omtestat → 403.
  - En nyckel "short" var giltig och avbokade en bokning; testet omtolkat.
  - Dublettdatum i undantag gav ett korrekt valideringsfel.

## 11. Städning

Alla Next-servrar och MCP-processer är stoppade, och Postgres på 55561 är stoppad efter rapporten (portarna 3000, 3320 och 55561 är verifierat stängda). Testdatabaserna ligger kvar i `run-7fc0e86/pgdata` (stoppad).
