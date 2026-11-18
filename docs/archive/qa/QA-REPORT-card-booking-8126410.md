# QA-rapport – Booking Lab MCP-bokningskort till admin (8126410)

**Datum:** 2026-11-13, körning 13:33–13:49 (Europe/Stockholm) · **Typ:** avgränsad oberoende QA, en enda körning · **Testare:** Grok Bot (QA)
**Scope:** `QA-BRIEF-card-booking-8126410.md` (sha256 `653a431de045e420edd75813560e3627d8b7722aa87a44c04517402dcab90b0a`), läst i sin helhet. Gäller bara bokningsprovet från tidvalskortet till vanlig admin. Ingen ny epic.

## 1. Scope och hashar
| Fält | Värde |
|---|---|
| Revision | `8126410af712bdd71d6b6a42c0a1fcc58055d28d`, `feature/mcp-card-booking-proof`, bas fdcb41b |
| Kodarkiv | sha256 `f72406ea2b159023e2a2f0c4aba9e7023ab532c2933317ca6887c07c7de242e1`, 3 434 892 byte, 530 poster, zip-kommentar = revisionen (verifierat) |
| Env-filer i arkivet | Endast `.env.example`. `docs/calendar-proof/private.json` är en syntetisk fixture och lästes inte. Inga `neon-*.private.json` eller `resources.private.json` |
| Codex-evidens | sha256 `b5a6e3b4030ce98676f605d6f4b46fbca8dd196e1c887f2b3f8fc55770dc16a1`, 20 filer (12 results + 8 testvärdsbilder). **Granskat som underlag, inte som egen körning** |
| Jämförelsebaser | Mina extraktioner `timecard-a65f0f2/run/src` och `lifecycle-fix1-95f8071/run/src` |

### Hur körningen gjordes
- **Arkivet orört:** `run/src` jämfördes efter körningen mot en ny extraktion, utan skillnader. Allt kördes i kopian `run/work`. Enda skillnaden mot arkivet där är `next-env.d.ts`, som `next build` skriver om.
- **Ingen produktkod ändrades.** Inga testkrav sänktes.
- **Postgres:** egen embedded Postgres 18 körd som uid 1000, aldrig root.
  - Host, port 55810: `cb_test`, `cb_int_test` och `cb_demo` (MCP-prober).
  - Isolerat namespace, port 55811: färska `cb_readcard_test`, `cb_cardbooking_test` och `cb_e2e_{prod0,prod1,dev0,dev1}_test`.
  - UI-namespace, port 55812: `cb_ui_demo`.
- **Playwright och Chromium:** körde bara i isolerat nätverksnamespace (`unshare -rn` + `lo up` + nästlad `--map-user=1000`). Port 3000, 3187 och 3188 fanns bara där. Konfigurationerna kördes sekventiellt.
- **Data och miljö:** endast `@example.test`. `env -u NODE_ENV`, TZ=Europe/Stockholm. SESSION_SECRET och adminlösenord slumpades och fanns bara i en temporär `.env` och i processmiljön. Inga hemligheter lästes.
- **Ingen extern åtkomst:** ingen PC, originalrepo, preview, GitHub, cloud, token, push eller deploy. Inget ChatGPT-test.

## 2. Diff
### Mot a65f0f2 (`run/logs/changed-vs-a65f0f2.txt`, 33 poster)
**Byte-identiskt:**
- `package.json`, `package-lock.json` och `prisma/schema.prisma`.
- Alla 9 historiska migrationer och `migration_lock.toml`.
- `src/lib/**`, inklusive `domain.ts`/`createBooking`, auth, `errors.ts` och `customer-data`.
- `src/mcp/booking.ts` (`mcpBookingSchema`, `MCP_BOOKING_CLIENT`, `bookingModeAllowed`), `src/mcp/environment.ts` och `scripts/**`.

**Nytt:**
- `src/mcp/time-card/booking.ts` (53 rader).
- `plugins/booking-lab-time-card/README.md` och `docs/MCP_CARD_BOOKING_PLAN.md`.
- `playwright.card-booking.config.ts`.
- `tests/integration/card-booking.test.ts`, `tests/time-card-ui/{booking.spec.ts,host.ts}`.
- `docs/assets|verification/time-card`, samt min tidigare rapport som `docs/qa/QA-REPORT-time-card-a65f0f2.md`.

