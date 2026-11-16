# QA-rapport: riktad återkontroll, sammanhängande salongsupplevelse – rättningsvarv 1 av 2 (t81u)

Datum: fredag 13 november 2026, körningar 20:49–21:30 (Europe/Stockholm, CET).
Granskare: Grok Bot (oberoende QA, egen syntetisk kopia). Ingen åtkomst till original, PC, GitHub, preview, server eller moln. Inga hemligheter, `.env` (utöver egen syntetisk), cookies, `neon-*.private.json` eller `resources.private.json` lästa.

## 1. Exakt revision och indata

| Objekt | Värde |
|---|---|
| Revision | `51d54d4696dd5fee51449acbd096f8529fbd3c5c` (feature/coherent-salon-workspace), föregående QA `c0a5be64fcca17a964b3ef8335ff6851eb5797f8` |
| Brief | sha256 `9952406cbf0a410ad055680e57ccd72995eb584e68f3f418f750c7a33ba398f3` |
| Kodarkiv | sha256 `9da224cfa16a582a49605046cd7067cea3e005408b73851d5a818082031b6562`, 4 552 730 byte, zip-kommentar = 51d54d4…, 686 poster, enda env-fil `.env.example` – **OK** |
| Evidensarkiv | sha256 `d340cca408459db106e9074e5cd789f66e236f9650350e0c5063c4b173576a1f`, 915 127 byte, 55 poster – **OK** |
| Egna prober | `probes/ux3.mjs` sha256 `171bb374c820…15c50e`, `probes/ux4.mjs` sha256 `bcebfa04ac84…57f3ef` (utanför src) |
| Egna resultat | `logs/ux3-prod.txt` `0f990173…041453`, `logs/ux3-dev.txt` `b4bd8ef8…e6307b`, `logs/ux4-prod.txt` `d1804588…c11d` |
| Diff | `logs/diff-vs-c0a5be6.txt` `abb15b69…1144`, `logs/f1-src.diff` `9dcd6731…e47a`, `logs/f1-test.diff` `aac7e5f1…db7` |

Arbetskatalog: `/workspace/qa/booking-lab-se/coherent-f1-51d54d4/run/`.

## 2. Beslut (scoped)

- **Syntetisk lokal miljö: GO** för rättningsvarv 1. CS-QA-1 till CS-QA-5 är **stängda** med egna körningar och klick. Det finns inga kvarstående Medium+ eller briefbrytande fel. Ett nytt Low-fynd och ett nytt Info-fynd läggs i backloggen. Därför skrivs ingen fix request.
- **Kundpilot: NO-GO** (oförändrat).
- **Ingen GO för fysisk iPhone, Safari eller native.** Alla klick är gjorda i emulerad Playwright Chromium (headless) med viewport 320/390/1280. WebKit är inte installerat → NOT RUN.

## 3. Avgränsad diff mot c0a5be6 (egen kontroll)

Jämförelsen gjordes fil för fil mellan min tidigare orörda kopia av c0a5be6 och den nya kopian.
- **Ändrade filer (6 kod/test):**
  - `src/app/admin/bookings/editor.tsx`
  - `src/app/admin/calendar.tsx` (endast attributet `data-calendar-scroll`)
  - `src/app/admin/header-menu.tsx`
  - `src/app/components/context-link.tsx`
  - `src/app/style.css`
  - `tests/e2e/coherence.spec.ts`
- **Nya filer:** `docs/qa/QA-REPORT-coherent-c0a5be6.md` och `docs/qa/FIX-REQUEST-coherent-c0a5be6.md`. Innehållet är identiskt med mina original (sha256 `5159c5f2…36e8` resp. `385ba7e1…bcc0`) efter normalisering av CRLF→LF. Endast radsluten skiljer.
- **Byte-identiska:** allt annat, bland annat domän, auth, API (`src/app/api`), `src/lib`, `src/mcp`, `scripts`, `prisma/schema.prisma`, 10 migrationer + lock, `package.json` och `package-lock.json`. **PASS.**
- **Testdiffen innehåller endast tillägg.** Den lägger till Behåll-fokus, vanlig Bakåt med y-precision 0, veckovy med båda axlarna (x>0 krävs) via både returlänk och Bakåt, samt Tab ut ur Konto. Inga assertions är borttagna eller sänkta och inga timeouter är höjda.

