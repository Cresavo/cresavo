# QA-rapport · Agentprov 2 · QA2-bcae82b-01 · Booking Lab SE

Datum: 2026-11-15 (Europe/Stockholm). Oberoende, riktad QA av filtrerad export. Inga kodfixar, inga ändringar i paketet eller originalet, ingen push/PR/deploy/CI, inga konton, inga riktiga data.

## 1. Omfattning och exakta SHA:er

| Objekt | Värde |
| --- | --- |
| Yttre paket (zip) | sha256 e06a10aee2c5def843cb1d23c23cfc9720115c430093533deebb29060b29a1a6, 4 890 412 B |
| booking-lab-bcae82b.zip | sha256 7f7f97af83b6652c8eb21ccc8c7f61b3fd12e437addbda12fe89f7d21276cbea, 2 485 682 B, zip-kommentar bcae82b734ac3a5c18e22aa21c13f09c6b1cd14b |
| booking-lab-e890b69.zip (fryst bas) | sha256 ba78233b75729847c1651341fd70dd0c34ba1771c32ecdf05c91d720030bfb03, 2 464 204 B, zip-kommentar e890b696bbba422c3885696df6b4282d8f33948a |
| Produktrevision enligt beställning | 17ce75bb92f2d5c14b3cc017d7343d99b6f918bd (senare commits endast docs). Gitt-historik ingår inte i exporten; endast trädet bcae82b kunde granskas. |
| Paket (read-only) | /workspace/qa/booking-lab-se/agentprov2-bcae82b/pkg/ (orört) |
| Körkatalog | /workspace/qa/booking-lab-se/agentprov2-bcae82b/run/ (new, old, work, oldwork, logs, probes) |
| Mandat | pkg/REVIEW_REQUEST.md (5 mål) |

## 2. Miljö

- Linux-box, kernel 6.12, 8 CPU, Node v24.22.1, npm ci från package-lock (Next 16.4.6, Prisma 7.10.1, zod 4, @modelcontextprotocol/server+client 2.4.0).
- Isolering: unshare -rn (eget nätverksnamnrum, endast lo) + user-namespace uid 1000 (icke-root). Inget utgående nät under test.
- Embedded Postgres (lokalt pg-tool) på 127.0.0.1:56350, socket i /tmp/apns, färska DB:er per fas: ap_gate_test, ap_usp_test, ap_int_test, ap_http_test, ap_mig_test, ap_pkg_test, ap_nc1/2/3_*_test (alla bakom repots test-db-guard, understreck, slutar _test).
- TZ=Europe/Stockholm, env -u NODE_ENV, syntetiska platshållarvärden endast i processmiljön (DATABASE_URL lokal, SESSION_SECRET ≥ 32 tecken syntetisk, BOOKING_ADDRESS_SECRET syntetisk). Ingen .env lästes eller skapades. All testdata @example.test.
- Sekventiellt, ingen parallell QA-körning.
- Avvikelse: pg-tool:s node_modules saknades vid första gates-försöket (initdb: command not found → P1001). Installerades om med npm ci i /workspace/qa/pg-tool, gates kördes om från början. Det misslyckade försökets logg sparad (logs/summary-attempt1-pgtool-missing.log).

## 3. Manifest och träddiff

Manifest mot arkiv:

| Arkiv | Zip-poster | Filer i zip | manifest included | Skillnad |
| --- | --- | --- | --- | --- |
| bcae82b | 387 | 305 | 305 | 82 katalogposter |
| e890b69 | 368 | 292 | 292 | 76 katalogposter |

- Filmängderna matchar manifest exakt i båda riktningarna. Skillnaden 387/368 vs 305/292 är enbart katalogposter (namn som slutar på /).
- Inga omitted-sökvägar finns i arkiven; credentialLike = [].
- Utelämnat i exporten (bcae82b): 432 docs-filer, 4 plugins-filer, 2 .github-filer, .env.example. Konsekvens: plugins, CI-workflows och fullständig docs kan inte granskas (NOT RUN).

