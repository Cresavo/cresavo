# QA-rapport: A2A-kanaletikett (actorId) · Booking Lab SE · cced211

Granskare: Grok Bot (oberoende QA, executor). Datum: 2026-11-14 (Europe/Stockholm).
Typ: avgränsad uppföljning, fixvarv 0 av max 2. Ingen ny stressmatris; tidigare godkännande av d8562b8 (rapport-SHA256 99003d5f…) återanvänds för oförändrade delar.

## 1. Sammanfattning och beslut

**Scoped GO – endast syntetisk lokal miljö.** Inga Medium/High/Critical-fynd. 2 Low, 2 Info.
Kundpilot, main, produktion, fjärr-A2A och preview: **NO-GO** (inte granskat; dokumentationen påstår inte heller pilotklarhet).

Ändringen är liten och gör det som påstås: nya A2A-create får actorKind public och servervalt actorId local-a2a-demo-channel:v1; skyddad historik visar Lokalt A2A-prov / Local A2A demo. Äldre rader (skapade med riktig d8562b8-kod) är byte-för-byte oförändrade. Rått kanal-id läcker inte i HTML, admin-HTTP, MCP, A2A eller publika sidor. Webb, admin-HTTP och MCP kan inte få A2A-etiketten.

## 2. Exakt granskad revision och indata

| Post | Värde |
| --- | --- |
| Granskad revision | cced2112349f0d1bd60fd1ba7e6a37bda36c68fa (zip-kommentar), branch feature/agent-client-pilot-readiness |
| Zip | attachments/b19223bc69842b8661b3e1e45bdfd25a1db6bac190471c3d32ecf2aa23668eab.zip |
| SHA256 (egen omräkning) | b5552407d8f99dc7817fde0d20f0b3ae575276379667025f7759e42ec782bc60 – stämmer |
| Storlek / poster | 8 597 578 B / 778 poster – stämmer |
| Env/hemliga filer i zip | endast .env.example + docs/calendar-proof/private.json + 2 *secret-scan.json (lästes inte) |
| Jämförelsebas | d8562b8190f52e7b76f3d4682ec6f3b84fd35732, zip 5a10f139…, SHA256 96d715b6… (tidigare verifierad) |
| 7998056 ≡ d8562b8? | **Går inte att verifiera** – arkivet är en git-archive-export utan .git. Verifierat är bara att cced211 mot d8562b8 skiljer sig i exakt två produktfiler (se 3). |

## 3. Diff cced211 mot d8562b8 (diff -rq, alla ändrade filer)

Produktkod (2 filer):
- src/lib/domain.ts:386-396 – createBooking: actorId = actor?.id ?? (clientAddress === "a2a:local-customer-demo:v1" ? "local-a2a-demo-channel:v1" : "booking-channel"). actorKind-uttrycket oförändrat (bara en kommentar tillagd).
- src/app/admin/bookings/[id]/page.tsx:50, 90-96 – selekterar actorId i serverkomponenten och projicerar public + local-a2a-demo-channel:v1 till etiketten; övriga etiketter oförändrade.

Tester (2 filer): tests/integration/a2a-demo.test.ts:151-156 (assert actorKind/actorId på create-händelsen), tests/e2e/coherence.spec.ts:9-86 (nytt historiktest sv/en).

Docs/övrigt: AGENTS.md, docs/ARCHITECTURE.md, COMPLETE_BOOKING_DAY_PLAN.md, DATA_FLOWS.md, HANDOFF.md, PRIVACY_SECURITY.md, PRODUCT_OWNER_REPORT.md, PROJECT_STATUS.md, VERIFICATION.md; nya docs/qa/QA-REPORT-booking-day-f1-d8562b8.md (cmp: **byte-identisk** med min rapport QA-REPORT-a2a-f1-d8562b8.md) och docs/qa/evidence-booking-day-d8562b8/ (4 json, ej granskade i sak).

Oförändrat (bekräftat via diff): prisma/ (schema + alla migrationer; CHECK actorKind IN ('admin','local-mcp','public') kvar i 20261112040000_booking_workspace), package.json, package-lock.json, src/a2a/ (AgentCard/SendMessage-form), src/mcp/ (verktygsscheman/utdata), src/app/api/ (HTTP-svar), src/lib/workspace-write.ts (WorkspaceActor), src/lib/rate-limit.ts och kvotlogiken i domain.ts, scripts/. Inga övriga avvikelser.

