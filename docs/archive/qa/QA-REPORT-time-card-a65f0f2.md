# QA-rapport – Booking Lab MCP Apps-tidvalskort (a65f0f2)

**Datum:** 2026-11-13 (Europe/Stockholm) · **Typ:** avgränsad oberoende QA i en enda körning · **Testare:** Grok Bot (QA)
**Scope:** `QA-BRIEF-time-card-a65f0f2.md` (sha256 `934e36c20fdf7b240bd0856900a3070e1fcd4373d4e378b7a8690f571236da58`), läst i sin helhet. Gäller bara tidvalskortet; ingen ny epic.

## 1. Scope och hashar
| Fält | Värde |
|---|---|
| Revision | `a65f0f2ee5750044dd46c5db50453db5602b79f2`, `feature/mcp-time-card`, bas 1a49a0e, produkt 95f8071 |
| Arkiv | `timecard-a65f0f2/booking-time-card-a65f0f2.zip` – sha256 `61ffb0d8915425029324f3f21a2f46269c9a4f87c393f6b1562b3ecac372197d`, 3 268 844 byte, 493 poster, kommentar `a65f0f2…` (verifierat) |
| Env-filer i arkivet | Endast `.env.example`. `docs/calendar-proof/private.json` är en syntetisk fixture och lästes inte. Inga `neon-*.private.json` eller `resources.private.json` finns |
| Codex-evidens | `evidence.zip` – sha256 `4f72b6a86d5d94f39202a74df7ef6a778e6fbc653bfcb5a23f3a170ce15fa404`, 12 filer. **Granskat som underlag, inte egen körning** |
| Jämförelsebas | Min extraktion av 95f8071: `lifecycle-fix1-95f8071/run/src` |

### Hur körningen gjordes
- **Arkivet orört:** `run/src` är orörd extraktion. Efter körningen jämfördes den med en ny extraktion av zip-filen, utan skillnader. Allt kördes i `run/work`, en LF-normaliserad kopia.
- **Ingen produktkod ändrades,** och testkraven sänktes inte.
- **Postgres:** egen embedded Postgres 18 (`pg-tool`).
  - Host på port 55800: `tc_test`, `tc_int_test` och `tc_demo`.
  - Isolerat namespace på port 55801: färska `tc_e2e_{prod0,prod1,dev0,dev1}_test` och `tc_card_test`.
  - UI-namespace på port 55802: `tc_ui_demo`.
- **Playwright:** körde enbart i isolerat nätverksnamespace (`unshare -rn`, uid 1000). Port 3000 fanns bara där.
- **Data och miljö:** endast `@example.test`. Alla kommandon kördes med `env -u NODE_ENV` och TZ=Europe/Stockholm. SESSION_SECRET slumpades och låg bara i en temporär `.env`, som är raderad. Inga hemligheter lästes.
- **Ingen extern åtkomst:** ingen PC, originalrepo, preview, GitHub, cloud, token, push eller deploy.

## 2. Diff mot 95f8071 (`run/logs/changed-files.txt`, 22 poster)
**Byte-identiskt:**
- `package.json`, `package-lock.json` och `prisma/schema.prisma`.
- Alla 9 historiska migrationer samt `migration_lock.toml`.

**Nytt:**
- `src/mcp/time-card/{guard.ts,data.ts,server.ts,ui.html}` (22, 85, 119 och 675 rader).
- `plugins/booking-lab-time-card/{plugin.json,mcp.json,launcher.mjs}`.
- `playwright.time-card.config.ts`.
- Testerna `tests/time-card.test.ts`, `tests/integration/time-card.test.ts` och `tests/time-card-ui/card.spec.ts`.
- `docs/MCP_TIME_CARD_PLAN.md`.

**Ändrat:**
- `src/lib/errors.ts`: exakt +3 statiska publika meddelanden.
- Dokumentation: README, AGENTS, ARCHITECTURE, DEMO, DEPENDENCY_REVIEW, HANDOFF, PRODUCT_*, PROJECT_STATUS och VERIFICATION.

