# QA-rapport – Premium/English UI (initial granskning) · 5212b7a

**Revision:** `5212b7afb439ec22e36116f226b6db504cc7c5c3` (design/international-agent-ready, bas 46b261a / tidigare produkt 9840309)
**Granskare:** Grok Bot (QA, oberoende) · **Datum:** 2026-11-14 03:02–03:40 (Europe/Stockholm)

**Omfång:** enligt brief. Arbetet är gjort i en syntetisk lokal kopia:
- `@example.test`-adresser och egna syntetiska hemligheter som bara finns i min kopia;
- inbäddad Postgres som icke-root i isolerad netns med testvakt;
- TZ=Europe/Stockholm, `env -u NODE_ENV`, port 3000 endast i netns, sekventiella körningar.

Inga original, ingen preview/server/GitHub/CI, inga riktiga hemligheter/cookies och inga utskick. Detta är den initiala granskningen; högst två samlade rättningsvarv följer.

## 1. Indata och hashar

| Artefakt | sha256 | Kontroll |
|---|---|---|
| Brief | `434eae284dfa190fca768cf61619bce981b24148357617ca7bd7d3e85a09efe1` | 2612 B, läst först |
| Kodzip | `0adbb695359135e8eb4e069e040f51d24d965141562208ed056cf3ff0a496b50` | 6 088 082 B, kommentar = 5212b7a…, 711 poster, enda env-fil `.env.example`. Därtill tillåtna `docs/calendar-proof/private.json` och två `*secret-scan.json`, som bara kontrollerades till filnamn och storlek, utan att innehållet skrevs ut. |
| Codex-evidens | `670d2e4fbb660c79cbef89690fcd999c94b4db11dd738a2f04b70c169f382bdc` | 772 272 B, 10 PNG |
| Jämförelsebas 9840309 | — | `polish-f2-9840309/run/src` verifierad orörd mot c552e31e…-zip (`diff -rq` tom) |
| Källdiff `logs/premium-src.diff` | `439d75b99befb45e8f277be81f7031d3c962555cb535acf55a1db34bd2d8e717` | 6362 rader |
| Fillista `logs/diff-vs-9840309.txt` | `f8f4db0a7b6ac1283c2d27df5490690539ce9e5d68b62e7178d6850901f2d023` | 65 rader |
| Egen probe `probes/ux8.mjs` (EN/landning/endpoint) | `1e388d12030ebb72baddc115da2291896ec66e830ddceda6b1627912c922531f` | |
| Egen logg `logs/ux8.txt` | `679380f01bacaa65d022404b07947933509d2af0f461c59442c9dea15351fd92` | 139 PASS / 0 FAIL |
| Egen probe `probes/ux5.mjs` (SV-regression) / logg `logs/ux5.mjs-prod.out` | `67a0e82c…af33` / `7a03ff44…7f45` | |
| Egen probe `probes/ux9.mjs` / logg `logs/ux9.txt` | `a4594a71…7836` / `59957799…ece7` | |
| Hero-kontrast `logs/hero-contrast.txt` | `52babaef7a3d9f83839e86c301282415e99e140a1a2b759d6c8b3352ea3d2c01` | |

## 2. Beslut (avgränsat)

- **Syntetisk lokal 5212b7a: GO.** Inga fynd på nivån Medium eller högre. Fem små fynd (Low/Info) går till backlog eller kan tas i ett av de två samlade varven. Ingen FIX-REQUEST skrivs.
- **Pilot, fysisk iPhone/Safari, ägarens acceptans och merge till main: NO-GO / separat.** Inte prövat. CI, preview och deployment finns inte för denna SHA.

## 3. Avgränsad diff mot 9840309 (kodgranskning)

- **Oförändrat, byte-identiskt enligt `diff -rq`:** package.json, package-lock.json, `prisma/` (schema och 10 migrationer, verifierat 10 efter migrate), `plugins/`, MCP-runtime och skript, `src/lib/auth.ts`, sessioner och rate limit, `src/lib/domain*`, alla API-rutter utom den nya, `playwright*.config.ts` och `scripts/`.
  - **Bekräftat:** inga package-, domän-, auth-, schema-, migrations- eller MCP-ändringar.
- **Nytt:**
  - `src/app/api/locale/route.ts` (POST, same-origin, sätter cookie);
  - `src/lib/locale.ts`, `src/lib/locale-server.ts`, `src/lib/presentation-errors.ts`;
  - `src/app/components/locale-provider.tsx`;
  - `src/app/product/{relay,scene}.tsx` och `product.module.css`;
  - `public/brand/*`;
  - tester: `tests/locale*.test.ts` och `tests/e2e/locale.spec.ts`.
