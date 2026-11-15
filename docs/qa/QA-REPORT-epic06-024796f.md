# QA-rapport Epic 06 – kundregister, levande demo och /product (024796f)

Grok Bot, oberoende QA. **En enda samlad körning**, 2026-11-12 ca 20:31–21:05 CET. Detta är den första rapporten; högst 2 samlade rättningsvarv kan följa. Allt var read-only mot original. Bara syntetisk `@example.test`-data användes (plus en `@example.com`-adress som negativt maskeringsprov). Ingen deploy, push, merge eller GitHub-skrivning. Inga `.env`-filer, hemligheter eller cookies lästes; lokala engångshemligheter genererades.

## Verdikt
- **GO för syntetisk skyddad preview** (bunden till 024796f, samma befintliga demogate och Vercel-skydd).
- **Pilot: fortsatt NO-GO.** Orsaker: MFA saknas, verklig datalivscykel saknas, fysisk iPhone/Safari är ej testad och produktägarens UX-godkännande återstår.
- **Inga blockerare.** Därför skrevs ingen FIX-REQUEST. Det rekommenderade innehållet för rättningsvarv 1 står under Backlog.

## Omfång och hashar
| Indata | Värde |
|---|---|
| Kandidatarkiv | `epic06-024796f/booking-epic06-candidate.zip`, sha256 `0be73b2b716172520c648de71767f84f2f170479afc90a05e8bb1a9df12a2104` (kontrollerat; identiskt med bilagan) |
| Arkiv | zip-kommentar `024796f7f8049d03fa1425742e1fc699063cfac2`; 307 poster; bara `.env.example` |
| Mål | `goal.txt`, sha256 `670fa55848580818160807e52492625bb34636769a9f8c99dd071063dc67e3f8`. Läst i sin helhet och identiskt med bilagan. Det är acceptansgrunden. |
| Diffbas | Produktarkiv d7bc47f, `ui-d7bc47f/booking-ui-fix2.zip`. **Arkivet för 16dae9a fanns inte tillgängligt**, så diffen är gjord mot d7bc47f (16dae9a är docs-only enligt uppdraget, UNVERIFIED). |
| package.json/lock | Innehållsidentiska med d7bc47f (LF-hashar `d2a1d8f5…dbccd` / `83216750…4940`). Inga nya beroenden. |
| Migrationer | 7 st. De 6 gamla `migration.sql` och `migration_lock.toml` är byte-identiska med d7bc47f. Ny: `20261112190000_customers`. |

Miljö:
- Egen embedded PostgreSQL 18.6 på 127.0.0.1:55631 med TZ Europe/Stockholm. DB:er: `e6_test`, `e6_int_test`, `e6_e2e_prod_test`, `e6_e2e_dev_test`, `e6_demo` och `e6_upg_demo`.
- Prod-servrar:
  - `:3430` = lokal normal demo, gate AV.
  - `:3431` = simulerad pinnad Vercel-demogate PÅ: `BOOKING_RUNTIME=vercel`, `VERCEL_ENV=preview`, projekt-pin och DB-fingeravtryck för `e6_demo`, x-real-ip satt av testklienten.
- Egen vanlig admin `qa-admin@example.test` skapad via `admin:manage`. En andra admin flyttades via SQL till `other-biz` för främmande-verksamhetsprov.

## Diff d7bc47f → 024796f (42 poster, `run/logs/changed-files.txt`)
- **Nytt:**
  - `src/lib/customers.ts`
  - `src/app/admin/customers/**` (lista, kort, ny, editor, picker)
  - `src/app/api/admin/customers/**`
  - `src/app/product/page.tsx`
  - `public/demo/*` (5 WebP, 2 PNG, manifest)
  - migrationen
  - `tests/integration/customers.test.ts`, `tests/e2e/customers.spec.ts`
  - docs