**Ändrat:**
- `guard.ts`, `data.ts`, `server.ts` och `ui.html`.
- `launcher.mjs` och `plugin.json` (0.2.0).
- `playwright.time-card.config.ts` (testMatch) och `tests/time-card.test.ts`, `tests/time-card-ui/card.spec.ts`.
- `.github/workflows/verify.yml`: båda kortkonfigurationerna körs nu i CI i dev/proxy0-läget.
- Dokumentation.

### Mot 95f8071 (31 poster)
- Samma byte-identitet som ovan.
- Kärnan är oförändrad utöver `src/lib/errors.ts`, som har exakt de 3 statiska meddelanden som redan kom i a65f0f2.
- `createBooking` har **inga ändringar.** Kortet anropar det med `mcpBookingSchema`, fast kund, nyckel `time-card_<uuid>` och kanalen `mcp:local-booking-channel:v1`, utan actor. Det betyder publik/lokal-MCP-budget och ingen adminbudget.

### Kodgranskning, kort
- **`booking.ts`:** schemat är `mcpBookingSchema` utan kundfält, `.strict()` och med `clientRequestId: z.uuid()`. Kunden `Tidkort Demo / tidkort@example.test` sätts på servern. `timeCardBookingsEnabled()` kontrolleras igen vid varje anrop.
- **`guard.ts`:** bokningsläget kräver `BOOKINGS=1` och dessutom `bookingModeAllowed`, alltså `--admin`, `--allow-bookings` och en hemlighet på minst 32 tecken. Utan `BOOKINGS` nekas `--admin` och `--allow-bookings`. `--allow-workspace` nekas alltid.
- **`server.ts`:** `book_demo_time` registreras bara i bokningsläge, med `_meta.ui.visibility:["app"]`. Fel ≥500 ger `bookingCreated:"unknown"`.
- **`ui.html`:** `pendingBooking` behåller nyckel och payload. Bara statusarna 400/403/409/429 räknas som definitiva. `load()`, tidknappar och tool-result ignoreras medan utfallet är okänt.

Jag har läst `docs/MCP_CARD_BOOKING_PLAN.md` och plugin-README. Gränserna stämmer med koden, med undantagen i CB-QA-1 och CB-QA-2.

## 3. Egna kommandon (`run/logs/summary.log`)
| Steg | Resultat |
|---|---|
| `npm ci` | PASS – Linux: 572 added / 573 audited, 7 moderate |
| `prisma generate`, `db:migrate`, `db:seed` | PASS. 9 migrationer; 8 färska DB:er migrerades och seedades |
| `npm run lint` / `npx tsc --noEmit` | PASS / PASS |
| `npm test` (unit) | **PASS 85/85** (17 filer) |
| `npm run build` | PASS |
| `npm run test:integration` | **PASS 113/113** (25 filer). Efteråt: 8 RateLimitBucket, 0 bokningar (känt) |
| Läskort-PW (`playwright.time-card.config.ts`) | **PASS 3/3**, netns, färsk DB |
| Bokningskort-PW (`playwright.card-booking.config.ts`, loopback 3187) | **PASS 4/4**, netns, färsk DB |
| Webb-E2E prod0 / prod1 / dev0 / dev1 | **PASS 46/46 ×4 = 184/184**, sekventiellt på färska DB:er. Alla lämnade 0 rader kvar |
| `npm audit` (full) | 7 moderate (dev: `@typescript-eslint/*`, `typescript-eslint`, `minimatch`), 0 high/critical |
| `npm audit --omit=dev` | **0** sårbarheter |
| Egna prober | guard 36 PASS / 8 FAIL (CB-QA-2) / 1 nekad med annat meddelande (TC-QA-4) · MCP-bokning 90/1 (CB-QA-1) · launcher 15/0 · DST och read-only-roll 11/0 · UI 69/0 + 2 INFO |

**Webbmatrisen är min egen körning.** Codex anger att deras matris inte var klar, och jag drar inga slutsatser om deras resultat.

