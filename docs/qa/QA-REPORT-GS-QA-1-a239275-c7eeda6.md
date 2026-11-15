# QA-rapport: riktad återkontroll av GS-QA-1 (gateway a239275 + salong c7eeda6)

Datum: 2026-11-15, körning 20:36–20:51 (CET, UTC+1). Utförd av Grok Bot (executor). Endast syntetisk lokal miljö. Ingen pilotbedömning.

## 1. Omfattning

| Del | Värde |
|---|---|
| gateway.bundle | sha256 66e7d057acff29f7785ea7d60f673d7254bba4ab6cd81065785ef64ab3ed31ec, 2085 B, git bundle verify OK |
| salon.bundle | sha256 780241ba46f28c85a437e2ff23a398565b6a6f820265e5ad1429fa9267d02052, 3712 B, git bundle verify OK |
| Gateway HEAD | a2392754df0c28df300e38a44a514e57087075a5 (bas 8a018b6), 5 filer, +31/−13 |
| Salong HEAD | c7eeda6f9a1d32e67866082b941dffb2ea5e621f (bas f94bab3), 7 filer, +74/−4 |
| Gren | refs/heads/fix/gateway-service-auth, detached checkout, git status rent före och efter |
| Körmapp | /workspace/qa/booking-lab-se/gs1-fix-a239275-c7eeda6/ (logs/, probes/, shots/, ns.sh) |

Inga ändringar i källkod, tester eller beroenden. Inga commits, push, PR, deploy eller GitHub-skrivningar. Ingen .env lästes. Syntetisk agentnyckel, tjänstenyckel (64 hex) och SESSION_SECRET fanns bara i processmiljön och i en tmp-katalog med mode 700, som raderats. Sökning efter de tre värdena i alla loggar, prober och skärmbilder gav 0 träffar. Endast data på @example.test användes.

## 2. Diffgranskning (kod)

- Tjänsteidentitet: headern x-booking-gateway-token.
  - Gatewayen sätter den med forward.set på varje leverantörsanrop (gateway/src/provider.js:38).
  - Headers-objektet byggs nytt och tar bara med authorization, x-api-key och idempotency-key. En inkommande spoofad header kan alltså inte passera.
  - Gatewayen vägrar starta om GATEWAY_SERVICE_TOKEN inte matchar /^[a-f0-9]{64}$/ (provider.js:22–23).
- Salongen kontrollerar i agentRouteInternal (src/lib/agent-api/v1.ts:115–125), före agentautentisering, rate limit och audit:
  - om BOOKING_SERVICE_ROLE=salon krävs att både konfigurerat och presenterat värde är 64 gemena hex;
  - jämförelsen görs med timingSafeEqual, som är konstanttid eftersom längden redan är låst av regexen;
  - annars blir svaret 401 unauthorized.
- Kontrollen gäller alla REST v1-rutter som går via agentRoute: access, services, availability, bookings (create/get/cancel) och proposals (create/get).
  - Den gäller inte /api/v1/mcp (404 i split-läge), mcp/schema (404), openapi, /.well-known/usp eller /api/v1/live. Detta är dokumenterat.
  - Split kombinerat med PUBLIC_READONLY ger 403.
- Rollvalidering vid start (scripts/client-address.mjs:8–11):
  - startar om BOOKING_SERVICE_ROLE eller GATEWAY_SERVICE_TOKEN är satt (även tomma) och rollen inte är exakt "salon", om token inte är 64 gemena hex, eller om PUBLIC_READONLY=1 också är satt, så kastas BOOKING_RUNTIME_CONFIG_INVALID;
  - körs både i scripts/server.mjs och i Next instrumentation-hooken.
- client-address.mjs: ändringen rör bara split-validering. Ingen ny tillit till X-Forwarded-For. Befintligt test kräver fortfarande att forwarding-fallbacks avvisas.
- Utan någon av inställningarna gäller det äldre samlade läget, oförändrat.

## 3. GS-QA-1: STÄNGD (för syntetisk lokal split-konfiguration)

Belägg:
- En giltig agentnyckel direkt mot salongen gav 401 på 5 läsningar och 3 skrivningar, både utan tjänstenyckel och med fel, felformaterad, versal eller tom tjänstenyckel (5 × 8 = 40 anrop, alla 401). Probe-raderna X1 och S5.
- Bokningsantalet var oförändrat (3 → 3, AgentBooking 3 → 3). Bokningen förblev confirmed trots direkta cancel-försök (X2, X4).
- Det mandat som användes i det nekade direktanropet förblev oförbrukat och gav sedan 201 via gatewayen (X9).
- Tjänstenyckel ensam, med ogiltig agentnyckel eller med återkallad (roterad) agentnyckel gav 401 (X5, X6, X10).
- Repots eget agent:proof gav PASS på DIRECT_PROVIDER_CALLS_WITH_VALID_AGENT_KEY_DENIED.

