# QA-rapport: riktad återkontroll av GS1-QA-3 (gateway b37d414 + salong 09f0a0d), fixvarv 1

Datum: 2026-11-15, körning 23:21–23:22 (CET, UTC+1). Utförd av Grok Bot (executor). Endast syntetisk lokal miljö. Ingen pilotbedömning.

## 1. Omfattning

| Del | Värde |
|---|---|
| gateway.bundle | sha256 b35eddafafbf390552a78b3f56d07ca79b69d27f35f489081e1ea348a4fa77f0, 2795 B, git bundle verify "is okay" |
| salon.bundle | sha256 dbed862d73d66ffb2836536c3b1ba393b2e9e6371480102a62741052faab6cec, 4056 B, git bundle verify "is okay" |
| Salongsbas | 33114eb419e98de9d65f06b7302a0560cdac4380, hämtad läsande av föräldern (git fetch origin fix/gateway-service-auth). Commits ovanpå c7eeda6: 587d84a, ff40e43, 4162ec9, 104ad3a, 33114eb. Bekräftat av mig med git log. |
| Gateway HEAD | b37d414462320b608e3618f2e3bd274619b6cd3f (bas a2392754), 4 filer, +95/−15: README.md, src/provider.js, src/server.js, test/gateway.test.js |
| Salong HEAD | 09f0a0d5f66a4948d0c88b17bf88bdd39046d4c3 (bas 33114eb), 4 filer, +122/−2: docs/GATEWAY_SPLIT.md, scripts/agentprov/check-provider-mode.mts (ny), src/app/api/v1/access/route.ts, tests/agent-api.test.ts |
| Körmapp | /workspace/qa/booking-lab-se/gs1qa3-b37d414-09f0a0d/ (logs/, probes/, shots/, ns.sh) |

Basens CI-status är UNVERIFIABLE. Den inspekterades inte och granskades inte om, enligt instruktion. Det gäller 64 E2E, 392 unit, 205 integration och lint/tsc/build på 104ad3a i CI-körning 43765483845.

Inga ändringar i källkod, tester eller beroenden. Inga commits, push, PR, deploy, CI- eller GitHub-skrivningar. Ingen .env lästes. Tre syntetiska värden användes: tjänstenyckel, fel tjänstenyckel och SESSION_SECRET. De fanns bara i processmiljön och i en tmp-katalog med mode 700, som raderats med shred. Grep efter dem i alla loggar, prober och skärmbilder gav 0 träffar. Agentnycklarna skapades och raderades i proberna och skrevs aldrig ut. Endast data på @example.test användes.

## 2. Diffgranskning

- **Var förkontrollen sker:** i connectProvider (gateway/src/provider.js:51–61), alltså i varje anrop som går genom call().
  - Det täcker alla REST-operationer: services, availability, bookings get/create/cancel och proposals create/get.
  - MCP-schema (server.js:48–50) och MCP-förfrågningar täcks också. Varje MCP-förfrågan gör först ett access-anrop (mcp.js:47), och varje verktygsanrop gör sedan ett eget. Ett lyckat verktygsanrop ger alltså två access-anrop plus själva operationen.
  - Gatewayen exponerar inte /api/v1/access (404). Det finns ingen separat statusroute; status motsvaras av booking get.
- **Strikthet:** profile.apiVersion måste vara exakt "v1", providerMode exakt "split" och scopes måste vara en array. Extra fält accepteras.
  - Ogiltig JSON, null, array och tom body ger 503 provider_configuration_invalid.
  - text/html ger 502 provider_invalid_response.
  - En redirect avbryts (redirect "error") och ger 503 provider_unavailable.
  - Förkontrollen hämtar /api/v1/access med klientens egen authorization eller x-api-key plus gatewayens tjänstenyckel, alltså samma headers som operationen.
- **Icke-2xx från access:** svaret skickas vidare oförändrat (provider.js:55), med bara en allowlist av headers. 401 och 403 bevaras. En 5xx bevaras med salongens body (se GS3-QA-2).
- **Läckage:** 503-svaren är fasta errorReply-meddelanden. Ingen salongs-body och inga headers som set-cookie eller x-internal följer med (stubprov).
- **Ingen cache:** profilen är lokal per anrop.
  - TOCTOU: läget kan ändras mellan förkontroll och operation. I split-läge stoppar salongen ändå operationen med sin egen dubbla nyckelkontroll. Kvar finns bara fönstret när en salong byter till legacy mitt i ett anrop (Info, GS3-QA-4).
- **Salongen:** providerMode sätts i agentRoute-handlern (access/route.ts:10), alltså efter tjänstenyckel- och agentnyckelkontrollen.
  - BOOKING_SERVICE_ROLE === "salon" ger "split", annars "standalone".
  - Legacy-läget finns kvar.
