# Natt-QA: gateway f9b8506 + salong 0a88ac2 (fixvarv 1)

Datum 2026-11-16, körning 01:33–01:35 CET. Grok Bot (executor). Endast syntetisk lokal miljö. Ingen pilotbedömning.

## Omfattning (VERIFIED)

Bundles:
- gateway.bundle: 2867 B, sha256 2170a0e96492fab7e4be7028ffa992cf8d8483d7ba84b6bc17e2ffd2a447e219. git bundle verify okay; den kräver e1830fe.
- salon.bundle: 13459 B, sha256 1fd1ae8d72e2d703fdac11f9307351365044f24dcff66553d22beedb926accee. git bundle verify okay; den kräver 97609a8.

Privat main hämtades läsande till egna kopior under körmappen. Push-URL är avstängd.
- Gatewayens main = e1830fee14484a84aedb5806898725b9965ac1ba (= basen).
- Salongens main = 97609a8e070d63cf16bfef681b29772532205424 (= basen).

Exakta HEAD (detached):
- Gateway f9b8506cee3e3cd21bd279e01addf761cd3db1ed: ab07b6c (produkt) plus f9b8506 (endast README, +14/−6). Totalt 4 filer, +108/−46.
- Salong 0a88ac27482aef377ecce86892b5bfbb897cc181: 13 filer, +529/−6.
  - Inga ändringar i package-lock.json, prisma/ eller migrationer.
  - package.json fick bara skriptet test:pair.

Inga .env-filer finns i kopiorna. Det enda som finns är salon/.env.example, som inte lästes. Git status var rent i båda kopiorna efter körningen.

## Grindar (VERIFIED, första och enda körningen)

| Grind | Utfall |
|---|---|
| Gateway npm test / build | 12/12 PASS / rc 0 |
| Salong unit | 402/402 PASS (42 filer) |
| Salong integration (färsk night_int_test, samma netns) | 205/205 PASS |
| Salong lint / tsc / build | rc 0 / 0 / 0 |
| npm audit --omit=dev (salong) | 0 sårbarheter |
| npm audit (salong) | 7 moderate, alla i dev (typescript-eslint-kedjan via minimatch). Inga overrides. |
| npm audit (gateway) | 0 |

## npm run test:pair (VERIFIED)

Utfall: rc 0, 19 PASS-rader. Det är 10 från agent:proof plus 9 grupper. Raden "PAIR salon=0a88ac2… gateway=f9b8506… dirty=false" skrevs ut. integration-pair.json gav passed=true och innehåller inga nycklar.

Egen kontroll, inte bara skriptets påstående:
- **Runner och proxy ligger utanför produktkoden** (scripts/integration/run.mts:107–138, endast i testscriptet).
  - Komprimeringsfixen syns på rad 131–133: proxyn tar bort content-encoding, content-length och transfer-encoding. Det är en ren testproxy-ändring, ingen produktändring.
  - Städning:
    - inga kvarvarande processer med cwd i körmappen, utom min egen Postgres;
    - endast Postgres lyssnade efter körningen;
    - SQL efter körningen: Booking, BookingEvent, AgentBooking, mandat, nycklar, klienter, Customer, AdminUser och AdminSession är alla 0;
    - AgentAuditEvent har 137 rader (append-only, förväntat);
    - inga nya temporära hemlighetsfiler i /tmp, bara tsx-cache.
- **Hemligheter:**
  - Gatewayens miljö (/proc) innehöll GATEWAY_SERVICE_TOKEN, HOME, NODE_ENV, PATH, PORT och SALON_ORIGIN; ingen DATABASE_URL och ingen SESSION_SECRET.
  - Runnerns token är 64 hex och skiljer sig från min. Salongens SESSION_SECRET är runner-genererad.
  - Grep efter runnerns två värden och mina två i alla loggar, pg.log och resultatfilen gav 0 träffar.
- **Korskontroll mot salongens audit och SQL:**
  - POST bookings 201 = 6 och booking.created = 6: tre bokningar från agent:proof och tre från runnern (tappat svar, återhämtning efter omstart, krockvinnare). Retryn efter det tappade 201-svaret gav ingen extra skapad bokning (200-replay = 4).
  - slot_unavailable = 20, vilket motsvarar 19 i krocktestet plus 1 kontrollerad krock i agent:proof. Det stämmer med 1×201 + 19×409.
  - Främmande klient: booking_not_found på get (3) och cancel (1).
  - Återkallad nyckel: unauthorized på /access.
  - Omstart till standalone: inget extra 201 och ingen booking.created. Avvisningen loggas inte i audit, eftersom kontrollen sker före audit.
  - SQL-noll-överlapp kunde jag inte göra själv efter städningen, så den bygger på skriptets egen kontroll (run.mts:212–217). Antalet created stämmer.
