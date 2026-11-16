# QA-rapport – Booking Lab proaktiv översikt, fixvarv 1 (8843d06)

**Datum:** 2026-11-13 (Europe/Stockholm) · **Typ:** riktad samlad återkontroll av PRO-QA-1 (fixvarv 1 av högst 2) · **Testare:** Grok Bot (QA)

## 1. Scope
| Fält | Värde |
|---|---|
| Revision | `8843d06350c6478e375fb640579cb3ac4f7fe3dc` (gren `feature/proactive-capacity-overview`) |
| Arkiv | `/workspace/qa/booking-lab-se/proactive-fix1-8843d06/booking-proactive-fix1.zip` |
| sha256 | `8a7c39661a76bafa5605f99f0a2da533e42fce5ca9f94ad78a2f48681bd6444d` (verifierad; identisk med bifogad fil) |
| Storlek / poster / kommentar | 2 500 857 byte / 373 poster / `8843d06350c6478e375fb640579cb3ac4f7fe3dc` (verifierat) |
| Förbjudna filer | Inga. Endast `.env.example`; inga nycklar, `node_modules`, `.next`, pgdata eller `.git` |
| Jämförelsebas | Min extraktion av 956155f (`proactive-956155f/run/src`) |

### Hur körningen gjordes
- **Arkivet orört:** `run/src` är orörd extraktion. Efter körningen extraherades zip-filen på nytt och jämfördes med `diff -rq`, utan skillnader.
- **Körkopia:** allt kördes i `run/work`, en LF-normaliserad kopia utan `review-evidence/`. Ingen produktkod ändrades.
- **Databaser:** egna `f1_test`, `f1_int_test`, `f1_demo` och `f1_e2e_prod_test`.
- **Data och konton:** egna syntetiska admins (`qa-admin-a@`/`qa-admin-b@example.test`). Testvakten behölls.
- **Portar:** PG 55710 (host) och 55711 (isolerat nätverksnamespace), app 3510; port 3000 enbart inuti namespace. TZ=Europe/Stockholm.
- **Hemligheter:** en slumpad SESSION_SECRET skrevs till en temporär `.env` som sedan raderats. Inga hemligheter lästes eller skrevs ut.
- **Inga externa åtkomster:** ingen GitHub/cloud/preview/PC, inget push/deploy, inga utskick.
- **Disk:** 85 % före körningen. Ingen städning av föregångaren behövdes.

**Startincident:** första matrisstarten avbröts direkt. `rsync` saknas på boxen, så `work/` skapades inte, och `npm ci` föll i `run/` utan `package.json`. Inga filer eller DB-objekt påverkades. Logg: `logs/matrix-abort-norsync.out`. Skriptet fick en `cd … || exit 1`-vakt och kördes om från början med `cp -a`.

## 2. Diff 8843d06 mot 956155f
Fillistan finns i `logs/changed-files.txt` och koddiffen i `logs/code.diff`.

- **Produktkod (5 filer):**
  - `src/lib/capacity.ts`: cursor i schemat, keyset-fråga, `nextCursor`.
  - `src/mcp/workspace.ts`: bara verktygsbeskrivningen.
  - `src/app/admin/overview/page.tsx`: searchParams, fallback och statiskt fel.
  - `src/app/admin/overview/overview.tsx`: sidnavigering och query i refresh.
  - `src/app/style.css`: `.capacity-pages a` med min-höjd 44 px.
- **Tester:**
  - `tests/capacity.test.ts`: tom cursor och cursor på 129 tecken ger fel.
  - `tests/integration/capacity.test.ts`: 11:e förslaget nåbart, ogiltig cursor, MCP-sida 2.
  - `tests/e2e/capacity.spec.ts`: sida 2 och felaktig cursor.
- **Dokumentation:**
  - `AGENTS.md`, 8 filer under `docs/*`.
  - Nya `docs/qa/QA-REPORT-proactive-956155f.md` och `FIX-REQUEST-…` (mina tidigare rapporter som underlag).
  - Ny `review-evidence`.
- **Oförändrat:** inga nya migrationer (fortfarande 8). `package.json` och `package-lock.json` är byte-identiska. Varken `errors.ts` eller `schema.prisma` ändrades; meddelandet "Ogiltig sidmarkör för datumintervallet" fanns redan i 956155f.
- **Bedömning:** ändringarna håller sig till PRO-QA-1 plus tester och dokumentation. Inga ändringar i andra epics.

