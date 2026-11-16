# QA-rapport – riktad omkontroll av UX-rättningsvarv 1 (av max 2), f737ed2

- **Revision:** `f737ed20ab652428347fd3f8678577f3ae41a12f`.
- **Zip:** `ui-f737ed2/booking-ui-fix1.zip`, sha256 `58146c283a8e8cf45052f761610e1d7bd0f28bdf0232f9df06c535bc0c77c47a`.
  - Zipkommentaren är full SHA.
  - Arkivet har 248 poster, varav 204 filer.
  - Den enda env-filen är `.env.example`.
  - **Allt detta är verifierat av mig.**
- **Leveransbilder:** `ui-f737ed2/delivery-images/`, 14 PNG plus manifest.
  - Alla 14 sha256 stämmer med manifestet.
  - Before = f2fdac7, after = f737ed2, `afterSourceCleanAtCapture=true`, `physicalIphone=false`.
- **Jämförelsebas:** dd98ae4 (`ui-dd98ae4/booking-ui-frozen.zip`) och föregående rapport `QA-REPORT-ui-dd98ae4.md` (sha256 `314789fd…a85d8`).
  - Kopian av rapporten i `docs/qa/` är innehållsidentisk efter CRLF→LF.
- **Tid:** 2026-11-12, cirka 18:30–19:10 CET.
- **Avgränsning:**
  - **Endast EN körning**, i en separat kopia (`ui-f737ed2/run/`).
  - Originalet är orört.
  - Ingen deploy, push, PR eller GitHub-skrivning.
  - Ingen PC-åtkomst och inga hemligheter. Egna engångshemligheter genererades lokalt och har inte skrivits ut.
  - Endast syntetiska `@example.test`-data.
- **Miljö:**
  - Inbäddad Postgres 127.0.0.1:**55611** med TZ Europe/Stockholm.
  - Appservrar på 3410 (klick) och 3411 (grindprober).
  - Playwrights E2E-harness använder sin egen fasta port 3000.
  - Egen admin `fx-qa-admin@example.test` skapad via `npm run admin:manage -- create`. Lösenordsfilen är raderad efteråt.

## Beslut

**Bunden GO för en skyddad, syntetisk preview.** Detta gäller **inte pilot**; pilotstatus är oförändrad (ej bedömd, kräver bl.a. fysisk iPhone och separat granskning).

- **Blockerare:** 0. Ingen FIX-REQUEST skrivs, och rättningsvarv 2 behövs inte för previewn.
- **Gamla fynd:** UX-QA-1, 2, 3, 4, 5, 9 och 10 är **stängda**. Övriga är oförändrad, dokumenterad backlog.
- **Nya fynd:** 4 st, alla Low/Info (UX-QA-17–20).

## Diff dd98ae4 → f737ed2 (hela trädet, LF-normaliserat)

Ändrade filer (`run/logs/changed-files.txt`, patch `run/logs/f737ed2-vs-dd98ae4.patch`), 14 st:

- **Docs:** `AGENTS.md`, `docs/UI_USABILITY_REVIEW.md`, ny `docs/qa/QA-REPORT-ui-dd98ae4.md`.
- **UI:**
  - `src/app/admin/bookings/editor.tsx`
  - `src/app/admin/bookings/new/page.tsx`
  - `src/app/admin/calendar.tsx`
  - `src/app/admin/staff/editor.tsx`
  - `src/app/booking-form.tsx`
  - `src/app/style.css`
- **Grind:** `src/lib/demo-access.ts`, där `port` lades till i listan över nekade query-nycklar (rad 12).
- **Tester:**
  - `tests/demo-access.test.ts`
  - `tests/e2e/flow.spec.ts`
  - `tests/e2e/usability.spec.ts`
  - `tests/e2e/workspace.spec.ts`

**Oförändrat (VERIFIED, byte-jämfört):**
- `src/lib/auth.ts`, rate-limit/limiter, `domain.ts`, `src/mcp/`, `prisma/` (migreringar);
- wrapper (`scripts/server.mjs`, `client-address.mjs`), `scripts/seed-demo.ts`;
- `package.json`/`package-lock.json`, `.vercelignore`, `vercel.json`.