- **Ändrat:**
  - `domain.ts`: ny `adminBookingSchema` och `customerId` i createBooking/insert.
  - `booking-mutations.ts`: `customerId` i maskerad sammanfattning.
  - `errors.ts`: 4 nya meddelanden och status 404.
  - `mcp/booking.ts` och `mcp/server.ts`: workspace-schema med `customerId` bara vid `--allow-workspace`.
  - `admin/bookings/editor.tsx` och `new/page.tsx`: kundväljare och förval.
  - `header.tsx`: Kunder och Om Booking Lab.
  - `page.tsx` och `demo-entry.tsx`: bilder, länk till /product och etikett.
  - `style.css`, `seed-demo.ts`, `fixtures.ts`, `mcp-booking.test.ts`.
- **Oförändrat (VERIFIED via diff):** `auth.ts`, `admin-http.ts`, `demo-access.ts` (gaten), `rate-limit.ts`, `postgres-rate-limit.ts`, `workspace-write.ts`, `admin-accounts.ts`, `http.ts`, `scripts/server.mjs` och client-address. Publik `api/bookings/route.ts` är oförändrad.
- **Kärnändring att känna till:** `createBooking` väljer `adminBookingSchema` när en aktör finns (admin eller local-mcp). Annars används det gamla `bookingSchema`, som tyst stryker `customerId`. Kundkortet låses med `FOR SHARE` inom samma transaktion; arkiverat eller okänt kort ger 409, och för local-mcp krävs `@example.test`. Kvoten 5/3 gäller fortfarande icke-admin, alltså även MCP.

## Migrationsgranskning (VERIFIED, kod + DB)
- Tabellen `Customer`: `businessId`, `name`, `email`, `phone?`, `archived`, `version` med `CHECK > 0`, och `createdAt`. Unik `(businessId,id)`. Index `(businessId,archived,name,id)`.
- `Booking.customerId` är **nullable**. Sammansatt FK `(businessId,customerId)` → `Customer(businessId,id)` med **ON DELETE RESTRICT, ON UPDATE CASCADE**. Index `(businessId,customerId,startsAt,id)`.
- Snapshotkolumnerna (`customerName`, `customerEmail`, `serviceName`, `priceOre`, …) finns kvar och skrivs inte om.
- Ingen unik e-post, alltså ingen merge-risk (dubbletter är avsiktligt tillåtna). Inget `updatedAt`. `Customer.businessId` saknar FK till verksamhet, vilket är samma mönster som Staff och Service.
- DB-prov: radering av ett länkat kort gav `23001 restrict_violation`, som förväntat.

## Resultat – egna körningar (VERIFIED)
| Kontroll | Resultat |
|---|---|
| npm ci | PASS, 571 paket / 572 auditerade |
| prisma generate, 7 migrationer, grundseed | PASS |
| lint / tsc / build | PASS / PASS / PASS (nya rutter /admin/customers*, /api/admin/customers*, /product) |
| unit | **76/76 PASS** |
| integration (färsk DB) | **82/82 PASS** (19 filer), varav 7/7 i `customers.test.ts` |
| E2E prod (`RATE_LIMIT_STORE=postgres`, `E2E_PRODUCTION=1`) | **38/38 PASS** (46,6 s), kund-E2E 4/4 (desktop+mobil) |
| E2E dev | **38/38 PASS** (1,5 min) |
| Restdata efter integration/prod/dev | 0 RateLimitBucket-rader (10011 resp. 32 inserts städades), 0 kunder, 0 bokningar, 0 admins |
| Egna API-/säkerhetsprober | 78 kontroller, se `run/logs/api-probes.txt`. Verkliga fynd: 3 wildcardfall (E06-QA-2). Övriga första-runda-FAIL var probe-/förväntningsfel som omtestades och fick PASS (redovisat i loggen). |
| Egna MCP-subprocessprober | 13/13 PASS |
| Egen Chromium-klickning 390/1440/320 | 78 PASS + 23 PASS (320-delmängd). FAIL bara för E06-QA-1 och dess följd. |
| Lång namn/e-post-mätning (gate PÅ) | 13 FAIL / 2 PASS, se E06-QA-1 |