- **Ändrade presentationsfiler:**
  - `layout.tsx`, `page.tsx`, `booking-form.tsx`, date- och slot-picker, `context-link.tsx` (fix för returposition: `explicitDepartureKey` skyddar positionen som fångades vid klick från `pagehide`-justering);
  - admin-sidor och -editorer;
  - `workspace-polish.css`;
  - `src/lib/format.ts` och `navigation-context.ts` (endast `locale`-parameter med `sv` som standard);
  - `vitest.config.ts` (`@`-alias).
- **Locale-endpointen:**
  - `sameOrigin()` (Origin-host = Host) gäller före all parsning;
  - `parseLocale` vitlistar exakt `"en"` och `"sv"`;
  - ingen omdirigering, så ingen open-redirect-yta;
  - cookie `booking-locale`: HttpOnly, SameSite=Lax, Path=/, 1 år, Secure i production;
  - locale påverkar enbart presentation (kommentar och kod), inga affärsregler.
- **Ingen hårdkodad svenska i UI-chrome:** sökning efter å/ä/ö utanför `t()`/`text()` gav bara andraargument i flerradiga `t(...)`.

## 4. Egna körningar (förstahand, 2026-11-14)

| Steg | Resultat |
|---|---|
| npm ci / prisma generate / migrate (10) / seed / lint / tsc | PASS (03:04) |
| unit | **114/114** |
| build | PASS |
| integration | **125/125** (efterkontroll: rlb=8, övrigt 0) |
| npm audit | 7 moderate (dev), rc 1; `--omit=dev` 0, rc 0 – oförändrat |
| MCP/agentworkday-kort (netns) | **13/13** |
| E2E prod proxy0 / prod proxy1 (`E2E_PRODUCTION=1`) | **62/62 / 62/62** |
| **E2E dev proxy0 / dev proxy1** (`env -u E2E_PRODUCTION`, alltså variabeln borttagen) | **62/62 / 62/62** (158 s/159 s, ungefär dubbel tid mot prod, vilket stämmer med `next dev`) |
| Städräkning efter varje e2e | 0 i alla tabeller |
| **Egna Chromium-klick EN, landning och endpoint (ux8, prod `next start`)** | **139 PASS / 0 FAIL** efter rättade probefel |
| Egna Chromium-klick SV-regression (ux5, oförändrad 268ebdf-probe) | 149 PASS / 12 FAIL. **Alla 12 är triagerade som probe- eller föråldrade förväntningar** (se 5.9). |
| Egen hit-test och hero-kontrast (ux9 + pixelanalys) | 4/4 och pixelresultat (se PR-QA-1) |

Probefel som rättades och kördes om, utan att räknas som produktfel:
- Kontrast räknade text i stängda `<details>`, vilket gav 1.27:1 på datumväljarens dolda siffror. Filtret är tillagt.
- `innerText` missade text i stängda `<details>`, till exempel ”not verified” och historiken.
- Sökningen efter blandat språk flaggade engelsk-identiska ord (november, min) och lagrad bokningsdata.
- DB-fråga mot fel kolumn (`customerEmail`, `action`).
- Fel axelselektor (`.calendar-axis`).
- Sluttider lästes innan tiderna hade renderats.

## 5. Egna webbläsaråtgärder (emulerad Chromium/Playwright, syntetisk data – inte fysisk enhet)

### 5.1 Landning `/product` (320/390/1180/1440)
- **Rubrik och layout:** rubriken ”Your next booking. Just ask.” syns. Inget horisontellt överflöde. Inga täckta eller utanförliggande kontroller. Alla mål ≥24 px.
- **Illustrationen kontra verklig MCP:**
  - Scenen har `aria-label="Illustrated assistant booking flow"`, synlig etikett ”Illustrated demo” och texten ”… selected · no booking created”.
  - **Under all scenintegration gjordes 0 anrop** till `/api`, MCP eller tredje part (nätverkslyssnare).
  - Sidtexten innehåller inga påståenden om live-MCP. Den anger ärligt ”The scene above is an illustration”, ”… public remote MCP … are not verified” och ”No payments or messages”.
  - **Bedömning:** antyder inte falsk live-MCP.
- **Tangentbord:** Replay med Enter skriver frågan. Tidsknapparna är inaktiverade under skrivningen. Space på 16:00 ger `aria-pressed=true` och live-texten ”16:00 selected · no booking created”.
- **Reducerad rörelse:** Replay visar hela frågan direkt.
- **Fokus:** synlig på de 10 första tabbstoppen.
- **Kontrast:** sektionerna #product, #agents och footer har lägsta värde 9.18. För text över foto, se PR-QA-1.
- **Svenska valt:** `/product` förblir engelsk (`main lang="en"`, korrekt deklarerat). Se PR-QA-4.