## 3. Kodgranskning av cursorn (`src/lib/capacity.ts`)
- **Kodning och validering:** cursorn är ett rått Booking-id (`id = z.string().min(1).max(128)`, rad 18/24), inte signerad eller opak. Den slås upp på servern med samma `where` som listan: företag, `status=cancelled`, avbokningshändelse och `from..end` (rad 193–206). Annars blir det `DomainError` 400 med ett enda gemensamt meddelande.
- **Tenantbindning:** `businessId` ingår i uppslaget. En källa från ett annat företag avvisas. Verifierat med en syntetisk rad med `businessId='qa-other'`.
- **Fönstergränser:** cursorn måste ligga inom `from..from+days`. Fönsterkontrollen (från idag till och med idag+7) gäller som förut.
- **Lika startsAt:** keyset `(startsAt > c) OR (startsAt = c AND id > c.id)` med `orderBy [startsAt, id]` (rad 210–216). Det ger konsekvent ordning med samma kollation, vilket bekräftas av genomgången med limit=1.
- **Maxgräns:** `limit` är 1–20 (zod) och `take = limit+1`. Värdena 21, 1e6, -1, 0, 2.5, 1e3 och abc avvisas.
- **Strikt schema:** `.strict()` behålls. `page`, `offset` och `nextCursor` som query-parametrar avvisas.
- **Inga kunduppgifter:** projektionen är oförändrad; `nextCursor` är bara ett källa-id som redan finns i listan.
- **Läckage:** alla ogiltiga cursorfall ger byte-identiska svar, både när id:t saknas och när det tillhör ett annat företag eller ligger utanför fönstret. Auth kontrolleras före cursoruppslag (anonym användare får 403 oavsett cursor). Ett giltighetsorakel finns bara för inloggad admin, för id:n som admin ändå ser.
- **UI-sidan (`page.tsx:15-45`):**
  - Fel i searchParams (schemafel), samt 400/409 från `listCapacity`, ger första sidan med `role="alert"` "Ogiltigt sidval. Visar första sidan." (rad 55). Övriga fel går till `pageDataFailure`.
  - `key={JSON.stringify(query)}` nollställer klientläget vid sidbyte.
  - `refresh()` och serveråtgärder laddar om med samma query (`overview.tsx:44`), så aktuell sida behålls.

## 4. Egna körningar (VERIFIERAT)
Alla kommandon kördes med `env -u NODE_ENV`, TZ=Europe/Stockholm. Kommandon finns i `run/logs/commands.log`, resultat i `run/logs/summary.log`.

| # | Kommando | Resultat |
|---|---|---|
| 1 | `npm ci` | PASS – "added 572 packages, audited 573" |
| 2 | `npx prisma generate` · `npm run db:migrate` (8) · `npm run db:seed` | PASS |
| 3 | `npm run lint` | PASS |
| 4 | `npx tsc --noEmit` | PASS |
| 5 | `RATE_LIMIT_STORE=memory npm test` | PASS – 15 filer, **78/78** |
| 6 | `npm run build` | PASS |
| 7 | `RATE_LIMIT_STORE=postgres npm run test:integration` (färsk `f1_int_test`) | PASS – 21 filer, **90/90**; restdata 0 utom 6 RateLimitBucket (känd Info) |
| 8 | Prod-E2E i isolerat namespace: `RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e` | PASS – **42/42** (57 s), kapacitetsspec desktop + mobil; restdata 0 i alla tabeller |
| 9 | `npm audit --json` | 7 moderate (dev, oförändrat) |
| 10 | `npm audit --omit=dev --json` | 0 |
| 11 | Demo-DB `f1_demo`: migrate, db:seed, demo:seed, demo:seed:capacity, admin:manage ×2; app `npm run start` på :3510 (`RATE_LIMIT_STORE=postgres`) | PASS |
| 12 | `probes/setup-sources.mjs`: 14 avbokningar idag. De 10 första är hanterade (6 avfärdade, 2 utkast, 2 ombokade av "annan kund", dvs. inaktuella). 11:e och följande är handlingsbara, inklusive ett par med samma startsAt (15:00) | PASS (alla åtgärder 200/201) |
| 13 | `probes/api-f1.mjs` (HTTP + MCP) | 66 PASS / 9 FAIL – alla 9 FAIL var HTML-kontroller med fel kortselektor i proben (`class="panel capacity-card"`). Övriga API- och MCP-kontroller var PASS. Logg: `logs/api-f1-attempt1.txt` |
| 14 | `probes/html-f1.mjs` (omkörning av HTML-kontrollerna med rättad selektor) | 13 PASS / 1 FAIL – FAIL är en probeartefakt: min PII-regex träffade cursorvärdet `qa-other-company-src`, som Next återger i routerns URL-state. Ingen kunddata (manuellt kontrollerat) |
| 15 | `probes/ui-f1.mjs` (Chromium headless 320/390/1440) | **51/0** (`logs/ui-f1.txt`). Försök 1 avbröts av fel kortselektor vid tvillingkort (samma aria-label, se PRO-F1-QA-3); utan sidoeffekter |
| – | 4-läges E2E-matris | NOT RUN (riktad återkontroll; prod0 full svit körd) |

