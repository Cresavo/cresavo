# QA-rapport – Booking Lab SE, Epic 06 fixvarv 1 (av högst 2) – riktad återkontroll

**Revision (fryst):** `7c1407dce66910ef8ab304c882c90d90c173ca72` (branch feature/epic06-customers-demo-product)
**Arkiv:** `booking-epic06-fix1.zip`, sha256 `9078c11e41c89ac787e2c85f091ec236dfd341197866f1cf48a025f504b29431`. Zip-kommentaren är `7c1407d…`, 311 poster och enda env-liknande fil är `.env.example` (kontrollerat igen).
**Codex scope:** `recheck-fix1.txt`, sha256 `91909f4710db639c3e07f0f26d02fd1124495a309d4542e9a02b0831e982ea9b`, läst i sin helhet.
**Jämförelsebas:** `024796f` (`booking-epic06-candidate.zip`, sha256 `0be73b2b…`).
**Datum:** 2026-11-12, 21:35–21:47 CET. QA: Grok Bot (oberoende, read-only mot original).
**Körning:** EN körning, i en separat syntetisk kopia under `fix1-7c1407d/run/`. Bara syntetisk `@example.test`-data användes och TZ var Europe/Stockholm. Ingen GitHub, moln, preview, deploy eller hemlighet. Inga PC-filer lästes.

## 1. Sammanfattning och verdikt

| Område | Resultat |
|---|---|
| E06-QA-11 (seedägarskap) | **STÄNGD** – VERIFIED (eget negativt prov plus uppgraderingsprov) |
| E06-QA-1 (overflow långa namn/e-post) | **STÄNGD** – VERIFIED 320/390/1440 med gate PÅ, 33/33 mätningar PASS |
| E06-QA-2 (jokertecken i sökning) | **STÄNGD** – VERIFIED 12/12 sökprov PASS |
| Lucide 1.72.0 | **PASS** – tarball = registry, ISC + MIT (Feather), 0 runtime-beroenden, 9 ikoner, alla `aria-hidden`/`focusable=false` med text |
| lint / tsc / build / unit / integration / prod-E2E | **PASS** – unit 76/76, integration 84/84, prod E2E 40/40, 0 restdata |
| npm audit | full: 7 moderate (0 high/critical), omit=dev: 0 |
| Nya fynd | 1 Låg (backlog) och 4 Info. **Inga blockerare.** |

**Verdikt:**
- **Syntetisk skyddad preview: GO**, bunden till exakt `7c1407d` / zip `9078c11e…`, samma befintliga demogate och Vercel-skydd. Migration och seed får köras mot den isolerade `_demo`-databasen.
- **Pilot: NO-GO** (oförändrat, se avsnitt 9).
- Ingen FIX-REQUEST skrivs, eftersom det inte finns några blockerare.

## 2. Miljö
- Embedded PostgreSQL (samma binär som tidigare) på `127.0.0.1:55641`, med `timezone='Europe/Stockholm'` (kontrollerat med `show timezone`). Databaser: `f1_test`, `f1_int_test`, `f1_demo`, `f1_upg_demo` och `f1_spoof_demo`.
- Appar:
  - `:3441` = prod-build, gate AV, DB `f1_spoof_demo` (seedprov);
  - `:3442` = prod-build, **simulerad pinnad Vercel-demogate PÅ** (`BOOKING_RUNTIME=vercel`, `VERCEL=1`, `VERCEL_ENV=preview`, syntetiskt projekt-id pinnat, DB-fingeravtryck för `f1_demo`, `RATE_LIMIT_STORE=postgres`). Testklienten satte `x-real-ip`.
