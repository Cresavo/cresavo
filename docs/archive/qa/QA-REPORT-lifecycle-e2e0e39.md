# QA-rapport – Booking Lab kundlivscykel + lokal kapacitetsprofil (e2e0e39)

**Datum:** 2026-11-13 (Europe/Stockholm) · **Typ:** avgränsad oberoende QA, en samordnad körning · **Testare:** Grok Bot (QA) · **Scope:** `QA-BRIEF-lifecycle-e2e0e39.md` (sha256 `0c89604b0c93f36380c63e8043d2c91c93755773be4d68315f8ae3045570a96b`, läst i sin helhet)

## 1. Scope
| Fält | Värde |
|---|---|
| Revision | `e2e0e398de683823ffa962a4c669085f9800b6f2` (gren `feature/customer-lifecycle-agent-proof`, bas d2ccb6c efter 8843d06) |
| Arkiv | `/workspace/qa/booking-lab-se/lifecycle-e2e0e39/booking-lifecycle-e2e0e39.zip` |
| sha256 | `24b1c819ed72d37a7339c93b2ef9b57da29d92d624113be24963a579008311ef` (verifierad; identisk med bifogad fil) |
| Storlek / poster / kommentar | 2 610 013 byte / 423 poster / `e2e0e398de683823ffa962a4c669085f9800b6f2` (verifierat) |
| Env-filer | Endast `.env.example`. `docs/calendar-proof/private.json` finns och noteras som redan granskad syntetisk fixture; den lästes inte |
| Jämförelsebas | Min extraktion av 8843d06 (`proactive-fix1-8843d06/run/src`) |

### Hur körningen gjordes
- **Arkivet orört:** `run/src` är orörd extraktion. Efter körningen extraherades zip-filen på nytt och jämfördes med `diff -rq`, utan skillnader.
- **Körkopia:** allt kördes i `run/work` (LF-normaliserad kopia). Ingen produktkod ändrades.
- **Databaser:** egna `lc_test`, `lc_int_test`, `lc_e2e_prod_test`, `lc_demo` och `lc_upg_demo`.
- **Data och konton:** egna admins `qa-admin-{a,b,c}@example.test`. Testvakten behölls.
- **Portar:** PG 55720 (host) och 55721 (isolerat nätverksnamespace), app 3520; port 3000 bara inuti namespace. TZ=Europe/Stockholm.
- **Hemligheter:** en slumpad SESSION_SECRET skrevs till temporära `.env`-filer som raderats. Inga hemligheter lästes eller skrevs ut.
- **Inga externa åtkomster:** ingen GitHub/cloud/preview/PC, inget push/deploy, inga utskick.

### Miljöincidenter (öppet redovisade)
1. **Saknad PostgreSQL-binär.** `/workspace/qa/pg-tool/node_modules` och Playwrights webbläsarcache var borttagna från boxen, troligen vid diskstädning (79 % vid start). Matrisförsök 1 fick därför "Can't reach database" för migrate, seed och integration, och E2E kördes utan DB. Loggar: `logs/attempt1-nopg/`.
   - Min egen pg-tool installerades om med `npm ci` (embedded-postgres 18.6) och paketets symlänkskript kördes.
   - Hela matrisen kördes sedan om från början.
2. **Saknad Chromium.** E2E-försök 2 föll på att Chromium saknades (`logs/attempt2-nobrowser/`). Webbläsaren installerades om med `npx playwright install chromium` (Playwrights egen version), och E2E kördes om.
3. **Kvarlämnad process.** En webServer-process från det avbrutna försöket 1, inuti namespace, levde kvar till städningen och stoppades då. Den påverkade inte host-portarna.

## 2. Diff e2e0e39 mot 8843d06
Fillistan finns i `logs/changed-files.txt` och diffen av ändrade filer i `logs/code-mod.diff`.