**Bara dokumentation/underlag:** `docs/agent-proof`, `docs/assets/lifecycle`, `docs/verification/lifecycle` och `docs/qa/QA-REPORT-lifecycle-fix1-95f8071.md`.

**Oförändrat:**
- Bokningsmotorn (`src/lib/domain.ts`, `customer-data.ts`, `capacity.ts`, `workspace-write.ts`).
- Befintliga MCP-servrar (`src/mcp/{server,workspace,booking,reply,environment,client,workspace-client}.ts`).
- Server-wrapper och `scripts/`. ✔

Planen (`MCP_TIME_CARD_PLAN.md`) är läst. Scopet stämmer med briefen.

**Nya beroenden:** inga. Licenskontroll: de använda paketen är befintliga, `@modelcontextprotocol/{client,server,core}` 2.4.0 under Apache-2.0. Pluginet är AGPL-3.0-only, samma som projektet.

## 3. Kodgranskning (huvudpunkter)
- **Server (`server.ts`):**
  - Två verktyg och en resurs `ui://booking-lab/time-card-v1.html` med `text/html;profile=mcp-app`. `_meta.ui.csp` har alla domänlistor tomma.
  - `show_time_picker` har annotations `readOnly`, `!destructive`, `idempotent` och `!openWorld`, samt `_meta.ui.resourceUri` och `openai/outputTemplate`.
  - Fel går via `safeFailure` och ger bara statiska meddelanden.
- **Data (`data.ts`):**
  - Strikt zod-schema.
  - 28-dagarsfönster i Stockholmstid.
  - Tjänster via `listServices()` (bara aktiva). Personal filtreras på `businessId`, `active` och `serviceIds`.
  - Tider via samma `getAvailability` som webben.
  - Utdata innehåller bara tjänst (id/namn/längd/pris), personal (id/namn), datum och tider. Inga kundfält.
- **Guard (`guard.ts`):**
  - Kräver `BOOKING_TIME_CARD_DEMO=1`.
  - Nekar `NODE_ENV=production`, `VERCEL_ENV` samt `--admin`, `--allow-bookings` och `--allow-workspace`.
  - `assertTestDatabase` kräver loopback, `*_test`/`*_demo` och postgres-protokoll, och nekar `host`/`hostaddr` i query.
- **Launcher:**
  - Läser bara användarprofilen `~/.booking-lab/time-card.json` och dess env-fil.
  - Vidarebefordrar endast `DATABASE_URL`, `BOOKING_TIME_CARD_DEMO` och systemvariabler. Föräldraprocessens `NODE_ENV`/`VERCEL_ENV` tas alltså inte med.
- **UI (`ui.html`):**
  - Meta-CSP `default-src 'none'; connect-src 'none'`.
  - Bara `textContent` och `setAttribute`; inget `innerHTML` eller `eval`.
  - Accepterar meddelanden bara när `event.source === window.parent`, och validerar `structuredContent` (`valid()`).
  - Att välja en tid gör inget anrop. "Kontrollera" anropar `show_time_picker` igen.

## 4. Egna kommandon (VERIFIERAT)
Logg: `run/logs/summary.log` och `commands.log`.