### 4.1 API och MCP (verifierat)
- **Sida 1:** standard-GET ger 10 förslag, `hasMore`, och `nextCursor` = sista id:t på sidan. Alla 10 är hanterade eller inaktuella (exakt de 10 förväntade).
- **Sida 2:** innehåller tvillingparet 15:00 sorterat på id stigande, samt 15:30 och 16:00, alla handlingsbara. Ingen överlappning med sida 1.
- **Uttömmande genomgång:** limit 1, 3, 10 och 20 ger samma 18 källor som DB-mängden, i ordningen (startsAt, id), utan dubbletter eller luckor. Vid limit=1 delas tvillingparet över två sidor.
- **Gränser:**
  - limit 20 ger 200.
  - limit 21, 1e6, -1, 0, 1e3, 2.5 och abc samt days=8, tom cursor, cursor på 129 tecken, `page`, `offset` och `nextCursor` ger 400.
  - Cursor på 100 000 tecken ger 431 (Node-headergräns).
- **Ogiltiga cursorer ger 400** med "Ogiltig sidmarkör för datumintervallet" och byte-identiska svar: slumpsträng, manipulerat id, trunkerat id, SQL-liknande sträng, id för aktiv bokning, källa från annat företag, källa utanför `days`-fönstret och källa före `from`. Raden för det andra företaget visades aldrig i listan och raderades efteråt.
- **Auth före cursor:** anonym GET med giltig respektive ogiltig cursor ger 403 med identisk body. Förfalskad cookie ger 403. Admin B ser samma sida 2 med samma cursor.
- **POST oförändrat:**
  - Avfärda på sida 2 ger 200. Replay med samma nyckel utan Origin ger 403, och anonymt ger 403, alltså auth/origin före replay.
  - `cursor` i POST-input ger 400.
  - Efter avfärdande visar samma cursorsida källan som `dismissed`.
- **Utkast på sida 2:** en riktig `Campaign` med `published=false`. Svaret innehåller bara `id`, `campaignId` och `status`. Tiden är fortfarande publikt bokningsbar, så utkastet är ingen reservation.
- **Inaktualitet:** en publik bokning (201) gör källan på sida 2 `available=false`, och utkastet ligger kvar opublicerat. `calendar` med gammal token ger 409. `calendar` för en handlingsbar källa på sida 2 ger rätt datum, dagvy och personal.
- **MCP `--admin`:**
  - Sida 1 och 2 ger samma id:n och `nextCursor` som HTTP, utan kunddata.
  - Slumpcursor, annat företag, utanför fönstret och aktiv bokning ger fel med samma text. limit 21/1e6, tom cursor, 129 tecken, `page` och cursor som nummer ger schemafel.
  - Inga skrivverktyg finns utan `--allow-workspace`.
- **Integritet:** 0 överlappande aktiva bokningar i `f1_demo` efter alla prober.

### 4.2 HTML (verifierat)
- Följande querysträngar ger 200, den statiska alerten "Ogiltigt sidval. Visar första sidan." och exakt samma 10 kort som standardsidan, utan oescapad `<script>` och utan kunddata: `?cursor=foreign-source`, annat företag, `limit=999`, `limit=21`, `days=99`, `foo=1`, tom cursor, `from=igår`, `cursor=<script>…`, källa före `from` och `cursor=a&cursor=b`.
- Giltig cursor ger ingen alert, sida 2 (tvillingparet 15:00 först) och "Till första sidan".
- Anonym användare med cursor får inget översiktsinnehåll.