### Uppgradering d7bc47f-schema → 7:e migrationen (VERIFIED)
1. Byggde `e6_upg_demo` med d7bc47f-kod: 6 migrationer, grundseed och gammal demo-seed (33 bokningar). Lade till **4 manuella prov**:
   - samma namn och e-post som seedkunden Billie;
   - samma namn men annan e-post;
   - en fristående manuell bokning;
   - en avbokad med Kims seed-e-post.
   
   Totalt 37.
2. Migrerade med 024796f: bara `20261112190000_customers` applicerades.
   - md5 över alla 37 snapshotrader är **identisk** före och efter: `94f9f68f…`.
   - 0 kopplade efter migreringen, 0 kunder.
   - Övriga tabellhashar (Service, Staff, BookingEvent, Campaign, AdminUser, WorkspaceRequest) är identiska.
3. Ny demo-seed på den uppgraderade kopian: +46 bokningar, 33 befintliga och 32 kunder, alltså **83 bokningar och 0 överlapp**. Det stämmer exakt med Codex siffror.
   - Gamla snapshots är fortfarande identiska.
   - De 33 seed-ägda gamla raderna fick `customerId` (explicit backfill per seednyckel).
   - **Alla 4 manuella prov förblev `customerId=NULL`**, även de med identiskt namn och e-post. Ingen auto-koppling.
   - Andra och tredje körningen gav 0 tillagda. Service, Staff, Campaign och AdminUser är oförändrade.

### Demo-seed på färsk `_demo` (VERIFIED)
- Med migrate + grundseed finns personalen Anna kvar och aktiv.
- Första körningen ger **32 kunder (alla example.test, 0 telefon) och 79 bokningar** (79 kopplade; 4 avbokade, 1 flyttad, 41 framtida, 38 tidigare).
- Körning 2 och 3 gav `added:0`, och en hash över 7 tabeller var identisk efter körning 1, 2 och 3.

## Säkerhetsprober (VERIFIED, egna)
- **IDOR mot främmande verksamhet** (kund `qa-foreign-1` i `other-biz`):
  - kort-API ger 404 och redigering 404;
  - kortsida och `/admin/bookings/new?customer=` renderar notFound (HTTP 200, se E06-QA-5) utan data;
  - bokning med det främmande `customerId` ger 409;
  - det finns i varken sökning eller cursor (cursor ger 400);
  - kortet var oförändrat.
  - Admin i annan verksamhet: inloggning 401, lista och kort 403.
- **Publikt API:**
  - `POST /api/bookings` med injicerat `customerId` och kortets exakta namn och e-post ger svaret `{"id"}` och **ingen koppling** (`customerId` NULL), med kortet orört.
  - Samma svarsform för okänd e-post, alltså inget existensorakel.
  - Anonym åtkomst till kund-API ger 403; `/admin/customers` redirectar utan data.
- **MCP** (riktig subprocess):
  - `--allow-bookings` utan `--allow-workspace`: schemat saknar `customerId` och strict avvisar det; icke-example.test avvisas.
  - `--allow-workspace`: ett känt kort kopplas och svaret innehåller bara id/tid, utan kontakt. Ett icke-example.test-kort och ett främmande kort ger 409. Avbokning behåller FK.
  - Inga kund-, export- eller registerverktyg i tools/list. `list_bookings` och `list_workspace_bookings` innehåller 0 e-postadresser.
- **Maskering:**
  - Gate AV: kort-API och HTML ger `***@***` och ingen telefon; lista (JSON och HTML) saknar kontaktfält.
  - Gate PÅ: kort-API och HTML visar rå `demo-customer-0@example.test`; listan saknar e-post; ett icke-example.test-kort är maskerat även här; bokningsdetaljen är maskerad och länkar till kortet.
- **Blankt fält vid redigering betyder behåll.** API-redigering utan email/phone behöll båda. UI-arkivering med maskerat kort behöll e-posten. Däremot rensar API:t telefonen med `phone:null`, och `email:""` ger 400.
- **Versionskonflikt och idempotens:**
  - Gammal `expectedVersion` ger 409.
  - Retry med samma nyckel ger samma svar och version +1 en gång. Samma nyckel med ändrad payload ger 409.
  - 5 parallella create med samma nyckel ger 1 kort.
  - Ny nyckel med samma namn och e-post ger ett separat kort (ingen merge).
