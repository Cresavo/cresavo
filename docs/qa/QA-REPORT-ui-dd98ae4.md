# QA-rapport – UX-omkontroll av dd98ae4 (Booking Lab SE)

- **Granskad revision:** `dd98ae450aa3a46eff964028fb64d5e6b0870898` (gren `ui/epic05-booking-usability`, bas 967454f, produktbas f2fdac7)
- **Underlag:** `ui-dd98ae4/booking-ui-frozen.zip`, sha256 `4c2dfd9b5d03abd25fce0150b5d9724b62eaa2cfe43ea6cec4ce15d401f44e29`. Zip-kommentaren är full SHA. Båda är kontrollerade av mig.
- **Granskare:** Grok Bot (oberoende QA, enbart läsning av källkoden).
- **Datum:** 2026-11-12, cirka 17:50–18:30 CET.
- **Endast EN granskning körde.** Inga parallella granskningar.
- **Ingen åtkomst** till deploy, push, merge, GitHub-skrivning, PC, Vercel/Neon, fjärrdatabas eller hemligheter.
- **Miljö:**
  - Arbetsmapp: `ui-dd98ae4/run/`. `raw/` är orörd, `work/` och `click/` är LF-kopior.
  - Inbäddad Postgres 127.0.0.1:55601 med TZ Europe/Stockholm.
  - Endast syntetiska `@example.test`-data. Hemligheterna genererades lokalt och har inte skrivits ut.
- **Steering-tillägget (Codex/Niclas, 18:00 CET)** är inarbetat i samma granskning. Ingen ny körning startades.

## Sammanfattning och beslut

**Bunden GO för en skyddad, syntetisk preview** (Vercel Deployment Protection på, `BOOKING_DEMO_ACCESS` bara i preview, demodatabas med `_demo` och fingeravtryck). **Detta gäller inte pilot.**

- **Blockerare:** 0.
- **Backlog:** 1 Medium, 7 Low och 8 Info.
- **Demo-grinden (`POST /api/demo/session`)** höll i alla 43 egna HTTP-prober genom den riktiga wrappern i Vercel-läge.
- **Automatiserat:** hela matrisen är grön. E2E gav 32/32 i alla fyra lägen på färska databaser.
- **Ingen FIX-REQUEST** skrivs eftersom det saknas blockerare. Fixriktningar för Codex planerade layoutpaket finns i avsnitt (e).

## (a) Egen klicktest (headless Playwright mot produktionsbygge)

- **Server:** `click/` (bygge från dd98ae4), `scripts/server.mjs` på port 3400, databas `ui_click_demo`. Den är migrerad, har basseed och har fått `BOOKING_DEMO_SEED=1 npm run demo:seed`: 33 bokningar, today 2026-11-12, fullDay 11-13, partialDay 11-16, sofiaLeave 11-17.
- **Egen admin:** skapad med `npm run admin:manage -- create ux-qa-admin@example.test` (lösenord via stdin). Den gav ADMIN_COMMAND_OK. Lösenordsfilen är raderad efteråt.
- **Skript:** `run/probes/ux-*.mjs` (ligger utanför src). Resultaten finns i `run/logs/cust-*.json` och `admin-*.json`.
- **Skärmbilder:** `run/shots/` (66 st). Jag har öppnat och tittat på de bilder som citeras.
- **Varför localhost i stället för 127.0.0.1:** sessionskakan är `Secure` i produktionsläge. Chromium sparar den bara över http på `localhost`. Det är förväntat och inget fynd.

### Kundbokning (390x844, 320x844, 1440x900) – VERIFIED