- **Nytt:**
  - migration `20261113040000_customer_contact_lifecycle`;
  - `src/lib/customer-data.ts` (261 rader) och `src/app/api/admin/customers/[id]/data/route.ts`;
  - `src/app/admin/customers/data-panel.tsx`;
  - testerna `tests/customer-data.test.ts`, `tests/integration/customer-data.test.ts` (7 fall), `tests/integration/capacity-mode.test.ts` och `tests/e2e/customer-data.spec.ts` (2 fall × desktop/mobil).
- **Ändrat:**
  - `schema.prisma`: `contactRemovedAt` på Customer/Booking, modellen `CustomerDataAction`, `AdminUser @@unique(businessId,id)`.
  - `customers.ts`: borttaget kort kan inte redigeras och kontakten döljs.
  - `errors.ts`: 7 nya publika meddelanden och status 413.
  - `mcp/server.ts`: `--capacity-only`.
  - `mcp/workspace.ts`: `registerCapacityTools` har brutits ut.
  - `customers/[id]/page.tsx` och `editor.tsx`, `style.css`.
  - `playwright.config.ts`: `PORT: "3000"`.
  - `.gitignore`: `booking-lab-kunddata*.json` och `/data/`.
  - `tests/e2e/fixtures.ts`, `tests/integration/capacity.test.ts`.
  - README, AGENTS och docs.
- **Oförändrat:** de 8 tidigare migrationerna är byte-identiska. `package.json` och `package-lock.json` är identiska. `review-evidence/` finns inte i detta arkiv.

## 3. Kodgranskning (huvudpunkter)
- **Export (`customer-data.ts:111-192`):**
  - Strikt zod-schema: `limit` 1–100 (standard 100), `cursor` 1–128 tecken, `expectedToken` hex64. Cursor kräver token (rad 117).
  - Token = sha256(kund-id, kundversion, alla kopplade bokningars id/version/status/endsAt/contactRemovedAt), max 1000 (`take 1001` ger 413).
  - Cursor måste tillhöra kundens kopplade bokningar (rad 126).
  - Bokningsfälten är uttryckligen valda: inget `customerId`, `serviceId`, `emailCapKey`, `clientKey`, `idempotencyKey` eller `requestHash`. Varje lyckad sida loggas som en `CustomerDataAction`.
  - Exklusivt konfigurationslås används även för läsningen, enligt briefen.
- **Borttagning (`customer-data.ts:194-261`):**
  - Bygger på `workspaceWrite`, där auth kontrolleras före replay, med exklusivt konfigurationslås.
  - Token kontrolleras igen. Bekräftade bokningar med `endsAt > now` blockerar.
  - `updateMany` sätter namn och e-post på kopplade bokningar till fasta markörer, utan att ändra `Booking.version`. Kortet arkiveras och dess version höjs.
  - DB-CHECK skyddar markörerna.
- **Gränser:**
  - Endast `@example.test` (403 annars), med `businessId` i alla uppslag.
  - Sammansatta FK:er: `Booking(businessId,customerId)` och `CustomerDataAction(businessId,customerId|actorId)` med ON DELETE RESTRICT.
- **Konsekvenser för andra flöden:**
  - Bokningar som skapas tar ett delat konfigurationslås och `FOR SHARE` på kunden; arkiverat kort ger 409.
  - `editCustomer` nekar efter borttagning, och flytt/avbokning ändrar token. Detta ger atomicitet mot create/edit/move/cancel.
- **MCP:** `--capacity-only` kräver `--admin` och nekar `--allow-bookings`. Det finns inga kund-, export- eller kontaktverktyg.
- **Kvarvarande kontaktdata:** `Booking.emailCapKey` (rå normaliserad e-post) skrubbas inte; se LC-QA-1.

## 4. Egna körningar (VERIFIERAT)
Alla kommandon kördes med `env -u NODE_ENV`, TZ=Europe/Stockholm. Kommandon finns i `run/logs/commands.log`, resultat i `run/logs/summary.log`.

