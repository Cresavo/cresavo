# QA-rapport: sammanhängande salongsupplevelse (t79u)

Datum: fredag 13 november 2026, körningar 19:41–20:04 (Europe/Stockholm, CET).
Granskare: Grok Bot (oberoende QA, egen syntetisk kopia). Ingen åtkomst till original, PC, GitHub, preview, server eller moln. Inga hemligheter, `.env`, cookies, `neon-*.private.json` eller `resources.private.json` lästa.

## 1. Exakt revision och indata

| Objekt | Värde |
|---|---|
| Revision | `c0a5be64fcca17a964b3ef8335ff6851eb5797f8` (feature/coherent-salon-workspace), bas `3273934` / `05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1` |
| Brief | sha256 `9d8030c01b5fface77b0f48ebd28b34b8e9dc4b255f16587d493d141964cae4c` |
| Kodarkiv | sha256 `18974a5b36a439b21fcc666dd9386b849f152627685419ba37764d7fa760b62d`, 4 539 615 byte, zip-kommentar = c0a5be6…, 684 poster, enda env-fil `.env.example` – **OK, matchar briefen** |
| Evidensarkiv | sha256 `8bdebe708e1fd7419097fdff0ff6d17cc7c18dfdebbf86f9b43104e268756f5d`, 770 312 byte, 42 poster – **OK, matchar briefen** |
| Egna UX-prober | `ux.mjs` sha256 `0976299174cb…a5b36` · `ux2.mjs` sha256 `24e800f07066…a5a2a4` (utanför src) |
| Egna resultatloggar | `logs/ux.txt` sha256 `c03d8cb72288…cef2a8` · `logs/ux2.txt` sha256 `ae56eec4a202…4430df` |

Arbetskatalog: `/workspace/qa/booking-lab-se/coherent-c0a5be6/run/` (src = orörd kopia, work = körkopia med endast egen syntetisk `.env`, ingen källändring).

## 2. Beslut (scoped)

- **Syntetisk lokal miljö: NO-GO för merge i nuvarande skick – villkorad GO efter ett rättningsvarv.** Två Medium-fynd (CS-QA-1, CS-QA-2) är kopplade till uttalade krav i briefen: 4-lägesmatrisen 54/läge är röd i 2 av 4 lägen, och "vanlig bakåtknapp" återställer inte kalenderscroll. Inga säkerhets-, data- eller behörighetsfel hittades. Övriga fynd är Low/Info (backlogg).
- **Kundpilot: NO-GO** (oförändrat, utanför detta uppdrag).
- **Ingen GO för fysisk iPhone/Safari eller native.** Endast Playwright Chromium (headless) har körts. WebKit är inte installerat lokalt → NOT RUN.

## 3. Diff mot 05e5eaf (egen kontroll)

- 48 ändrade poster (`logs/diff-vs-05e5eaf.txt`, sha256 `2af6d9f9…63db`). Endast UI under `src/app` (admin-sidor/editorer, booking-form, layout, page, product, style.css) plus nya `admin/header-menu.tsx`, `admin/campaigns/focus.tsx`, `components/context-link.tsx`, `lib/navigation-context.ts`; tester (`tests/e2e/coherence.spec.ts`, `navigation-context.test.ts` nya; 5 e2e-specar ändrade); dokumentation.
- **Oförändrat (byte-identiskt):** `package.json`, `package-lock.json`, `prisma/schema.prisma`, alla 10 migrationer + `migration_lock.toml`. Ingen ändring i `src/app/api`, `src/lib` (utom nya `navigation-context.ts`), `src/mcp`, `scripts`, infra. → Ingen auth-/API-/domän-/datamodell-/MCP-/dependency-/infrastrukturändring. **PASS.**
- `qa-code.diff` i evidensen (34 filer) applicerar rent på 05e5eaf och matchar 34/34 kodfiler i arkivet.
- **actorKind-läsning** (`src/app/admin/bookings/[id]/page.tsx`): `bookingEvent.findMany` filtrerat på `bookingId` **och** `booking.businessId = DEMO_BUSINESS_ID`, `take: 20`, sorterat `createdAt desc, id desc`, väljer endast action/createdAt/previousStart/nextStart/actorKind. Företagsavgränsad, begränsad, ingen kunddata. **PASS.**
- **getBooking-API:** ingen fil under `src/app/api` eller domänlagret ändrad → projektion oförändrad. **PASS.**
- **Länkkontext:** `safeReturnTo` (`src/lib/navigation-context.ts`) kräver inledande `/`, avvisar `//`, backslash, kontrolltecken, >4096 tecken och tillåter endast vitlistade `/admin…`-sökvägar; `returnKey` måste vara UUID. Egna klicktester (se 5C) bekräftar.

