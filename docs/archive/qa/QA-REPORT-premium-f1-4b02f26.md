# QA-rapport – Premiumdemo, rättningsvarv 1 av 2 (riktad omkontroll av översikten) · 4b02f26

**Revision:** `4b02f26ae5240cc80c09bb71e4e7bb1688f0e9f5` (ZIP-kommentar), jämförd mot min scoped GO på `5212b7afb439ec22e36116f226b6db504cc7c5c3`.

**Granskare:** Grok Bot (oberoende QA). **Tid:** 2026-11-14 08:40–08:56 (Europe/Stockholm).

**Omfång:** enbart adminöversikten (`/admin/overview`). Detta är ingen ny full QA.

**Miljö:**
- separat syntetisk kopia;
- färsk inbäddad Postgres som körs utan root i en isolerad netns, med testvakt;
- `TZ=Europe/Stockholm` och `env -u NODE_ENV`;
- endast `@example.test`-adresser och egna syntetiska hemligheter;
- produktionsbygge med `next start`, åtkomligt bara inne i netns.

Ingen originalkod, ingen PC, ingen preview, ingen GitHub, ingen deploy och inga riktiga hemligheter har använts.

**Webbläsare:** Playwright Chromium 1.65 (headless) med emulerade viewports. Det är **inte** Safari, inte WebKit och ingen fysisk enhet.

## 1. Indata och hashar

| Artefakt | sha256 / kontroll |
|---|---|
| ZIP 4b02f26 | `41a8b25cf34a93420688d53667b36e3d6c910e1377eb5854e3d9db3e91812ac1`, 7 143 276 B, kommentar `4b02f26…`, 729 poster. Den enda env-filen är `.env.example`. Därutöver finns samma tillåtna `docs/calendar-proof/private.json` och två `*secret-scan.json` som tidigare. Deras innehåll har inte lästs. |
| Jämförelsebas 5212b7a | Nyuppackad ur `0adbb695…`-zip, och `diff -rq` mot min tidigare `premium-5212b7a/run/src` gav ingen skillnad. Basen är alltså orörd. |
| Fillista `logs/diff-vs-5212b7a.txt` | `30040b4b1464a1689fcf63602782826fb87a527e9cfef716c988e248512ef65d` |
| CSS-diff `logs/css.diff` | `2ef4ea12df0fa3d6a28969ea5869a5c3f87bdde4ece6b28dd62124c612dd9545` |
| `workspace-polish.css` ny / gammal | `55f36cba…b806b338` / `62646fa2…ba7d65a` |
| Probe `probes/ov.mjs` och logg `logs/ov-final.txt` | `804bd92a30410c6337d12c189103f9af8ec869d904d1b5853b0b410b07e00e84` / `c84854ca0bbf5e018a76d3636d03f88f45d36fc91646a69c9551e962f6a10a8d` (**205 PASS / 0 FAIL**) |
| Mätrader `logs/ov-rows-final.json` | `3ba0bf7bbe065f416024596cd311fde8dc68bf8ce87bf0942213ba47de245383` |
| Sidomenyprobe `probes/ov2.mjs` och logg `logs/ov2.txt` | `cb9e926a…b7181b6` / `1dd8aa49…b8d0` (5 PASS / 0 FAIL) |
| Negativ kontroll `probes/ov-neg.mjs` och logg `logs/ov-neg.txt` | `a2b8c3c6…c11c` / `cfbde60a…c26a` (69 PASS / **11 FAIL med gammal CSS, som förväntat**) |

## 2. Diffklassificering mot 5212b7a (`diff -rq`, fullständig lista)