Enda skrivare av värdet: rg i hela trädet (utom docs) hittar local-a2a-demo-channel endast i domain.ts:394 (skrivning), page.tsx:91 (läsning) och två tester. Strängen a2a:local-customer-demo:v1 skickas endast av src/a2a/demo.ts:108. Webbens clientAddress kommer från verifiedClientAddress (scripts/client-address.mjs:138) som kräver giltig IP + HMAC-bevis som servern själv sätter (scripts/server.mjs:41-42) – kan aldrig bli "a2a:…". MCP använder fast mcp:local-booking-channel:v1, admin/arbetsyta skickar actor (actor.id vinner).

## 4. Egna körningar (isolerad netns, icke-root, ny embedded Postgres per steg, TZ=Europe/Stockholm, env -u NODE_ENV)

| Kontroll | Resultat |
| --- | --- |
| npm ci | PASS |
| prisma generate | PASS |
| migrate + seed (7 nya DB) | PASS 7/7; 10 migrationer applicerade |
| lint | PASS |
| tsc --noEmit | PASS |
| build | PASS |
| unit | PASS 114/114 |
| full integration | PASS 128/128 |
| riktad A2A-integration ×3, ny DB var gång | PASS 3/3, 3/3, 3/3 |
| full lokal produktions-E2E (E2E_PRODUCTION=1) | PASS **64/64** (32 desktop + 32 mobile), 1,5 min |
| nytt historiktest coherence.spec.ts:9 (sv+en) | PASS desktop och mobile (ingår i 64) |
| npm audit (full) | 7 moderate (dev), 0 high/critical |
| npm audit --omit=dev | 0 |
| @a2a-js/sdk | fortfarande devDependency; 0 träffar i .next/server/.next/static |
| egen actor-probe (SDK + rå HTTP + MCP stdio + admin-HTTP) | PASS **28/28** |
| äldre rader före/efter (row_to_json) | 4/4 events och 3/3 bookings identiska |
| negativa kontroller | 4/4 fångade av proben; repo-testerna fångar 2/4 (se AC-QA-1) |

## 5. Faktiska kommandon och resultat

Alla i unshare -rn (endast lo) + unshare --user (uid 1000), Postgres 127.0.0.1:56330, platshållar-SESSION_SECRET i /tmp (raderad).
- npm ci → rc 0
- npx prisma generate → rc 0
- npm run db:migrate; npm run db:seed (ac_gate_test, ac_int_test, ac_tgt1..3_test, ac_e2e_test, ac_probe_test) → rc 0 alla
- npm run lint → rc 0 (6 s)
- npx tsc --noEmit → rc 0 (5 s)
- env RATE_LIMIT_STORE=memory npm test → rc 0, Tests 114 passed (114)
- npm run build → rc 0
- env RATE_LIMIT_STORE=postgres npm run test:integration → rc 0, Tests 128 passed (128) (58 s)
- env RATE_LIMIT_STORE=postgres npm run test:integration -- tests/integration/a2a-demo.test.ts ×3 → rc 0, 3 passed (3) ×3
- env RATE_LIMIT_STORE=postgres E2E_PRODUCTION=1 TRUST_PROXY_IP=0 npm run test:e2e -- --reporter=list → rc 0, 64 passed (1.5m)
- npm audit --json / npm audit --omit=dev --json → moderate 7 / total 0
- basework (d8562b8-kod): node --env-file=.env --import tsx qa-probe/old.mts → rc 0, skapar äldre rader: oldA2A create public/booking-channel, oldWeb create public/booking-channel, oldMcp create local-mcp/booking-channel, oldWeb move local-mcp/local-workspace-channel:v1
- psql row_to_json-dump av BookingEvent/Booking före och efter
- PORT=3000 node --env-file=.env scripts/server.mjs --hostname 127.0.0.1 (produktionsbygge) + node --import tsx qa-probe/actor.mts full → SUMMARY 28/28 PASS
- node probes/cmp-old.mjs before after → events rows_before=4 identical=4 changed=0 missing=0; bookings rows_before=3 identical=3 changed=0 missing=0
- NC-körningar (patch i work-kopia, rebuild, ny DB, probe, ev. integration/E2E, återställning + cmp) → se 8

## 6. Actor-probe 28/28 (egen, oberoende)

Ny A2A-rad / idempotens:
- H-1 ny A2A-create via officiell SDK: public / local-a2a-demo-channel:v1 – PASS
- H-2 replay samma clientRequestId → samma bokning, 1 händelse – PASS
- H-3 20 parallella retries samma nyckel → 1 bokning, 1 create-händelse med nytt actorId – PASS
- H-4 replay av äldre A2A-nyckel skapad av d8562b8 → samma äldre bokning, ingen ny händelse, actorId kvar booking-channel – PASS