| Kontroll | Resultat |
|---|---|
| Kalender (`fieldset.date-picker`, svenska aria-etiketter, t.ex. "torsdag 12 november 2026") | OK. Passerade dagar är inaktiverade, idag är markerad med `aria-current`. |
| Standarddag | Idag (12/11). Efter stängning visas "Inga lediga tider torsdag 12 november 2026. Det kan vara stängt eller fullbokat…" och knappen "Hitta nästa lediga dag" (UX-QA-11). |
| "Hitta nästa lediga dag" | Hoppar till fre 13/11 med 10 tider (Elias). |
| Byte av medarbetare efter vald tid | Vald tid nollställs (1→0). Sofia 13/11 = 0 tider. "Nästa lediga" ger mån 16/11 09:00 och sammanfattningen visar Sofia/16 nov – korrekt. |
| Sammanfattning "Din bokning" | Visar behandling, längd, pris, medarbetare samt datum och tid på svenska. |
| Nätverksfel vid bekräftelse (route abort) | "Svaret kunde inte hämtas. Försök igen med samma uppgifter. Dina uppgifter finns kvar." Namn och e-post finns kvar. Ingen engelsk text. |
| Nätverksfel vid hämtning av tider | "Tiderna kunde inte hämtas. Försök igen." plus knappen "Försök hämta tider igen". |
| Krock (två flikar, samma tid) | 409-text: "Tiden är inte tillgänglig Dina uppgifter finns kvar." (UX-QA-5). Tidslistan uppdateras och den tagna tiden försvinner. Utkastet finns kvar. |
| Bekräftelse | "Din bokning är klar … Detta är en demo. Inga mejl eller SMS skickas." Det finns ingen horisontell overflow. |
| Utkast efter omladdning | Försvinner (UX-QA-12, Info). Det enda dokumenterade löftet är att utkastet ska överleva rättningsbara fel, och det håller. |
| Tangentbord | Pilhöger/pilned flyttar fokus (12→13→20 nov) och Enter väljer. Fokusring 3 px solid rgb(29,102,85). |
| Overflow | `scrollWidth == clientWidth` i alla tre bredder. |
| Etiketter | Inga omärkta kontroller. |
| Kontrast (egen skanning, WCAG 1.4.3) | 0 avvikelser för aktiv text, både kund och admin. |
| Pekytor | Kalenderdagar är 42x44 (390), 32x44 (320) och 41/36 breda i admin (UX-QA-6). |
| Konsol | Endast förväntade `net::ERR_FAILED` från mina avsiktliga avbrott. |

### Ägarens arbetsdag (390, 320, 1440) – VERIFIED

| Flöde | Resultat |
|---|---|
| Inloggning med egen admin | OK. Headern visar "Inloggad som ux-qa-admin@example.test". |
| Kalender, dag (mobil) | Kortlista med tid, behandling, kund och medarbetare. Läsbar, ingen overflow (390/320). |
| Kalender, vecka (1440) | Bokningsblock är **41 px breda**, personalrubrikerna avkortas ("Elias (…", "Sofia (…"). Mätningen gav 24 avkortade textnoder (UX-QA-1). |
| Kalender, vecka (mobil) | Lista per dag med "Lägg in en bokning eller sök lediga tider" för tomma dagar. OK. |
| "Nästa besök" (vecka, idag) | "Nästa besök: 09:00 · Ux Testkund · Avslappnande massage" saknar datum, trots att besöket ligger 13/11 (UX-QA-2). |
| Ny bokning | Behandling/medarbetare → dag → tid → namn/e-post → "Kontrollera bokningen" → "Skapa bokning" → detaljsida. OK i alla tre bredder. Länken "Till kalendern" finns **två gånger** (UX-QA-3). |
| Flytta | Fungerar och ger "Bokningen har flyttats." (18/11 10:00 → 19/11 09:00). |
| Avboka | "Avboka bokningen?" med **första fokus på "Behåll bokningen"** (verifierat via `activeElement`). Därefter "Bokningen är avbokad." |
| Behandlingar | Formuläret är märkt. Ingen overflow. |
| Personal & tider | Ledig dag 24/11 lades till och "Medarbetaren och tiderna är sparade." visades. Tillgänglighets-API:t ger `[]` för Sofia 24/11 och tider 23/11. |
| Datumundantag | Rubriken är ISO ("2026-11-17 · Ledig") (UX-QA-10). Hjälptexten "Tryck på en dag i kalendern." visas som "Tryck På En Dag I Kalendern." (UX-QA-4). |
| Kampanjer | Förklaring av utkast, publicering och giltighet. "Publicera" finns för utkastet, och den publicerade kampanjen är märkt. OK. |
| Bokningsdetalj | Datumet visas i ISO ("2026-11-19 09:00–09:45") (UX-QA-10). Kundens e-post är maskerad "***@***", vilket var så redan i f2fdac7. |

**Mest talande egna skärmbilder:**

