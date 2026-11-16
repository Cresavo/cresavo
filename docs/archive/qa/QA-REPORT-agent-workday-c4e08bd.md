# QA-rapport: agentbokning med försökslogg, ICS och ägarens arbetsdagskort (c4e08bd)

- **Fryst SHA:** `c4e08bde8139fd3fa9e0179e0cb44cd0e370fb93` (feature/agent-booking-workday, från e702838)
- **Underlag:** `agent-workday-c4e08bd.zip` (sha256 `cc61c901…12d4`, 588 poster), `evidence.zip` (sha256 `c0cbe3b6…a6a6`) och `QA-BRIEF-agent-workday-c4e08bd.md` (sha256 `2dc33bde…5d9534`).
- **Körning:** en QA-körning i egen syntetisk kopia under `/workspace/qa/booking-lab-se/agent-workday-c4e08bd/run/`, 2026-11-13 kl. 16:15–16:45 (Europe/Stockholm).
- **Miljö:**
  - färsk embedded Postgres 18: värd 55820, e2e-netns 55821, UI-netns 55822;
  - appen i UI-netns på 127.0.0.1:55832;
  - `TZ=Europe/Stockholm`, `env -u NODE_ENV`;
  - Playwright och webbruntimes körda strikt sekventiellt i isolerad netns (endast lo);
  - endast `@example.test`.
- **Avgränsning:** lokal syntetisk proof i egen testvärd. Ingen PC, inget original, ingen preview, GitHub, moln eller tokens. Inga kodändringar. Ingen native ChatGPT-, PC- eller iPhone-testning. Ingen `.env`, inga hemligheter och inga `neon-*/resources.private.json` lästa.

## 1. Sammanfattning och verdikt

**Scoped GO** för den lokala syntetiska proofen (kundkort med beständig försökslogg + ICS, separat läsande ägarkort), med de här förbehållen:
- **Inga fynd Medium eller högre** → ingen FIX-REQUEST. Fyra Low och sex Info går till backlog.
- **Ingen GO för** native ChatGPT/iPhone, pilot eller drift.

Det som fungerar:
- **Försöksloggen:**
  - sparas före domänskrivningen;
  - överlever kill -9 och processomstart;
  - vid återöppning sker bara en statusläsning, utan automatisk mutation;
  - en explicit retry med samma UUID ger exakt en bokning.
- **ICS-filen:**
  - korrekt UTC, längd utan buffert och sommartid i båda riktningarna;
  - stabilt UID, SEQUENCE ökar vid ändring;
  - RFC 5545-escaping och 75-oktettsvikning, verifierat med python icalendar 7.3.0.
- **Ägarkortet:**
  - exakt ett läsverktyg;
  - noll DB-skrivningar;
  - inga kunduppgifter;
  - fungerar med en begränsad SQL-roll utan Customer och utan `Booking.customerEmail`.

## 2. Egna kommandon och resultat

| Steg | Resultat |
|---|---|
| `npm ci` | PASS (rc 0) |
| `prisma generate` | PASS |
| migrate (10 migrationer, verifierat `_prisma_migrations` = 10) + seed | PASS |
| lint | PASS (rc 0) |
| `tsc --noEmit` | PASS (rc 0) |
| `npm test` (unit) | **PASS 89/89** (18 filer) |
| build (production) | PASS |
| `test:integration` (RATE_LIMIT_STORE=postgres) | **PASS 120/120** (26 filer); DB efteråt utan kvarvarande kunder, bokningar eller försök |
| `playwright.agent-workday.config.ts` (production-wrapper på 3197, netns) | **PASS 13/13** |
| Webb-E2E prod0 / prod1 / dev0 / dev1 (egna DB:er, sekventiellt, netns) | **PASS 46/46 i alla fyra lägen = 184/184** |
| `npm audit --json` | exit 1: 7 moderate, alla i dev-kedjan (minimatch via typescript-eslint), 0 high/critical |
| `npm audit --omit=dev --json` | exit 0: 0 sårbarheter |
| Upgrade 9→10 med data från 8126410-eran (`probes/upgrade-aw.mjs`) | **PASS 12/12** |
| Guard och opt-in för båda profilerna (`guard-aw.mjs`) | **PASS 87/87** (se probe-bugg nedan) |
| Launcher (`launcher-aw.mjs`) | **PASS 30/30** |
| Försökslogg, recovery och korsprofil (`mcp-aw.mjs`, riktig SDK-stdio) | 94 PASS / **2 FAIL = AW-QA-1, AW-QA-2** (reproducerat två gånger) |
| ICS, sommartid och escaping (`ics-aw.mjs`) | **PASS 80/80** |
| Ägarkort via MCP (`owner-aw.mjs`) | **PASS 48/48** |
| Ägarkort med begränsad read-only-SQL-roll (`owner-role-aw.mjs`) | **PASS 5/5** |
| UI i egen testvärd, Chromium, 320/390/1024 (`ui-aw.mjs`) | 70 PASS / 3 FAIL = 2× **AW-QA-3** + 1 probe-bugg (fokus, se nedan) |
| Ägarkortets tangentbordsfokus (`owner-focus-aw.mjs`, statisk, netns) | focus-visible PASS; fokus efter fel hamnar på BODY = **AW-QA-4** |