Träddiff e890b69 → bcae82b (git diff --no-index --numstat): 27 filer, 13 tillagda, 14 ändrade, 0 borttagna, +733/−29.

| + | − | Fil |
| --- | --- | --- |
| 19 | 1 | AGENTS.md |
| 17 | 1 | README.md |
| 67 | 0 | docs/AGENTPROV_2_PROTOCOL_NOTES.md (ny) |
| 29 | 0 | docs/HANDOFF.md |
| 46 | 0 | docs/LEGACY_DECOUPLE_PLAN.md (ny) |
| 62 | 0 | docs/POLICY_MERGE_PLAN.md (ny) |
| 21 | 0 | docs/PROJECT_STATUS.md |
| 51 | 0 | docs/VERIFICATION.md |
| 10 | 2 | docs/agent-api-v1.openapi.yaml |
| 1 | 0 | next.config.ts (outputFileTracingIncludes för /api/v1/openapi) |
| 10 | 0 | prisma/migrations/20261115020000_mandate_place/migration.sql (ny) |
| 2 | 0 | prisma/schema.prisma |
| 9 | 0 | src/app/.well-known/usp/route.ts (ny) |
| 4 | 0 | src/app/api/v1/mcp/schema/route.ts (ny) |
| 7 | 0 | src/app/api/v1/openapi/route.ts (ny) |
| 11 | 0 | src/app/llms.txt/route.ts (ny) |
| 3 | 0 | src/lib/agent-api/bookings.ts |
| 53 | 0 | src/lib/agent-api/discovery.ts (ny) |
| 10 | 2 | src/lib/agent-api/mandate-policy.ts |
| 41 | 0 | src/lib/agent-api/mcp-inputs.ts (ny) |
| 19 | 20 | src/lib/agent-api/mcp.ts |
| 6 | 0 | src/lib/agent-api/place.ts (ny) |
| 14 | 1 | src/lib/agent-api/v1.ts |
| 2 | 1 | tests/agent-api.test.ts (exakta toEqual utökade med additiva platsfält, ingen försvagning) |
| 74 | 0 | tests/agent-discovery.test.ts (ny) |
| 7 | 1 | tests/agent-mandate.test.ts (två nya negativa fall + schemafall) |
| 138 | 0 | tests/integration/agent-usp.test.ts (ny) |

De 13 historiska migrationerna, package.json och package-lock.json är byte-identiska mot e890b69.

## 4. Kommandon och utfall

Kommandon kördes via run/ns.sh (gates) och run/ns2.sh (PHASE=http, mig, pkg, nc) inne i namnrummet, t.ex.
env -u NODE_ENV PHASE=mig unshare -rn sh -c 'ip link set lo up && exec unshare --user --map-user=1000 --map-group=1000 ./ns2.sh'.
Fullständiga loggar: run/logs/ (summary.log, commands.log, per-steg-loggar).

| # | Steg | Kommando (kort) | Utfall | Status |
| --- | --- | --- | --- | --- |
| G1 | Installation | npm ci | rc 0 | PASS |
| G2 | Prisma | npx prisma generate; prisma migrate deploy; seed (ap_gate_test) | rc 0; 14 migrationer | PASS |
| G3 | Riktade unit | vitest run agent-discovery, agent-mandate, agent-api | 3 filer, 43/43 | PASS |
| G4 | Integration agent-usp | färsk ap_usp_test | 1 fil, 4/4 | PASS |
| G5 | Lint | npm run lint | rc 0 | PASS |
| G6 | Typer | npx tsc --noEmit | rc 0 | PASS |
| G7 | Build | npm run build (syntetisk DATABASE_URL i processmiljö) | rc 0; alla routes dynamiska | PASS |
| G8 | Full unit | npm test | 27 filer, 166/166 | PASS |
| G9 | Full integration | färsk ap_int_test | 31 filer, 139/139; 0 rader kvar i Booking/BookingEvent/AgentClient/AgentApiKey/AgentMandate/AgentBooking/AgentApiEvent/Customer | PASS |
| M | Migration 13→14 | se 6.3 | 3/3 mandat bevarade, 8/8 efterprov | PASS |
| H1 | Riktig HTTP metadata | npm start (scripts/server.mjs) + curl, servrar A–E | se 7.1 | PASS |
| H2 | Riktig HTTP MCP | probes/http-mcp.mts mot npm start (StreamableHTTP-klient) | 75/75 | PASS |
| P | Paketeringssimulering | previewFiles → pkgsim → build → runtime-layout som Dockerfile.vercel → npm start | /api/v1/openapi 500 (ENOENT) | FAIL (AP2-QA-1) |
| N1–N3 | Negativa kontroller | se 8 | alla tre fångade; restore cmp identical | PASS |