| # | Kommando | Resultat |
|---|---|---|
| 1 | `npm ci` | PASS – 572 paket installerade, 573 granskade |
| 2 | `npx prisma generate` | PASS |
| 3 | `npm run db:migrate` (9) + `db:seed` på färsk `tc_test` | PASS |
| 4 | `npm run lint` | PASS |
| 5 | `npx tsc --noEmit` | PASS |
| 6 | `RATE_LIMIT_STORE=memory npm test` | PASS – 17 filer, **83/83** |
| 7 | `npm run build` | PASS |
| 8 | `RATE_LIMIT_STORE=postgres npm run test:integration` (färsk `tc_int_test`) | PASS – 24 filer, **105/105**. Restdata 0 affärs- och adminrader, 8 hashade RateLimitBucket (känd Info) |
| 9 | E2E prod0 (`E2E_PRODUCTION=1 TRUST_PROXY_IP=0`, postgres-store, färsk DB) | PASS – **46/46**, restdata 0 |
| 10 | E2E prod1 (`TRUST_PROXY_IP=1`) | PASS – **46/46**, restdata 0 |
| 11 | Kort-UI: `playwright test --config playwright.time-card.config.ts` (färsk `tc_card_test`) | PASS – **3/3** (320/390/1024) |
| 12 | E2E dev0 (sekventiellt, efter kort-UI) | PASS – **46/46**, restdata 0 |
| 13 | E2E dev1 | PASS – **46/46**, restdata 0 |
| 14 | `npm audit` full / `--omit=dev` | 7 moderate (dev) / 0 (oförändrat) |
| 15 | `probes/mcp-tc.mjs` (riktig MCP SDK-klient via stdio, superuser-DB) | **63/0** – se 4.1 |
| 16 | Samma prob med **egen read-only-roll** `tc_ro` | **63/0** – se 4.2 |
| 17 | `probes/guard-tc.mjs` (22 start-/miljöfall) | **20/2**. De 2 FAIL är TC-QA-3. Försök 1 hade 3 felaktiga förväntningar i proben (rättade, se §9) |
| 18 | `probes/launcher-tc.mjs` (verklig plugin-launcher, temporär HOME och profil) | PASS: 2 verktyg och 16 tider med read-only-profil. Profil med `NODE_ENV=production` nekas; saknad profil ger `TIME_CARD_LOCAL_PROFILE_REQUIRED` med exit 1 |
| 19 | `probes/dst-tc.mjs` + `dst-days.mjs` (in-process, flyttad klocka) | **17/0** – sommartid mars/oktober 2027 och fönstrets slut över DST-skifte |
| 20 | `probes/ui-tc.mjs` (egen MCP Apps-testvärd, Chromium headless, i netns med egen PG) | **38/2** – de 2 FAIL är TC-QA-1. Föregående körning gav 37/3 (fokus efter tjänstebyte varierar). Probefixar: se §9 |

### 4.1 MCP-protokoll (egen SDK-klient över stdio; detta är INTE ChatGPT)
- **Initialize:** `booking-lab-time-card-demo` 0.1.0. Capabilities: `tools` och `resources` (`listChanged`); inga prompts. `resources/templates/list` är tom.
- **`tools/list`:** exakt `list_services` och `show_time_picker`.
  - Annotations stämmer.
  - `inputSchema` för `show_time_picker` har bara `serviceId`, `staffId` och `date`, med `additionalProperties:false` och inget obligatoriskt fält. `list_services` tar ett tomt strikt objekt.
  - `_meta.ui.resourceUri` och `openai/outputTemplate` pekar på kortet. `list_services` saknar UI-mall.
- **`resources/list` och `resources/read`:** en resurs, rätt URI, `text/html;profile=mcp-app` och `_meta.ui.csp` med tomma domänlistor.
  - HTML:en innehåller inga externa URL:er, `<link>`, `<img>`, `src=`, `@import` eller `url()`.
  - Okänd `ui://`-URI nekas.
- **Okända verktyg:** `create_booking`, `list_bookings`, `list_customers`, `get_customer` och `remove_customer_contact` nekas alla.
- **Utdata:**
  - `list_services` returnerar exakt de aktiva demotjänsterna, med fälten id, namn, längd och pris.
  - Standardanropet returnerar `demo:true`, `bookingCreated:false`, Stockholm, SEK, idag och firstDate/lastDate = idag/idag+27. Texten innehåller "Ingen tid reserveras". Nycklarna i structuredContent är exakt de dokumenterade.
