# QA-rapport · Agentprov 2 · rättningsvarv 1 · QA2-F1-c9c5e49 (inom QA2-bcae82b-01)

Datum: 2026-11-15 (Europe/Stockholm). Riktad återkontroll av rättningsvarv 1 av högst 2. En enda QA-körning, endast i separat syntetisk miljö på QA-boxen. Inga kodfixar, inga ändringar i paket eller original, ingen server på användarens dator, ingen push/PR/merge/deploy/CI, inga konton, inga riktiga data, ingen .env läst eller skapad. Föregående rapport QA-REPORT-agentprov2-bcae82b.md är oförändrad (sha256 116ff870b1588ed2fa149fe44a5f136139fb84c8d206704ffdc19513e9750a53).

## 1. Omfattning och exakta SHA:er

| Objekt | Värde |
| --- | --- |
| Yttre paket (zip) | sha256 2eef3a7c638c59c49cf657c0e1a83c9158fde6903d749646425649a39cd13dad, 4 917 022 B |
| booking-lab-c9c5e49.zip (kandidat) | sha256 423a4ca3f19bdcff6920542b4cfbfeb95790bd96bb47c60d3d54460e3ce65cd4, 2 490 623 B, zip-kommentar c9c5e490c8429798470370fcc1d68b4db8c56db3 |
| booking-lab-bcae82b.zip (jämförelse, ny export) | sha256 a54e7509930df5207eca87f33e47837cb8d1d1446e8541051f9c9ccc34f7f8ef, 2 488 406 B, zip-kommentar bcae82b734ac3a5c18e22aa21c13f09c6b1cd14b |
| Föregående bcae82b-export (förra paketet) | sha256 7f7f97af83b6652c8eb21ccc8c7f61b3fd12e437addbda12fe89f7d21276cbea, 2 485 682 B |
| Fryst kandidat | c9c5e490c8429798470370fcc1d68b4db8c56db3 |
| Produktrevision enligt REVIEW_REQUEST | 9e1c929a9246d4cad8c3385cfe5a12afbc20d333 (git-historik ingår inte; endast trädet c9c5e49 granskat) |
| Jämförelse | bcae82b734ac3a5c18e22aa21c13f09c6b1cd14b; Agentprov-1 e890b69 fryst och ej granskad här |
| Paket (read-only) | /workspace/qa/booking-lab-se/agentprov2-f1-c9c5e49/pkg/ (orört) |
| Körkatalog | /workspace/qa/booking-lab-se/agentprov2-f1-c9c5e49/run/ (new, old, work, logs, probes, ns3.sh) |
| Mandat | pkg/REVIEW_REQUEST.md (rättningsvarv 1, AP2-QA-1/2/3/6 + Vercel-loopback-HTTP) |

## 2. Miljö

- Linux-box (kernel 6.12, 8 CPU), Node v24.22.1, npm 11.21.1. npm ci i work: "added 573 packages" (npm varnade att 3 paket har install-scripts som inte täcks av allowScripts; samma lockfil som bcae82b, byte-identisk).
- Isolering: unshare -rn (eget nätverksnamnrum, endast lo) + user-namespace uid 1000 (icke-root). Inget utgående nät under test.
- Embedded Postgres från /workspace/qa/pg-tool (node_modules fanns, ingen ominstallation behövdes) på 127.0.0.1:56351, socket /tmp/apns. Färska DB:er: ap_gate_test, ap_usp_test, ap_int_test, ap_pkg_test, ap_origin_test, ap_http_test, ap_nc_test (understreck, slutar _test, bakom repots test-db-guard).
- TZ=Europe/Stockholm, env -u NODE_ENV för skriptet; syntetiska platshållare endast i processmiljö (DATABASE_URL loopback, slumpad SESSION_SECRET i /tmp/apsec, raderad efteråt). All testdata @example.test.
- Viktig miljöfakta: scripts/server.mjs:15 sätter alltid process.env.NODE_ENV = "production" utom med --dev. npm start är alltså alltid produktionsläge; loopback-fallback utan origin kan bara nås via npm run dev (--dev) eller direkta funktionsanrop i tester.