- **Prod-E2E och port 3000:** Playwright-konfigurationen har `localhost:3000` hårdkodat (`playwright.config.ts` baseURL/webServer.url). Eftersom 3000 inte fick användas på boxen kördes E2E i ett **isolerat nätverksnamespace** (`unshare -rn` → `ip link set lo up` → `unshare --user --map-user=1000`). Där fanns en egen loopback och en egen Postgres på 55642, så värdens port 3000 aldrig öppnades. Testkoden ändrades inte.
- En kastbar `.env` skapades med en färsk slumpad SESSION_SECRET och raderades efteråt. Normaliseringen CRLF→LF gjordes bara i arbetskopian; `new/` är en orörd uppackning.
- **Avvikelse:** Första matrisförsöket kördes med ett ärvt `NODE_ENV=production` i skalet. Då hoppades dev-beroenden över (192 paket), och lint, unit och seed föll. Försöket kastades (logg `summary-attempt1-NODE_ENV-production.log`), node_modules raderades och DB:erna återskapades. Matrisen kördes sedan om från `npm ci` med `NODE_ENV` avsatt. Ett första E2E-försök avbröts innan något test körts, eftersom Postgres vägrade starta som "root" i namespacet. Det rättades med en nästlad user-namespace. Detta är miljöfel hos QA, inte produktfel.

## 3. Faktiska kommandon och resultat (VERIFIED)

Loggar finns i `fix1-7c1407d/run/logs/` (`commands.log`, `summary.log` och en logg per steg).

| # | Kommando (cwd `run/work`, `DATABASE_URL` mot loopback) | Resultat |
|---|---|---|
| 1 | `npm ci` | **PASS** – 572 paket tillagda (= tidigare 571 + lucide-react), 0 sårbarheter i ci-sammanfattningen |
| 2 | `npx prisma generate` | **PASS** (Prisma 7.10.1) |
| 3 | `npm run db:migrate` + `npm run db:seed` (f1_test) | **PASS** – 7 migreringar |
| 4 | `npm run lint` | **PASS** |
| 5 | `npx tsc --noEmit` | **PASS** |
| 6 | `npm test` | **PASS** – 14 filer, **76/76** |
| 7 | `npm run build` | **PASS** |
| 8 | `npm run db:migrate && npm run db:seed && npm run test:integration` (färsk `f1_int_test`) | **PASS** – 20 filer, **84/84** (inkl. nya `demo-seed-ownership.test.ts`) |
| 9 | (netns, färsk `f1_e2e_prod_test`) `npm run db:migrate && npm run db:seed && RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e` | **PASS** – **40/40** (desktop + mobile), 49,9 s, kört EN gång |
| 10 | Restdata efter integration | RateLimitBucket 0, Customer 0, Booking 0, AdminUser 0, AdminSession 0, BookingEvent 0 |
| 11 | Restdata efter prod-E2E | RateLimitBucket 0, Customer 0, Booking 0, AdminUser 0, AdminSession 0, BookingEvent 0 |
| 12 | `npm audit --json` | exit 1: **7 moderate**, 0 low/high/critical (`minimatch` + `@typescript-eslint/*`, `typescript-eslint`) – samma kända uppströmsblockerare, enbart dev |
| 13 | `npm audit --omit=dev --json` | exit 0: **0** |
| – | E2E i dev-läge, proxy=1-läge | **NOT RUN** (utanför scope: "full prod E2E ONCE") |
| – | Override-experiment för audit | **NOT RUN** (uttryckligen undantaget) |

## 4. Diff 024796f → 7c1407d (VERIFIED)
`diff -rq --strip-trailing-cr` ger **27 poster** (patch: `logs/024796f-vs-7c1407d.patch`, 1 330 rader).

- **Kod:**
  - `scripts/seed-demo.ts` (E06-QA-11);
  - `src/lib/customers.ts` (E06-QA-2);
  - `src/app/style.css` (E06-QA-1 och `.ui-icon`);
  - `src/app/admin/customers/[id]/page.tsx`, `src/app/admin/customers/page.tsx` och `src/app/admin/header.tsx` (Lucide och `customer-card-heading`/`customer-contact`-klasser).
- **Tester:** `tests/e2e/customers.spec.ts` (overflow 320/390/1440), `tests/integration/customers.test.ts` (literal sökning), ny `tests/integration/demo-seed-ownership.test.ts`, `tests/preview-files.test.ts` (licensfil i whitelist och formattering).
- **Paket:** `package.json`, `package-lock.json`.
- **Licens och leverans:** ny `THIRD_PARTY_LUCIDE_LICENSE.txt`, `THIRD_PARTY_NOTICES.md`, `.dockerignore`, `.vercelignore`, `Dockerfile.vercel`.
- **Bilder:** `public/demo/customer-card.png`, `public/demo/workspace.png`, `public/demo/manifest.json`.
- **Docs:** `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPENDENCY_REVIEW.md`, `docs/EPIC_06_PLAN.md`, och nya `docs/qa/QA-REPORT-epic06-024796f.md` + `FIX-REQUEST-epic06-024796f.md`. De två QA-filerna är innehållsidentiska med QA:s original; bara radsluten skiljer.

