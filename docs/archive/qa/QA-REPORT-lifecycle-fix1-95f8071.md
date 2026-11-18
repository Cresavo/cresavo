# QA-rapport – Booking Lab kundlivscykel, fixvarv 1 av 2 (95f8071)

**Datum:** 2026-11-13 (Europe/Stockholm) · **Typ:** riktad samlad återkontroll, bara LC-QA-1 och relevanta regressioner · **Testare:** Grok Bot (QA)
**Scope:** `QA-BRIEF-lifecycle-fix1-95f8071.md` (sha256 `cf1698270a5fc306e0ff11fe81542e954dfca763c7d2a689cdd74724cfc66457`), läst i sin helhet.

## 1. Scope och hashar
| Fält | Värde |
|---|---|
| Revision | `95f807196f9b15e0bae2afdcd89604837cf747dd` (samma gren, ovanpå e2e0e39) |
| Arkiv | `lifecycle-fix1-95f8071/booking-lifecycle-fix1.zip`, sha256 `bba16d9cfb68a8b94b6cc098a4d72e87c27f04d1f046d95c71c335856d83c445`, 2 624 100 byte, 425 poster, kommentar `95f8071…`. Allt verifierat och identiskt med bifogad fil |
| Env-filer i arkivet | Endast `.env.example`. `docs/calendar-proof/private.json` finns sedan tidigare (syntetisk fixture) och lästes inte |
| Evidens | `evidence.zip`, sha256 `d23c254b9b8c7bc851b8e20fa01276e80dd59a10fc9adecaf4b0532b833c732b`, 310 145 byte, 33 poster. **Codex-underlag som jag har granskat. Det är inte min egen körning.** |
| Jämförelsebas | Min extraktion av e2e0e39 (`lifecycle-e2e0e39/run/src`) |

**Så kördes kontrollen:**
- `run/src` är en orörd extraktion. Efter körningen jämfördes den med en ny extraktion av zip-filen, utan skillnader.
- Allt kördes i `run/work`, en LF-normaliserad kopia. Ingen produktkod ändrades.
- Databaser: egna `lf_test`, `lf_int_test`, `lf_e2e_prod_test`, `lf_demo` och `lf_upg_demo`. Bara `@example.test`-data användes.
- Portar: PG 55730 på host och 55731 i isolerat nätverksnamespace, app 3530. Port 3000 användes bara inuti namespace.
- Alla kommandon kördes med `env -u NODE_ENV` och TZ=Europe/Stockholm.
- SESSION_SECRET slumpades och skrevs bara i en temporär `.env`, som nu är raderad. Inga hemligheter lästes.
- Ingen GitHub, cloud, preview eller PC. Inget push eller deploy.
- Embedded Postgres 18 och Playwright Chromium-1254 kontrollerades före start; båda fanns.

## 2. Diff 95f8071 mot e2e0e39 (`run/logs/changed-files.txt`, `run/logs/code.diff`)
- **Produktkod:** bara två filer ändrades.
  - `src/lib/domain.ts`: ny `hashedEmailCapKey`, `storedEmailKey`, kvotfrågan räknar båda formaten, och `emailCapKey: storedEmailKey`.
  - `src/lib/customer-data.ts`: omkodning av äldre nycklar i `removeCustomerContact`.
- **Tester:** `tests/integration/customer-data.test.ts` (+1 fall) och `tests/e2e/customer-data.spec.ts` (nytt fall för HTTP-admin + lokal MCP, samt kontroll av äldre rå nyckel).
- **Docs:** `AGENTS.md`, `ARCHITECTURE.md`, `CUSTOMER_LIFECYCLE_AGENT_PLAN.md`, `DATA_FLOWS.md`, `PRIVACY_SECURITY.md`. Dessutom tillkom `docs/qa/` med min förra rapport och fix-request.
- **Ingen ändring av:** migration, `schema.prisma`, `package.json` eller `package-lock.json` (byte-identiska).
- **MCP/kapacitet är oförändrat:** `src/mcp/{server,workspace,booking,reply}.ts`, `src/lib/capacity.ts` och `src/lib/workspace-write.ts` är identiska.
- **Slutsats:** ändringen är avgränsad till LC-QA-1 plus tester och docs. ✔