| Fil | Klass |
|---|---|
| `src/app/workspace-polish.css` | **Produkt.** Den enda produktändringen. |
| `docs/DEMO.md`, `docs/HANDOFF.md`, `docs/PREMIUM_DEMO_PLAN.md`, `docs/PROJECT_STATUS.md`, `docs/VERIFICATION.md` | Dokumentation |
| `docs/assets/premium/` (ny katalog: 11 PNG och 6 JSON-bevis, t.ex. `ci-final-proof.json` och `preview-*.json`) | Dokumentation/evidens |
| `docs/qa/QA-REPORT-premium-5212b7a.md` (ny) | Dokumentation. Det är min tidigare rapport, men med CRLF-radslut (se PR-F1-QA-3). |

Ingen ändring finns i package-filer, lockfil, prisma, plugins/MCP, `src/lib`, API-rutter, tester eller Playwright-konfiguration.

**Påståendet ”den enda produktändringen är desktop-CSS i workspace-polish.css” är bekräftat.**

### CSS-ändringen (`src/app/workspace-polish.css:535-545`)
Ändringen ligger inne i desktopblocket (≥1180 px).

```css
.admin-workspace.overview-workspace {
  max-width: 1800px;                       /* tidigare 1440px */
  margin-inline-start: max(224px, calc((100% + 224px - 1800px) / 2));
}
@media (min-width: 1680px) { .overview-workspace .capacity-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
```

**Kodgranskning:**
- Selektorerna träffar bara `main.overview-workspace`. Den klassen används endast i `src/app/admin/overview/page.tsx:53`, så andra adminsidor påverkas inte.
- Matematiskt ger det lika luft på båda sidor om innehållet i ytan till höger om den 224 px breda sidomenyn när viewporten är bredare än 2024 px. Under 2024 px fyller innehållet hela ytan med 40/40 px padding.
- Mobil (<768 px) och surfplatta (768–1179 px) har orörda regler.

## 3. Egna kommandon (förstahand, i netns)

| Steg | Resultat |
|---|---|
| npm ci | PASS |
| prisma generate | PASS |
| migrate | PASS, 10 migrationer |
| seed | PASS |
| lint | PASS, utan varningar |
| `tsc --noEmit` | PASS |
| unit | **114/114** (23 filer) |
| build (`next build`) | PASS |
| E2E prod (`E2E_PRODUCTION=1`, TRUST_PROXY_IP=0), specarna `capacity` + `polish` + `coherence`, som rör översikten | **12/12** (32,8 s). Efterkontrollen visade 0 rader i bokningar, kunder, kampanjer, beslut, admins och sessioner. |
| Övriga E2E (full 62-matris, dev, integration, agentkort) | NOT RUN (utanför omfånget) |

## 4. Egna webbläsaråtgärder (Playwright Chromium, emulerat)

**Data:** demo-seed plus kapacitets-seed ger 4 översiktskort i olika tillstånd:
- nytt förslag med kampanjutkastsformulär;
- föråldrat förslag (”Open calendar” inaktiverad, ”Refresh availability”);
- avfärdat förslag;
- förslag med sparat kampanjutkast och länk.

### 4.1 Mätningar per bredd
Alla bredder har DPR 1 utom en rad. 2880 är CSS-bredd, dvs. ingen skalning. Fönsterhöjden är 900, 844 vid 390 och 1600 vid 2880-raden. 2880 mättes även med höjden 900.

