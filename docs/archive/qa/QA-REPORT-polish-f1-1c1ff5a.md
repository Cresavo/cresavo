# QA-rapport – UI-polish rättningsvarv 1 (1c1ff5a)

**Revision:** `1c1ff5aa5d83a08055d23d39fecd16a6f479f412` (ui/salon-polish, direkt efter 268ebdf)
**Granskare:** Grok Bot (QA, oberoende) · **Datum:** 2026-11-14 00:03–00:30 (Europe/Stockholm)
**Omfång:** riktad återkontroll enligt brief. Arbetet är gjort i en syntetisk lokal kopia med `@example.test`-adresser, inbäddad Postgres som icke-root i isolerad netns med testvakt, TZ=Europe/Stockholm och `env -u NODE_ENV`. Inga original, ingen preview/server, inga hemligheter/cookies och inga riktiga utskick. Oförändrad core täcks av min fulla granskning av 268ebdf (QA-REPORT-polish-268ebdf.md, sha `7031512a…2e32c`).

## 1. Indata och hashar

| Artefakt | sha256 | Kontroll |
|---|---|---|
| Brief | `b93ff5cc45934e6a95042346fc8b0bdfdc1abcf65aaeeef021baf0bbed5725f7` | läst först |
| Kodzip | `dc2a8b1d74db962af8798194b2da2a2e62291fea72bf528eabc58d36c9f93153` | 4 589 024 B, kommentar = 1c1ff5a…, 694 poster, enda env-fil `.env.example` (+ tillåtna `docs/calendar-proof/private.json` och två `*secret-scan.json`-rapporter, ej lästa som hemligheter) |
| Evidenszip (Codex) | `62468745418ceaec909b6c09739c3105eb95baa54aecc80a8fd2253caae75089` | 73 806 B, 12 poster |
| Jämförelsebas 268ebdf-källa | — | verifierad orörd mot 268ebdf-zip (`diff -rq` tom) |
| Källdiff `logs/polish-f1-src.diff` | `ce4f4cf9839b4400a2aadf4672e45cdb5f4eaad7fe5efe5eebbcf5c3bbc23b18` | 657 rader |
| Egen klickprobe `probes/ux6.mjs` | `93d94a00d0c9b71fc637960304ee48339c9533cead61be60d930631844e5bb99` | |
| Egen klicklogg `logs/ux6.txt` | `ed3221236f945307975b8a2ddcc608a50c2212a83147c7719816181da6587385` | |
| Egen layoutprobe `probes/layout-edge.mjs` | `5c082dbf00c39c26ebd5fa24b7065bba8bf5db59876a42848f968bcea0c218d5` | körs utanför källträdet |
| Layoutlogg `logs/layout-edge.txt` | `feb0806dbada06ed16558b2bb11cf0843c291a1c1b5826a1a6875be8df8bb1e5` | |

## 2. Beslut (avgränsat)

- **UP-QA-1 och UP-QA-2 är stängda.** Hover stjäl inte längre klick, och alla kort är minst 24×24 utan överlapp. Det gäller i alla nio konfigurationer jag provade.
- **Syntetisk lokal 1c1ff5a: villkorat GO, med ett kvarvarande Medium-fynd.**
  - UP-F1-QA-1: personalton 3 ger 4.27:1 på kundraden. Det underskrider AA (4.5:1), som var ett uttryckligt krav i polish-briefen.
  - Fyndet fanns redan i 268ebdf-CSS:en. Jag missade det i förra rundan eftersom ton 3 då bara förekom på kompakta kort.
  - Rättningen är en rad CSS och kan göras i varv 2/2.
  - **Rekommendation: GO efter varv 2 med en riktad omkontroll av kontrasten.** Väljer ägaren att lägga det i backlog är allt annat GO.
- **Pilot, fysisk iPhone/Safari och ägarens UX-acceptans: NO-GO / separat.** Inget av det är prövat här.

## 3. Avgränsad diff mot 268ebdf

- **Kod:**
  - ny `src/app/admin/calendar-layout.ts` (33 rader, ren funktion);
  - `src/app/admin/calendar.tsx` (placering per personal och dag, aria-label och title med personal, `data-compact` när höjden är under 60 px);
  - `src/app/workspace-polish.css` (82 px-expansionen borttagen, kompakta kort visar endast tid, kryssruta 24, hjälp 44, Dag/Vecka 44, kundetikett 44, 16 px-fält under 768 px).