## 3. Kodgranskning av rättningen
- **HMAC** (`domain.ts:209-217`):
  - Formatet är `email-hmac-v1:` + HMAC-SHA256(SESSION_SECRET, `"demo:email:<normaliserad adress>"`).
  - Prefixet och verksamhets-id:t är konstant namnrymd. En nyckel som redan är HMAC lämnas som den är (idempotent). En rå nyckel innehåller alltid `@` och kan därför aldrig matcha regexen.
- **Saknad eller kort secret (<32 tecken):** `EMAIL_CAP_CONFIG_INVALID` kastas och allt stängs.
  - Vid bokning kastas redan tidigare `CLIENT_KEY_CONFIG_INVALID` för publika kanaler och MCP-kanaler.
  - Vid kontaktborttagning rullas hela transaktionen tillbaka. **Verifierat:** kortet är orört och ingen `CustomerDataAction` skrivs.
  - Fel via HTTP blir generiskt 500.
- **Kvot** (`domain.ts:304, 327-333, 379`):
  - Dagslåset nyckas fortfarande på normaliserad adress och dag. Låsnyckeln lagras inte; bara `hashtext` finns i `pg_locks`.
  - Räkningen sker med `emailCapKey IN (rå, HMAC)` och `createdAt` inom dagen, med tak 3. +tagg och gemener normaliseras som förut.
- **Adminvägen:** `storedEmailKey = null`, och ingen HMAC beräknas. Det är oförändrat; adminbokningar förbrukar ingen e-postbudget.
- **Omkodning vid borttagning** (`customer-data.ts:225-242`):
  - Sker inom `workspaceWrite` (exklusivt konfigurationslås, auth före replay) och samma transaktion som skrubbningen.
  - Bara kundens kopplade rader med distinkta nycklar berörs. Nyckeln töms aldrig, och varken `createdAt`, `version` eller events ändras.
  - Bokningsskrivningar tar ett delat konfigurationslås, så det finns inget kapplöpningsfönster.
- **Nyckelseparation:**
  - SESSION_SECRET används nu för tre syften: sessionssignatur (`"<version>:<payload>"`), clientKey (rå IP- eller admin-adress) och e-postkvot (`"demo:email:…"`).
  - Indata har olika prefix, och e-post-HMAC exponeras aldrig utåt. Jag ser ingen praktisk korsprotokollsrisk.
  - En separat härledd nyckel (HKDF) eller egen secret vore renare, men det är Info och inget krav för POC.
- **Rotation:**
  - Byte av SESSION_SECRET gör att dagens HMAC-rader inte längre matchar. Samma adress kan då boka 3 nya gånger samma dag. **Verifierat**, se 4.3.
  - Gamla råa nycklar som omkodas efter rotation får den nya nyckeln och räknas därmed fortsatt korrekt.
  - Det här är en liten beteendeändring: tidigare påverkade rotation bara clientKey-taket. Det dokumenteras generellt i ARCHITECTURE.md:52 (LC-F1-QA-3, Info).
- **Begränsningen "ingen global backfill":** äldre okopplade eller ohanterade bokningar kan behålla rå kvotadress. Det är tydligt dokumenterat (DATA_FLOWS, PRIVACY_SECURITY, PLAN) och rimligt för POC. I mina DB:er fanns 0 sådana rader efter körningen; i `lf_upg_demo` fanns 1 före borttagningen.
- **Kvarvarande kopior efter borttagning, rad för rad:**
  - **Booking (kopplad):** namn och e-post är markörer, och `emailCapKey` är HMAC.
  - **Booking (kopplad):** `requestHash` är osaltad sha256 över indata. Om anroparen skickat `customerName`/`customerEmail` tillsammans med `customerId` (schemat tillåter det, `domain.ts:58-69`) kan hashen bekräfta en gissad adress och ett gissat namn utifrån radens övriga kolumner. **Verifierat**, se LC-F1-QA-1.
  - **Booking (kopplad):** `clientKey` och `idempotencyKey` innehåller ingen kontakt.
  - **BookingEvent:** saknar kontaktfält; raderna var identiska före och efter.
  - **CustomerDataAction:** saknar kontaktkolumner.
  - **WorkspaceRequest:** `result` saknar kontakt. `requestHash` för `create_customer` är osaltad hash över indata, sedan tidigare LC-QA-4.
  - **RateLimitBucket:** nycklas på klient/admin, inte e-post.