Kvarstående förbehåll, inte blockerare: skyddet gäller bara när salongen faktiskt startas i split-läge. Om salongen saknar båda inställningarna öppnas den direkt utan larm. Se GS1-QA-3.

## 4. Resultattabell

| # | Kontroll | Status | Utfall | Observation |
|---|---|---|---|---|
| 1 | Bundle-SHA, bundle verify, HEAD | VERIFIED | PASS | stämmer exakt |
| 2 | npm ci (båda, låsfiler) | VERIFIED | PASS | rc 0. npm 11.21 varnar för att install-scripts (prisma, @prisma/engines, esbuild) inte täcks av allowScripts. prisma generate kördes separat. |
| 3 | Gateway npm test | VERIFIED | PASS | 8/8 |
| 4 | Salong lint / tsc / build | VERIFIED | PASS | rc 0 / 0 / 0 |
| 5 | Salong unit | VERIFIED | FAIL | 391/392. tests/agent-api.test.ts:176. Flaky assertion, se GS1-QA-1. Kördes inte om. |
| 6 | Salong integration (färsk g1_int_test) | VERIFIED | FAIL | 204/205. tests/integration/agent-api.test.ts:29. Samma orsak. Kördes inte om. |
| 7 | (a) giltig agentnyckel direkt, ingen tjänstenyckel, läs + skriv | VERIFIED | PASS | 8/8 svarade 401, 0 DB-effekter, auditdelta 0 |
| 8 | (b) fel/felformaterad/versal/tom tjänstenyckel, läs + skriv | VERIFIED | PASS | 32/32 svarade 401 |
| 9 | (c) tjänstenyckel utan agentnyckel | VERIFIED | PASS | 8/8 svarade 401 |
| 10 | (d) tjänstenyckel + ogiltig / återkallad agentnyckel | VERIFIED | PASS | 8/8 och 2/2 svarade 401 |
| 11 | Positiv kontroll: rätt tjänstenyckel + giltig agentnyckel direkt | VERIFIED | PASS (info) | 200. Tjänstenyckeln är alltså gatewayens enda bevis. |
| 12 | (e) spoofad header via gateway | VERIFIED | PASS | Fel spoofvärde via rätt gateway gav 200, alltså överskrivet. Rätt salongsnyckel spoofad via gateway med felmatchad nyckel gav 401 på services, booking get och MCP init, alltså strippad. |
| 13 | (f) salong split: token osatt / tom / 63 tecken / versal | VERIFIED | PASS | startar inte, BOOKING_SERVER_CONFIG_FAILED, ingen lyssnare |
| 14 | (f) roll saloon / tom / SALON / bara token / split + PUBLIC_READONLY | VERIFIED | PASS | startar inte, ingen lyssnare |
| 15 | (f) giltig split-konfiguration | VERIFIED | PASS | BOOKING_SERVER_READY |
| 16 | (f) gateway: token osatt / tom / 63 tecken / versal | VERIFIED | PASS | kastar vid start, ingen lyssnare, värdet syns inte i loggen |
| 17 | (f) gateway med felmatchad men välformad token | VERIFIED | PASS | 401 från salongen |
| 18 | (f) icke-split oförändrat | VERIFIED | PASS | direkt services 200, access 200, MCP init 200, schema 200 |
| 19 | (f) next start förbi wrappern med role=salon utan token | VERIFIED | PASS (info) | lyssnaren öppnas men alla rutter ger 500 (instrumentation kastar), fail-closed. Se GS1-QA-5. |
| 20 | (g) salong-MCP i split | VERIFIED | PASS | GET, POST och DELETE /api/v1/mcp samt schema gav 404 |
| 21 | Ägarskap: främmande klient läser/avbokar | VERIFIED | PASS | F1–F4: 404 booking_not_found och mandate_denied |
| 22 | Mandat saknas / vidgas / fel slot / pristak | VERIFIED | PASS | D1–D6 |
| 23 | Idempotens: retry ger samma id, annan body ger konflikt | VERIFIED | PASS | M3/M4, R2/R3, K5 |
| 24 | Krock: 6 samtidiga försök (3 REST, 3 MCP) | VERIFIED | PASS | exakt 1 vinnare, 5 slot_unavailable, DB 1 |
| 25 | agent:proof (gateway + salong-URL) | VERIFIED | PASS | 10 unika PASS-rader enligt docs |
| 26 | Riktig HTTP-MCP SDK (@modelcontextprotocol/client 2.4.0) bokar via gateway | VERIFIED | PASS | id 2332fad0-e93b-4708-a09e-29c0b97eb0fc |
| 27 | Inloggad Chromium (Playwright 1.65 headless) klickar kalender till samma id | VERIFIED | PASS | Klickad post vald på synlig kundtext. URL-id === MCP-id, båda med sha256 f10090fabb5aa5c840e7d351eb3fd8a61a026548c055bab1277b7e236b4cdd04. |
| 28 | Gatewayens miljö | VERIFIED | PASS | GATEWAY_SERVICE_TOKEN HOME NODE_USE_SYSTEM_CA PATH PORT PWD SALON_ORIGIN, ingen DATABASE_URL eller SESSION_SECRET |
| 29 | Hemlighetsläckage i loggar/rapport | VERIFIED | PASS | 0 träffar |
| 30 | Städning av egna syntetiska rader | VERIFIED | PASS | slut: booking=0, customer=0, admin=0, akey=0. audit=165 (append-only, kvar i den raderade test-DB:n). |