## 5. Del (a) · Kod-, schema- och paketeringsgranskning

### 5.1 Mål 1 · Metadata-ytor
- discovery.ts:6-15: origin tas endast från BOOKING_PUBLIC_ORIGIN, annars http://127.0.0.1:PORT; Host/X-Forwarded-*/body används inte. vercel-läge utan origin kastar DISCOVERY_ORIGIN_INVALID; icke-https och icke-loopback-http, userinfo, query, hash eller path avvisas.
- Profilen bär x-booking-lab-texten "USP profile discovery and MCP tool-name aliases only; canonical USP wire/negotiation and full lifecycle are not implemented." och AGENTPROV_2_PROTOCOL_NOTES.md säger samma sak (alias över native v1, ingen wire-översättning, holds=false, ingen checkout). Ärlig märkning: OK.
- /api/v1/openapi läser docs/agent-api-v1.openapi.yaml från process.cwd() vid runtime (openapi/route.ts:5). Se AP2-QA-1.

### 5.2 Mål 2 · MCP-alias
- mcp.ts: fem alias (usp_services_list, usp_services_get, usp_availability_query, usp_bookings_create, usp_bookings_get) registreras med samma tool()-wrapper, samma scope och samma native-funktion som gamla namnen; mcp-inputs.ts delar strikta zod-scheman. usp_services_get filtrerar servicesV1 med samma params (BOLA via business).
- Inga lokala admin-verktyg i HTTP-gatewayen (bekräftat i 7.2: exakt 10 verktyg).

### 5.3 Mål 3 · Mandatplats
- mandate-policy.ts: locationId är literal DEMO_LOCATION_ID; scheduleId valfritt i operatörsschemat men måste vara placeForStaff(staffId).scheduleId och sätts annars server-side (transform). assertMandatedBooking (rad 43) jämför lagrad locationId/scheduleId mot server-härledd plats för bokningen.
- bookings.ts: createAgentBooking härleder plats via placeForStaff(input.staffId); klient-JSON (agentBookingSchema, strict) kan inte bära locationId/scheduleId/consent-utvidgning.
- Migration 20261115020000_mandate_place: lägger kolumnerna, backfillar scheduleId = 'staff-schedule:' || staffId, NOT NULL, CHECK endast längd (se AP2-QA-4).

### 5.4 Mål 4 · Paketering
- next.config.ts: outputFileTracingIncludes { "/api/v1/openapi": ["./docs/agent-api-v1.openapi.yaml"] }. Byggd route.js.nft.json listar yaml-filen (verifierat i work/.next). Men vercel.json använder "framework": "container" och Dockerfile.vercel bygger utan standalone-output; NFT styr alltså inte vad som hamnar i runtime-imagen.
- .vercelignore:23-25 och .dockerignore:23-25: "!/docs", "/docs/*", "!/docs/DEPENDENCY_REVIEW.md" → yaml-filen exkluderas ur både uppladdning och Docker-build-context. scripts/preview-files.mjs (previewFiles) gav 200 filer, openapi_in_list=0, enda docs-fil docs/DEPENDENCY_REVIEW.md.
- Dockerfile.vercel runtime-steget (rad 25-33) kopierar .next, public, scripts, next.config.mjs, licenser och källtarball – ingen docs/.
- tests/agent-discovery.test.ts:49 anropar openapi() mot källträdet; tests/preview-files.test.ts kräver inte yaml-filen. Ingen test täcker paketerat innehåll.
- Docker kördes INTE (ingen docker build/run). Påståendet om 500 bygger på en filnivåsimulering, se 7.3.