**Probe- och harnessbuggar som jag rättade och körde om. De räknas inte som produktfel. Försöken är sparade i `run/logs`:**
1. **Första netns-körningen** hade loopback nere och gav P1001. Den avbröts och kördes om med `ip link set lo up` (`attempt1-harness-lo-down/`).
2. **mcp-cb, försök 1:**
   - SDK-schemavalideringen svarar `isError` utan `structuredContent`, vilket proben inte förväntade sig.
   - "Tiden är inte tillgänglig" har status 400, inte 409.
   - Testet med 20 konkurrerande nycklar kördes efter att den fasta kundens e-posttak (3/dag) redan var nått.
3. **launcher, försök 1:** proben skickade `NODE_OPTIONS` till själva launchern.
4. **ui-cb, försök 1–2:**
   - fel sorteringsordning på nycklarna;
   - admin-länken lästes utan väntan;
   - `".slot"` matchade även `slots-title`;
   - Tab-gränsen var för låg.

## 4. Opt-in-gränser (riktig MCP-SDK-klient/stdio; `logs/guard-cb.txt`, `logs/launcher-cb.txt`, `logs/mcp-cb.txt`)
**Antal verktyg i olika lägen:**
- Standardprofilen har **exakt 2 verktyg** (`list_services`, `show_time_picker`). Så är det även med SESSION_SECRET satt, eller med `BOOKINGS=0`.
- Full opt-in ger **exakt 3 verktyg**. Full opt-in betyder `DEMO=1`, `BOOKINGS=1`, `--admin --allow-bookings` (i valfri ordning), loopback `_demo`/`_test` och en hemlighet på minst 32 tecken (32 räcker, 31 nekas).

**Nekas med `TIME_CARD_DEMO_REFUSED`, exit 1, utan läckor i stderr:**
- att någon av delarna saknas, eller `BOOKINGS=true`/`0`;
- bara `--admin` eller bara `--allow-bookings`;
- `--allow-bookings=1`;
- läsprofil med `--admin`/`--allow-bookings`;
- `--allow-workspace`, i båda lägena;
- `NODE_ENV=production`;
- `VERCEL=1`, `VERCEL_ENV=preview|development` och `VERCEL_URL` (TC-QA-3 åtgärdad för dessa);
- fjärrvärdar (10.0.0.5, db.example.com, neon-liknande) och `?host=`-override;
- DB-namnen `cb_prod` och `demo_cb`.

**Övrigt om start och verktyg:**
- **Startar trots allt (CB-QA-2):** `VERCEL_REGION`, `VERCEL_TARGET_ENV`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_GIT_PROVIDER`, `VERCEL_OIDC_TOKEN` och `NOW_REGION`.
- **`book_demo_time`:**
  - `_meta = {ui:{visibility:["app"]}, "openai/widgetAccessible":true}`, ingen egen outputTemplate;
  - annotations readOnly=false, destructive=false, idempotent=true, openWorld=false;
  - inputSchema har exakt `serviceId`, `staffId`, `serviceVersion`, `start`, `clientRequestId` och `confirmed`, alla required, `additionalProperties:false`.
  - **Inga kontaktfält.**
- **`show_time_picker`** är kvar som readOnly och pekar på `ui://booking-lab/time-card-v2.html`. Resurserna är v2 och v1.
- **Okända verktyg avvisas med -32602:** `create_booking`, `list_bookings`, `list_customers`, `get_customer`, `remove_customer_contact`, `reschedule_booking`, `cancel_booking`, `BOOK_DEMO_TIME` och `"book_demo_time "`.

**Launchern (falsk runtime som dumpar barnprocessens env och argv):**
- **Läsläge:** barnet får bara `DATABASE_URL`, `BOOKING_TIME_CARD_DEMO`, `NEXT_TELEMETRY_DISABLED`, `CHECKPOINT_DISABLE`, `PATH` och `HOME`. Det gäller även när envfilen innehåller SESSION_SECRET, eller `BOOKINGS=true`. Inga argv.
- **Explicit opt-in:** barnet får dessutom `SESSION_SECRET` (från envfilen) och `BOOKINGS=1`, och argv blir `--admin --allow-bookings`.
- **Vidarebefordras aldrig:**
  - från envfilen: `ADMIN_PASSWORD`, `NODE_OPTIONS`, `OPENAI_API_KEY`, `RATE_LIMIT_STORE`;
  - från föräldraprocessen: `SESSION_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`.