### Ny historiklagring (granskad i kod och testad i browser)

`context-link.tsx`:
- Nyckeln är en opak UUID i `history.state.bookingScrollKey`. Den valideras med regex innan den återanvänds (rad 13–19).
- `sessionStorage` `booking-return:<uuid>` lagrar enbart `{y, calendarX, at}` (rad 20–41).
- Gränser: högst 20 poster och 30 minuters livslängd.
- Återställning sker först när innehållet har plats. Avsikten konsumeras först efter `apply` eller avbrott (`finish`, rad 131).
- wheel, touchstart och keydown avbryter väntan. En reservtimer på 3 s finns.

Egen kontroll av lagringen:
- **Innehåll:** efter nästlade flöden (320/390/1280, prod och dev) har alla nycklar formen `booking-return:<uuid>` och alla värden endast `y/calendarX/at`. Inga URL:er, e-postadresser eller namn finns. Hashen är strippad efter återgång. **PASS.**
- **Tak:** efter 25 kontextnavigeringar finns 19 poster (≤20), och varje värde är högst 42 tecken. **PASS.**
- **Utgångna poster:** en post äldre än 30 min appliceras inte. **PASS.**
- **Missbruk:** jag provade fyra konstruerade varianter:
  - `#return-<uuid>` med y/x = 1e308;
  - ogiltiga typer plus ett extra fält `url:"https://evil.example"`;
  - 200 000 tecken skräp-JSON;
  - en nyckel som inte är UUID.

  I alla fall stannar sidan på samma origin på `/admin`, kalendern är användbar och inga okontrollerade sidfel uppstår. **PASS.**
- **Konstruerade parametrar:** `returnKey` (`https://evil.example`, `javascript:alert(1)`, giltig UUID) kombinerat med `returnTo=//evil.example/x` ger alltid en tillbaka-länk till samma origin under `/admin`. **PASS.** Lagringen skapar ingen omdirigering; `replaceState` kan bara skriva sökväg på samma origin.
- **Begränsningar:** se CS-F1-QA-1 (gallringsordning) och CS-F1-QA-2 (skräppost blockerar ny lagring).

## 4. Egna körningar vs granskad evidens vs Codex-påståenden

Miljö:
- färsk embedded Postgres som icke-root (uid 1000), TZ=Europe/Stockholm, `env -u NODE_ENV`;
- E2E och UX i isolerat nätverksnamnrum (`unshare -rn`), DB-namn `cf_*_test` / `cf_ux_demo`;
- portar 55860 (värd-PG), 55861 (E2E-PG), 55862/55863 (UX-PG/app) och 55864 (lokal hjälpserver för ordningsprov).

Port 3000 användes endast inuti nätverksnamnrummet på grund av Playwright-konfigurationens fasta port. Demoåtkomsten var av och inga skydd sänktes. Syntetisk admin `qa-owner@example.test` skapades via `admin:manage`.