1. `run/shots/admin-1440-02-week.png`: oläsbar veckovy på desktop med 41 px kolumner (UX-QA-1).
2. `run/shots/cust-390-02-day-with-slots.png`: kalender och tidsgrid på mobil. Visar även "Fredag 13 November 2026" (UX-QA-4).
3. `run/shots/cust-390-04-network-error.png`: svenskt nätverksfel där utkastet finns kvar.
4. `run/shots/cust-390-08-slot-conflict.png`: krocktext utan skiljetecken (UX-QA-5).
5. `run/shots/admin-1440-03-new-booking.png`: dubbel "Till kalendern" (UX-QA-3).
6. `run/shots/admin-390-06-cancel-confirm.png` och `admin-390-12-staff-picker-capitalize.png`: avbokningsbekräftelse på mobil, och "Tryck På En Dag I Kalendern."

Inga kakor, tokens eller lösenord syns i någon bild. Inloggningsskärmarna visar tomma fält.

## (b) Bildgranskning (levererade 12 + egna)

**Spårbarhet:**
- `manifest.json` anger "before" = f2fdac7.
- "after" = "dirty usability candidate based on 967454f". De är alltså **inte bundna till dd98ae4**.
- Jag använder dem därför bara som illustration. Bevisen är mina egna tagningar från den frysta zip-filen.

**Jämförelse:**

| Bild | Egen observation |
|---|---|
| after-customer-mobile | Stämmer med mina 390-bilder: tryckbar kalender, "Inga lediga tider" idag, "Hitta nästa lediga dag", sammanfattning och demoavsnitt. Före-bilden hade ett textfält för ÅÅÅÅ-MM-DD, så detta är en tydlig förbättring. |
| after-calendar-mobile/narrow | Stämmer: kortlista utan overflow. |
| after-calendar-desktop | Stämmer med min `admin-1440-02-week.png`. **Before-calendar-desktop visar samma avkortning**, så UX-QA-1 fanns redan och är inte en regression. Den är dock fortfarande olöst. |
| after-staff-mobile | Stämmer, inklusive "Tryck På En Dag I Kalendern." och ISO-rubriken på undantag. |
| after-campaign-mobile | Där är båda kampanjerna publicerade. Hos mig är en publicerad och en utkast med "Publicera". Det beror på data, inte på ett fel. |

**Codex egna bildobservationer:**

| Codex påstående | Status | Underlag |
|---|---|---|
| Veckovy desktop med 4 personal ger ca 40 px breda personkolumner och oläsliga etiketter | **Bekräftat** | Uppmätt 41 px (`week.bookingLinkWidths`); fanns redan i f2fdac7 |
| Datum saknas för "Nästa besök" i veckovyn | **Bekräftat** | `calendar.tsx:106–116` använder `time()` utan dag |
| Dubbel länk "Till kalendern" | **Bekräftat** | `admin/bookings/new/page.tsx:30` och `admin/bookings/editor.tsx:157–160` |

## (c) Kodgranskning (diff dd98ae4 mot f2fdac7)

- **Diffens omfång:** 43 filer, varav 33 utan docs (`run/logs/dd98ae4-vs-f2fdac7.patch`).
- **Oförändrat** (byte-jämfört mot f2fdac7):
  - `prisma/` (migreringar);
  - `src/lib/domain.ts`, `src/mcp/`;
  - wrappern `scripts/server.mjs` och `scripts/client-address.mjs`;
  - `src/lib/rate-limit.ts`, `postgres-rate-limit.ts`, `admin-http.ts`, `http.ts`, `config.ts`;
  - `package-lock.json`, dependencies och devDependencies, `.vercelignore`, `vercel.json`.
- **`package.json`:** enda ändringen är skriptet `demo:seed`.
- **Inga nya beroenden.**

### Demo-grinden

**Grindlogik (`src/lib/demo-access.ts`):** alla sju villkor måste vara uppfyllda.
- `BOOKING_DEMO_ACCESS==="1"`
- runtime vercel och `VERCEL==="1"`
- `VERCEL_ENV==="preview"`
- projekt-id angivet och lika med `VERCEL_PROJECT_ID`
- fingeravtryck på 64 hex-tecken som stämmer med sha256 av host:port+sökväg i DATABASE_URL; `host`/`hostaddr` i query nekas.

Grinden läses enbart från `process.env`. Ingen request-data används.