| Bredd | Sidomeny | Innehållsyta (left–right) | Luft vänster / höger | Skillnad | Tom andel bredvid menyn | Kolumner | Kortbredd | Överflöde dok/body/main |
|---|---|---|---|---|---|---|---|---|
| 390 | statisk toppheader (175 px), ingen sidomeny | 16–374 | 16 / 16 | 0 | 8,2 % | **1** | 358 | 0/0/0 |
| 1180 | fast 224 px, mörk | 264–1140 | 40 / 40 | 0 | 8,4 % | 2 | 429 | 0/0/0 |
| 1440 | fast 224 px | 264–1400 | 40 / 40 | 0 | 6,6 % | 2 | 559 | 0/0/0 |
| 1440 @ DPR 2 (Retina-liknande) | fast 224 px | 264–1400 | 40 / 40 | 0 | 6,6 % | 2 | 559 | 0/0/0 |
| 1679 | fast 224 px | 264–1639 | 40 / 40 | 0 | 5,5 % | 2 | 678,5 | 0/0/0 |
| 1680 | fast 224 px | 264–1640 | 40 / 40 | 0 | 5,5 % | **3** | 446,7 | 0/0/0 |
| 1920 | fast 224 px | 264–1880 | 40 / 40 | 0 | 4,7 % | **3** | 526,7 | 0/0/0 |
| 2024 | fast 224 px | 264–1984 (max 1800) | 40 / 40 | 0 | 4,4 % | **3** | 561,3 | 0/0/0 |
| 2880 | fast 224 px | 692–2412 (main 652–2452, max 1800) | **468 / 468** | **0** | 35,2 % | **3** | 561,3 | 0/0/0 |

**Gemensamt för alla bredder och för SV vid 1440 och 390:**
- `main` börjar exakt vid sidomenyns högerkant (224 px), så det finns ingen överlappning.
- Inget horisontellt sidscroll.
- Inga överlappande kort.
- Ingen text eller kontroll sticker ut ur sitt kort.
- Inga täckta kontroller i `main`, och alla är minst 24 px.

**Kolumner:** tre kolumner gäller från 1680 px och uppåt, två kolumner vid 1180–1679 px och en kolumn vid 390 px.

**Sidomenyn när sidan scrollats** (`ov2`, i viewporten, 1440×900, 1680×900, 1920×1080, 2880×900 och 1440×700): den fasta menyn går från den sticky demobannern (44 px) till viewportens nederkant, utan glipa, och ”Account” syns.

*Obs:* i helsidesskärmbilder (fullPage) ser menyn ut att sluta vid fönsterhöjden. Det beror på hur fullPage-tagningen hanterar fasta element och är inte ett produktfel.

### 4.2 Negativ kontroll (reversibel, i min arbetskopia)
Jag lade tillbaka 5212b7a:s `workspace-polish.css`, byggde om och körde samma layoutmatris.

**Utfall: 11 FAIL**, exakt det problem som rättelsen avser:
- obalanserad luft: 40 / 1256 px vid 2880, 40 / 296 px vid 1920, 40 / 400 px vid 2024 och 40 / 56 px vid 1680;
- 2 kolumner i stället för 3 vid 1680–2880.

Därefter återställde jag CSS-filen (`cmp` mot källan OK) och byggde om. Slutresultaten i 4.1 kommer från bygget av den ursprungliga 4b02f26-koden. Proben upptäcker alltså felet och godkänner rättelsen.

### 4.3 Navigation, kort och återgång
- **Sidomenyn (1440, 390 och 2880):** länkarna Calendar, Customers, Services, Team & schedules och Campaigns (de tre sista via ”Business”) öppnar rätt sida med rätt H1. ”Overview” leder tillbaka varje gång. Översikten är intakt och utan överflöde efter varje återgång, och `aria-current` markerar Overview.
- **Kortens ”Open calendar” (1440, 390, 1920 och 2880):** kortet aktiverades med tangentbordet (Enter). Kalendern öppnas med sammanhang (`date`, `view=day`, `staffId`, `returnTo=/admin/overview`, `returnKey`).
  - Webbläsarens Bakåt återställer scrollpositionen exakt. Mätt y: 1440 → 176 (=max), 390 → 1030 (=max), 1920 → 176 och 2880 → 0, eftersom sidan inte scrollar vid höjden 1600.
  - Kalendern visar ”Back to overview”, och den länken återställer också scrollpositionen exakt.
  - Layouten är oförändrad efter återgång (samma kolumner och samma luft).
- **”Review saved campaign draft”-länken på kort:** öppnar kampanjsidan, och Bakåt återställer scrollpositionen exakt (alla fyra bredder).
- **Rubrikens ”Open calendar”** (1440) går till kalendern, och ”Back to overview” leder tillbaka till översikten.
- *Notering:* efter återgång hamnar fokus på `body`, inte på kortknappen (se PR-F1-QA-2).

