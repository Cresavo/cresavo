# QA-rapport – UI-polish 268ebdf (ui/salon-polish)

**Revision:** `268ebdfa3a1d42ef241e654bb2f511c96db8db9c` (gren ui/salon-polish, bas 2c74a4b / produkt 51d54d4)
**Granskare:** Grok Bot (QA, oberoende körning) · **Datum:** 2026-11-13 (Europe/Stockholm)
**Omfång:** syntetisk lokal kopia, `@example.test`, inbäddad Postgres som icke-root i isolerad netns, testvakt aktiv, TZ=Europe/Stockholm, `env -u NODE_ENV`. Inga original, ingen PC, ingen preview/server, inga hemligheter/cookies, inga riktiga utskick.

## 1. Indata och hashar

| Artefakt | sha256 | Kontroll |
|---|---|---|
| Brief (QA-BRIEF-polish-268ebdf.md) | `394c0ef1aad8d65a0305fa656346e15d7042309be7c099124c7fc865692295b7` | OK |
| Kodzip | `55adcd04129b3cd64790a986ef294f9b2d9d549783ea8eaaf22841c79d72e5ab` | 4 577 196 B, kommentar = 268ebdf…, 690 poster, enda env-fil `.env.example` (+ tillåten `docs/calendar-proof/private.json`) |
| Evidenszip (Codex) | `3b2aa0f25b202f2be87b695d7c64980e9f8ea6043ce2f45f87e4670855f5606e` | 467 688 B, 19 poster |
| Egen probe `probes/ux5.mjs` | `d41987130066430e3afa0df7f642933948ea8ab3f79dec664029326154647c95` | |
| Egen klicklogg `logs/ux5.txt` | `eba260e1089293639dd940a759c85a99ce660ac168be56c7720a0ad2e7c63c90` | |
| Källdiff `logs/polish-src.diff` | `066d301c3a9984d049ae3f759bd391aa398e947803e51fc23dcf887a7102f7a2` | 269 rader |
| Fillista `logs/diff-vs-51d54d4.txt` | `16ea873c0b81521d9d4ea0425547cae2bda7ec6b8521f5cdc203f901c84c739f` | |

## 2. Beslut (avgränsat)

- **Syntetisk lokal UI-polish 268ebdf: NO-GO tills UP-QA-1 är åtgärdat** (en riktad fixrunda). Allt annat i matrisen och klickgranskningen är grönt; UP-QA-1 bryter briefens krav att korta besök ska expandera *”i stället för att täcka nästa besök”* och leder till att fel bokning öppnas med mus.
- Efter fix av UP-QA-1 (+ helst UP-QA-2 och Codex riskhypoteser i samma runda): förväntat GO för syntetisk lokal, förutsatt att omtest är grönt.
- **Pilot, fysisk iPhone/Safari och ägarens UX-acceptans: NO-GO / separat** – inte prövat här.

## 3. Avgränsad diff mot 51d54d4