## 4. Egna körningar vs granskad evidens vs Codex-påståenden

Miljö: färsk embedded Postgres (icke-root, `--auth=trust`, lokal loopback), TZ=Europe/Stockholm, `env -u NODE_ENV`, isolerat nätverksnamnrum (`unshare -rn`), DB-namn `*_test`/`*_demo`, portar 55850 (host-PG), 55851 (e2e-PG i netns), 55852/55853 (UX-PG/app i netns). Avvikelse: Playwright-konfigurationens fasta port 3000 användes **endast inuti det privata nätverksnamnrummet** (fast config, ingen källändring). Demoåtkomst av (`BOOKING_DEMO_ACCESS=0`), inga skydd sänkta. Syntetisk admin `qa-owner@example.test` via `npm run admin:manage -- create`.

| Kontroll | Codex-påstående | Granskad evidens | **Eget resultat** |
|---|---|---|---|
| npm ci | PASS | – | **PASS** (rc 0) |
| prisma generate / migrate 10 / seed | PASS | – | **PASS** (10 migrationer) |
| lint / tsc | PASS | full-lint/full-tsc | **PASS / PASS** |
| unit | 102 | full-unit 102 | **102/102 PASS** |
| build | PASS | ui-build | **PASS** |
| integration | 125 | full-integration 125 | **125/125 PASS** (efter: 0 kvarvarande testrader) |
| MCP-/agentworkday-kort (PW) | 13 | ui-cards 13 | **13/13 PASS** |
| E2E prod0 (prod, proxy 0) | 54/54 | matrix-e2e-prod0 54 passed | **54/54 PASS** |
| E2E prod1 | PENDING | – | **54/54 PASS** (första resultat) |
| E2E dev0 | PENDING | – | **53/54 FAIL** – `[desktop] coherence.spec.ts:9`, rad 113: scrollY förväntat 774, fick 0 (CS-QA-1) |
| E2E dev1 | PENDING | – | **53/54 FAIL** – samma test, samma rad, deterministiskt (CS-QA-1) |
| npm audit | 7 moderate dev / 0 prod, exit 1/0 | audit-*.txt | **7 moderate dev / 0 prod, rc 1/0** – stämmer |
| Städning efter E2E | – | – | 0 kvarvarande sessioner/bokningar/kunder/kampanjer i alla 4 lägen |

**Granskad (ej egen) evidens:** visual-manifest 22 bildrutor, alla sha256 OK och pixelmått stämmer mot JPEG. Revisioner: före = 05e5eaf; efter 01–07 = e576f0b, 08–12 = c0a5be6; `physicalIphone: false`. Notera: "390"-rutorna är faktiskt 375×812, "320" är 305×804 och "1280" är 1265×889 – ärligt angivet i manifestet. qa-archive.json matchar zipen; secret-scan 598 filer, 0 träffar. Codex-bilderna har inte använts som bevis för egna PASS.

## 5. Egna verkliga klicktester (Playwright Chromium, headless)

Riktiga klick, tangentbord och touch-tap mot `next start` (produktionsbuild) i netns, med boundingBox/elementFromPoint och `document.activeElement`. Bredder 320/390/1280 (höjd 844 resp. 900). Demo-seed + kapacitets-seed; idag = fre 13/11, fullbokad dag = mån 16/11, Sofias ledighet = ons 18/11.