### 5.2 Locale-endpoint (Node-fetch i netns, där Origin kan sättas)
- Begäran utan Origin, med `https://evil.example`, `null`, look-alike `localhost.evil.example` eller endast Referer ger **403 utan cookie**. En cross-site POST med `text/plain` (CSRF-försök) ger 403. GET ger 405.
- En giltig same-origin-begäran för en och sv ger 200, `Set-Cookie: booking-locale=…; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=lax`, `Cache-Control: no-store` och ingen omdirigering.
- **Ogiltiga värden ger 400 utan cookie:** `de`, `EN`, `en-US`, `<script>`, array, objekt, tom sträng, saknad nyckel, `null`, tal, 200 KB-sträng, `__proto__`, trasig JSON och CRLF-injektion.
- **Manipulerad cookie:** `de`, `xx<script>` och tom faller säkert tillbaka på Accept-Language, och värdet reflekteras inte i HTML.

### 5.3 Språkbyte bevarar utkast
- **Kundbokning 390:** behandling, person, dag, vald tid, namn och e-post fylldes i. Byte EN→SV gav svensk rubrik, och **alla värden fanns kvar**. Byte SV→EN behöll dem också.
- **Admin 1440:**
  - utkastet för ny bokning (behandling och person) behölls vid EN→SV;
  - utkastet för ny kund (namn) behölls;
  - navigering bort från ett smutsigt kundutkast gav en engelsk bekräftelse (”Leave without saving your changes?”), och avbrutet val behöll sidan och utkastet.

### 5.4 Bokning, datum, tid och bekräftelse (EN, 390)
- Inga svenska UI-strängar (lagrad data undantagen).
- Datumknapparna har engelska aria-labels, till exempel ”Wednesday 18 November 2026”.
- Tiderna visas i 24 h (09:00, 09:30 …) utan AM/PM.
- Granskningssteget visar ”Wednesday 18 November 2026 at 09:00 (Stockholm)”.
- Bekräftelsen ”Your booking is confirmed” får fokus på H2.
- Bokningen sparas som confirmed i DB. Inget överflöde.

### 5.5 Skapa, flytta och avboka, kunder, data och historik (EN, 390 och 1440)
- **Bokningsflödet:** admin skapar en bokning, Reschedule väljer tid, ”Save new time” ger ”Booking moved.”, och ”Cancel booking” öppnar dialogen ”Cancel this booking?”. ”Yes, cancel booking” ger ”Booking cancelled.”. I DB: status cancelled, version 3, händelserna create, move och cancel. Historiken visar Created, Rescheduled och Cancelled samt ”Business workspace”.
- **Tider och format:** alla tider är 24 h. Historikens tidsstämplar är numeriska ”14/11/2026, 03:18” (se PR-QA-2).
- **Utan svenska UI-strängar och utan överflöde eller täckta kontroller:** 12 adminvyer, nämligen ny bokning, flytt, detalj, kalender dag och vecka, kunder, tjänster, personal, kampanjer, översikt, kundkort och datapanel.
- **Kundsökning:** sökningen ”Mira” ger kundkort, och ”Back to customers” behåller sökningen.

### 5.6 Kapacitetsförslag, kampanj och sparat utkast (EN, 1440)
Kortet visar omfånget. Förhandsgranskning och sparande ger `data-state=draft` med en sann engelsk statustext, och CapacityDecision.outcome = draft. Granskningslänken öppnar kampanjer med utkastets H2 fokuserad.

### 5.7 Tidszon och sommartid (EN)
- 2026-03-29 och 2026-10-25 (omställningsdagar) visar ”Sunday 29 March” och ”Sunday 25 October”. Timaxeln går 08:00–17:00 i 24 h och är strikt stigande.
- Veckohuvuden: ”Mon 19/10” med flera (dag/månad).