- **Launchern nekar:** kort eller saknad hemlighet, `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` och `NODE_ENV=production`, både i envfilen och hos föräldern. Övriga `VERCEL_*` nekas inte, men vidarebefordras inte heller.
- **Riktig launcher mot `run/work`:** 2 verktyg i läsläge och 3 i bokningsläge.

## 5. Bokningskorrekthet (`logs/mcp-cb.txt`, `logs/dst-ro-cb.txt`)
**Avvisade anrop. Alla gav 0 ändrade tabellrader:**
- **SDK-validering ("Kontrollera uppgifterna"):**
  - `confirmed` saknas, `false`, `"true"` eller `1`;
  - extrafälten `customerName`, `customerEmail`, `customerPhone`, `phone`, `name`, `email`, `customerId`, `businessId`, `actor`, `clientAddress` och `idempotencyKey`;
  - `clientRequestId` som är `abc`, `time-card_<uuid>`, uuid med injektion eller tomt;
  - saknad staff/version, version 0, `start` som inte är ISO eller saknar offset, samt `{}`.
- **Domänfel:**
  - fel version → 409 "Uppgifterna har ändrats";
  - SQL-/HTML-injektion i `serviceId`/`staffId` → 400 med generiskt meddelande, där indata inte ekas;
  - tid utanför rutnätet (+7 min), 06:00, 22:00, i går, i dag 00:30, lördag, dag +70, eller Erik 09:00 → `slot_unavailable`.

**Lyckade bokningar:**
- `bookingCreated:true`, rätt tjänst, personal, start, pris och längd. Inga kontaktuppgifter i svaret.
- **DB:**
  - kund `Tidkort Demo`/`tidkort@example.test`, `customerId` null;
  - `idempotencyKey = time-card_<uuid>`, requestHash satt;
  - `clientKey = HMAC(secret, "mcp:local-booking-channel:v1")`, alltså samma kanal och budget som lokal MCP;
  - **`emailCapKey = email-hmac-v1:<HMAC>`, inte klartext (LC-fixen gäller);**
  - version 1, status confirmed;
  - exakt 1 BookingEvent: `create`, `local-mcp`, `booking-channel`.
- **Raddelta:** bara `Booking 0→1` och `BookingEvent 0→1`.

**Idempotens och samtidighet:**
- Sekventiell replay ger samma id och identiskt svar.
- Samma nyckel med ny start eller ny personal → 409 "Bokningsnyckeln har redan använts…", utan ny rad.
- Samma instant skrivet i annan ISO-form räknas som replay.
- **20 samtidiga anrop med samma nyckel:** 1 rad, 1 event och 20 identiska svar.
- **20 konkurrerande nycklar på samma tid:** 1 vinnare och 19 rena `slot_unavailable`, `bookingCreated:false`, 1 rad.
- Upptagen och överlappande tid (+15 min) → `slot_unavailable`, status 400.

**Kvoter:**
- **E-posttak:** 3 kortbokningar samma dag → den 4:e får 429. Replay av en befintlig nyckel fungerar fortfarande, eftersom replay sker före kvotkontrollen.
- **Kanaltak 5/dag** är delat med lokal MCP → 429.
- Ingen adminbudget används.

**Övriga kontroller:**
- **Tjänsteversion bytt mellan visning och bokning:** 409 utan rad. När kortet läser om tjänsten bokas nytt pris (470 kr).
- **Adminändring (SQL-flytt med version+1) och därefter replay:** samma id, `changedSinceCreation:true`, och `startsAt` visar det ursprungliga valet. Avbokning ger `cancelled`.
  - `initialStartsAt` fylls redan vid insert, så detektionen via `version>1` är rätt.