## 4. Egna körningar (VERIFIERAT)
### 4.1 Kommandon (`run/logs/summary.log`, `commands.log`)
| # | Kommando | Resultat |
|---|---|---|
| 1 | `npm ci` | PASS |
| 2 | `npx prisma generate` | PASS (7.10.1) |
| 3 | `npm run db:migrate` (9) + `db:seed` (`lf_test`) | PASS |
| 4 | `npm run lint` | PASS |
| 5 | `npx tsc --noEmit` | PASS |
| 6 | `RATE_LIMIT_STORE=memory npm test` | PASS – 16 filer, **79/79** |
| 7 | `npm run build` | PASS |
| 8 | `RATE_LIMIT_STORE=postgres npm run test:integration` (färsk `lf_int_test`) | PASS – 23 filer, **99/99**. Restdata: 0 affärs- och adminrader, 8 hashade RateLimitBucket (känd Info, LC-QA-6) |
| 9 | Prod0-E2E i isolerat namespace (`RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0`, färsk `lf_e2e_prod_test`) | PASS – **46/46** (1,1 min), inklusive båda customer-data-fallen × desktop/mobil. Restdata 0 i alla tabeller |
| 10 | `npm audit` full / `--omit=dev` | 7 moderate (dev) / 0 – oförändrat |
| 11 | `probes/api-lf.mjs` (HTTP + MCP stdio + DB, `lf_demo`, app :3530) | **23/0**, se 4.2 |
| 12 | Korta/saknade secret samt rotation (`probes/remove-direct.mjs`, `rotate.mjs`) | Beter sig som förväntat, se 4.3 |
| 13 | `probes/rh-lf.mjs` + `rh2.mjs` (bekräftbarhet för requestHash) | Fynd LC-F1-QA-1 (Low) |
| 14 | `upgrade.sh` 8→9 med verklig äldre rå kvotnyckel + omseed (`lf_upg_demo`) | PASS, se 4.4. Försök 1 hade en harnessbugg i mitt skript (`logs/upgrade-attempt1-harness-bug.log`); DB:n återskapades och körningen gjordes om rent |
| 15 | `probes/mcp-lc.mjs` (kataloger mot 95f8071) | **27/0**: katalogerna 2/4/6/13/14/20 är oförändrade, och inga kund-, export- eller kontaktverktyg finns |
| – | E2E i prod1/dev0/dev1 | NOT RUN |

### 4.2 Faktiskt flöde (`run/logs/api-lf.txt`)
**Kund och bokningar:** kunden "Karin Kvot", `lf-k@example.test`, +46 70 333 33 33.
- 2 bokningar via **lokal MCP stdio `create_booking` med `customerId`** (`--admin --allow-workspace`). En retry med samma `clientRequestId` gav samma id.
- 1 **HTTP-adminbokning** med `customerId`.
- 1 **publik** bokning med samma adress (okopplad).

**Lagrade nycklar:**
- MCP×2 och den publika bokningen fick samma `email-hmac-v1:<64 hex>`, utan någon del av adressen. Adminraden har `NULL`. ✔

**Simulerad äldre rad:** m1.`emailCapKey` sattes till rå adress.
- Fjärde bokningen samma dag gav **429** för vanlig adress, `+extra`-variant och versaler. Därmed räknas rå nyckel och HMAC tillsammans.
- En annan adress från samma IP gav 201 strax efter. 429-svaren kom alltså från e-posttaket, inte från IP-taket. ✔

**Avbokning och borttagning via HTTP:**
- MCP×2 och adminbokningen avbokades via HTTP-admin. Därefter gav preview och `remove_contact` 200.
- Den äldre råa nyckeln **omkodades till exakt samma HMAC** och tömdes inte. HMAC-raderna är orörda, och adminraden är fortfarande NULL. ✔
- Bara `customerName`, `customerEmail` och `contactRemovedAt` ändrades (plus `emailCapKey` på den äldre raden). `version`, `createdAt`, status, tider, `clientKey`, `idempotencyKey` och `requestHash` är identiska. BookingEvent-raderna är identiska. ✔

**Grep i hela DB:n** (13 tabeller, alla kolumner inklusive JSON, via `row_to_json`) efter namn, e-post, `lf-k`, "Karin" och telefon:
- Träffar bara i den **okopplade publika** bokningen (`customerName`/`customerEmail`). Den ligger dokumenterat utanför scope.
- 0 träffar i kopplade bokningar, Customer, BookingEvent, CustomerDataAction, WorkspaceRequest och RateLimitBucket. ✔