Jämfört mot verifierat orörd 51d54d4-källa.
- Kod ändrad: `src/app/admin/calendar.tsx`, `src/app/components/header.tsx` (logomärke + ordmärke), `src/app/admin/overview/overview.tsx`, `src/app/admin/overview/page.tsx`, `src/app/layout.tsx` (import). Ny: `src/app/workspace-polish.css` (688 rader), `tests/e2e/polish.spec.ts` (2 tester).
- Dokument: AGENTS, README, docs/*, ny `docs/UI_POLISH_PLAN.md`, `docs/qa/QA-REPORT-coherent-f1-51d54d4.md` (identisk med min rapport efter CRLF→LF, sha `f22d2d84…`).
- **Ingen** ändring i API-rutter, `src/lib`, MCP, auth, scripts, Prisma-schema, migrationer (fortfarande 10), package.json eller lockfil. Samma regler och säkerhet återanvänds – bekräftat.
- UI-diffen: personalfärger via `data-tone` (index % 4), `hourHeight` 96→144, bokningshöjd `Math.max(10, …)` (tidigare min 44), `data-compact` < 25 min, fullt `aria-label`/`title`, sidomeny från 1180 px (fast, 224 px), kapacitetsrutnät i två kolumner, ”Om förslagen”, `data-state` på kort.

## 4. Egna körningar (förstahand, 2026-11-13 23:22–23:35 CET + klick därefter)

| Steg | Resultat |
|---|---|
| npm ci | rc 0 |
| prisma generate / migrate (10) / seed / lint / tsc | PASS |
| unit | 102/102 |
| integration | 125/125 (efterkontroll: rlb=8, övrigt 0) |
| MCP/agentworkday-kort | 13/13 |
| build | PASS |
| npm audit | 7 moderate (dev), rc 1; `--omit=dev` 0, rc 0 |
| e2e prod proxy0 / prod proxy1 / dev proxy0 / dev proxy1 | 58/58 i varje läge |
| polish.spec + coherence.spec, `--repeat-each=2`, dev0 | 20/20 två gånger |
| Städräkning efter varje e2e | 0 |
| **Egna Chromium-klick (ux5, prod `next start`)** | **156 PASS / 5 FAIL** (alla 5 = UP-QA-1/UP-QA-2) |

Probefel som rättades och kördes om (räknas inte som produktfel): menyposter i stängda `<details>` räknades som täckta; objekt i kalenderns scroller räknades som utanför; `check()` på självskickande kryssruta; 10:05-luckan fanns inte med standardschemat (fixtur med 5-min-perioder lades till); och i sista omkörningen räknades ”Skriv datum med tangentbord” som täckt fast den ligger i en stängd yttre `<details>`. Filtret går nu igenom alla förfäder, och de tre N-felen försvann.

### Klickresultat per område (emulerad Chromium, Playwright)
- **Navigering/brytpunkt (320/390/1024/1179/1180/1181/1440):** 1179 har statisk header, 1180/1181/1440 har fast sidomeny (224 px), och main börjar vid 224. Primärnavigationen är 101×54 (320), 119×54 (390), ~86–100×44 (1024) och 191×45 (1440). PASS.
- **Menyer Salongen/Konto (320/390/1179/1440):** Enter öppnar; alla poster är i vy, överst och ≥44 px. Escape stänger med fokus tillbaka. Tab ut stänger. Klick utanför stänger. Navigering fungerar. Vid 1440 syns ”Logga ut” i vy. PASS.
- **Kalenderverktyg (390/1440):** pilar med aria-label, dag/vecka, personalfilter, ”Visa avbokade” och datumväljare (i vy, överst, val navigerar). PASS.
- **Korta bokningar:** tre 5-minutersbokningar (10:00, 10:05, 10:10) skapades via admin-UI. Verklig höjd ≈ 10 px, ingen överlappning, fullt namn och title (”10:00–10:05 · QA kort besök · QA Kort 10:00”). Tangentbordsfokus expanderar till 82 px med 12 px text, överst och oklippt. Fokus→Enter öppnar rätt bokning. Touch-tryck mitt på 10:05 vid 1024 öppnar 10:05. Mobilagendan (390) visar alla tre med full text och ≥44 px. PASS. **FAIL:** hover täcker nästa besök (UP-QA-1) och målstorleken är 10 px (UP-QA-2).
- **Bokningsdetalj (390):** Flytta→välj tid→Avbryt sparar inget och fokus hamnar på Flytta. Avboka→Behåll behåller. Inga täckta kontroller och inget överflöde. Verklig flytt och avbokning sparades (status cancelled, version 3). PASS.
- **Retur/scroll (CS-QA-1/2-regression):** bokning→kund→bokning→”Till kalendern” och webbläsarens Bakåt återställer scrollen exakt (390: y 2126; 1440: y 1339, x 300). PASS.
- **Kunder/tjänster/personal/kampanjer (320/1440):** sökningen ”Mira” behålls vid retur. Inget överflöde och inga täckta eller utanförliggande kontroller. PASS.
- **Översikt (390/1179/1440):** 1 kolumn (390, 1179) och 2 kolumner (1440). ”Om förslagen” öppnas med tangentbord och förklarar. Statusetiketterna stämmer med `data-state` (new/stale/dismissed/draft). Inget överflöde. PASS.
- **Förslag→granska→utkast:** kortet visar ”Utkast sparat” med `data-state=draft`, och CapacityDecision.outcome = draft (sanningsenligt). Granskningslänken fokuserar H2 i kampanjer. ”Till översikten” återvänder. PASS.
- **Kundbokning (320/390/1440):** bekräftelsen är synlig, fokuserad och otäckt. ”Boka en ny tid” fokuserar #service. Inget horisontellt överflöde. PASS.
- **Kontrast WCAG AA (inkl. personalfärger, sammansatta bakgrunder):** alla PASS. Lägsta värden: kalender vecka 1440 4.66, kundbokning 390 5.08, kompakta kort 5.48, översikt/kunder/mobilkalender 5.1. Toner: 0 `#284d83`/`#edf3fd`, 1 `#655080`/`#f3eef9`, 3 `#805c28`/`#fbf3e7`.
- **Små mål (<24 px) i kontrollgranskning:** endast kryssrutor 22×22 (se riskhypotes 3) och 5-minuterskort 10 px.

### UX-bedömning (ärlig)
Arbetsytan är tydligt mer professionell: sidomenyn från 1180 px ger lugn struktur, verktygsraden är kompakt och läsbar, översikten i två kolumner med ”Om förslagen” och sanna statusar är en klar förbättring, och kontrasten håller. Svagheten sitter i det polishen ville lösa: korta besök återges nu i sann skala (10 px), vilket är ärligt men svårträffat med mus och touch. Hover-expansionen på 82 px lägger sig dessutom över nästa besök. Personalen ser 10:05 men klickar på 10:00. Med tangentbord, och i mobilagendan, fungerar det bra.

## 5. Codex-evidens (granskad, inte egen)
- `visual-manifest.json`: 3 före-bilder (51d54d4, från gammal molnpreview) och 7 efter-bilder (268ebdf, lokal syntetisk). Alla sha256 stämmer och storlekarna matchar. `physicalIphone: false` (korrekt).
- full-unit 102, full-integration 125, ui-cards 13. Detta stämmer med mina egna körningar.
- initial-focused-ui 2 fail / 24 pass → focused-ui 26 pass. Codex redovisar alltså öppet ett första rött försök. Build exit 0, npm ci 211 s.
- Codex polish.spec testar fokus/Enter (gröna även hos mig) men **inte** hover-täckning eller 24 px-målstorlek. Därför missades UP-QA-1/2.

## 6. Fynd (egna)

### UP-QA-1 – Medium – BLOCKER: hover-expansion täcker nästa besök och stjäl klick
- **Fil:** `src/app/workspace-polish.css:326-334` (`.calendar-booking:hover, :focus-visible { z-index:6; min-height:82px; … }`) tillsammans med `src/app/admin/calendar.tsx:369-373` (höjd `Math.max(10, …)`).
- **Repro (1440 och 1180, dagvy, QA Korttid 2026-11-19, bokningar 10:00/10:05/10:10):** hovra 10:00 → kortet växer till 82 px över 10:05 och 10:10. För pekaren nedåt till där 10:05 syntes och klicka → `/admin/bookings/<10:00-id>` öppnas i stället för 10:05. Skärmbild `S-hover-covers-next-1440.png`.
- **Strider mot briefen** (”i stället för att täcka nästa besök”).
- **Fix:** expandera inte i flödet över grannar vid hover. Visa detaljen som en icke-interaktiv tooltip/popover utanför kolumnen (`pointer-events:none`), eller begränsa expansionen till `:focus-visible`. Alternativt ge kompakta kort minst 24 px med kollisionsmedveten layout (lanes/stapling) så att de inte överlappar. Lägg till ett e2e-test: hovra 10:00, klicka på 10:05:s ursprungliga mittpunkt och förvänta 10:05.

### UP-QA-2 – Low (åtgärda i samma runda): 5-minuterskort är 10 px höga mål
- **Fil:** `src/app/admin/calendar.tsx:369-373`, `src/app/workspace-polish.css:318-325`.
- **Repro:** 1440/1180/1024 dagvy, mät `getBoundingClientRect` på 5-minuterskort: höjd 10 med 12 px avstånd. WCAG 2.5.8 (24×24 eller avståndsundantag) uppfylls inte. Avståndsundantaget faller eftersom 24 px-cirklar kring 12 px-delningen överlappar. Mittryck i emulerad touch träffade rätt, men marginalen är 5 px.
- **Fix:** minimihöjd 24 px för kompakta kort plus layout som undviker överlapp (t.ex. sidoställda lanes när besök ligger tätare än 24 px), eller en tydlig ”+N korta besök”-samlare. Behåll fullt aria-label/title.

### UP-QA-3 – Info: kompakt korttext klipps
- 10 px-kort med 10 px text visar i praktiken bara början av tiden. Namnet och title är fullständiga, så det är OK för skärmläsare. Löses av UP-QA-2.

### UP-QA-4 – Info: Dag/Vecka-växlare 38 px
- `src/app/workspace-polish.css:234` (`.calendar-views a { min-height:38px }`). ≥24 px uppfyller AA men inte projektets 44 px-mål. Detta är **kodläsning**; probens <24-granskning flaggade det inte.

### UP-QA-5 – Info: personalton upprepas och personal saknas i kortnamn
- `calendar.tsx:354-359`: `% 4` ger samma färg för personal 1 och 5. Desktop-kortets `aria-label` saknar personalnamn (kolumnrubriken ger kontext i dagvy). Backlog.

## 7. Codex riskhypoteser (Codex kodläsning – mina mätningar, hålls åtskilda från egna fynd)

Uppmätt i samma klicksession (emulerad Chromium, prod-build).

| # | Hypotes (Codex) | Mätning 320 | Mätning 390 | Mätning 1440 | Kommentar |
|---|---|---|---|---|---|
| 1 | Admin-fält 14 px på mobil (möjlig iOS-fokuszoom) | 14px på alla kontrollerade fält | 14px | 14px | Fält: calendar-date-manual, calendar-staff, customer-search, staff-name, veckodagstider, tjänstefält, ny bokning. Källa `workspace-polish.css:117,144,253,625`. **Fokuszoom i Safari är NOT RUN** – den påstås inte inträffa. iOS Safari zoomar normalt vid <16px, så hypotesen är rimlig men obekräftad. |
| 2 | Kalenderhjälpens summary 36 px (tidigare 44) | 166.3×36 | 166.3×36 | 166.3×36 | Bekräftat 36 px (`workspace-polish.css:169`). ≥24 px (AA), men under 44 px-målet. |
| 3 | Kryssruta 22 px (tidigare 24), etiketten 44 px | Kalender: ruta 22×22, etikett 258×44 | ruta 22×22, etikett 328×44 | ruta 22×22, etikett 117.7×44 | Kalenderns etikett är 44 px och ett klick på etikettens bortre kant växlar rutan – OK (`workspace-polish.css:146`). |
| 3b | (samma regel, kundlistan) | Kunder ”Visa även arkiverade”: ruta 22×22, **etikett 182×29** | 182×29 | 182×29 | **Inte 44 px.** `src/app/admin/customers/page.tsx:82-90`. Etiketten växlar rutan, så målet blir 29 px ≥24 (AA) men under 44 px-målet. |

## 8. Blockers vs backlog
- **Blocker (fixrunda 1):** UP-QA-1.
- **Samma runda (rekommenderat):** UP-QA-2, riskhypotes 1 (16 px på admin-fält under 768 px), 2 (summary 44 px), 3/3b (24 px kryssruta, kundetikett ≥44 px).
- **Backlog:** UP-QA-3 (löses av 2), UP-QA-4, UP-QA-5, 7 moderate dev-audit (oförändrat).

## 9. NOT RUN
Fysisk iPhone/Safari (inklusive fokuszoom), WebKit- och Firefox-motorer, riktig Chrome på enhet, skärmläsare (VoiceOver/NVDA), UX-klick i dev-läge (dev täckt via e2e-matrisen), video, riktig molnpreview/server, pilot och ägarens UX-acceptans.

## 10. Skärmbilder (emulerad Chromium, syntetisk data – inte fysisk enhet)
I `polish-268ebdf/run/shots/`: N-calendar-{320,390,1179,1180,1440}, M-{Salongen,Konto}-{320,1440}, S-focus-expanded-1440, S-hover-covers-next-1440, S-mobile-agenda-390, B-detail-390, K-staff-1440, O-overview-{390,1179,1440}, O-draft-focused-1440.

## 11. Städning
PG och appen är stoppade. Temporära sockets och hemligheter i /tmp, `work/.env`, `work/node_modules`, `work/.next` och alla pgdata-kataloger raderas efter rapporten. Loggar, probe och skärmbilder behålls.