| Kontroll | Codex-påstående | Granskad evidens | **Eget resultat** |
|---|---|---|---|
| npm ci / generate / migrate / seed | PASS | full-generate | **PASS** (10 migrationer) |
| lint / tsc | PASS | full-lint/full-tsc | **PASS / PASS** |
| unit | 102 | full-unit 102 | **102/102** |
| integration | 125 | full-integration 125 | **125/125** |
| MCP-kort | 13 | ui-cards 13 | **13/13** |
| build | PASS | ui-build | **PASS** |
| audit | 7 moderate dev exit 1, omit-dev 0 exit 0 | audit-*.txt | **7 moderate (0 high/critical) rc 1; omit-dev 0 rc 0** |
| E2E prod0 / prod1 | 54/54 / 54/54 | matrix-e2e-prod0/1 | **54/54 / 54/54** |
| E2E dev0 / dev1 | 54/54 / 54/54 | matrix-e2e-dev0/1 | **54/54 / 54/54** (tidigare 53/54) |
| coherence.spec.ts i dev, upprepad | – | focused-dev 6/6 | **72/72**: dev0 3 körningar × `--repeat-each=3` (18/18 ×3) + dev1 1 × 18/18. Inga fel, ingen flakighet observerad |
| Städning | 0 kvar i 6 DB | f1-cleanup-read.json (alla 0) | **0** kvarvarande bokningar/sessioner/kampanjer/kortförsök m.m. efter varje E2E-körning (integration: 8 rate-limit-hinkar, som tidigare) |

**Granskad (ej egen) evidens:**
- `f1-visual-manifest.json`: 5 bilder från 51d54d4, sha256 OK och pixelmått stämmer (375×812, 1 × 305×804), `physicalIphone: false`, "own Computer Use, IAB Chromium, production build". `ownBrowserBack` y 671→671.
- Gamla `visual-manifest.json`: 22 bilder, alla sha256 OK, märkta c0a5be6/e576 (ej 51d54d4).
- `matrix-results.json`: 4 × exit 0.
- `f1-startup-timeout.txt`: dev-servern fick timeout efter 120 s, ingen assertion kördes.
- `f1-focused-navigation-race.txt`: 1 failed / 5 passed (navigeringsracet i testet), redovisat öppet.
- secret-scan: 600 filer, 0 träffar.
- qa-archive.json matchar kodzipen.

Jag har inte godkänt något utifrån dessa siffror eller bilder.

## 5. Egna verkliga klick (emulerad Chromium, prod `next start` och dev `next dev`)

- **Prod:** `ux3.mjs` gav **91 PASS / 0 FAIL**.
  - Första körningen gav 89/2. Båda felen var ett probefel: init-skriptet för det forcerade väntetestet kördes innan `<html>` fanns. Felet rättades och proben kördes om.
- **Dev:** `ux3.mjs` gav **91 PASS / 0 FAIL**.
  - Ett tidigare försök avbröts av verktygsmiljön. Ett försök därefter hittade inte appen eftersom den avbrutna körningens dev-server låg kvar. Den stoppades och körningen gjordes om från början. Inget av detta räknas som produktfel.
- **Gallring:** `ux4.mjs` gav 3/4 (se CS-F1-QA-1).

### CS-QA-1 – Returlänkens scroll i dev och prod: **STÄNGD**
- Flödet var kalender → bokning → kundkort → bokning → kundkort → bokning → "Till kalendern" (två nästlade varv).
- Resultatet är exakt URL och exakt position, på alla tre bredder och i båda lägena:

| Bredd | Prod | Dev |
|---|---|---|
| 320 | y 2249→2249 | y 2249→2249 |
| 390 | y 2162→2162 | y 2162→2162 |
| 1280 (veckovy, y och x) | y 1036, x 104 → oförändrat | y 1036, x 589 → oförändrat |

- Matrisen dev0 och dev1 ger 54/54, och coherence-testet gick 72/72 i upprepade dev-körningar.

### CS-QA-2 – Vanlig Bakåt: **STÄNGD**
- **Med och utan bfcache:** Bakåt från bokning till kalender återställer positionen i 3 av 3 försök i varje kombination (prod och dev, 390 och 1280):
  - vid 390 återställs y 2162;
  - vid 1280 återställs både y 1036 och veckokalenderns x (104 i prod, 589 i dev).
  - Navigeringstypen är `back_forward`.