- **Budget:** salongens rate limit "agent-api" är per klient (v1.ts:149). Varje REST-operation kostar nu 2 enheter och varje lyckat MCP-verktygsanrop 3. Detta är dokumenterat i README och docs (GS3-QA-3, Info).
- **Borttaget i server.js:** den tidigare specialkontrollen för GET services/availability ersätts av den generella förkontrollen.

## 3. GS1-QA-3: STÄNGD (i denna lokala omfattning)

Belägg:
- En riktig salong startad utan båda split-inställningarna, bakom en gateway med giltig tjänstenyckel och giltig agentnyckel:
  - alla 12 operationer via gatewayen gav 503 provider_configuration_invalid: läsning, skrivning, avbokning, proposals, MCP-schema, MCP initialize, tools/list och tools/call create/cancel;
  - den riktiga MCP SDK-klienten nekades vid connect;
  - salongens DB visade inga effekter (booking 1→1, AgentBooking 1→1, proposals 0→0, avbokade 0→0);
  - målbokningen förblev confirmed och mandatet förblev oförbrukat;
  - salongens audit under de nekade operationerna visar bara "GET /api/v1/access" (13 rader).
- Repots check-provider-mode.mts gav PASS LEGACY_PROVIDER_REFUSED_NINE_OPERATIONS.
- Byte på samma port bakom samma gatewayadress, utan omstart av gatewayen, fungerade utan cache i båda riktningar: legacy → split gav 200 och 201, split → legacy gav direkt 503 och ingen ny bokning, och split igen gav 200.

Kvarstår enligt design och docs: en salong som avsiktligt körs i legacy-läge är fortfarande direkt åtkomlig utan gateway. GS1-QA-3 gällde att gatewayen tyst betjänade en sådan salong, och det gör den inte längre.

## 4. Resultattabell

| # | Kontroll | Status | Utfall | Observation |
|---|---|---|---|---|
| 1 | Bundle-SHA, verify, HEAD, diffstat, basens commits | VERIFIED | PASS | stämmer |
| 2 | npm ci (båda, låsfiler) | VERIFIED | PASS | rc 0, git status rent |
| 3 | Gateway npm test | VERIFIED | PASS | 10/10 |
| 4 | Gateway npm run build (node --check) | VERIFIED | PASS | rc 0 |
| 5 | Salong tests/agent-api.test.ts | VERIFIED | PASS | 18/18 |
| 6 | Salong full unit (billig) | VERIFIED | PASS | 394/394 (41 filer) |
| 7 | Salong lint / tsc / build | VERIFIED | PASS | rc 0 / 0 / 0 |
| 8 | Salong integration och E2E | NOT RUN | – | enligt avgränsningen |
| 9 | (a) legacy-salong via gateway, 12 operationer inkl. MCP | VERIFIED | PASS | 12/12 svarade 503 provider_configuration_invalid |
| 10 | (a) riktig MCP SDK (@modelcontextprotocol/client 2.4.0) connect | VERIFIED | PASS | nekad med provider_configuration_invalid |
| 11 | (a) DB-effekter och audit | VERIFIED | PASS | inga effekter, bara access-rader |
| 12 | (a) läckage i nekade svar | VERIFIED | PASS | 0 |
| 13 | (b) check-provider-mode.mts mot legacy-gateway | VERIFIED | PASS | PASS LEGACY_PROVIDER_REFUSED_NINE_OPERATIONS, booking 0→0 |
| 14 | (c) legacy → split utan gatewayomstart | VERIFIED | PASS | första anropet 200, create 201 |
| 15 | (c) split → legacy | VERIFIED | PASS | första anropen 503/503, ingen bokning |
| 16 | (c) legacy → split igen | VERIFIED | PASS | 200 |
| 17 | (d) legacy: ogiltig, återkallad eller saknad agentnyckel | VERIFIED | PASS | 401/401/401, autentisering vinner över läget |
| 18 | (d) legacy: gateway med fel tjänstenyckel + giltig agentnyckel | VERIFIED | PASS (info) | 503, läget vinner eftersom legacy ignorerar tjänstenyckeln |
| 19 | (d) split: ogiltig, återkallad eller saknad agentnyckel | VERIFIED | PASS | 401/401/401, inte maskerat som 503 |
| 20 | (d) split: gateway med fel tjänstenyckel | VERIFIED | PASS | REST 401, MCP initialize 401 |
| 21 | (d) hemligheter i loggar och svar | VERIFIED | PASS | 0 träffar på de 3 värdena |
| 22 | (e) stubleverantör, 22 varianter | VERIFIED | PASS | 22/22, se nedan |
| 23 | Positiv väg: agent:proof (split-salong + samma gateway) | VERIFIED | PASS | 10/10 PASS-rader |
| 24 | Positiv väg: SDK-bokning till inloggad Chromium-kalender | VERIFIED | PASS | MCP-id 4888b6ca-9387-4462-80e2-34a30c60de9d; URL-id identiskt, sha256 b80b03ca57f03d431f2175f6b6af5377c2dd24add209701629f1f325d006e51e för båda (split-probe 63/63) |
| 25 | Gatewayens miljö | VERIFIED | PASS | GATEWAY_SERVICE_TOKEN HOME NODE_USE_SYSTEM_CA PATH PORT PWD SALON_ORIGIN, ingen DB-URL |
| 26 | Städning och git status | VERIFIED | PASS | syntetiska rader borta (booking 0, akey 0, admin 0), inga lyssnare, git rent |