Skärmbilder i shots/:
- 01-login.png, sha256 7b7c6766…
- 02-calendar.png, sha256 ebb98444…
- 03-booking-detail.png, sha256 dfc9a2c6…

## 5. Nya fynd

Inga blockerare.

Backlog:

- GS1-QA-1, Low (testflakighet).
  - Var: tests/agent-api.test.ts:176 och tests/integration/agent-api.test.ts:29.
  - Fel: assertionen använder key.split("_").at(-1) som "hemlighet". Base64url-hemligheten (43 tecken) kan själv innehålla "_". Sannolikheten är cirka 1 − (63/64)^43 ≈ 49 % per nyckel.
  - Då blir sista segmentet kort ("o" respektive "k" i denna körning), och det förekommer trivialt i loggen eller raden.
  - Repro: observerat i den första och enda gate-körningen. Ägaren reproducerade dessutom separat med en giltig 43-teckens hemlighet som slutar på "_o" (extern reproduktion, ej körd av mig).
  - Konsekvens: röda grindar ungefär varannan körning, utan säkerhetsfel. Diffen rör inte dessa filer.
  - Minimal fix: extrahera hemligheten med KEY_PATTERN (grupp 2) eller key.slice("blk_".length + 13).
- GS1-QA-2, Low.
  - Var: src/lib/agent-api/v1.ts:119–121.
  - Fel: anrop som nekas av tjänsteidentitetskontrollen returnerar före recordAudit och loggas inte. Uppmätt auditdelta 0 för 40 nekade direktanrop.
  - Konsekvens: försök att gå förbi gatewayen med stulna agentnycklar syns inte för operatören.
  - Minimal fix: en audit- eller loggrad (t.ex. agent.request/gateway_unauthorized) utan nyckelmaterial, gärna med rate limit.
- GS1-QA-3, Low.
  - Fel: konfigurationsdrift ger öppet läge. Om salongen startas utan båda split-inställningarna (äldre läge) skickar gatewayen sin token som vanligt, och salongen ignorerar den.
  - Repro: direct-nonsplit gav services 200 och MCP 200 direkt med agentnyckel, med och utan token-header. Gatewayen märker ingenting.
  - Konsekvens: GS-QA-1 återuppstår tyst vid en felkonfigurerad omstart.
  - Minimal fix: salongen anger sin roll eller split-status i /api/v1/access, och gatewayen vägrar betjäna (503) om leverantören inte bekräftar split.
- GS1-QA-4, Info.
  - Var: scripts/server.mjs:63–65.
  - Fel: wrappern skriver bara BOOKING_SERVER_CONFIG_FAILED, utan felkod.
  - Fix: skriv ut felkoden (BOOKING_RUNTIME_CONFIG_INVALID) utan värden.
- GS1-QA-5, Info.
  - Fel: next start direkt, förbi wrappern, med ogiltig split-konfiguration öppnar en lyssnare som ger 500 på allt i stället för att avslutas. Det är fail-closed men inte fail-fast.
  - Docs anger npm start, så detta är ingen avvikelse.
- GS1-QA-6, Info.
  - Fel: tjänsteidentiteten är en statisk delad bearer utan bindning till begäran (ingen HMAC eller mTLS). Läckt token plus agentnyckel räcker för direktåtkomst (rad 11).
  - Acceptabelt för loopback. README och docs kräver TLS vid fjärrdrift.

Tidigare GS-QA-2 till GS-QA-11 omprövades inte (utanför avgränsningen).

## 6. Påståenden i Codex/docs