## 3. Manifest och träddiff

Manifest mot arkiv:

| Arkiv | Zip-poster | Katalogposter | Filer | manifest files | omitted | credentialLikeFiles |
| --- | --- | --- | --- | --- | --- | --- |
| c9c5e49 | 388 | 82 | 306 | 306 (exakt lika mängd) | 440 (433 docs, 4 plugins, 2 .github, .env.example) | 0 |
| bcae82b (ny) | 388 | 82 | 306 | 306 (exakt lika mängd) | 438 (431 docs, 4 plugins, 2 .github, .env.example) | 0 |

- Skillnaden 388 poster mot 306 filer är enbart katalogposter. Inga omitted-sökvägar finns i något arkiv.
- c9c5e49 utelämnar två fler docs än bcae82b: docs/qa/QA-REPORT-agentprov2-bcae82b.md och docs/qa/FIX-REQUEST-agentprov2-bcae82b.md (QA-dokumenten finns i produktträdet men exporteras inte).
- Ny bcae82b-export mot förra: zip-poster 387 → 388; enda tillägget docs/AGENTPROV_1_PREVIEW.md; 0 borttagna; alla övriga posters CRC identiska; manifestet flyttar just den filen från omitted till files. diff -rq av utpackade träd: endast "Only in new: docs/AGENTPROV_1_PREVIEW.md". BEKRÄFTAT att det är den enda skillnaden.

Träddiff bcae82b → c9c5e49 (git diff --no-index --numstat): 13 ändrade, 0 tillagda, 0 borttagna.