Stubvarianter (e) med statusar och antal vidarebefordrade operationer:
- 503 provider_configuration_invalid, 0 vidarebefordrade, ingen body- eller header-läcka: providerMode saknas, standalone, "Split", "split " (med mellanslag), ["split"], scopes som sträng, scopes saknas, apiVersion "v2", apiVersion saknas, JSON null, JSON-array, ogiltig JSON, tom body och "__proto__"-injektion.
- text/html 200 gav 502 provider_invalid_response.
- 302 och 204 gav 503 provider_unavailable.
- Ett hängande svar gav 503 provider_unavailable efter cirka 15 s.
- 401 och 403 bevarades.
- 500 skickades vidare med salongens body (GS3-QA-2).
- Giltig profil med extra fält vidarebefordrades (200, 2 operationer).

Skärmbilder i shots/:
- 01-login.png, sha256 ded62374…
- 02-calendar.png, sha256 ca11729d…
- 03-booking-detail.png, sha256 94ed46bd…

## 5. Nya fynd

Inga blockerare.

Backlog:

- GS3-QA-1, Info (förbefintligt, utanför diffen).
  - Fel: POST /api/v1/proposals direkt mot legacy-salongen gav 500 internal_error (AGENT_API_INTERNAL_ERROR i salongens logg). Trolig orsak är att requireConsentLab() kastar ett fel som inte är AgentApiError när consent-labbet inte är aktiverat (src/lib/agent-api/proposals.ts:33).
  - Konsekvens: brus i felstatistiken och 500 i stället för en kontrollerad 4xx/404.
  - Fix: mappa det felet till AgentApiError (t.ex. not_found eller feature_disabled).
  - Påverkade inte provet: gatewayen nekade proposal create med 503 innan salongen nåddes.
- GS3-QA-2, Info.
  - Var: gateway/src/provider.js:55.
  - Fel: ett icke-2xx access-svar skickas vidare oförändrat, även 5xx med salongens body. Stubprovet visade att en markör i 500-bodyn nådde klienten. Headers allowlistas fortfarande.
  - Konsekvens: liten risk för informationsläckage om salongen någon gång skickar interna detaljer i 5xx. Den riktiga salongen ger en generisk internal_error.
  - Minimal fix: bevara 401/403 (och 429), och mappa övriga icke-2xx till 503 provider_unavailable.
- GS3-QA-3, Info (dokumenterat).
  - Fel: rate-budgeten förbrukas fortare. REST kostar nu 2 enheter per operation och ett MCP-verktygsanrop 3 (access i mcp.js:47, förkontroll i provider.js:54, operationen). Med salongens gräns på 300 per 15 min per klient (agent-api) räcker det till cirka 100 MCP-verktygsanrop per 15 min.
  - Fix vid behov: räkna inte access-anrop med giltig tjänstenyckel mot klientbudgeten, eller återanvänd profilen inom samma inkommande MCP-förfrågan.
- GS3-QA-4, Info.
  - Fel: TOCTOU mellan förkontroll och operation. Om salongen byter till legacy exakt mellan de två anropen når en operation legacy-salongen. Kräver omstart inom millisekunder och är inte praktiskt relevant lokalt.
  - Fix vid behov: salongen ekar providerMode i varje operationssvar, och gatewayen förkastar svar utan det.

## 6. Codex-påståenden