- **DST, med förfalskad serverklocka:**
  - 26/3 09:00 → 08:00Z och 29/3 09:00 → 07:00Z;
  - 23/10 → 07:00Z och 26/10 → 08:00Z;
  - bokningarna sparas exakt och är 30 min långa. Kortets fönster är 28 dagar.
- **28-dagarsfönstret:** `show_time_picker` nekar dag +35, men **`book_demo_time` skapar en bokning dag +35** (CB-QA-1).
- **Läsprofil med README-läsrollen** (SELECT på Service/Staff, 6 Booking-kolumner, `default_transaction_read_only`): 2 verktyg, `list_services` och `show_time_picker` fungerar och 0 rader ändras.
  - Bokningsläge mot samma roll fallerar stängt: `bookingCreated:"unknown"`, 500, generiskt meddelande, ingen läcka.
- **Standardprofil med superuser:** 0 ändrade tabellhashar.

## 6. UI i egen testvärd, produktionsbygge, Chromium, isolerat netns (`logs/ui-cb.out`, `run/shots/cb-*.png`)
**Detta är min egen testvärd, inte ChatGPT och inte native.** Värden ligger på origin 127.0.0.1:3188 med sandboxad srcdoc-iframe och riktig stdio-server samt riktig `ui://…v2`.

**Flödet vid 320, 390 och 1024 px:** välj → sammanfattning → samtycke → boka → kvitto.
- Inget horisontellt överflöde.
- Fönstertexten "Demot visar fredag 13 november–torsdag 10 december".
- **Efter tidval:** samtycket är urkryssat och Boka är inaktiverad. En tvingad klick ger 0 anrop. Kryssa i → aktiverad; kryssa ur → inaktiverad igen.
- **Kvittot:** "Massage hos Anna · 30 minuter · 450,00 kr", tid "09:30–10:00 (Stockholmstid)" och boknings-id. Allt stämmer med DB. Kvittot får fokus och alla val låses.
- **Admin:** kvittobokningen syns i vanlig skyddad admin i samma DB. Inloggningen gjordes med egen syntetisk admin via `admin:manage`. Detaljsidan visar "Tidkort Demo · ***@***".

**Dubbeltryck:** `dblclick`, två synkrona klick, dubbel Enter och dubbel Space gav vardera **exakt 1 anrop och 1 rad**.

**Tappat svar efter commit:**
- DB har 1 rad. Kortet säger "Bokningen kan ha skapats, men svaret saknas…" och "Starta inte en ny bokning…", **aldrig "inte bokad"**.
- Retry-knappen är fokuserad. **Alla val är låsta:** tvingat tidklick, en pushad tool-result och tvingat tjänstebyte gav 0 nya anrop.
- **Retry skickar identiska argument** (samma `clientRequestId`) och kvittot visar samma rad.
- **Tappat före sändning, sedan efter commit, sedan OK:** 3 anrop med samma nyckel och 1 rad.

**Upptagen tid:**
- "Tiden hann bli bokad…". Kvittot visas inte, samtycke och val nollställs och tiderna laddas om utan den upptagna tiden. Fokus hamnar på tidsrubriken.
- Nytt val kräver nytt samtycke och får en ny nyckel. Resultatet blir 1 rad.

**Adminändring medan utfallet är okänt:**
- **Avbokning** ("Avboka"/"Ja, avboka") och **flytt** ("Flytta"/"Spara flytt") i vanlig admin-UI gav version 2.
- Kortets retry visar "Testbokningen har ändrats i admin" med originalvalet, id och förklaring. Det bygger på status och version, inte `initialStartsAt`.

**Tangentbord, fokus och aria:**
- Tab-ordningen är service → staff → Idag/←/→ → 7 dagar → tider.
- **TC-QA-1:** efter Enter på en dag hamnar fokus på `h2#slots-title`, inte body. Det krävs 1 Tab till första tiden.
- Efter tidval krävs 17 Tab till samtycket (CB-QA-5).
- Space kryssar samtycket, Enter bokar och kvittot får fokus.
- Synlig fokus finns på tid, samtycke och knapp (3 px grön eller webbläsarens standardring).
- **aria:** samtycket har en label, kvittot är en region med namnet "Bokningsbekräftelse", status har `role=status` och `aria-live=polite`, fel har `role=alert`, tiderna är en `group` med namnet "Lediga tider".

