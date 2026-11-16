# QA-rapport: Agent Workday fixrunda 1 (t77u), frusen `cf6d2d2986303727860fbd3c4c20d119fcb69426`

Datum: 2026-11-13. Körning ungefär 17:10–17:30 (Europe/Stockholm, CET).
Riktad omkontroll av AW-QA-1 och AW-QA-2 från c4e08bd-rapporten (sha256 `325054fd…9596`).
Ingen ny full QA av oförändrad HTML eller av äldre epics.

## 1. Scope och regler
- **Källa:** `code.zip` sha256 `5fdc948b…f87`, `evidence.zip` `7412ce45…77`, `QA-BRIEF` `c0a6123e…6bf6d`. Alla tre är verifierade. Arkivkommentaren i zip är `cf6d2d29…9426`.
- **Egen syntetisk kopia:** `agent-workday-f1-cf6d2d2/run/work`.
  - `.env` utan hemligheter.
  - SESSION_SECRET och profilhemligheter A/B/C (48 hex) låg i `/tmp/f1sec` (0600) och skickades bara via env.
  - Fräsch embedded Postgres med trust och utan root: host på 127.0.0.1:55830, och för E2E en separat instans på 55831 i en isolerad netns.
  - Allt kördes med TZ=Europe/Stockholm och `env -u NODE_ENV`.
  - Playwright/webbruntider kördes sekventiellt i en isolerad netns (`unshare -rn`, användare 1000).
  - Bara `@example.test` användes.
- **Inte rört:** PC, original, preview, GitHub, moln och tokens. Ingen kodändring. Inga `.env`-, secrets- eller operator-private-json-filer lästes.
- **Probe-anpassning (ingen produktkod):**
  - I `mcp-aw.mjs` håller "lock(u)" nu ett exklusivt sessionslås på `demo:configuration` i stället för nyckellåset. Skälet är att cf6d2d2 själv tar nyckellåset i admission, så det gamla greppet stoppade anropet före pending.
  - Det nya greppet håller i stället anropet efter admission, alltså samma tillstånd som i c4e08bd.
  - Testlogiken och påståendena är i övrigt oförändrade.

## 2. Diff mot c4e08bd (Do 1)
`diff -rq` mot den orörda c4e08bd-kopian ger:
- **Kod:** `src/mcp/time-card/recovery.ts`, `src/mcp/time-card/booking.ts`.
- **Test:** `tests/integration/agent-workday.test.ts`.
- **Dokument:** `docs/AGENT_BOOKING_WORKDAY_PLAN.md`, `docs/ARCHITECTURE.md` och nya `docs/qa/QA-REPORT-agent-workday-c4e08bd.md`.
- Inget annat har ändrats. Briefens "3 filer" motsvarar 2 kodfiler och 1 testfil, och det stämmer.

Byte-identiska filer:
- `package.json`, `package-lock.json`, `prisma/schema.prisma`;
- alla 10 migrationer;
- hela `src/lib` (inklusive `createBooking`/`domain.ts`);
- hela `src/app` (HTTP-kontrakt);
- båda kort-HTML-filerna (`time-card/ui.html`, `owner-card/ui.html`).

`qa-code.diff` gäller exakt för c4e08bd-filerna efter CRLF→LF-normalisering. Resultatet är identiskt med cf6d2d2 för alla tre filer.

### Kodgranskning
- **Låsordning i admission (`rememberCardAttempt`):** `pg_advisory_xact_lock(demo:key:time-card_<uuid>)` tas först och därefter `demo:card-attempt:<scope>`. Båda är xact-lås och släpps vid commit, före domäntransaktionen. Explicit maxWait/timeout är 30 s.
- **Låsordning i domänen (`createBooking`), oförändrad:** configuration (shared) → key → client → email.
- **Deadlock:** ingen cykel är möjlig.
  - Admission tar aldrig configuration-, client- eller email-lås.
  - Domänen tar aldrig scope-låset.
  - Båda tar key före allt annat de delar.
  - Admission mot admission har alltid ordningen key→scope.
  - Workspace-skrivningar (configuration exklusivt) och customer-data berör inte key/scope före configuration.
  - Det finns ingen pool-deadlock: en admission-tx som väntar på key väntar bara på en transaktion som redan har en egen anslutning.
  - Empiriskt: 0 "deadlock detected" i båda PG-loggarna.
