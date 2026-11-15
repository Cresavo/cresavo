# QA-rapport — riktad återkontroll fixvarv 1, lokalt A2A-prov, Booking Lab SE (d8562b8)

Granskare: Grok Bot (oberoende, fixvarv 1 av max 2). Datum: 2026-11-14, Europe/Stockholm.
**Verdikt: GO (avgränsat, endast syntetisk lokal miljö).** Pilot, mainmerge, produktion och fjärr-/publik A2A: NO-GO / separat beslut.

## 1. Omfattning

- Exakt granskad revision: **d8562b8190f52e7b76f3d4682ec6f3b84fd35732** (zipkommentar).
- ZIP 5a10f139….zip: egen sha256 **96d715b69e1b03236a6eda2c9488faf5476b7fdb1c1af096eee6ac7e8ad90673**, 8 581 793 B, 772 poster. Enda env-fil .env.example; private.json och båda *secret-scan.json oöppnade.
- Diffbas: **4438941f84569a6e982b03c9fd6760067cdc61b1** (zip a3033e55…, sha256 7a122b3b…4947).
- Min originalrapport finns i repot som docs/qa/QA-REPORT-booking-day-4438941.md: sha256 d4e8274ee0b564e7f6e63a5885c075b832e266ad12e32ca572ae8d97508ded97, cmp-identisk med /workspace/qa/booking-lab-se/QA-REPORT-a2a-4438941.md.
- Riktad kontroll av A2A-QA-1..7 och relevanta regressioner. Ingen UI-granskning utöver webb-E2E, ingen ny modul, ingen CI/GitHub/preview/produktion/drift.

## 2. Diff d8562b8 mot 4438941 (8 poster)

- Kod: src/a2a/demo.ts (auth 401/WWW-Authenticate, Origin 403 separat, JSON-RPC-felobjekt, drain utan buffring över 16 KiB + Connection: close, serviceVersion obligatorisk i book).
- Test: tests/integration/a2a-demo.test.ts (401, serviceVersion saknad/gammal, nytt test för protokollfel/413/chunkad body/nästa anrop).
- Docs: ARCHITECTURE.md (+A2A-avsnitt med begränsningar), COMPLETE_BOOKING_DAY_PLAN.md (+fixvarv 1), HANDOFF.md, PROJECT_STATUS.md, ny docs/qa/QA-REPORT-booking-day-4438941.md, .gitattributes (+1 rad -text för rapporten).
- Oförändrat: src/lib, src/mcp, src/app, scripts/ (inklusive scripts/a2a-demo.ts), prisma/, package.json, package-lock.json, next.config.ts. Ingen kärnändring.

## 3. Egna körningar

Separat syntetisk kopia; fräsch embedded Postgres 127.0.0.1:56320 (icke-root, uid 1000) i isolerat netns (endast lo); TZ=Europe/Stockholm; env -u NODE_ENV; slumpad SESSION_SECRET i chmod 600-fil; endast @example.test. Sekventiellt.

| Kontroll | Resultat |
| --- | --- |
| npm ci | PASS |
| prisma generate / migrate / seed (6 fräscha DB) | PASS, 12/12 migrate+seed |
| lint / tsc / build | PASS / PASS / PASS |
| unit | 114/114 |
| full integration | 128/128 (+1 nytt A2A-test) |
| riktad a2a-demo.test.ts ×3, fräsch DB | 3/3, 3/3, 3/3 |
| webb-E2E produktion workspace.spec.ts + flow.spec.ts | 24/24 |
| npm audit full / --omit=dev | 7 moderate (typescript-eslint-kedjan, minimatch), 0 high/critical / 0 |
| SDK endast dev | package.json devDependencies 1.3.0, ingen dependency; 0 filer i .next/server och .next/static med @a2a-js, A2A_LOCAL_DEMO_REFUSED, agent-card.json, JsonRpcTransportHandler eller booking-lab-local-demo |
| egen wire-probe, fullt läge ×3 | 63/64 varje gång; enda FAIL = min för snäva RSS-tröskel M-1, se 4.6 |
| separat minnesskalningsprov ×2 | ingen proportionell tillväxt (500 MB → +3 MB) |
| verkligt CLI | 22/22 |
| negativa kontroller (4) | alla fångade, återställda, cmp identiska |
| probe efter återställning | 45/46 (samma M-1-tröskel) |