**Övriga UI-kontroller:**
- **TC-QA-2 åtgärdad:** vald tid behåller vit text på #235d4c vid hover, kontrast 7,66:1.
- **Klientsträngar** (HTML i serviceName, staffName och id från värden) renderas som text: inga img- eller script-element och ingen körning.
- **Kvot i UI:** 429 ger "Demots bokningsgräns är nådd", inget kvitto och ingen retry-knapp.
- **0 externa förfrågningar** av 189. Konsolfelen är bara 404 på min egen `robots.txt`-navigering.
- **Icke-säker kontext** (about:blank som värd): `crypto.randomUUID is not a function`. Boka gör då ingenting och ger ingen återkoppling (CB-QA-3).

## 7. Fynd
**Inga fynd är Medium eller högre. Ingen FIX-REQUEST skrivs.**

### CB-QA-1 – Low (gräns): `book_demo_time` håller inte kortets 28-dagarsfönster – VERIFIERAT
- **Kod:**
  - Bara `src/mcp/time-card/data.ts:33-34` begränsar till 28 dagar.
  - `src/mcp/time-card/booking.ts:25-30` skickar vidare till `createBooking`, där motorns horisont är 60 dagar (`src/lib/schedule.ts:105`).
- **Repro:** `probes/mcp-cb.mjs`. `book_demo_time` med `start` = dag +35, 10:00 Stockholm, ger `bookingCreated:true`. `show_time_picker` för samma dag ger "Välj en dag inom de kommande 28 dagarna."
- **Konsekvens:** liten. Verktyget är app-only, och UI:t erbjuder aldrig sådana dagar. Datumet ligger inom den vanliga publika horisonten, och kunden är syntetisk. Men servergränsen motsvarar inte planens och fönstertextens 28 dagar.
- **Fixriktning:** kontrollera samma dagsintervall (today..today+27, Europe/Stockholm) i `bookDemoTime` före `createBooking`. Lägg till ett integrationstest.

### CB-QA-2 – Low (försvar på djupet): bara 3 av Vercels flaggor nekas – VERIFIERAT (TC-QA-3 delvis åtgärdad)
- **Kod:** `guard.ts:12-14` och `launcher.mjs:19-25` kontrollerar bara `VERCEL`, `VERCEL_ENV` och `VERCEL_URL`.
- **Repro:** `guard-cb.mjs`. Bokningsläget startar med 3 verktyg när någon av följande är satt: `VERCEL_REGION`, `VERCEL_TARGET_ENV`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_GIT_PROVIDER`, `VERCEL_OIDC_TOKEN` eller `NOW_REGION`.
- **Konsekvens:** liten. Vercel sätter i praktiken alltid `VERCEL=1`, DB-guarden kräver loopback och launchern vidarebefordrar inte dessa variabler. Briefen säger dock "Deny … ALL Vercel flags".
- **Fixriktning:** neka varje nyckel som matchar `/^(VERCEL|NOW)_/` och `VERCEL`, i både guard och launcher. Lägg till ett enhetstest.

### CB-QA-3 – Low (robusthet): utan säker kontext gör Boka ingenting, tyst – VERIFIERAT i egen värd, relevans i riktiga värdar OVERIFIERAD
- **Kod:** `ui.html:691` anropar `crypto.randomUUID()` utanför `try`.
- **Repro:** `ui-cb.mjs` S11, med about:blank-förälder. Det ger en pageerror, 0 anrop och statusen "Tiden är vald, men inte reserverad."
- **Konsekvens:** ingen felaktig bokning och inget felaktigt påstående. Men användaren får ingen återkoppling. Riktiga MCP Apps-värdar kör normalt på https, och det är inte observerat i ChatGPT.
- **Fixriktning:** fånga felet och visa ett tydligt meddelande om att bokning inte kan startas i den här vyn. Alternativt en fallback via `crypto.getRandomValues`.

### CB-QA-4 – Low (UX): vid okänt utfall döljs vilken tid som försöks – VERIFIERAT
- **Kod:** `ui.html:775-779`. Catch-grenen döljer `#selection` och tar bort `aria-pressed`.
- **Repro:** `shots/cb-390-lost-reply-pending.png`. Bara "Kontrollera samma bokningsförsök" syns, utan tid eller tjänst.
- **Konsekvens:** säkerheten påverkas inte. Nyckeln är oförändrad och valen är låsta. Men användaren ser inte vad som kanske bokats. Om kortet stängs (enligt README tappas tillståndet) finns ingen tid att kontrollera i admin.
- **Fixriktning:** visa den väntande tiden, tjänsten och personalen skrivskyddat i pending-läget.