- **Claim över profiler:** finns en tidigare Booking med nyckeln jämförs dess clientKey med kanalnyckeln. Annars är det äldsta CardBookingAttempt med samma requestId (oavsett scope) som avgör.
  - Vid främmande ägare markeras eget `pending` som `failed` med `updateMany` i samma transaktion, som sedan committas (`return true`).
  - 403 kastas först efter commit. Därmed rullas markeringen inte tillbaka.
- **Efter `createBooking`:** `assertCardBookingChannel(booking.clientKey)` körs innan `finishCardAttempt('saved')` och innan staff-uppslag eller DTO.
  - En främmande replay ger 403. Catch-grenen (status < 500) sätter eget försök till `failed` och kastar vidare.
  - Ett nytt rad-skapande via kortet har alltid kanalens clientKey och påverkas inte.
- **403-kroppar:** fast text "Bokningen kan inte visas med den här demoprofilen." utan id, tider, personal eller kunddata (verifierat i alla probe-fall nedan).

## 3. Egna kommandon (Do 2)

| Steg | Resultat |
|---|---|
| npm ci | PASS (14 s) |
| prisma generate | PASS |
| migrate deploy (10 migrationer) + seed | PASS (10/10) |
| lint (eslint) | PASS |
| tsc --noEmit | PASS |
| unit | PASS **89/89** (18 filer) |
| build | PASS |
| integration | PASS **124/124** (26 filer); efteråt 0 kunder/bokningar/attempts/admins |
| agent-workday Playwright (kort, netns) | PASS **13/13** |
| web E2E prod0 / prod1 / dev0 / dev1 (fräscha DB, netns, sekventiellt) | PASS **46/46 ×4 = 184/184**; efter varje: 0 rader i alla räknade tabeller |
| npm audit full | 7 moderate (dev), 0 high/critical (rc=1 förväntat) |
| npm audit --omit=dev | 0 |

## 4. AW-QA-1 / AW-QA-2 (Do 3)

### Oförändrad repro (`mcp-aw.mjs`): **96/96 PASS** (c4e08bd: 94/96)
- **RACE:** A=OK med eget id. B fick "Bokningen kan inte visas med den här demoprofilen." och gjorde 0 egna attempt-rader. B:s historik är `[]`, och B nekas ICS. Det finns exakt 1 bokning, med A:s clientKey.
- **LOCKOUT:** B som försöker förbruka A:s pending UUID+payload får 403. A:s retry skapar sin bokning, och A:s nya UUID lyckas också. Historiken visar 2× saved med kvitto.
- Övriga positiva regressioner passerar i samma körning:
  - 20 samtidiga anrop med samma UUID över 4 processer ger 1 bokning, 1 create-event och identiska svar;
  - 12 konkurrerande nycklar ger 1 vinnare;
  - ändrad payload ger 409;
  - kvoter: 3/dag per e-post nås före 5/dag per kanal (som tidigare);
  - förlorat svar efter commit följt av retry löses;
  - kill -9 före commit lämnar pending, och retry fungerar;
  - omstartspersistens;
  - ICS bara för egen aktiv bokning;
  - läsprofil med 2 verktyg.

### Ny adversarial probe (`adv-f1.mjs`): **17/17 PASS**
- **50 rundor** med separata MCP-processer och olika hemligheter (A/B), samma UUID+payload och slumpad start (0–25 ms). 13 av rundorna hölls in-flight bakom ett configuration-lås i 150–300 ms.
  - A vann 25 gånger och B 25 gånger.
  - Varje runda gav 1 bokning och 1 event med vinnarens clientKey.
  - Förloraren fick 403 utan bokningsdata, och förlorarens attempt blev `failed` eller saknades.
  - 0 pending blev kvar, och förloraren kunde direkt boka med nytt UUID.
  - Inga dubbletter.