**Egna probe-buggar, rättade och omkörda (inte produktfel):**
1. Guard-fallet "owner utan DATABASE_URL" vägras redan av `scripts/database.mjs` med `DATABASE_CONFIG_INVALID` innan ägarvakten körs. Proben förväntade sig fel feltext.
2. I `mcp-aw` jämfördes checksummor fel (strängen "none" tolkades som en diff), och kanalnamnet "Lokal Tidkort Demo" klassades som kontaktuppgift.
3. UI-körningens första försök avbröts utifrån, och det andra saknade exporterad `SESSION_SECRET` för appen (login gav BOOKING_INTERNAL_ERROR). Efter rättning i `ui-ns.sh` gick den igenom.
4. Ägarkortets fokuskontroll använde programmatisk `.focus()` efter musklick, vilket inte triggar `:focus-visible`. Verifierat med riktiga Tab-tryck: alla knappar, selects och länkar får `outline: solid 3px`.

## 3. Uppgift 1: diffar, migration och upgrade

- **`package.json` och `package-lock.json`:** identiska med både 8126410 och 95f8071.
- **De 9 historiska migrationerna + `migration_lock.toml`:** byte-identiska med 95f8071.
- **Ny migration:** exakt en additiv, `20261113140000_card_booking_recovery`.
  - Den skapar `CREATE TABLE "CardBookingAttempt"` med:
    - PK (businessId, scope, requestId), där requestId är UUID;
    - `CHECK outcome IN (pending, saved, failed)`;
    - `CHECK scope ~ '^[a-f0-9]{64}$'`;
    - index (businessId, scope, createdAt, requestId);
    - partiellt UNIQUE `CardBookingAttempt_one_pending` (businessId, scope) WHERE outcome='pending'.
  - Ingen DROP, ALTER eller UPDATE på befintliga tabeller.
  - Ingen FK och ingen bookingId-kolumn; kopplingen sker via idempotensnyckeln `time-card_<uuid>`.
  - Alla tre constraints testades mot DB:n (23505 respektive 23514).
  - Det partiella indexet finns inte i Prisma-schemat. `prisma migrate diff` föreslår ändå inte att det ska tas bort; den drift diffen visar är äldre FK-namn, inte från denna ändring.
- **Domänkärnan oförändrad mot 8126410:** createBooking, kvoter, exclusion, lås och auth.
  - Hela `src/lib` är oförändrad utom `errors.ts`, som bara lägger till 7 publika meddelanden.
  - Ändringar finns i `schema.prisma` (ny modell), i `src/mcp/{server.ts, time-card/*}`, `owner-card/*` (ny), plugin och launcher, testerna, `verify.yml`, `.env.example` och dokumentationen.
  - Changed-listor: `logs/changed-vs-8126410.txt` och `logs/changed-vs-95f8071.txt`.
- **`evidence/qa-code.diff`:** 25 filer. Den går att applicera ren mot 8126410-kopian efter CRLF→LF-normalisering, och resultatet är byte-identiskt med c4e08bd för alla 25 filer. **Bekräftad.** Docs-filer ingår inte i diffen.
- **`docs/AGENT_BOOKING_WORKDAY_PLAN.md` läst.** Leverans A–C och grindarna stämmer med koden.
  - Plugin-README är oförändrad.
  - `plugin.json` har ändrats från 0.2.0 till 0.3.0.