## Automatiserade tester (egen körning, färska databaser) – VERIFIED

| Steg | Resultat |
|---|---|
| `npm ci` | PASS, "added 571 packages, audited 572" |
| prisma generate / migrate / seed | PASS |
| lint | PASS |
| tsc | PASS |
| unit | **75/75 PASS** |
| integration | **75/75 PASS** |
| build | PASS |
| E2E prod0 (produktion, utan proxy, `RATE_LIMIT_STORE=postgres`) | **32/32 PASS**, 38,2 s |
| E2E dev0 (billig extra körning) | **32/32 PASS**, 1,1 min |
| RateLimitBucket efter E2E | **0 rader** i båda (30 inserts vardera) |
| `npm audit --omit=dev` | **0** sårbarheter |
| `npm audit` (full) | 7 moderate / 0 high (dev-kedjan typescript-eslint/minimatch, oförändrad) |

**NOT RUN:**
- E2E dev1/prod1 (proxy-lägena; inte begärt, koden i wrappern är oförändrad);
- fysisk iPhone, skärmläsare;
- Firefox/WebKit;
- riktig Vercel-preview och molnperimeter (Codex ansvar).

## Riktad klicktest (headless Chromium, produktionsbygge f737ed2) – VERIFIED

Databasen `fx_click_demo` byggdes enbart med migrate + demoseed (se QA-13). Därefter lade jag till en fjärde medarbetare via UI:t, "Kim Långnamnsson (QA)", för att få 4 personal.

Skript: `run/probes/fx-*.mjs`. Resultat: `run/logs/fx-*.json`.

### Veckokalender på desktop (1440x900)

| Mätning | Alla (4 personal) | En personal (Sofia) | Dagvy Alla |
|---|---|---|---|
| Bredd per personalspalt | **160 px** (28 spalter), block ≥156 px | 181 px | 330 px |
| Avkortade personalrubriker | 0 | 0 | 0 |
| Region scroll/klient | 4588 / 1382 px → **sidscroll i regionen** | 1382 / 1382 → **hel vecka ryms** | ingen scroll |
| Sidans `scrollWidth` | 1440 = viewport (ingen sid-overflow) | 1440 | 1440 |
| Region | `role="region"`, `aria-label="Veckokalender"`, `tabindex="0"`, `aria-describedby="calendar-help"` | samma, utan hjälptext | `aria-label="Dagkalender"` |
| Hjälptext | "Välj en medarbetare för en samlad veckoöverblick. Med alla medarbetare kan du rulla kalendern i sidled eller trycka på en dag för dagvyn." | visas inte (1 person) | visas inte |

**Tangentbord och sticky-axel:**
- Tab från personalfiltret når regionen efter Dag → Vecka (4 steg). Fokusringen är 3 px solid.
- 5 × pil höger ger `scrollLeft` 0 → 200.
- Tidsaxeln och "Tid"-rubriken står kvar på x=29 efter scroll, och `elementFromPoint` på axeln ger `calendar-axis` (sticky fungerar).
- PageDown scrollar sidan; regionen har ingen vertikal scroll, vilket är förväntat.
- End/Home flyttar inte horisontellt. Det är webbläsarstandard och inget som har påståtts.

**Mobil (390 och 320):**
- Desktopregionen är dold och kortlistan används.
- Ingen sid-overflow, inga omärkta kontroller.

**Rubriker (alla bredder):**
- "Vecka 47 · 16 nov.–22 nov.", "måndag 16 november" osv.
- Inga ISO-datum i h1–h3, summary, strong eller dagrubriker.

**Nästa besök:** "Nästa besök: fredag 13 november 2026 kl. 09:00 · Liv Demo · Avslappnande massage" i 1440, 390 och 320.

### Ändrade vyer (320/390/1440)