### 5.5 Mål 5 · Policy och legacy
- POLICY_MERGE_PLAN.md och LEGACY_DECOUPLE_PLAN.md är planer ("plan, ingen merge", "endast plan"). Inga BookingPolicy-modeller/migrationer i trädet; src/a2a och övriga legacyytor finns kvar; inga borttagna filer i diffen; 13 historiska migrationer byte-identiska.
- Codex merge-tree-utfall (exit 1, 5 dokumentkonflikter) kan inte verifieras: git-historik och policygren ingår inte i exporten.

## 6. Del (b) · In-process-tester (vitest, handler-nivå)

### 6.1 Riktade och fulla sviter
- Riktade: agent-discovery, agent-mandate, agent-api 43/43. Full unit 166/166 (27 filer).
- Integration: agent-usp 4/4 på färsk DB; full 139/139 (31 filer) på färsk DB; städning verifierad med SQL (0 rader).

### 6.2 Observation om test-täckning
- NC2 (fel scope på alias-create) och NC3 (usp_services_get ignorerar business) fångas inte av unit-sviten (43/43 grönt), endast av integration agent-usp och HTTP-probe. Godtagbart men noterat (AP2-QA-7).

### 6.3 Migration 13→14 med syntetiskt gammalt mandat
- oldwork (e890b69) generate + migrate deploy till ap_mig_test (13 migrationer) + seed.
- probes/old-mandate.mts med gammal klient: 3 gamla mandat (aktivt, återkallat, förbrukat) samt en bekräftad gammal AgentBooking.
- row_to_json-dump före/efter, sedan work (bcae82b) prisma migrate deploy → 14 migrationer, constraint mandate_place_not_empty finns.
- cmp-mig.py: AgentMandate 3→3, 0 ändrade gamla kolumner, 0 saknade, nya kolumner locationId/scheduleId = demo-location/staff-schedule:staff-demo. AgentBooking 1→1 och Booking 1→1 oförändrade.
- probes/mig-after.mts 8/8 PASS: M1 plats/schema backfillad korrekt; M2 annan utförare nekas; M3 annan tjänst nekas; M4 klient-JSON locationId → invalid_request; M5 återkallat nekas; M6 redan använt nekas; M7 replay av gammal bokning ger samma id och nu plats/schema i svaret; M8 aktivt gammalt mandat bokar exakt sitt scope (confirmed).
- Direkt-SQL: INSERT av mandat med scheduleId som inte matchar staffId accepteras av DB (rollback) – se AP2-QA-4.
- Begränsning: alla tre gamla mandat gällde staff-demo; staff-erik-backfill testades inte separat.

## 7. Del (c) · Riktig HTTP/klient (npm start på loopback i netns)

### 7.1 Metadata och headers (curl, probes/curl-matrix.sh)
Varierade Host, X-Forwarded-Host, X-Forwarded-Proto, Forwarded, Origin (evil.example.test m.fl.).