- `ux.mjs`: 85 PASS / 17 FAIL. Av 17 FAIL är 11 probe-fel (fel slotval, väntan före hydrering, locatorfel, felaktig förväntan om 404 vs inloggning) – omkörda i `ux2.mjs`, **räknas inte som produktfel**. Kvarvarande verkliga: tap targets (3, CS-QA-5), browser Back (2, CS-QA-2), menyfokus (1, CS-QA-3).
- `ux2.mjs` (slutkörning 20:04): 58 PASS / 8 FAIL; alla 8 är verkliga observationer: browser Back 6/6 (CS-QA-2), "Behåll bokningen" fokus (CS-QA-4), Konto-meny 390 (CS-QA-3).

### A. Orientering (användningsfall 1)
PASS på alla 6 adminsidor × 3 bredder: synlig h1, `aria-current` på rätt huvudval (Översikt/Kalender/Kunder), "Salongen" markerad aktiv för Tjänster/Personal & tider/Kampanjer, ingen horisontell overflow vid 320. Primärhandlingen "Ny bokning" synlig utan scroll och inte övertäckt (top 288 px @320, 221 @390, 144 @1280). Produktsidan `/product` visar tydligt val kundbokning/arbetsyta; Konto → "Visa kundbokningen" byter läge. Inga externa/moln-länkar (K PASS).

### B. Returkontext och scroll (användningsfall 2)
- Kalender (vecka, Sofia, status=alla, mån 16/11) → bokning: `returnTo` = exakt kalenderläge. "Till kalendern" syns överst. → "Öppna kundkort" → "Till bokningen" → samma boknings-URL → "Till kalendern": **samma datum/vy/personal/status och scroll** (390: 2202→2202; 1280: 991→991). **PASS.**
- Direktlänk utan kontext → säker reserv "Till kalendern" till bokningens dag (`/admin?date=2026-11-16`). **PASS.**
- **Vanlig bakåtknapp:** URL/filter bevaras, men **scroll går till 0** (ux: 390 2202→0, 1280 991→0; ux2: 6/6 försök 2082→0, både med Playwrights standard utan bfcache och med bfcache tillåten). Kalenderlänkarna är vanliga `<a>` (helsidesladdning) och kalendern svarar `Cache-Control: no-store`, så Back laddar om dokumentet; webbläsarens egen återställning hinner inte med strömmat innehåll (även vanlig reload: 3/6 till 0). → **CS-QA-2.**

### C. Länkkontext och säkerhet
- Konstruerade `returnTo`: `//evil`, `https://evil`, `javascript:`, `data:`, URL-kodade varianter, backslash, punktsegment, `@`, unicode-snedstreck, överlånga värden → alltid endast samma origin och `/admin…`. **PASS.** "Avbryt bokning" med konstruerad `returnTo` stannar på origin.
- Annat företags kund-id visas inte även med giltig admin-session (kontext ger ingen behörighet). **PASS.**
- Oinloggad djuplänk (bokning, bokning+`returnTo=https://evil.example/`, kundkort, kampanjer+`returnTo=//evil`) → inloggningssida på origin, ingen kund-/bokningsdata. **PASS.**

### D. Kundsökning → kundkort → redigera/spara → tillbaka (användningsfall 3)
390 + 1280: återställt värde → ingen varning; verklig ändring → varning "Lämna sidan utan att spara ändringarna?", avbryt behåller ändring; **Avbryt sparar inte**, återställer fältet och fokuserar summary; Spara sparar (DB verifierad); "Till kunder" → samma sökning (`?q=Alex`) och träffar; browser Back → samma sökning. **PASS.** Kundsidans ordning: Aktuella uppgifter, Redigera, Besök, sedan Kunddataverktyg (besök före verktyg, enligt brief).

### E. Osparade ändringar, Avbryt, Stäng (användningsfall 4)
- Läsning av bokning (inkl. öppna Historik) och att bara gå in i flyttläge → ingen varning. **PASS.**
- Byta dag i flyttläge och välja ny tid → varning; avfärda behåller sidan. **PASS.**
- Flytt-"Avbryt" sparar inget (DB oförändrad) och fokuserar "Flytta". **PASS.** (Knappens etikett byter från "Avbryt flytt" till "Avbryt" när tider visas – CS-QA-6.)
- Avboka → fokus på "Behåll bokningen" **PASS**; efter "Behåll bokningen" hamnar fokus på `BODY` → **CS-QA-4.**
- Personal "Avbryt" sparar inget och går till personallistan; Tjänster "Stäng" i ny flik (ingen historik) → `/admin/services`; Ny bokning "Avbryt bokning" utan kontext → kalendern; återställt tjänstevärde → ingen varning. **PASS.**

