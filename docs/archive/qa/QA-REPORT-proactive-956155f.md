# QA-rapport – Booking Lab "proaktiv kapacitetsöversikt" (956155f)

**Datum:** 2026-11-13 (Europe/Stockholm) · **Typ:** oberoende QA, en körning, inga parallella kopior · **Testare:** Grok Bot (QA)

## 1. Scope
| Fält | Värde |
|---|---|
| Revision | `956155fa0d7db70d5050990bba1490d52f546055` (gren `feature/proactive-capacity-overview`, bas `28a48fe`) |
| Arkiv | `/workspace/qa/booking-lab-se/proactive-956155f/booking-proactive-956155f.zip` |
| sha256 | `5393cbd57c92f4a3f8a74ab22b532400eef6ef7b25532e3ae155992b4a7bd95f` (verifierad) |
| Storlek / poster | 2 407 937 byte / 375 poster, zip-kommentar `956155f…`, endast `.env.example` (verifierat) |
| Scope-dokument | `docs/PROACTIVE_OVERVIEW_PLAN.md` |
| Jämförelsebas | 7c1407d (fix1-QA, `../../fix1-7c1407d/run/new`): 38 ändrade/nya filer, patch `logs/7c1407d-vs-956155f.patch` (5 298 rader) |

Regler som följts: `run/src` är orörd extraktion. Allt kördes i `run/work` (LF-normaliserad kopia utan `review-evidence/`), och ingen produktkod ändrades. Bara syntetisk `@example.test`-data användes. Egna DB:er (`pro_test`, `pro_int_test`, `pro_demo`, `pro_ui_demo`, `pro_upg_demo`) och egna admins skapades, och testvakten behölls. Inga hemligheter lästes eller skrevs ut; slumpad SESSION_SECRET lades i en temporär `.env` som raderats. Ingen GitHub/cloud/preview/server/PC, ingen push/deploy, inga betaltjänster eller utskick. Portar: PG 55700 (host) och 55701 (i isolerat nätverksnamespace), app 3500/3501 (host) och 3000 enbart inuti namespace. TZ=Europe/Stockholm.

**Miljöincident:** första `npm ci` misslyckades och PG kraschade eftersom disken var 100 % full (128G delad box). Jag frigjorde ca 23G genom att radera `node_modules`/`.next` i 50 gamla, egna och återskapbara booking-lab-se-QA-körningar (lista i `/tmp/qa-del-list.txt`). Därefter initierades pgdata om och matrisen kördes om från början. Loggar från försök 1 ligger i `logs/attempt1-diskfull/`. Ingen produktpåverkan.

## 2. Egna körningar (VERIFIERAT)
Allt kördes med `env -u NODE_ENV`, TZ=Europe/Stockholm. Kommandon finns i `run/logs/commands.log`, resultat i `run/logs/summary.log`.

| # | Kommando | Resultat |
|---|---|---|
| 1 | `npm ci` | PASS – "added 572 packages, audited 573" (10 s) |
| 2 | `npx prisma generate` · `npm run db:migrate` (8 migreringar) · `npm run db:seed` (`pro_test`) | PASS |
| 3 | `npm run lint` | PASS |
| 4 | `npx tsc --noEmit` | PASS |
| 5 | `RATE_LIMIT_STORE=memory npm test` (unit) | PASS – 15 filer, **78/78** |
| 6 | `npm run build` | PASS |
| 7 | `RATE_LIMIT_STORE=postgres npm run test:integration` (färsk `pro_int_test`) | PASS – 21 filer, **89/89**; efteråt 0 rader i alla tabeller utom 6 hashade RateLimitBucket (Info) |
| 8 | Prod-E2E i isolerat nätverksnamespace (`unshare -rn …`, PG 55701): `RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e` | PASS – **42/42** (65 s), kapacitetsspec desktop + mobil; restdata 0 i alla tabeller inkl. CapacityDecision/Campaign/WorkspaceRequest |
| 9 | `npm audit --json` | 7 moderate (alla dev: typescript-eslint-kedjan + minimatch), 0 high/critical |
| 10 | `npm audit --omit=dev --json` | 0 sårbarheter |
| 11 | Beroenden vs 7c1407d | `package-lock.json` byte-identisk; `package.json` identisk utom nytt script `demo:seed:capacity` |
| 12 | Uppgradering (`upgrade.sh`, `pro_upg_demo`): 7c1407d-kod migrate (7) + db:seed + demo:seed (78 tillagda/1 överhoppad) + 4 manuella rader → 956155f migrate (8) + demo:seed + `demo:seed:capacity` ×3 | PASS – alla 8 tabellhashar oförändrade efter migrering; demo:seed 0 nya/78 befintliga; capacity-seed idempotent (identiska hashar efter varje körning: Booking 87, CapacityDecision 2, Campaign 3); 82/82 gamla Booking-rader byte-identiska; **0 överlapp**; exklusionsconstraint finns |
| 13 | HTTP-probe `probes/api.mjs` (`pro_demo`, app :3500, `RATE_LIMIT_STORE=postgres`) | PASS – **79/0** (försök 1 hade probe-buggar, se `logs/api-probe-attempt1.txt`) |
| 14 | `probes/probe2.mjs` (MCP + schema/personal) | 19 PASS / 2 FAIL – båda är probe-artefakter (se nedan); omkontroll `probes/mcp-list.mjs` PASS (utskrift till terminal, ingen loggfil) |
| 15 | UI-probe `probes/ui.mjs` (headless Chromium 320/390/1440) | PASS – **61/0** (`logs/ui-probe.txt`); försök 1 47/14 = probe-buggar (`logs/ui-probe-attempt1-probebugs.txt`); försök 2 avbröts av PRO-QA-1 (timeout, ingen loggfil) |
| – | 4-läges E2E-matris (dev/prod × proxy 0/1) | NOT RUN – bara prod0 full svit (42/42) kördes, enligt "ONE run" och tidsramen |

