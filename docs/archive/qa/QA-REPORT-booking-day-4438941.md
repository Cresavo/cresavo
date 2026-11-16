# QA-rapport — lokalt A2A-prov och komplett bokningsdag, Booking Lab SE (4438941)

Granskare: Grok Bot (oberoende, fixvarv 0 av max 2). Datum: 2026-11-14, Europe/Stockholm.
**Verdikt: GO (avgränsat, endast syntetisk lokal miljö).** Pilot, mainmerge och produktion: NO-GO / separat beslut.

## 1. Omfattning

- Exakt granskad revision: **4438941f84569a6e982b03c9fd6760067cdc61b1** (zipkommentar).
- Produkt-ZIP a3033e55….zip: egen sha256 **7a122b3b88e9748801ab12499858d4471f9530673d8842a63537f205a69b4947**, 8 569 722 B, 771 poster.
- Bas-ZIP 65b58cd4….zip: egen sha256 **c369f2acfa5362fa4e650f64ca1502661b4a02acba3dfd544781977f2b1fb1bc**, 8 558 313 B, 766 poster, kommentar d015141dfa47ac8024a15e2e1ad7a5e73ee5ec62. **Diffbas: d015141.**
- Båda: enda env-fil .env.example; docs/calendar-proof/private.json och båda *secret-scan.json oöppnade.
- d015141 mot dbe1e1f (zip 7634fe2d…): endast docs — .gitattributes (+1 rad för QA-REPORT-backend-*.md), API_MCP_BACKEND_PLAN.md, ARCHITECTURE.md, HANDOFF.md, PROJECT_STATUS.md, VERIFICATION.md, ny docs/qa/QA-REPORT-backend-dbe1e1f.md, ny docs/qa/evidence-backend-dbe1e1f/ (4 json) och ändrad docs/qa/QA-REPORT-mobile-story-9a8350a.md. Båda inbäddade Grok-rapporterna är nu cmp-identiska med mina original (tidigare BE-QA-2 åtgärdad).
- Ingen UI-granskning utöver webb-E2E, ingen ny modul, ingen drift, ingen deploy, ingen ändring i original.

## 2. Diffgranskning 4438941 mot d015141 (9 poster)

- Nya: src/a2a/demo.ts (231 rader), scripts/a2a-demo.ts (128), tests/integration/a2a-demo.test.ts (198), docs/COMPLETE_BOOKING_DAY_PLAN.md (89).
- Ändrade: package.json (+script demo:a2a, +devDependencies "@a2a-js/sdk": "1.3.0"), package-lock.json (exakt ett nytt paket: node_modules/@a2a-js/sdk 1.3.0, Apache-2.0, dev:true; inga borttagna eller ändrade poster), .env.example (+BOOKING_A2A_DEMO=0 med kommentar), THIRD_PARTY_NOTICES.md (+A2A-avsnitt), docs/DEPENDENCY_REVIEW.md (+A2A-avsnitt).
- Oförändrat: hela src/ utom ny src/a2a/, inklusive src/lib (createBooking, kvoter), src/mcp, src/app; prisma/ (schema + 10 migrationer); next.config.ts; övriga scripts och tester. Ingen ändring i delad boknings-/MCP-/webbkärna.

## 3. Beroenden och notices

- @a2a-js/sdk 1.3.0: LICENSE i installerat paket = Apache License 2.0; ingen NOTICE-fil i paketroten. Enda beroende jose ^6.2.3 → befintlig jose 6.2.17 (MIT, LICENSE.md), redan i trädet via @modelcontextprotocol/client (npm ls: deduped). Valfria peers (express, @grpc/grpc-js, @bufbuild/protobuf, pg, mysql2, kysely, better-sqlite3) är optional och installerades inte.
- Licensbedömning: Apache-2.0 och MIT är permissiva, varken copyleft eller icke-kommersiella; Apache-2.0 är förenlig med (A)GPL-3.0 åt det hållet. Kommersiell användning hindras inte. THIRD_PARTY_NOTICES.md och DEPENDENCY_REVIEW.md uppdaterade med licens, källa och bevarandekrav.
- Endast devDependency: npm ls --omit=dev @a2a-js/sdk = tomt; Dockerfile.vercel kör npm ci --omit=dev. Efter build: 0 filer i .next/server och .next/static innehåller @a2a-js, A2A_LOCAL_DEMO_REFUSED, agent-card.json eller JsonRpcTransportHandler; inget i src/app, src/lib eller src/mcp importerar a2a.

