# QA-rapport – sista riktade omkontroll, UX-rättningsvarv 2 av 2 (d7bc47f)

- **Revision:** `d7bc47f5596cc8be06e58603fe2f32457c6b0fa0`.
- **Zip:** `ui-d7bc47f/booking-ui-fix2.zip`, sha256 `668b76024a934011478d633ec324c72037e1ca068a2d7b19469811bab022276b`.
  - Zipkommentaren är full SHA, och arkivet har 249 poster (205 filer).
  - Den enda env-filen är `.env.example`.
  - **Allt detta är verifierat av mig.**
- **Jämförelsebas:** f737ed2 (`booking-ui-fix1.zip`) och föregående rapport `QA-REPORT-ui-fix1-f737ed2.md` (sha256 `6a70cd90…4adb2e`, inklusive tillägget om UX-QA-22). Kopian i `docs/qa/` är identisk.
- **Bevisfiler från Codex:** `evidence/desktop-scroll-probe.json/.png` (före) och `desktop-scroll-fix2.json/.png` (efter). Jag har läst och tittat på dem.
- **Tid:** 2026-11-12, cirka 19:07–19:20 CET.
- **Avgränsning:**
  - **EN körning** i `ui-d7bc47f/run/`.
  - Postgres 127.0.0.1:55621 med TZ Europe/Stockholm.
  - Klickserver på 3420. Playwrights egen E2E-server på 3000.
  - Egen admin `d7-qa-admin@example.test` via `admin:manage`.
  - Endast syntetiska data. Originalet är orört.
  - Ingen deploy, push eller merge, och inga hemligheter eller kakor i rapport eller bilder.

## Beslut

**Bunden GO för en skyddad, syntetisk preview. Pilot: NO-GO** (inte bedömt; kräver bl.a. fysisk iPhone och separat granskning).

- **Blockerare:** 0.
- **UX-QA-22:** stängd.
- **UX-QA-19:** oförändrad backlog.
- **Nya fynd:** UX-QA-23 och UX-QA-24, båda Info och backlog. Ingen tredje fixloop.

## Diff f737ed2 → d7bc47f (hela trädet, LF-normaliserat) – VERIFIED

Ändrade filer (`run/logs/changed-files.txt`), 4 st:

1. **`src/app/style.css`:** enda produktändringen.
   ```css
   .calendar-grid {
     display: grid;
     width: max-content;
     min-width: 100%;
   }
   ```
2. **`tests/e2e/usability.spec.ts`:** ett nytt test, "bred veckokalender behåller tidsaxeln vid sidscroll".
3. **`docs/UI_USABILITY_REVIEW.md`**
4. **`docs/qa/QA-REPORT-ui-fix1-f737ed2.md`** (ny; min rapport, identisk hash)

**Ingen ändring** i JS/TS-produktlogik, auth, limiter, MCP, `package.json`/lock, `prisma/` (schema eller migreringar) eller wrapper.

Därför gäller mina 66/66 demo-grindprober på f737ed2 fortfarande. De är inte omkörda.

**Docs:**
- Formuleringen om utloggade cookies är rättad: "kopierad cookie från en session som inte loggats ut … Utloggade sessioner förblir återkallade". Det stänger UX-QA-20.
- Att migreringen skapar Anna är förklarat (UX-QA-21).
- UX-QA-17, 18, 19 och 21 står som backlog. UX-QA-20 är åtgärdad genom själva rättelsen.

## Automatiserat (egen körning, färska databaser) – VERIFIED

| Steg | Resultat |
|---|---|
| `npm ci` | PASS (571 added / 572 audited) |
| generate, migrate, seed | PASS |
| lint | PASS |
| tsc | PASS |
| unit | **75/75 PASS** |
| build | PASS |
| Nytt test, production | **2/2 PASS** (projekten desktop och mobile) |
| Nytt test, dev | **2/2 PASS** |
| Hela E2E-sviten, production, en gång | **34/34 PASS** (41,3 s) – stämmer med Codex förväntan på 34 |
| RateLimitBucket efter respektive körning | **0 rader** (nytt test prod: 1 insert; dev: 1; hela sviten: 30) |