## 4. Wire-probe (probes/probe.mts, child.mts, mem.mts) och CLI (probes/cli.mts)

Officiell @a2a-js/sdk ClientFactory/DefaultAgentCardResolver/JsonRpcTransportFactory med bearer-fetch mot startA2aDemo(); rå HTTP via fetch och node:http med keep-alive-agent (maxSockets 1); webb på node scripts/server.mjs (produktionsbygge); MCP via stdio.

4.1 Auth och Origin (3/3)
- AgentCard och /a2a: saknad, fel (samma längd), för kort och gemen "bearer" samt token i URL → 401, tom kropp, WWW-Authenticate: Bearer realm="booking-lab-local-demo". 10/10 fall.
- Origin (giltig bearer, "null", utan bearer) → 403 utan auth-challenge.
- SDK-discovery: 1 autentiserat kortanrop; SendMessage fungerar.

4.2 JSON-RPC-fel (6/6), alla utan stack/PII
- "{not json" → {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}.
- GetTask, legacy message/send, tasks/get → -32601 med eko av id ("id-gt", 7, "id-tg").
- Saknad, 0.3 och 1.1 A2A-Version → -32009 "Version not supported" (SDK VersionNotSupportedError, ErrorInfo VERSION_NOT_SUPPORTED) med id-eko.
- Ogiltiga params → SDK -32602 "message.messageId is required." med id-eko (HTTP 200).
- null, [], jsonrpc "1.0", objekt-id → -32600 (id null där id är ogiltigt, annars eko).
- Okänd väg / GET /a2a → 404; korrekt rå SendMessage → 200 med samma id.

4.3 413, drain och keep-alive (6/6)
- 50 iterationer på en keep-alive-socket, växelvis Content-Length 16 385 B, chunkad 16 385 B utan Content-Length och 2 MB → 50/50 413 med Connection: close; efterföljande AgentCard-GET och SendMessage 50/50 OK; 0 ECONNRESET. Ingen ECONNRESET i hela proben (S-15).
- ~15,9 KB och exakt 16 384 B → 200.
- Långsam trickle 17 000 B (100 B/3 ms, chunkad) → 413; trickle under gränsen → 200; nästa anrop OK.
- Oautentiserad 2 MB → 401, nästa anrop på samma agent OK.
- Content-Length 1 GB, 20 KB skickat och sedan tyst: inget svar inom 4 s; servern väntar på hela den deklarerade kroppen (A2A-F1-QA-1). Servern svarar andra klienter normalt efter avbrott.

4.4 Tjänstversion (3/3)
- book utan serviceVersion → 400, ingen bokning; gammal version → 409 "Uppgifterna har ändrats. Läs in på nytt."; aktuell version → bokning.

4.5 Regressioner (alla PASS)
- Startgrindar 12/12 (opt-in saknas/0/"true", NODE_ENV=production, VERCEL/VERCEL_ENV/VERCEL_URL, icke-_test-DB, icke-loopback-DB, kort/saknad SESSION_SECRET; positiv kontroll binder 127.0.0.1 även med HOST/HOSTNAME=0.0.0.0).
- Kundprofil 11/11 (inga cancel/list/move/get; förfalskade kund-/verksamhetsfält, confirmed≠true och icke-UUID nekas; ingen annan kunds data).
- Idempotens 5/5 (samma nyckel → samma bokning, ändrad payload 409, 20 parallella retries → 1 rad).
- 20 parallella SendMessage olika nycklar samma tid → exakt 1 bokning.
- Blandat webb/MCP/A2A 6+6+6 samma tid, 3 rundor × 3 körningar → exakt 1 bokning varje runda (vinnare a2a, mcp, web förekom), 0 överlapp.
- Kvoter: attemptgräns 30/15 min (8/15 extra → 429), 3 bokningar/dag/e-post, delad med webb.
- Tre vägar: samma snapshot-fält, 1 create-händelse, ömsesidig blockering; ägar-MCP avbokar A2A-bokning.
- Dataminimering: 128 A2A-svar utan token, hemlighet, DB-URL, PII, interna fält eller stack. Token i 0 filer (run-mapp, /tmp, npm-loggar).