**Efter borttagningen:**
- Fjärde bokningen gav fortfarande **429** för både vanlig adress och +tagg. Budgeten återbetalas inte. ✔
- **Replay:** MCP-retry med m1:s `clientRequestId` gav samma id utan ny rad. Publik replay med originalnyckeln gav samma id. Versionerna är oförändrade. ✔

**Parallella anrop:**
- 20 parallella publika anrop med samma nyckel gav 20×201 med samma id, 1 rad och HMAC-nyckel. ✔
- 20 parallella `remove_contact` med samma nyckel, på en kund med äldre rå rad, gav 20×200 med identiskt svar, 1 `remove_contact`-åtgärd, HMAC-nyckel och markörer. ✔

**DB-invarianter:** 0 överlapp och 9 migreringar. ✔

### 4.3 Secret-beteende (direkt domänanrop, egen DB)
- **Kort secret (`short`) och saknad secret vid borttagning:** `EMAIL_CAP_CONFIG_INVALID`. Kortet, bokningen och den råa nyckeln är orörda, och det finns 0 `CustomerDataAction`.
- **Korrekt secret:** borttagningen lyckas. Den 40 dagar gamla äldre radens nyckel blir HMAC, medan `version` och `createdAt` är orörda. DB-grep efter "Lars Legat", `lf-l@` och telefon gav 0 träffar.
- **Rotation:** med samma secret gav fjärde bokningen (`lf-k+rot@`) 429. Med en ny slumpad secret gav samma anrop **201**, alltså taket nollställs efter rotation (LC-F1-QA-3).

### 4.4 Uppgradering 8→9 med verklig äldre rå nyckel (`run/logs/upgrade.log`)
1. 8843d06-koden körde migrate (8), db:seed, demo:seed (78 rader, 32 kunder) och demo:seed:capacity.
2. Därefter skapade **8843d06:s riktiga MCP `create_booking` med `customerId`** en bokning. Det gav 1 rå `emailCapKey` (`demo-customer-0`).
3. 95f8071 körde migrate (9) och omseed (0 tillagda / 78 befintliga). Alla 11 tabeller var byte-identiska på gamla kolumner efter både migrering och omseed. De nya kolumnerna är NULL, det finns 0 överlapp och CHECK/FK/exclusion finns.
4. Den råa nyckeln var kvar efter uppgraderingen. Det är väntat, eftersom ingen backfill görs.
5. Kontaktborttagning med 95f8071 gav `email-hmac-v1:…`, markörer och 0 råa nycklar för kunden. `version`, `createdAt`, `requestHash` och `idempotencyKey` är oförändrade. ✔

### 4.5 MCP-pinning e2e0e39 ↔ webb 95f8071
- Alla MCP- och kapacitetsfiler är byte-identiska. Kapacitetsverktygen (`capacity.ts`, `mcp/workspace.ts`) importerar bara `listServices`, `bookingListSchema`, `campaignSchema`, `createCampaign` och `getAvailability` från `domain.ts`. Ingen av dem påverkas av rättningen.
- I profilen `--admin --capacity-only --allow-workspace` (6 verktyg) finns ingen `create_booking`. Pinningen är därför **ofarlig för kapacitetsprovet**.
- Reservation: en e2e0e39-server som startas i läge med `create_booking` skriver fortfarande rå `emailCapKey`. Kvoten räknar ändå rätt, och borttagningen omkodar raden. Det är Info.

## 5. Granskning av Codex-evidens (UNDERLAG, inte min egen körning)
Jag har **inte** haft åtkomst till Codex, ägarens PC eller deras demo-DB och har inte själv provat deras MCP-klient. Bedömningen gäller bara den interna konsistensen i `evidence.zip`.