- **Nästlad Bakåt:** kalender → bokning → kundkort, därefter Bakåt två gånger, ger exakt position i alla kombinationer. **PASS.**
- **Egen scroll under väntan:**
  - Ett hjul-scroll direkt efter återgång skrivs inte över senare; positionen var oförändrad 3,6 s senare.
  - I ett forcerat test döljs innehållet i 2,5 s så att återställningen måste vänta. Om jag trycker End eller scrollar med hjulet under väntan avbryts återställningen, och sidan hoppar inte till sparat y efteråt. Det gäller i prod och dev, vid 390 och 1280. **PASS.**

### CS-QA-3 – Tab ut, Escape, övertäckning: **STÄNGD**
- Kontrollerat för Salongen och Konto på 320, 390 och 1280, i prod och dev:
  - Tab förbi sista menyvalet stänger menyn, och det fokuserade elementet ("Öppna kalendern" respektive "Konto") ligger överst; `elementFromPoint` träffar elementet.
  - Shift+Tab tillbaka till summary håller menyn öppen. Shift+Tab ut stänger den.
  - Escape stänger menyn och återför fokus till summary.
  - Klick utanför stänger menyn.
  - På touch öppnar ett tryck menyn och första valet syns.
  - Ett klick på ett menyval navigerar (Salongen → Tjänster); blur stänger inte menyn innan klicket registreras.
- Skärmbild: `QA3-tab-out-Konto-390.png` (dev). Menyn är stängd och fokusramen på "Öppna kalendern" är synlig.

### CS-QA-4 – "Behåll bokningen": **STÄNGD**
- Vid 390 och 1280, i prod och dev: Avboka flyttar fokus till "Behåll bokningen". Behåll återför fokus till "Avboka", och bokningen är fortfarande `confirmed` i databasen.
- Samma sak fungerar enbart med tangentbord (Enter → Enter).
- Skärmbild: `QA4-avboka-focus-390.png`.

### CS-QA-5 – Tryckytor (uppmätt med boundingBox): **STÄNGD**

| Mål | 320 | 390 | 1280 | Krav |
|---|---|---|---|---|
| Varumärkeslänk | 164×44 | 164×44 | 164×44 | 44 ✓ |
| "Så använder du kalendern" | 288×44 | 358×44 | 760×44 | 44 ✓ |
| Dagslänk i veckovy | (visas ej <768) | (visas ej) | 54–66×44 | 44 ✓ |
| Kryssruta, kalender | 24×44 | 24×44 | 24×44 | 24 ✓ |
| Etikett `.check-label`, kalender | 138×44 | 173×44 | 160×44 | 44 ✓ |
| Kryssruta "Visa arkiverade", kunder | 24×24 | 24×24 | 24×24 | 24 ✓ |

Det finns ingen horisontell overflow på kalendern vid någon bredd.

### Snabb regressionsrök (390): **PASS**
- Översikt, Kalender och Kunder visar rätt h1 och `aria-current`.
- Personal "Avbryt" sparar ingenting.
- En verklig ändring ger varning; ett återställt värde ger ingen varning.
- Länken till kampanjutkastet fokuserar utkastets rubrik i bild.
- Kundbokningens bekräftelse ("Din bokning är klar") är fokuserad, synlig och inte övertäckt. "Boka en ny tid" flyttar fokus till `#service`.

## 6. Nya fynd

### Blockerare
Inga.

### Backlogg

**CS-F1-QA-1 – Low – Taket på 20 poster gallrar godtyckliga poster, inte de äldsta**
- Fil: `src/app/components/context-link.tsx:27–31`. `Object.keys(sessionStorage)…slice(0, n)` förutsätter insättningsordning, men Chromium returnerar nycklarna i godtycklig ordning. Mitt eget prov med 8 UUID-nycklar visade varken insättningsordning eller sortering.
- Repro (`ux4.mjs`, prod, 1280): veckokalender scrollad till y 1036 / x 589 → öppna en bokning → 30 sidvisningar via huvudmenyn (Kunder ↔ Översikt) → gå till samma boknings-URL → "Till kalendern". I 3 av 4 försök återställdes positionen. I det fjärde var kalenderns post gallrad (`calendarKeyKept=false`) och resultatet blev y 0 / x 0.
- Konsekvens: när fliken har passerat 20 poster inom 30 min kan även en nyss sparad post (till exempel kalendern man just lämnat) gallras, med ungefär 1/20 risk per gallring. URL och filter bevaras ändå; bara scrollen går förlorad.
- Rättningsriktning: sortera på `at` (äldst först) innan gallring, och undanta nyckeln som just ska skrivas.