- **Upgrade-test** (`logs/upgrade-aw.txt`):
  1. DB:n skapades med 8126410-koden (9 migrationer, seed).
  2. Två riktiga kortbokningar gjordes via den gamla 0.2.0-servern.
  3. `migrate deploy` med c4e08bd gav exakt 10 migrationer, ingen rollback.
  4. Alla befintliga tabeller är md5-identiska efteråt, och `CardBookingAttempt` är tom. En andra deploy är no-op och `migrate status` är up to date.
  5. Legacy-bokningar syns inte i historiken (AW-QA-5, Info). En explicit retry med samma UUID och payload återspelar samma boknings-id utan dubblett och tar sedan in bokningen i historiken med kvitto och ICS.

## 4. Uppgift 3: scope och behörigheter

- **Läsprofil:** exakt 2 verktyg (list_services, show_time_picker).
- **Bokningsprofil:** exakt 5 verktyg = de 2 läsverktygen + `book_demo_time` + `read_demo_bookings` + `get_demo_calendar_file`.
  - Alla tre är app-only (`_meta.ui.visibility=["app"]`).
  - De två nya har `readOnlyHint=true` och strikta scheman (`requestId` uuid, additionalProperties false).
- **Inga kund-, register- eller adminverktyg** i någon profil. Okända verktyg avvisas.
- **CB-QA-2 åtgärdat:** server och launcher vägrar alla `VERCEL*`-variabler (13 testade, inklusive `VERCELX` och `VERCEL_OIDC_TOKEN`) samt `NOW_REGION`, i både läs- och bokningsläge, i env-filen och i föräldramiljön. En tom `VERCEL=` vägras inte, eftersom värdet är falsy.
- **Övriga vägranden:** production, fjärrvärd, neon-värd, `?host=`-override, fel DB-namn, `--allow-workspace` och kort hemlighet vägras alla.
- **Ägarprofilen** (`src/mcp/server.ts --admin --workday-card`, `BOOKING_OWNER_CARD_DEMO=1`):
  - exakt `show_workday` och en resurs `ui://booking-lab/workday-v1.html` (CSP-domäner tomma, ingen extern URL);
  - vägrar `--allow-bookings`, `--allow-workspace`, `--capacity-only`, saknad `--admin`, flagga ≠ "1", hemlighet under 32 tecken, production, VERCEL*/NOW_REGION, fjärr-DB och fel DB;
  - vägrar också origin med https, extern värd, `user:pw`, path, query, hash eller `javascript:`.
- **Ingen uppgradering mellan profilerna:**
  - Ägarflaggan uppgraderar inte kundkortet (fortfarande 2 eller 5 verktyg), och kortet vägrar `--workday-card`.
  - Bokningsflaggor uppgraderar inte ägarprofilen.
  - Läsprofilen når inte de nya verktygen.
  - Launchern vidarebefordrar aldrig ägar-env eller `--workday-card`.
- **Korsprofil (annan SESSION_SECRET):**
  - Profil B ser inget av A:s historik.
  - read eller ICS med A:s requestId ger 403.
  - Replay med A:s UUID och payload efter commit ger 403 utan läcka och utan rader.
  - En webbokning med nyckelformen `time-card_<uuid>` från en annan kanal ger varken read, ICS eller replay.
  - **Undantag:** racefallet, se AW-QA-1.
- **Indata:** extra fält (email, bookingId, scope, customerId), injection och felformade UUID:er avvisas av schemat utan skrivningar.

## 5. Uppgift 4: försökslogg

Följande PASS, med riktig stdio och en process per grupp:
- **Ordning:** försöket committas som `pending` innan domänskrivningen. Visat genom att hålla idempotensnyckelns advisory-lås: försöksraden finns, bokningen finns inte.
- **20 parallella anrop med samma UUID** över 4 processer: 1 bokning, 1 `create`-händelse, 1 försök (`saved`) och identiska svar.
- **Konkurrerande nycklar:**
  - 12 olika nycklar på samma tid → 1 vinnare, förlorarna får "Tiden är inte tillgänglig";
  - profil A mot B på samma tid → 1 vinnare (exclusion oförändrad).
- **Ett pending per kanal:** ett nytt försök på annan tid ger 409 "Kontrollera det tidigare bokningsförsöket först.", på samma tid 400. Det partiella indexet stoppar en andra pending-rad direkt i DB:n.
- **kill -9 före commit:**
  - ingen bokning, försöket förblir pending;
  - efter omstart ger read `pending` med exakt retry-payload;
  - läsning, show och ICS-vägran skriver ingenting;
  - ett nytt försök blockeras, och ändrad payload (start eller serviceVersion) ger 409 "andra uppgifter";
  - explicit retry ger 1 bokning och en andra retry ger identiskt svar.