- **Kalender-id:** SEPARATE_SALON_AUTHENTICATED_CALENDAR gav PASS. En egen jämförelse av id och sha256 gjordes inte i den här körningen (UNVERIFIABLE oberoende, se NOT RUN).

## GS3-QA-1..4 (VERIFIED: kod + egna prober)

| ID | Status | Belägg |
|---|---|---|
| GS3-QA-1 consent-lab | STÄNGD | customer-identity.ts:13–17 kontrollerar flaggan före discoveryOrigin(), och ett origin-fel blir 403. Prob: standalone med NODE_ENV=production utan BOOKING_PUBLIC_ORIGIN gav POST proposals 403 mandate_denied, även med tom body. Ingen intern- eller origin-felrad i salongens logg. Via gateway bevaras 403. |
| GS3-QA-2 5xx-sanering | STÄNGD | provider.js:48–49 mappar alla upstream ≥500 till statiskt 503 provider_unavailable. Stub: access 500/502/503/500-html och operation 500/502/503 gav alla 503 provider_unavailable, utan markör i body eller headers (28/28 stubvarianter PASS). 409 och 401/403 passerar oförändrat. |
| GS3-QA-3 access-delning och budget | STÄNGD | provider.js:26–29 och 58 samt server.js:47 skapar en ny closure per inkommande request. Prob mot riktig salong: REST GET services gav access + operation = 2 budgetposter. MCP tools/list gav 1 access. tools/call list_services gav 1 access + 1 operation. Ett andra separat MCP-anrop gav en ny access, alltså ingen återanvändning mellan requests. |
| GS3-QA-4 standalone avvisar gatewayheader | STÄNGD | v1.ts:117–119. Prob: standalone med x-booking-gateway-token gav services, create och cancel (även skräpvärde) 503 provider_configuration_invalid, utan bokning. /access svarar fortfarande 200 standalone, så gatewayen nekar. Utan header är legacy oförändrat öppet, enligt design. Runnerns omstartsfall gav PASS. |

Egna prober: stubprov 28/28 PASS och night-probe 15/16. Den enda FAIL-raden (Q3e) var fel förväntan i min probe. create_booking ger också domänrader i audit (booking.created och mandate.consumed, utan route). De anrop som räknas mot budgeten är access plus POST, alltså 2. Ingen produktavvikelse.

## CI (statisk granskning, inget kört i CI)

| Påstående | Status |
|---|---|
| workflow_dispatch har tre inputs: gateway_revision, gateway_bundle_hash, gateway_bundle (base64 committad källa) | CONFIRMED (verify.yml:11–24) |
| unpack verifierar format, pin = pair.json, sha256, git bundle verify och detached checkout i separat tmp-katalog, och avvisar vid avvikelse | CONFIRMED (unpack-gateway.mjs) + unit-testet pair-source (6 avvisningsfall) |
| Manuell körning kör pair plus den oförändrade 4-matrisen | CONFIRMED (pair-jobb verify.yml:31–74; verify-jobbet oförändrat, 4 rader vid workflow_dispatch) |
| Inga cross-repo-secrets, ingen automatisk hämtning per push, permissions contents: read oförändrat, persist-credentials: false | CONFIRMED (ingen secrets.-referens i diffen) |
| Inga nya beroenden, migrationer eller behörigheter | CONFIRMED |
| 7 moderate dev-fynd, inga overrides | CONFIRMED (npm audit) |

## Påståenden (Codex och docs)

