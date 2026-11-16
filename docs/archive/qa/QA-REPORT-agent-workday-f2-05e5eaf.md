# QA-rapport: Agent Workday fixrunda 2/2 (t78u), frusen `05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1`

Datum: 2026-11-13. Körning ungefär 17:38–17:55 (Europe/Stockholm, CET).

Riktad omkontroll av enbart AW-F1-QA-1 från F1-rapporten (sha256 `a16a0888…3c0f`). Basen är `cf6d2d2`.
Ingen ny full QA av oförändrade epics. Detta är sista varvet: inget nytt fynd på Medium-nivå eller högre skulle ha gett BLOCKED/NO-GO, och det finns ingen fix request.

## 1. Scope och regler
- **Källa och evidens:**
  - `code.zip` sha256 `41ab4ef3…7c39`, 3 937 583 byte, 593 poster. Zip-kommentaren är `05e5eafc…a1f7aa1`. Bara `.env.example` finns.
  - `evidence.zip` sha256 `b1e0b572…7a47f67`, 15 078 byte, 29 poster.
  - Brief sha256 `d86cdce0…ef53a33`, läst i sin helhet.
- **Egen syntetisk kopia:** `agent-workday-f2-05e5eaf/run/work`.
  - `.env` utan hemligheter.
  - Hemligheter S/A/B/C (48 hex) låg i `/tmp/f2sec` (0600) och skickades bara via env.
- **Databaser:** fräsch embedded Postgres med trust och utan root.
  - Host: 55840.
  - E2E: 55841 i en isolerad netns.
  - HTTP-prob: 55842 i en isolerad netns, med `next start` på privat loopback :3000.
- **Körmiljö:** TZ=Europe/Stockholm och `env -u NODE_ENV`. Webbruntider kördes sekventiellt. Bara `@example.test` användes.
- **Inte rört:** PC, original, preview, GitHub, moln och tokens. Ingen kodändring. Inga `.env`-, secrets- eller operator-private-json-filer lästes.

## 2. Diff mot cf6d2d2 (Do 1)
Ändrat:
- **Ny fil:** `src/lib/booking-channel.ts` med `assertCardReplayChannel`.
- **`src/app/api/bookings/route.ts`:** 1 import och 1 anrop.
- **`src/mcp/server.ts`:** 1 import och 1 anrop i `create_booking`.
- **Tester:** ny `tests/booking-channel.test.ts` (2 unit), ny `tests/e2e/card-replay.spec.ts` (1 test × desktop och mobil), samt `tests/integration/agent-workday.test.ts` (+1).
- **Dokument:** `AGENT_BOOKING_WORKDAY_PLAN.md`, `ARCHITECTURE.md`, `PRIVACY_SECURITY.md` och kopian av F1-rapporten.

Byte-identiska filer:
- alla befintliga filer i `src/lib`, inklusive `domain.ts`/`createBooking`;
- alla 10 migrationer och `schema.prisma`;
- båda kort-HTML-filerna;
- `package.json` och `package-lock.json`;
- alla andra `src/app`-routes, inklusive admin, vars nyckelnamespace är `sha256(admin:<id>:<key>)`;
- `src/mcp/time-card/*` och `src/mcp/workspace.ts`.

`qa-code.diff` gäller för cf6d2d2-filerna efter LF-normalisering. Alla 6 filer blir identiska med 05e5eaf.

### Kodgranskning av `assertCardReplayChannel(booking, clientAddress)`
- **Vad som kontrolleras:** den faktiskt returnerade radens `idempotencyKey`, som är lagrad och alltså inte begärd.
  - Börjar den med `time-card_` krävs att `booking.clientKey === HMAC(SESSION_SECRET, clientAddress)`.
  - Annars, liksom vid saknad eller kort hemlighet, kastas en DomainError 403 med samma fasta text som kortet använder.
- **Placering:** anropet sker efter `createBooking` och före allt svar.
  - Publik POST: `ip` kommer från `verifiedClientAddress` och är en IP som valideras med `isIP`. Den kan inte förfalskas till kortets kanalsträng `mcp:local-booking-channel:v1`.
  - MCP: `MCP_BOOKING_CLIENT`.