- **Efter commit, med DB-fel i finishCardAttempt** (trigger RAISE): klienten får det generiska felet "Ett fel inträffade", bokningen finns 1 gång och försöket är kvar som pending.
  - Vid återöppning härleder read `saved` med kvitto, men DB-raden förblir `pending` (ingen automatisk mutation). ICS fungerar.
  - Retry ger samma id och raden markeras `saved`.
- **kill -9 + avslutad backend mitt i finish** (pg_sleep): bokningen är committad och försöket pending. Ett nytt försök med annan UUID tillåts och markerar det gamla som saved.
- **Kvoter:**
  - e-posttaket 3/dag gäller, och det 4:e och 5:e försöket nekas och sparas som `failed`;
  - retry av ett nekat försök ger 409 "nekades";
  - replay av en sparad bokning fungerar även när kvoten är slut.
  - Kanaltaket 5/dag nås inte via kortet eftersom e-posttaket slår först; domain.ts är oförändrad och taket täcks av integrationstesterna.
- **`confirmed=true` krävs fortfarande.** CB-QA-1 kvarstår: dag +35 accepteras av `book_demo_time` trots att väljaren visar 0 tider.
- **Historiken:** pending visas först, sedan de senaste 20 icke-pending i fallande ordning (21 poster av 23 failed + 1 pending). Ett äldre försök utanför topp-20 kan fortfarande läsas via sitt eget requestId.
- **Integritet:** inga dubbla händelser och inga pending-rester efter varje grupp. All QA-data har städats bort.
- **Admin-ändringar** via riktigt workspace-MCP:
  - efter flytt visar kvittot aktuell personal och tid, version 2 och `changedSinceCreation`, medan replay-kontraktet fortfarande ger originaltiderna;
  - efter avbokning blir status `cancelled`, ICS nekas, och replay ger samma bokning som avbokad utan ny rad.

## 6. Uppgift 5: ICS

- **Format:**
  - CRLF genomgående, varje fysisk rad ≤75 oktetter;
  - ingen rad delar ett multibyte-tecken (testat med åäö, ÅÄÖ, 😀, 🇸🇪 och ZWJ-familj);
  - UTC `…Z` utan TZID eller VTIMEZONE;
  - DTEND − DTSTART = behandlingens längd utan buffert (45 min för en tjänst med 15 min buffert, 60 min för fotvård).
- **Stabilitet:**
  - UID = `<bookingId>@booking-lab.example.test`, stabilt över hämtningar och ändringar;
  - SEQUENCE går från 1 till 2 efter flytt;
  - inga ATTENDEE, ORGANIZER eller mailto, METHOD:PUBLISH.
- **Escaping:** SUMMARY escapar `\\`, `\n`, `\;` och `\,` exakt, och python icalendar 7.3.0 parsar tillbaka till originaltexten.
- **Sommartid:**
  - 2027-03-28: en bokning 01:30 lokal (00:30Z) som korsar 02→03 ger korrekt UTC och 45 minuter. Inga 02:xx-tider visas.
  - 2026-10-25 och 2027-10-31: korrekt UTC. Motorn visar dock inga lokala 02:xx-tider den dagen (AW-QA-7, Info, befintligt beteende).
- **Endast aktiv egen bokning:** ICS nekas för pending, avbokad, annan kanal och annan profil.
- **Blob-nedladdning i testvärden:**
  - med `sandbox="allow-scripts allow-downloads"` levereras `booking-lab-demo.ics` med VCALENDAR;
  - med bara `allow-scripts` (320/390) sker ingen nedladdning, men kortet säger ändå "Kalenderfilen är klar" (AW-QA-8, Info).
  - Hur native-värdens sandbox beter sig är **overifierat**.

## 7. Uppgift 6: ägarkort

- **Personal och dag:** 25 bokningar ger sida 1 med 20 + `nextCursor` och sida 2 med 5 + null.
  - Föregående dags 23:30, nästa dags 00:10, avbokade bokningar och annan personal exkluderas.
  - nextVisit är identisk på båda sidorna.