**Ägarprov:** `OWNER_AGENT_2026-11-13.md`, `owner-tool-transcript.json`, `owner-proof-db.json` och bilderna `owner-agent-draft.jpg` och `owner-agent-stale.jpg`.
- **Utkast och retry:** utkastet `cmweounzm0001d0uakvnszxsf` (kampanj `cmweounz60000d0uamzujbnk8`) har **samma id vid identisk retry**. Samma nyckel med 25 % nekades, `confirmed=false` gav valideringsfel och ett nytt utkast på ett redan otillgängligt förslag (10:00 lokal tid) nekades som inaktuellt. ✔
- **20 % opublicerat:** transkript, DB-JSON (`published:false`, 20 %, 2026-11-16) och bild (Kampanjer: "Lokalt agentprov – massage 16 november", 20 %, "Publicera" ej tryckt) stämmer överens. ✔
- **Inaktuellt efter ombokning:** listan efteråt visar 09:00 (08:00Z) med `available:false` och status draft med kvarvarande 20 %-utkast. Inspect nekas. Översiktsbilden visar "INAKTUELLT UNDERLAG · UTKAST SPARAT", 09:00 och "Beslut sparat 09:01" (= `decidedAt` 08:01:52Z). ✔
- **Bilder och hashar:** bildernas tidsordning (utkast 08:04Z, inaktuellt 08:06Z, lista 08:06:07Z) är konsekvent, och manifestets sha256 stämmer för alla 5 bilder.
- **DB:** 1 beslut, 1 accepterad ledgerpost, 0 ledgerposter för nekade anrop, 1 bekräftad ombokning och 0 överlapp. ✔
- **Mindre anmärkningar:**
  - Transkriptet är bearbetat, inte rå: första inspect saknar `content`-omslaget, och retry-posterna saknar argument.
  - De 3 lokala mobilbilderna har `webRevision` e2e0e39, inte 95f8071. Det är rimligt eftersom panelen är oförändrad.

**Kommandoutdata:**
- unit 79, integration 99 och E2E 46 i vart och ett av prod0/prod1/dev0/dev1 stämmer med filerna.
- `upgrade-proof.json` visar 8→9, omseed identisk och 0 överlapp, men **anger inte uttryckligen** någon äldre rå `emailCapKey`. Påståendet "nu med verklig äldre rå emailCapKey" är alltså inte belagt i JSON-filen. Det täcks i stället av min egen körning (4.4).

| Codex-påstående | Bedömning |
|---|---|
| lint/tsc/build PASS | **Bekräftat** (egen körning) |
| 79 unit / 99 integration | **Bekräftat** |
| 46 E2E × 4 lägen | prod0 **bekräftat**; prod1/dev0/dev1 **NOT RUN** (bara underlag) |
| 8→9 + omseed med äldre rå nyckel | **Bekräftat av egen körning**; i Codex-JSON inte explicit |
| 10 RateLimitBucket kvar efter integration | Egen körning gav 8 (tidsberoende, känd Info) |
| Audit 7/0, oförändrad lock | **Bekräftat** |
| Inga migration-/schema-/dep-ändringar; MCP-kapacitet oförändrad | **Bekräftat** genom diff |
| Ägarprov via faktisk Codex-klient | **Underlag granskat och internt konsistent**. Inte verifierbart av mig. Jag har inte kört AI-klientprovet |
| 196 filer matchar testkopian | Ej verifierbart |

## 6. Fynd
### LC-QA-1 – **STÄNGD**
Nya icke-adminbokningar lagrar HMAC. Äldre råa nycklar på kopplade bokningar omkodas atomärt vid kontaktborttagning. Kvoten räknar båda formaten före och efter, med +tagg/versaler, 3 per dag, dagslås och oförändrad `createdAt`. Verifierat genom egen körning (MCP stdio, HTTP-admin, publik väg, uppgradering) och kodgranskning. Ingen budget återbetalas.

### LC-F1-QA-1 – Low (integritet, rest av LC-QA-4): `requestHash` på kopplad bokning kan bekräfta en gissad kontakt efter borttagning
- **Kod:** `src/lib/domain.ts:58-69` (`adminBookingSchema` tillåter `customerName`/`customerEmail` tillsammans med `customerId`) och `domain.ts:259-261` (osaltad `sha256(JSON(v))`).
- **Repro (`probes/rh-lf.mjs`, `rh2.mjs`):**
  1. Kör MCP `create_booking` med `customerId` och `customerName:"Kim Tre"`, `customerEmail:"lf-k3@example.test"`.
  2. Avboka och ta bort kontakten.
  3. Räkna om hashen från radens `serviceId`, `staffId`, `initialStartsAt`, `customerId` och `idempotencyKey` plus gissat namn och gissad adress. Hashen matchar `requestHash` för rätt gissning.