| Server | Konfiguration | /.well-known/usp | /llms.txt | /api/v1/mcp/schema | /api/v1/openapi |
| --- | --- | --- | --- | --- | --- |
| A | lokal, ingen BOOKING_PUBLIC_ORIGIN | 200 application/json | 200 text/plain; charset=utf-8 | 200 application/json | 200 application/yaml; charset=utf-8 |
| B | https-origin satt | 200 | 200 | 200 | 200 |
| C | http icke-loopback-origin (felkonfig) | 503 no-store | 503 no-store | 200 | 200 |
| D | BOOKING_RUNTIME=vercel utan origin | 503 DISCOVERY_CONFIG_INVALID (med X-Real-IP); 400 utan X-Real-IP | 503 | 200 | 200 |
| E | vercel + https-origin | 200, fast origin | 200 | 200 | 200 |
| NOORIGIN (pkg-fas) | lokal, ingen origin, Host/XFH evil | endpoints http://127.0.0.1:3418/api/v1, /api/v1/openapi, /api/v1/mcp, /api/v1/mcp/schema | 200 | – | – |

- 200-svar: Cache-Control public, max-age=60; felsvar no-store. Ingen Access-Control-Allow-Origin. evil.example.test reflekteras aldrig i body eller headers (evil_in_body=0 för alla A–E).
- HEAD 200; POST/PUT/DELETE 405; OPTIONS 204 med allow: GET, HEAD, OPTIONS och utan CORS-headers; avslutande snedstreck 308; /.well-known/USP 404.
- Vary innehåller Next-headers rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch (AP2-QA-6).
- Probe-begränsning: origins-regexen i curl-matrix.sh var felaktig (visade []), därför verifierades publicerade endpoints separat via E-körningen och NOORIGIN-körningen.

### 7.2 MCP över HTTP (probes/http-mcp.mts, 75/75 PASS)
- T1 exakt 10 verktyg (5 alias + 5 gamla), inga admin-verktyg; aliasens inputscheman = gamla namnens.
- T2–T3 katalogparitet usp_services_list/list_services/usp_services_get; business=other → forbidden_business.
- T4 read-only-nyckel → forbidden_scope på båda create-namnen.
- T5 utvidgningsfält (locationId, scheduleId, buyer.consent, mandate-objekt, maxPrice m.m.) avvisas av strikta scheman; REST med extra fält 400; operatörsutfärdande med annan location/schedule/buyer avvisas.
- T6 mandatmatris (annan tjänst/utförare/tid/pris/klient, lagrad plats/schema som avviker, utgånget, återkallat) → mandate_denied på alias och gammalt namn; 0 bokningar skapade.
- T7 alias-bokning confirmed med locationId/scheduleId; replay via gammalt namn = samma id; samma nyckel, annan kropp → idempotency_conflict; återanvänt mandat nekas; get_booking == usp_bookings_get.
- T8 annan klient: booking_not_found (BOLA) för get/cancel via båda namnen.
- T9 samtidighet: parallella create med samma slot → exakt 1 confirmed.
- T10 återkallad nyckel → 401.
- T11 delad kvot: 297 OK-anrop, därefter 429 på alias, gammalt namn och REST (gemensam agent-api-hink 300/15 min).
- T12 egen avbokning via gammalt namn OK. Serverloggar innehåller 0 förekomster av @example.test.

### 7.3 Paketering i riktig runtime-layout (ej Docker)
1. previewFiles(new) → 200 filer; tar till pkgsim (motsvarar uppladdning/Docker-context efter .vercelignore/.dockerignore).
2. I pkgsim: npm ci-kopia, prisma generate, npm run build (rc 0), compile-runtime-config.
3. pkgrt byggdes som Dockerfile.vercel runtime-steg (rad 25-33): .next, public, scripts, next.config.mjs, node_modules, licenser – utan docs.
4. npm start på 3416: usp 200, llms 200, mcp/schema 200, /api/v1/openapi 500 tom body; serverlogg: ENOENT … pkgrt/docs/agent-api-v1.openapi.yaml.
5. Positiv kontroll: samma layout + docs/agent-api-v1.openapi.yaml → 200 på 3417.
Slutsats: Den publicerade REST-schema-URL:en i profilen och llms.txt blir 500 i det paketerade artefaktet. Detta är en filnivåsimulering; ingen Docker-build/-run och ingen Vercel-deploy utfördes.