**Kärnan är oförändrad (VERIFIED, ingen diff):** `auth.ts`, `admin-http.ts`, `demo-access.ts` (gaten), `rate-limit.ts`, `postgres-rate-limit.ts`, `workspace-write.ts`, `domain.ts`, `validation.ts`, `scripts/server.mjs`, publika `src/app/api/**` (inkl. `api/bookings/route.ts`), MCP (`src/mcp/**`), `prisma/schema.prisma` och **alla 7 migreringar**. `picker.tsx` är oförändrad; overflow-fixen för väljaren ligger i CSS.

**package.json/lock (VERIFIED):** Den enda ändringen är tillägget `"lucide-react": "1.72.0"` (exakt version) i dependencies, plus en ny lock-post `node_modules/lucide-react` 1.72.0 med license ISC, peer `react ^16.5.1||…||^19.0.0` och valfri `@types/react`. **Ingen annan version är ändrad** (lock-diffen innehåller bara de två tilläggen).

## 5. E06-QA-11 – seedägarskap → **STÄNGD**

### Kodgranskning av guarden (`scripts/seed-demo.ts`, 7c)
- `:168-170` `adminKey = sha256("admin:"+actor.id+":"+key)`. Detta är den namnrymdade nyckeln som admin-skapelse lagrar.
- `:171-183` Föregående rad hämtas på `businessId:"demo"` och (rå nyckel ELLER adminKey). Den inkluderar bara create-event med `actorKind:"admin"` och `actorId: actor.id`, alltså den dedikerade demoägaren (`:98-100`, `DEMO_SEED_ACTOR_REFUSED` om den inte är aktiv eller `demo`).
- `:187-189` `ownedKey` gäller bara om nyckeln är adminKey, eller om nyckeln är den råa nyckeln **och** `id === key`. Historiska seedrader skrivs med `id = key`, vilket en publik klient inte kan styra.
- `:190-198` Raden hoppas över om något av följande gäller: nyckeln är inte ägd, det saknas ett ägt create-event, `serviceId` skiljer sig, `initialStartsAt ?? startsAt` skiljer sig från seedens start, eller eventets `nextStaffId` skiljer sig. Då gäller `skipped++` och `return`.
- `:211-215` Backfill sker med `updateMany` där `customerId: null` och `businessId: "demo"`, så en befintlig länk skrivs aldrig över (kapplöpningssäkert).
- **Bedömning:** Guarden följer FIX-REQUEST (exakt seednyckel + ägt admin-create-event + historiskt id för rå nyckel), med extra lager för tjänst, starttid och personal. Den publika vägen kan inte skapa ett admin-create-event.

### Eget negativt prov (färsk `f1_spoof_demo`, prod-server :3441, `probes/seedown2.mjs`, logg `logs/seed-ownership-probe.txt`)
- **A. Rå förutsagd seednyckel.** Seednyckeln för 2026-11-23 09:00 demo-ui-sofia beräknades. Därefter gjordes en publik `POST /api/bookings` med den nyckeln samt namnet och e-posten **Mira Demo / demo-customer-0@example.test**.
  - Svar `201 {"id":…}`. Create-eventet var `{public, booking-channel}`. En kontrollbokning med slumpnyckel gjordes också.
  - `demo:seed` körning 1 gav `added 78 / existing 0 / skipped 1`.
  - Spoofraden förblev `customerId=null` (PASS) och kontrollraden likaså (PASS). Spoofradens ögonblicksbild (alla kolumner utom customerId) var byte-identisk före och efter (PASS).
