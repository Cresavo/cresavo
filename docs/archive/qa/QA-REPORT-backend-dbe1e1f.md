# QA-rapport — backendprov API/MCP, Booking Lab SE (dbe1e1f)

Granskare: Grok Bot (oberoende, fixvarv 0 av max 2). Datum: 2026-11-14, Europe/Stockholm.
**Verdikt: GO (avgränsat, endast syntetisk lokal miljö).** Pilot, mainmerge och produktion: NO-GO / separat beslut.

## 1. Omfattning

- Exakt granskad revision: **dbe1e1f5edcc6fcee69651e7d4ed334ddd507aa8** (zipkommentar).
- ZIP: attachments/7634fe2d04d0349ddd6aed35961e731498522d13d559fbe9d9899bc67ef1fc54.zip, egen sha256 **7362850c333cc77d501f95b2d06aa754c763fe969a375cbd875ea3d63148f7ea**, 8 546 897 B, 760 poster. Enda env-fil: .env.example. docs/calendar-proof/private.json och *secret-scan.json ej lästa.
- **Faktisk diffbas: 9a8350a7d68a0a14d7b345bca3e53f5ace76d823** (zip 2c4b55c6…, sha256 a1bb8029b5a7…). Ingen zip med kommentar 56579bd finns i attachments (alla 35 zipfilers kommentarer genomsökta); ingen .git i arkivet. docs/API_MCP_BACKEND_PLAN.md anger själv "Bas 56579bd, produkt 9a8350a". Påståenden mot 56579bd gäller därför via 9a8350a.
- Ingen UI-granskning, ingen ny modul, ingen driftåtkomst, inget nätverk utöver läsande npm audit-registerfråga.

## 2. Diffgranskning (dbe1e1f mot 9a8350a)

Ändrade filer (diff -rq, 17 poster):
- tests/integration/mcp-workspace.test.ts — enda kod-/teständring: avbokningen görs nu som 20 parallella anrop med samma clientRequestId, alla svar ska vara lika (toEqual), exakt 1 BookingEvent "cancel", och samma nyckel med ändrad payload (expectedVersion 3) ska ge isError.
- Nya docs: docs/API_MCP_BACKEND_PLAN.md, docs/qa/QA-REPORT-mobile-story-9a8350a.md, docs/assets/mobile-story/ (booking-proof.json, ci-proof.json, preview-*.json ×4, full-day-before/after.png, product-after.png).
- Ändrade docs: ARCHITECTURE.md (verifieringskarta, +17 rader), HANDOFF.md, PROJECT_STATUS.md, assets/mobile-story/customer-return-after.png.
- .gitattributes: +1 rad "docs/qa/QA-REPORT-mobile-story-*.md -text".

Kontroller: hela src/ byte-identisk (diff -rq tom). package.json, package-lock.json, prisma/ (schema+migrationer), next.config.ts, scripts/, plugins/ identiska. Därmed inga nya MCP-verktyg, ingen schema-/migrations-/paketändring.

## 3. Egna körningar

Separat syntetisk kopia, fräsch embedded Postgres (icke-root, uid 1000 i user-ns), isolerat nätverksnamnrum (unshare -rn, endast loopback), TZ=Europe/Stockholm, env -u NODE_ENV, SESSION_SECRET slumpad per körning, endast @example.test-data, port 3000 endast i netns. Sekventiellt.