## 8. Negativa kontroller (på kopia work/, restore + cmp)

| NC | Mutation | int agent-usp | unit agent (43) | HTTP-probe | Restore |
| --- | --- | --- | --- | --- | --- |
| NC1 | mandate-policy.ts:43 tar bort plats/schema-jämförelsen | 1 fail / 3 pass | 2 fail | 64/75; T6 lagrat avvikande schema godtogs och bokade | cmp identical |
| NC2 | mcp.ts:61 usp_bookings_create kräver services:read i stället för bookings:write | 1 fail / 3 pass | 43/43 (fångas ej) | 74/75; T4a gav unauthorized i stället för forbidden_scope | cmp identical |
| NC3 | v1.ts:163 serviceV1 ignorerar params.business | 1 fail / 3 pass | 43/43 (fångas ej) | 74/75; T3c business=other gav ingen forbidden_business | cmp identical |

Efter restore: build rc 0 och diff work vs new = 0 rader.

## 9. Fynd

### Blockerare (för paketerad preview, mål 4)

AP2-QA-1 · Medium · OpenAPI-filen saknas i paketerad runtime; /api/v1/openapi ger 500
- Filer: .vercelignore:23-25, .dockerignore:23-25, Dockerfile.vercel:25-33, src/app/api/v1/openapi/route.ts:5, next.config.ts (outputFileTracingIncludes), src/lib/agent-api/discovery.ts:23 (schema-URL publiceras).
- Repro: 7.3 (previewFiles → build → runtime-layout utan docs → npm start → curl /api/v1/openapi = 500, ENOENT; med yaml tillagd = 200).
- Konsekvens: USP-profilen och llms.txt pekar agenter på ett REST-schema som returnerar 500 i preview/container. NFT-inkluderingen hjälper inte i framework "container". Unit-testet läser källträdet och kan inte upptäcka felet; build är grön.
- Minimal fixriktning: undanta docs/agent-api-v1.openapi.yaml i .vercelignore och .dockerignore och kopiera den i runtime-steget i Dockerfile.vercel (eller bädda in schemat i bygget, t.ex. genererad TS-modul, så att routen inte läser docs/ vid runtime). Lägg ett test som kör previewFiles på trädet och kräver filen, samt en kontroll mot runtime-steget.

### Backlog

AP2-QA-2 · Low · Codex verifieringstext överskattar paketeringsbeviset
- docs/VERIFICATION.md:29-30 ("NFT-spårningen inkluderar OpenAPI-filen") stämmer för .next, men visar inte att filen finns i preview/container. Fix: formulera om och hänvisa till paketerat test.

AP2-QA-3 · Low · Tyst loopback-fallback utanför vercel-läge
- discovery.ts:9: utan BOOKING_PUBLIC_ORIGIN publiceras http://127.0.0.1:PORT även när npm start körs med NODE_ENV=production (t.ex. container utan BOOKING_RUNTIME=vercel). Ingen reflektion av angriparhost, men felaktiga endpoints. Fix: kräv explicit origin när NODE_ENV=production eller logga varning.

AP2-QA-4 · Info · DB-constraint kontrollerar bara längd
- prisma/migrations/20261115020000_mandate_place/migration.sql (CHECK length): direkt-SQL med scheduleId som inte matchar staffId accepteras. Runtime nekar sådana mandat (smalnar, vidgar inte; NC1 visar att kontrollen i mandate-policy.ts:43 är det som skyddar). Eventuell fix: CHECK scheduleId = 'staff-schedule:' || staffId så länge modellen är 1:1.

AP2-QA-5 · Info · Plats är helt härledd ur staff
- place.ts: placeForStaff ger fast location och schema per staff; plats/schema-kontrollen är i dag redundant med staffkontrollen men framtidssäker. Ingen åtgärd.