- **Tester:** ny `tests/calendar-layout.test.ts` (4 fall) och skärpt `tests/e2e/polish.spec.ts`.
- **Dokument:** `docs/UI_POLISH_PLAN.md` samt mina rapporter `docs/qa/QA-REPORT-polish-268ebdf.md` och `FIX-REQUEST-polish-268ebdf.md`. Efter CRLF→LF är de byte-identiska med mina original.
- **Ingen** ändring i core, API, `src/lib`, MCP, auth, schema, migrationer (fortfarande 10), package.json, lockfil eller beroenden. Bekräftat.

### Granskning av calendar-layout.ts
- **Algoritm:** girig kolumntilldelning per visuellt sammanhängande grupp. Varje kort får minst 24 px höjd, verklig `top` behålls, och alla kort i en grupp delar samma kolumnantal. Den anropas per personal och dag, enbart med bekräftade bokningar. Rendreringen filtrerar på samma sätt, så `placements.get(id)!` kan inte bli tom: personal som saknas i listan läggs till som ”Tidigare utförare”. Avbokade bokningar visas i den separata listan, inte i rutnätet.
- **Kantfall:** min egen probe gav 12/12 PASS.
  - Intervall som bara nuddar varandra (30+30) behåller full bredd.
  - En kedja med 10-minutersbesök får 24 px per kort, kant i kant utan överlapp.
  - Kedjan A-B-C där A och C inte överlappar: C återanvänder kolumn 0, totalt 2 kolumner.
  - 6 samtidiga besök ger 6 kolumner utan krock.
  - 20×5 min ger 2 kolumner med oförändrade `top`-värden.
  - Kort→långt fungerar, och nästa fristående besök får full bredd.
  - Ett besök med längden 0 får 24 px.
  - Ordningen blir deterministisk vid samma starttid.
  - Tom indata hanteras.
  - Fuzz med 2000 slumpade layouter gav 0 krockar.
  - 2000 domängiltiga, icke-överlappande scheman för en personal krävde aldrig fler än 2 kolumner.
- **Sommartid/vecka/all personal:**
  - Positionen räknas fortfarande via lokal väggklocka (`minute()`), som före ändringen. Ingen ny DST-risk.
  - Veckovy och all personal använder samma per-dag-per-personal-loop.
  - DST-dagen är inte klickprovad (se NOT RUN).
- **Inget sänkt säkerhetstest:**
  - Det tidigare kravet att fokus ger minst 82 px är ersatt av strängare krav: 2D-krock, minst 24×24, oförändrad geometri vid hover och fokus, rätt URL efter Enter, och att hover följt av klick på nästa korts ursprungliga mittpunkt öppnar nästa kort (vid 1180 och 1440).
  - Tryckyte- och fontkrav har tillkommit. Inga tidigare påståenden har tagits bort.

## 4. Egna körningar (förstahand, 2026-11-14)

| Steg | Resultat |
|---|---|
| npm ci / prisma generate / migrate (10) / seed / lint / tsc | PASS (00:05) |
| unit | **106/106** (21 filer, inkl. 4 nya geometritester) |
| build | PASS |
| integration | 125/125 (efterkontroll: rlb=8, övrigt 0) |
| npm audit | 7 moderate (dev), rc 1; `--omit=dev` 0, rc 0 – oförändrat |
| MCP/agentworkday-kort (netns) | 13/13 |
| polish + coherence, prod, proxy0 (netns) | 10/10 |
| polish + coherence, prod, proxy1, `--repeat-each=2` | 20/20 |
| polish + coherence, dev, proxy0 | 10/10 |
| Städräkning efter varje e2e | 0 i alla tabeller |
| Layoutprobe (egen) | 12/12 |
| **Egna Chromium-klick (ux6, prod `next start`, netns)** | **119 PASS / 3 FAIL** (alla 3 = UP-F1-QA-1, kontrast) |

Probefel som rättades och kördes om räknas inte som produktfel:
- geometrijämförelse i viewport-koordinater, som störs av scroll; nu relativt `.calendar-day`;
- Dag/Vecka förväntades på mobil, men är medvetet dold under 768 px, där agendan används;
- returtestet mätte startpositionen före Playwrights automatiska scroll vid klicket.

### Klickresultat (emulerad Chromium, Playwright, syntetisk data)
- **Fixtur:** sex besök för ”QA Korttid”, skapade via admin-UI:
  - 10:00, 10:05 och 10:10 (5 min);
  - 10:15 (30 min, direkt efter kedjan);
  - 10:45 (5 min);
  - 13:00 (30 min, fristående).