| + | − | Fil |
| --- | --- | --- |
| 1 | 0 | .dockerignore (rad 26: !/docs/agent-api-v1.openapi.yaml) |
| 1 | 0 | .gitattributes (docs/qa/*agentprov2*.md -text) |
| 1 | 0 | .vercelignore (rad 26: !/docs/agent-api-v1.openapi.yaml) |
| 3 | 0 | AGENTS.md |
| 1 | 0 | Dockerfile.vercel (rad 31: COPY --from=build … /app/docs/agent-api-v1.openapi.yaml ./docs/agent-api-v1.openapi.yaml) |
| 2 | 1 | docs/AGENTPROV_1_PREVIEW.md (BOOKING_PUBLIC_ORIGIN-rad, migrationstext) |
| 14 | 1 | docs/AGENTPROV_2_PROTOCOL_NOTES.md (produktion/Vercel-origin, CORS/Vary/statiska scheman, paketeringskedja) |
| 13 | 4 | docs/HANDOFF.md |
| 10 | 5 | docs/PROJECT_STATUS.md |
| 37 | 1 | docs/VERIFICATION.md |
| 4 | 2 | src/lib/agent-api/discovery.ts |
| 8 | 0 | tests/agent-discovery.test.ts |
| 9 | 2 | tests/preview-files.test.ts |

Kodändringen i sin helhet (discovery.ts:8-13): hosted = BOOKING_RUNTIME === "vercel"; utan BOOKING_PUBLIC_ORIGIN kastas DISCOVERY_ORIGIN_INVALID om hosted ELLER NODE_ENV === "production"; HTTP-loopback godtas endast när !hosted.
Teständringar: preview-files-testet parametriseras över .vercelignore och .dockerignore (samma assertions, yaml tillagd i wanted), plus nytt COPY-test; agent-discovery får en produktionsassertion, en Vercel+HTTPS-assertion och tre it.each-fall för Vercel-loopback-HTTP. Inga assertions, timeouts eller gamla testfall borttagna.
BEKRÄFTAT oförändrat: övrig src (bokning, mandat, auth, MCP, v1), prisma/schema och alla 14 migrationer, package.json, package-lock.json, scripts/, next.config.ts, vercel.json.

## 4. Kommandon och utfall

Körskript run/ns3.sh, faser gates, red, pkg, origin, mcp, nc, var och en via
env -u NODE_ENV PHASE=<fas> unshare -rn sh -c 'ip link set lo up && exec unshare --user --map-user=1000 --map-group=1000 ./ns3.sh'.
Loggar: run/logs/ (summary.log, commands.log, per-steg, curl-*.log, server-*.log).

| # | Steg | Kommando (kort) | Utfall | Status |
| --- | --- | --- | --- | --- |
| G1 | Installation | npm ci | 573 paket, rc 0 | PASS |
| G2 | Prisma | npx prisma generate; npm run db:migrate; npm run db:seed (ap_gate_test) | rc 0; 14 migrationer; 0 rader i 8 tabeller | PASS |
| G3 | Lint | npm run lint | rc 0 | PASS |
| G4 | Typer | npx tsc --noEmit | rc 0 | PASS |
| G5 | Riktade unit | vitest run agent-discovery, preview-files, agent-mandate, agent-api | 4 filer, 49/49 | PASS |
| G6 | Full unit | npm test | 27 filer, 171/171 | PASS |
| G7 | Build | npm run build | rc 0 (10 s) | PASS |
| G8 | Integration agent-usp | färsk ap_usp_test | 4/4; 0 rader efter | PASS |
| G9 | Full integration | färsk ap_int_test | 31 filer, 139/139 (60 s); 0 rader i Booking/BookingEvent/AgentClient/AgentApiKey/AgentMandate/AgentBooking/AgentApiEvent/Customer | PASS |
| R1 | Nya/ändrade tester mot gammal källa | bcae82b-källa + c9c5e49:s agent-discovery.test.ts och preview-files.test.ts | 7 fail / 9 pass (16) | PASS (förväntat RÖTT) |
| R2 | Samma tester mot ny källa | work | 16/16 | PASS |
| P1 | Filurval båda ignore-kedjor | previewFiles (.vercelignore, git-semantik) + moby-semantik för .dockerignore | 202 filer vardera, listor identiska; docs: endast DEPENDENCY_REVIEW.md + agent-api-v1.openapi.yaml | PASS |
| P2 | Paketerad filnivå-smoke (inte Docker) | build i pkgsim → runtime-layout via tolkade COPY-rader → node scripts/server.mjs i vercel-läge | /api/v1/openapi 200, application/yaml; charset=utf-8, innehåller openapi: 3.1.0, byte-identisk med källan | PASS |
| P3 | Negativ kontroll i layout | yaml borttagen ur runtime-layout | /api/v1/openapi 500 (ENOENT) | PASS (fångad) |
| O | Originmatris riktig HTTP | 13 serverkonfigurationer, 240 curl-anrop i matrisen | se 7.2 | PASS |
| H | 75-kontrollers HTTP-MCP-probe | probes/http-mcp.mts mot npm start | 75/75; 0 rader efter; 0 @example.test i serverlogg | PASS |
| N1–N5 | Negativa kontroller på kopia | se 8 | alla fem fångade; restore cmp identical; work mot new 0 diffrader | PASS |
| D | Docker build/run, Vercel preview | – | – | NOT RUN |

## 5. Del (a) · Kod-, paketerings- och dokumentationsgranskning

### 5.1 AP2-QA-1 · paketering
- .vercelignore:26 och .dockerignore:26 lägger till exakt !/docs/agent-api-v1.openapi.yaml efter /docs/* och !/docs/DEPENDENCY_REVIEW.md. Ingen bred docs-inkludering.
- Dockerfile.vercel:31 kopierar exakt den filen till ./docs/agent-api-v1.openapi.yaml i runtime-steget, där routen läser process.cwd()/docs/… .
- Filurval jämfört med förra körningen (bcae82b): enda skillnaden är docs/agent-api-v1.openapi.yaml.
- Testet för .dockerignore kopierar filen som .vercelignore och använder git-ignore-semantik, inte Dockers matcher. QA verifierade separat med en återimplementering av moby/patternmatcher-semantik (sista matchning vinner, föräldramatchning) att .dockerignore ger samma 202 filer (probes/dockerignore.py). Skillnaderna mellan filerna (.env mot **/.env m.fl.) påverkar inte urvalet i detta träd.