### F. Menyer mobil/desktop
Efter hydrering, alla bredder, Salongen + Konto: Enter öppnar, panelen inom viewport och överst, Tab går in i menyn, Escape stänger och återför fokus till summary; klick utanför stänger; touch-tap utanför stänger (320/390); ingen tangentbordsfälla. **PASS.** Men menyn **förblir öppen när fokus tabbar ut**; vid 390 hamnar fokus på "Öppna kalendern" som döljs under öppen Konto-panel (WCAG 2.4.11) → **CS-QA-3** (bild `F-focus-obscured-Konto-390.png`).

### G. Översiktsförslag → kampanjutkast (användningsfall 5)
- Förslag → "Granska sparat kampanjutkast" → kampanjsidan med **rätt** utkastrubrik fokuserad och i bild; "Till översikten" → samma översikt och scroll (390: 1341→1341; 1280: 779→779). **PASS.**
- Eget utkast skapat via UI med intervall 16/11–22/11: "Verklig omfattning" och förhandsgranskning visar hela intervallet, alla tider/utförare, "inte begränsad till den avbokade tiden"; sparat utkast i DB har `validFrom=2026-11-16`, `validUntil=2026-11-22`; länken landar med fokuserad rubrik. **PASS.** Standardvärdet är dock en enda dag (CS-QA-7, Info).
- Lokala agentflöden: historiken visar kanal "Lokal agentanslutning"/"Salongens arbetsyta"; inga moln-/externa anrop eller länkar observerade. **PASS.**

### H. Kundbokning (användningsfall 6)
320/390/1280: tjänst + personal + dagknapp + tidknapp + kontaktuppgifter → sammanfattning synlig → "Bekräfta testbokning" → **"Din bokning är klar" fokuserad, i viewport och inte övertäckt**; "Boka en ny tid" fokuserar behandlingsvalet (`#service`) synligt; ingen horisontell overflow. Fullbokad dag (mån 16/11, Sofia) och ledig dag (ons 18/11) → tydligt tomt läge "Inga lediga tider…"; injicerat 500 från tillgänglighet → alert + "Försök hämta tider igen" som återhämtar; stale tid (tagen av annan klient, HTTP 201) → synligt fel "Tiden är inte längre tillgänglig… Dina uppgifter finns kvar", ingen bekräftelse (390). **PASS.**

### I. Kärnflöden admin
Skapa bokning via UI → bokningssida, status bekräftad; flytta via UI → sparad, notis fokuserad, version+1; **andra flytt på samma sida utan omladdning fungerar** (editor-nyckel nu `${id}`); avboka → status "Avbokad", notis fokuserad; Historik visar Skapad/Flyttad/Avbokad med kanal "Salongens arbetsyta". **PASS.**

## 6. UX-bedömning

- **Orientering: Bra.** Tre huvudval med `aria-current`, tydlig h1, Salongen/Konto grupperar sekundärt. Produktsidan förklarar lägena.
- **Huvudhandling: Bra.** "Ny bokning" och "Boka/Bekräfta" synliga utan scroll på 320–1280; kundbekräftelsen syns nu och får fokus (tidigare problem åtgärdat).
- **Retur: Bra via appens egna länkar, svag via webbläsarens Back.** "Till kalendern/kundkortet/kunder/översikten" återställer exakt läge och scroll och är säkra mot öppen redirect. Vanlig bakåtknapp tappar scroll (CS-QA-2), och dev-läget tappar även länkåterställningen (CS-QA-1).
- **Mobil: Godkänd med anmärkningar.** Ingen overflow vid 320, menyer fungerar med touch/Escape/outside. Meny som står kvar öppen kan dölja fokus (CS-QA-3); några mål under 24 px (CS-QA-5).
- **Förenkling som gjort något svårare:** (1) samlade sekundärval bakom "Salongen" kräver ett extra tryck till Tjänster/Personal/Kampanjer (acceptabelt, markeras aktiv); (2) flytt-avbryt byter etikett beroende på läge (CS-QA-6); (3) kampanjutkastets standardintervall = en dag, trots att texten säger att erbjudandet gäller hela perioden (CS-QA-7); (4) hjälpen "Så använder du kalendern" är ett lågt (22 px) summary-mål.

