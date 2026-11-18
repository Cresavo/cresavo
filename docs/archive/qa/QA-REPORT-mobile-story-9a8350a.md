# Klickgranskning – c9dbc52 och slutversion 9a8350a

**Granskare:** Grok Bot (oberoende QA). **Datum:** 2026-11-14, 09:43–10:12 (Europe/Stockholm).

**Webbläsare:** Playwright Chromium 1.65 med emulerade viewports. Vid 320 och 390 px användes touch (`hasTouch` och `tap`). Det är inte Safari, inte WebKit och inte en fysisk iPhone.

**Miljö:**
- separata syntetiska kopior per revision;
- färsk inbäddad Postgres som körs utan root i en isolerad netns;
- TZ=Europe/Stockholm och `env -u NODE_ENV`;
- endast `@example.test`-adresser och egna syntetiska hemligheter;
- prod-läge: `next build` + `next start`, åtkomligt bara inne i netns.

Ingen original/PC/preview/GitHub/drift.

**Den slutversion som faktiskt klicktestats är 9a8350a.** e9bb0b1 har bara jämförts med diff och har inte klicktestats.

## 1. Revisioner och diffbevis
- **c9dbc52:** zip `7c7ead7d…1bbe`, kommentar `c9dbc52bd837…`, 749 poster. Endast `.env.example` + tillåtna filer (ej lästa).
- **e9bb0b1:** zip `b733cf1d…7487`, endast för diff. `diff -rq` mot c9dbc52 visar en enda fil, `src/app/workspace-polish.css`, med två ändrade rader:
  - rad 831: padding `4px 12px` → `4px 2px`;
  - rad 839: regeln `body:has(input:focus,textarea:focus) .workspace-primary { position:static }` ersattes med `scroll-margin-bottom: 64px`.

  **Påståendet stämmer.**
- **9a8350a:** zip `a1bb8029…ff4b`, kommentar `9a8350a7d68a…`, 749 poster. `diff -rq` mot e9bb0b1 visar bara att `next.config.ts:18` fått `devIndicators: false`. **Påståendet stämmer.**
- **c9dbc52 mot 4b02f26 (kontext):** ny produktsida (relay/css; `scene.tsx` oanvänd), förval via `?service&staff&date&slot`, fokusåtergång, mobil bottenmeny (`workspace-polish.css:824-840`), två e2e-specar och dokumentation.
- Inga ändringar i package-filer, schema, API eller MCP. Docs har inga Codex-påståenden om c9dbc52/9a8350a.

## 2. Grindar (egna körningar)

| Steg | c9dbc52 | 9a8350a |
|---|---|---|
| npm ci, generate, migrate (10), seed, lint, tsc, build | PASS | PASS |
| unit | 114/114 | 114/114 |
| E2E prod, 5 specar (capacity, coherence, customers, workspace, flow) | **31/38** (7 FAIL, alla `mobile` eller vid 320/390-viewport). Omkörning: samma 7. | **38/38** |
| Negativ kontroll c9dbc52: samma specar utan det nya bottenmenyblocket (`workspace-polish.css:824-840`) | 38/38. Blocket är alltså orsaken. Filen återställd och kontrollerad med `cmp`. | – |

## 3. c9dbc52 – egna klick (probe `ck.mjs` och `ck-f4.mjs`, prod)