**CS-F1-QA-2 – Info – En korrupt `booking-return:*`-post stänger av ny lagring i fliken**
- Fil: `context-link.tsx:22–25`. `JSON.parse` på varje befintlig post sker innan något skrivs. En ogiltig post kastar därför ett undantag. `rememberReturn` faller då tillbaka till enbart `returnTo` utan `returnKey`, och `pagehide`-sparandet tystas (rad ~187–193).
- Repro: lägg till skräp-JSON under `booking-return:<uuid>` i sessionStorage och klicka på en bokningslänk. Länken fungerar men saknar `returnKey`, så scrollminnet är avstängt tills fliken stängs.
- Detta kräver kod på samma origin eller manuell manipulation och är inte en säkerhetsrisk. Länken förblir säker.
- Rättningsriktning: lägg `try/catch` per post och ta bort ogiltiga poster.

Tidigare Info-fynd CS-QA-6 till CS-QA-9 ligger kvar i backloggen enligt briefen och är inte omgranskade.

## 7. Status CS-QA-1..5

| Fynd | Status | Bevis |
|---|---|---|
| CS-QA-1 (Medium) | **Stängd** | dev0/dev1 54/54; coherence 72/72 i dev; egna klick: retur i dev och prod, y och x |
| CS-QA-2 (Medium) | **Stängd** | Bakåt 3/3 per kombination (bfcache av/på × 390/1280 × prod/dev), nästlad Bakåt, egen scroll avbryter |
| CS-QA-3 (Low) | **Stängd** | Tab ut stänger menyn, inget täcker fokus, Escape och klick utanför fungerar, 3 bredder × 2 lägen |
| CS-QA-4 (Low) | **Stängd** | Fokus åter på Avboka med mus och tangentbord |
| CS-QA-5 (Low) | **Stängd** | Uppmätt 24/44 px enligt tabellen ovan |

## 8. NOT RUN

- Fysisk iPhone, Safari, iPadOS, Android och native.
- Playwright WebKit och Firefox (ej installerade).
- Riktig Chrome med profil (icke-headless) och skärmläsare.
- Original-repo, preview, server, moln och GitHub.
- Omgranskning av oförändrade moduler/epics och av Info-fynden CS-QA-6 till CS-QA-9 (utanför scope).
- Video (ej krävt).

## 9. Egna skärmbilder (emulerad Chromium, inte iPhone/Safari) – `coherent-f1-51d54d4/run/shots/`

- `QA1-prod-restored-390.png`, `QA1-prod-restored-1280.png`, `QA1-dev-restored-390.png`, `QA1-dev-restored-1280.png`
- `QA2-prod-back-restored-390.png` (bfcache tillåten), `QA2-prod-back-restored-1280.png` (bfcache av), `QA2-dev-back-restored-390.png`, `QA2-dev-back-restored-1280.png`
- `QA3-tab-out-Konto-390.png`, `QA4-avboka-focus-390.png`, `QA5-customers-320.png` (sista körningen var dev; Next-dev-indikatorn syns)

## 10. Städning

Alla egna Postgres-instanser, appar och dev-servrar är stoppade. Följande är raderat:
- `/tmp/cs1sec`, `/tmp/cs1host`, `/tmp/cs1ns`, `/tmp/cs1ux`;
- `work/.env`, `work/node_modules`, `work/.next`;
- pgdata-katalogerna.

Endast min egen körmapp berördes.