**Route-flöde (`api/demo/session/route.ts`):**
1. grinden och same-origin kontrolleras;
2. `clientIp` (wrapperns krav);
3. befintlig admin ger ok;
4. `checkLoginAttempt` (login-bucket);
5. inloggning som demoaktör, endast om aktören är aktiv och tillhör `businessId` demo.

`Cache-Control: no-store` sätts.

**`auth.ts`:** `login()` (rad 53) och `getAdminContext()` (rad 121) nekar demo-e-posten när grinden är av. Vanliga admins påverkas inte.

**Egna HTTP-prober genom den riktiga wrappern i Vercel-läge** (`run/probes/p-demo-gate.mjs`, logg `run/logs/p-demo-gate.json`, **43/43 PASS**):

- **Grinden på:**
  - utan Origin → 403;
  - främmande Origin → 403;
  - utan `x-real-ip` → 400 (wrappern);
  - same-origin → 200 med kaka och `no-store`;
  - staff-API med kakan → 200;
  - upprepad POST med kakan → 200, ingen ny session;
  - lösenordsinloggning med fel lösenord → 401;
  - GET → 405.
- **Grinden av, varje villkor fel för sig** (ACCESS=0/saknas/"true", VERCEL_ENV=production/development/saknas, projekt-id fel/båda tomma, fingeravtryck fel/versaler, DATABASE_URL till annan demodatabas, runtime local):
  - POST → 403 utan kaka;
  - kopierad demokaka mot admin-API → 403 (samma som utan kaka).
- **Injektion med grinden av (production):**
  - headers (`x-vercel-env`, `x-booking-demo-access`, `x-vercel-project-id`, `x-forwarded-host`, `x-booking-demo-database`) → 403;
  - JSON-body med flaggor → 403;
  - query-parametrar → 403;
  - startsidan visar ingen demoknapp.
- **Grinden på igen:** den gamla kopierade kakan **lever igen (200)** (UX-QA-7). Efter utloggning → 403 även med grinden på.
- **Begränsare:** inaktiv demoaktör från samma IP ger `403×5 → 429`. Samma IP är fortfarande 429 efter återaktivering, medan en annan IP får 200. Login-bucketen gäller alltså.

**Seed-skydd:**
- utan `BOOKING_DEMO_SEED=1` → avbryts;
- databas utan `_demo` → avbryts;
- `--preview` med VERCEL_ENV=production → `DEMO_SEED_PREVIEW_REFUSED`;
- `--preview` med grinden på → 27 tillagda;
- en andra lokal körning → `added 0 / existing 33` (idempotent, `noDeletion`).

Seedet loggar bara `DEMO_SEED_FAILED` utan orsak (UX-QA-15, Info). Orsaken hittade jag med en separat felsökningskopia: `RATE_LIMIT_CONFIG_INVALID` när `RATE_LIMIT_STORE=postgres` saknas.

### Testtäckning

**`tests/demo-access.test.ts`** är bra på enhetsnivå: varje variabel, production/development/local, annat projekt eller annan databas, `?HOST=` och fingeravtryck oberoende av lösenord.

**`tests/integration/demo-session.test.ts`** täcker:
- default av, production och främmande/tom origin → 403 utan kaka;
- återanvänd session;
- att `getAdminContext` ger null vid ACCESS=0, production och fel fingeravtryck;
- att kakan är död efter utloggning;
- saknad eller inaktiv aktör → 403;
- att vanlig admin inte påverkas.

**Luckor (UX-QA-8):**
- inget test på HTTP-nivå genom wrappern (`x-real-ip`/400);
- inget test som visar att headers, body eller query **inte** kan slå på grinden;
- inget test av återupplivning när grinden slås på igen;
- inget test av begränsaren på demoroute.

Mina prober täcker dessa luckor nu, men de finns inte i repot.

### Hydreringsracet i tangentbordstestet (steering punkt 1)

- **Produktkoden:** `booking-form.tsx:25–31,141,162,191,294`. Formuläret och datumväljaren är `disabled` tills hydreringen är klar. Så var det **redan i f2fdac7**, så det är ingen regression.
- **Testet:** `tests/e2e/usability.spec.ts:55` anropar `selected.focus()` utan att vänta på `toBeEnabled`.

## (d) Automatiserade tester (egen körning, färska databaser)