## 7. Fynd

### Blockerare (före merge, ett samlat rättningsvarv)

**CS-QA-1 – Medium – Scrollåterställning via returlänk misslyckas i dev-läge (StrictMode); 4-lägesmatrisen röd 2/4**
- Fil: `src/app/components/context-link.tsx` `RestoreReturnScroll` rad ~80–153: nyckeln tas bort (`sessionStorage.removeItem`, rad 91) och hashen strippas (`history.replaceState`, rad 92–96) **innan** scrollen faktiskt har applicerats; cleanup (rad 147–148) anropar `stopPending()`.
- Repro: egen E2E dev0 och dev1 (`next dev`, proxy 0/1): `[desktop] tests/e2e/coherence.spec.ts:9`, assertion rad 113 `scrollY` förväntat 774, fick 0. Deterministiskt i båda dev-lägena, prod0/prod1 54/54 PASS. Mobilvarianten av samma test passerar.
- Trolig orsak (kodanalys, ej instrumenterat): React StrictMode kör effekten mount→cleanup→mount; första körningen konsumerar nyckel+hash, cleanup stoppar väntande scroll, andra körningen hittar ingenting. Effekten är inte idempotent.
- Rättningsriktning: konsumera nyckel och strippa hash först när `scrollTo` faktiskt har körts (i `stop`-vid-framgång/timer), eller gör cleanup/remount idempotent (t.ex. behåll värdet i en modul-/ref-cache tills applicerat). Kör om hela 4-lägesmatrisen (54×4).

**CS-QA-2 – Medium – Vanlig bakåtknapp återställer inte kalenderns scroll**
- Fil: `src/app/components/context-link.tsx` `ContextLink` rad ~41–62 (vanlig `<a>`, helsidesladdning) i kombination med `Cache-Control: no-store` på `/admin`; `RestoreReturnScroll` hanterar bara `#return-<uuid>`.
- Repro (390×700, Playwright Chromium): logga in → `/admin?date=2026-11-16&view=week&staffId=demo-ui-sofia&status=all` → scrolla till en bokning (y≈2082) → klicka bokningen → `page.goBack()` → URL/filter korrekt men `scrollY = 0`. 6/6 försök (3 utan bfcache, 3 med bfcache tillåten) + 2/2 i första proben (390, 1280). Navigeringstyp `back_forward`.
- Briefen kräver uttryckligen "Vanlig bakåtknapp" för användningsfall 2. Begränsning: endast Playwright Chromium headless; verklig Chrome/Safari ej provad.
- Rättningsriktning: spara aktuell scroll för nuvarande historikpost vid klick/`pagehide` (t.ex. `history.replaceState({...history.state, bookingScrollY})` eller sessionStorage nyckelad per historikpost) och återställ vid `back_forward`-laddning/`pageshow` med samma vänta-på-höjd-logik; alternativt klientnavigering (Next `Link`) så att routerns scrollåterställning gäller. Lägg till ett E2E-test som använder `page.goBack()`.

### Backlogg (Low/Info)

**CS-QA-3 – Low – Öppen meny står kvar när fokus lämnar den och kan dölja fokuserat element (WCAG 2.4.11)**
- Fil: `src/app/admin/header-menu.tsx` rad 14–33 (stänger bara på `pointerdown` utanför och Escape; ingen `focusout`).
- Repro: 390 px, `/admin/overview`, fokus på "Konto", Enter, Tab förbi sista menyval → fokus på "Öppna kalendern" (top 221 px) under öppen panel (y 120–308). Bild: `run/shots/F-focus-obscured-Konto-390.png`. Salongen och 320/1280: menyn står kvar öppen men döljer inte fokus.
- Fix: stäng på `focusout` när `relatedTarget` ligger utanför `<details>`.