- **Svarsvägar:**
  - Replay och nyskapad rad går genom samma kontroll. En nyskapad rad har alltid anroparens egen clientKey och passerar därför.
  - Felgrenar (400/409/429) returnerar inga raddata.
  - `create_booking` i workspace-läge (`--allow-workspace`) använder samma handler och omfattas.
- **Andra vägar som kan returnera en bokning:**
  - Admin-HTTP har ett hashat namespace, så en `time-card_`-nyckel kan aldrig matchas där.
  - Publik GET per id eller nyckel finns inte (`GET /api/bookings/<uuid>` ger 404).
  - Bokningar syns bara via privilegierade operatörsverktyg: admin-UI/API, MCP `list_bookings` (`--admin`) och workspace move/cancel per id. Det är avsiktligt och oförändrat, se AW-F2-QA-2.
- **Prefixvarianter:** nyckel-regexen `^[A-Za-z0-9_-]+$` normaliserar ingenting.
  - `TIME-CARD_`/`Time-Card_` blir en separat lagrad nyckel och får samma tid → "Tiden är inte tillgänglig".
  - `%5F`, `é`, Unicode-bindestreck och kyrilliskt `і` ger 400 i både MCP och HTTP.
  - Ledande eller avslutande blanksteg eller tab i HTTP-headern trimmas av HTTP-parsern till exakt `time-card_…` och får 403. I MCP avvisas de.
  - Ingen variant gav någon gång kortets id.
- **Föräldralösa rader:** en nekad replay skapar ingen rad. Kontrollen nekar bara en returnerad rad som redan fanns med främmande clientKey. Det är verifierat med radhashar.

## 3. Egna kommandon (Do 2)

| Steg | Resultat |
|---|---|
| npm ci | PASS (15 s) |
| prisma generate | PASS |
| migrate deploy (10) + seed | PASS (10/10) |
| lint | PASS |
| tsc --noEmit | PASS |
| unit | PASS **91/91** |
| build | PASS |
| integration | PASS **125/125**; efteråt 0 kunder/bokningar/attempts/admins |
| agent-workday Playwright (netns) | PASS **13/13** |
| web E2E prod0 / prod1 / dev0 / dev1 (fräscha DB, netns, sekventiellt) | PASS **48/48 ×4 = 192/192** (inklusive `card-replay.spec`); efter varje: 0 rader |
| npm audit full | 7 moderate (dev), 0 high/critical |
| npm audit --omit=dev | 0 |

## 4. AW-F1-QA-1 (Do 3)

### Oförändrade prober
- **`mcp-aw.mjs`: 96/96.** RACE och LOCKOUT är fortsatt stängda (AW-QA-1/2).
- **`adv-f1.mjs`: 17/17.**
  - Racen gav 33 vinster för A och 17 för B.
  - Gapet gav 10 vinster för legacy och 10 för kortet.
  - **Omvänd riktning:** `legacyReplayOfCardBooking=0`, mot **10/10 vid cf6d2d2**.
- **Regressioner:** guard 87/87, owner 48/48, owner-roll 5/5 (roll utan `customerEmail`, med en bokning).

### Ny prob för äldre MCP (`rev-mcp.mjs`): 14/14 PASS
- **Efter commit:** 20 samtidiga främmande `create_booking`-replays (hemlighet C, 4 processer) gav 20× 403 med den fasta texten, utan id, tid eller personal. Efteråt fanns fortfarande 1 rad och 1 create-event, och försöket var `saved`.
- **Rätt kanal:** kortets retry gav ett normalt kvitto med samma id.
- **Samma hemlighet och MCP-identitet** ger samma kanal: replay returnerar bokningen, enligt design (AW-F1-QA-2).
- **Race mot commit, 20 rundor varav 10 hållna:**
  - Kortet vann 8 gånger. Legacy fick då en ren 403.
  - Legacy vann 12 gånger. Det var legacys egen nya rad med eget id, kortet fick en ren 403, inget pending blev kvar, och det blev 1 rad och 1 event.