### CB-QA-5 – Info (tangentbord): efter tidval krävs 17 Tab till samtycket
Fokus ligger kvar på vald tid (`ui.html:578`). Användaren måste Tab:a förbi resterande tider och "Kontrollera mitt tidsval". Detta är inget krav, men det vore bra att erbjuda en genväg, t.ex. fokus till sammanfattningen eller en "hoppa till bekräftelse"-länk. Backlogg.

### Info (backlogg)
- **Fast demokund och kvot:** den fasta demokunden ger högst 3 kortbokningar per dag och DB, totalt för alla kortanvändare. E-posttaket kontrolleras före tidskontrollen, så efter tre bokningar får även en upptagen tid "bokningsgräns". Detta är dokumenterat (README: 3/e-post/dag).
- **Status för upptagen tid:** upptagen tid ger status 400, inte 409. UI:t skiljer på `code:"slot_unavailable"`, så detta är korrekt.
- **`confirmed:true`** är klientens försäkran och inget bevis på mänskligt mandat. Detta är dokumenterat. `visibility:["app"]` upprätthålls av värden; via rå MCP kan verktyget anropas.
- **Kvittot är en ögonblicksbild.** Senare adminändringar syns bara vid replay av samma nyckel, alltså i retry-vägen. Detta är avsett.
- **Ingen egen skrivroll:** README nämner en "egen snäv skrivroll" utan att specificera grants. Jag testade inte en sådan; Codex påstår att de gjort det (se §8).

## 8. Codex-påståenden
| Påstående | Status |
|---|---|
| 85 unit / 113 integration / 3 läskort / 4 bokningskort PASS, lint/tsc/build PASS | **Bekräftat** av egen körning, med samma siffror. Evidensfilerna är konsistenta med `full-results.json` (alla exit 0) |
| `npm ci` 571 (Windows) / audit 572; 7 moderate dev / 0 prod | **Bekräftat med plattformsdelta:** Linux 572/573 och samma 7 moderate / 0 prod. +1 på Linux är förväntat; samma delta som vid a65f0f2 |
| Standardprofilen består av 2 verktyg; skrivning kräver alla opt-ins; production/Vercel/workspace nekas | **Bekräftat**, utom "ALLA Vercel-flaggor" (CB-QA-2) |
| Launchern vidarebefordrar hemligheten bara vid explicit bokningsopt-in | **Bekräftat** |
| Samma createBooking, kanal, kvoter, transaktion, exclusion och idempotens; `time-card_`-prefix och UUID | **Bekräftat** (oförändrad kärna, DB-fält, 20+20 samtidiga, kvoter) |
| Dubbeltryck ger en bokning; tappat svar behåller nyckel och spärrar nya val; upptagen tid kräver ny bekräftelse; kvitto i vanlig admin; status/version | **Bekräftat** i egen testvärd, inklusive avbokning och flytt via riktig admin-UI |
| Fönstertext 28 dagar | **Bekräftat** för UI:t. **Motsägs delvis** på servernivå (CB-QA-1) |
| Begränsad SQL-roll skapar bekräftad rad och nekar Customer/AdminUser/skrivningar (`launcher-probe.json`) | **Overifierbart.** Det är Codex-PC (`<local-state>/…`), och rollens grants är inte dokumenterade |
| Testvärdsbilder (8) | **Granskade:** kvitton med rätt tjänst, personal, tid och pris samt admin-kalender med "Tidkort Demo". Konsistenta med mina egna `shots/` |
| Tidiga fel före frysning (kolon i nyckel, dolt adminlänkval) | Loggarna stämmer med beskrivningen. Ingen assertion är borttagen i de frysta testerna (granskat). Värdkoden i `card.spec.ts` har flyttats till `host.ts`, och antalet `expect` gick från 14 till 13+2 |
| Användarobserverad PC-rendering av läskortet | **Overifierbart** |
| Skrivkortet på riktig PC eller fysisk iPhone; ChatGPT | **Inte testat av någon.** Inget ChatGPT-test gjordes här |
| Webbmatrisen | Codex: inte klar. **Egen körning: 184/184 PASS** |