| # | Kommando | Resultat |
|---|---|---|
| 1 | `npm ci` | PASS – "added 572 packages, audited 573" |
| 2 | `npx prisma generate` | PASS – Prisma Client v7.10.1 |
| 3 | `npm run db:migrate` (9) + `npm run db:seed` (`lc_test`) | PASS |
| 4 | `npm run lint` | PASS |
| 5 | `npx tsc --noEmit` | PASS |
| 6 | `RATE_LIMIT_STORE=memory npm test` | PASS – 16 filer, **79/79** |
| 7 | `npm run build` | PASS |
| 8 | `RATE_LIMIT_STORE=postgres npm run test:integration` (färsk `lc_int_test`, 9 migreringar + seed) | PASS – 23 filer, **98/98**; restdata 0, inkl. CustomerDataAction, utom 7 hashade RateLimitBucket-rader (känd Info) |
| 9 | Prod-E2E i isolerat namespace: `RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e` (färsk `lc_e2e_prod_test`) | PASS – **46/46** (1,1 min), inkl. customer-data 2 fall × desktop/mobil; restdata 0 i alla tabeller. (Försök 1 utan DB och försök 2 utan Chromium: se §1) |
| 10 | `npm audit --json` / `npm audit --omit=dev --json` | 7 moderate (dev) / 0 |
| 11 | Beroenden/lock vs 8843d06 | Identiska |
| 12 | `upgrade.sh` (8→9 på `lc_upg_demo`) | PASS. Se detaljer nedan |
| 13 | `probes/api-lc.mjs` (HTTP + DB, `lc_demo`, app :3520, `RATE_LIMIT_STORE=postgres`) | **77 PASS / 1 FAIL** – FAIL = LC-QA-1 (verkligt fynd). Försök 1 (`logs/api-lc-attempt1.txt`) hade två probedefekter och kraschade; `lc_demo` återställdes och proben kördes om rent |
| 14 | `probes/mcp-lc.mjs` (kataloger, förbjudna anrop, startflaggor) | **27/0** |
| 15 | `probes/ui-lc.mjs` (Chromium 320/390/1440) | **52/0**. Försök 1 kraschade på en strikt `main`-selektor i det sista gamla flödet, efter att alla breddkontroller passerat. Försök 2–3 föll i proben på fixturtider; ingen UI-påverkan |
| – | dev0/dev1/prod1 E2E-lägen | NOT RUN (en körning; prod0 full svit körd) |