### 5.2 AP2-QA-3 och Vercel-loopback
- discovery.ts:8-13 enligt 3. Origin tas fortfarande aldrig från Host/forwarding-headers eller body.
- Konsekvens av server.mjs:15: lokal npm start utan BOOKING_PUBLIC_ORIGIN ger nu 503 för profil och llms (även i lokalt läge). Fallback finns bara i --dev. AGENTPROV_2_PROTOCOL_NOTES.md:22-23 ("BOOKING_PUBLIC_ORIGIN eller lokal loopback/PORT") säger inte detta uttryckligen (AP2-F1-QA-1, Info). npm run agent:proof använder inte discovery, så runbooken påverkas inte funktionellt.

### 5.3 AP2-QA-2 och AP2-QA-6 · dokumentation
- VERIFICATION.md skiljer nu "Filurval + runtime-COPY … Statisk kontroll, inte Docker/HTTP" från NFT och listar paketerad runtime-HTTP och Docker som NOT RUN lokalt.
- AGENTPROV_2_PROTOCOL_NOTES.md:29-39: ingen CORS, Next-Vary behålls, statiska schemaresurser kan ge 200 vid felkonfigurerad origin medan profil/llms ger 503/no-store, samt att OpenAPI-filen måste följa .vercelignore, .dockerignore och COPY. Beteendet matchar (7.2). Undantag: dokumentationen kallar schemaresurserna "statiska native kontrakt utan origin", men OpenAPI-filen har servers: url: http://localhost:3000 (agent-api-v1.openapi.yaml:18-19), se AP2-F1-QA-2.

## 6. Del (b) · In-process-tester (vitest)

- Riktade 49/49, full unit 171/171 (27 filer), agent-usp 4/4, full integration 139/139 (31 filer), alla på färska DB:er med 0 kvarvarande rader.
- RÖTT på gammal kod: bcae82b-källa med c9c5e49:s två testfiler gav 7 fail / 9 pass (16). Fallerande: .vercelignore-urval, .dockerignore-urval, runtime-COPY, produktionsorigin-kravet och tre Vercel-loopback-HTTP-fall (localhost, 127.0.0.1, [::1]). Samma filer mot ny källa: 16/16.

## 7. Del (c) · Riktig HTTP (servrar i netns på loopback)

### 7.1 Paketerad filnivåsimulering (AP2-QA-1) – inte Docker
1. Filurval: previewFiles(new) och moby-semantik för .dockerignore, båda 202 filer, identiska listor; tar till pkgsim.
2. I pkgsim enligt Dockerfile.vercel byggsteg: DATABASE_URL=postgresql://build@127.0.0.1:1/build_test, prisma generate, npm run build, compile-runtime-config, mkdir -p public, källtarball.
3. Runtime-layout pkgrt byggd genom att tolka sista stegets COPY --from=build-rader (probes/runtime-layout.py): .next, public, scripts, docs/agent-api-v1.openapi.yaml, next.config.mjs, licenser, källtarball; package.json/lock. node_modules hårdlänkades från work (full installation, inte npm ci --omit=dev; .prisma och argon2-raderna hoppades över eftersom de redan ingår). Rad 27 (sha256-kontroll av argon2-binären) kördes inte.
4. Server som CMD i Dockerfile men på loopback: node scripts/server.mjs --hostname 127.0.0.1 med BOOKING_RUNTIME=vercel VERCEL=1 TRUST_PROXY_IP=0 RATE_LIMIT_STORE=postgres NODE_ENV=production BOOKING_PUBLIC_ORIGIN=https://booking.example.test, anrop med X-Real-IP.
5. Utfall: /.well-known/usp 200 application/json; /llms.txt 200 text/plain; charset=utf-8; /api/v1/mcp/schema 200; /api/v1/openapi 200 application/yaml; charset=utf-8, Cache-Control public, max-age=60, 12 282 B, innehåller "openapi: 3.1.0", byte-identisk med new/docs/agent-api-v1.openapi.yaml (sha256-prefix 5db6ca2c9b220d51 båda). Curl-matris mot paketerad server: 20 anrop, ingen reflektion.
6. Negativ kontroll: yaml borttagen ur pkgrt → /api/v1/openapi 500, serverlogg ENOENT …/pkgrt/docs/agent-api-v1.openapi.yaml; profilen fortsatt 200.