**CS-QA-4 – Low – "Behåll bokningen" tappar fokus till BODY**
- Fil: `src/app/admin/bookings/editor.tsx` rad ~326–331 (`onClick={() => setConfirmCancel(false)}`), knappen "Avboka" rad ~296–300 renderas om utan fokus.
- Repro: bokningssida → Avboka (fokus på "Behåll bokningen" PASS) → klicka "Behåll bokningen" → `document.activeElement = BODY`.
- Fix: återför fokus till "Avboka" (ref + `requestAnimationFrame`, som `abandonMove`).

**CS-QA-5 – Low – Interaktiva mål under 24 px (WCAG 2.5.8; avståndsundantag kan gälla delvis)**
- Varumärkeslänk "SALONG EKO Arbetsyta" 163×23 (320/390), 163×17 (1280) – `src/app/admin/header.tsx:28`; summary "Så använder du kalendern" 22 px hög – `src/app/admin/calendar.tsx:105`; kryssruta på `/admin` 18×44; "Visa arkiverade" 18×18 – `src/app/admin/customers/page.tsx:85`; dagslänk "fre 13/11" 55×16 vid 1280.
- Fix: `min-height: 24px` (helst 44 px på touch) på dessa mål eller klickbar label-yta.

**CS-QA-6 – Info – Flyttläget har två olika avbryt-etiketter**
- `editor.tsx:452` "Avbryt flytt" (utan tider) vs `editor.tsx:~546` "Avbryt" (när tider visas). Båda gör samma sak (`abandonMove`). Fix: samma etikett "Avbryt flytt".

**CS-QA-7 – Info – Kampanjutkastets standardintervall är en enda dag**
- `src/app/admin/overview/overview.tsx:142–143` (`from = until = day`). Texten förklarar korrekt att kampanjen gäller hela perioden och alla tider, och intervall sparas korrekt (16–22/11 verifierat), men standardvärdet kan uppfattas som en "lucka-kampanj". Fix: förslagsvis standard 7 dagar eller tydligare uppmaning att välja slutdatum.

**CS-QA-8 – Info – `useUnsavedChanges` jämför bara `<input>`**
- `src/app/admin/use-write.ts:~123` (`instanceof HTMLInputElement`). Nuvarande formulär använder bara inputs, så inget fel idag, men framtida `select`/`textarea` hanteras inte. Fix: inkludera `HTMLSelectElement`/`HTMLTextAreaElement` med respektive standardvärde.

**CS-QA-9 – Info – Dev-audit 7 moderate (oförändrat, 0 i produktion).**

## 8. NOT RUN

- Fysisk iPhone, Safari, iPadOS, Android, native-appar – **ej provade**; inga sådana påståenden görs.
- Playwright WebKit/Firefox – ej installerat lokalt, ej kört.
- Verklig (icke-headless) Chrome med användarprofil; skärmläsare (VoiceOver/NVDA).
- Original-repo, preview, server, moln, GitHub, verkliga e-post/SMS-kanaler.
- Dev-lägesinstrumentering av CS-QA-1 (orsaken är kodanalys + deterministisk E2E, inte stegvis loggad).
- Prestanda-/lastmätning och visuell pixeljämförelse mot Codex-bilderna.
- Video (ej krävt).

## 9. Skärmbilder (egna, `coherent-c0a5be6/run/shots/`)

`A-calendar-320.png`, `A-calendar-390.png`, `B-booking-390.png`, `B-customer-390.png`, `B-calendar-restored-390.png` (+1280), `D-customer-saved-390.png` (+1280), `F-menu-Salongen-320.png`, `F-menu-Konto-320.png`, `F-focus-obscured-Konto-390.png`, `G-campaign-focused-390.png` (+1280), `G-overview-draft-preview-1280.png`, `G-campaign-range-focused-1280.png`, `H-summary-{320,390,1280}.png`, `H-confirmed-{320,390,1280}.png`, `H-empty-390.png`, `H-error-390.png`, `H-stale-390.png`, `I-cancelled-history-390.png`, `K-product-390.png`.

## 10. Städning

Alla egna Postgres-instanser och appar stoppade; tillfälliga hemligheter (`/tmp/cssec`), sockets/tmp (`/tmp/cshost`, `/tmp/csns`, `/tmp/csux`), `work/.env`, `work/node_modules`, `work/.next` och pgdata-kataloger raderade. Endast egna körmappar berörda.