Spoofing:
- SP-1 A2A-payload med actorId/actorKind/channel/clientAddress/actor → 400 ×5 (strict), ingen bokning – PASS
- SP-2 message.metadata, part.metadata, extensions, contextId och HTTP-headers (x-actor-id, x-actor-kind, x-booking-client-ip, x-forwarded-for, x-channel) → bokning sparas med public/local-a2a-demo-channel:v1 (ignoreras) – PASS
- SP-3 extra data-part med actorId → 400 – PASS
- SP-4 vanlig webbokning → public/booking-channel – PASS
- SP-5 webb-payload actorId=local-a2a-demo-channel:v1, actorKind, clientAddress=a2a:… → 201 men booking-channel (fält strippas) – PASS
- SP-6 webb med spoofade x-booking-client-ip/proof/XFF/x-real-ip = a2a:… → servern skriver över, booking-channel – PASS
- SP-7 admin-HTTP create med actorId/clientAddress → 400 – PASS
- SP-8 MCP create_booking med actorId/clientAddress → isError (strict) – PASS
- SP-9 vanlig MCP-create → local-mcp (oförändrat) – PASS
- SP-10 alla händelser med det nya actorId kommer från A2A-ingången (create/public) – PASS

Visning (skyddad historik, produktionsserver):
- D-1 ny A2A: sv Lokalt A2A-prov, en Local A2A demo (även 20-retry-bokningen) – PASS
- D-2 äldre A2A-rad: Kund- eller bokningskanal / Customer or booking channel, ingen A2A-etikett – PASS
- D-3 äldre/ny webb: kundkanal; äldre flytt och MCP: Lokal agentanslutning / Local agent connection; inga A2A-etiketter – PASS
- R-5 ägar-MCP avbokar ny A2A-bokning; create-händelsen orörd (create:public, cancel:local-mcp) – PASS

Läckage (söksträngar: local-a2a-demo-channel, booking-channel, local-mcp, a2a:local-customer-demo, mcp:local-booking-channel):
- L-1 14 skyddade historiksidor sv/en inkl. RSC-payload: 0 träffar – PASS
- L-2 admin-HTTP GET /api/admin/bookings/[id] (5 st) + 3 listor: 0 råa id, 0 etiketter; samma nycklar för ny och äldre A2A (events: action, createdAt, next*/previous* – inget actor-fält) – PASS
- L-3 MCP get_booking ×3, list_bookings, list_workspace_bookings: 0 träffar – PASS
- L-4 31 A2A-svar: inga råa id/etiketter/actor-fält – PASS (not: SDK:n ekar klientens egen contextId; min spoof-contextId "booking-channel" ekades och filtrerades som eget eko, inte serverdata)
- L-5 publika sidor/API (/, /product, förvald bokningslänk, /api/services, /api/availability; sv+en): ingen kanal/etikett – PASS

Kort regression:
- R-1 RPC utan bearer → 401 + WWW-Authenticate: Bearer – PASS
- R-2 Origin → 403 – PASS
- R-3 17 KiB → 413 + Connection: close – PASS
- R-4 efterföljande giltigt anrop → 200 – PASS

Probe-teknik: för att få kvotutrymme (3 skapade bokningar/dag/e-post) backdaterades createdAt på två av probens egna NYA rader före SP-2; äldre rader rördes aldrig (bekräftat av dumpen). Första probeversionen hade tre egna förväntningsfel (fel slot vid äldre replay, fel etikett för LOCAL_WORKSPACE_ACTOR-flytt, eko av egen contextId) som rättades i proben, inte i produkten.

## 7. Äldre händelser oförändrade

Äldre rader skapades med riktig d8562b8-kod (basework = d8562b8-zip med samma node_modules; prisma identisk) innan någon ny kod rörde databasen. Efter hela proben (inkl. replay av den äldre A2A-nyckeln och 9 nya bokningar): BookingEvent 4/4 och Booking 3/3 byte-identiska som row_to_json-text. Äldre A2A-rad visar fortsatt generisk kundkanal; endast nya A2A-rader visar A2A-etiketten. Detsamma gällde i alla fyra NC-körningar.

## 8. Negativa kontroller (endast work-kopia, återställd + cmp identisk)