### 7.2 Originmatris (npm start = produktionsläge, utom O13)
Varje konfiguration testades med plain, Host: evil, X-Forwarded-Host: evil + X-Forwarded-Proto: http, Forwarded: host=evil, Origin: https://evil (Vercel-läge med X-Real-IP).

| ID | Konfiguration | usp / llms | mcp/schema / openapi | Publicerad origin |
| --- | --- | --- | --- | --- |
| O1 | lokal, produktion, ingen origin | 503 / 503, no-store | 200 / 200 | – |
| O2 | vercel + http://localhost:3432 | 503 / 503, no-store | 200 / 200 | – |
| O3 | vercel + http://127.0.0.1:3433 | 503 / 503, no-store | 200 / 200 | – |
| O4 | vercel + http://[::1]:3434 | 503 / 503, no-store | 200 / 200 | – |
| O5 | vercel + https://booking.example.test | 200 / 200, public, max-age=60 | 200 / 200 | https://booking.example.test |
| O6 | lokal produktion + explicit http://127.0.0.1:3436 | 200 / 200 | 200 / 200 | http://127.0.0.1:3436 |
| O7 | NODE_ENV=production + explicit http://localhost:3437 | 200 / 200 | 200 / 200 | http://localhost:3437 |
| O8 | produktion + http://evil.example.test (icke-loopback HTTP) | 503 / 503 | 200 / 200 | – |
| O9 | produktion + https://booking.example.test | 200 / 200 | 200 / 200 | https://booking.example.test |
| O10 | vercel utan origin | 503 / 503 | 200 / 200 | – |
| O11 | vercel + https://localhost | 200 / 200 | 200 / 200 | https://localhost (AP2-F1-QA-3) |
| O12 | vercel + https, utan X-Real-IP | 400 (wrapperns ingresskrav) | – | – |
| O13 | npm run dev (--dev), ingen origin, Host/XFH evil | 200 / 200 | – | http://127.0.0.1:3443 (tidigare fallback) |

- Reflektion: i alla 240 matrisanrop (O1–O11, PKG) evil i body = 0 och evil i headers = 0; O13 evil = 0.
- CORS: ingen Access-Control-Allow-Origin i något svar; OPTIONS 204 med allow: GET, HEAD, OPTIONS utan CORS-headers. Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding. Stämmer med dokumentationen.
- Statiska scheman 200 oberoende av origin i alla konfigurationer (även O1/O2/O8/O10).
- Probe-not: en av QA:s egna kontrollrader (O12) hängde i skriptets kommandosubstitution tills QA dödade O12-servern; statusen 400 hade redan registrerats. Ingen påverkan på produkten.

### 7.3 HTTP-MCP-regression
probes/http-mcp.mts (samma 75 kontroller som i förra rapporten: 10 verktyg, aliasparitet, scopes, BOLA, utvidgningsfält, mandatmatris, replay/idempotens, samtidighet, återkallad nyckel, delad kvot 300/15 min, avbokning) mot npm start med explicit loopback-origin: 75/75 PASS, 0 rader kvar, 0 @example.test i serverlogg.

## 8. Negativa kontroller (på kopia work/, restore + cmp)

| NC | Mutation | Tester | HTTP/fil | Restore |
| --- | --- | --- | --- | --- |
| N1 | discovery.ts:13 tillåter HTTP-loopback även i Vercel | agent-discovery 3 fail / 10 pass | vercel + http://127.0.0.1 → usp 200, llms 200 (ska vara 503) | cmp identical |
| N2 | discovery.ts:9 kräver origin endast i Vercel | agent-discovery 1 fail / 12 pass | produktion utan origin → 200 med http://127.0.0.1:3452 (ska vara 503) | cmp identical |
| N3 | .vercelignore utan yaml-raden | preview-files 1 fail / 2 pass | vercel-urval saknar yaml | cmp identical |
| N4 | .dockerignore utan yaml-raden | preview-files 1 fail / 2 pass | docker-urval (moby) saknar yaml. I verklig Docker skulle COPY-raden då fallera vid build; ej kört | cmp identical |
| N5 | Dockerfile.vercel utan COPY-raden | preview-files 1 fail / 2 pass | runtime-layout saknar yaml (motsvarar P3 → 500) | cmp identical |