| Påstående | Status | Belägg |
|---|---|---|
| I split ger operativa REST-anrop utan tjänsteidentitet 401 även med giltig agentnyckel | CONFIRMED | X1, S5 |
| Servern stoppar vid start vid felstavad roll | CONFIRMED | saloon, tom, SALON |
| Stoppar om bara en av två inställningar finns | CONFIRMED | token-unset, token-only |
| Stoppar om split och publik skrivskyddad vy kombineras | CONFIRMED | split-plus-readonly |
| Utan båda inställningarna gäller äldre samlat läge | CONFIRMED | direct-nonsplit 200 |
| Skyddet gäller bokningsoperationer och accesskontroll, medan discovery, OpenAPI och demo har egna regler | CONFIRMED | access 401 direkt; openapi, usp och live 200 |
| Agentklienter och provkoordinator behöver bara ordinarie behörigheter | CONFIRMED | agent:proof kördes utan GATEWAY_SERVICE_TOKEN |
| Förvänta tio PASS-rader | CONFIRMED | 10 unika |
| Gateway vägrar starta utan giltig token (README, test) | CONFIRMED | 4 fall |
| Klientens header skrivs över och ekas inte (gateway-test) | CONFIRMED | rad 12 |
| Konstanttidsjämförelse | CONFIRMED (kod) | timingSafeEqual på lika långa buffrar. Tidsmätning ej gjord. |
| Rotation: byt värde och starta om båda | UNVERIFIABLE | Rotation av tjänstenyckeln kördes inte. Att en felmatchad nyckel ger 401 är verifierat. |
| TLS vid framtida fjärranslutning | UNVERIFIABLE | inte kört |

## 7. NOT RUN

- Docker och docker-compose.
- Vercel och preview-deploy.
- ChatGPT eller annan riktig assistent.
- Fjärrdrift med TLS.
- Rotation av tjänstenyckeln.
- Tidsmätning (timing attack).
- Omkörning av de röda unit- och integrationstesterna (avsiktligt).
- Omprövning av GS-QA-2 till GS-QA-11.
- Betaltjänster.

## 8. Körning och kommandon

All körning skedde i ett isolerat nät- och user-namespace som icke-root:
env -u NODE_ENV PHASE=gates|live unshare -rn sh -c 'ip link set lo up && exec unshare --user --map-user=1000 --map-group=1000 ./ns.sh'

- Miljö: TZ=Europe/Stockholm. Inbäddad Postgres (/workspace/qa/pg-tool) på 127.0.0.1:56353. Databaser g1_gate_test, g1_int_test och g1_run_test.
- gates:
  - gateway: npm test;
  - salong: npx prisma generate, npm run db:migrate, npm run db:seed, npm run lint, npx tsc --noEmit, npm test (RATE_LIMIT_STORE=memory), npm run build;
  - färsk DB, sedan npm run test:integration (RATE_LIMIT_STORE=postgres).
- live:
  - salongens konfigurationsmatris med npm start på 3221;
  - icke-split på 3219;
  - next start förbi wrappern på 3220;
  - split-salong på 3217 (BOOKING_SERVICE_ROLE=salon, GATEWAY_SERVICE_TOKEN=REDACTED, BOOKING_PUBLIC_ORIGIN);
  - gatewayens konfigurationsmatris på 3222;
  - felmatchad gateway på 3223;
  - gateway på 3218 via env -i (PATH, HOME, SALON_ORIGIN, PORT, GATEWAY_SERVICE_TOKEN=REDACTED);
  - npm run agent:proof med AGENTPROV_BASE_URL=:3218 och AGENTPROV_SALON_URL=:3217;
  - probes/split-probe.mts (63 kontroller) och probes/direct-probe.mts, körda med node --import tsx.
- Den första live-körningen (20:38) avbröts på grund av en bugg i min egen harness: en bakgrundsstart höll command substitution-pipen. Inga resultat räknades.
  - Den startades om som en komplett live-fas 20:50 i samma körmapp och samma netns-upplägg, men på en nyinitierad Postgres och en ny g1_run_test.
  - Loggarna från avbrottet finns i logs/aborted-live1.
- Fullständiga kommandon står i logs/commands.log (token-värden redigerade).
- Städat:
  - egna servrar stoppades per processgrupp, aldrig med pkill;
  - Postgres 56353 stoppades (även 544140 från den avbrutna körningen);
  - node_modules, .next, pgdata, /tmp/g1ns och /tmp/g1sec (shred) raderades.
  - Andra processer rördes inte (55433, 55434).

## 9. Avgränsad slutsats

Endast för syntetisk lokal miljö: GS-QA-1 är STÄNGD. I korrekt split-konfiguration når en giltig agentnyckel inte salongens REST v1 utan gatewayens tjänsteidentitet, varken för läsning eller ändring. Felaktig konfiguration stoppar båda processerna vid start. Ägarskap, mandat, idempotens, krockskydd och den positiva vägen (SDK, gateway, salongskalender i Chromium, samma id) håller.

Grindarna är inte helt gröna på grund av ett förbefintligt flakigt test (GS1-QA-1). Inga blockerare. Backlog: GS1-QA-1 till 3 (Low) och GS1-QA-4 till 6 (Info). Ingen pilot- eller produktionsbedömning görs här. FIX-REQUEST skrivs inte eftersom GS-QA-1 är stängd.