- **Cursor:** ogiltig, främmande (annan personal, annan dag, avbokad), 129 tecken och injection avvisas alla.
- **Sommartidsdagar** 2027-03-28 och 2026-10-25 (fake clock): exakt dygnets 4 bokningar.
- **Tider:** högst 12, exakt de första 12 från `getAvailability` (jämfört med kortets show_time_picker), följer vald behandling och har `moreSlots`-flagga.
- **Kapacitet:** högst 3 förslag med bara bookingId + available och `hasMore`. Omfånget anges som "för salongen denna dag" och bara inom 7 dagar.
- **Fönster:** idag −7 och +27 är ok, −8 och +28 avvisas. Passerade dagar ger inga tider och ingen kapacitet.
- **Inga kunduppgifter:** inga namn, e-postadresser eller telefonnummer i output eller DOM. Bokningsobjekten innehåller bara id, serviceName, tider, duration, priceOre och status.
- **Länkar:**
  - bara `http://<loopback>/admin…`, med `target=_blank` och `noopener`;
  - inga hemligheter i URL;
  - utan adminsession visas login; med vanlig individuell admininloggning visas detaljsidan.
  - Klientsidans `safeLink` tar bort `javascript:` och externa länkar.
- **Noll DB-skrivningar:** md5 för alla tabeller är oförändrad efter alla ägaranrop, inklusive fake clock och UI-pagineringen.
- **Begränsad roll:** `default_transaction_read_only=on`, utan Customer, AdminUser, AdminSession och RateLimitBucket och utan `Booking.customerEmail`. Allt fungerar, inklusive kapacitet. Rollen kräver dock `Booking.customerName`, se AW-QA-6.

## 8. Uppgift 7: UI i egen testvärd (inte ChatGPT)

Skärmdumpar finns i `run/shots/aw-*.png` (20 st). Allt nedan PASS om inget annat anges.

- **Flöde och historik:**
  - Historiken läses automatiskt en gång, och Boka är spärrad tills den är läst.
  - Ett nytt val kräver nytt samtycke.
  - Det blir ingen overflow vid 320, 390 eller 1024 px.
- **Stängt kort med pending i DB** (servern blockerad före commit, MCP-processen dödad):
  - Vid återöppning visas "Tidigare försök: måndag 16 november kl. 10:30. Utfallet är okänt. …".
  - Retry-knappen har fokus och alla val är spärrade.
  - Bara read anropas, ingen mutation.
  - Retry använder samma clientRequestId och ger 1 bokning.
- **Tappat svar:**
  - efter commit visas "kan ha skapats … kl. HH:MM", och vid återöppning visas kvittot automatiskt utan bokningsanrop;
  - före sändning blir det ingen rad, och retry skickar identiska argument.
- **Ett andra kort medan ett försök är pending** visar pending. Bokning av annan tid växlar till det pågående försöket via `previous_attempt_pending`, utan ny rad.
- **Dubbelklick, två synkrona klick eller dubbel Enter** ger 1 anrop och 1 bokning.
- **Flytt och avbokning via vanlig admin-UI + "Uppdatera bokningsstatus":** rätt rubrik, ny tid, avbokat-text och spärrad kalenderknapp. Men kalendertexten ligger kvar, se AW-QA-3.
- **Tangentbord och fokus:**
  - TC-QA-1: efter Enter på en dag hamnar fokus på `h2#slots-title`;
  - CB-QA-5: 17 Tab från vald tid till samtycket (Info, oförändrat);
  - vald tid har kontrast 7,66 (även vid hover);
  - efter tangentbordsbokning hamnar fokus på kvittot.
- **Fel- och tomtillstånd:**
  - När historiken inte går att läsa visas fel och Boka förblir spärrad; vid ny hämtning försvinner felet.
  - När ICS-hämtningen misslyckas visas fel, knappen aktiveras igen och ingen länk visas.
- **Strängar som text:** kort och ägarkort renderar data från värden som text, utan att något körs.
- **Ägarkortet:**
  - 320/390/1024 utan overflow;
  - "Fler" och "Första" fungerar, med fokus på dagsrubriken;
  - felläget visar "Ingen ändring har gjorts." och Försök igen, men fokus hamnar på BODY (AW-QA-4).
- **Nätverk:** 0 externa förfrågningar. Enda konsolfelen är 404 för robots och favicon i testvärden.

## 9. Fynd