### 2.1 Funktionella verifieringar (HTTP/MCP)
- **Auth och origin före replay:** anonym GET/POST ger 403; saknad eller främmande Origin ger 403. Replay av samma Idempotency-Key utan Origin, anonymt eller som inaktiverad admin ger 403, alltså kontrolleras auth före replay.
- **Strikt schema:** `days` 8/0/abc, `limit` 21 och okänd query-param ger 400. Fönster utanför idag..idag+7 ger 409. Okända fält och `customerName`/`customerEmail` ger 400 (HTTP och MCP).
- **Flöde:**
  - Avbokning inom 7 Stockholmsdagar syns och matchar publik `getAvailability`.
  - `calendarHref` har rätt datum, `view=day` och personal.
  - Avbokning ≥ idag+7 listas inte.
- **Avfärda:**
  - Idempotent; annan admin med annan nyckel får samma beslut-id.
  - Beslutet består efter omladdning, och luckan förblir bokningsbar.
- **Utkast:**
  - Förhandsvisning skriver inget; utan nyckel ger 400.
  - Skapar en riktig `Campaign` med `published=false` och utan slot- eller personalkolumner, på tjänst+datumintervall (alla tider och all personal).
  - Ändrade villkor ger 409; avfärda efter utkast ger 409.
  - Utkastet syns inte publikt.
- **Inaktualitet (stale):**
  - Ny bokning på luckan (201) gör förslaget otillgängligt. Utkastet ligger kvar opublicerat och är ingen reservation; kalender-token ger 409.
  - Ändring av personal eller tjänst gör gammal token ogiltig (409).
  - Passerad tid gör förslaget otillgängligt.
  - En dag stängd via schemaundantag gör förslaget otillgängligt; när undantaget tas bort blir det tillgängligt igen.
- **Samtidighet (20 parallella):**
  - Samma payload med blandade nycklar och aktörer: alla 200, 1 kampanj, 1 beslut.
  - 10 utkast med olika rabatt + 10 avfärdanden: exakt 1 beslut, förlorarna får 409, ingen föräldralös kampanj.
  - Återanvänd nyckel med annan payload ger 409.
  - 10 bokningar + 10 utkast på samma friade lucka: exakt 1 bokning.
  - Hela DB:n: **0 överlapp**, exklusionsconstraint intakt.
- **Inga kunddata:** beslutsrespons innehåller bara `id`, `campaignId` och `status`. Listor via HTTP och MCP (limit 20) innehåller inga kundfält.
- **MCP:**
  - `--admin` utan `--allow-workspace` ger bara läsverktyg; skrivverktyget finns inte.
  - `--allow-workspace` utan `--admin` avvisas (`MCP_WORKSPACE_CONFIG_INVALID`).
  - Standardserver har inga kapacitetsverktyg.
  - Med `--allow-workspace` fungerar utkast, och okänt fält, `customerEmail` och ändrade villkor avvisas.
  - HTTP ser samma enda kampanj, eftersom domänlogiken är delad.