- **Verklig tillgänglighet:** Massage/Anna 2026-11-16 gav 16 tider, identiska med direkt `getAvailability`, och slut = start + 30 min. Byte av personal (Anna/Erik) ger rätt `selectedStaff`.
- **Ogiltig indata (18 fall)** nekas med statiskt meddelande ("Kontrollera uppgifterna" eller något av de tre nya) och utan `structuredContent`:
  - datum: 2026-13-01, 2026-11-31, "x", datum med tid, igår, idag+28 och år 9999;
  - id: okänd tjänst eller personal, `<script>`, `<img onerror>`, SQL-liknande sträng, 129 tecken och tom sträng;
  - typer: tal, `null` och array;
  - extra fält.
  - Ingen indata ekas tillbaka.
- **Fixturer med främmande verksamhet och inaktiva poster** (QA-rader som togs bort efteråt): inaktiv tjänst, tjänst i annan verksamhet, personal i annan verksamhet, inaktiv personal och personal som inte utför tjänsten nekas alla, och visas aldrig i personallistan. idag+27 accepteras och ger då 1 dag.
- **Månadsskifte:** 30 nov ger dagarna 30 nov–6 dec. 1 dec ger 16 tider, alla på 1 dec i Stockholmstid. idag+24 ger 4 dagar som slutar på lastDate.
- **Inga kunddata:** jag sökte efter alla namn, e-postadresser och telefonnummer på Customer och Booking (34+ värden) samt "@" i alla ca 45 utdata. 0 träffar.
- **Inga skrivningar:** antal rader och md5 för alla 13 tabeller var identiska före och efter. Det finns inga hold-, reservations-, lock- eller cart-tabeller. Serverns stderr var tom.

### 4.2 Read-only-roll (egen, enligt Codex beskrivning)
- **Rollen:** `tc_ro` (NOINHERIT) med SELECT på `Service`, `Staff` och `Booking(id, businessId, staffId, status, startsAt, endsAt)` samt `default_transaction_read_only=on`.
- **Kortet fungerar** fullt ut med rollen: proben gav 63/0 och launchern 16 tider.
- **Nekade operationer:**
  - `select from "Customer"` och `select "customerEmail" from "Booking"` ger **42501**.
  - `UPDATE` och `CREATE TABLE` ger "read-only transaction" (**25006**).

### 4.3 Guard (egen, 22 fall)
- **Nekas med exit 1 och `TIME_CARD_DEMO_REFUSED`:**
  - saknad eller fel `BOOKING_TIME_CARD_DEMO` (inklusive `true`);
  - `NODE_ENV=production`, `VERCEL_ENV=preview`;
  - `--admin`, `--allow-bookings`, `--allow-workspace`;
  - värdarna 10.0.0.5, db.example.com, localhost.example.com och en neon-lik värd;
  - DB-namn `tc_prod` och `demo_x`;
  - `?host=` och `?HostAddr=`.
- **Nekas av `scripts/database.mjs`** med `DATABASE_CONFIG_INVALID` och stacktrace, utan URL eller lösenord i utdata (TC-QA-4): saknad `DATABASE_URL` och `mysql://`.
- **Startar:** `[::1]` (loopback) och den ofarliga okända flaggan `--allow-workspace=1`.
- **Startar (FAIL):** `VERCEL=1` eller `VERCEL_URL` utan `VERCEL_ENV` → TC-QA-3.

### 4.4 Sommartid (DST)
Med klockan flyttad till 2027-03-25 och 2027-10-28 och läs-rollen:
- Dagslistan är sammanhängande över skiftet.
- Varje dag har 16 tider 09:00–16:30 lokal tid, med offset +01→+02 respektive +02→+01. Längden är alltid 30 min i UTC.
- När fönstrets slut korsar DST trunkeras `days` korrekt (5 dagar).
- Kortet räknar datum från `T12:00Z` och är därmed DST-stabilt (kodgranskning).