| ID | Allvar | Status |
|---|---|---|
| AW-QA-1 | Low | VERIFIED |
| AW-QA-2 | Low | VERIFIED |
| AW-QA-3 | Low | VERIFIED |
| AW-QA-4 | Low | VERIFIED |
| AW-QA-5 | Info | VERIFIED |
| AW-QA-6 | Info | VERIFIED |
| AW-QA-7 | Info | VERIFIED (befintligt beteende) |
| AW-QA-8 | Info | VERIFIED i egen värd, native overifierat |
| AW-QA-9 | Info | — |
| AW-QA-10 | Info | — |

**AW-QA-1 (Low, VERIFIED) – korsprofil-race läcker A:s boknings-id till B.**
- *Plats:* `src/mcp/time-card/recovery.ts:80` och `src/mcp/time-card/booking.ts:30`; `domain.ts:272` replayar på nyckel + requestHash utan att jämföra clientKey.
- *Repro:*
  1. Profil A startar ett anrop med UUID u (håll nyckellåset).
  2. Profil B (annan SESSION_SECRET) anropar med samma u och exakt payload.
  3. Släpp låset. B passerar `rememberCardAttempt` eftersom det ännu inte finns någon bokning.
  4. `createBooking` replayar då A:s bokning till B: id, status och tider.
  - B:s försök blir `saved` utan kvitto, och ICS nekas fortfarande.
- *Förutsättning:* B känner A:s slumpade UUID medan A:s anrop pågår. Risken är därför låg, men det bryter planens "ett id räcker aldrig".
- *Fixriktning:* efter `createBooking`, kräv `booking.clientKey === channelKey()`. Annars kasta 403, markera försöket failed och returnera ingenting. Alternativt: namnrymd idempotensnyckeln per kanal.

**AW-QA-2 (Low, VERIFIED) – permanent låsning av en kanal om en annan profil förbrukar dess pending-UUID.**
- *Plats:* `recovery.ts:80` och `recovery.ts:113–127`.
- *Repro:*
  1. A:s pending har ingen bokning (kill -9 före commit).
  2. B bokar med A:s u och payload, vilket lyckas med B:s clientKey.
  3. A:s retry ger 403 för alltid, A:s nya försök ger 409 "Kontrollera det tidigare…" för alltid, och historiken visar pending med retry för alltid.
- Det finns ingen abandon- eller expiry-väg; bara DB-ingrepp löser upp det. Kräver samma UUID-kännedom som AW-QA-1.
- *Fixriktning:* låt grenen med 403 för en `priorBooking` från en annan kanal markera det egna pending-försöket `failed`. Alternativt en uttrycklig "släpp okänt försök"-väg.

**AW-QA-3 (Low, VERIFIED, 2/2) – inaktuell kalendertext efter ändring eller avbokning.**
- *Plats:* `src/mcp/time-card/ui.html:708–745` (`showReceipt` döljer länken men återställer inte `#calendar-notice`); texten sätts på rad 847.
- *Repro:*
  1. Boka och tryck "Lägg i min kalender".
  2. Flytta eller avboka i admin.
  3. Tryck "Uppdatera bokningsstatus". Kortet säger fortfarande "Kalenderfilen är klar. Hämta och importera…" trots att länken är dold och knappen spärrad vid avbokning.
- Syns även i Codex `reopen-390.png`.
- *Fixriktning:* återställ notisens standardtext och återkalla blob-URL:en i `showReceipt`.

**AW-QA-4 (Low, VERIFIED) – ägarkortet tappar fokus vid laddfel.**
- *Plats:* `src/mcp/owner-card/ui.html:376–381`. Den aktiverade knappen spärras, så fokus hamnar på BODY.
- *Fixriktning:* `$("retry").focus()` i catch-grenen.

**AW-QA-5 (Info) – legacy-kortbokningar (8126410) syns inte i historiken.** De dyker upp först efter en explicit retry med samma UUID och payload, vilket fungerar och är säkert. c4e08bd har ingen automatisk adoption.

**AW-QA-6 (Info) – ägarvägen läser fler kolumner och hemligheter än den behöver.**
- `listCalendar` väljer `customerName` (`src/lib/calendar.ts:43`), så en minsta läsroll måste få SELECT på kundnamn trots att det aldrig skickas ut.
- Ägarprofilen kräver `SESSION_SECRET` (≥32) men använder den inte. `SESSION_SECRET` används också av webbens `auth.ts`.
- *Fixriktning:* ägarspecifik select utan `customerName`; dedikerad hemlighet för ägarprofilen.