AP2-QA-6 · Info · Cache/CORS-detaljer
- Vary med Next-routerheaders på publika cachebara metadata ger cachefragmentering; inga CORS-headers (webbläsarbaserade agenter från annan origin kan inte läsa profilen); /api/v1/mcp/schema och /api/v1/openapi svarar 200 även när origin-konfigurationen är ogiltig. Medvetna val bör dokumenteras.

AP2-QA-7 · Info · Unit-sviten fångar inte alias-scope/BOLA-regression
- NC2 och NC3 fångas endast av integration och HTTP-probe. Överväg ett unit- eller snabbt in-process-test för scope per alias och business-filter i usp_services_get.

## 10. Codex-påståenden

| Påstående | Bedömning | Underlag |
| --- | --- | --- |
| Unit 166/166 | CONFIRMED | G8 |
| Integration 139/139 | CONFIRMED | G9 |
| Riktade 43/43 | CONFIRMED | G3 |
| lint/tsc/build PASS | CONFIRMED | G5–G7 |
| Gammalt mandat 13→14 PASS, scope bevarat | CONFIRMED | 6.3, oberoende prov 8/8 |
| Alla 13 historiska migrationer oförändrade; inga deps/lockfiler borttagna | CONFIRMED | numstat |
| Runtime-HTTP inte verifierad av Codex | CONFIRMED (Codex själv); nu verifierat av QA | 7.1–7.2 |
| Byggmanifest + NFT inkluderar OpenAPI (build-route-check.json) | NFT-delen CONFIRMED (route.js.nft.json); slutsatsen att routen är paketerad CONTRADICTED; build-route-check.json saknas i exporten (UNVERIFIABLE) | 5.4, 7.3, AP2-QA-1 |
| Policy konfliktkontroll exit 1, 5 dokumentkonflikter, ingen merge | "ingen merge" CONFIRMED i trädet; merge-tree-utfallet UNVERIFIABLE (ingen git-historik/policygren) | 5.5 |
| Initial unit 31/33 före DTO-utökning | UNVERIFIABLE; diffen visar endast additiva fält i exakta toEqual | 3 |

## 11. NOT RUN och begränsningar

- Docker build/run av Dockerfile.vercel (endast filnivåsimulering i 7.3).
- Vercel preview/deploy, CI/GitHub Actions (.github utelämnad), plugins (utelämnade).
- Browser-E2E/Playwright (alla lägen), Windows.
- Full USP-konformitet mot upstream-specifikationen (endast namn/struktur-läsning; ingen extern hämtning).
- Policy-merge-tree och git-historik (17ce75bb och senare doc-commits kunde inte jämföras; endast export bcae82b).
- Codex råloggar (final-checks.json, build-route-check.json, policy-merge-tree.txt m.fl. ingår inte).
- Separat 13→14-backfill för staff-erik.
- Riktig TLS/proxy framför servern (endast headers mot loopback).

## 12. Städning

Alla egna node-/postgres-processer stoppade; work/.next, work/node_modules, oldwork/node_modules, pkgsim, pkgrt, pgdata, /tmp/apns, /tmp/apsec borttagna. Inga .env-filer skapade. Körkatalogen kvar med källkopior, probes och loggar (22 MB). Kvarvarande process som inte är QA:ns: en pågående codex exec i /workspace/booking-lab/public-readonly-preview (annan uppgift; orörd).

## 13. Bedömning

- Syntetisk lokal POC (npm start, loopback, syntetiska data): GO. Alias, scopes, BOLA, idempotens, mandatplats, migration och kvoter håller i riktig HTTP; inga kritiska eller höga fynd.
- Paketerad preview (Vercel container/Docker): NO-GO tills AP2-QA-1 är åtgärdat och verifierat.
- Pilot: NO-GO. Produktion: NO-GO.

Antal: 1 blockerare (Medium), 2 Low, 4 Info. Gates 166/166 unit, 139/139 integration, 75/75 HTTP-MCP, 8/8 migration, 3/3 negativa kontroller fångade.