| Vy | Resultat |
|---|---|
| Ny bokning | Exakt **1** "Till kalendern" i alla tre bredder |
| Bokningsdetalj | "onsdag 18 november 2026 kl. 10:00–10:45"; efter flytt "torsdag 19 november 2026 kl. 09:00–09:45" |
| Avboka | Första fokus på "Behåll bokningen" |
| Schemaundantag | Rubriker "tisdag 17 november 2026 · Ledig" och "onsdag 25 november 2026 · Ledig"; datumväljaren visar "Tryck på en dag i kalendern." |
| Kundkrock (två flikar, samma tid) | "Tiden är inte längre tillgänglig. Välj en annan ledig tid. Dina uppgifter finns kvar." i 390, 320 och 1440. Namn och e-post finns kvar; den tagna tiden försvinner ur listan. |
| Kundregression | Nätverksfel/tidshämtningsfel på svenska. Tangentbord 12→13→20 nov. Ingen overflow. |
| Kundbokning 1440 | Gav "För många försök. Försök igen senare. Dina uppgifter finns kvar." – kundbokningsbegränsaren efter mina många körningar från samma IP. Förväntat beteende, svensk text. |

`text-transform: capitalize` finns inte längre någonstans i `style.css`. Kontrollerat med `grep` och DOM.

### Leveransbilder jämfört med egna tagningar

| Leveransbild | Jämförelse |
|---|---|
| `after-calendar-desktop.png` | Stämmer med min `fx-admin-1440-week-alla-16.png`: läsbara personalspalter, hjälptext, "Nästa besök" med datum, cirka 1,5 dag synlig vid "Alla". Leveransbilden har 4 personal med Erik från basseedad databas; min har Kim (QA). |
| `after-customer-review.png` | Stämmer med svenska texter och kalender. |
| Övriga after-bilder | Konsistenta med mina tagningar. |

Inga avvikelser som pekar på annan kod än den frysta.

**Bästa egna skärmbilder:**
1. `run/shots/fx-admin-1440-week-alla-16.png`: veckovy Alla med 4 personal à 160 px och hjälptext.
2. `run/shots/fx-admin-1440-week-alla-scrolled.png` (detalj: `fx-admin-1440-week-alla-scrolled-crop.png`): scrollad region med sticky tidsaxel. Visar även UX-QA-19.
3. `run/shots/fx-cust-390-08-slot-conflict.png`: ny krocktext där utkastet finns kvar.

Övriga bilder:
- `fx-admin-1440-week-sofia-16.png`: en personal, hel vecka.
- `fx-admin-390-14-staff-exceptions.png`: svenska undantagsrubriker.

## Demo-grinden: HTTP-prober genom riktig wrapper i Vercel-läge – VERIFIED

Probe: `run/probes/p-demo-gate.mjs`, logg `run/logs/p-demo-gate.json`. **66/66 PASS**, inklusive alla 43 från dd98ae4. Kakor hölls bara i minnet och skrevs aldrig ut.

**Nya portvarianter:** grinden är annars helt på, och servern når samma databas. `GET /api/services` gav 200, alltså fungerar appen.
- Varianterna:
  - `?port=55611` (samma port);
  - `?PORT=55611` (blandade versaler);
  - `?%70ort=` (kodad);
  - dubbla `port`-parametrar;
  - `?sslmode=disable&port=`;
  - `?HoSt=`;
  - host:port-mismatch (fingeravtryck för :5432);
  - host-mismatch (localhost mot 127.0.0.1).
- Varje variant gav POST → **403 utan kaka**, och en kopierad demokaka mot admin-API gav **403**.

**Seed:** `demo:seed --preview` med `?port=55611` → `DEMO_SEED_FAILED` (nekad), utan `?port` → added 33.

**Enhetsprobe** (`run/probes/fp-variants.mts`):
- Nekat: `port`, `PORT`, `Port`, `%70ort`, `po%72t`, dubbletter, `?port` utan värde, `hostaddr`, `HoSt`.
- Samma fingeravtryck: annat lösenord och fragment `#?port=1` (som pg också ignorerar).
- Annat fingeravtryck: annan databas eller host/port.
- Kontroll av `pg-connection-string` 2.14.1: query-nycklar läses skiftlägeskänsligt; `database` tas alltid från sökvägen (utom i socket-läge).