**Uppgraderingen (#12) i detalj:**
- 8843d06-koden körde migrate (8), db:seed, demo:seed (78 tillagda, 32 kunder, 78 kopplade bokningar) och demo:seed:capacity.
- Därefter körde e2e0e39-koden migrate (9).
- Alla 11 tabeller, jämförda på gamla kolumner, var byte-identiska efter migrering och efter omseed (demo:seed: 0 tillagda / 78 befintliga).
- De nya kolumnerna är NULL, CustomerDataAction har 0 rader, och 9 migreringar är tillämpade.
- 0 överlapp. CHECK, FK och `booking_no_overlap` finns.

### 4.1 Export (HTTP, verifierat)
- **Åtkomst:** anonymt, utan Origin eller med främmande Origin ger 403. GET ger 405.
- **Strikt schema (400):** okänt fält, `id` i body, limit 101 eller 0, felaktig token, okänd action och sträng som version.
- **200-svaret:** `Cache-Control: no-store` och `Content-Disposition: attachment; filename="booking-lab-kunddata.json"`.
- **Fält:**
  - Toppnycklar, kundnycklar och bokningsnycklar är exakta. Bokningsnycklarna saknar emailCapKey, clientKey, idempotensnyckel, requestHash, customerId och serviceId.
  - Exporten innehåller exakt kundens kopplade bokningar: inte den okopplade publika bokningen med samma e-post och inte andra kunders bokningar eller admindata.
- **Logg:** 1 `CustomerDataAction(export)` per lyckad sida. Tabellen har inga kontaktkolumner.
- **Paginering:**
  - 150 kopplade bokningar ger 100 + 50 med `nextCursor` och token. Unionen är 150 distinkta i id-ordning; limit 7 fungerar.
  - Cursor utan token ger 400, fel token 409 och främmande cursor 400.
  - Inaktualitet: en ny kopplad bokning efter sida 1 gör att sida 2 med gammal token ger 409. Exakt 3 loggrader för 3 lyckade sidor.
- **Avvisade fall:**
  - Gammal `expectedVersion` ger 409.
  - Fler än 1000 kopplade bokningar ger 413 för både export och förhandsgranskning.
  - Kund utan example.test-adress ger 403.
  - Kund i annan verksamhet ger 404.
- **Databasens FK:er:** en demobokning kopplad till en kund i annan verksamhet avvisas av FK, och en CustomerDataAction för en kund i annan verksamhet avvisas av FK.

### 4.2 Kontaktborttagning (HTTP + DB, verifierat)
- **Förhandsgranskning med kommande besök:** visar `activeVisits 1` och `canRemove false`, och svaret innehåller bara id, version, token, antal och flaggor. Borttagning ger 409 "Hantera kommande…".
- **Token följer bokningsändringar:** flytt efter förhandsgranskning (200) gör att gammal token ger 409 "Underlaget har ändrats". Avbokning efter förhandsgranskning gör också att gammal token ger 409.
- **Avvisade anrop:** utan nyckel, med `confirmed:false`, utan token eller med okänt fält ger 400. Anonymt eller utan Origin ger 403. Inget ändras av avvisade försök.
- **20 parallella anrop:**
  - 10 med samma nyckel från admin A ger 200 med identiskt resultat.
  - 5 med samma nyckel från admin B (egen nyckelrymd) och 5 från admin C med egna nycklar ger 409.
  - Exakt 1 `remove_contact`-rad. Samma nyckel med ändrad payload ger 409.
- **Auth före replay:** replay utan Origin eller anonymt ger 403. En inaktiverad admin som replayar sin egen lyckade nyckel får 403.
- **Efter borttagningen:**
  - Kortet har markörer, `phone` NULL, är arkiverat, har `contactRemovedAt` och version +1.
  - Alla kopplade bokningar har markörer och `contactRemovedAt`.
  - Bokningarnas version, status, tider, `customerId` och antal events är oförändrade, liksom `clientKey`, `idempotencyKey` och `requestHash`.
  - Kapacitetskällornas `sourceVersion` och token är oförändrade, och kapacitetslistan innehåller ingen kunddata.
  - Den andra kunden och den okopplade bokningen med samma e-post är orörda. `WorkspaceRequest.result` innehåller ingen kontaktdata.
- **Efteråt:** redigering och ny kopplad bokning ger 409. Export fungerar men visar bara skrubbade värden. Förhandsgranskning visar `canRemove false`. Kundens GET visar inte den ursprungliga kontakten.
- **FAIL:** en kopplad bokning skapad via lokal MCP behåller `emailCapKey = lc-x@example.test` (LC-QA-1).
- **Kapplöpningar (5 rundor, parallella remove/create/edit):**
  - 4 rundor: remove 200, create 409, edit 409.
  - 1 runda: remove 409, create 201, edit 200.
  - Alltid konsistent: aldrig skrubbat kort med nytt kommande besök, och kontakt återinförs aldrig.
- **DB-skydd:**
  - CHECK nekar `contactRemovedAt` utan skrubbning (Customer och Booking) och att kontakt återinförs på en skrubbad bokning.
  - FK RESTRICT nekar att kunden raderas.
  - Exklusionsconstraint finns, 0 överlapp, 9 migreringar.

### 4.3 MCP (verifierat; SDK-klient, inte AI-klient)
| Flaggor | Antal verktyg | Verktyg |
|---|---|---|
| Standard | 2 | `list_services`, `get_availability` |
| `--admin` | 13 | oförändrat mot 8843d06 |
| `--admin --allow-bookings` | 14 | oförändrat mot 8843d06 |
| `--admin --allow-workspace` | 20 | oförändrat mot 8843d06 |
| `--admin --capacity-only` | 4 | de två ovan + `list_capacity_suggestions`, `inspect_capacity_suggestion` |
| `--admin --capacity-only --allow-workspace` | 6 | + `dismiss_capacity_suggestion`, `create_capacity_campaign_draft` |

- Inget verktyg innehåller customer, export, contact eller remove.
- **Förbjudna anrop:**
  - I capacity-only nekas `list_bookings`, `create_booking`, `create_campaign_draft`, `dismiss_capacity_suggestion`, `list_workspace_bookings` och `remove_customer_contact`.
  - I capacity-only med skrivläge nekas `create_booking`, `list_bookings`, `move_booking`, `cancel_booking` och `save_service`.
  - Listan saknar kunddata, och okända argument avvisas.
- **Startflaggor:**
  - `--capacity-only`, `--admin --capacity-only --allow-bookings` och `--capacity-only --allow-workspace` ger exit 1 med `MCP_CAPACITY_CONFIG_INVALID`.
  - `--allow-workspace` ensam ger `MCP_WORKSPACE_CONFIG_INVALID`, och `--allow-bookings` ensam ger `MCP_BOOKING_CONFIG_INVALID`.
  - Kort SESSION_SECRET med `--admin --capacity-only --allow-workspace` ger `MCP_WORKSPACE_CONFIG_INVALID`.

### 4.4 Webbläsare (egen headless Chromium, prod-build)
Kontrollerat vid 320, 390 och 1440:
- Panelen "Kunddata" visas med texten "Automatisk gallring är avstängd".
- "Förbered export" visar "Del 1: 2 av totalt 2" och "sista delen". Nedladdningen heter `booking-lab-kunddata-del-1.json` och innehåller rätt kund-id, e-post och 2 bokningar.
- Borttagningstexten säger att åtgärden skiljer sig från arkivering, anger omfattningen och att historiken inte är fullständigt anonym.
- Förhandsgranskningen visar "Ett kundkort och 2 direktkopplade bokningar" och skriver inget. Bekräftelseknappen är inaktiverad tills kryssrutan markerats, är minst 40 px hög och ligger inom viewport.
- Bekräftelse skrubbar i DB. Efter omladdning visas "Kontaktuppgifterna togs bort …", utan redigering, utan borttagningsval och utan gammal kontakt.
- Ett kommande besök ger alerten "Hantera 1 kommande eller pågående…" och ingen bekräftelse.
- Ingen horisontell overflow i något läge, och inga konsolfel.

Vid 390 dessutom:
- Tangentbord: Enter öppnar export, och Tab når "Förbered export" med synlig fokus; Enter ger "Del 1: 100 av totalt 151".
- "Förbered nästa del" ger del 2 med 51 bokningar, `nextCursor` null och filnamn `del-2`.
- Gamla flöden fungerar: kundlistan, UI-redigering av en vanlig kund, samt `/admin`, `/admin/overview` och `/admin/campaigns` ger 200.

Skärmbilder i `run/shots/`:
- `export-{320,390,1440}.png`, `removal-confirm-{320,390,1440}.png`, `removed-{320,390,1440}.png`, `future-block-{320,390,1440}.png`;
- `export-part2-390.png`.

## 5. Codex-påståenden
| Påstående | Bedömning |
|---|---|
| npm ci 571 paket | **Delvis motsagt:** 572 på Linux med identisk lock (Codex `--offline`, troligen Windows). Plattformsberoende, Info |
| prisma generate 7.10.1 | **Bekräftat** |
| Sex färska DB:er (localhost:55451) med 9 migreringar + seed | **Ej verifierbart som sådant.** Själv: 4 färska DB:er med 9 migreringar + seed samt upgrade-DB, alla PASS |
| lint/tsc/build | **Bekräftat** |
| 79 unit | **Bekräftat** |
| 98 integration | **Bekräftat** |
| 46 E2E i vardera prod0/prod1/dev0/dev1 | **prod0 bekräftat (46/46)**; övriga tre lägen **ej verifierbara / NOT RUN** |
| 4 nya UI-fall desktop+mobil | **Bekräftat** (customer-data.spec 2 fall × 2 projekt i prod0) |
| 7 privacy-integrationsfall (150 export, 20 retries, race, >1000, foreign actor/stale token) | **Bekräftat** (7 `it` i `tests/integration/customer-data.test.ts`, alla PASS). Inget av dem testar `emailCapKey` efter borttagning; jfr LC-QA-1 |
| 8→9 uppgradering/omseed | **Bekräftat** |
| Audit 7/0 | **Bekräftat** |
| Oförändrad lock/beroenden | **Bekräftat** |
| 196 filer matchar testkopian | **Ej verifierbart** |
| SDK/launcher-katalog 6 verktyg | **Bekräftat på SDK-nivå** (min egen SDK-klient: 6 verktyg) |
| Faktiskt AI-klientprov | **NOT RUN** enligt Codex. Jag har inte kört något AI-klientprov, och SDK-kontrollen räknas inte som ett sådant. AI-klientdelen är **inte klar** |

## 6. Fynd
### LC-QA-1 – Medium (integritet): kontaktborttagning lämnar rå e-post i `Booking.emailCapKey` på kopplade bokningar
- **Kod:**
  - `src/lib/customer-data.ts:224-233`: `updateMany` skrubbar bara `customerName` och `customerEmail`.
  - `src/lib/domain.ts:293,362`: `emailCapKey` = gemener utan +tagg, i klartext, för icke-admin-kanaler, inklusive lokal MCP med `customerId`.
- **Dokumentation och UI:**
  - `docs/CUSTOMER_LIFECYCLE_AGENT_PLAN.md:36` kallar kvarvarande nycklar "hashade idempotens-/kvotnycklar".
  - `src/app/admin/customers/data-panel.tsx:145-147` säger att "Namn, e-post och telefon … samt kontaktkopior i kopplade bokningar ersätts".
  - `docs/ARCHITECTURE.md:26` nämner att `emailCapKey` "består", men inte att den är rå e-post.
- **Repro:**
  1. Skapa kunden `lc-x@example.test`.
  2. Kör `create_booking` med `customerId` via `--admin --allow-workspace` (lokal MCP).
  3. Gör bokningen passerad, förhandsgranska och ta bort kontakten.
  4. `select "emailCapKey" from "Booking" where "customerId"=…` ger `lc-x@example.test`.
- **Konsekvens:**
  - Efter en bekräftad kontaktborttagning finns kundens e-postadress kvar i klartext i kopplade bokningar, i motsats till UI-löftet och planens beskrivning.
  - Gäller kopplade bokningar från lokal MCP (och äldre rader som inte var adminrader). I mitt `lc_demo` hade 1 av 1 244 kopplade bokningar `emailCapKey`; webbadminens bokningar har NULL.
- **Fixriktning (välj en; ingen ny funktion):**
  - (a) Ersätt `emailCapKey` på de berörda bokningarna med en HMAC (SESSION_SECRET) av nyckeln, eller sätt NULL för rader skapade före idag. Taket räknar bara skapandedagen, och borttagning kräver inga kommande besök.
  - (b) Lagra `emailCapKey` som HMAC för alla nya bokningar, så att planens "hashade kvotnycklar" stämmer.
  - (c) Om ägaren medvetet vill behålla rå nyckel: rätta UI-texten och planen så att det uttryckligen står att normaliserad e-post finns kvar i bokningens kvotnyckel.
  - Lägg till ett integrationstest som kontrollerar att ingen kopplad bokning innehåller den ursprungliga adressen i någon kolumn efter borttagning.
- **Blockerare?** Inte för syntetisk POC (endast example.test). Ska åtgärdas innan funktionen beskrivs som kontaktborttagning för verkliga data.

### Info (backlog)
- **LC-QA-2:** alerten om kommande besök och felalerten i panelen (`data-panel.tsx:165-170, 190-194`) är ostylade `<p role="alert">` som ser ut som brödtext (`shots/future-block-390.png`). Paneltexterna i `details` saknar luft vid 320.
- **LC-QA-3:** export och förhandsgranskning tar exklusivt konfigurationslås även för läsning. Det är dokumenterat och avsett, men en export av upp till 1000 rader blockerar alla bokningsskrivningar under tiden.
- **LC-QA-4:** `requestHash` (Booking/WorkspaceRequest) är osaltad sha256 över indata som innehåller kontaktdata. Den är pseudonymiserad, inte anonym, och dokumenterad som sådan.
- **LC-QA-5:** varje "Förbered export" loggas som en åtgärd. Det finns ingen idempotens för export, vilket är dokumenterat.
- **LC-QA-6:** integrationssviten med postgres-store lämnar 7 RateLimitBucket-rader (känt sedan tidigare).
- **LC-QA-7:** `npm ci` ger 572 paket mot Codex 571 (plattform).
- Tidigare Info-fynd (PRO-QA/PRO-F1) är oförändrad backlog.

### Blockerare
Inga för syntetisk POC. LC-QA-1 är en Medium som bör rättas i fixvarv 1.

### Bedömning av kontaktomfattning och begränsningar
- Kontaktomfattningen (kortet och direktkopplade bokningar, utan e-postmatchning) är tydligt dokumenterad i UI och docs, och implementationen följer den.
- Dokumenterade begränsningar är rimliga för POC: inte anonymisering och inte ett fullständigt GDPR-utdrag; backups, loggar, nedladdade filer, kampanjrubriker och okopplade bokningar ingår inte; ingen automatisk gallring. Jag kräver inga nya framtidsfunktioner.
- Enda avvikelsen mellan dokumentation och verklighet är LC-QA-1.

## 7. Saknade tester
- `emailCapKey` (och alla kolumner) efter borttagning för kopplade bokningar skapade via MCP (LC-QA-1).
- Kapplöpning remove mot create och edit via HTTP (verifierat av mig, inte i sviten).
- CHECK-constraint mot att kontakt återinförs på en skrubbad bokning (verifierat av mig).
- Främmande verksamhet via verklig rad med annat `businessId` (FK och 404; verifierat av mig).
- MCP-startflaggan `--capacity-only --allow-workspace` utan `--admin` (verifierat av mig).

## 8. NOT RUN
- E2E-lägena dev0/dev1/prod1: en körning; prod0 full svit körd (46/46).
- Faktiskt AI-klientprov (ägarassistent via MCP): ingen AI-klient tillgänglig. Codex anger också NOT RUN, så AI-klientdelen är inte klar.
- Fysisk iPhone/Safari: ingen enhet.
- Preview/cloud/GitHub/deploy: förbjudet.
- Ny QA av oförändrade epics: utanför scope.

## 9. Harness- och probefiler (utanför src)
- Skript: `run/matrix.sh`, `run/e2e-ns.sh`, `run/upgrade.sh`.
- Prober: `run/probes/{api-lc,mcp-book,mcp-lc,mcp-old-catalogs,ui-lc}.mjs`.
- Uppgraderingsträd: `run/upg8/` (8843d06-kopia; node_modules borttagna efteråt).
- Loggar och skärmbilder: `run/logs/`, `run/shots/`.

## 10. Städning
- Appservern på :3520 och den kvarlämnade webServer-processen är stoppade. PG 55720 är stoppad, och 55721 stoppades av E2E-skriptet.
- `work/.env`, `upg8/.env` och `.qa-admin-pw` är raderade, liksom `/tmp/lcns`. `upg8/node_modules` är raderad.
- Nedladdade testfiler raderades via Playwright (`dl.delete()`).
- Inga processer eller lyssnande portar finns kvar. Disk 81 %.
- pgdata ligger kvar som lokal QA-artefakt.

## 11. Beslut
- **Syntetisk POC (lokal, @example.test): GO.** Export, kontaktborttagning, atomicitet, auth före replay, tenant-gränser, uppgradering och MCP-kataloger håller. LC-QA-1 (Medium) bör rättas i fixvarv 1 och hindrar inte syntetisk demo.
- **Pilot med riktiga kunder/data: NO-GO.** Kvar återstår:
  - LC-QA-1;
  - riktig lagringstid och rättighetsprövning;
  - backup- och leverantörskedjan;
  - de tre övriga E2E-lägena;
  - test på fysisk mobil;
  - AI-klientprovet (NOT RUN).
- En samlad FIX-REQUEST har skrivits för LC-QA-1 (fixvarv 1 av högst 2).