**NOT RUN (enligt avgränsningen):**
- integration, audit och demo-grindmatrisen;
- E2E dev1/prod1;
- mutationsprov av det nya testet mot f737ed2-CSS;
- fysisk iPhone, Firefox/WebKit, riktig preview.

## Egen verklig lång sidscroll i 1440x900, 4 personal, "Alla" – VERIFIED, PASS

**Uppsättning:**
- Databas `d7_click_demo` byggd med enbart migrate + `BOOKING_DEMO_SEED=1 npm run demo:seed`. Det gav Anna, Elias och Sofia.
- En fjärde medarbetare skapades via UI:t: "Kim Långnamnsson (QA)".
- Resultatet blev 28 personalspalter i vecka 47.
- Ingen programstyrd `scrollTo` användes.
- Probe: `run/probes/d7-scroll.mjs`. Logg: `run/logs/d7-scroll.json`.

**Mus/hjul** (`page.mouse.wheel(300,0)`, 12 steg till slutet):

| Punkt | scrollLeft/max | regionLeft | axisLeft | "Tid"-rubrik | gridWidth | scrollWidth | Sid-overflow | Element vid axeln |
|---|---|---|---|---|---|---|---|---|
| start | 0/3206 | 28 | 29 | 29 | 4588 | 4588 | nej | calendar-axis |
| 4 steg | 1200 | 28 | 29 | 29 | 4588 | 4588 | nej | calendar-axis |
| 8 steg | 2400 | 28 | 29 | 29 | 4588 | 4588 | nej | calendar-axis |
| slut | **3206/3206** | 28 | **29** | 29 | 4588 | 4588 | nej | calendar-axis |

**Tangentbord:**
- Tab från personalfiltret når regionen ("Veckokalender").
- Upprepad pil höger: 25 tryck ger 976, 50 ger 1977, 75 ger 3000 och 100 ger **3206 (slutet)**.
- axisLeft är 29 hela vägen, utan sid-overflow.
- Home och End flyttar **inte** horisontellt; End scrollar sidan vertikalt (UX-QA-23).

**Jämförelse med Codex bevis:**
- Före-filen anger axisLeft −1041 och gridWidth 1382. Min egen f737ed2-probe scrollade bara 200 px och såg därför inte felet.
- Efter-filen anger axisLeft 29, gridWidth 4588 och gridScroll 4588, vilket **stämmer exakt** med min mätning.

**UX-QA-19 – oförändrad (backlog):**
- "Tid"-rutan är 41 px hög medan dagrubriken är 67 px.
- Rutan har vit bakgrund mot rubrikradens rgb(246,248,244).
- "…(demo)" syns delvis under rutan vid scroll (`run/shots/d7-1440-wheel-end-corner.png`).

**En personal (Sofia):** 7 spalter à 181 px, gridWidth = scrollWidth = clientWidth = 1382. Ingen scroll, och hela veckan ryms.

**Mobil 390 och 320 (vecka och dag):**
- desktopregionen är dold och kortlistan visas (10 kort i veckovyn, 3 i dagvyn);
- `scrollWidth` = viewport, ingen overflow;
- inga omärkta kontroller och ingen engelsk text.

Layouten är oförändrad.

## Granskning av det nya testet (`usability.spec.ts:143–195`)

- **Tangentbordsdelen är äkta:** testet fokuserar regionen och anropar `keyboard.press("ArrowRight")`, och pollar sedan att `scrollLeft > 0`. Det är ett riktigt tangentbordsprov, men bara ett steg.
- **`scrollTo` är tydligt avskild:** det sker efter tangentbordsdelen, med en kommentar som förklarar att det är deterministiskt för att undvika animationsflakighet. Därefter pollas att `scrollLeft ≥ end − 1`.
- **Asserterna stämmer med påståendet:**
  - 28 personalspalter (4 personal);
  - `end > 1800`;
  - axeln inom 2 px från regionens vänsterkant vid slutet;
  - ingen sid-overflow.
  - Med f737ed2-CSS skulle axeln stå på −1041, alltså bör testet fånga regressionen. Själva mutationsprovet är NOT RUN.