### 5.8 Kontrast, fokus, navigation och returposition
- **Kontrast i midnattsnavigering och ljusa ytor:** 1440, 1180 och 1179 (EN), 390 och 320 (EN), 1440 och 390 (SV). Kalender inklusive navigering, öppna navigeringsmenyer, kunder, översikt och personal ger **0 fel**. Lägsta värden: 5.04 på ljusa ytor och 8.09 för menytext i mörk sidomeny.
- **Kontrast i kundbokningen:** 390 EN, 1440 EN och 320 SV ger lägsta värde 5.05 och inget överflöde.
- **Sidomeny:** ≥1180 visar en fast mörk sidomeny (`rgb(16,29,43)`, 224 px). 1179 och mindre visar en statisk ljus header.
- **Fokus:** synligt på de 16 första tabbstoppen i alla sju kombinationer. Konturen är 3 px, `rgb(122,198,243)` på mörk bakgrund och `rgb(29,102,85)` på språkväljaren.
- **Returposition (den nya fixen) i EN:**
  - 390: y 2346 återställs exakt både via ”Back to calendar” (bokning→kund→bokning→kalender) och via webbläsarens Bakåt.
  - 1440: y 1176 och x 1021 återställs exakt.

### 5.9 SV-regression med oförändrad ux5-probe (från 268ebdf)
- **85 PASS** inom meny, verktygsrad, bokningsdetalj (flytt/Avbryt/avbokning), kunder och tjänster, översikt med utkast och kundbokning. Inga produktfel.
- **De 12 FAIL är:**
  - 6 S-förväntningar från 268ebdf-designen (10 px och 82 px expansion), ersatta av F1-geometrin (24 px) som godkändes i min F1/F2-granskning;
  - 1 returtest (artefakt med horisontell scroll, redan känd från F1; ux8-returtestet är grönt);
  - 3 kontrastfel från stängda `<details>` (ux8 med filter är grönt);
  - 2 N-fel där en tom länk radbryts inline. ux9 visar att varje radlåda träffar länken.

## 6. Codex påståenden – bekräftade, motsagda och ej verifierbara

| Påstående | Status |
|---|---|
| 114 unit, 125 integration, 13 kort, lint/tsc/build PASS | **Bekräftat** av egna körningar |
| prod0 och prod1 62/62 vardera | **Bekräftat** (egna 62/62 och 62/62) |
| Dev-ben pågår; tidigare ”prod0”-märkta loggar var produktion | Mina **egna dev0 och dev1 62/62** körde med variabeln borttagen. Codex dev-loggar har jag inte sett och använder inte. Truthiness-felet finns kvar i harness, se PR-QA-3. |
| audit 7 moderate dev / 0 prod, oförändrade beroenden | **Bekräftat** (lockfilen är byte-identisk) |
| Inga package-, domän-, auth-, schema-, migrations- eller MCP-ändringar | **Bekräftat** (`diff -rq`) |
| Codex webbläsare: engelsk bokning, flytt 09:30→11:00, avbokning, historik, kampanjutkast | **Ej min klickning.** Mina egna motsvarande klick (5.4–5.6) gav samma utfall. |
| 10 evidens-PNG | Granskade som Codex-evidens (inte egen): giltiga PNG (1265 px desktop, 375 och 305 px mobil). Namnen skiljer på dev och production. Ingen manifest-sha att jämföra mot. |
| CI, preview, fysisk iPhone | **Ej verifierbart**. Finns inte för denna SHA. |

## 7. Fynd (PR-QA-)

### PR-QA-1 – Low: navigeringslänken ”Agent-ready” korsas av den ljusa spegelbågen i fotot (1440)
- **Fil:** `src/app/product/product.module.css:28-61` (`.nav`, inget skydd mot fotot) samt `relay.tsx` (hero-bilden).
- **Repro:** öppna `/product` i 1440×900. Pixelanalys med texten dold ger för ”Agent-ready”: 5:e percentilen 1.27:1 och min 1.09:1, men median 15.3:1. Den guldfärgade spegelbågen passerar genom ”r-ready” (syns i `shots/L-product-1440.png`).
- **Övriga mätningar:**
  - ”Product” och ”Log in” klarar AA på 5:e percentilen; 390 px klarar allt.
  - Rubriken 92 px har p5 4.74 och underrubriken 28 px p5 3.76. Båda klarar kravet för stor text (≥3:1).
- **Acceptans:** all hero-text klarar ≥4.5:1 (normal) eller ≥3:1 (stor) på 5:e percentilen vid 1180–1920 px.
- **Fix:** en svag mörk gradient eller scrim bakom `.nav`, eller `text-shadow` och `background-position` som håller bågen borta från navigeringen.

### PR-QA-2 – Low: numeriska datum i EN (dd/mm/yyyy) kan misstolkas
- **Fil:** `src/lib/format.ts:10-20` (`formatBookingTime`: en-GB, `month: "2-digit"`).
- **Repro:** EN, bokningsdetaljens historik visar ”14/11/2026, 03:18”. För datum där dagen är ≤12, till exempel 05/11, blir det tvetydigt för amerikanska läsare. Övriga vyer skriver ut månaden (”Thursday 19 November 2026”).
- **Acceptans:** EN-tidsstämplar är otvetydiga, till exempel ”14 Nov 2026, 03:18”.
- **Fix:** `month: "short"` när locale är `en`.