- **B. Namnrymdad adminnyckel (värsta fall: angriparen känner till demoägarens id).** En framtida seedrad (demo-customer-11) togs bort syntetiskt. Därefter skapades en publik bokning med dess 64-hex adminKey som `Idempotency-Key`, plus matchande namn och e-post (Elli Demo).
  - Schemat accepterar nyckeln (201).
  - `demo:seed` körning 2 gav `skipped 2`, och raden förblev `customerId=null` (PASS). Det ägda create-eventet saknas, så guarden håller även här.
- **Omkörningar:** Körning 2 och 3 gav båda `added 0 / existing 77 / skipped 2`. 7-tabellshashen (Booking, Customer, BookingEvent, Staff, Service, AdminUser, Campaign) var identisk mellan körning 2 och 3 (PASS).
- **"Seedbokningen skapas ändå?" – Nej (dokumenterat).** Vid kollision gör koden `return`, så seedens egen bokning på 2026-11-23 09:00 Sofia skapades **inte** (0 rader). Seeden får alltså 78 i stället för 79 bokningar, och sloten hoppas över vid varje omkörning. Det är säkert (inget adopteras, inget skrivs över) men låter en publik klient undertrycka enskilda demobokningar. Se nytt fynd **E06F1-QA-1 (Låg)**.
- **Resultat:** 80 bokningar och 78 kopplade efter körning 1. Totalt 32 kunder.

### Legitim uppgradering från d7bc47f-schemat (`f1_upg_demo`, logg `logs/upgrade.log`)
1. Med d7bc47f-koden (`ui-d7bc47f/run/work`): `db:migrate`, `db:seed` och `BOOKING_DEMO_SEED=1 demo:seed`, vilket gav `added 33`. Därefter lades 4 manuella prover in: Billie med seedmejl, Billie med annan mejl, Anna Manuell och Kim med seedmejl (avbokad). Det gav **37 bokningar**, md5 `b1ebf18b…`.
2. Med 7c-koden: `npm run db:migrate` (7:e migreringen) och sedan `demo:seed` ×3.
   - Körning 1: `added 46 / existing 33 / skipped 0`, 32 kunder.
   - Körning 2 och 3: `added 0 / existing 79 / skipped 0`.
   - 7-tabellshashen var identisk efter körning 1, 2 och 3.
3. **Alla 37 originalrader är byte-identiska** i kolumn 1–21 (allt utom den nya `customerId`) – PASS.
4. De **33 legitima seedraderna kopplades**. **0 av 4 manuella rader kopplades**, inte heller de med identiskt seednamn och seedmejl – PASS.
5. Totalt 83 bokningar, 79 kopplade och 0 överlapp. Detta matchar Codex påstående.

## 6. E06-QA-1 – overflow → **STÄNGD**
- Kodändring: `style.css:19-40` sätter `min-width:0; overflow-wrap:anywhere` på `.customer-row`, `.customer-row strong`, `.customer-picker*`, `.customer-choices button` (med `max-width:100%; white-space:normal`), `.customer-contact`, `.customer-visits p`, `.booking-review p`, `.booking-summary p` och `.customer-card-heading(h1)`. `[id]/page.tsx` använder `customer-card-heading` och `customer-contact`.
- **Eget prov** (`probes/ui.mjs`, gate PÅ på :3442, Chromium):
  - Testkunden har ett obrutet namn på 82 tecken och e-posten `qa-<61×x>@example.test` (77 tecken).
  - 320 och 390 kördes som mobil (touch, DPR 2), 1440 som desktop.
  - **33/33 PASS:**
    - Kortet: `docSW == innerWidth == viewport` på alla tre bredder. Rå lång e-post syns (gate PÅ). E-postraden och H1 har `scrollWidth ≤ clientWidth` och höger kant ≤ viewport.
    - Listraden (`?q=Maximilian`): ingen overflow, raden ryms.
    - Ny bokning med förvald lång kund, och väljarens sökresultat: knappen radbryts (höjd 120/96/72 px) och är klickbar.
    - Primära åtgärder: **"Ny bokning"** (145×46) och **"Sök kunder"** (143×46) är synliga, översta element i sin mittpunkt och trial-klickbara på alla bredder. "Sök kunder" klickades på riktigt och navigerade.
- Skärmbilder: `shots/long-card-{320,390,1440}.png`, `long-list-*.png` och `long-picker-*.png`.

