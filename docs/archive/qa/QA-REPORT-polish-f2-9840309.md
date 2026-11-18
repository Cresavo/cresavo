# QA-rapport – UI-polish rättningsvarv 2 av 2 (9840309, slutlig riktad kontroll)

**Revision:** `9840309df4d8addc3e4bf5f6c5da0f3802eb4a2d` (ui/salon-polish, efter 1c1ff5a)
**Granskare:** Grok Bot (QA, oberoende) · **Datum:** 2026-11-14 00:31–00:45 (Europe/Stockholm)
**Omfång:** smal kontroll enligt brief.
- **Miljö:** syntetisk lokal kopia, `@example.test`, inbäddad Postgres som icke-root i isolerad netns med testvakt, TZ=Europe/Stockholm, `env -u NODE_ENV`. Inga original, ingen preview/server, inga hemligheter/cookies och inga riktiga utskick.
- **Återanvänt:** min F1-geometri (QA-REPORT-polish-f1-1c1ff5a.md, sha `ff149fb3…cdb8`) och min fulla core-QA av 268ebdf (sha `7031512a…2e32c`).
- Ingen fixbeställning skrivs, eftersom detta är sista varvet.

## 1. Indata och hashar

| Artefakt | sha256 | Kontroll |
|---|---|---|
| Brief | `f6ccb8fc2e34514e7957cfb02241d1fca952541af9211036988fb321ab70884d` | läst först |
| Kodzip | `477e2e5ac4c7e4190b1ef85af2baa39634aa4ef46de8636b72b852729b2ca201` | 4 596 797 B, kommentar = 9840309…, 695 poster, enda env-fil `.env.example` (+ tillåtna `docs/calendar-proof/private.json` och två `*secret-scan.json`) |
| Evidenszip (Codex) | `01ad1e157280d4cc676b0ab2b393ed5e2120b1fc2bdbcef5fde4181ff4af51f2` | 20 034 B, 10 poster |
| Jämförelsebas 1c1ff5a | — | verifierad orörd mot 1c1ff5a-zip (`diff -rq` tom) |
| Källdiff `logs/polish-f2-src.diff` | `3ce400b8492ee623f39724e19ba878fb01914a34379afb8a6192b642247b31b8` | 286 rader |
| Fillista `logs/diff-vs-1c1ff5a.txt` | `3c3f371a65f878742552fa305801d679893d1aecde39454d36aa9252502fb5c2` | 4 rader |
| Egen probe `probes/ux7.mjs` | `9bb1a79fe65aebe28d7f91ddcbd2bc02c365bcaeee5306bebf45925b41c3a51d` | ux6 med samma fixtur och utökad kontrastdel |
| Egen klicklogg `logs/ux7.txt` | `bc20e5d4f93cf1c090288cda67591c77cd48287367dd8ceb64a5883a4535bfda` | |

## 2. Beslut (avgränsat)

- **Syntetisk lokal UI-polish 9840309: GO.**
  - UP-F1-QA-1 är stängd och verifierad i renderad Chromium.
  - Inga öppna fynd på nivån Medium eller högre.
  - Kvarvarande punkter är Info/backlog.
- **Pilot, fysisk iPhone/Safari och ägarens UX-acceptans: NO-GO / separat.** Inget av det är prövat här.
- Full slutmatris 58×4 och CI på exakt denna SHA är **Codex ansvar och inte verifierade av mig**. Mitt GO förutsätter att de är gröna.

## 3. Avgränsad diff mot 1c1ff5a

Fyra filer skiljer sig:
1. `src/app/workspace-polish.css`: **den enda produktändringen.** Tre rader är borttagna, nämligen `.calendar-booking > span:last-of-type { opacity: 0.88; }` (tidigare rad 315–317). Inget annat i filen är ändrat.
2. `tests/e2e/polish.spec.ts`: ny kontrastkontroll (rad 181–211) och en extra syntetisk personal, ”BA Palette Demo”, så att testpersonalen hamnar på ton 3.
3. `docs/UI_POLISH_PLAN.md`: nytt avsnitt om varv 2.
4. Ny `docs/qa/QA-REPORT-polish-f1-1c1ff5a.md`: byte-identisk med min rapport efter CRLF→LF (sha `ff149fb3…cdb8`).