**AW-QA-7 (Info, befintligt beteende) – inga lokala 02:xx-tider på höstens sommartidsdag.** Schemamotorn utesluter hela den tvetydiga timmen (4 tider). Domänkoden är oförändrad.

**AW-QA-8 (Info) – nedladdningen beror på värdens sandbox.** Utan `allow-downloads` laddas ingenting ned, men texten säger att filen är klar. Native-värdens beteende är overifierat.

**AW-QA-9 (Info) – avvikande standardorigin.** Standard är `ownerOrigin` `http://localhost:3187` (`data.ts:41`), medan `.env.example` och Playwright använder 3197.

**AW-QA-10 (Info) – Codex `MANIFEST.json` saknar filhashar.** Den innehåller bara 4 metadatafält, så evidensens integritet kan inte verifieras mot manifestet.

**Blockerare:** inga. **Backlog:** AW-QA-1…10 och CB-QA-1.

## 10. Status för gamla fynd

| Fynd | Status | Belägg |
|---|---|---|
| CB-QA-1 (dag +35 accepteras) | **Kvarstår** (Low) | `book_demo_time` accepterade 2026-12-18 |
| CB-QA-2 (VERCEL*/NOW_REGION) | **Åtgärdat** (VERIFIED) | guard 87/87, launcher 30/30 |
| CB-QA-3 (`crypto.randomUUID` saknas) | **Åtgärdat** enligt kodgranskning | `ui.html` visar meddelande; inte körd i osäker kontext denna gång |
| CB-QA-4 (pending döljer tid) | **Åtgärdat** (VERIFIED) | pending- och lost-texter innehåller datum och kl. |
| CB-QA-5 (17 Tab) | **Oförändrat** (Info) | |
| TC-QA-1 (fokus efter dag) | OK i denna körning | |

## 11. Codex påståenden

Bekräftat av egna körningar:
- unit 89/89;
- integration 120/120;
- 13 korttester;
- lint och tsc rc 0;
- build;
- `qa-code.diff` = verklig koddiff (25 filer);
- 8 PNG:er granskade och konsistenta med UI:t, och `reopen-390` visar själv AW-QA-3;
- `secret-scan.json`: 0 träffar (läst, inte omkört).

Overifierbart:
- MANIFEST utan hashar;
- Windows-sökvägar och tider i evidensen;
- "505 filer".

Ingen native ChatGPT-, PC- eller iPhone-testning påstås av Codex eller av oss.

## 12. Codex underlag (granskat, ej eget) – t76u

| Codex påstående | Bedömning |
|---|---|
| Webbmatris 46/46 i 4 lägen | **Bekräftat oberoende** av vår egen matris, 184/184 |
| Audit full exit 1 = 7 moderate (dev); omit-dev exit 0 = 0 | **Bekräftat** (egen körning, identiskt) |
| Isolerad 9→10-upgrade bevarade Bookings radhash och städade fixturen | Deras artefakt **overifierad**. Beteendet **bekräftat** av vårt eget upgrade-test (alla tabeller md5-identiska, 12/12) |
| 505 källfiler matchar testkopia och fryst runtime | **Overifierbart**; ingen hashlista i MANIFEST |
| Begränsade SQL-roller 21 PASS (launcher, create, restart, read, 20 retry, ICS; ägare med enbart show_workday; nekade tabeller och UPDATE/DELETE) | **Overifierat** som helhet. Delvis styrkt: vår read-only-ägarroll utan Customer, Admin* och `customerEmail` gav 5/5 PASS och exakt `show_workday`. Kundrollens behörighetsdelar är inte testade av oss |

## 13. Designgranskning av planerad lokal konfiguration (beskriven, inte testad av oss)

- **Kundplugin 0.2→0.3 med granskad launcher, utan ägarverktyg:** acceptabelt.
  - Launchern är granskad (30/30). Den vidarebefordrar varken ägar-env eller `--workday-card`, och kundservern vägrar `--workday-card`.