### 4.4 Tangentbord, fokus och kontrast
- **Fokus:** 30 tryck på Tab (1440 EN, 2880 EN, 1440 SV, 390 EN och 390 SV) gav 17 unika tabbstopp innan ordningen börjar om:
  - språkväljare;
  - varumärke;
  - Overview, Calendar och Customers;
  - Business och Account;
  - ”Open calendar”;
  - About these suggestions och Refresh;
  - kortens Open calendar, Dismiss, Prepare campaign draft, Refresh availability och Review saved campaign draft.

  Varje stopp hade synlig fokusmarkering (3 px kontur) och låg i viewporten.
- **Kontrast (WCAG AA)** mot sammansatt bakgrund, inklusive förfäders opacitet, med sidomenyn medräknad: 1440 EN, **2880 EN**, 1440 SV, 390 EN och 390 SV. Alla gav 47 textelement, lägsta värde 5,04:1 och **0 underkända**.

### 4.5 Skärmbilder (`premium-f1-4b02f26/run/shots/`)
- `OV-{390,1180,1440,1679,1680,1920,2024,2880}-en.png`
- `OV-1440-dpr2-en.png`
- `OV-{1440,390}-sv.png`
- `OV-return-{390,1440,1920,2880}-en.png`
- `OV-viewport-scrolled-{1440x900,1680x900,1920x1080,2880x900,1440x700}.png`
- Negativ kontroll med gammal CSS: `shots-neg/` (samma namn).

**Visuell bedömning:**
- Vid 2880 ligger innehållet nu centrerat i ytan bredvid menyn, med 468 px luft på var sida och tre kolumner, vilket är balanserat.
- Vid 1680–2024 finns tre kolumner med 40 px luft.
- Korten har olika höjd (`align-items: start`), så raderna får ojämn nederkant. Det fanns redan före ändringen och är bara Info.

## 5. Codex påståenden

| Påstående | Status |
|---|---|
| Den enda produktändringen sedan 5212b7a är desktop-CSS i `workspace-polish.css` | **Bekräftat** (`diff -rq`) |
| Översikten är balanserad bredvid 224 px-menyn och har tre kolumner på breda skärmar | **Bekräftat** i Chromium (4.1 och 4.2) |
| Dokumentationen: Actions 43546809210 med 62/62 i fyra jobb, skyddad preview `dpl_AMGKA…`, CI-bevis | **Ej verifierbart här** (ingen GitHub, preview eller CI i mitt uppdrag). Har inte öppnats. |
| ”Groks originalrapport … Original SHA256 864d6373…” | Innehållet är identiskt med mitt original, men filen i repot har CRLF och sha256 `6599e085…`. Se PR-F1-QA-3. |
| Fysisk Safari/iPhone | **Ej verifierat.** Användarens Safari-bild har jag inte sett, och jag har ingen Safari-körning. |

## 6. Fynd

Inga fynd på nivån Medium eller högre. Därför skrivs ingen FIX-REQUEST.

### PR-F1-QA-1 – Info: hopp vid 1680 px och 35 % tom yta vid 2880
- **Plats:** `src/app/workspace-polish.css:536-545`.
- **Iakttagelse:** vid 1679 → 1680 går korten från 2 × 678 px till 3 × 447 px, och högsta kortet växer från 334 till 356 px. Vid 2880 är innehållet begränsat till 1800 px, vilket lämnar 35 % luft bredvid menyn. Det är balanserat och avsiktligt.
- **Acceptans:** godkänt som det är. Valfritt i framtiden: en flytande gräns i stället för en fast brytpunkt, och färre kolumner när det finns färre kort än kolumner.