- **probe2-FAIL (artefakter):**
  - (1) Inaktiv personal kunde inte sättas via API, eftersom domänvakten ger 409 "Ändringen berör bokade tider…" när personen har framtida bokningar. `staff.active`-villkoret är granskat i kod (`src/lib/capacity.ts:104`) men inte exekverat.
  - (2) MCP-listan föll på standardgränsen 10. Omkontroll med limit=20: PASS.

### 2.2 Webbläsare (egen headless Chromium, prod-build)
Skärmbilder ligger i `run/shots/`: `overview-{320,390,1440}.png`, `draft-preview-{320,390}.png`, `stale-draft-{320,390,1440}.png`, `calendar-from-overview-390.png`, `campaigns-390.png`.
- Ingen horisontell overflow vid 320, 390 eller 1440 i listan, det öppna formuläret eller stale-läget.
- Nav-markering "Översikt" och aria-current fungerar. Ingen kunddata visas.
- "Öppna kalendern" ger rätt datum, dagvy och personal (Sam Demo).
- Avfärda-knappen är 48 px hög och Spara ≥ 40 px, inom viewport.
- Scope-texten säger "alla bokningsbara tider och all personal", att utkastet inte är exklusivt och att inget reserveras.
- Förhandsvisning skriver inget. UI-utkast ger 1 opublicerad kampanj på 15 %.
- Status ("Avfärdat", "Utkast sparat") består efter omladdning.
- Efter extern bokning visas "Inaktuellt underlag" och "Utkastet finns kvar…".
- Kampanjlänken öppnar `/admin/campaigns#campaign-<id>` med utkastet synligt (320/390/1440).
- Tangentbord vid 390: Tab når "Förbered kampanjutkast" med synlig fokus, och Enter öppnar.
- Inga konsolfel.

## 3. Bilder/kod (granskat, ej exekverat)
- `capacity.ts`:
  - strikta zod-scheman (19–35);
  - token = sha256(källa, version, start/slut, service-/staffVersion, avbokningshändelse) (123–131);
  - lås: konfiguration, workspace-nyckel, personal/dag och källa (279–280);
  - unik (businessId, bookingId, sourceVersion).
- Migrering: CHECK-constraints, sammansatta FK med ON DELETE RESTRICT, nya unika index `Booking(businessId,id)` och `Campaign(businessId,id)`.
- `server.ts` är oförändrad. Skrivverktyg i `mcp/workspace.ts` är spärrade bakom `allowWrites`.
- Codex-skärmbilder (`review-evidence/screenshots/02,03,04`): innehåll och layout stämmer med mina egna bilder (t.ex. `03-stale-draft-mobile.jpg` vs `shots/stale-draft-390.png`: samma eyebrow, texter och nedtonad kalenderknapp). De räknas som bevis från Codex, inte som eget bevis.

## 4. Codex-påståenden
| Påstående | Bedömning |
|---|---|
| Ren `npm ci` 571 paket | **Delvis motsagt:** jag fick 572 (Linux) med identisk lock; Codex logg (`--offline`, Windows) visar 571. Skillnaden beror troligen på plattformsspecifika optionella paket. Info. |
| 78 unit / 89 integration | **Bekräftat** (78/78, 89/89) |
| lint/tsc/build PASS | **Bekräftat** |
| Migrering 7→8 + omseed, 0 överlapp | **Bekräftat** (oförändrade hashar, idempotent seed, 0 överlapp) |
| prod0 desktop kapacitets-E2E 1/1 | **Bekräftat och utökat:** hela prod0-sviten 42/42 inkl. kapacitet desktop+mobil |
| 4-lägesmatris pågår, inte påstådd passerad | **Bekräftat** att den inte påstås passerad; själv NOT RUN |
| Audit 7 moderate dev / 0 prod | **Bekräftat** (identiska listor) |
| Ingen beroende- eller lockändring | **Bekräftat** (bara nytt npm-script) |
| 3 riktiga lokala prod-bilder | **Ej verifierbart** som ursprung; innehållet stämmer med min egen prod-build |
| 167 filer matchar testkopian | **Ej verifierbart** (testkopian är inte tillgänglig); JSON säger 167/0 mismatches |
| 507d271 och 956 har samma app-kod | **Ej verifierbart** (507d271 är inte tillgänglig; ingen GitHub-åtkomst) |

## 5. Fynd
### PRO-QA-1 – Medium (UX/funktion): gränsen 10 räknar inaktuella och beslutade källor, så handlingsbara förslag döljs
- **Fil:**
  - `src/lib/capacity.ts:191-204`: `take: limit+1` på alla avbokningar sorterade efter tid, före projektion.
  - `src/app/admin/overview/overview.tsx:68-72`: texten "Visar de första 10… Fler finns i kalendern".