Följande är **byte-identiskt** med 1c1ff5a: geometri (`calendar-layout.ts`, `calendar.tsx`), core, API, `src/lib`, MCP, auth, schema, de 10 migrationerna, package.json och lockfil. Bekräftat med `diff -rq`.

**Det nya E2E-testet mäter verkligt renderat utfall:**
- Det läser `getComputedStyle` på kortets sista synliga `span` (kundraden): `color` och `opacity`, samt kortets renderade `backgroundColor`. Därefter alfa-kompositerar det och räknar WCAG-kvoten.
- Gränsen är oförändrad, `toBeGreaterThanOrEqual(4.5)`. Den är inte sänkt.
- **Begränsningar (Info):**
  - Endast kundradens egen opacity mäts, inte förfädernas.
  - Endast ton 3 testas.
  - Fixturen förutsätter att grundseeden ger rätt palettindex.
  - Min probe täcker alla tre punkterna (se avsnitt 4).
- **Egen negativkontroll:** jag lade tillbaka opacity 0.88 i min arbetskopia och körde specen i dev. Den gav **FAIL 2/4 med `Received: 4.26679440557843`**. Efter återställning (`cmp` mot zip-källan OK) är specen grön.

## 4. Egna körningar (förstahand)

| Steg | Resultat |
|---|---|
| npm ci / prisma generate / lint / tsc | PASS (00:33) |
| unit | 106/106 |
| build | PASS (byggd CSS saknar opacity-regeln) |
| polish.spec, prod, proxy0 (netns) | **4/4 PASS** (inkl. den nya kontrastkontrollen, desktop och mobil) |
| polish.spec, dev, med opacity 0.88 återinlagd (negativkontroll) | **2 FAIL / 2 PASS som förväntat**, uppmätt 4.2668 |
| Städräkning efter e2e | 0 i alla tabeller |
| **Egna Chromium-klick (ux7, prod `next start`, netns)** | **99 PASS / 0 FAIL** |

### Kontrast (ux7, emulerad Chromium)
- **Fixtur:** samma som i F1. Sex besök för ”QA Korttid” (ton 3/brun), med 30-minuterskorten 10:15 och 13:00 som icke-kompakta. Därtill skapades via admin-UI var sitt 30–60-minuters besök för Anna (ton 0), Elias (ton 1) och Erik (ton 2), så att **alla fyra toner har icke-kompakta kort**. PASS.
- **Vyer:** dag med en personal, dag med all personal och vecka med all personal, vid 1440 och 1180. I alla sex kombinationer:
  - **all text** i `.desktop-calendar` klarar AA. Lägsta värde 5.48, i 23, 37 respektive 139 textelement. Det gäller i viloläge, med det bruna kortet hovrat och med det bruna kortet tangentbordsfokuserat;
  - **varje synlig kundrad** har beräknad `opacity` 1, både egen och genom hela förfäderskedjan, och ≥4.5:1;
  - ton 3 finns på icke-kompakta kort i vyerna med all personal.
- **Kundradens kvot per ton (12 px):**

  | Ton | Färger | Kvot |
  |---|---|---|
  | 0 | `#284d83` på `#edf3fd` | 7.60 |
  | 1 | `#655080` på `#f3eef9` | 6.11 |
  | 2 | `#245d4d` på `#eaf5ef` | 6.84 |
  | 3 (brun) | `#805c28` på `#fbf3e7` | **5.48** (var 4.27) |

- **Mobil agenda 390** (brun personal): lägsta värde 6.27, 0 fel.

### Geometrikontroll på samma fixtur (sanity)
- **Vyer:** dag med en personal, dag med all personal och vecka med all personal, vid 1440 och 1180. Totalt 62 PASS / 0 FAIL.
- **Resultat:**
  - alla kort ≥24×24;
  - ingen 2D-överlappning;
  - hover och fokus ändrar ingen geometri;
  - musklick på varje korts mittpunkt öppnar rätt kort (6/6);
  - hover följt av klick på nästa korts mittpunkt öppnar nästa kort (5/5);
  - Tab går i kronologisk ordning, och Enter öppnar rätt bokning;
  - aria-label och title innehåller personal.
- **Slutsats:** oförändrat mot F1.

## 5. Status för fynd