| Kontroll | Resultat |
| --- | --- |
| npm ci | PASS |
| prisma generate / migrate deploy / seed | PASS (10 migrationer tillämpade) |
| lint | PASS |
| tsc --noEmit | PASS |
| build (next build) | PASS |
| unit | 114/114 PASS |
| full integration (egen _test-DB) | 125/125 PASS, 26/26 filer |
| riktad mcp-workspace.test.ts ×3 (fräsch DB varje gång) | 5/5, 5/5, 5/5 PASS (0 flaky) |
| produktions-E2E "HTTP och lokal MCP …" | 2/2 PASS (desktop+mobil) |
| dev-E2E samma test, fräsch kopia | 2/2 PASS — "gammal serverlåsning" reproducerades INTE |
| kartans E2E: workspace.spec.ts + flow.spec.ts, produktion | 24/24 PASS (12 test × 2 projekt) |
| npm audit full | 7 moderate (@typescript-eslint/* ×5, typescript-eslint, minimatch), 0 high/critical |
| npm audit --omit=dev | 0 sårbarheter |
| egen stdio-MCP/HTTP-probe, fullt läge ×3 | 44/44 PASS varje gång (132/132) |
| probe efter återställning (mcp-only) | 40/40 PASS |
| negativa kontroller (5 st) | alla fångade, källfiler återställda, cmp identiska |

Databas efter körningarna: inga kvarlämnade bokningar/händelser/WorkspaceRequest i test-DB:erna.

## 4. Verklig stdio-MCP-probe (probes/probe.mts)

Klient @modelcontextprotocol/client + StdioClientTransport mot node --import tsx src/mcp/server.ts (som i repo). HTTP mot produktionsserver (npm run start) i samma netns med syntetisk admin skapad via createAdminUser.

- Handshake: initialize + tools/list; serverinfo booking-lab-se 0.1.0; med --admin --allow-workspace 20 verktyg inkl. create_booking, list_workspace_bookings, get_booking, get_move_availability, move_booking, cancel_booking. PASS.
- Opt-in (5/5): utan flaggor endast list_services, get_availability. Med bara --admin: läsverktyg men inga skrivverktyg. --allow-workspace utan --admin och kort SESSION_SECRET: process avslutas med MCP_WORKSPACE_CONFIG_INVALID. Anrop till cancel_booking utan opt-in: protokollfel -32602 "Tool cancel_booking not found".
- Skapa (5/5): svar endast id/serviceId/startsAt/endsAt; replay samma nyckel+payload ger samma bokning (1 rad); samma nyckel ändrad tid nekas ("Bokningsnyckeln har redan använts…"); upptagen tid nekas; kund utanför example.test nekas.
- Kalender/tillgänglighet (5/5): get_availability; list_workspace_bookings ger exakt 7 fält (id, serviceId, staffId, startsAt, endsAt, status, version); intervall >31 dagar nekas; get_booking utan kundfält och utan actorId i händelser.
- Flytta (7/7): 20 parallella identiska retries ger semantiskt samma svar, v2, exakt 1 move-händelse; samma nyckel ändrad payload nekas; gammal version med ny nyckel nekas ("Uppgifterna har ändrats…"), bokningen orörd; flytt till upptagen tid nekas och ursprunget behålls; ogiltig indata och förfalskat extra fält (businessId) nekas.
- Avboka (7/7): gammal version nekas; utan confirmed=true nekas; 20 parallella identiska retries ger samma svar, v3, exakt 1 cancel-händelse; samma nyckel ändrad payload nekas; replay därefter oförändrad; flytt av avbokad nekas; frigjord tid kan bokas igen.
- Främmande resurser (7/7): bokning/tjänst/personal i annan businessId (qa-foreign) — get_booking, get_move_availability, move_booking, cancel_booking ger exakt samma text som för okänt id ("Bokningen finns inte"), ingen existensläcka; främmande bokning orörd, 0 händelser, syns inte i kalendern; skapa på främmande tjänst nekas.
- HTTP mot MCP (4/4): inloggning 200; främmande origin 403 utan ändring; 5 rundor × (20 parallella avbokningar, 10 HTTP + 10 MCP, olika nycklar, samma version) och (12 blandade HTTP/MCP-flyttar och avbokningar): exakt 1 vinnare och exakt 1 historikhändelse i 5/5 rundor; 0 aktiva överlapp.
- Dataminimering (2/2): 78 MCP-svar genomsökta — inga kundnamn, e-post, "Främmande kund", passwordHash, requestHash, idempotencyKey, actorId, aktörs-id, SESSION_SECRET, DATABASE_URL, Prisma-text eller stackspår.

Negativa kontroller (endast i min kopia, återställda med cmp = identisk):
- NC1: tog bort requestHash-kontrollen i src/lib/workspace-write.ts:71-75 → proben FAIL på MV-2 och CN-4 (38/40); repo-testet FAIL (1/5, rad 255).
- NC2: tog bort versionskontrollen i src/lib/booking-mutations.ts:116-117 → proben FAIL 7/40 (MV-3, MV-4, MV-6, CN-1, CN-2, CN-3, CN-7); repo-testet FAIL 2/5.
- NC3: stängde av payloadkontrollen endast för cancel_booking → det NYA testet FAIL på mcp-workspace.test.ts:281 (1/5). Den nya assertionen har alltså egen bevisverkan.

## 5. Verifieringskartan (ARCHITECTURE.md) mot faktiska tester

| Kartans rad | Test finns | Kört själv |
| --- | --- | --- |
| Skapa, kalender, detaljer, snapshots, begränsade svar | mcp-workspace.test.ts:166 | PASS ×3 |
| 20 identiska flytt- och avbokningsretries | mcp-workspace.test.ts:219, :260 | PASS ×3 |
| Ändrad payload, gamla versioner, främmande resurser, saknad opt-in | mcp-workspace.test.ts:139, :166, :318 | PASS ×3 |
| 20 bokningsretries, blandade längder | mcp-booking.test.ts:193, :206 | PASS (full integration) |
| HTTP/MCP-konkurrens, SQL-överlapp, admin visar bokning | workspace.spec.ts:92 | PASS prod 2/2, dev 2/2 |
| Inloggning, origin, sessioner, serverhärledd aktör | flow.spec.ts, workspace.spec.ts | PASS 24/24 prod |

Alla kartans påståenden har existerande, passerande tester. Kartans uttalande att HTTP-listor innehåller kundnamn för behörig yta och att MCP-kalendern saknar dem stämmer med koden (src/mcp/workspace.ts:198-230).

## 6. Fynd

Blockerare (Medium+): **inga**.

Backlogg:

**BE-QA-1 — Low — replay ger annan JSON-nyckelordning än första svaret**
Fil: src/lib/workspace-write.ts:76 (return existing.result) + src/mcp/reply.ts:25-29.
Repro: 20 parallella move_booking med samma nyckel; första svaret {"id","serviceId","staffId",…}, replays från jsonb {"id","endsAt",…}; 2 olika råtexter av 20. Innehållet är identiskt (repo-testet använder toEqual).
Acceptans: alla replays byte-identiska med första svaret, eller dokumenterat att endast semantisk likhet garanteras.
Riktning: returnera bookingSummary(...) i fast ordning även vid replay, eller kanonisera före JSON.stringify i reply.

**BE-QA-2 — Low — inbäddad "originalrapport" är inte byte-identisk**
Fil: docs/qa/QA-REPORT-mobile-story-9a8350a.md (länkad som originalrapport i HANDOFF.md:5 och PROJECT_STATUS.md:9).
Repro: jämför med min original QA-CLICKS-c9dbc52-9a8350a.md (10 231 B, sha256 4e88247d…): repokopian är 10 230 B, sha256 7bbd3a59…; enda skillnad är saknad avslutande LF. Ny .gitattributes-rad (-text) skyddar mot CRLF men inte mot förlorad LF.
Acceptans: repokopian cmp-identisk med originalet, eller texten anger att den är en kopia utan avslutande radbrytning.
Riktning: kopiera originalfilen byte för byte och verifiera med sha256 före commit.

**BE-QA-3 — Info — cancel på redan avbokad bokning med aktuell version och ny nyckel lyckas som no-op**
Fil: src/lib/booking-mutations.ts:206. Ingen ny händelse, ingen versionsökning; konsekvent och säkert. Notera för API-kontraktet.

**BE-QA-4 — Info — idempotensnycklar är kanalscopade**
src/lib/workspace-write.ts:57-59: nyckeln hashas med aktör, så samma nyckel via HTTP-admin och lokal MCP är två olika förfrågningar. Konkurrensen skyddas ändå av version + radlås (probe HT-2 5/5). Dokumentera för klienter.

## 7. Codex-påståenden

| Påstående | Status |
| --- | --- |
| Inga produktkodändringar vs 56579bd | CONFIRMED mot 9a8350a (src/ identisk); 56579bd självt UNVERIFIABLE (ingen zip/git) |
| Inga nya verktyg | CONFIRMED (src/mcp identisk) |
| Ändringen = test av 20 parallella avbokningsretries med en händelse + nekad ändrad payload + verifieringskarta | CONFIRMED, plus docs/bevisfiler och .gitattributes-rad (endast docs) |
| 125 integration | CONFIRMED (125/125) |
| 5 riktade integration | CONFIRMED (5/5 ×3) |
| 2 produktion HTTP/MCP E2E | CONFIRMED (2/2) |
| 114 unit | CONFIRMED |
| lint/tsc/build PASS | CONFIRMED |
| Full audit 7 moderate, produktion 0 | CONFIRMED |
| Dev-E2E nekad av gammal serverlåsning | UNVERIFIABLE i Codex miljö; reproduceras inte på fräsch kopia (dev 2/2 PASS), vilket är förenligt med förklaringen |
| Testerna oförändrade utöver mcp-workspace | CONFIRMED |

## 8. NOT RUN

- Diff mot faktisk 56579bd (artefakt saknas).
- Full E2E-matris (alla spec-filer, alla fyra lägen); endast workspace.spec.ts + flow.spec.ts i produktion och HTTP/MCP-testet i dev.
- Fjärr-MCP, flera verksamheter i riktig drift, riktiga kunduppgifter, GitHub Actions, preview/produktion.
- Native MCP-klient (Codex/annan värd); endast SDK-klient över verklig stdio.
- Lasttest utöver 20 parallella anrop.

## 9. Scoped GO/NO-GO

- dbe1e1f, syntetisk lokal backend (HTTP + lokal stdio-MCP): **GO**. Inga Medium/High. Ingen FIX-REQUEST behövs.
- Pilot, mainmerge, produktion: **NO-GO** här (separat beslut).

## 10. Artefakter (sha256-prefix)

Under backend-dbe1e1f/run/: probes/probe.mts 9b7f96d1c362; probe-ns.sh 7241389da16f; matrix-ns.sh 454f37ea2ad9; nc-test-ns.sh 8906cfdc9a17; nc3-ns.sh c09f5cc2de1c; map-ns.sh 8bda846fe329; logs/summary.log a351fbcca01d; logs/probe-summary.log def9c9a844c4; logs/diff-vs-9a8350a.txt 7d757c76ff11; logs/test.diff 59df9927af59; logs/audit-full.json 6ecf81cfe121; logs/audit-prod.json 2501b7790b9d.

## 11. Städning

Postgres stoppad och pgdata raderad. Två kvarvarande produktionsservrar från probe-körningarna (startade via npm i netns; kill träffade bara npm) hittades vid städkontrollen och avslutades; inga kvarvarande node/postgres-processer. Raderat: work/node_modules, work/.next, work/.env, work/qa-probe, /tmp/be1sec (slumpad hemlighet), /tmp/be1ns. Originalzip orörd. Källfiler i kopian cmp-identiska med arkivet efter negativa kontroller.