| Flöde | 320 | 390 | 1180 | 1440 |
|---|---|---|---|---|
| F1 Kalender → bokning med kund → kundkort → samma bokning → samma dag, personal och vy. Exakt scroll; webbläsarens Bakåt ×2; fokus på bokningen vid återgång | PASS 5/5 | PASS 5/5 | PASS | PASS |
| F2 Sökning → kundkort → samma sökning (q, 20 träffar, scroll, fokus på raden), både via ”Till kunder” och via Bakåt | 3/4: **första tap på ”Sök kunder” efter inmatning skickar inte sökningen** | 3/4: samma fel | PASS 4/4 | PASS 4/4 |
| F3 Översikt → förslag → kalender → samma förslag (scroll och fokus på samma ”Öppna kalendern”, med 3 px ring), i appen och via Bakåt | PASS | PASS | PASS | PASS |
| F4 ”Avboka” → ”Behåll” och ”Flytta” → ”Avbryt flytt”: oförändrad bokning, fokus tillbaka, Bakåt till samma dag och scroll | PASS | PASS | PASS | PASS |
| F4 Varning för osparade ändringar, samt ”Spara kundkort” direkt efter inmatning | **FAIL ×2** (tapen når inte målet, se CK-QA-1) | **FAIL ×2** | PASS | PASS |
| F5 Fullbokad dag (11 syntetiska bokningar, 0 tider kvar). Kund: inga tider och texten ”Det kan vara stängt eller fullbokat”; ”Hitta nästa lediga dag” går till en senare dag. Admin: alla 11 bokningar, inget överflöde, inga sidfel | PASS | PASS | PASS | PASS |
| F6 `/product` → ”Try the booking demo” förväljer samma tjänst, person, dag och tid; bekräftelsen visar samma tid; DB har exakt samma tid, tjänst och person; ”Se tiden i demokalendern” visar blocket på samma tid (Stockholm) | PASS (sv) | PASS (en) | – | PASS (en) |
| F7 Första skärmen: överflöde, kontrast AA, CTA, mål ≥24 px | 8/9 | en 15/16, sv: 2 FAIL | – | 5/6 |

**F7 i siffror:**
- Vid 390 (844 px hög) ligger CTA:ns mittpunkt på y=518, alltså i den nedre 60 %-zonen. CTA:n är 212×46 px; vid 320 är mittpunkten y=605.
- Ingen text ligger över fotot, eftersom fotot ligger under texten på mobil. PR-QA-1 (navigeringstext över spegelbågen) är därmed borta.
- Rubriken ”Book through your AI assistant.” förklarar vad ”assistant” syftar på.
- Kontrasten klarar AA på hela sidan.

## 4. 9a8350a – riktade klick (probe `ck2.mjs`)

| Kontroll | 320 touch | 390 touch | 1440 |
|---|---|---|---|
| F1, F2, F3, F4 (samma kontroller som ovan) | PASS 18/18 | PASS 18/18 | – |
| Första tap på ”Sök kunder” och ”Spara kundkort” direkt efter inmatning, samt tap på bottenmenyns ”Kunder” med osparat utkast (bekräftelsedialog, utkastet behålls) | PASS | PASS | – |
| Fokuserat namn- och e-postfält syns ovanför bottenmenyn (menyn börjar på y=783, fältet slutar på y≤642, ringen ingår) | PASS | PASS | – |
| Spara/Avbryt för kund, Flytta/Spara flytt/Avbryt för bokning, Stäng/Avbryt för tjänst: syns, täcks inte av menyn, träffpunkten i mitten är knappen själv, höjd ≥44 px (Stäng: 50 px). Första tap sparar (version 1→2); Avbryt sparar inget; fokus återförs och täcks inte | PASS 18/18 | PASS 18/18 | – |
| Tab-ordning i redigeringsformuläret (namn → e-post → telefon → … → Spara → Avbryt): 10 stopp, alla med 3 px ring och ovanför menyn | PASS | PASS | – |
| ”Översikt” i prod: tap navigerar, alla 4 provpunkter träffar app-länken | PASS | PASS | PASS |
| ”Översikt” i dev (`next dev`, `env -u NODE_ENV`): tap navigerar, alla provpunkter träffar länken, inga synliga rutor från Nexts dev-overlay | PASS | PASS | PASS |
| **Negativ kontroll i dev:** `devIndicators` borttagen (Nexts standard) | Indikatorn (36×36 vid x20/y788) täcker mitten av ”Översikt” och tapen spärras (FAIL, avsett utfall) | Indikatorn träffar länkens vänstra del (FAIL, avsett utfall) | Indikatorn ligger utanför länken |

Efter den negativa kontrollen är `next.config.ts` återställd och kontrollerad med `cmp`. **Totalt: prod 75/0, dev 3/0, negativ kontroll 0/3 (avsett).**

## 5. Fynd