- **Repro:**
  1. Skapa ≥ 10 avbokningar tidigt i fönstret som är avfärdade, har utkast eller blivit inaktuella (redan bokade eller passerade).
  2. Avboka en ny lucka senare i fönstret.
  3. Öppna `/admin/overview`.

  Observerat: UI visar 10 kort, varav 9 inaktuella eller beslutade, och 2 handlingsbara förslag låg bortom gränsen. Mitt UI-försök 2 avbröts av detta (14:30-kortet syntes inte). Det finns ingen paginering eller `from`-kontroll i UI, och kalendern visar inte "förslag".
- **Konsekvens:** översikten slutar fylla sin funktion efter några dagars användning, utan att något fel syns.
- **Fixriktning:** prioritera handlingsbara (`available && status==="new"`) före övriga, eller filtrera bort beslutade/passerade som standard med en "visa hanterade"-växel. Alternativt lägg till paginering (`from`/cursor). Lägg till ett test med > 10 källor där den 11:e är handlingsbar.

### Info (backlog, inte blockerande)
- PRO-QA-2 Info: integrationssviten med postgres-store lämnar 6 hashade RateLimitBucket-rader, som går ut efter ca 15 min.
- PRO-QA-3 Info: MCP `create_campaign_draft` (sedan tidigare) finns under `--admin` utan `--allow-workspace` (`server.ts` oförändrad). Det är inkonsekvent med att kapacitetsskrivningar kräver `--allow-workspace`.
- PRO-QA-4 Info: "Översikt" och "Kalender" använder samma ikon `CalendarDays` (`src/app/admin/header.tsx:28-29`).
- PRO-QA-5 Info: inaktuella förslag kan inte avfärdas, och passerade källor ligger kvar resten av dagen. Det saknas en städväg (förstärker PRO-QA-1).
- PRO-QA-6 Info: kampanjutkast kan spänna upp till 90 dagar och 100 % rabatt (`domain.ts:30-45`). Det är explicit och visas i UI, men har bred effekt.
- PRO-QA-7 Info: 7c1407d-demoseeden hoppar över 1 fredagslucka (fullDay = partialDay = 2026-11-16). Detta fanns sedan tidigare.
- PRO-QA-8 Info: `npm ci` ger 572 paket på Linux mot 571 enligt Codex (plattform).

### Blockerare
Inga.

## 6. Saknade tester
- > 10 källor där handlingsbara ligger bortom gränsen (PRO-QA-1).
- Inaktiv personal ger otillgängligt förslag (bara kodgranskat).
- HTTP- och MCP-replay av inaktiverad admin samt Origin-kontroll före replay för kapacitets-endpoints som explicit regressionstest.
- 20-parallellt test med blandade nycklar och aktörer samt motstridiga utfall (verifierat av mig, men inte i sviten).
- Schemaundantag (stängd dag) och omöppning.
- Mobil stale-vy samt status efter omladdning vid 320 px.
- 4-läges E2E-matrisen.

## 7. NOT RUN
- 4-läges E2E (dev och proxy=1): en körning och tidsram; prod0 full svit körd.
- Fysisk iPhone/Safari: ingen enhet.
- Preview/cloud: förbjudet.
- Inaktiv personal via API: blockerades av domänvakten för framtida bokningar.
- Jämförelse av 507d271 och testkopian: inte tillgängliga.

## 8. Harness- och probefiler (utanför src)
`run/matrix.sh`, `run/e2e-ns.sh`, `run/upgrade.sh`, `run/probes/{api,probe2,mcp-list,chk-inactive,ui}.mjs`. Loggar ligger i `run/logs/` och skärmbilder i `run/shots/`.

## 9. Städning
Appservrarna (3500/3501) är stoppade. PG 55700 är stoppad och 55701 körs inte. `work/.env`, `upg7/.env`, `.qa-admin-pw` och `/tmp/prons` är raderade. Inga processer eller lyssnande portar finns kvar. pgdata-kataloger ligger kvar som lokala QA-artefakter.

## 10. Beslut
- **Syntetisk POC (lokal, @example.test): GO**, med PRO-QA-1 som rekommenderad fix före bredare demo.
- **Pilot med riktiga kunder/data: NO-GO**: kräver fix av PRO-QA-1, den fulla 4-lägesmatrisen samt test på fysisk mobil/Safari, och de pilotvillkor som redan gäller sedan tidigare rapporter.