### 4.3 Webbläsare (egen headless Chromium, prod-build)
Kontrollerat vid 320, 390 och 1440:
- Sida 1 har 10 kort utan handlingsbara förslag. "Nästa förslag" är minst 44 px och ligger inom viewport, och "Till första sidan" saknas.
- Ingen horisontell overflow på sida 1, sida 2 eller vid felaktig cursor.
- Klick ger en URL med `days`, `limit`, `from` och `cursor`, och sidan visar det handlingsbara 11:e förslaget med åtgärder.
- Omladdning ger samma URL och samma första kort.
- "Öppna kalendern" från sida 2 ger rätt datum, `view=day` och personal. Bakåtknappen återgår till samma sid-URL.

Åtgärder per bredd:
- **320, avfärda:** URL:en är oförändrad efter serveråtgärd och refresh. Kortet visar "Avfärdat", även efter omladdning; DB bekräftar `dismissed`.
- **390, utkast:** förhandsvisning utan overflow; spara ger 1 opublicerad kampanj på 15 %. URL:en är oförändrad, kortet visar "Utkast sparat", och tiden är fortfarande bokningsbar.
- **1440, inaktualitet:** en annan kund bokar (201). Efter "Uppdatera förslagen" är URL:en oförändrad, kortet visar "Inaktuellt underlag" och kalenderknappen är inaktiverad.

Gemensamt för alla bredder:
- "Till första sidan" ger `/admin/overview` med 10 kort.
- Felaktig cursor ger en synlig alert och första sidan.
- Inga konsolfel och ingen kunddata.
- Tangentbord vid 390: Tab når "Nästa förslag" med synlig fokus, och Enter ger sida 2.

Skärmbilder i `run/shots/`:
- `overview-p1-{320,390,1440}.png`, `overview-p2-{320,390,1440}.png`, `bad-cursor-{320,390,1440}.png`;
- `p2-draft-preview-390.png`, `p2-stale-1440.png`.

## 5. Codex-påståenden
| Påstående | Bedömning |
|---|---|
| Bara PRO-QA-1 rättat | **Bekräftat** (diff: 5 produktfiler, tester och dokumentation) |
| Begränsad keyset-cursor (startsAt, id); max 20/sida | **Bekräftat** (kod och tester inkl. likadana startsAt) |
| UI "Nästa förslag"/"Till första sidan"; sidval i URL överlever reload/refresh/åtgärder | **Bekräftat** (UI-probe 51/0) |
| Samma schema/API/MCP | **Bekräftat med precisering:** samma endpoints och verktyg; additivt valfritt `cursor`-fält i indata och `nextCursor` i utdata. Strict behålls |
| 11:e+ förslag nåbart när de första 10 är hanterade/inaktuella | **Bekräftat** (API, MCP, HTML och UI) |
| Ogiltig/annat företags/utanför fönstret-cursor avvisas i API/MCP; HTML visar statiskt fel och första sidan | **Bekräftat** |
| Ingen kunddata | **Bekräftat** |
| Inga nya migrationer/beroenden/lockändringar | **Bekräftat** |
| 78 unit / 90 integration / lint / tsc / build PASS | **Bekräftat** |
| Nytt prod0 kapacitet desktop+mobil 2/2 | **Bekräftat och utökat:** hela prod0-sviten 42/42 |
| Full 4-lägesmatris (42) körs | **Ej verifierbart / NOT RUN av mig** |
| Första prod0 40/2 i nätverksmock; avlyssning rättad, assertions oförändrade | **Delvis verifierbart.** Diffen mot 956155f visar att 503-mocken bytte glob `**/api/admin/capacity` mot regex `/\/api\/admin\/capacity(?:\?.*)?$/`; detta krävs när GET nu har en querysträng. Mockens assertions (felalert, kortet kvar, alert borta efter unroute) är identiska. Inga gamla assertions togs bort eller försvagades. Heading-namnet bytte från `synthetic.marker` till den fasta texten "Massage – sidprov" (likvärdigt; tjänsten städas via spårat id). Assertions för sida 2 och felaktig cursor tillkom. Mellanversionen som gav 40/2 finns inte i arkivet, så själva 40/2-körningen går inte att verifiera |
| 2 nya skärmbilder | Codex-bevis, inte mitt bevis. Mobilbilden av sida 2 stämmer visuellt med min `overview-p2-390.png` |
| 167 filer matchar testkopian | **Ej verifierbart** (testkopian är inte tillgänglig) |