- **Legacy skapar först en ny `time-card_`-nyckel:** legacy får sin egen bokning (tillåtet), kortet får en ren 403, legacys egen replay returnerar samma bokning, och det finns ingen föräldralös rad.
- **Felaktiga svar och prefixvarianter:** nekad replay och payload-mismatch (409) lämnar Booking, BookingEvent och CardBookingAttempt hash-identiska. Prefixvarianterna ger aldrig kortets id.
- **Oprefixade nycklar:** egen replay och replay med annan hemlighet ger samma data som vid cf6d2d2, alltså gammalt kontrakt.
- **Latens:** max 333 ms. Inga deadlocks.

### Ny HTTP-prob (`rev-http.mjs`, riktig `next start` i netns): 9/9 PASS
- **Efter commit:** 25 samtidiga `POST /api/bookings` med kortets exakta nyckel och payload gav alla `403 {"error":"Bokningen kan inte visas med den här demoprofilen."}`.
  - Inga id i body eller headers, ingen `location`.
  - Headers är samma standarduppsättning som andra svar (CSP, nosniff med flera).
  - Rätt korts retry gav samma id, 1 rad och 1 event.
- **Race mot commit, 12 rundor varav 6 hållna, distinkta källadresser:**
  - Kortet vann 8 gånger. HTTP fick då en ren 403.
  - HTTP vann 4 gånger. Det var en egen ny 201 `{id}`. Kortet fick en ren 403, inget pending blev kvar, och det blev 1 rad och 1 event.
- **HTTP skapar först en `time-card_`-nyckel:** 201 med egen rad och egen replay med samma id. Därefter fick kortet 403, och en annan IP fick 403. Ingen föräldralös rad.
- **Oprefixad nyckel:** samma IP och annan IP gav båda 201 med samma `{id}`. Det gamla kontraktet är oförändrat.
- **Andra felsvar:**
  - mismatch: 409 "Bokningsnyckeln har redan använts med andra uppgifter.";
  - ogiltig nyckel: 400 "Kontrollera uppgifterna";
  - GET per uuid: 404.
- **Timing:** median 4 ms för 403 mot 2 ms för 409, alltså försumbart.
- **Admin-replay:** admin-routen är byte-identisk och har hashat namespace. Den omfattas av E2E 192/192 men har inte probats separat.

**Slutsats: AW-F1-QA-1 STÄNGD.** Både den äldre MCP-kanalen och publik HTTP med annan kanal ger 403 utan data. Det gäller i 18 rundor där kortet vann via MCP (adv-f1 10 och rev-mcp 8) och 8 rundor via HTTP, plus 20 respektive 25 samtidiga replays efter commit.

## 5. Nya fynd
- **AW-F2-QA-1 (Info, befintligt):** existensorakel för någon som redan känner till exakt UUID.
  - Statuskoden avslöjar om en `time-card_`-nyckel redan finns: 403 vid exakt payload, 409 vid annan payload, 201 om den inte finns.
  - Det kräver kortets slumpade UUID, och inga data röjs.
  - 409 vid mismatch fanns redan före F2 (domänen är oförändrad).
- **AW-F2-QA-2 (Info, design):**
  - Privilegierade operatörsytor visar och påverkar fortfarande kortbokningar, oberoende av kanal: admin-UI/API, MCP `list_bookings` (`--admin`) och workspace move/cancel per id.
  - En äldre kanal kan avsiktligt skapa nya egna bokningar med `time-card_`-prefix, vilket blockerar kortets UUID med en ren 403.
  - Båda är avsiktliga och oförändrade.
- **Probe-fel (egna, rättade):**
  - Fel i egna prober, nu rättade:
    - fel DB-namn för HTTP-proben (guarden kräver `*_demo`);
    - HTTP-body saknade `serviceVersion`/`clientRequestId`/`confirmed`, vilket gav en annan requestHash och 409;
    - en kontroll krävde ett attempt med `failed` där inget attempt skapas, eftersom kortet nekas redan i admission.
  - Ingenting av detta beror på produkten.