- **Samtidighet:**
  - 8 samtidiga redigeringar mot samma version: exakt 1 lyckas och 7 får 409.
  - 6 samtidiga bokningar med samma kund och tid: 1 skapas och 5 får 400 "Tiden är inte tillgänglig" (oförändrat beteende).
  - Arkivering parallellt med en bokning gav ett konsistent resultat; därefter ger bokning på det arkiverade kortet 409.
- **Sökning:**
  - Både e-post (skiftlägesokänslig) och telefon fungerar.
  - `' OR 1=1 --` och `\` ger 0 träffar utan fel.
  - `q>80` ger 400. `limit=51`, `0` och `abc` ger 400; `limit=50` fungerar.
  - Pagineringen gick igenom alla 32 kunder utan dubbletter.
  - **`%` och `_` fungerar dock som jokertecken** (E06-QA-2).

## Klickning i Chromium (VERIFIED, egen)
Chromium-emulering 390×844 (mobil), 1440×900 och 320×640. Detta är inte fysisk iPhone/Safari.
- **/product:**
  - Svensk h1 "Håll ihop dagen", 3/3 bilder med `naturalWidth>0`, inget horisontellt överflöde vid 320, 390 eller 1440.
  - Med gate AV leder "Prova salongens arbetsyta" och "Öppna arbetsytan" till /admin-inloggningen, och "Se kundbokningen" till /.
  - Med gate PÅ syns demoknappen och leder till /admin utan lösenord.
- **`/`:** 5/5 bilder laddas, inget överflöde, och länken "Om Booking Lab" leder till /product.
- **Kundflödet** (390 och 1440):
  1. inloggning via UI → Kunder → listan visar 20 rader och "Nästa sida";
  2. sökning på e-post, telefon och sökning utan träffar;
  3. kort (maskerat med gate AV);
  4. Ny kund, som finns kvar efter omladdning;
  5. Ny bokning med förvald kund, kopplad i DB;
  6. bokningsdetalj → "Öppna kundkort" → kommande besök efter omladdning;
  7. **Boka återbesök**: kunden förvald utan omskrivning av uppgifter, samma behandling och personal, kopplad;
  8. Flytta och Avboka via UI: FK behålls, och korten visar "Bokad" respektive "Avbokad";
  9. (1440) arkivering via UI: besöken finns kvar och "Ny bokning" döljs;
  10. /admin-kalendern utan överflöde.
  
  0 JS-fel.
- **320:** samma kontroller för produktsida, lista, sök och kort med PASS (efter att de extremt långa testnamnen arkiverats, se E06-QA-1).

## Fynd
### Blockerare
Inga.

### Backlog (rekommenderas till rättningsvarv 1)
- **E06-QA-1 (Medel, UI) – overflow-wrap saknas för långa obrutna namn och e-post** (mätt på begäran; Codex hypotes är **bekräftad**).
  - Var:
    - `src/app/admin/customers/[id]/page.tsx:64` (`<h1>{customer.name}</h1>`), `:80` (e-post);
    - `src/app/admin/customers/page.tsx:107` (`<strong>{c.name}</strong>`);
    - `src/app/admin/customers/picker.tsx:49` ("Vald kund");
    - `style.css:17` (`.customer-row strong`) och `.workspace-heading h1` (rad 373) saknar `overflow-wrap`.
  - Repro: med gate PÅ, skapa ett kort med ett obrutet namn på 80 tecken och `qa-<61 tecken>@example.test`.
    - Kortet ger dokumentbredd 1197 px vid 320 och 390, och **1594 px vid 1440**.
    - Listraden ger 859 px vid 320 och 390.
    - Sidan Ny bokning ger 729 px.
    - E-poststycket överflödar panelen vid 320 och 390 (scrollWidth 557 mot clientWidth 320).
    - Med mobilemulering zoomas layoutviewporten ut, och vid 320 skymde det sedan "Sök kunder", så klickflödet avbröts.
  - En realistisk e-post med bindestreck (43 tecken) bryts korrekt vid 320 och 390 (PASS).
  - Fix: `overflow-wrap:anywhere; min-width:0` på kortets h1, `.customer-row strong`, kontaktraden och vald kund i väljaren. Lägg till E2E med ett långt obrutet namn och e-post vid 320.
  - Skärmbilder: `shots/longname-card-390-m.png`, `longname-list-320-m.png`, `long-name-card-gate-1440.png`.
- **E06-QA-2 (Låg) – `%` och `_` är jokertecken i kundsökningen.**
  - Var: `src/lib/customers.ts:147`. Prisma `contains` escapar inte LIKE-tecken.
  - Repro: `q=_`, `q=%` eller `q=demo%customer` ger 32 av 32 träffar. Ingen injektion, bara fel semantik.
  - Fix: escapa `\ % _` (raw query med `ESCAPE`) och lägg till ett test.

### Info
- **E06-QA-3 (Info/Låg)** – Sökning på e-post och telefon fungerar även när kontakten är maskerad. En admin kan därmed bekräfta en dold adress via sökning (`customers.ts:144-149`). Det kräver inloggad admin. Dokumentera som avsiktligt, eller begränsa sökning på maskerade fält till exakt matchning.
- **E06-QA-4 (Info, UX)** – Flikarna "Kommande" och "Tidigare och avbokade" på kortet har `aria-current`, men ingen CSS skiljer ut den aktiva fliken (`[id]/page.tsx:95-107`, `style.css` saknar regeln).
- **E06-QA-5 (Info)** – notFound för främmande eller okänt kort svarar HTTP 200 med 404-UI (streaming). Ingen data läcker; API:t ger korrekt 404.
- **E06-QA-6 (Info, demo)** – Seeden har 0 telefonnummer, så telefonsökning kan inte visas i demon. Bara 1 ombokad seedbokning ("några ombokade" i målet).
- **E06-QA-7 (Info, assets)** – Manifestet anger ursprung (intern generator-ID, verktyget "built-in image_gen", datum, prompt-sammanfattning, användning och sha256), men har **inget explicit licensfält**.
  - Alla 7 sha256 stämmer med filerna.
  - Storlekar: porträtt 480×480 (16–18 KB), salong 1200×675 (103 KB), detaljbilder 720×480 och 720×405.
  - Visuellt granskade: inga logotyper eller varumärken syns. Porträtten är generiska vuxna; likhet med verkliga personer kan jag inte utesluta, men inget tyder på den.
- **E06-QA-8 (Info, docs)** – `docs/DEMO.md` beskriver i toppen fortfarande d7bc47f och 33 seedbokningar. Epic 06-siffrorna och regeln för seed-uppdatering finns bara i `PROJECT_STATUS.md` och `EPIC_06_PLAN.md`. Målet ber om dokumentation av hur demon uppdateras utan att manuella bokningar raderas.
- **E06-QA-9 (Info, produkt)** – Befintliga okopplade bokningar (publika eller äldre) kan inte kopplas till ett kort i efterhand, eftersom det saknas en kopplingshandling. Det är följden av den försiktiga regeln: publika kundbokningar syns aldrig på något kundkort.
- **E06-QA-10 (Info)** – Seed-backfillen (`scripts/seed-demo.ts:180-197`) kopplar bara rader som ägs av seeden via nyckel plus namn och e-post. Det är verifierat att manuella rader med identiskt namn och e-post inte kopplas.

## Codex påståenden
| # | Påstående | Status |
|---|---|---|
| 1 | Lista, sökning (telefon/e-post), paginering max 50, kort, ny bokning och återbesök | **Bekräftat** (klick + API). Med reservation för E06-QA-1 och -2. |
| 2 | Separat Customer, nullable sammansatt FK | **Bekräftat** (migration + DB) |
| 3 | Bara explicit adminvald koppling | **Bekräftat** (uppgradering + seed + publikt prov) |
| 4 | Publikt: ingen uppslagning eller koppling, svaret bara id | **Bekräftat** |
| 5 | Arkivering behåller besök; detalj → kort; flytt och avbokning behåller FK | **Bekräftat** (UI + API + MCP) |
| 6 | WorkspaceActor före uppslag; workspaceWrite före replay/version | **Bekräftat i kod** (`assertWorkspaceActor` först i varje transaktion; createBooking anropar `assertWorkspaceActor` före idempotensuppslaget). Beteendet stöds av proverna med admin i annan verksamhet. |
| 7 | Rå kontakt bara på kortet med gate PÅ och example.test; maskerad utanför; gaten oförändrad; blankt behåller | **Bekräftat** (negativt prov, HTML/JSON, `demo-access.ts` oförändrad) |
| 8 | MCP `customerId` bara med `--admin --allow-workspace`; strikt annars; example.test; inget export; 7/7 | **Bekräftat** (egna subprocessprober och 7/7 i min integrationskörning) |
| 9 | /product separat; / och /admin består; demoknapp; 5 WebP + 2 skärmbilder med manifest | **Bekräftat** (simulerad gate, inte riktig Vercel). Manifestet saknar licensfält (E06-QA-7). |
| 10 | Inga nya npm-beroenden; audit 7 moderate / 0 runtime är en upstream-blockerare | Inga nya beroenden **bekräftat**. Auditen kördes inte om (tidigare granskad i `AUDIT-REPORT-6acd2ef-minimatch.md`). |
| 11 | Seed: 32 kunder, 79 bokningar, Anna kvar, omkörning 0 | **Bekräftat** |
| 12 | Uppgradering: 37 identiska snapshots, 83 bokningar med 4 manuella, 0 överlapp | **Bekräftat och reproducerat** med egna 4 prov |
| 13 | lint/tsc/build PASS, unit 76, integration 81, kund-E2E 4/4 | **Bekräftat.** Integration är 82/82 i min körning, vilket motsvarar "81 före sista MCP-testet". |
| Uppd. | npm ci 570 paket | **Motsagt i detalj:** jag fick 571/572 (troligen plattformsskillnad i valfria beroenden). Ofarligt. |
| Uppd. | generate, lint, tsc, build PASS; unit 76/76; integration 82/82 | Codex egna körningar: **UNVERIFIED**. Mina egna gav samma resultat. |
| Uppd. | E2E prod0 och prod1 38/38, 0 restdata; dev0/dev1 körs | Codex körningar: **UNVERIFIED**. Min prod och dev gav 38/38 med 0 restdata. |
| Uppd. | Ingen kodändring efter den frysta committen | **UNVERIFIED** (jag har bara arkivet; det matchar zip-kommentaren 024796f). |

## Saknade tester och begränsningar
- Saknade tester:
  - E2E för långa obrutna namn och e-post vid 320 och 390;
  - test för escapning av sök-jokertecken;
  - test för synlig aktiv flik;
  - test för retry eller dubbelklick på "Skapa kund" via UI (API-idempotensen är verifierad).
- Begränsningar:
  - Demogaten simulerades lokalt, inte i riktig Vercel-preview.
  - Ingen fysisk iPhone/Safari; bara Chromium-emulering.
  - Den gamla demo-gate-matrisen och auditen kördes inte om (täckta tidigare).
  - 16dae9a-arkivet saknades.
  - Seed-räkningar gäller referensdagen 2026-11-12.
  - Proxy-matrisen (av/på) kördes inte. Bara `TRUST_PROXY_IP=0` i prod och dev.

## Skärmbilder (`epic06-024796f/run/shots/`)
- Bästa tre: `card-history-390.png`, `product-390.png` och `longname-card-390-m.png`.
- Övriga: list 320/390/1440, card-masked, card-gate, new-booking, booking-detail, admin-calendar och realistic-email-card 320/390.

## Städning
Servrarna :3430 och :3431 är stoppade, Postgres :55631 är stoppad och lösenordsfilen för admin är raderad (se slutmeddelandet).

---

## Addendum 1 (2026-11-12, ca 21:00 CET) – seedägarskap, inom samma granskning av 024796f

Riktat negativt prov efter Codex kodobservation. Ingen ny full matris. Originalet är oförändrat. Bara `@example.test`-data användes.

### E06-QA-11 (Medel, demo/operatörsväg) – en publik bokning med förutsagd seednyckel kopplas till ett seedkundkort – **VERIFIED (exekverat)**

**Kod:**
- `scripts/seed-demo.ts:159-165`: seednyckeln är deterministisk, `"demo-v1-" + sha256("<datum>:<tim>:<min>:<staffId>").slice(0,36)` (44 tecken).
- `scripts/seed-demo.ts:168-180`: en befintlig bokning anses "seedägd" om `idempotencyKey` = rå nyckel ELLER `sha256("admin:<actor.id>:<nyckel>")`.
- `scripts/seed-demo.ts:181-197`: om `customerId` saknas och kortet `demo-customer-*` har samma namn och e-post som snapshoten, sätts `customerId`. Seeden räknar raden som `existing` och skapar inte sin egen bokning.
- `src/app/api/bookings/route.ts:18-22`: den klientvalda `Idempotency-Key` skickas vidare.
- `src/lib/domain.ts:242-247`: den hashas bara för `actor.kind === "admin"`. För publika anrop lagras den **rått**.
- `src/lib/validation.ts:13-17`: `[A-Za-z0-9_-]{1,64}` accepterar nyckeln.

Den råa grenen finns för att seedens historiska rader skrivs direkt med rå nyckel (`seed-demo.ts:301`). Dessa rader har dock BookingEvent med `actorKind:"admin"` (`:307`, `:315`).

**Prov:**
- Egen färsk embedded PG 18.6 på :55632 (TZ Europe/Stockholm) och DB `own_demo`. Migrera + grundseed, men **ingen demo-seed** före provet. Prod-app på :3432.
- Predikterad nyckel för seedens `add(weekday(10), 09:00, demo-ui-sofia, …, index 0)` → "Mira Demo" / `demo-customer-0@example.test`: `demo-v1-03982daa202fb989b0be2c68e94608c10588`.
- **Attack:** publik `POST /api/bookings` med den nyckeln, "Mira Demo" och `demo-customer-0@example.test`, på en godtycklig ledig tid (`staff-demo`/`massage`, 2026-11-16 09:00 CET). Svar 201 `{"id"}`.
  - Lagrad nyckel: rå (`true`).
  - BookingEvent: `actorKind:"public"`, `actorId:"booking-channel"`.
- **Kontroll:** publik bokning med vanlig UUID-nyckel, "Alex Demo" och `demo-customer-1@example.test`. Svar 201.
- `BOOKING_DEMO_SEED=1 npm run demo:seed` gav `{"added":78,"existing":1,…}`.
  - **Attackbokningen fick `customerId="demo-customer-0"`** och visas därmed som besök på Mira Demos kundkort, trots att den är publik och klientstyrd.
  - **Seedens egen bokning 2026-11-23 09:00 hos Sofia skapades aldrig** (0 rader). Den publika bokningen "dedupliceras" alltså in i seedens plats.
  - **Kontrollen förblev `customerId=NULL`.** Totalt 80 bokningar, varav 79 kopplade. Kortet demo-customer-0 är oförändrat (version 1).
  - Andra körningen gav `added:0, existing:79`, alltså stabil men felaktig koppling.
- Logg: `epic06-024796f/run/logs/seed-ownership-probe.txt`.

**Bedömning:**
- Ingen automatisk koppling i den normala produktvägen. Publik bokning ensam kopplar aldrig. API- och MCP-proverna i huvudrapporten står kvar.
- Operatörens seed förvandlar däremot en spoofad klientnyckel till en kundidentitet på kortet och undertrycker en planerad seedbokning. Detta bryter mot regeln "explicit adminvald koppling".
- Utnyttjande kräver:
  - åtkomst till den skyddade previewn;
  - kännedom om seedalgoritmen (koden);
  - att operatören kör seeden efter attacken. Nya relativa datum ger nya förutsägbara nycklar vid varje senare körning.
- Svårighetsgrad: **Medel** för demo- och operatörsvägen. Inte en blockerare för en syntetisk skyddad preview, men den ska rättas i rättningsvarv 1.

**Fixriktning:**
- Godkänn backfill och `existing` bara när det finns en serverlagrad BookingEvent `action:"create"` med `actorKind:"admin"` och `actorId` = demoägarens id, samt rätt seednamnrymd. Kräv adminhash-nyckeln, eller för historiska rader en serverägd seedmarkering.
- Matcha dessutom tid, personal och tjänst mot seedens förväntade plats.
- En publikt skapad rad med kolliderande nyckel ska varken kopplas eller räknas som `existing`. Seeden ska logga den som `skipped`/`conflict`.
- Regressionstest: exakt detta prov (publik förbokning med predikterad nyckel → 0 kopplingar och tydlig konflikt).
- **Operatörsåtgärd tills vidare:** kör inte `demo:seed --preview` igen mot preview-DB:n förrän detta är rättat.

#### Codex egen reproduktion (UNVERIFIED av QA)
*Hålls åtskild från QA:s egna bevis ovan. QA har inte kört eller sett Codex DB eller loggar.*

Codex uppger en reproduktion i en separat loopback-DB `booking_epic06_seed_attack_demo` på fryst 024796f:
- Publik `createBooking` utan aktör, med `idempotencyKey = "demo-v1-" + SHA256("<datum>:9:0:demo-ui-sofia").slice(0,36)`, namn "Liv Demo" och e-post `demo-customer-10@example.test`.
- Före seed: `customerId=null`, create-event `{actorKind:"public", actorId:"booking-channel"}`.
- Efter `demo:seed`: `customerId="demo-customer-10"`, seed `added 78 / existing 1`.

**Överensstämmelse:** Codex uppgifter stämmer med QA:s egen körning. Det är samma mekanism (rå förutsagd seednyckel, publikt create-event och koppling efter seed) och samma seedräkning `added 78 / existing 1`. Bara kunden skiljer: Codex använde demo-customer-10/Liv Demo, QA demo-customer-0/Mira Demo. Detta ändrar inte QA:s bedömning.

### Codex uppgift om Windows dev0 – **UNVERIFIED**
Codex uppger att Windows dev0 inte nådde webServer-ready inom 120 s ("slow filesystem"), att `.next/dev` bevarats via namnbyte och att körningen görs om oförändrad. Jag har inte kunnat verifiera detta. Min egen Linux-dev-körning i denna granskning gav **38/38 PASS (1,5 min)** och påverkas inte.

Senare uppgifter från Codex (Windows, **UNVERIFIED av QA**):
- unit 76, integration 82 och E2E 38×4 PASS;
- dev0 tog 3,7 min efter namnbytet av cachen och dev1 2,3 min;
- inga testgränser ändrade, 0 egna restdata;
- ingen kod ändrad efter 024796f.

### Verdikt efter addendum
Rättningsvarv 1 begärs i `FIX-REQUEST-epic06-024796f.md` (E06-QA-1, -2 och -11).
**Oförändrat:** GO enbart för syntetisk skyddad preview (024796f). Pilot är fortsatt NO-GO. E06-QA-11 (Medel) läggs till listan för rättningsvarv 1, tillsammans med E06-QA-1 (Medel) och E06-QA-2 (Låg). Rekommendationen ovan gäller: ingen ny preview-seed före fix.

### Städning (addendum)
- Appen på :3432 är stoppad och Postgres på :55632 är stoppad.
- Den tillfälliga `run/work/.env` som jag skapade för provet är raderad. Bara `.env.example` finns kvar.
- Obs: den `.env` jag skapade i huvudkörningen fanns inte längre när addendumet startade. Den togs bort utanför min körning, och den innehöll bara en lokal engångshemlighet.