4.6 Minne (M-1 och separat skalningsprov)
- Probe-M-1 (separat serverprocess, 50 MB chunkad): 413 efter fullständig dränering, servern svarade under och efter (parallella kortanrop ≤1 ms). Min tröskel "<20 MB RSS-ökning" föll: +30–45 MB vid första stora kroppen.
- Skalningsprov ×2 (mem.mts, klienten bekräftar att hela kroppen skrivits innan svaret kom): 10 MB +4–10 MB; 50 MB +25–37 MB; 200 MB +29–42 MB; 500 MB +3 MB; ny 50 MB +0–2 MB. RSS planar ut på ≈182–185 MB (VmHWM) oavsett 500 MB. Det är heap-/GC-tillväxt, inte buffring. Claim "drain utan buffring över 16 KiB" bekräftad.

4.7 CLI (22/22)
- Utan opt-in: A2A_DEMO_FAILED, exit 1. Ingen bokning för "boka", "BOKA ", " BOKA", "Boka", "BOKA!", tom rad, EOF efter val, EOF direkt, stängd stdin, Enter vid val, val 0 och val 999.
- Visar behandling, utförare, längd, pris, numrerade tider och sammanfattning före BOKA. Exakt BOKA → exakt 1 bokning på vald tid (CLI skickar serviceVersion), relativ adminadress, ingen token i utdata; syns i admin-API/-sida; ägar-MCP avbokar → cancelled v2, create+cancel.

4.8 Negativa kontroller (src/a2a/demo.ts i kopian, återställd + cmp identisk)
- NC1 401→403: S-1-kort, S-1-RPC och S-8c FAIL.
- NC2 drain och Connection: close borttagna (break vid överstorlek): S-7 FAIL — Connection close 0/50, 16 av 50 följande anrop ECONNRESET. Bekräftar att fixen åtgärdar A2A-QA-3.
- NC3 serviceVersion valfri igen: V-0 FAIL (och följdfel).
- NC4 -32601/-32700 ersatta med tom 400: S-9 och S-10 FAIL.
- (M-1 föll även i NC-körningarna p.g.a. samma tröskel.)

## 5. Tidigare fynd

| Fynd | Status | Bevis |
| --- | --- | --- |
| A2A-QA-1 403 utan challenge | STÄNGT | 401 + WWW-Authenticate: Bearer på kort och RPC, Origin 403; NC1 |
| A2A-QA-2 icke JSON-RPC-fel | STÄNGT | -32700/-32600/-32601/-32009/-32602 med id-eko; NC4 |
| A2A-QA-3 ECONNRESET efter 413 | STÄNGT | 50/50 utan reset inkl. chunkad/2 MB/trickle; NC2 återskapar reset |
| A2A-QA-4 public-etikett i historik | ÖPPET, dokumenterad begränsning | ARCHITECTURE.md och PROJECT_STATUS.md beskriver korrekt public/booking-channel och clientKey-HMAC; probe I-5 bekräftar |
| A2A-QA-5 gemensam demokund/kvot | ÖPPET, dokumenterad begränsning | ARCHITECTURE.md "högst tre bokningar per dag och e-post" stämmer med Q-1 |
| A2A-QA-6 status/handoff | STÄNGT | HANDOFF.md och PROJECT_STATUS.md har A2A-avsnitt; ARCHITECTURE.md uppdaterad. VERIFICATION.md saknar A2A-resultat (Info) |
| A2A-QA-7 serviceVersion valfri | STÄNGT | demo.ts:39 z.number().int().positive(); V-0; NC3 |

## 6. Nya fynd

Blockerare (Medium+): **inga**.