## 4. Egna körningar

Separat syntetisk kopia; fräsch embedded Postgres 127.0.0.1:56310 (icke-root, uid 1000 i user-ns) i isolerat nätverksnamnrum (unshare -rn, endast lo); TZ=Europe/Stockholm; env -u NODE_ENV; slumpad SESSION_SECRET i chmod 600-fil; endast @example.test; port 3000 och A2A-port endast i netns. Sekventiellt.

| Kontroll | Resultat |
| --- | --- |
| npm ci | PASS |
| prisma generate / migrate deploy / seed | PASS (10 migrationer). Första seed i gate-DB:n körde före generate i mitt skript och föll på saknad klient; alla 8 efterföljande seeds PASS |
| lint | PASS |
| tsc --noEmit | PASS |
| build | PASS |
| unit | 114/114 (23 filer) |
| full integration | 127/127 (27 filer) |
| riktad a2a-demo.test.ts ×3, fräsch DB varje gång | 2/2, 2/2, 2/2 (0 flaky) |
| webb-E2E produktion: workspace.spec.ts + flow.spec.ts | 24/24 (12 test × desktop/mobil) |
| npm audit (full) | 7 moderate (@typescript-eslint/* ×5, typescript-eslint, minimatch), 0 high/critical |
| npm audit --omit=dev | 0 |
| egen wire-probe (SDK + rå HTTP), fullt läge ×3 | 60/64 varje gång; 4 FAIL = spec/robusthet, se A2A-QA-1/2 |
| verkligt CLI med syntetisk stdin | 22/22 |
| negativa kontroller (5) | alla fångade; källfilen återställd, cmp identisk |
| probe efter återställning (a2a-only) | 42/46, samma 4 icke-blockerande FAIL |

Databaser efter körningarna: 0 kvarlämnade bokningar/händelser/admins.

## 5. Wire-probe (probes/probe.mts) och CLI (probes/cli.mts)

Oberoende klient: officiell @a2a-js/sdk ClientFactory + DefaultAgentCardResolver + JsonRpcTransportFactory med fetch som lägger på bearer; servern startas genom projektets egen startA2aDemo() (CLI:t är dokumenterad startväg och skriver aldrig ut token, så en extern klient kan bara få token i samma process). HTTP-webb på node scripts/server.mjs (produktionsbygge), MCP via stdio src/mcp/server.ts --admin --allow-workspace.

- Startgrindar, separata processer (12/12): nekas utan BOOKING_A2A_DEMO, med 0 och med "true"; NODE_ENV=production; VERCEL, VERCEL_ENV, VERCEL_URL; lokal DB utan _test/_demo; DB på annan värd; kort och saknad SESSION_SECRET. Positiv kontroll startar; HOST/HOSTNAME=0.0.0.0 ändrar inte bindningen (alltid 127.0.0.1, hårdkodat demo.ts:188). Det finns ingen konfigurerbar icke-loopback-bindning.
- Discovery (3/3): SDK hämtar AgentCard med bearer (1 kortanrop); kortet anger JSONRPC, protocolVersion 1.0, loopback-URL, bearer-schema och saknar token.
- Säkerhetsgränser rå HTTP (13 PASS, 3 FAIL spec): utan bearer, fel bearer (samma/annan längd), gemener "bearer" och token i URL → 403 med tom kropp, AgentCard exponeras inte (403, inte 401: A2A-QA-1). Origin-header (även samma värd och "null") → 403 med giltig bearer. 16 385 B → 413; ~15 KB → 200; 2 MB → 413. Trasig JSON → 400 {"error":"A2A_DEMO_REQUEST_INVALID"} utan stack. Fel metod (GetTask, legacy message/send) och saknad/fel A2A-Version → 400 med tom kropp. Ogiltiga SendMessage-params → JSON-RPC-fel utan stack. Okänd väg/GET /a2a → 404. Rå JSON-RPC SendMessage → 200, jsonrpc 2.0, samma id. FAIL: S-9b/S-10b/S-11b, felen är inte JSON-RPC-felobjekt (A2A-QA-2).
- Kundprofil (11/11): cancel, list, move, get → 400 utan andra kunders data; tillgänglighet visar annan kunds bokning endast som saknad tid och har exakt fälten slots, service{id,name,priceOre,duration,version}, staff{id,name}, timeZone. Förfalskade customerEmail, customerName, customerId, businessId → 400 (strict). confirmed≠true och icke-UUID-nyckel → 400. Inga bokningar från nekade anrop.
- Tjänstversion (2/2): efter versionshöjning ger gammal serviceVersion 409 "Uppgifterna har ändrats. Läs in på nytt."; ny tillgänglighet ger ny version.
- Idempotens (5/5): bokning med aktuell version, svar endast booking{id,serviceId,staffId,startsAt,endsAt}; samma nyckel+payload → samma bokning, 1 rad, 1 create-händelse; samma nyckel ändrad tid → 409; 20 parallella retries samma nyckel → samma id, 1 rad.
- Samtidighet (3/3): 20 parallella SendMessage med olika nycklar för samma tid → exakt 1 bokning, 19 "Tiden är inte tillgänglig". Blandat webb/MCP/A2A 6+6+6 för samma tid, 3 rundor × 3 körningar → exakt 1 bokning varje runda (vinnare varierade: web, mcp, a2a), 0 aktiva överlapp.
- Kvoter (3/3): delad attemptgräns 30/15 min per kanaladress (samma checkRateLimit) → 8 av 15 extra försök fick 429; 3 A2A-bokningar/dag ok, 4:e 429; 2 A2A + 1 webbokning med samma e-post → nästa A2A 429 (delad e-postkvot). Mellan faser rensades RateLimitBucket och syntetiska rader i test-DB för att isolera kontrollerna.
- Tre vägar (3/3): webb, MCP och A2A skapar bokning med samma snapshot-fält (serviceName, priceOre, duration) och exakt 1 create-händelse; varje väg nekar en tid som en annan väg bokat; ägar-MCP avbokar A2A-bokningen (2 händelser). Händelsernas aktör: webb public, MCP local-mcp, A2A public/booking-channel (A2A-QA-4).
- Dataminimering och token (2/2): 120 A2A-svar utan token, SESSION_SECRET, DATABASE_URL, annan kunds namn/e-post, a2a-demo-e-post, "A2A Demo", requestHash/idempotencyKey/clientKey/emailCapKey, Prisma, node_modules eller stackrader. Token hittades inte i någon fil i run-mappen, /tmp eller npm-loggar.
- Robusthet (1 FAIL info): exakt en ECONNRESET per körning, på första anropet efter 413 på keep-alive-anslutning (A2A-QA-3).

CLI (npm run -s demo:a2a -- massage staff-demo 2026-12-04), 22/22:
- Utan opt-in: A2A_DEMO_FAILED, exit 1, ingen bokning.
- Ingen bokning (exit 0) för: "boka", "BOKA ", " BOKA", "Boka", "BOKA!", tom rad, EOF efter val, EOF direkt, stängd stdin (ctrl-D), Enter vid val, val 0, val 999.
- Visar behandling, utförare, längd (min) och pris (kr), numrerade tider och sammanfattningen "A2A Demo · Massage · Anna · 2026-12-04 09:00 (Stockholm)" före BOKA-frågan.
- Exakt "BOKA" (val 2) → exakt 1 bokning på vald tid 09:30 med 1 create-händelse, utskrivet id och relativ adress /admin?date=2026-12-04&staffId=staff-demo&view=day; ingen 64-hex-token i utdata.
- Ägarkanal: syns i admin-API och adminsidan för bokningen (200); ägar-MCP get_booking utan kunddata; MCP cancel_booking → cancelled v2, händelser create+cancel; admin-API med status=all visar avbokad, standardlistan döljer den.

Negativa kontroller (endast i kopian, src/a2a/demo.ts, återställd och cmp-identisk varje gång):
- NC1 Origin-kontroll bortkopplad → S-6 FAIL.
- NC2 storleksgräns 16384→16384000 → S-7 och S-8 FAIL (och ECONNRESET försvann, vilket bekräftar orsaken till A2A-QA-3).
- NC3 idempotensnyckel ersatt med slumpad → I-2, I-3, I-4, C-1, Q-0 FAIL.
- NC4 serviceVersion skickas inte vidare → V-1 och följande FAIL.
- NC5 bearerjämförelse bortkopplad → S-1 till S-5 FAIL.

## 6. Planen mot faktiska tester

| Påstående i COMPLETE_BOOKING_DAY_PLAN.md | Bevis | Status |
| --- | --- | --- |
| JSONRPC 1.0 på loopback, slumpad port, bearer skyddar AgentCard och SendMessage | a2a-demo.test.ts:48; probe W/S | PASS |
| Inga headers/tokens till logg/URL | probe DM-2, CLI-3 | PASS |
| Origin nekas | test :186; probe S-6 | PASS |
| Tillgänglighet ger behandling, pris, längd, utförare, Stockholmstider | test :111; probe P-avail | PASS |
| confirmed=true och UUID-nyckel krävs | test :127; probe P-confirm | PASS |
| Samma createBooking och kvoter, ingen admin | probe Q-0..Q-2, P-*, T-1 | PASS |
| Opt-in/prod/moln/testDB-grindar | test :34; probe G-1..G-11 | PASS |
| CLI kräver BOKA, Enter/EOF avslutar | probe CLI | PASS |
| Integration 127/127, riktad 2/2, unit 114, webb 24 | egna körningar | PASS |

Planens "Slutgrind" om uppdatering av status/handoff görs efter QA; ARCHITECTURE, VERIFICATION och HANDOFF nämner ännu inte A2A (A2A-QA-6).

## 7. Fynd

Blockerare (Medium+): **inga**.

Backlogg:

**A2A-QA-1 — Low — autentiseringsfel ger 403 utan WWW-Authenticate**
Fil: src/a2a/demo.ts:140-146. Repro: GET /.well-known/agent-card.json utan eller med fel bearer → 403, tom kropp.
Acceptans: saknad/ogiltig bearer → 401 med WWW-Authenticate: Bearer; Origin-nekande får vara 403.
Riktning: dela villkoret; Origin → 403, auth → 401.

**A2A-QA-2 — Low — felsvar är inte JSON-RPC-felobjekt**
Fil: src/a2a/demo.ts:169-176 och 182-186. Repro: "{not json" → 400 {"error":"A2A_DEMO_REQUEST_INVALID"}; metod GetTask eller A2A-Version 0.3 → 400 med tom kropp.
Acceptans: {"jsonrpc":"2.0","id":…,"error":{"code":-32700 / -32601 / A2A VersionNotSupported}} utan stack; ev. HTTP 200 enligt JSON-RPC-binding.
Riktning: returnera SDK:ns/JSON-RPC:s standardfel. Planen avgränsar till SendMessage, så detta är interoperabilitet, inte säkerhet.

**A2A-QA-3 — Low — ECONNRESET på keep-alive efter 413**
Fil: src/a2a/demo.ts:164-166. Repro: proben skickar 16 385 B och 2 MB (413) och sedan fler anrop; exakt en anslutningsåterställning per körning, på återanvänd anslutning. Försvinner när gränsen kopplas bort (NC2).
Acceptans: inga ECONNRESET för efterföljande anrop.
Riktning: vid 413 sätt Connection: close och avsluta/förstör request-strömmen (eller kontrollera Content-Length före läsning).

**A2A-QA-4 — Low — A2A-bokningar loggas som public/booking-channel**
Fil: src/lib/domain.ts:385-390 (oförändrad kärna), src/a2a/demo.ts:106. Repro: BookingEvent för A2A-bokning har actorKind public, actorId booking-channel; går inte att skilja från webbokning utan clientKey-HMAC.
Acceptans: historiken visar kanalen A2A.
Riktning: separat aktörsetikett för a2a-adressen (kräver kärnändring, separat beslut).

**A2A-QA-5 — Info — fast syntetisk kundprofil delar kvoter**
src/a2a/demo.ts:102-103: alla A2A-bokningar använder a2a-demo@example.test och samma kanaladress, alltså högst 3 bokningar/dag och 30 försök/15 min totalt för hela A2A-kanalen, delat med webbokningar med samma e-post. Avsiktligt för provet.

**A2A-QA-6 — Info — status-/arkitekturdokument ej uppdaterade för A2A**
ARCHITECTURE.md, VERIFICATION.md, HANDOFF.md saknar A2A; planen anger att detta görs efter QA.

**A2A-QA-7 — Info — serviceVersion valfri i A2A-book**
src/a2a/demo.ts:34-35: book utan serviceVersion accepteras (samma som webben). CLI:t skickar alltid versionen.

## 8. Codex-påståenden

| Påstående | Status |
| --- | --- |
| Endast A2A-tillägg + docs/tester, ingen kärnändring | CONFIRMED |
| @a2a-js/sdk 1.3.0 som devDependency, inte i produktionsbygge | CONFIRMED |
| 127 integration | CONFIRMED |
| 114 unit | CONFIRMED |
| 24 webb prod E2E desktop/mobil | CONFIRMED (workspace.spec.ts + flow.spec.ts) |
| lint/tsc/build PASS | CONFIRMED |
| riktad SDK 2/2 efter slutlig discoveryändring | CONFIRMED (×3) |
| verkligt CLI BOKA → bokning → ägarkanalavbokning | CONFIRMED (egen körning via MCP) |
| audit 7 moderate dev, prod 0 | CONFIRMED |
| bearer i minnet, aldrig loggad | CONFIRMED inom testat område (filskanning, utdata) |
| loopback/opt-in/testDB/prod/moln-grindar, Origin nekad, 16 KB, kundprofil | CONFIRMED |

## 9. Faktiska kommandon och resultat

Utanför netns (box):
- sha256sum, stat -c %s, unzip -z, unzip -l, unzip -Z1 på båda zip: värden enligt avsnitt 1.
- diff -rq base src → 9 poster; diff -rq dbe base → 9 poster (docs).
- node-skript som jämför package-lock.json packages → 1 tillagd post, 0 borttagna, 0 ändrade utom rotens deklaration.
- env -u NODE_ENV npm ci → exit 0.
- npm ls jose → @a2a-js/sdk och @modelcontextprotocol/client delar jose 6.2.17; npm ls --omit=dev @a2a-js/sdk → (empty).
- grep -rlE '@a2a-js|A2A_LOCAL_DEMO_REFUSED|agent-card\.json|JsonRpcTransportHandler' .next/server .next/static → 0 filer.
- npm audit --json → exit 1, 7 moderate; npm audit --omit=dev --json → exit 0, 0.

I netns (env -u NODE_ENV unshare -rn … unshare --user --map-user=1000), matrix-ns.sh:
- npx prisma generate → 0; npm run db:migrate → 0 (10 migrationer); npm run db:seed → 0 (utom första, före generate).
- npm run lint → 0; npx tsc --noEmit → 0; RATE_LIMIT_STORE=memory npm test → 0, 114/114; npm run build → 0.
- RATE_LIMIT_STORE=postgres npm run test:integration → 0, 127/127.
- npm run test:integration -- tests/integration/a2a-demo.test.ts ×3 → 0, 2/2 varje gång.
- E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/flow.spec.ts → 0, 24 passed.

I netns, probe-ns.sh:
- PORT=3000 TRUSTED_PROXY_IPS=127.0.0.10/32 node --env-file=.env scripts/server.mjs --hostname 127.0.0.1 (webb).
- node --import tsx qa-probe/cli.mts (kör npm run -s demo:a2a -- massage staff-demo 2026-12-04 med olika stdin, totalt 15 körningar) → CLI PASS=22 FAIL=0.
- node --import tsx qa-probe/probe.mts full ×3 → PASS=60 FAIL=4 varje gång.
- NC1–NC5 (sed i kopian → probe.mts a2a-only → återställ → cmp): 41/46, 41/46, 37/46, 35/46, 37/46; alla "restored cmp=identical".
- probe.mts a2a-only efter återställning → 42/46. diag-ns.sh → ECONNRESET på första POST efter 413-sekvensen.

## 10. NOT RUN

- Extern/tredjeparts A2A-klient eller annan SDK-version; streaming, tasks, push, gRPC/REST-binding (ej annonserade).
- Full E2E-matris (alla spec-filer, dev-läge, fyra lägen); endast de 24 produktionstesterna.
- Mobilprov för "grundflöde, nästa kund och returkontext" i planens acceptans (inga nya E2E i diffen).
- Interaktiv TTY-körning av CLI (endast pipad stdin); verklig ctrl-C.
- GitHub Actions, preview, produktion, Docker-image-bygge.
- Juridisk licensbedömning utöver läsning av licensfiler.

## 11. Scoped GO/NO-GO

- 4438941, syntetisk lokal A2A-provväg + oförändrad webb/MCP-kärna: **GO**. Inga Medium/High; ingen FIX-REQUEST.
- Pilot, mainmerge, produktion, publik/fjärr-A2A: **NO-GO** här.

## 12. Artefakter (sha256-prefix, under a2a-4438941/run/)

probes/probe.mts 8cdb80a624c7; probes/cli.mts d4d0a2b8f57e; probes/start.mts cf0f7b2c9c2d; probe-ns.sh b283ad4eb4da; matrix-ns.sh 943a359cff94; diag-ns.sh 34caab534846; logs/summary.log 4546fb51a87c; logs/probe-summary.log b67d610d3034; logs/cli.log 97f20076552f; logs/probe-full-1.log 90aa9b8ddb12; logs/diff-4438941-vs-d015141.txt fa20125e5d0b; logs/diff-d015141-vs-dbe1e1f.txt a4450d21f22a; logs/audit-full.json fd955825bf30; logs/audit-prod.json c2fc49a7aa44.

## 13. Städning

Alla egna servrar avslutade via faktiska node-PID:er (scripts/server.mjs, src/mcp/server.ts, probe-processer); Postgres stoppad; pgdata, work/node_modules, work/.next, work/.env, work/qa-probe, test-results, /tmp/a2asec (hemlighet) och /tmp/a2ans raderade. Slutkontroll: inga node-/postgres-processer kvar. Vid kontrollen hittades dessutom två next-server-processer (start 12:15 och 12:16 CET, arbetskatalog backend-dbe1e1f/run/work, inte startade av denna körning); de avslutades. Originalzip orörda; kopians källkod cmp-identisk med arkivet efter alla negativa kontroller.