- **Främmande profil medan eget anrop är in-flight:** B fick 403 på 115 ms medan A fortfarande var hållen. B skapade ingen attempt-rad. A fick sedan sin egen bokning. B hade tom historik, nekades ICS och var inte låst.
- **Främmande nyckel förbrukad före retry**, där A:s pending blev kvar efter kill -9:
  - via kort B: B fick 403 (claim), och A:s retry lyckades normalt;
  - via äldre MCP `src/mcp/server.ts --admin --allow-bookings` `create_booking` med annan hemlighet: A:s retry gav 403 utan data, eget pending committades som `failed`, historiken visar bara `{requestId, createdAt, outcome: failed}`, ICS nekades och A:s nya UUID lyckades;
  - via publik HTTP-ekvivalent (`createBooking(input, key, "203.0.113.7")`, samma domänanrop som `/api/bookings`, utan webbserver): samma utfall.
- **Äldre kanal vinner den globala nyckeln i gapet efter A:s admission**, 20 rundor:
  - 10 rundor deterministiskt: A:s nodprocess frystes med SIGSTOP efter committad pending, och legacy C bokade.
  - 10 rundor med probe-hållet nyckellås och båda väntande.
  - Legacy vann 10 gånger. Då gav kortet 403 utan data via post-`createBooking`-kontrollen, eget pending blev `failed`, nytt UUID lyckades, och det fanns 1 bokning och 1 event.
  - Kortet vann 10 gånger. Då fick kortet ett normalt kvitto.
- **Latens:** max race 276 ms, in-flight 393 ms, gap 577 ms, retry 215 ms (n=194). Alla under 10 s.
- **PG-loggar:** 0 "deadlock detected" (host och E2E).

**Slutsats: AW-QA-1 STÄNGD. AW-QA-2 STÄNGD.**

## 5. Nya fynd

- **AW-F1-QA-1 (Low, befintligt domänkontrakt, inte en regression):** omvänd riktning av samma replay-kontrakt.
  - Om en äldre kanal med annan hemlighet (`create_booking` med `clientRequestId: "time-card_<uuid>"`, eller publik HTTP `Idempotency-Key`) skickar kortets exakta UUID+payload efter att kortet redan bokat, returnerar `createBooking` kortets bokning: id/tid till legacy-MCP och `{id}` till HTTP.
  - Det observerades i 10/10 gap-rundor där kortet vann.
  - Kräver kännedom om kortets slumpade UUID och exakt payload. Bara betrodda lokala kanaler.
  - `src/lib` är oförändrad, och kodkommentaren i `booking.ts` säger uttryckligen att domänens replay behåller sitt gamla kontrakt.
  - Inte i AW-QA-1/2-scope. Backlog: överväg en clientKey-kontroll i domänens replay eller att reservera prefixet `time-card_` för kortkanalen.
- **AW-F1-QA-2 (Info, design):** äldre `--allow-bookings` MCP med samma SESSION_SECRET räknas som samma kanal (clientKey = kanalnyckeln). Om den först förbrukar en kortnyckel med samma payload ger kortets retry ett normalt kvitto. Det stämmer med designen "kanal ≠ människa".
- **Probe-fynd (egna, rättade):**
  - `waitFor` saknades i första versionen av den nya proben.
  - Historikkontrollen gav falsk FAIL på grund av regex för UUID/tid. Den ändrades till en fältvitlista.
  - Rollen `qa_owner_ro` saknades i det nya klustret och skapades.

Inget nytt fynd är Medium eller högre.

## 6. Backlog (Do 4, bara observation)
- **Oförändrade:** AW-QA-3 (inaktuell kalendernotis), AW-QA-4 (fokus till BODY), AW-QA-5 (legacy syns först efter retry), AW-QA-6, AW-QA-7 (höst-DST 02:xx), AW-QA-8 och CB-QA-1 (day+35 accepteras fortfarande; omkörningen loggade ACCEPTED).
  - Skälet: HTML och `src/lib` är byte-identiska och inget annat berört har ändrats.