## 7. E06-QA-2 – jokertecken → **STÄNGD**
- Kodändring: `src/lib/customers.ts:140-141` escapar `\`, `%` och `_` med backslash, och `:149` använder `contains: pattern`. Postgres standard-escape för LIKE/ILIKE är `\`, och Prisma escapar inte själv: literal-proven nedan visar att det inte blir dubbel-escapning.
- **Eget prov** (gate-session, `GET /api/admin/customers?q=…&limit=50`) mot `f1_demo`. Där finns seeden (32 kunder, varav **0** innehåller `_`, `%` eller `\`, kontrollerat i DB) plus tre egna syntetiska literalkunder: `QA_Understreck Demo`/`qa_under@example.test`, `QA%Procent Demo` och `QA\Backslash Demo`.
  - `q=_` → bara qa-under; `q=%` → bara qa-pct; `q=\` → bara qa-bs. **0 seedträffar.**
  - `q=%%`, `q=__` och `q=Demo_` → 0.
  - Literala sökningar matchar: `QA_Under`, `QA%Pro`, `QA\Back` och `qa_under@`.
  - Normal sökning fungerar: `demo-customer-7@example.test` → demo-customer-7 och `mira` → demo-customer-0.
  - **12/12 PASS.**

## 8. Lucide 1.72.0 (VERIFIED)
- **Tarball:** `npm pack lucide-react@1.72.0` gav sha512 `fbF5i1GU8GODETa3…CRwNrg==`, vilket är **identiskt** med lockens `integrity`. Den uppackade tarballen är byte-identisk (`diff -r`) med `node_modules/lucide-react`.
  - `package.json`: license **ISC**, `dependencies` = `{}` (**0 runtime-beroenden**) och bara peer `react` (+ valfri `@types/react`). Inga install-skript (bara utvecklarskript som inte körs vid installation).
  - Installerad React är 19.x och uppfyller peer-kravet.
- **Licens:** Tarballens `LICENSE` innehåller ISC (Lucide Icons and Contributors 2026) plus listan över Feather-härledda ikoner och **MIT (Cole Bemis 2013-present)**. `THIRD_PARTY_LUCIDE_LICENSE.txt` är **innehållsidentisk** med tarballens LICENSE.
- **Whitelist och leverans:**
  - `.dockerignore:21` och `.vercelignore:21` har `!/THIRD_PARTY_LUCIDE_LICENSE.txt`.
  - `Dockerfile.vercel:32` kopierar filen till runtime-imagen.
  - `tests/preview-files.test.ts` kräver att filen finns i preview-urvalet.
  - `THIRD_PARTY_NOTICES.md:5-7` hänvisar till filen.
  - Next 16.4.6 har `lucide-react` i sin förvalda `optimizePackageImports` (`next/dist/server/config.js:970`).
- **AGPL-kompatibilitet:** Ingen konflikt. ISC och MIT är permissiva och GPL-kompatibla. Kravet är att behålla upphovsrätt och licenstext, vilket uppfylls i källkod, Docker och preview.
- **Ikoner:** Grep och rendering visar **9 unika namngivna ikoner**: CalendarDays, Users, Scissors, Clock och Megaphone (header), Plus och Search (kundlistan), ArrowLeft och CalendarPlus (kortet).
  - `recheck-fix1.txt` påstod 8, och Codex har rättat till 9. Rättelsen är **bekräftad**.
  - Alla renderade `svg.lucide` på `/admin`, `/admin/customers` och kortet har `aria-hidden="true"` och `focusable="false"`, saknar `<title>` och har synlig textetikett i föräldern – PASS.
- **Mobil 390 (tangentbord och touch):**
  - Navigationen har 5 länkar, alla **177×44 px** och inom viewport (två kolumner).
  - Tab-ordningen är: varumärkeslänk → Kalender → Kunder. "Kunder" får synlig fokusmarkering, och Enter navigerar till `/admin/customers` med `aria-current="page"` – PASS.
  - Höjden 44 px uppfyller WCAG 2.5.8 (24 px) och ligger exakt på riktmärket 44 px i 2.5.5.

## 9. Leveransbilder – jämförelse (egna 390x844-bilder i `shots/own-390-*.png`)
De 5 bilderna från Codex plus ersättningsbilden är **UNVERIFIED** som källa (QA har inte sett Codex build). Innehållet jämfördes med QA:s egna skärmbilder av samma sidor på 7c.

| Codex bild | Sida | Jämförelse |
|---|---|---|
| `06cdebe0…png` (390×3889) | /product | Stämmer med egen `own-390-product.png`. Svensk text, de inbäddade skärmbilderna visar Lucide-navigationen och syntetisk `ui-review@example.test`. Inga synliga fel. |
| `998afab8…png` (390×4352) | /admin/customers | **Kontrollerat:** Standardsidan visar **20 kort** (egen mätning: 20 rader, sidhöjd 4 409 px på 390), och längst ned finns bara "Nästa sida" (cursorlänk). Det finns inget antal, ingen sidindikator och ingen "Föregående" på första sidan. Pagineringen fungerar (max 50 verifierades i 024796f), men listan blir ca 5 skärmhöjder på mobil. Se **E06F1-QA-3 (Info, UX)**. |
| `43abc18a…png` (390×1231) | kundkort | Stämmer med egen bild. Kontakten är maskerad `***@***` (lokal, gate AV), och "Till kunder" med pil och "Ny bokning" med ikon syns. |
| `905296d9…png` (390×1652) | ny bokning | **Visar laddningsläget "Hämtar tider…"**, så den räknas inte som funktionsbevis (Codex rättelse noteras). |
| `43243453…png` (390×1608) | kalender | Stämmer med egen `own-390-calendar.png`. Ingen synlig defekt. |
| `revisit-selected-390.png` (390×2233, sha256 `1c1ebbc1…`), ersättning | återbesök | **Codex påstående, UNVERIFIED:** dag vald, 09:00 vald, sammanfattning och aktiv "Skapa bokning". Bilden visar detta. **Eget VERIFIED-flöde på 390:** Från Mira Demos kort ledde "Boka återbesök" till `/admin/bookings/new?customer=demo-customer-0&service=demo-ui-massage&staff=demo-ui-sofia`. Därefter valdes 3 december 2026. Tiderna laddades (14 lediga tider) och "Hämtar tider…" fanns kvar 0 gånger. 09:00 valdes, och sammanfattningen visar "Kund: Mira Demo · Avslappnande massage · 30 min · 450,00 kr · Sofia (demo) · torsdag 3 december 2026 kl. 09:00". Sidan har ingen overflow. **"Skapa bokning"** klickades, och bokningen skapades med `customerId=demo-customer-0` (5 → 6 kopplade) med redirect till bokningsdetaljen – PASS. Egna bilder: `own-390-revisit-selected.png` och `own-390-revisit-created.png`. |

Övrigt (Info): På "Ny bokning" som nås från kundkortet är "Kalender" markerad som aktiv i navigationen, både i Codex bilder och i egna. Det är samma beteende som i 024796f och ingen defekt.

## 10. Codex påståenden – bekräftat, motsagt eller ej verifierbart

| Påstående (recheck-fix1.txt + senare uppdateringar) | Status |
|---|---|
| Tre fixar implementerade (seedägarskap, wrap, literal sökning) | **Bekräftat** (avsnitt 5–7) |
| Spoofad nyckel förblir okopplad, legitim gammal seed kopplas, alla snapshots bevaras, körning 2 och 3 lägger till 0 med oförändrade hashar | **Bekräftat** (eget prov) |
| Separat createBooking-prov utan aktör: `78 added, 0 existing, 1 skipped` | **Bekräftat** (exakt samma siffror i eget prov A) |
| Ny Playwright-test för 320/390/1440 | **Bekräftat** att den finns (`customers.spec.ts:35`) och passerar i egen prod-E2E |
| Literal sökning med integrationstest | **Bekräftat** (integration 84/84 och eget prov) |
| lucide-react 1.72.0 är enda nya paketet och ingen annan version ändrad | **Bekräftat** |
| ISC + MIT Feather i THIRD_PARTY_LUCIDE_LICENSE.txt och whitelist | **Bekräftat** |
| Inga egna runtime-beroenden, React-peer stöds, Next optimerar Lucide-importer | **Bekräftat** |
| "Åtta namngivna ikoner" | **Motsagt** av koden (9). Codex senare rättelse till **nio** är **bekräftad**. |
| Ingen Base UI, TanStack Table eller React Hook Form | **Bekräftat** (inte i package.json eller lock) |
| Rena npm ci: **571** paket | **Delvis motsagt:** QA får 572 (`added 572 packages`). Skillnaden på 1 är densamma som i 024796f (QA 571 mot Codex 570), troligen plattformsberoende valfria paket. Ofarligt. |
| generate 7.10.1, lint, tsc och build PASS; unit 76; integration 84 | **Bekräftat** (egen körning) |
| Prod-E2E 40/40 med postgres-rate-store och 0 restdata | **Bekräftat** (egen körning, 40/40 och 0 rader) |
| Audit full exit 1 med 7 moderate och 0 high/critical; omit-dev exit 0 med 0 | **Bekräftat** |
| Lokal uppgradering: 37 snapshots, 83/32/0 överlapp, omkörning 0 added / 79 existing | **Bekräftat** |
| Före Lucide (aab9fdf): matris dev/prod × proxy0/1, 40/40 vardera | **UNVERIFIED** (annan revision, inte körd av QA) |
| Actions-run 43301797796 på exakt 7c (alla 4 lägen) pågår | **UNVERIFIED** (QA har ingen GitHub-åtkomst, per regel) |
| Leveransbilder från lokal prod-build 390x844, "inga overflow, alla bilder laddade" | **UNVERIFIED** som källa. Innehållet stämmer med egna bilder, utom laddningsbilden. Ersättningsbilden `revisit-selected-390.png` är **UNVERIFIED**, men eget flöde visar samma funktion. |
| Krypterad backup återställd, 10 tabeller och manipulering avvisad | **UNVERIFIED** (molnet och backupen är utanför scope) |
| Preview är fortfarande d7 och ingen migration eller deploy har gjorts | **UNVERIFIED** (QA har ingen preview-åtkomst) |
| Marknadsbilder märkta "dirty source aab9fdf + Lucide" | **Ej granskat i detalj.** `manifest.json` är ändrad, men det låg utanför den riktade scopen. |

## 11. Fynd

### Blockerare
**Inga.**

### Nya (backlog)
- **E06F1-QA-1 (Låg, demo/operatörsväg) – publik kollision på förutsägbar seednyckel undertrycker seedens egen bokning.**
  - Var: `scripts/seed-demo.ts:190-200` (`skipped++; return;`). Nycklarna är deterministiska (`:160-165`).
  - Repro: Beräkna `demo-v1-`+sha256(`<datum>:9:0:demo-ui-sofia`).slice(0,36) för en kommande seedslot och POST:a `/api/bookings` med den som `Idempotency-Key` innan seeden körs. Seeden rapporterar då `skipped 1`, och seedbokningen på sloten skapas aldrig. Ingen koppling och ingen dataskada sker (verifierat).
  - Påverkan: En anonym klient kan ta bort enskilda demobokningar ur demon, varaktigt vid varje omkörning. Ingen sekretess- eller integritetspåverkan.
  - Fixriktning (valfri): För framtida slots, fortsätt skapa via admin-vägen (dess adminKey kolliderar inte med den publika råa nyckeln) i stället för `return`. Alternativt kan seednycklar härledas med HMAC och en serverhemlighet.
- **E06F1-QA-2 (Info, docs)** – `recheck-fix1.txt` angav 8 ikoner; det är 9. Codex har rättat detta. Docs i 7c anger inget antal (grep på "åtta"/"eight" i DEPENDENCY_REVIEW, EPIC_06_PLAN, NOTICES och README gav 0 träffar), så ingen docsändring behövs.
- **E06F1-QA-3 (Info, UX mobil)** – Kundlistan visar 20 kort (cirka 4 400 px på 390) med bara "Nästa sida". Det finns inget antal, ingen sidindikator och ingen väg tillbaka utöver webbläsaren. Fixriktning: kompaktare rader på smal skärm, "Visar 1–20" och en "Föregående"-länk.
- **E06F1-QA-4 (Info, leverans)** – Codex första bild av ny bokning fångade laddningsläget "Hämtar tider…" och har ersatts av `revisit-selected-390.png`. Det eget flödet visar att funktionen fungerar.
- **E06F1-QA-5 (Info, testharness)** – `playwright.config.ts` hårdkodar port 3000 (baseURL och webServer). En konfigurerbar port (t.ex. `E2E_PORT`) skulle göra parallella körningar möjliga utan namespace-isolering.

### Kvarvarande Info från 024796f (backlog, oförändrade i 7c)
- E06-QA-3: sökning på maskerade kontaktfält.
- E06-QA-4: aktiv flik på kortet saknar CSS. Fortfarande ingen regel.
- E06-QA-5: 404-UI med HTTP 200.
- E06-QA-6: seed utan telefonnummer, 1 ombokad.
- E06-QA-7: manifest utan licensfält.
- E06-QA-8: `docs/DEMO.md` inaktuell.
- E06-QA-9: okopplade bokningar kan inte kopplas i efterhand.
- E06-QA-10: backfillregeln, nu ersatt av guarden i 7c.

Inget av detta krävs för preview.

## 12. Saknade tester och begränsningar
- Demogaten var **simulerad lokalt** (env-variabler). Ingen riktig Vercel-preview, ingen fysisk iPhone eller Safari och ingen WebKit.
- Dev-E2E och proxy=1-läget kördes inte (utanför scope). Det gamla demo-gate-matrisprovet, IDOR-, MCP- och maskeringsproven kördes inte om, eftersom kärnan är oförändrad (VERIFIED via diff) och de är täckta i 024796f-rapporten.
- Prov B (adminKey-spoof) förutsätter att angriparen känner till demoägarens id, och sloten skapades genom att en seedrad togs bort syntetiskt. Detta var ett medvetet värsta fall.
- Marknadsbilderna i `public/demo` och manifestets proveniens granskades inte på nytt.
- Codex E2E och CI på exakt 7c (Actions-run 43301797796) är inte verifierade.

## 13. Kvarvarande blockerare
- **Syntetisk skyddad preview:** inga. Rekommenderad ordning: migration mot den isolerade demo-DB:n, sedan `BOOKING_DEMO_SEED=1 npm run demo:seed` (förväntat på en befintlig d7-demo: `existing 33`, `added 46`; omkörning ger 0), sedan deploy av exakt 7c. Kontrollera därefter gaten (rå kontakt bara på kortet) och CI grön på exakt 7c innan länken delas.
- **Pilot (NO-GO), oförändrade blockerare:**
  - rättslig grund/DPA och dataskydd för riktiga kunddata (gaten tillåter bara `@example.test`);
  - CI/E2E på exakt deployad SHA i moln;
  - backup/återställning och incidentrutin;
  - riktig enhetstest på mobil (iOS Safari);
  - den kända uppströms-audit-posten (7 moderate, enbart dev) bevakas.

## 14. Artefakter
- Loggar i `fix1-7c1407d/run/logs/`: `summary.log`, `commands.log`, `npm-ci.log`, `lint.log`, `tsc.log`, `unit.log`, `build.log`, `integration.log`, `e2e-full-prod.log`, `upgrade.log`, `seed-ownership-probe.txt`, `ui-probe.txt` (54 PASS / 0 FAIL), `audit-full.json`, `audit-omitdev.json`, `024796f-vs-7c1407d.patch` och `changed-files.txt`.
- Prober: `fix1-7c1407d/run/probes/seedown2.mjs` och `ui.mjs`.
- Skärmbilder i `fix1-7c1407d/run/shots/`: `long-card-*`, `long-list-*`, `long-picker-*`, `own-390-{product,customers,customers-full,card,calendar,newbooking,revisit-selected,revisit-created}.png` samt jämförelseutsnitt `_cmp-*.png`.
- Städning: Alla egna servrar (:3441, :3442 och E2E-servern i namespacet) och båda Postgres-instanserna (55641, 55642) är stoppade. Kastbar `.env` är raderad. Ingen admin-lösenordsfil skapades.