- **Konsekvens:** ingen klartextkopia finns kvar, men en aktör med DB-läsning och en exakt namn+adress-gissning kan bekräfta kontakten. Gäller bara när anroparen skickar kontakt tillsammans med `customerId`; standardflöden i UI och MCP skickar bara id. Dokumenterat som pseudonymisering, inte anonymisering.
- **Fix (valfri, inte krav för POC):** sätt `requestHash` till HMAC (secret), eller räkna om den utan kontaktfält när `customerId` finns. Alternativt avvisa kontaktfält när `customerId` anges.

### LC-F1-QA-2 – Info (docs): `docs/ARCHITECTURE.md:270` säger fortfarande "emailCapKey är gemener utan +tagg"
Det motsäger rad 46-53 och den nya koden. Rätta texten till "HMAC av gemener utan +tagg".

### LC-F1-QA-3 – Info: rotation av SESSION_SECRET nollställer nu även dagens e-posttak
Verifierat: efter 3 bokningar ger en ny secret 201 i stället för 429. SESSION_SECRET används för tre syften. Dokumenterat generellt (ARCHITECTURE.md:52). Rekommendation: härled en separat nyckel med HKDF, och nämn rotationseffekten på e-posttaket uttryckligen. Saknad secret ger generiskt 500 vid borttagning (tillståndet förblir oförändrat).

### LC-F1-QA-4 – Info: pinnad e2e0e39-MCP i bokningsläge skriver rå `emailCapKey`
Det påverkar inte kapacitetsprofilen. Kvoten och borttagningen hanterar raden. Använd 95f8071 för MCP om `create_booking` exponeras.

### Info-backlogg (oförändrad, inte omtestad)
LC-QA-2 (ostylade alerts), LC-QA-3 (exklusivt lås för läsning), LC-QA-4 (osaltad requestHash, nu konkretiserad i LC-F1-QA-1), LC-QA-5 (export utan idempotens), LC-QA-6 (RateLimitBucket-rester efter integration; 8 nu), LC-QA-7 (572/571 paket). Äldre PRO-fynd ligger kvar i backloggen.

### Blockerare
Inga. Inget fynd är Medium eller högre, så **ingen FIX-REQUEST skrivs** (fixvarv 2 behövs inte för LC-QA-1).

## 7. NOT RUN
- E2E i prod1, dev0 och dev1 (bara underlag från Codex).
- Faktiskt AI-klient- eller Codex-ägarprov: ingen åtkomst. Jag har bara granskat underlaget.
- Fysisk iPhone/Safari.
- Preview, cloud, GitHub och deploy: förbjudet.
- Ny UI-prob i Chromium: UI-filerna är oförändrade mot e2e0e39. Prod0-E2E täcker customer-data-fallen på desktop och mobil.
- Ny QA av äldre epics: utanför scope.

## 8. Harness, loggar och städning
- **Skript:** `run/matrix.sh`, `run/e2e-ns.sh`, `run/upgrade.sh`.
- **Prober:** `run/probes/{api-lf,mcp-book,mcp-book-contact,dbgrep,remove-direct,rotate,rh-lf,rh2,mcp-lc}.mjs`.
- **Loggar:** `run/logs/` (summary, api-lf.txt, mcp-lf.txt, upgrade.log, audit-*.json, e2e-full-prod.log).
- **Stoppat:** appservern på :3530 och PG 55730. 55731 stoppades av E2E-skriptet. Inga processer eller lyssnande portar finns kvar.
- **Raderat:** `work/.env`, `upg8/.env`, `.qa-admin-pw`, `/tmp/lfns`, `upg8/node_modules`, `work/node_modules` och `work/.next`.
- **Kvar:** pgdata ligger kvar som lokal QA-artefakt. Disk 81 %.

## 9. Beslut
- **LC-QA-1: STÄNGD.**
- **Syntetisk POC (lokal, @example.test): GO.** Gäller kundexport, kontaktborttagning med HMAC-kvot, uppgradering och kapacitets-MCP. Codex ägaragentprov är granskat som underlag och är internt konsistent.
- **Pilot med riktiga kunder/data: NO-GO.** Kvar återstår:
  - riktig lagringstid och rättighetsprövning;
  - backup- och leverantörskedjan;
  - global hantering av äldre råa kvotnycklar och okopplade bokningar;
  - LC-F1-QA-1 och LC-QA-4 (pseudonymiserade hashar);
  - separat nyckel och rotationsrutin;
  - fysisk mobil;
  - egen verifiering av de tre övriga E2E-lägena och AI-klientprovet.