### PR-F1-QA-2 – Low (fanns redan, ingen regression): fokus återförs inte till kortet efter återgång
- **Plats:** `src/app/components/context-link.tsx` (`rememberReturn` / återställning) och `overview.tsx:251-256`.
- **Repro:** Tab till kortets ”Open calendar” och tryck Enter. Gå sedan tillbaka med ”Back to overview” eller webbläsarens Bakåt. Scrollpositionen återställs, men `document.activeElement` är `body`, så tangentbordsanvändaren börjar om från sidans början.
- **Acceptans:** efter återgång till översikten ligger fokus på den kontroll som öppnade kalendern (eller på kortets rubrik).
- **Fix:** spara `id` eller `data-*` för den utlösande kontrollen tillsammans med returnyckeln, och fokusera den med `preventScroll` efter återställningen.

### PR-F1-QA-3 – Low (dokumentation): inbäddad QA-rapport har annan sha256 än den angivna
- **Plats:** `docs/qa/QA-REPORT-premium-5212b7a.md`; `docs/VERIFICATION.md:9-10` och `docs/HANDOFF.md:10`.
- **Repro:** sha256 för filen i zippen är `6599e085db6f6478937bb155f67ccba605bf1403c0d788ed8ffc47aa9c0e26ea`. Efter `tr -d '\r'` är den `864d6373…`, alltså byte-identisk med mitt original. Skillnaden är bara radslut (CRLF), men dokumentationen påstår att originalets SHA256 är verifierad.
- **Acceptans:** antingen ger filen i repot exakt `864d6373…`, eller så anger dokumentationen att hashen gäller efter LF-normalisering.
- **Fix:** `.gitattributes` med `docs/qa/*.md -text` (eller `eol=lf`) och skriv om filen med LF.

### Status för PR-QA-1 till PR-QA-5 (från 5212b7a)
Ingen av dem berörs av ändringen; de berörda filerna är oförändrade. De ligger kvar öppna i backloggen. Detta gäller även PR-QA-3, eftersom `playwright.config.ts:30` är oförändrad.

## 7. Beslut (avgränsat)
- **Översikten i 4b02f26, syntetisk lokal miljö, Playwright Chromium: GO.** Rättelsen gör vad den ska: balanserat innehåll bredvid 224 px-menyn, tre kolumner från 1680 px, inget sidscroll och oförändrad mobil. Den negativa kontrollen visar att felet fanns och nu är borta.
- **Pilot, fysisk Safari/iPhone, ägarens acceptans och merge till main: NO-GO / separat.**
- Användarens ursprungliga Safari-observation kan bara bekräftas som löst i riktig Safari, och det är inte gjort.

## 8. NOT RUN
- Riktig Safari (macOS/iOS) och fysisk iPhone eller Retina-skärm (DPR 2 är bara emulerad i Chromium).
- **Playwright WebKit:** webbläsarbinären laddades ned gratis, men går inte att starta på boxen. Systembibliotek saknas (libevent, gstreamer-gl/codecparsers, libavif, libmanette, libenchant), det finns ingen root, och apt-förrådet gick inte att nå (HTTP 500). Därför finns ingen WebKit-mätning.
- Firefox och skärmläsare.
- Full 62-E2E-matris, dev-läge, integrationstester och agentkort.
- Andra adminsidor än översikten, utöver att deras sidhuvud och navigation öppnades.
- Zoom och textskalning.
- Bredder över 2880 px.
- Preview, CI och GitHub.

## 9. Städning
- Postgres och appen är stoppade efter varje körning.
- Raderat: `/tmp/pf1*` (syntetisk hemlighet, lösenord och sockets), samt i min körmapp `work/.env`, `work/node_modules`, `work/.next`, `pgdata` och `pgdata-ux`.
- Behållet: `src` och `base` (orörda uppackningar), loggar, prober och skärmbilder.
- Playwright WebKit-binären (`~/.cache/ms-playwright/webkit-2388`) från försöket ovan finns kvar i den delade cachen.