### 4.5 UI (egen testvärd i sandboxad iframe utan `allow-same-origin`, verklig stdio-server och resurs, Chromium i netns; INTE ChatGPT)
**Bredder 320/390/1024:**
- Ingen horisontell overflow och inga kontroller utanför viewport.
- Alla synliga kontroller är minst 44 px höga.
- Svenska dagar och "kr", "Demo – endast påhittade uppgifter" och "Ingen tid reserveras" visas.

**Tangentbord:**
- Tab-ordningen följer den visuella ordningen: Behandling → Utförare → Idag → ← → → 7 dagar → tider.
- Fokusringen är `3px solid`.
- Enter på en dag laddar den dagen (`aria-pressed` false → true).
- Space på en tid ger `aria-pressed=true`, fokus stannar på tiden och statusen säger "vald, men inte reserverad".
- `aria-label` för tid ("HH:MM till HH:MM") och dag (hel svensk dag) finns. `role=status aria-live=polite` och `role=alert` finns.
- **FAIL:** efter Enter på en dag och efter "Kontrollera" hamnar fokus på `<body>` (TC-QA-1).

**Att välja tid bokar inget:**
- Valet gör inget verktygsanrop.
- Alla 14 anrop var `show_time_picker`.
- 22 model-context-uppdateringar innehöll inga kunddata och alltid `bookingCreated:false`.
- DB-checksummor var identiska före och efter.

**Inaktuellt val (stale):** jag valde en tid och lade in en bekräftad bokning på den i DB. "Kontrollera" gav då "Tiden är inte längre ledig", valet doldes, tiden försvann och kontexten fick `start:null`.

**Byte av tjänst, personal och dag:**
- Tjänstebyte gör ett anrop utan `staffId` och tömmer valet.
- Personalbyte anropar med nytt `staffId`.
- Dagbyte via knapp fungerar.
- Söndag ger tomläge med "Prova nästa dag →", som går till måndagen.
- Pilen → slutar på lastDate (inaktiverad). "Idag" ger firstDate med ← inaktiverad.

**Fel och retry:** ett syntetiskt transportfel ger alert "Tiderna kunde inte hämtas" och "Försök igen". Retry återställer och tömmer alerten.

**Injektion:**
- HTML i namn från värden (`<img onerror>`, `<b>`, `<script>`) visas som text, utan element och utan exekvering.
- HTML i ett DB-tjänstenamn via den riktiga verktygsvägen visas också som text.
- Ett förfalskat `tool-result` från en syskon-iframe ignoreras.

**Nätverk och konsol:** 0 nätverksförfrågningar loggade (`page.on('request')`), 0 konsolfel och 0 dialoger.

**Skärmbilder** i `run/shots/`: `card-{320,390,1024}.png`, `keyboard-390.png`, `stale-1024.png`, `empty-1024.png`, `error-1024.png` och `injection-1024.png`.

## 5. Codex-evidens (UNDERLAG, inte egen körning) och påståenden
- **`verification.json`** (generate, lint, tsc, unit, integration, card-ui, build, prod0, prod1 med exit 0; dev0 med exit 1) stämmer med briefen.
  - Dev0-felet förklaras som delad artifact-mapp, och a65f0f2 isolerar `outputDir`. `playwright.time-card.config.ts` har mycket riktigt `demo-artifacts/time-card/test-results`.
  - `finish-verification.json` visar card-ui 3/3. Ett dev1-resultat finns inte i evidensen.