- **CK-QA-1 – High (c9dbc52), RÄTTAT i e9bb0b1/9a8350a.**
  - **Plats:** `workspace-polish.css:839` (c9dbc52), regeln `body:has(input:focus…) .workspace-primary{position:static}`.
  - **Orsak:** vid 320/390 är headern 178 px hög så länge ett fält har fokus. När fältet tappar fokus blir menyn fast och headern krymper till 113 px. Knapparna flyttas 65 px uppåt mitt i tapen.
  - **Repro:** 390 touch → kundkort → ”Redigera kunduppgifter” → skriv i namnfältet → tryck ”Spara kundkort”. Inget sparas på första tryckningen. Samma sak gäller ”Sök kunder” och en menylänk när utkastet är osparat (då visas ingen dialog).
  - **E2E:** 7 FAIL; utan blocket 38/38.
  - **Acceptans:** första tap fungerar och layouten är stabil vid blur. **Uppfyllt i 9a8350a** (38/38 och 18/18 per bredd).
- **CK-QA-2 – Low (båda revisionerna), `src/app/product/relay.tsx:75-92`.** Kortet ”When can I get a massage? 16:30 …” är inte märkt som exempel. Förklaringen (”The question above illustrates a request”, rad 129) ligger i en stängd `<details>` i sidfoten.
  - **Acceptans:** en synlig etikett vid kortet, till exempel ”Example request · real available time”.
- **CK-QA-3 – Low (båda revisionerna), `relay.tsx:86` och `product.module.css:372`.** ”Elias (demo)” bryts över 2 rader vid 390 sv (”(demo)” på egen rad); en rad i en.
  - **Acceptans:** personnamnet radbryts inte (`white-space:nowrap` på namnet, eller egen rad för hela namnet).
- **CK-QA-4 – Info.**
  - Fokus hamnar på `body` efter navigering framåt till en bokning eller ett kundkort; vid återgång hamnar det rätt.
  - Fokus som sätts programmatiskt efter tap visar ingen ring. Det följer `:focus-visible`, och med tangentbord syns ringen.
  - Engelsk text blandas med svensk data (SEK, ”Elias (demo)”); ”Relaxation massage” är hårdkodat i `relay.tsx`.
- **Tidigare fynd:**
  - PR-F1-QA-2 (fokus till `body` på översikten) är **rättat**: fokus återförs till samma förslag.
  - PR-QA-1 (text över fotot) är **borta**, eftersom ny layout saknar text över fotot.
  - PR-QA-5: ”Keep original time / Avbryt flytt” är förtydligat. Knappen i flyttformuläret heter fortfarande bara ”Avbryt”.

## 6. Beslut (avgränsat, syntetiskt lokalt, Chromium)
- **c9dbc52: NO-GO**, på grund av CK-QA-1 (High: första tap går förlorad på mobil, och 7 e2e-fel). Den här revisionen ersätts av 9a8350a.
- **e9bb0b1:** endast diffad. Inget beslut.
- **9a8350a: GO** för de klickade flödena. CK-QA-1 är rättat, och Nexts dev-indikator stör inte längre ”Översikt”. Fynden CK-QA-2 och CK-QA-3 (Low) ligger i backloggen.
- **Pilot, fysisk Safari/iPhone, ägarens acceptans och merge till main: NO-GO / separat.**

Ingen FIX-REQUEST: inga Medium+ kvar i slutversionen.

## 7. NOT RUN
- Riktig Safari eller iPhone, inklusive verkligt mjukt tangentbord, `env(safe-area-inset-bottom)` och dynamisk viewport. Playwright WebKit går inte att starta på boxen.
- Full e2e-matris (62), dev-e2e, integration och agentkort.
- Klicktest av e9bb0b1.
- 1180/1440 för redigeringsflödena på 9a8350a (desktopflödena kördes på c9dbc52).
- Skärmläsare.

## 8. Artefakter och städning

**c9dbc52-probe och loggar (`clicks-c9dbc52/run/`):**
- `ck.mjs` `853a0436421d…`, `ck-f4.mjs` `ffca74ef2323…`;
- loggar `de1c978b7947…` och `f891f475aefe…`;
- negativ kontroll e2e `987683a814c3…`.

**9a8350a (`clicks-9a8350a/run/`):**
- `ck2.mjs` `e1ff50017e23…`;
- prod `114360cc1659…`, dev `e7d78ab0d886…`, negativ kontroll `2951778bb1ff…`.

Skärmbilderna ligger i respektive körmapps `shots/`.

**Städning:** Postgres och apparna är stoppade. Raderat: `/tmp/ck*`, samt `work/.env`, `node_modules`, `.next` och pgdata i mina körmappar.