**UX-QA-7 (accepterad backlog):** oförändrat beteende. När grinden slås på igen fungerar en icke utloggad kopierad kaka (200). Efter utloggning → 403.

## Status för gamla fynd

| ID | Status | Underlag |
|---|---|---|
| UX-QA-1 (Medium, veckovy) | **Stängd** | 160 px per personalspalt, scroll bara i fokuserbar region, sticky axel, hjälptext, ingen sid-overflow. Kvar: kosmetisk detalj UX-QA-19. |
| UX-QA-2 (Nästa besök) | **Stängd** | Datum visas (`calendar.tsx:115–121`) |
| UX-QA-3 (dubbel länk) | **Stängd** | 1 länk (`new/page.tsx`) |
| UX-QA-4 (capitalize) | **Stängd** | Alla 5 regler borttagna; texten renderas korrekt |
| UX-QA-5 (krocktext) | **Stängd** | `booking-form.tsx:91–95,283` |
| UX-QA-6 (pekytor) | Öppen, dokumenterad backlog | `UI_USABILITY_REVIEW.md:115–117` |
| UX-QA-7 (sessioner överlever grindpaus) | Öppen, dokumenterad backlog; beteendet oförändrat | Doc `:118–121` (se UX-QA-20) |
| UX-QA-8 (testtäckning grind) | Delvis åtgärdad, rest i backlog | E2E täcker nu headers+body+query samtidigt, och enhetstester täcker port. Inga wrapperprober i repot. Doc `:122–124`. |
| UX-QA-9 (testflake hydrering) | **Stängd** | `usability.spec.ts:55–62`: väntar på `toBeEnabled` och `toBeFocused` på nästa dag; slutassert oförändrad |
| UX-QA-10 (ISO-datum admin) | **Stängd** | `editor.tsx:182–186`, `staff/editor.tsx:245–246` |
| UX-QA-11, 12, 14, 15 (Info) | Oförändrade, dokumenterad backlog | Doc `:125–126` |
| UX-QA-13 (seed-dubbletter) | **Stängd för demovägen** | Färsk tom `*_demo` med enbart migrate + demoseed fungerar (se nedan) |
| UX-QA-16 (bildspårbarhet) | **Stängd** | Manifest bundet till full SHA, hashar stämmer, `afterSourceCleanAtCapture=true` |

**QA-13, praktiskt prov:**
- Ny tom `fx_click_demo` med bara `npm run db:migrate` och `BOOKING_DEMO_SEED=1 npm run demo:seed` gav `added 33`, rc=0.
- Resultat: 3 aktiva tjänster, 33 bokningar, 2 kampanjer och `demo-owner@example.test`.
- **Men det finns 3 aktiva medarbetare:** Anna (från migreringen `20261112040000_booking_workspace`), Sofia (demo) och Elias (demo).
- Codex uppger "2 aktiva personer" för molndemon. Det kan jag inte verifiera, och det gäller inte för en lokal färsk databas (UX-QA-21).

## Nya fynd

**Blockerare:** inga.

**Backlog:**