| NC | Patch | Egen probe | Repo-tester |
| --- | --- | --- | --- |
| NC1 | domain.ts: A2A-mappningen avstängd | FAIL H-1, H-3, SP-10, R-5, D-1 | integration a2a-demo 1 failed (ny DB); coherence-E2E failed (Lokalt A2A-prov saknas) |
| NC2 | page.tsx: etikettmappning borttagen | FAIL D-1 | coherence-E2E failed |
| NC3 | page.tsx: rått actorId renderas bredvid etiketten | FAIL L-1 | coherence-E2E **2 passed** (fångas ej) |
| NC4 | domain.ts:392: actorId tas från klientpayload | FAIL SP-5, SP-10 | integration 3/3 och coherence-E2E 2/2 **passed** (fångas ej) |

Alla fyra återställda; cmp mot original identisk; slutlig rebuild PASS.

## 9. Fynd

Blockerare (Medium+): **inga.**

**AC-QA-1 · Low · testtäckning för spoof och rått id saknas**
Fil: tests/e2e/coherence.spec.ts:41-43, tests/integration/a2a-demo.test.ts:151-156.
Repro: NC3 (rendera event.actorId) och NC4 (läs actorId från payload i domain.ts:392) – repo-testerna passerar, endast min probe fångar.
Coherence-testet skickar actorKind och clientAddress i payloaden men inte actorId, och kontrollerar inte att rått id saknas i HTML.
Acceptans: ett test som skickar actorId: "local-a2a-demo-channel:v1" via webb/admin/MCP-payload och kräver annan etikett/booking-channel; ett test som kräver att HTML (inkl. RSC) saknar local-a2a-demo-channel och booking-channel.
Fixriktning: lägg actorId i payload-claims i coherence.spec.ts:41 och en not.toContain på page.content(); eventuellt en integrationsassert för webbens POST.

**AC-QA-2 · Low · status-/verifieringsdocs beskriver inte uppföljningen**
Fil: docs/HANDOFF.md:25, docs/PROJECT_STATUS.md:22, AGENTS.md:23, docs/COMPLETE_BOOKING_DAY_PLAN.md:134, docs/PRODUCT_OWNER_REPORT.md:15, docs/VERIFICATION.md.
Statusdocs anger fortfarande "public-etikett i historiken" som öppen backlogg, och VERIFICATION/HANDOFF saknar cced211-resultat (128/114/64, audit). Planens punkt 1 ("redovisa läsning och bokning separat", COMPLETE_BOOKING_DAY_PLAN.md:6-8, 21-22) har ingen dokumenterad utfallstext: Codex ärliga besked (list_services/get_availability lyckades; klienten exponerar bara läsverktyg; ingen full klientbokning eller A2A-modellprov) finns inte i arkivet.
Acceptans: statusdocs skiljer äldre rader (generisk etikett kvar) från nya (A2A-etikett); verifieringsavsnitt för cced211 med faktiska siffror; klientprovets utfall och begränsning skrivna.
Fixriktning: endast docs; ingen produktändring.

**AC-QA-3 · Info · etiketten är kanal, inte identitet; äldre A2A-rader förblir generiska**
Avsiktligt och korrekt dokumenterat (DATA_FLOWS.md, PRIVACY_SECURITY.md, ARCHITECTURE.md). Äldre A2A-händelser går inte att skilja i historiken utan clientKey-HMAC. Ingen åtgärd.

**AC-QA-4 · Info · actorId hämtas nu till serverkomponenten**
page.tsx:50 selekterar actorId. I dag serialiseras det inte (L-1, 0 träffar i RSC-payload). En framtida omflyttning av händelselistan till en klientkomponent skulle kunna läcka det; AC-QA-1:s HTML-test skyddar mot det.

Räkning: Critical 0, High 0, Medium 0, Low 2, Info 2.

## 10. Codex-påståenden