**A2A-F1-QA-1 — Low — överstor kropp dräneras utan tak eller tidsgräns**
Fil: src/a2a/demo.ts:181-191. Repro: autentiserad POST /a2a med Content-Length 1 000 000 000, skicka 20 KB och vänta → inget 413 inom 4 s; servern läser tills hela kroppen kommit eller Nodes requestTimeout slår till. 500 MB chunkad dräneras helt innan 413. Påverkan begränsad: kräver processens bearer och loopback, minnet påverkas inte.
Acceptans: deklarerad Content-Length > 16 KiB ger 413 direkt; dränering avbryts efter t.ex. 1 MiB eller några sekunder och anslutningen stängs; nästa anrop på ny anslutning fungerar.
Riktning: svara 413 + Connection: close direkt vid för stor Content-Length; för chunkat sluta lagra vid 16 KiB, dränera högst ett tak och därefter request.destroy() efter att svaret skickats.

**A2A-F1-QA-2 — Info — blandad HTTP-status för JSON-RPC-fel**
Egna protokollfel ger HTTP 400 (internfel 500), SDK:ns param-fel HTTP 200. Kroppen är korrekt JSON-RPC i båda fallen; SDK-klienten klarar båda.

**A2A-F1-QA-3 — Info — VERIFICATION.md saknar A2A-körningar**
Status/handoff/arkitektur uppdaterade; den råa resultatfilen nämner ännu inte A2A.

## 7. Codex-påståenden

| Påstående | Status |
| --- | --- |
| Originalrapporten lagrad byte-identiskt, sha d4e8274e…ded97 | CONFIRMED (docs/qa/QA-REPORT-booking-day-4438941.md, cmp identisk) |
| A2A-QA-1: 401 + WWW-Authenticate Bearer; Origin 403 | CONFIRMED |
| A2A-QA-2: JSON-RPC-fel -32700, -32601, SDK VersionNotSupported, utan stack | CONFIRMED |
| A2A-QA-3: 413 + Connection close, dränering utan buffring över 16 KiB, ingen ECONNRESET, chunkad/2 MB/nytt anrop | CONFIRMED (50 iterationer; minnet planar ut); se A2A-F1-QA-1 om obegränsad dränering |
| Tidig patch gav ECONNRESET, slutpatchen dränerar före 413 | Mekanismen CONFIRMED genom NC2; Codex mellanversion UNVERIFIABLE |
| 3 riktade körningar 3/3 | CONFIRMED (egna 3/3 ×3) |
| A2A-QA-7: serviceVersion obligatorisk | CONFIRMED |
| A2A-QA-4/5 dokumenterade begränsningar | CONFIRMED, korrekt mot kod |
| A2A-QA-6 status/handoff uppdaterade | CONFIRMED |
| Ingen kärnändring | CONFIRMED |
| CI 43593764129 på d8562b8 | UNVERIFIABLE (ej inspekterad enligt uppdrag) |

## 8. Faktiska kommandon och resultat

Box (utanför netns):
- sha256sum / stat -c %s / unzip -z / unzip -l / unzip -Z1 på zip → värden i avsnitt 1.
- diff -rq base src → 8 poster; sha256sum + cmp av docs/qa/QA-REPORT-booking-day-4438941.md → d4e8274e…ded97, identisk.
- env -u NODE_ENV npm ci → 0.
- grep -rlE '@a2a-js|A2A_LOCAL_DEMO_REFUSED|agent-card\.json|JsonRpcTransportHandler|booking-lab-local-demo' .next/server .next/static → 0 filer.
- npm audit --json → exit 1, 7 moderate; npm audit --omit=dev --json → exit 0, 0.

I netns (env -u NODE_ENV unshare -rn … unshare --user --map-user=1000), matrix-ns.sh:
- npx prisma generate → 0; npm run db:migrate / db:seed ×6 → 0.
- npm run lint → 0; npx tsc --noEmit → 0; RATE_LIMIT_STORE=memory npm test → 114/114; npm run build → 0.
- RATE_LIMIT_STORE=postgres npm run test:integration → 128/128.
- npm run test:integration -- tests/integration/a2a-demo.test.ts ×3 → 3/3 varje.
- E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/flow.spec.ts → 24 passed.