## 6. Status för PRO-QA-1
**STÄNGD.** Handlingsbara förslag bortom de första 10 går nu att nå via sidnavigering i UI, HTTP och MCP. Den missvisande texten "Fler finns i kalendern" är borttagen.

## 7. Nya fynd
Inga nya fynd med allvarlighetsgrad Medium eller högre.

- **PRO-F1-QA-1 – Low (UX):** sida 1 ger ingen signal om att handlingsbara förslag finns längre fram. Admin måste bläddra förbi hanterade och inaktuella kort; vid 320 ligger "Nästa förslag" under vikningen (y≈865).
  - **Kod:** `src/app/admin/overview/overview.tsx:67-87`.
  - **Repro:** steg 12 ovan, öppna sedan `/admin/overview`.
  - **Fixriktning (backlog):** visa antal att hantera, eller ett filter "Visa endast att hantera".
- **PRO-F1-QA-2 – Info:** felalerten "Ogiltigt sidval…" är en ostylad `<p role="alert">` som ser ut som brödtext (`src/app/admin/overview/page.tsx:55`; se `shots/bad-cursor-320.png`). Fixriktning: använd samma alert- eller notisstil som övriga fel.
- **PRO-F1-QA-3 – Info (a11y):** två källor med samma startsAt (avbokad, ombokad och avbokad igen) får identisk `aria-label` "tjänst + tid" (`overview.tsx:219`), så skärmläsare kan inte skilja korten åt. Fixriktning: lägg till status eller personal i etiketten.
- **PRO-F1-QA-4 – Info:** sid-URL:en låser `from` (`overview.tsx:81`). Ett bokmärke till sida 2 visar efter midnatt "Ogiltigt sidval" och första sidan. Det är korrekt och säkert, men kan förvåna.
- Tidigare Info-fynd (PRO-QA-2…8) är fortsatt backlog. De har inte testats om och är inga nya uppdrag.

### Blockerare
Inga.

## 8. Saknade tester
- Genomgång med limit=1 över likadana startsAt (verifierat av mig, inte i sviten).
- Cursor från annat företag i integrationstest. Sviten testar `foreign-source` och en id-källa utanför fönstret, men inte en verklig rad med annat `businessId`.
- Byte-identiska felsvar för olika slag av ogiltig cursor.
- UI-test som verifierar att URL:en behålls efter serveråtgärd (avfärda/utkast) på sida 2.
- HTML-fallback för `limit=999`, `days=99`, `from=igår` och dubblerad cursor.

## 9. NOT RUN
- 4-läges E2E (dev och proxy=1): riktad återkontroll; prod0 full svit körd.
- Fysisk iPhone/Safari: ingen enhet.
- Preview/cloud/GitHub: förbjudet.
- Uppgraderingsprov 7→8: ingen ny migration; bekräftades i 956155f-rapporten.
- Ny full QA av oförändrade epics: utanför scope.

## 10. Harness- och probefiler (utanför src)
- Skript: `run/matrix.sh`, `run/e2e-ns.sh`.
- Prober: `run/probes/{setup-sources,api-f1,html-f1,ui-f1}.mjs`.
- Loggar: `run/logs/` (inkl. `changed-files.txt`, `code.diff`, `e2e-spec.diff`, `int-test.diff`, `unit-test.diff`, `audit-*.json`, `setup-sources.json`).
- Skärmbilder: `run/shots/`.

## 11. Städning
- Appservern på :3510 är stoppad. PG 55710 är stoppad, och 55711 stoppades av E2E-skriptet.
- `work/.env` och `.qa-admin-pw` är raderade, liksom `/tmp/f1ns`.
- Inga processer eller lyssnande portar finns kvar. Disk 85 % (20G fritt). pgdata ligger kvar som lokal QA-artefakt.

## 12. Beslut
- **Syntetisk POC (lokal, @example.test): GO.** PRO-QA-1 är stängd, och inga Medium+ eller blockerare återstår. PRO-F1-QA-1…4 är backlog.
- **Pilot med riktiga kunder/data: NO-GO.** Den fulla 4-lägesmatrisen, test på fysisk mobil/Safari och tidigare pilotvillkor återstår.
- Ingen FIX-REQUEST skickas, eftersom inget verkligt Medium+-fynd finns. Fixvarv 2 behövs inte.