| Påstående | Status |
| --- | --- |
| Bas 7998056 har samma produktkod som d8562b8 | UNVERIFIABLE (ingen .git); cced211 mot d8562b8 = 2 produktfiler |
| Ny A2A-create: actorKind public, servervalt actorId local-a2a-demo-channel:v1 | CONFIRMED (H-1, SP-1..3, kod) |
| Skyddad historik: Lokalt A2A-prov / Local A2A demo | CONFIRMED (D-1, E2E) |
| Äldre rader orörda | CONFIRMED (byte-för-byte, d8562b8-skapade rader) |
| Migrationer/schema orörda | CONFIRMED (prisma/ identisk; CHECK kvar) |
| WorkspaceActor och kvoter orörda | CONFIRMED (diff; workspace-write/rate-limit oförändrade) |
| Externa kontrakt orörda | CONFIRMED (src/a2a, src/mcp, src/app/api oförändrade; L-2/L-3 samma nycklar) |
| Integration A2A 20 retries → 1 bokning / 1 korrekt händelse | CONFIRMED (repo-test + H-3) |
| Coherence-E2E sv/en och oförändrad äldre publik metadata | CONFIRMED med reservation: testets "äldre" rad är samma rad omläst direkt efter skapande, inte en befintlig äldre rad (min probe täcker riktiga äldre rader) |
| Docs sammanfattar pilotgrindar utan att lova pilotklarhet | CONFIRMED (PRIVACY_SECURITY.md:3-24; inga pilotklarhetspåståenden). Tidigare preview/TLS/backup-bevis i tabellen ej omverifierade av mig |
| Första 127/128 föll på CHECK; rättat utan schemaändring | UNVERIFIABLE som historik; slutläget stämmer (ingen schemaändring, CHECK oförändrad) |
| Slutlig 128/128, 114 unit, lint/tsc/build PASS | CONFIRMED |
| Full lokal produktions-E2E 64 fall | CONFIRMED – egen körning 64/64 (Codex: pågick) |
| Audit 7 moderate dev / produktion 0 | CONFIRMED |
| Verkliga klientanrop: list_services/get_availability ok, endast läsverktyg, inte full klientbokning/A2A-modellprov | UNVERIFIABLE (sker utanför arkivet); ärligt avgränsat i uppdraget men inte dokumenterat i repo (AC-QA-2) |

## 11. NOT RUN

- CI/Actions (inkl. 43593764129) – inte inspekterat, enligt regel.
- Verklig agent-/modellklient, full klientbokning, fjärr-A2A, preview, produktion, pilotmiljö.
- WebKit/Safari, fysisk iPhone.
- Ny full stressmatris (413-skalning, 50 iterationer, minnesprov, startvakter, CLI) – återanvänt från godkänd d8562b8 eftersom src/a2a/ och scripts/ är oförändrade; endast kortregression R-1..R-4 körd.
- dev-läges-E2E och proxy-läge TRUST_PROXY_IP=1 (bara produktion, proxy 0).
- Innehållet i docs/qa/evidence-booking-day-d8562b8/*.json (ej sakgranskat).
- Verifiering av 7998056 (ingen git-historik).

## 12. Scoped GO/NO-GO

- Syntetisk lokal miljö (cced211, loopback-A2A, test-DB): **GO**. Low-fynden kan tas i nästa fixvarv eller som backlogg.
- Kundpilot, main/produktion, fjärr-A2A, preview: **NO-GO** (utanför scope; pilotgrindarna i PRIVACY_SECURITY är fortfarande öppna).

## 13. Artefakter

Run-mapp: /workspace/qa/booking-lab-se/a2a-actor-cced211/run/
- logs/diff-cced211-vs-d8562b8.txt, logs/summary.log, logs/commands.log, logs/*.log per steg, logs/e2e-prod-full.log, logs/audit-full.json, logs/audit-prod.json
- probes/actor.mts (28 kontroller), probes/old.mts (äldre rader via d8562b8-kod), probes/cmp-old.mjs, logs/probe-full.log, logs/probe-summary.log
- logs/before-ac_probe_test-*.jsonl och after-*.jsonl (row_to_json-dumpar), logs/nc*.diff, logs/probe-nc*.log, logs/int-nc*-fresh.log, logs/e2e-nc*.log
- Skript: matrix-ns.sh, probe-ns.sh, probe-main-ns.sh, probe-fix-ns.sh, nce-ns.sh

## 14. Städning

Alla servrar stoppade via PID + pkill på scripts/server.mjs och next-server; Postgres stoppad. En kvarlämnad postgres (PID 757636, från min egen andra probekörning vars stopp-rad hamnade i en oanropad funktion) hittades och stoppades med SIGINT innan nästa körning. Slutkontroll: inga kvarvarande postgres-, next-, server.mjs-, playwright-, vitest- eller tsx-processer. Raderat: work/node_modules, work/.next, test-results, playwright-report, basework/node_modules (symlänk), pgdata, work/.env och basework/.env (endast icke-hemliga flaggor), /tmp/acsec (platshållarhemlighet), /tmp/acns. Originalzip och originalrepo orörda; inga .env-/secret-/private.json-filer lästa.