- **Konfigurationer:** dag/en personal vid 1440, 1180, 1179 och 1024 (touch); dag/all personal vid 1440 och 1024 (touch); vecka/all personal vid 1440 och 1180; vecka/en personal vid 1180.
- **I alla nio konfigurationer:**
  - alla kort är minst 24×24;
  - inga tryckytor överlappar i 2D;
  - aria-label och title innehåller tid, tjänst, kund och personal;
  - kompakta kort visar endast sin egen tid och klipps inte;
  - hover ändrar ingen geometri, och mittpunkten träffar det egna kortet;
  - musklick på varje korts mittpunkt öppnar rätt kort (6/6);
  - hover på ett kort följt av klick på nästa korts mittpunkt öppnar nästa (5/5);
  - touch-tryck på varje mittpunkt öppnar rätt kort (1024);
  - Tab går kronologiskt 10:00→13:00;
  - fokus ändrar ingen geometri;
  - Enter på 10:10 öppnar 10:10.
- **Uppmätta bredder:**
  - dag/en personal 1440: 535 px per kolumn i kedjan, 1075 px för fristående;
  - all personal och vecka: 75 px per kolumn, 155 px för fristående.
- **Mobil 320/390:** agendan visar alla sex med full text och minst 44 px. Inget horisontellt överflöde. Tryck på 10:05 öppnar 10:05.
- **Mobila tryckytor och fonter:** se avsnitt 6.
- **Retur/scroll (CS-QA-1/2):**
  - 390: y 2313 återställs exakt via ”Till kalendern” och Bakåt.
  - 1440: y 1155 och x 1341 återställs exakt.
  - PASS.
- **Kontrast:** se UP-F1-QA-1.
  - Toner 0 (7.60/5.65 med opacity) och 1 (6.11/4.66) klarar AA.
  - Ton 2 förekom inte i fixturen. Statiskt: `#245d4d` på `#eaf5ef`, inte mätt i klick.
  - Ton 3 klarar AA för huvudtext (5.48) men inte för kundraden med opacity 0.88 (4.27).

### UX-bedömning (ärlig)
- **Förbättrat:** sidokolumnerna löser felklicket på ett förutsägbart sätt. Korta besök syns nära sin verkliga tid, går att träffa med mus och touch, och inget hoppar vid hover.
- **Nackdelar:**
  - Kort i samma kolumn ligger kant i kant (24 px på 12 px rytm), så kedjan ser något staplad ut.
  - I smala kolumner (75 px, all personal/vecka) klipps tjänst och kund i 30-minuterskort, till exempel ”QA lån…” (bild F-week-all-1180).
  - Allt finns kvar i aria-label, title och detaljvyn, så det är acceptabelt, men det blir mindre överblick.

## 5. Status för tidigare fynd och riskhypoteser

| ID | Status | Bevis |
|---|---|---|
| UP-QA-1 (hover täcker och stjäl klick) | **STÄNGD** | Expansionen är borttagen (`workspace-polish.css:332-334`, endast box-shadow). Hover→nästa mittpunkt öppnar nästa: 5/5 i 7 musvyer. |
| UP-QA-2 (10 px-mål) | **STÄNGD** | `calendar-layout.ts:23` (min 24), alla kort ≥24×24 i 9 konfigurationer, 0 krockar |
| UP-QA-3 (klippt kompakt text) | **STÄNGD** | Kompakta kort visar endast tid (`css:319-331`), clipX/clipY falska |
| UP-QA-4 (Dag/Vecka 38 px) | **STÄNGD** | 50.3×44 och 61.4×44 vid 1440 (`css:687-689`). Dolda under 768 px (agenda). |
| UP-QA-5 (ton/personal) | **DELVIS STÄNGD** | Personal finns nu i aria-label och title (`calendar.tsx:387,395`). Ton % 4 upprepas medvetet: namnet avgör identiteten. Backlog. |
| Hypotes 1: admin-fält 14 px på mobil | **STÄNGD i Chromium** | 16 px på samtliga 29 synliga fält på 7 sidor vid 320 och 390. 14 px kvar ≥768 px. **Fokuszoom i Safari är NOT RUN.** |
| Hypotes 2: hjälp-summary 36 px | **STÄNGD** | 166.3×44 vid 320, 390 och 1440 |
| Hypotes 3: kryssruta 22 px / kundetikett 29 px | **STÄNGD** | Kryssrutor 24×24. Kalenderetikett 258/328/119.7×44. Kundetikett 187.1×44. Klick i etikettens nedre högra hörn växlar. |

## 6. Nya fynd (UP-F1-QA-)