- **Unit och integration:** `unit.txt` 83/83 och `integration-final.txt` 105/105 stämmer exakt med min körning. `lint` och `tsc` är tomma (= PASS). `build.txt` visar kompilering och routes.
- **`launcher-check.json`:**
  - Källrevisionen är 8648316, inte a65f0f2. Det överensstämmer med påståendet att runtime-UI:t är identiskt och att a65 bara ändrar `outputDir`. Själva identiteten kan jag inte verifiera, eftersom 8648316 inte finns hos mig.
  - Filen anger 2 verktyg, MIME `text/html;profile=mcp-app`, Massage/Anna/45000 öre, 16 tider 2026-11-16 08:00Z–15:30Z, `readOnly on`, nekat 42501/42501/25006 och `bookingWrites 0`.
  - Detta är **konsistent med mina egna värden** (samma 16 tider, samma SQLSTATE).
- **Bilderna `harness-{320,390,1024}.png`:**
  - Bredden matchar viewport (320×942, 390×900, 1024×900). Märkta som egen testvärd, inte ChatGPT.
  - Innehållet är konsekvent (Fotvård 650 kr, 30 nov – 6 dec).
  - Notering: rubriken säger "november 2026" fast veckan sträcker sig in i december (TC-QA-6).

| Codex-påstående | Bedömning |
|---|---|
| 83 unit / 105 integration | **Bekräftat** (egen körning) |
| lint/tsc/build | **Bekräftat** |
| Kort-UI 3 fall 320/390/1024 | **Bekräftat** (3/3) |
| prod0/prod1 46/46 | **Bekräftat** |
| dev0 45/46 orsakades av operatören (delad artifact-mapp); sekventiell omkörning pågår | **Underlag konsekvent.** Själv: dev0 och dev1 **46/46** sekventiellt efter kort-UI |
| 9 migrationer, oförändrade paket och lock | **Bekräftat** (byte-identiska) |
| Audit 7 moderate dev / 0 prod | **Bekräftat** |
| Read-only-konto 42501/25006 | **Bekräftat med egen motsvarande roll** |
| Exakt 2 verktyg, 1 resurs, read-only, inga kunddataverktyg | **Bekräftat** (egen SDK-prob) |
| Ingen extern UI-trafik, font eller CDN | **Bekräftat** (0 förfrågningar, CSP, ingen extern URL) |
| Guard nekar production, Vercel och skrivflaggor | **Delvis:** `NODE_ENV`, `VERCEL_ENV` och flaggor bekräftade; `VERCEL=1` utan `VERCEL_ENV` nekas inte (TC-QA-3) |
| Riktiga verktyget i Codex/ChatGPT-konversationen gav 16 tider | **Ej verifierbart** för mig. Siffran stämmer med min egen SDK-körning, men det är inget ChatGPT-prov |
| Faktisk ChatGPT-inline-rendering och manuell klick | **Ej observerat** (även enligt Codex). Jag har inte kört något eget ChatGPT-prov |
| Äldre runtime 8648316 har samma UI | **Ej verifierbart** |

## 6. Fynd
Inga fynd är Medium eller högre. **Ingen FIX-REQUEST skrivs.**

### TC-QA-1 – Low (tangentbord/a11y): fokus tappas till `<body>` efter varje laddning – VERIFIERAT
- **Kod:** `src/mcp/time-card/ui.html:566` inaktiverar alla knappar och selects under laddningen. Det fokuserade elementet tappar då fokus. `:476` och `:503` ersätter dessutom dag- och tidknapparna med `replaceChildren()`.
- **Repro:** i `probes/ui-tc.mjs` vid 390 px:
  1. Fokusera en dag och tryck Enter. Då gäller `document.activeElement === body`.
  2. "Kontrollera mitt tidsval" + Enter ger samma resultat.
  3. Efter tjänstebyte tappades fokus i 1 av 2 körningar.
  - Chromium behåller startpunkten för sekventiell navigering, så nästa Tab hamnade på vald dag; 8 Tab behövdes till första tiden. Men synlig fokus försvinner, och skärmläsarens position tappas. I andra klienter och webbläsare kan Tab börja om från toppen.