| ID | Allvar | Fynd | Fil:rad | Repro | Fixriktning | Status |
|---|---|---|---|---|---|---|
| UX-QA-17 | Info | Krocktexten bygger på exakt strängjämförelse med domänfelet "Tiden är inte tillgänglig". Om domäntexten ändras faller UI:t tillbaka på den råa texten. | `src/app/booking-form.tsx:92–95` | Kodläsning | Mappa på HTTP-status 409 eller en felkod i stället för text. | VERIFIED |
| UX-QA-18 | Low (härdning) | Fingeravtrycket antar `:5432` när port saknas i DATABASE_URL och godtar tom host (`postgresql:///db`). pg faller då tillbaka på `PGPORT`/`PGHOST` i miljön, så anslutningsmålet kan skilja sig från fingeravtrycket. Kräver operatörskontroll över miljön (samma förtroendenivå som DATABASE_URL), så det är ingen klientattack. | `src/lib/demo-access.ts:18`; `pg/lib/connection-parameters.js:9–23,70–71` | `new URL("postgresql:///fx_gate_demo")` ger fingeravtryck för ":5432/fx_gate_demo"; pg-connection-string ger `host:"" port:""` | Kräv explicit, icke-tom hostname och port i demoläge, eller neka när `PGHOST`/`PGPORT`/`PGHOSTADDR` är satta. | VERIFIED (kod + parsning), ej exploaterat |
| UX-QA-19 | Low (kosmetik) | Den sticky "Tid"-rubriken täcker inte hela rubrikraden och har vit bakgrund mot den gröngrå raden. Vid horisontell scroll syns personalnamn delvis under/bredvid ("…(demo)"). | `src/app/style.css:331–340` (`.calendar-axis-heading`: `align-self:center`, `background:#fff`) | Veckovy Alla 1440, scrolla regionen; se `fx-admin-1440-week-alla-scrolled-crop.png` | `align-self: stretch`, samma bakgrund som rubrikraden (`#f4f7f4`), eventuellt en högerkant. | VERIFIED |
| UX-QA-20 | Info (docs) | Backlogtexten för UX-QA-7 säger "En **outloggad** cookie kan fungera igen". Det stämmer inte: efter utloggning är kakan död (403). Det som lever igen är en **icke utloggad, kopierad** kaka. | `docs/UI_USABILITY_REVIEW.md:118–121` | p-demo-gate D | Formulera om: "en kopierad cookie från en session som inte loggats ut". | VERIFIED |
| UX-QA-21 | Info | En färsk tom `*_demo` med enbart migrate + demoseed ger 3 aktiva medarbetare (Anna från migreringen), inte 2. Veckovyn för "Alla" blir därmed 3 spalter per dag. | `prisma/migrations/20261112040000_booking_workspace/migration.sql`, `scripts/seed-demo.ts` | QA-13-provet | Inaktivera Anna i demoseedet för preview, eller dokumentera 3 personal. | VERIFIED |

## Codex påståenden

| # | Påstående | Klassning | Underlag |
|---|---|---|---|
| 1 | UX-QA-1: ≥160 px per personalspalt, scroll bara i fokuserbar region, sticky tidsaxel, kort hjälptext; en personal ryms som hel vecka, Alla kräver sidscroll | **Bekräftat** | Mätningar ovan (160 px; region 4588/1382; Sofia 1382/1382; sid-overflow 0; tabindex/role/label; pilscroll; sticky) |
| 2 | Nästa besök har datum | **Bekräftat** | 1440/390/320 |
| 3 | Dubbel "Till kalendern" bort | **Bekräftat** | 1 länk |
| 4 | capitalize bort | **Bekräftat** | grep och DOM |
| 5 | Kundkrock förklarar "välj ny tid", utkast kvar | **Bekräftat** | 3 bredder |
| 6 | Bokningsdetalj och schemaundantag har svenska datum | **Bekräftat** | 3 bredder |
| 7 | Tangentbordstestet väntar på enabled/fokus, samma slutassert | **Bekräftat** | Diff `usability.spec.ts`; E2E grön |
| 8 | Två E2E-datumassertioner anpassade, inga regler sänkta | **Bekräftat** | `flow.spec.ts:173–177` och `workspace.spec.ts:244`: samma Stockholmszon, exakt tid kvar, bara svenskt format. Obs: den nya bredd-assertionen är ≥150 px fast 160 påstås (se saknade tester). |
| 9 | Grindrättning: `?port=` nekas, med negativa tester; E2E täcker injektion via headers/body/query samtidigt | **Bekräftat** | `demo-access.ts:12`, `demo-access.test.ts:41–42`, `usability.spec.ts` (query+headers+body); egna HTTP-prober 66/66 |
| 10 | Auth, limiter, domän, MCP och migreringar orörda sedan dd98ae4 | **Bekräftat** | Fullträdsdiff: 14 filer, listade ovan |
| 11 | QA-13: tom `*_demo` + migrate + demoseed fungerar utan grundseed | **Bekräftat**; "2 aktiva personer i molndemon" **ej verifierbart** | Lokalt 3 aktiva (UX-QA-21) |
| 12 | UX-QA-6/7/8 och Info 11/12/14/15 är dokumenterad backlog | **Bekräftat** | `UI_USABILITY_REVIEW.md:113–126`. Formuleringsfel i UX-QA-7-texten (UX-QA-20). |
| – | Codex: lint/tsc/build + unit 75 PASS; integration/E2E pågick | Bekräftat i min körning | 75/75, 75/75, E2E 32/32 prod0 och dev0 |