Efter restore: build rc 0, diff work mot new = 0 rader.

## 9. Status för tidigare fynd

| Fynd | Status | Underlag |
| --- | --- | --- |
| AP2-QA-1 (Medium, blockerare) | STÄNGD för filnivåsimulering; verklig Docker/Vercel ej verifierad | 5.1, 7.1, N3–N5 |
| AP2-QA-2 (Low) | STÄNGD | 5.3 |
| AP2-QA-3 (Low) | STÄNGD | 7.2 O1/O6/O7, N2 |
| AP2-QA-6 (Info) | STÄNGD (dokumenterat och beteendet stämmer); notera AP2-F1-QA-2 | 5.3, 7.2 |
| AP2-QA-4 (Info, DB-CHECK) | Backlog, oförändrat | – |
| AP2-QA-5 (Info, härledd plats) | Backlog, oförändrat | – |
| AP2-QA-7 (Info, unit-täckning alias/BOLA) | Backlog, oförändrat | – |
| Codex extra: Vercel + HTTP-loopback | STÄNGD | 7.2 O2–O4, N1 |

## 10. Nya fynd (inga blockerare)

AP2-F1-QA-1 · Info · Lokal npm start kräver nu explicit origin, vilket dokumentationen inte säger
- scripts/server.mjs:15 sätter alltid NODE_ENV=production för npm start. discovery.ts:9 ger därför 503 för profil/llms lokalt utan BOOKING_PUBLIC_ORIGIN. AGENTPROV_2_PROTOCOL_NOTES.md:22-23 nämner "lokal loopback/PORT" utan att säga att fallbacken bara gäller npm run dev.
- Repro: O1 och O13.
- Fix: en mening i protokollnoterna/runbooken om att sätta BOOKING_PUBLIC_ORIGIN=http://127.0.0.1:PORT för lokal npm start.