| Påstående | Status |
|---|---|
| Gateway 12/12 + build | CONFIRMED |
| Salong 402 unit, 205 integration, lint/tsc/build | CONFIRMED |
| test:pair 19 PASS mot ny DB, dirty=false | CONFIRMED |
| Runnern genererar egna hemligheter; gatewayen får ingen DB-adress eller sessionshemlighet | CONFIRMED (/proc) |
| Tappat 201 ger retry 200 med samma id och 1 rad | CONFIRMED (audit), radantalet enligt skriptet |
| Omstart split→standalone mellan access och skrivning ger 503 och ingen rad, sedan återhämtning | CONFIRMED (audit + egen prob Q4) |
| 20 samtidiga ger 1×201 + 19×409 och 0 SQL-överlapp | CONFIRMED (antal); överlappet UNVERIFIABLE oberoende |
| Främmande klient 404, återkallad nyckel 401, providerfel sanerade, driftavbrott 503 + återhämtning | CONFIRMED |
| Kalender-id = MCP-id i inloggad Chromium | UNVERIFIABLE oberoende (skriptets PASS, ingen egen jämförelse av id och sha256) |
| Första felet var proxyns komprimeringsheaders, rättat utan produktändring | CONFIRMED (run.mts:131–133); själva det tidigare felet UNVERIFIABLE |
| Codex slutliga rena körning på 0a88ac2/f9b8506 PASS (npm ci, generate/migrate/seed, 402, 205, lint/tsc/build, test:pair 19, dirty=false i båda) | UNVERIFIABLE (Codex egen uppgift, hålls skild från min verifiering ovan) |

## Konkreta fel

Inga blockerare.

- NIGHT-QA-1, Info.
  - Var: scripts/integration/dispatch.mjs:16–27.
  - Fel: den temporära katalogen med gateway.bundle och request.json raderas inte efter dispatch.
  - Repro: kodläsning. Skriptet kördes inte, eftersom det gör en GitHub-skrivning.
  - Konsekvens: privat källkods-bundle blir kvar i operatörens tmp. Inga nycklar.
  - Minimal fix: rmSync(temp, { recursive: true }) i finally.

## NOT RUN

- CI-körning och dispatch.mjs (GitHub-skrivning).
- Docker.
- Vercel och deploy.
- ChatGPT eller riktig assistent.
- Full E2E och 4-matrisen lokalt.
- Egen jämförelse av kalender-id och sha256 i Chromium.
- Eget SQL-överlapp efter testpar (rader städade).
- Hängande provider i stubprovet (oförändrad kod, tidigare verifierad).

## Körning och avvikelser i harness

En sekventiell körning:
env -u NODE_ENV unshare -rn sh -c 'ip link set lo up && exec unshare --user --map-user=1000 --map-group=1000 ./ns.sh'

- Miljö: icke-root, TZ=Europe/Stockholm, inbäddad Postgres på 127.0.0.1:56355.
- Databaser: night_gate_test, night_int_test, night_pair_test (log_statement=mod) och night_probe_test.
- Gateway startad med setsid och env -i. GATEWAY_PATH pekade på den egna kopian.
- Kommandon:
  - npm ci (båda);
  - npx playwright install chromium (cache);
  - npm test och npm run build (gateway);
  - npx prisma generate, migrate, seed, npm test, lint, tsc --noEmit, build och test:integration (salong);
  - npm run test:pair;
  - node probes/stub-probe.mjs;
  - node --import tsx qa-probe/night-probe.mts.
- Efteråt startade jag Postgres en gång för läsande audit-SQL (pg-posthoc.log). Datumfiltret i harnessens egen audit-fråga gav tomt resultat på grund av tidszonsjämförelsen.
- Harness-miss, rättad: logs/commands.log innehöll mitt eget syntetiska SESSION_SECRET i klartext på test-pair-raden. Det är redigerat till REDACTED. Grep efter alla fyra syntetiska värden (mina och runnerns) i logs/, probes/, ns.sh och resultatfilen gav 0 träffar, därefter raderades de med shred.
- Ofarligt: meddelandet "ns.sh line 38: /proc/<pid>/cmdline: No such file or directory" i run.out kom från min env-watcher, när kortlivade processer hann avslutas mellan listning och läsning.
- Städat:
  - egna processer och Postgres är stoppade;
  - node_modules, .next, pgdata och tmp-kataloger är raderade;
  - git status är rent;
  - Postgres 55433 och 55434 samt andra agenters scripts/server.mjs rördes inte (127.0.0.1:3231 tillhör en annan agents dev-server).

## Avgränsad slutsats

GO enbart för syntetisk lokal användning. GS3-QA-1..4 är stängda. Grindar och test:pair är gröna i min körning. Inga blockerare; 1 Info. Ingen pilot- eller produktionsbedömning görs.