## 9. Tidigare TC-QA-fynd
| Fynd | Status vid 8126410 |
|---|---|
| TC-QA-1 fokus till body | **Åtgärdad för omladdning:** fokus går till `#slots-title` (`ui.html:653-654`), verifierat efter Enter på dag. Ny observation: CB-QA-5 |
| TC-QA-2 hover-kontrast | **Åtgärdad** (`ui.html:176-177`), 7,66:1 |
| TC-QA-3 VERCEL/VERCEL_URL | **Åtgärdad för dessa två.** Resten blir CB-QA-2 |
| TC-QA-4 stacktrace vid saknad `DATABASE_URL` | **Kvar:** nekas av `database.mjs` med stacktrace och utan läcka |
| TC-QA-5 priser utan ören | **Åtgärdad:** `maximumFractionDigits: 2`, "450,00 kr" / "450,50 kr" |
| TC-QA-6 månadsrubrik | Ej omtestat; koden för rubriken är oförändrad |
| TC-QA-7 ingen egen hämtning utan tool-result | **Kvar** (kodgranskning, `ui.html:387`) |
| TC-QA-8 `list_services`-annotations | **Kvar** (`server.ts:146`) |

## 10. Saknade tester (rekommendation)
- Serverns 28-dagarsgräns för `book_demo_time` (CB-QA-1) och fullständig Vercel-nekande (CB-QA-2).
- Tangentbordsflöde genom samtycke och bokning; kortets egna tester använder bara mus.
- Pending-läge vid tappat svar *före* commit, och upprepade tappade svar. Codex testar bara en förlust efter commit.
- Adminflytt eller avbokning via UI medan utfallet är okänt. Codex integrationstest täcker avbokning via DB.
- Den dokumenterade "snäva skrivrollen" som körbart skript eller test.

## 11. Blockerare kontra backlogg
- **Blockerare för syntetiskt lokalt prov:** inga.
- **Backlogg (Low/Info):** CB-QA-1 till CB-QA-5 samt TC-QA-4, 7 och 8.
- **Blockerare för påståendet "fungerar i ChatGPT, på PC eller iPhone":** det finns ingen observation av skrivkortet i en riktig värd.

## 12. Avgränsat beslut
- **GO** för 8126410 som **syntetiskt lokalt bokningsprov**: egen testvärd, loopback-demo-DB, fast påhittad kund, vanlig admin i samma DB.
- **Inte verifierat:** native ChatGPT, PC-installation och iPhone.
- **Pilot med riktiga kunder eller data: NO-GO.**
- **Fixrunda:** ingen krävs. Lows kan tas i en ev. samlad runda.

## 13. Städning
- **Processer:** alla Postgres-instanser (55810–55812), Next-servrar och Chromium är stoppade. Inga kvarvarande processer.
- **Hemligheter och testdata:**
  - `run/work/.env` (SESSION_SECRET) är raderad. Probe-hemligheter fanns bara i processmiljön.
  - Rollen `cb_reader` och alla probe-bokningar är borttagna.
  - Inga hemligheter finns i loggar eller prober (sökning gjord).
- **Raderat ur denna körning för att spara disk:** `work/node_modules` (939 MB), `work/.next` (172 MB), `pgdata` (86 MB), `pgdata-e2e` (125 MB), `pgdata-ui` (48 MB) och `/tmp/cb*`. Gamla QA-mappar har inte rörts.
- **Kvar:** `card-booking-8126410/` med orörd `run/src`, `work` (källa), loggar, prober och 19 skärmbilder, totalt ca 24 MB. Disken: 81 %, 25 GB fritt.