### PR-QA-3 – Low (test-harness, fanns redan): `E2E_PRODUCTION="0"` startar production
- **Fil:** `playwright.config.ts:30` (`command: process.env.E2E_PRODUCTION ? "npm run start …" : "npm run dev …"`). Oförändrat sedan 9840309.
- **Repro:** `E2E_PRODUCTION=0 npm run test:e2e` startar `next start` eftersom `"0"` är truthy. Detta är exakt det operatörsfel som Codex beskriver i VERIFICATION.
- **Acceptans:** endast `"1"` (eller `"true"`) ger production; allt annat ger dev. Gärna en loggrad om vilket serverläge som startades.
- **Fix:** `process.env.E2E_PRODUCTION === "1"`.

### PR-QA-4 – Info: språkväljaren syns på `/product` men sidan förblir engelsk
- **Fil:** `src/app/product/relay.tsx:15` (`lang="en"`) och `src/app/layout.tsx` (globala banderollen).
- **Repro:** välj Svenska på `/product`. Banderollen blir svensk men all sidtext förblir engelsk. Det är korrekt deklarerat, men det kan uppfattas som att bytet misslyckades.
- **Idé (backlog):** göm väljaren på `/product` eller visa ”This page is available in English”.

### PR-QA-5 – Info: EN-etiketter och felmeddelanden
- I omplaneringsläget står knappen ”Cancel” (avbryt flytt) nära ”Cancel booking” (`src/app/admin/bookings/editor.tsx:599` respektive `:315`). Förslag: ”Keep original time” eller ”Stop rescheduling”.
- Omappade serverfel visas i EN som ett generiskt meddelande (`src/lib/presentation-errors.ts:67-73`). Det är säkert, men detaljen går förlorad.
- Locale-endpointens JSON-fel är på svenska (`route.ts:7,15,29`). De är endast maskinläsbara.

## 8. Blockers vs backlog
- **Blockers:** inga.
- **Backlog / valfritt i varv 1–2:** PR-QA-1, PR-QA-2 och PR-QA-3 (en rad var), samt PR-QA-4 och PR-QA-5.
- **Kvar sedan tidigare:** UP-F1-QA-2, UP-F1-QA-3 och UP-QA-5 (delvis).

## 9. UX-bedömning (ärlig)
- **Landningen:** tydlig och premiumkänsla. Hero, en primär åtgärd och en ärlig illustration med tydliga avgränsningar. Det finns ingen falsk live-MCP.
- **Arbetsytan:** den mörka midnattssidomenyn med ljusa arbetsytor är lugn och läsbar.
- **Engelska:** konsekvent i chrome. Svenska data finns kvar avsiktligt.
- **Språkbyte:** bevarar utkast utan att tappa sammanhang.
- **Svagheter:** PR-QA-1 (fotot bakom navigeringen vid vissa bredder) och de mindre etikettfrågorna.

## 10. NOT RUN
- Fysisk iPhone/Safari, WebKit och Firefox.
- Skärmläsare.
- Riktig Chrome på enhet.
- CI, preview, deployment och ChatGPT-klient.
- Riktig MCP-klient (endast agentkort 13/13 med testvärd).
- UX-klick i dev-läge (dev täcks av e2e 62/62 och 62/62).
- Visuell kontroll vid >1440 px och 1920 px.
- Pilot, ägaracceptans och main-merge.

## 11. Skärmbilder
Emulerad Chromium, syntetisk data, inte fysisk enhet. Finns i `premium-5212b7a/run/shots/`:
- `L-product-1440.png`
- `L-product-390.png`
- `D-draft-kept-sv-390.png`
- `F-en-confirmation-390.png`
- `F-en-booking-detail-390.png`
- `C-calendar-1440-en.png`
- `F-en-overview-1440.png`
- `F-en-campaign-draft-1440.png`
- `L-product-sv-390.png`
- SV-regressionsbilder: `N-*`, `M-*`, `O-*`, `B-*`, `K-*`

## 12. Städning
- PG och appen är stoppade.
- Raderat: `/tmp/pr1*` (hemligheter, lösenord, sockets), `work/.env`, `work/node_modules`, `work/.next` och alla pgdata-kataloger i min körmapp.
- Behållet: loggar, prober, skärmbilder och evidens.