AP2-F1-QA-2 · Low (backlog) · Den statiska OpenAPI-filen pekar på http://localhost:3000
- docs/agent-api-v1.openapi.yaml:18-19 (servers: url: http://localhost:3000) har funnits sedan e890b69. Den exponeras nu i paketerad runtime och länkas från en profil med HTTPS-origin. Dokumentationen beskriver schemat som "utan origin".
- Repro: GET /api/v1/openapi i O5/PKG; body innehåller http://localhost:3000.
- Konsekvens: en klient som följer OpenAPI servers riktar sig mot localhost i stället för den publicerade origin. Ingen reflektion och inget säkerhetsläckage.
- Minimal fix: relativ servers-url (t.ex. "/") eller notering i yaml/dokumentation.

AP2-F1-QA-3 · Info · Vercel godtar https://localhost
- discovery.ts:13 kräver bara https i Vercel. En operatör kan sätta https://localhost (O11 → 200). Det är explicit operatörskonfiguration, inte headerstyrt. Överväg att avvisa loopback-värdar helt i Vercel.

AP2-F1-QA-4 · Info · Testet för .dockerignore använder git-semantik
- tests/preview-files.test.ts kopierar .dockerignore som .vercelignore och utvärderar med git check-ignore. För nuvarande regler ger moby-semantik samma urval (P1), men framtida mönster som skiljer sig mellan git och Docker täcks inte.

## 11. Codex-påståenden

| Påstående | Bedömning | Underlag |
| --- | --- | --- |
| Nya tester RÖDA på gammal kod 7 fail / 9 pass | CONFIRMED (7/9 av 16) | R1 |
| Efter rättning 16/16 | CONFIRMED | R2 |
| Full unit 171/171 (27 filer) | CONFIRMED | G6 |
| Full integration 139/139 (31 filer) | CONFIRMED (60 s här; Codex 140,69 s i annan miljö) | G9 |
| lint/tsc/build exit 0 | CONFIRMED | G3, G4, G7 |
| Ny *_test-DB, 14 migrationer, seed exit 0; 0 rader efteråt | CONFIRMED (egna DB:er) | G2, G8, G9 |
| Preview-walk inkluderar YAML; statisk runtime-COPY | CONFIRMED (även moby-semantik och faktisk HTTP i layout) | P1, P2 |
| YAML-allowlist i båda ignorefiler, ingen bred docs-inkludering | CONFIRMED | 5.1 |
| Explicit origin krävs i produktion; Vercel avvisar HTTP-loopback | CONFIRMED | 7.2, N1, N2 |
| Ingen ändring i kärnlogik/mandat/auth/deps/lockfil/migrationer/gamla tester/timeouts | CONFIRMED | 3 |
| Ny bcae82b-export skiljer sig från förra endast genom docs/AGENTPROV_1_PREVIEW.md | CONFIRMED | 3 |
| VERIFICATION/HANDOFF citerar QA-rapportens hash 116ff870… | CONFIRMED (hashen stämmer med QA:s fil; docs/qa-kopian är utelämnad i exporten) | 3 |
| Windows Node 24.16/Postgres 18.6, fix1-*-råfiler, fix1-packaging-check.json | UNVERIFIABLE (ingår inte) | – |
| Codex npm start stoppades av automatisk granskning | UNVERIFIABLE | – |

## 12. NOT RUN och vad som bara är simulering

- Filsimulering, inte Docker: P1–P3 och N3–N5 är filurval plus layout plus riktig Node-HTTP. Ingen docker build/run gjordes. npm ci --omit=dev/--ignore-scripts, argon2-hashkontrollen (Dockerfile.vercel:27), USER node och 0.0.0.0-bindning kördes inte. Docker-context-semantiken återimplementerades och är inte Dockers egen kod.
- Vercel preview/deploy, verklig TLS/proxy och Vercels ingress kördes inte; vercel-läget emulerades lokalt med VERCEL=1 och X-Real-IP.
- CI/GitHub Actions, plugins och .github (utelämnade), browser-E2E, UI/video, Windows och riktiga assistenter/agentklienter kördes inte.
- Migration 13→14 kördes inte om (migrationen är oförändrad; förra rapporten 8/8).
- Policy-merge och git-historik (9e1c929, senare doc-commits) ingår inte i exporten.

## 13. Städning

Alla egna node- och postgres-processer stoppade, inga kvar. Borttaget: work/node_modules, work/.next, redwork, pkgsim, pkgrt, källtarball, pgdata, devwork, prevb, /tmp/apns, /tmp/apsec. Inga .env-filer skapade. Kvar: run/new, run/old, run/work (källkopior utan node_modules), probes, loggar, ns3.sh (17 MB). Paketet och föregående rapport är orörda.

## 14. Bedömning (scopad)

- Syntetisk lokal POC: GO.
- Paketerad filnivåsimulering (båda ignore-kedjor + Dockerfile-runtime-COPY + riktig Node-HTTP): GO. AP2-QA-1 är stängd i denna simulering.
- Verklig Docker-image och Vercel preview: INTE verifierat (NOT RUN).
- Pilot: NO-GO. Produktion: NO-GO.
- Inga kvarvarande blockerare i rättningsvarv 1; ingen FIX-REQUEST skrivs. Nya fynd: 1 Low (AP2-F1-QA-2) och 3 Info, alla backlog.

Antal: unit 171/171, riktade 49/49, integration 139/139, agent-usp 4/4, RÖTT 7/16 → GRÖNT 16/16, HTTP-MCP 75/75, originmatris 13 konfigurationer / 240 matrisanrop med 0 reflektion, paketerad OpenAPI 200 (negativ 500), negativa kontroller 5/5 fångade.