### UP-F1-QA-1 – Medium (bryter kontrastkravet i polish-briefen): personalton 3, kundrad 4.27:1
- **Fil:** `src/app/workspace-polish.css:279-283` (`[data-tone="3"]`: ink `#805c28`, bg `#fbf3e7`) tillsammans med `src/app/workspace-polish.css:315-317` (`.calendar-booking > span:last-of-type { opacity: 0.88 }`).
- **Repro:** 1440, `/admin?date=<dag>&view=day&staffId=<4:e personalen>` eller vecka med all personal. Ett icke-kompakt besök (30 min) för personal med index 3, 7, 11 och så vidare. Kundraden har 12 px text, och den sammansatta färgen ger 4.27:1 mot 4.5:1 som krävs.
- **Omfattning:** ton 1 ligger på gränsen (4.66). Ton 0 ger 5.65.
- **Ursprung:** fanns redan i 268ebdf, och CSS-raderna är oförändrade i F1. Jag missade det i förra rundan, när ton 3 bara förekom på kompakta kort.
- **Fix:** ta bort `opacity: 0.88` på kundraden (ton 3 ger då 5.48), eller mörka `--booking-ink` för ton 3 (till exempel `#6f4f20`). Lägg till ett e2e/kontrasttest för alla fyra toner med ett icke-kompakt kort.

### UP-F1-QA-2 – Info (backlog): smala kolumner klipper tjänst och kund i långa kort
- **Fil:** `calendar.tsx:369-399` och `calendar-layout.ts`.
- **Detaljer:** i en grupp med kort följt av långt besök får det långa besöket halv bredd under hela sin längd. Vid all personal eller vecka (75 px) visas ”QA lån…”. Full information finns i aria-label, title och detaljvyn.
- **Idé:** låt ett kort expandera i sidled när ingen granne i den andra kolumnen överlappar just dess intervall.

### UP-F1-QA-3 – Info (backlog): kort i samma kolumn utan mellanrum
- Kort på 24 px med 12 px rytm ligger kant i kant (10:00 och 10:10 i kolumn 0). En gräns på 1–2 px eller en marginal skulle förbättra skannbarheten.

## 7. Codex-evidens (granskad, inte egen)
- `f1-tested-source.json`: 194 filer. Jag verifierade alla **194/194 sha256 mot kodzipen**; `sourceFilesMatchTestedCopy: true` stämmer.
- `full-unit` 106 och `full-integration` 125 stämmer med mina egna körningar. Kort 13 och build exit 0 stämmer.
- `f1-initial-focused-ui`: 2 fail / 24 pass (polish.spec, desktop och mobil). Därefter 26/26 efter ändrad provordning. Codex redovisar det öppet. Testkraven (fokus, bbox, rätt URL) är oförändrade i den levererade specen, som jag själv körde grönt 40 gånger.
- `f1-visual-manifest.json`: 2 JPEG-bilder (1165×987, 375×812). sha256 och pixelstorlekar stämmer, `physicalIphone: false`. De är tagna **före commit** på 268ebdf+F1 och sedan matchade mot 1c1ff5a. Det är ärligt redovisat, men bilderna är inte tagna på exakt den frysta revisionen.
- Codex påstående att full 58×4 körs på commit är **inte verifierat av mig** (ej beställt här).

## 8. Blockers vs backlog
- **Varv 2/2 (rekommenderat, litet):** UP-F1-QA-1.
- **Backlog:** UP-F1-QA-2, UP-F1-QA-3, UP-QA-5 (tonupprepning), 7 moderate dev-audit.

## 9. NOT RUN
- **Full e2e-matris 58×4.** Inte beställd; Codex och CI kör den.
- Full omgranskning av oförändrade epics (meny, översikt, kundbokning med mera), som täcks av min granskning av 268ebdf.
- Fysisk iPhone/Safari, inklusive fokuszoom vid 16 px.
- WebKit och Firefox.
- Riktig Chrome på enhet.
- Skärmläsare.
- Klick på DST-dagen.
- UX-klick i dev-läge (dev täcks via polish- och coherence-specen).
- Preview/server.
- Pilot och ägaracceptans.

## 10. Skärmbilder (emulerad Chromium, syntetisk data – inte fysisk enhet)
Finns i `polish-f1-1c1ff5a/run/shots/`:
- `F-day-staff-1440.png` (tät kedja i två kolumner)
- `F-week-all-1180.png` (all personal/vecka, smala kolumner)
- `F-day-staff-1024.png` (touch-bredd)
- `F-day-all-1440.png`
- `F-mobile-agenda-390.png`
- `F-customers-390.png` (16 px-fält, kryssruta 24, etikett 44)

## 11. Städning
- PG och appen är stoppade.
- Raderat: `/tmp/pf1*`, `work/.env`, `work/node_modules`, `work/.next` och alla pgdata-kataloger.
- Behållet: loggar, prober, skärmbilder och evidens.