- **Svagheter (Info, UX-QA-24):**
  - antalet 28 är hårdkodat och beror på att grundseeden har exakt 2 personal;
  - "Tid"-rubriken och `gridWidth` asserteras inte;
  - testet körs även i mobile-projektet, men sätter 1440 där, så det är en dubblett av desktop.
  - Testet skapar syntetisk personal som spåras för städning, och 0 limiter-rader blev kvar.

## Status

| ID | Status |
|---|---|
| UX-QA-22 (sticky axel släpper vid lång scroll) | **Stängd**, VERIFIED (hjul och tangentbord ända till slutet) |
| UX-QA-19 ("Tid"-hörnet) | **Oförändrad**, dokumenterad backlog |
| UX-QA-20 (docs-formulering) | **Stängd** |
| UX-QA-1–5, 9, 10, 13, 16 | Fortsatt stängda (ingen relevant kodändring) |
| UX-QA-6–8, 11, 12, 14, 15, 17, 18, 21 | Oförändrad backlog |

## Nya fynd (endast backlog)

| ID | Allvar | Fynd | Fil:rad | Riktning |
|---|---|---|---|---|
| UX-QA-23 | Info | Home och End scrollar inte veckoregionen horisontellt. Det krävs cirka 100 tryck på pil höger (32 px per tryck) för att nå slutet med 4 personal. Webbläsarstandard, inte påstått. | `src/app/admin/calendar.tsx` (regionen, `tabIndex=0`) | Valfritt: Home/End-hantering eller dagankare "Hoppa till dag". |
| UX-QA-24 | Info | Det nya testet har hårdkodat 28 spalter (beroende av grundseeden), asserterar inte "Tid"-rubriken eller `gridWidth`, och körs dubbelt i mobile-projektet. | `tests/e2e/usability.spec.ts:171,186–192` | Beräkna förväntat antal från API:t, asserta även `.calendar-axis-heading` och begränsa testet till desktop-projektet. |

## Codex påståenden

| Påstående | Klassning |
|---|---|
| Produktdiffen är endast `width:max-content; min-width:100%` på `.calendar-grid` | **Bekräftat** |
| Nytt beteendetest i `usability.spec.ts` samt docs och originalrapport | **Bekräftat** |
| Ingen ändring i JS/TS-logik, auth, MCP, beroenden, schema eller migreringar | **Bekräftat** (fullträdsdiff, 4 filer) |
| Eget wheel-prov: före axisLeft −1041 / gridWidth 1382; efter 29 / 4588, ingen sid-overflow | **Bekräftat för "efter"** genom egen mätning. "Före" stämmer med Codex bevisfil; ej omkört av mig. |
| Testet: först riktig pil höger, sedan deterministisk `scrollTo`, klart åtskilda | **Bekräftat** |
| Docs: rättad cookie-formulering, Anna redovisad, Low 17–21 listade | **Bekräftat** (UX-QA-20 rättad i stället för listad) |
| lint/tsc/build/unit 75 PASS | **Bekräftat** |
| 34 E2E per läge | **Bekräftat för production** (34/34). Övriga lägen: ej körda av mig. |
| Den nya previewprofilen har explicit host och port 5432; Actions 43275980287 | **Ej verifierbart** (ingen drift- eller GitHub-åtkomst) |

## Bilder och städning

- **Bästa bilder:**
  - `run/shots/d7-1440-wheel-end.png`: hjulscroll till slutet, där axeln står kvar.
  - `run/shots/d7-1440-wheel-end-corner.png`: hörnet med UX-QA-19.
- **Övriga bilder:**
  - `d7-1440-keyboard-end.png`, `d7-1440-one-staff.png`;
  - `d7-390-week.png`, `d7-390-day.png`, `d7-320-week.png`, `d7-320-day.png`.
- Klickserver 3420, E2E-server 3000 och Postgres 55621 är stoppade. Inga lyssnare eller processer finns kvar.
- Admins lösenordsfil är raderad.
- Den enda körningen är avslutad.