| ID | Status | Bevis |
|---|---|---|
| UP-F1-QA-1 (ton 3 kundrad 4.27:1) | **STÄNGD** | Regeln är borttagen (diff). Renderad opacity 1 och 5.48:1 i 6 vy-/breddkombinationer, i vila, vid hover och vid fokus. Egen negativkontroll ger rött vid 4.2668. |
| UP-QA-1/2/3/4, riskhypoteser 1–3 | Stängda i F1, oförändrad kod | F1-rapporten. Geometrisanity ovan är grön. |
| UP-QA-5 (ton/personal) | **Delvis stängd, backlog** | Personal finns i aria-label och title. Toner upprepas (Anna och Sam Demo har båda ton 0; namnet avgör identiteten). |
| UP-F1-QA-2 (smala kolumner klipper tjänst/kund i långa kort) | **Öppen, backlog (Info)** | Syns fortfarande i `F2-brown-day-all-staff-1440.png`: det bruna 10:15-kortet visar ”QA långt…”. Full text finns i aria-label, title och detaljvyn. |
| UP-F1-QA-3 (24 px-kort kant i kant) | **Öppen, backlog (Info)** | Oförändrat |

**Nya fynd:** inga på nivån Medium eller högre. Info: E2E-kontrasttestet täcker endast ton 3 och kundradens egen opacity (se avsnitt 3). Backlog: utvidga testet till ton 0–3 och förfäders-opacity.

## 6. Codex-evidens (granskad, inte egen)
- `f2-contrast-red-1c1ff5a.txt` och `-results.json`: rött på 1c1ff5a (exit 1, 2 fail, `Received 4.26679440557843`). Detta stämmer exakt med min egen negativkontroll.
- `contrast-contrast.txt` och `-results.json`: 4 passed, exit 0. Stämmer med mina 4/4.
- `f2-fixture-palette-failure.txt`: ett tidigare fixturförsök fick `data-tone="0"` i stället för 3. Codex redovisar det öppet. Rättningen lade till en personal, och gränsen sänktes inte.
- `build-results.json` (exit 0) och `static-results.json` (lint och tsc exit 0) stämmer med mina körningar.
- `f2/own-rendered-contrast.json`: färg `rgb(128, 92, 40)`, bakgrund `rgb(251, 243, 231)`, opacity `"1"`. Stämmer med mina mätningar.
- `f2-visual-manifest.json`: 1 JPEG, 1265×712. sha256 och storlek stämmer, `physicalIphone: false` och revision 9840309.
- Codex påstående att 106/125/13 och 58×4 är gröna på slut-SHA: **unit 106 är verifierat av mig. 125, 13 och 58×4 är INTE verifierade här** (oförändrad kod, ej beställt).

## 7. Blockers vs backlog
- **Blockers:** inga.
- **Backlog:**
  - UP-F1-QA-2 och UP-F1-QA-3;
  - UP-QA-5 (delvis);
  - utvidga E2E-kontrasttestet till ton 0–3 och förfäders-opacity;
  - 7 moderate dev-audit (oförändrat sedan tidigare).

## 8. NOT RUN
- Full e2e-matris 58×4, integration 125 och MCP-kort 13 på denna SHA. Codex och CI kör dem; koden är oförändrad mot 1c1ff5a, där jag körde 125/13 gröna.
- npm audit (package och lock är byte-identiska).
- Full omgranskning av oförändrade epics.
- Fysisk iPhone/Safari, WebKit och Firefox.
- Skärmläsare.
- Preview/server.
- Pilot och ägaracceptans.

## 9. Skärmbilder (emulerad Chromium, syntetisk data – inte fysisk enhet)
I `polish-f2-9840309/run/shots/`:
- `F2-brown-dense-day-single-staff-1440.png`: brunt kort med full kundrad, hovrat.
- `F2-brown-day-all-staff-1440.png`: alla fyra toner sida vid sida. Visar även UP-F1-QA-2.
- `F2-brown-week-all-1180.png`

## 10. Städning
- PG och appen är stoppade.
- Raderat: `/tmp/pf2*`, `work/.env`, `work/node_modules`, `work/.next` och alla pgdata-kataloger.
- Arbetskopians CSS är återställd före raderingen.
- Behållet: loggar, prober, skärmbilder och evidens.