- **AW-QA-9:** se §7.
- **AW-QA-10:** åtgärdad. MANIFEST har nu bild-hashar, se §8.
- **AW-QA-6:** det kvarstår att owner-kortet kräver en oanvänd SESSION_SECRET.
  - Egen omkontroll gav 5/5 med en roll utan Customer/AdminUser/AdminSession/RateLimitBucket och utan `Booking.customerEmail`, men med `customerName`, inklusive en dag med 1 bokning.
  - Regressioner: guard 87/87, owner 48/48, owner-role 5/5.

## 7. Granskning av lokal config-design (Do 5, beskriven, ej testad)
De angivna villkoren är rimliga och stämmer med koden.
- **Egen lång owner-hemlighet:** behövs, eftersom kanalnyckeln är HMAC av SESSION_SECRET. Den får inte delas med boknings-MCP eller kort, se AW-F1-QA-2.
- **Overwrite + vitlistad env:** rätt. Kortserverns env bör bara innehålla de nödvändiga variablerna.
- **Läsroll:** en roll utan Customer/AdminUser/AdminSession och utan `Booking.customerEmail`, men med `customerName`, räcker för `show_workday` (verifierat 5/5).
  - Rekommendation: ge den rollen bara SELECT, inte CardBookingAttempt-skrivning.
  - Owner-kortet ska inte dela DB-roll med bokningskortet.
- **Legacy-kvitton bara via explicit retry efter kontroll av clientKey+requestHash, utan rå INSERT:** stämmer med cf6d2d2. Retry går genom admission och sedan `createBooking`, där replay kräver samma requestHash, och post-kontrollen kräver kanalens clientKey.
- **Booking/events hash-identiska:** probarna jämför md5 per tabell. Inga oväntade skrivningar.
- **Origin 3187:**
  - `ownerOrigin` har default `http://localhost:3187`.
  - Den accepterar bara `http:` och värdarna localhost, 127.0.0.1 och [::1], med valfri port. Användaruppgifter, sökväg (annat än /), query och hash avvisas.
  - En tom sträng ger en URL-parse-exception, alltså fail closed.
  - En explicit 3187 för den riktiga skyddade admin är alltså korrekt och lika med default. 3197 används bara av Playwright via env.
  - Kvarstående risk (Info): varje lokal port accepteras. Felkonfiguration till fel lokal tjänst stoppas inte av koden, så det får dokumenteras i drift.

## 8. Codex-underlag (granskat, ej eget)
- **Bekräftat:**
  - kod-diffen motsvarar exakt `qa-code.diff`;
  - 89 unit och 124 integration (egen körning ger samma tal);
  - 13 kort-PW (egen 13/13);
  - audit 7 moderate dev / 0 prod (egen identisk);
  - inga beroende-, schema-, migrations-, domän-, HTML- eller HTTP-ändringar.
- **MANIFEST:** 4 bilder med sha256. Alla 4 matchar exakt (`owner-390`, `reopen-390`, `lost-before`, `lost-after`).
  - `webMatrix: "Running, not assumed PASS"`. Webbmatrisen 46×4 är därför obekräftad från Codex, men egen körning ger 184/184.
  - `source` anger uttryckligen en testvärd, inte ChatGPT eller iPhone.
- **Inte verifierbart:** Codex Windows-miljö (setup-results med Windows-sökvägar) och bildinnehållet bortom hash. `secret-scan.json` anger 562 filer och 0 träffar och har inte omverifierats.

## 9. Beslut
**Scopad GO, bara för syntetisk lokal drift**, för fixrunda 1 av AW-QA-1/AW-QA-2 vid `cf6d2d2`.
- Båda fynden är stängda med deterministiska och randomiserade bevis.
- Inga nya fynd är Medium eller högre, och det finns inga deadlocks.
- Ingen FIX-REQUEST behövs.
- **Ingen GO för:** nativ ChatGPT/PC/iPhone, pilot, drift, riktiga data, main-merge eller publicering. Native-beteende får inte härledas från testvärden.

## 10. Städning
Alla processer och båda PG-instanserna stoppades. `/tmp/f1sec`, `/tmp/f1ns` och `/tmp/f1host` raderades.
Raderat i den här körningen: `work/.env`, `work/node_modules`, `work/.next`, `pgdata` och `pgdata-e2e`.
Kvar finns källa, evidence, loggar och prober.