- **Additiv migration utan att ändra befintliga syntetiska Booking- och händelserader:** **bekräftat i vår kopia** (upgrade-test).
- **"Adoption" av äldre kvitton bara vid exakt matchande requestHash:**
  - **Den logiken finns inte i c4e08bd.** Produktvägen är explicit retry med samma UUID, där `createBooking` jämför `requestHash` (`domain.ts:272`) och `recovery.ts:80` kräver samma clientKey.
  - En adoption vid sidan av produkten är overifierbar. Den måste då:
    - utgå från idempotensnyckeln `time-card_<uuid>`;
    - kräva `clientKey` = kanal-HMAC för samma `SESSION_SECRET`, eftersom requestHash inte innehåller clientKey (jfr AW-QA-1);
    - skriva scope med samma hemlighet;
    - bara skapa `saved`-rader, aldrig `pending`.
  - LC-F1-QA-1-kontext: requestHash är osaltad SHA-256 av payload inklusive kontaktfälten.
    - För kortbokningar är kontakten fast syntetisk (Tidkort Demo / `tidkort@example.test`), så hashen avslöjar inget nytt.
    - Använd ändå inte hash-matchning som enda identitetsbevis eller som orakel.
- **Separat `booking_workday_demo`-profil med `enabled_tools=[show_workday]`:** acceptabelt som djupförsvar. Servern exponerar ändå bara `show_workday`.
- **Operatörswrapper utanför produktkoden:** **overifierbar** som kod.
  - Vad `mcpEnvironment({workspace:true})` faktiskt släpper igenom i c4e08bd (`src/mcp/environment.ts`):
    - DATABASE_URL, PATH, Path, SystemRoot, SYSTEMROOT, TEMP, TMP, HOME, USERPROFILE, NODE_EXTRA_CA_CERTS, CHECKPOINT_DISABLE och NEXT_TELEMETRY_DISABLED;
    - plus SESSION_SECRET när workspace är satt;
    - inte NODE_ENV och inte VERCEL*.
  - Värdena läses från wrapperns egen `process.env`. Wrappern måste därför lägga den privata filens värden **över** föräldramiljön, så att en ärvd DATABASE_URL eller SESSION_SECRET inte följer med.
  - Ägarservern upprätthåller vakterna själv oavsett wrapper:
    - `server.ts:32` vid start;
    - `register.ts:8`;
    - `data.ts:65` vid varje anrop.
    - Den kontrollerar NODE_ENV, VERCEL*/NOW_REGION, flaggor, hemlighetslängd, test- eller demo-DB och loopback-origin (87 fall verifierade).
- **SQL-ägarroll read-only utan e-postkolumn:** fungerar (egen probe 5/5). Rollen behöver dock SELECT på `Booking.customerName` (AW-QA-6) samt Service, Staff, BookingEvent, CapacityDecision och Campaign. Vi beviljade även WorkspaceRequest och CustomerDataAction och minimerade inte rollen ytterligare.
- **Gamla profiler bevarade; native reload verifieras separat:** inte verifierat av oss.

**Kort verdikt: acceptabelt med villkor.**
1. Använd en dedikerad lång `SESSION_SECRET` för ägarprofilen, inte webbens auth-hemlighet. Ägarkortet använder den bara som längdgrind.
2. Låt wrappern skriva över ärvd env och bara vidarebefordra listan ovan + `BOOKING_OWNER_CARD_DEMO` + origin.
3. Ge SQL-rollen minsta rättigheter med read-only, inklusive en medveten SELECT på `customerName` eller vänta på fixen för AW-QA-6.
4. Gör ingen adoption vid sidan av produkten utan clientKey-kontroll; föredra explicit retry.
5. Använd origin 3197 explicit (AW-QA-9).

Kvarstående risker: AW-QA-1 och AW-QA-2 om UUID:er kan delas mellan profiler, samt att native-värdens sandbox för nedladdning är okänd (AW-QA-8).

## 14. Saknade tester (rekommendation)

- Korsprofil-race och lockout (AW-QA-1 och 2) i integrationstesterna.
- Kalendertextens återställning vid uppdaterad status.
- Ägarkortets fokus vid laddfel.
- Ägarkortet med en begränsad read-only-roll i CI.
- Ett hostfall utan `allow-downloads`.
- En bokningsgräns för fönstret på 28 dagar (CB-QA-1).
- Adoption och retry av legacy-bokningar.

## 15. Städning

- Alla PG-instanser är stoppade (55820, 55821 och 55822) och alla app- och MCP-processer avslutade.
- Temporär `.env` och `/tmp/awsec`-hemligheter är raderade.
- `/tmp/old81` och `/tmp/aw*` är raderade.
- `node_modules`, `.next` och pgdata i denna körnings `work` är borttagna.
- QA-rollen `qa_owner_ro` fanns bara i den raderade pgdata.
- Endast denna körnings egna mappar har rörts.