Inget fynd är Medium eller högre. Ingen blockerare.

## 6. Backlog (bara observation)
- **Oförändrade:** AW-QA-3, AW-QA-4, AW-QA-5, AW-QA-6, AW-QA-7, AW-QA-8 och CB-QA-1 (day+35 accepteras fortfarande). HTML, domänen och kortkoden är byte-identiska.
- **AW-QA-9:** är fortfarande Info, se §7.
- **Nya Info:** AW-F1-QA-2, AW-F2-QA-1 och AW-F2-QA-2.

## 7. Lokal config (designgranskning, ej testad)
- **F1-villkoren gäller oförändrat:** egen owner-hemlighet, snäv läsroll utan e-post (verifierad 5/5) och explicit loopback 3187. `ownerOrigin` är oförändrad.
- **Admin-wrappern måste uppgraderas:** F2 ändrar `POST /api/bookings`. Kontrollen gäller därför den publika HTTP-vägen bara om den vanliga lokala admin-/webbservern faktiskt kör F2 (`05e5eaf`).
  - En wrapper som fortfarande kör cf6d2d2 eller äldre låter HTTP-replays returnera kortets `{id}`.
  - Den planerade uppgraderingen ska behålla samma DB, sessioner, 3187 och skydd. Den är granskad som design men inte testad här.
- **Två gamla syntetiska bokningar:** de ska bevaras hash- och event-identiska. Legacy-kvitton återtas bara via explicit granskad retry efter att clientKey och requestHash matchat, aldrig via rå INSERT.
  - Det stämmer med koden. Retry går genom admission och `createBooking`, sedan `assertCardBookingChannel`. HTTP och legacy-MCP har nu `assertCardReplayChannel`.

## 8. Codex-underlag (granskat, ej eget)
- **Bekräftat:**
  - 91 unit och 125 integration (`full-unit.txt` och `full-integration.txt`; egen körning ger samma tal);
  - 13 kort-PW (`ui-cards.txt`; egen 13/13);
  - build PASS;
  - kod-diffen är exakt `qa-code.diff`;
  - `qa-archive.json` med SHA, bytes och 593 poster matchar zip-filen;
  - inga paket-, schema-, migrations-, domän- eller HTML-ändringar;
  - 48 per läge (egen körning: 48×4).
- **Pågående matris:** Codex webbmatris 48×4 finns inte i evidensen. Den är markerad som pågående och obekräftad från Codex sida, men min egen körning ger 192/192.
- **Ej i evidensen:** den slutliga auditen saknas. Min egen körning gav 7 moderate (dev) och 0 (prod), alltså samma som F1-låset.
- **Ej verifierbart:** Codex Windows-setup (7 nya F2-databaser) och `secret-scan.json` (566 filer, 0 träffar), som inte har omverifierats. Det finns inga bilder i F2-evidensen.

## 9. Beslut
**Scopad GO, bara för syntetisk lokal drift**, för fixrunda 2/2 av AW-F1-QA-1 vid `05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1`.
- AW-F1-QA-1 är stängd.
- AW-QA-1 och AW-QA-2 förblir stängda.
- Inga nya fynd på Medium-nivå eller högre och inga deadlocks (0 i alla tre PG-loggarna).
- **Ingen GO för:** nativ ChatGPT/PC/iPhone/mobil, verklig kalenderimport, pilot, drift, riktiga data eller main-merge. Native-beteende har inte härletts från testvärdar.
- **Villkor för lokal användning:** admin-/webbwrappern måste köra F2 för att HTTP-skyddet ska gälla.

## 10. Städning
Alla processer och alla tre PG-instanserna stoppades. `/tmp/f2sec`, `/tmp/f2ns`, `/tmp/f2nh` och `/tmp/f2host` raderades.
Raderat i den här körningen: `work/.env`, `work/node_modules`, `work/.next`, `pgdata`, `pgdata-e2e` och `pgdata-http`.
Kvar finns källa, evidens, loggar och prober.