I netns, probe-ns.sh och mem-ns.sh:
- PORT=3000 TRUSTED_PROXY_IPS=127.0.0.10/32 node --env-file=.env scripts/server.mjs --hostname 127.0.0.1.
- node --import tsx qa-probe/cli.mts (15 körningar av npm run -s demo:a2a -- massage staff-demo 2026-12-04) → 22/22.
- node --import tsx qa-probe/probe.mts full ×3 → 63/64 ×3.
- NC1–NC4 (sed/python i kopian → probe.mts a2a-only → återställ → cmp): 42/46, 45/46, 38/46, 43/46; alla "restored cmp=identical". probe-post → 45/46.
- node --import tsx qa-probe/mem.mts ×2 → tabell i 4.6, efteråt 200.

## 9. NOT RUN

- CI-körning 43593764129 (exakt d8562b8) — ej inspekterad, UNVERIFIED.
- Extern/tredjeparts A2A-klient, streaming/tasks/push, gRPC/REST.
- Full E2E-matris och dev-läge; endast 24 produktionstester.
- Interaktiv TTY/riktig ctrl-C för CLI.
- Långtidsprov av requestTimeout (300 s) för obegränsad dränering.
- Preview, produktion, Docker-image, GitHub.

## 10. Scoped GO/NO-GO

- d8562b8, syntetisk lokal A2A-provväg med oförändrad webb/MCP-kärna: **GO**. A2A-QA-1, 2, 3, 6, 7 stängda; 4 och 5 korrekt dokumenterade begränsningar; nya fynd 1 Low + 2 Info. Ingen FIX-REQUEST.
- Pilot, mainmerge, produktion, fjärr-/publik A2A: **NO-GO** här.

## 11. Artefakter (sha256-prefix, under a2a-f1-d8562b8/run/)

probes/probe.mts d54eb7e8cb70; probes/cli.mts d4d0a2b8f57e; probes/child.mts c4a686b69737; probes/mem.mts 7bdd0d8d2a14; probes/start.mts cf0f7b2c9c2d; probe-ns.sh 7a1f723f0789; matrix-ns.sh 5b3576823da6; mem-ns.sh 965eb12753ef; logs/summary.log ece738db99b5; logs/probe-summary.log 0e8facdbd1f1; logs/cli.log e2359232f88e; logs/probe-full-1.log ceea639791a0; logs/mem.log 20b5cb4cd9ea; logs/diff-d8562b8-vs-4438941.txt e3cfb9379fcd; logs/audit-full.json fd955825bf30; logs/audit-prod.json c2fc49a7aa44.

## 12. Städning och lösa processer

- Före start: inga next-server-, server.mjs-, MCP- eller Postgres-processer från QA-mappar.
- Servrar avslutades via faktiska node-PID:er (scripts/server.mjs direkt, inte npm-wrapper), samt pkill på src/mcp/server.ts, qa-probe/child.mts och next-server; Postgres stoppad. Slutkontroll 13:24 CET: inga next-server/server.mjs/MCP/probe/Postgres/Playwright/Vitest-processer kvar.
- Raderat: pgdata, work/node_modules, work/.next, work/.env, work/qa-probe, test-results, /tmp/a2f1sec (hemlighet), /tmp/a2f1ns. Originalzip orörda; kopians källkod cmp-identisk med arkivet.
- Noterat, ej raderat (äldre körmappar från 13 november, inga processer igång): pgdata kvar i epic06-024796f, fix1-7c1407d, lifecycle-e2e0e39, lifecycle-fix1-95f8071, proactive-956155f, proactive-fix1-8843d06, timecard-a65f0f2, ui-d7bc47f, ui-dd98ae4, ui-f737ed2 (≈100–150 MB vardera) samt node_modules (938 MB) och .next (69 MB) i lifecycle-e2e0e39/run/work.