## Saknade tester

1. **Bredd-assertionen** i `usability.spec.ts` kräver ≥150 px; skärp till ≥160 px, som är det som påstås.
2. **Ingen E2E för scroll i regionen:**
   - att Alla med fler än 2 personer har `scrollWidth > clientWidth` inne i regionen;
   - att en enskild personal inte scrollar;
   - att pil höger ökar `scrollLeft`;
   - att tidsaxeln är sticky.
3. **UX-QA-8-rest:** inga HTTP-prober genom wrappern i Vercel-läge i repot (positiv väg 200 + kaka, `x-real-ip` 400, limiter 429, varianterna av `?port` på serversidan).
4. **Ingen test för en färsk tom `*_demo`** (enbart migrate + demoseed), som QA-13 bygger på.
5. **Inget test för UX-QA-18** (saknad port / tom host).

## Städning

- Servrar (3410/3411, E2E 3000) och Postgres 55611 är stoppade. Inga lyssnare eller processer finns kvar (kontrollerat med `ss`/`pgrep`).
- Lösenordsfilen för admin är raderad.
- Inga kakor, tokens eller lösenord finns i bilder eller rapport.
- Probefiler finns bara i `run/probes/`.
- Hjälpkopian `run/click/` (enbart använd för QA-13-seedet) innehåller min egen genererade `.env`. Den byggde inte (Turbopack godtar inte symlänkade node_modules), så klickservern kördes från `run/work` med `DATABASE_URL` överstyrd till `fx_click_demo`.

## Tillägg 18:51 – Codex egen observation (UNVERIFIED av QA)

Codex rapporterar en horisontell wheel-scroll på 2400 px i 1440-vyn med 4 personal. Utfall: regionLeft 28, axisLeft −1041, gridWidth 1382 och gridScroll 4588. Den sticky tidsaxeln begränsas alltså av en för smal grid-box och följer inte med längre ut åt höger. Det finns ingen sid-overflow och inga bokningsfel. Codex logg och bild (desktop-scroll-probe.json/.png) har inte lästs av QA, och ingen ny körning är gjord.

QA:s egen probe scrollade bara ett kort steg med piltangenten och upptäckte därför inte felet. Påståendet "tidsaxel sticky" (UX-QA-1, Codex claim 1) ändras från bekräftat till **motsagt av Codex egen mätning vid lång scroll, ej omverifierat av QA**.

- **UX-QA-22 (Low, UX/tillgänglighet):** den sticky tidsaxeln släpper vid lång horisontell scroll. Orsaken är att grid-boxens bredd (1382 px) är mindre än scrollbredden (4588 px).
  - Riktning, enligt Codex förslag: `width: max-content; min-width: 100%` på grid.
  - Lägg till en E2E-regression med 4 personal som scrollar till slutet och assertar att axeln står kvar vid regionens vänsterkant.
  - Felet är ingen preview-blockerare: inga data- eller säkerhetsfel, och axeln saknas bara visuellt.

Slutbedömningen är oförändrad: GO för skyddad syntetisk preview, NO-GO för pilot. Ett varv 2 begränsat till denna CSS-rättning plus regressionen är rimligt, med en riktad omkontroll av endast den diffen. Granskningen av den frysta f737ed2 är avslutad, och ingen körning pågår.