| Påstående | Status | Belägg |
|---|---|---|
| Gatewayen kräver ett autentiserat access-svar med apiVersion=v1, providerMode=split och scopes-array inför VARJE agentoperation | CONFIRMED | kod (provider.js:54–59) + 12/12 riktiga operationer + 22 stubvarianter |
| Standalone, saknat eller felformat läge ger 503 provider_configuration_invalid innan operationen skickas | CONFIRMED | stub: 0 vidarebefordrade operationer; riktig salong: inga DB-effekter, audit bara access. Undantag: 302 och 204 ger provider_unavailable, html ger 502, också fail-closed. |
| Ingen cache mellan klientanrop | CONFIRMED | byte i båda riktningar utan gatewayomstart |
| 401/403 från autentiseringen bevaras | CONFIRMED | D1–D3, D5–D9 och stubbens 401/403 |
| Salongen sätter providerMode efter den befintliga dubbla nyckelkontrollen | CONFIRMED | kod (access/route.ts:10 i agentRoute-handlern) + unit-testet (18/18) |
| Legacy-läget finns kvar med standalone | CONFIRMED | A0: direkt /access gav 200 standalone |
| Extra access-anrop förbrukar API-budget, dokumenterat | CONFIRMED | README och docs. Mätt: 13 access-rader i audit för 12 nekade operationer + SDK-connect. |
| Codex lokalt: gateway 10/10 | CONFIRMED | egen körning 10/10 |
| Codex lokalt: salong 394 unit, lint/tsc/build | CONFIRMED | egen körning |
| Codex lokalt: salong 205 integration | UNVERIFIABLE | inte kört (avgränsning) |
| Codex lokalt: agent:proof 10/10 inkl. Chromium | CONFIRMED | egen körning 10/10 |
| Codex lokalt: nio legacy-operationer nekade | CONFIRMED | check-provider-mode PASS; egen probe 12 |
| Basens CI-gröna resultat (43765483845) | UNVERIFIABLE | inte inspekterat |

## 7. NOT RUN

- Salongens integration (205) och E2E (64), samt basens CI-granskning.
- Docker och Vercel.
- ChatGPT eller annan riktig assistent.
- Fjärrdrift med TLS.
- Rotation av tjänstenyckeln.
- Tidsmätning.
- TOCTOU-fönstret (endast analys).
- Betaltjänster.

## 8. Körning och kommandon

En enda sekventiell körning i ett isolerat nät- och user-namespace som icke-root:
env -u NODE_ENV unshare -rn sh -c 'ip link set lo up && exec unshare --user --map-user=1000 --map-group=1000 ./ns.sh'

- Miljö: TZ=Europe/Stockholm. Inbäddad Postgres (/workspace/qa/pg-tool) på 127.0.0.1:56354. Databaser g3_gate_test och g3_run_test.
- Servrar startades med setsid, utdata omdirigerades till filer och stdin från /dev/null. De stoppades per processgrupp, aldrig med pkill.
- Grindar:
  - gateway: npm test, npm run build;
  - salong: npx prisma generate, migrate, seed, npx vitest run tests/agent-api.test.ts, npm test, npm run lint, npx tsc --noEmit, npm run build.
- Stubprov: node probes/stub-probe.mjs (stub på 3230, riktig gateway på 3231).
- Live:
  - gateway på 3218 med rätt tjänstenyckel och gateway på 3223 med fel tjänstenyckel, båda via env -i;
  - legacy-salong på 3217 (npm start utan BOOKING_SERVICE_ROLE och GATEWAY_SERVICE_TOKEN);
  - node --import tsx scripts/agentprov/check-provider-mode.mts med AGENTPROV_SALON_URL=:3217 och AGENTPROV_BASE_URL=:3218;
  - probes/drift-probe.mts (36 kontroller), som startade om sin egen salong på 3217 i ordningen legacy, split, legacy, split;
  - split-salong på 3217 (BOOKING_SERVICE_ROLE=salon, GATEWAY_SERVICE_TOKEN=REDACTED);
  - npm run agent:proof med AGENTPROV_BASE_URL=:3218 och AGENTPROV_SALON_URL=:3217;
  - probes/split-probe.mts (63 kontroller).
- Fullständiga kommandon står i logs/commands.log (token-värden redigerade).
- Städat: alla egna servrar och Postgres 56354 är stoppade. node_modules, .next, pgdata, /tmp/g3ns och /tmp/g3sec är raderade. Andra processer rördes inte (55433, 55434).

## 9. Avgränsad slutsats

Endast för syntetisk lokal miljö: GS1-QA-3 är STÄNGD. Gatewayen nekar nu varje agentoperation mot en salong i legacy-läge, med saknat läge eller med felformat svar, innan operationen skickas. Den gör det utan cache, och 401/403 bevaras. Den positiva split-vägen (agent:proof, SDK-bokning, inloggad Chromium-kalender, samma id) håller.

Fynd: 0 blockerare, 4 Info i backlog. Ingen FIX-REQUEST behövs. Ingen pilot- eller produktionsbedömning görs.