| Steg | Resultat |
|---|---|
| `npm ci` | rc=0, "added 571 packages, audited 572" |
| prisma generate / migrate / seed | rc=0 |
| lint | rc=0 |
| tsc | rc=0 |
| unit | **75/75** |
| integration | **75/75** (fokuskörning `preview-rate-limit` 6/6) |
| build | rc=0 |
| E2E dev0 (dev, utan proxy) | **32/32**, 1,1 min, färsk databas `ui_e2e_dev0_test` |
| E2E dev1 (dev, proxy) | **32/32** |
| E2E prod0 (produktion, utan proxy) | **32/32**, 36,7 s |
| E2E prod1 (produktion, proxy) | **32/32**, 38,0 s |
| RateLimitBucket efter respektive E2E-läge | 30 inserts, 0 kvarvarande rader (rensning OK) |
| `npm audit` (full) | 7 moderate / 0 high / 0 critical (kedjan @typescript-eslint/* + minimatch, enbart dev) |
| `npm audit --omit=dev` | 0 |
| Egna demo-grindprober | 43/43 |
| Egen hydreringsprobe | Racet reproducerat utan väntan; passerar med väntan |

**NOT RUN:**
- fysisk iPhone (Safari/VoiceOver);
- skärmläsare (NVDA/VoiceOver);
- riktig Vercel-preview och molnperimetern (Codex ansvar);
- Windows-värd;
- Firefox/WebKit (endast Chromium).

## Fynd

**Blockerare:** inga.

**Backlog:**

| ID | Allvar | Fynd | Fil:rad | Repro | Fixriktning | Status |
|---|---|---|---|---|---|---|
| UX-QA-1 | Medium | Veckovyn på desktop är oläslig med 4 personal: block 41 px, rubriker avkortade ("Elias (…", "Fot…"). Fanns redan i f2fdac7. | `src/app/admin/calendar.tsx:244` (`minmax(135px,1fr)` per dag delat på personalkolumner), `style.css:348–360` (`.staff-headings`) | `/admin?date=2026-11-16&view=week` i 1440x900 | Se (e): minsta läsbara bredd per personalkolumn, scroll bara i kalenderytan, full text i `aria-label`/`title`. | VERIFIED |
| UX-QA-2 | Low | "Nästa besök" i veckovyn visar bara klockslag, även när besöket är en annan dag. | `src/app/admin/calendar.tsx:106–116` | Vecka idag efter stängning ger "Nästa besök: 09:00 …" fast besöket är 13/11 | Visa dag när den inte är idag, t.ex. "fre 13/11 09:00". | VERIFIED |
| UX-QA-3 | Low | Dubbel "Till kalendern" på Ny bokning. | `src/app/admin/bookings/new/page.tsx:30` och `bookings/editor.tsx:157–160` | `/admin/bookings/new` | Ta bort länken i `new/page.tsx:30`; editorns länk räcker. | VERIFIED |
| UX-QA-4 | Low | `text-transform: capitalize` bryter mot svensk stavning: "Tryck På En Dag I Kalendern.", "Fredag 13 November 2026", "Måndag 16 November", "16 Nov.–22 Nov.". | `src/app/style.css:924–928` (`.chosen-day`), `:871`, `:281`, `:346`, `:609`; text i `components/date-picker.tsx:176–177` | Personal & tider → datumväljare; kundens valda dag | Ta bort `capitalize` och sätt versal bara på första bokstaven (JS eller `::first-letter`). | VERIFIED |
| UX-QA-5 | Low | Krocktexten saknar skiljetecken och vägledning: "Tiden är inte tillgänglig Dina uppgifter finns kvar." | `src/app/booking-form.tsx:278`; meddelanden i `src/lib/domain.ts:188`, `booking-mutations.ts:163` | Två flikar bokar samma tid | Lägg till punkt och "Välj en annan tid." Ändra i UI-lagret och låt domänen vara orörd. | VERIFIED |
| UX-QA-6 | Low | Pekytor är under 44 px i bredd: kalenderdagar 42 (390), 32 (320), 41/36 (admin). Dessutom summary "Skriv datum med tangentbord" 38 px hög, "Så använder du kalendern" 22 px, logolänken 17 px och veckodagslänkar 16 px höga. WCAG 2.5.8 (24 px) är uppfyllt, men den interna 44-pixelsregeln inte. | `style.css:880` (7-kolumnsgrid), header/summary-stilar | `run/logs/cust-320.json` (`small`) | Minska gridgap eller padding vid ≤360 px och ge summary/länkar `min-height:44px`. | VERIFIED |
| UX-QA-7 | Low (härdning) | Demosessioner återkallas inte när grinden stängs. Slås grinden på igen inom 8 h lever en kopierad kaka igen. | `src/lib/auth.ts:53,121` | p-demo-gate D: grinden av → 403, grinden på → 200 med samma kaka | När `getAdminContext` ser demo-e-post med grinden av: sätt `revokedAt` (revoke i stället för bara null). Alternativt: bind sessionen till grindens fingeravtryck/epok eller öka `credentialVersion` vid `demo:seed --preview`. | VERIFIED |
| UX-QA-8 | Low | Luckor i testtäckningen för demo-grinden (se c). | `tests/integration/demo-session.test.ts`, `tests/demo-access.test.ts` | – | Lägg till: injektion via headers/body/query ger 403; återupplivning (eller revoke-test efter UX-QA-7); limiter med 429; ett HTTP-test genom wrappern. | VERIFIED (kodläsning) |
| UX-QA-9 | Info (TEST-flake, ej produktfel) | Tangentbordstestet fokuserar en inaktiverad knapp före hydrering. Det leder till fokus på body, att Enter ignoreras och att datumet blir kvar. | `tests/e2e/usability.spec.ts:55–58` | Egen probe med 4 s fördröjda JS-chunks: datum 2026-11-12 (FAIL); med `toBeEnabled` + `toBeFocused` → 2026-11-13 (PASS). Inte reproducerat i min dev0 (32/32). | Codex test-only-väntan (`toBeEnabled` före focus, `toBeFocused` på nästa dag före Enter) är **rätt fix**. Användarpåverkan är liten: formuläret är grått under hydreringen, utan indikator. Fanns redan i f2fdac7. Valfritt: kort "Laddar…" eller `aria-busy`. | VERIFIED |
| UX-QA-10 | Low | ISO-datum i adminvyn ("2026-11-19 09:00–09:45", "2026-11-17 · Ledig") trots svensk läsbar form i övrigt. | `admin/bookings/editor.tsx:182` (`formatBookingTime`), `admin/staff/editor.tsx:245` | Bokningsdetalj; Personal & tider | Använd samma `readableDay`-format. | VERIFIED |
| UX-QA-11 | Info | Kunden landar på idag även när det inte finns tider (t.ex. efter stängning). | `booking-form.tsx` (standarddatum) | Ladda `/` efter kl. 17 | Överväg att automatiskt välja nästa lediga dag eller fokusera knappen. Nuvarande lösning är tydlig. | VERIFIED |
| UX-QA-12 | Info | Kontaktutkastet sparas inte över omladdning (inte utlovat; sparas vid fel). | `booking-form.tsx` | Fyll i och ladda om | Valfritt: `sessionStorage`. | VERIFIED |
| UX-QA-13 | Info | Basseed plus demoseed ger nästan dubbla tjänster ("Massage"/"Avslappnande massage", "Fotvård"/"Fotvård – demo") och 4 personal (Anna/Erik utan demobokningar). Det förvärrar UX-QA-1. Tjänstevalet avkortas på 390 ("450,0"). | `prisma`-seed och `scripts/seed-demo.ts` | `/` | I preview: inaktivera bastjänster/-personal i demodatabasen eller använd bara demoseed. | VERIFIED |
| UX-QA-14 | Info | Inbyggd e-postvalidering visas på webbläsarens språk (engelska i headless). Det är inte appens text. | – | Ogiltig e-post | Ingen åtgärd, eller egen svensk validering. | VERIFIED |
| UX-QA-15 | Info | `demo:seed` sväljer felorsaken (bara `DEMO_SEED_FAILED`). | `scripts/seed-demo.ts:344–347` | `--preview` utan `RATE_LIMIT_STORE=postgres` | Logga en ofarlig felkod (t.ex. `e.message` om den börjar med `DEMO_`/`RATE_LIMIT_`). | VERIFIED |
| UX-QA-16 | Info | De levererade "after"-bilderna är märkta som "dirty candidate" och är inte bundna till dd98ae4. | `comparison/manifest.json` | – | Ta framtida bilder från den frysta SHA:n och skriv in SHA:n i manifestet. | VERIFIED |

## (e) Synpunkter på Codex planerade layoutfix (steering punkt 2)

Jag stöder paketet. Följande gäller:

1. **Minsta läsbara bredd per personalkolumn:**
   - Sätt bredden till ca 96–120 px per person: `minmax(calc(var(--staff-count)*104px),1fr)` per dag i stället för fasta 135 px.
   - Med 4 personal × 7 dagar blir det ca 2 900 px. **Scroll inom kalenderytan** krävs då.
   - Behåll tidskolumn och dag-/personalrubriker sticky.
   - Ge scrollcontainern `tabindex="0"`, `role="region"` och `aria-label="Veckokalender"` så att den går att scrolla med tangentbord.
   - Sidan själv får inte få overflow. E2E bör mäta `document.scrollWidth == innerWidth` i 1440 och att containern scrollar.
2. **Alternativ eller komplement:** när personalfiltret är "Alla" och det finns fler än 2 personer, rita veckan per dag utan personalkolumner (en kolumn med personens namn i blocket), eller föreslå filtrering. Ge varje block full text i `aria-label`/`title` även när den avkortas visuellt.
3. **"Nästa besök":** inkludera dag när den skiljer sig från idag (UX-QA-2).
4. **"Till kalendern":** ta bort dubbletten i `new/page.tsx` (UX-QA-3).
5. **Hjälp för filter och dagvy:** okej, men håll den kort i `details`.
6. **Gärna i samma paket** (kosmetik med låg risk): UX-QA-4 (capitalize), UX-QA-5 (krocktext), UX-QA-10 (ISO-datum).
7. **UX-QA-7 (revoke)** bör tas separat med ett eget integrationstest, eftersom det berör `auth.ts`. Det är inte ett krav för en skyddad preview.

Ny granskning av fixpaketet: riktad omkontroll av berörda vyer (1440/390/320), hela E2E-matrisen och demo-grindproberna.

## Codex påståenden

| Påstående | Klassning | Mitt underlag |
|---|---|---|
| npm ci 570 paket | **Motsagt (avvikelse)** | 571 added / 572 audited på Linux. Skillnaden beror sannolikt på plattformsberoende optional-paket; Windows har inte verifierats. |
| lint / tsc / build PASS | Bekräftat | rc=0 |
| unit 75/75 | Bekräftat | 75/75 |
| integration 75/75 | Bekräftat | 75/75 |
| E2E prod/no-proxy 32/32 | Bekräftat | prod0 32/32 |
| Övriga tre lägen (pågick) | Bekräftat i min körning | dev0, dev1 och prod1 32/32 vardera |
| Första körningen 30/32 (engelskt nätverksfel + tvetydig alert-locator), båda fixade | Delvis bekräftat / ej verifierbart | Svenska nätverksfeltexter är bekräftade. Den historiska körningen går inte att verifiera. |
| Steering: dev0 30/32 orsakat av hydreringsrace i tangentbordstestet; test-only-fix ger 32/32 | Mekanismen bekräftad; dev0-felet ej reproducerat | Probe: FAIL utan väntan, PASS med väntan. Min dev0 på dd98ae4 gav 32/32. Codex nya 32/32-körningar har jag inte kunnat verifiera. |
| Ingen kod utöver test-only-väntan ändrad efter frysningen | Ej verifierbart | Jag har bara den frysta zip-filen |
| audit 7 moderate / 0 high, runtime 0 | Bekräftat | Full 7 moderate; `--omit=dev` 0 |
| Inga nya beroenden; migreringar, domän och MCP oförändrade | Bekräftat | Byte-jämförelse mot f2fdac7 (lock, deps, prisma, domain.ts, src/mcp, wrapper, rate-limit) |
| Bildobservationer (40 px kolumner, "Nästa besök" utan datum, dubbel "Till kalendern") | Bekräftat | Se (b) |

## Städning

- Servrar på 3400/3401 och Postgres 55601 är stoppade. Inga lyssnare eller processer finns kvar (kontrollerat med `ss`/`pgrep`).
- Den tillfälliga lösenordsfilen för den lokala admin är raderad.
- Originalrepot, Codex arbetskopior och PC:n är inte rörda.
- Probefiler finns bara i `run/probes/` och `run/click/qa-probes/` (felsökningskopia av seed), alltså utanför `src` och märkta som probes.