- **Fixriktning:** spara den aktiva kontrollens identitet (t.ex. `data-date`/`data-start`, eller id för select och knappar) före laddningen. Efter `render()` fokuseras motsvarande nya element, eller rubriken för tider med `tabindex=-1`. Alternativt: sätt `aria-busy` i stället för att inaktivera den fokuserade kontrollen.

### TC-QA-2 – Low (visuellt/kontrast): vald tid eller dag blir nästan oläslig vid hover – VERIFIERAT
- **Kod:** `ui.html:52` `button:hover:not(:disabled)` (specificitet 0,2,1) vinner över `ui.html:175-180` `.slot[aria-pressed="true"]` (0,2,0). Bakgrunden blir `--tint` (#e8f1eb) medan textfärgen är `--accent-text` (#fff), alltså kontrast ca 1,15:1.
- **Repro:** klicka på en tid med musen och låt pekaren ligga kvar. Se `run/shots/card-320.png`, där "09:00" knappt syns. På pekskärmar ligger hover-läget normalt kvar efter tryck (resonemang, inte enhetstestat).
- **Fixriktning:** ge pressed-regeln högre specificitet, t.ex. `.slot[aria-pressed="true"]:hover`, eller lägg hover-regeln i `@media (hover: hover)`.

### TC-QA-3 – Low (försvar på djupet): guarden nekar inte `VERCEL=1` eller `VERCEL_URL` utan `VERCEL_ENV` – VERIFIERAT
- **Kod:** `src/mcp/time-card/guard.ts:11` kontrollerar bara `VERCEL_ENV`.
- **Repro:** `guard-tc.mjs` – servern startar med `VERCEL=1` och lokal `_demo`-DB.
- **Konsekvens:** liten. Vercel sätter normalt alltid `VERCEL_ENV`, DB-guarden kräver loopback, och launchern vidarebefordrar inte föräldramiljön. Planen säger dock "Vercelmiljö nekas".
- **Fixriktning:** neka även `VERCEL` och `VERCEL_URL`. Komplettera enhetstestet.

### Info (backlogg, VERIFIERAT om inget annat anges)
- **TC-QA-4:** guarden körs efter modulimporterna (`server.ts:7` importerar `db` före `server.ts:12`). Saknad eller ogiltig `DATABASE_URL` nekas därför av `database.mjs` med stacktrace i stället för `TIME_CARD_DEMO_REFUSED`. Inga hemligheter läcker, och ingen anslutning görs.
- **TC-QA-5:** pris formateras med `maximumFractionDigits: 0` (`ui.html:385`). 12 345 öre visas som "123 kr", och formatet skiljer sig från webbens "450,00 kr". Demopriserna är hela kronor.
- **TC-QA-6:** månadsrubriken visas bara för valt datum: "november 2026" visas fast veckan går in i december (Codex `harness-390.png`).
- **TC-QA-7 (kodgranskning):** kortet visar data först när värden skickar `ui/notifications/tool-result` (`ui.html:624`). Om en klient inte gör det står "Hämtar lediga demotider…" kvar (`:344`) utan egen hämtning eller timeout. Det är relevant eftersom ChatGPT-renderingen inte är observerad.
- **TC-QA-8:** `list_services` saknar `destructiveHint:false` och `idempotentHint:true` (`server.ts:94`). `readOnlyHint:true` räcker enligt spec, men det är inkonsekvent med `show_time_picker`.
- **Kvarvarande:** 8 RateLimitBucket-rader efter integration (känd sedan tidigare). 572 paket med npm ci (plattform).

### Blockerare
- **Syntetisk lokal POC:** inga.
- **För påståendet "fungerar i ChatGPT":** saknad observation av faktisk ChatGPT-rendering och klick.

## 7. Saknade tester
- Tangentbordsflöde och fokushantering efter laddning (TC-QA-1); kortets egna tester klickar bara med mus.
- Hover- och pressed-kontrast (TC-QA-2).
- Guard för `VERCEL` och `VERCEL_URL` (TC-QA-3).
- DST-veckor och fönstrets slut över DST (verifierat av mig, inte i sviten).
- Injektion via värdens och DB:ns namn, samt förfalskat meddelande från syskon-frame (verifierat av mig).
- Främmande verksamhet och inaktiv personal (verifierat av mig).
- Klient som inte skickar `tool-result` (TC-QA-7).

## 8. NOT RUN
- **Faktisk ChatGPT/Codex-klient och inline-rendering:** ingen PC, session eller token. Jag har inte gjort något eget ChatGPT-prov.
- **Fysisk iPhone, Android eller Safari:** bara Chromium.
- **Plugin-installation i en riktig agentklient:** launchern testades bara via egen SDK-klient och temporär HOME.
- **Preview, cloud, GitHub och deploy:** förbjudet.
- **Ny QA av äldre epics:** utanför scope.

## 9. Harness, probefel och städning
- **Skript:**
  - `run/matrix.sh`: host-matris.
  - `run/e2e-ns.sh`: prod0, prod1, kort-UI, dev0 och dev1 sekventiellt i netns, var och en med färsk DB.
  - `run/ui-ns.sh`: egen UI-prob i netns med egen PG.
- **Prober:** `run/probes/{mcp-tc,guard-tc,launcher-tc,dst-tc,dst-days,ui-tc}.mjs`. Loggar finns i `run/logs/`.
- **Egna probefel (rättade och omkörda; räknas inte som produktfel):**
  1. `mcp-tc` försök 1: Staff-fixturen skrev JSON-kolumner fel, så fallen med främmande och inaktiv personal testades inte på riktigt (`logs/mcp-tc-attempt1-probebug.txt`). Efter rättning: 63/0.
  2. `guard-tc` försök 1:
     - `--allow-workspace=1` borde förväntats starta, eftersom flaggan saknar betydelse.
     - Nekande via `DATABASE_CONFIG_INVALID` räknades felaktigt som FAIL.
     - Efter rättning: 20/2, där de 2 är TC-QA-3.
  3. `dst-tc`: proben flyttade först en annan luxon-instans än den appen använder. Rättat genom att flytta `Date.now`.
  4. `ui-tc`: en informationsrad skrev fel element. Rättat; slutkörningen är 38/2.
- **Startade inte:** första start av matrisen stoppades under `npm ci` innan något test kört (uid-mappning för Postgres i netns saknades). Den startades om från början.
- **Städning:**
  - Alla servrar och PG-instanser (55800, 55801, 55802) är stoppade. Inga processer eller lyssnande portar finns kvar.
  - Raderat: `work/.env`, temporär HOME med profil och env-filer, `/tmp/tcns`, `/tmp/tcui`, `work/node_modules`, `work/.next`, `work/demo-artifacts`, `pgdata-e2e` och `pgdata-ui`.
  - QA-fixturer i `tc_demo` är borttagna (0 kvar). `pgdata` (host) ligger kvar som lokal artefakt.
  - Inga gamla QA-mappar behövde rensas. Disk 81 % (25 GB fritt), varav mappen tar 122 MB.

## 10. Beslut
- **Syntetisk lokal POC (stdio, `_demo`/`_test` på loopback, `@example.test`): GO.**
  - Två read-only-verktyg och en MCP Apps-resurs med korrekt MIME, CSP och metadata.
  - Verklig tillgänglighet; inga kunddata och inga skrivningar, även med läsbegränsad roll.
  - Guarden fungerar, liksom stale-kontroll, byte, tomläge, felläge, 320/390/1024 och injektionsskydd.
  - TC-QA-1–3 (Low) bör tas i nästa ordinarie runda; de blockerar inte.
- **Inte GO för "fungerar i ChatGPT":** faktisk ChatGPT-rendering och klick är inte observerade, varken av Codex eller av mig. Codex uppgift om 16 tider i deras konversation är ej verifierbar för mig.
- **Pilot med riktiga kunder eller data: NO-GO.**
