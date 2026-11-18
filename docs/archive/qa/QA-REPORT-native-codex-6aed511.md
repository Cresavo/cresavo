# QA-rapport: native-codex consent-prov, salong 6aed511 (rättningsvarv 1 av max 2)

Datum: 2026-11-16 07:38–07:55 (Europe/Stockholm). Körmapp: /workspace/qa/booking-lab-se/native-codex-6aed511/

## Omfattning
Avgränsad, oberoende kod-/bevisgranskning och egna lokala prov av opt-in-harnessen npm run test:pair -- --native-codex (native-codex.mts, codex-events.mjs, run.mts-ändring, salon-calendar.mts-skärmbild, tests/native-proof-events.test.ts, docs). Gateway f9b8506 oförändrad och inte omgranskad. Inga gamla epics omgjorda. Ingen pilotbedömning. Jag har INTE kört --native-codex eller någon Codex-/assistentklient; allt om den verkliga CLI-körningen är kod- och bevisgranskning, UNVERIFIABLE som eget klientprov. Mina egna HTTP-prov är rå HTTP, inte en assistent.

## SHA, bundle och HEAD
- salon.bundle: 12146 B, sha256 a3de5d273216d5a4f35ae4150bbbc3abb9fbf5a3f7c05262705e341a60d3e245 (stämmer). git bundle verify: okay, kräver e6702c5, ref refs/heads/proof/native-codex-consent = 6aed5110e44c0247d93c470e8d2ef6f95072afbe.
- Privat origin night/gateway-salon-integration hämtad läsande till ny kopia (push-URL DISABLED): e6702c5fa1945f9b38b3ec4e48cea6571f58b74f (stämmer). Salong detached HEAD 6aed5110e44c… .
- git log e6702c5..6aed511: 6aed511 Add opt-in native Codex consent-to-calendar acceptance proof; b9a790f docs: verify remaining dependency upgrade blockers (endast docs/DEPENDENCY_REVIEW.md, +40).
- git diff --stat e6702c5 6aed511 (7 filer, +391/−2): docs/DEPENDENCY_REVIEW.md, docs/GATEWAY_SPLIT.md, scripts/agentprov/codex-events.mjs (ny), scripts/agentprov/native-codex.mts (ny), scripts/agentprov/salon-calendar.mts (+1/−1, valfri skärmbild), scripts/integration/run.mts (+10/−2), tests/native-proof-events.test.ts (ny). Diff mot src/, prisma/, package.json, package-lock.json: TOM. Inga produkt-, API-, schema-, migrations- eller beroendeändringar: CONFIRMED.
- Gateway: färsk läsande klon, origin/main = e1830fee14484a84aedb5806898725b9965ac1ba; återanvänd bundle sha256 2170a0e96492fab7e4be7028ffa992cf8d8483d7ba84b6bc17e2ffd2a447e219 verify okay; HEAD f9b8506cee3e3cd21bd279e01addf761cd3db1ed. Båda trädens git status rena efteråt.

## Gates (en körning var, inga omkörningar)
| Gate | Status | Resultat |
|---|---|---|
| Bundle/SHA/HEAD/diff-omfång | VERIFIED | PASS |
| npm ci salong + gateway (utanför netns, se avvikelser) | VERIFIED | PASS |
| prisma generate, migrate (18), seed på färsk nc_gate_test | VERIFIED | PASS |
| tests/native-proof-events.test.ts | VERIFIED | PASS 6/6 |
| Full unit (RATE_LIMIT_STORE=memory) | VERIFIED | PASS 408/408, 43 filer |
| Lint (eslint .) | VERIFIED | PASS, 0 fynd |
| tsc --noEmit | VERIFIED | PASS |
| Build | VERIFIED | PASS |
| Consent-/mandat-/proposal-integration (customer-consent, sms-otp, agent-usp, agent-bookings, agent-audit, mock-partner-gateway) på färsk nc_int_test | VERIFIED | PASS 41/41, 6 filer, 5,25 s |
| Vanlig npm run test:pair (utan flagga), GATEWAY_PATH=gatewaykopian | VERIFIED | PASS 19/19, dirty=false, 0 kvarvarande rader/processer |
| Eget rå-HTTP consent-prov C1–C15 | VERIFIED | PASS 15/15 |
| Städning + hemlighetsgrep | VERIFIED | PASS, 0 träffar |
| Full integrationssvit inkl. agent-workday.test.ts | NOT RUN | – |
| --native-codex / verklig Codex CLI | NOT RUN (förbjudet) | UNVERIFIABLE |

## Granskning a–g
a. Opt-in. Flaggan läses ur argv (run.mts:14); utan flagga är salongsmiljön oförändrad: BOOKING_PUBLIC_ORIGIN = gatewayOrigin och ingen consent-lab (run.mts:105–106). Bekräftat i drift: vanlig pair-salong hade BOOKING_PUBLIC_ORIGIN=gateway-origin och varken BOOKING_CONSENT_LAB eller BOOKING_RUNTIME i sin processmiljö; ingen test-results/native-codex skapades. CI-vägran: run.mts:15 (endast env CI, före start av tjänster, efter assertTestDatabase run.mts:12) och native-codex.mts:87 (CI, VERCEL, VERCEL_ENV); run.mts:13 vägrar VERCEL/VERCEL_ENV för hela pair. Samma loopback-/test-DB-vakt: assertTestDatabase (run.mts:12, native-codex.mts:86) och 127.0.0.1-krav på båda origins (native-codex.mts:88). Consent-lab sätts endast i salongens barnprocessmiljö (run.mts:106), inte globalt. Enhetstestet tests/native-proof-events.test.ts:25–34 bevisar CI-vägran före klientstart (PASS).
b. Modellkontots avgränsning. Argument: exec --ignore-user-config --strict-config --ephemeral --skip-git-repo-check --sandbox read-only --json (native-codex.mts:38–40). Per-körnings -c-flaggor (native-codex.mts:25–37): approval_policy never, features.shell_tool/shell_snapshot/view_image false, web_search disabled, apps._default.enabled false, analytics av, MCP-server bookingproof med url, bearer_token_env_var, required, enabled_tools = exakt sex namngivna verktyg (native-codex.mts:18) och default_tools_approval_mode approve för just den servern. Inga skrivningar av global config/profil i harnessen; enda filskrivningar är test-results/native-codex (native-codex.mts:92, 151, 154, 203) och tmp-cwd. Klientmiljön byggs med allowlist (native-codex.mts:21–23): PATH, SystemRoot/SYSTEMROOT, TEMP, TMP, USERPROFILE, HOME, APPDATA, LOCALAPPDATA, CODEX_HOME + NODE_ENV + BOOKING_PROOF_KEY. DATABASE_URL, SESSION_SECRET, GATEWAY_SERVICE_TOKEN ingår inte (rad 24-assertionen är tautologisk, skyddet är allowlisten). HOME och CODEX_HOME vidarebefordras oförändrade, alltså använder CLI:n operatörens befintliga Codex-hem för inloggning; --ephemeral hindrar sessionsfiler men harnessen kan inte garantera att CLI:n inte skriver loggar/tokenförnyelse där (dokumenterat i GATEWAY_SPLIT.md). Klienten får en verksamhetsnyckel (kind registered-client, standardscopes) i env; shell_environment_policy exkluderar den från skal som ändå är avstängt.
c. Consent-gränser. Före UI-godkännande: harnessens egen HTTP-create ger 400 mandate_required och 0 AgentBooking (native-codex.mts:135–140); första CLI-körningen får inte innehålla create_booking (rad 123) och exakt 1 lyckad create_proposal (rad 124–125). Godkännande i separat Chromium via befintlig labblänk ur create_proposal-resultatet (rad 142–155), origin=salong och sökväg /consent/<id> kontrolleras. Mandat skapas av befintligt UI: origin customer-consent, originReference=proposal, exakt pris och fönster (rad 156–161). Utanför fönstret (+1 h) ger 403 mandate_denied och 0 rader (rad 162–167). Inga mandatverktyg finns bland de sex; ingen agent skapar eller vidgar mandat-JSON. businessId anges uttryckligen i andra prompten ("authorized business demo", rad 171). Mitt prov bekräftar serverbeteendet oberoende (C2, C6, C8, C9, C10, C13, C15).
d. codex-events. mcpCall räknar endast item.completed med item.type mcp_tool_call från server bookingproof, annan server kastar (codex-events.mjs:2–5); modelltext ignoreras (test rad 5–8). Krav: två create_booking, båda ej failed, identiska args, samma booking.id, replayed=true på andra (native-codex.mts:178–182); get_proposal approved och get_booking confirmed för samma id (rad 183–184); exakt 1 AgentBooking-rad med rätt mandat via SQL (rad 185–187); admin-inloggning + kalenderklick på samma id (rad 190, salon-calendar.mts). failed = item.error eller result.isError (codex-events.mjs:14); ett eventuellt status-fält på item kontrolleras inte, men saknat resultat faller ändå på efterföljande asserts (fail-closed). Ogiltig JSONL, shell-/filhändelser eller okänt verktyg sätter invalid och fäller körningen (native-codex.mts:57–60).
e. Rålogsredaktion. Rå stdout-JSONL parsas i minnet och sparas aldrig; stderr sparas aldrig, endast kategoriord (native-codex.mts:64–70, 74). Sparade modellanteckningar går genom safeNote: nyckel, http(s)-URL:er, blk_-nycklar och opaka strängar ≥43 tecken redigeras, max 1500 tecken (codex-events.mjs:27–32). safeCall sparar varken args, approvalUrl eller feltexter (codex-events.mjs:17–25). Luckor (små): e-post redigeras inte (endast syntetisk @example.test), endast agent_message-text omfattas. Authorization-huvuden förekommer inte i sparad output. Sparat: test-results/native-codex/evidence.json och tre PNG (consent-before/after, calendar), gitignorerat, ingen automatisk radering. Labblänkens token passerar modellleverantörens kontext enligt befintligt labbkontrakt (dokumenterat).
f. Städning. finally (native-codex.mts:194–209): nyckeln återkallas, egna proposals raderas, cleanupRun(run) tar egna nycklar/klienter/mandat/bokningar, tmp-cwd raderas med prefixkontroll, evidence.json skrivs även vid fel med failedStep. Chromium stängs i finally (rad 155), admin-användare/sessioner raderas i salon-calendar.mts:66–67. Klientprocessen awaitas till close; 180 s timeout dödar endast barnprocessen (ingen processgruppsdödning). Codex-sessionsstatus: bara --ephemeral, ingen egen städning. AgentAuditEvent-rader lämnas (append-only, samma som tidigare).
g. Verklig-klientpåståenden. Codex sanerade JSON har exakt de fält harnessen skriver (actor, consentActor, checks, trace, notes, bookingId, cleaned, complete, failedStep; native-codex.mts:203–207) men saknar cliVersion, node, observedAt och pair, så den kan inte bindas till SHA eller till ren checkout. De fyra checks motsvarar pass-koderna på rad 140, 167, 188, 191. Traceformen (proposalStatus/hasMandate på create/get_proposal, bookingId på create/get_booking) motsvarar safeCall. replayed syns bara i modellanteckningen, inte i trace (safeCall sparar den inte), men harnessen assertar den (rad 182). UNVERIFIABLE som eget klientprov.

## Påståenden
Kodbas/harness:
| Påstående | Status |
|---|---|
| Endast testharness/docs ändrad; ingen produkt/API/schema/migration/beroende | CONFIRMED |
| b9a790f endast dependency-dokumentation | CONFIRMED |
| Opt-in-flagga, vanliga 19 PASS består | CONFIRMED (19/19, dirty=false) |
| Flaggan vägras i CI, samma loopback-DB-vakt | CONFIRMED (kod + 6/6-testet) |
| Consent-lab endast i testserverprocessen | CONFIRMED (kod, och ej satt i vanlig pair) |
| --ignore-user-config --ephemeral read-only, shell/web/apps av, 6 verktyg per körning, inga globala configskrivningar | CONFIRMED som kod; CLI:ns faktiska beteende UNVERIFIABLE |
| Klient får inte DB/SESSION/tjänstehemligheter | CONFIRMED (allowlist) |
| 400 mandate_required före godkännande, 403 mandate_denied utanför fönster | CONFIRMED (kod + eget rå-HTTP-prov C2, C9) |
| Befintlig labblänk, ingen ny godkännandemetod; agent kan inte godkänna | CONFIRMED (kod + C6, C7) |
| Native-händelser räknas, två creates, status, 1 rad, samma id i admin | CONFIRMED som kod |
Codex egna uppgifter (separat):
| Påstående | Status |
|---|---|
| Verklig Codex CLI-körning med befintlig ChatGPT-inloggning gav trace/1 rad/samma id | UNVERIFIABLE (kod-/bevisgranskning; JSON konsistent med harnessens format) |
| Tidiga FAIL (verktygsgodkännande, 403 vs 400, tappad businesskontext) inte produktbuggar | UNVERIFIABLE; konsistent med kontraktet (400 utan mandat bekräftat av mig) |
| Senare ändringar bara manifestmetadata/käll-SHA/URL-redaktion | UNVERIFIABLE (ingen historik för dirty-läget) |
| Unit 408/408 | CONFIRMED (min 408/408) |
| Lint 0 | CONFIRMED (min eslint rc=0, 0 fynd) |
| Integration 204/205 | UNVERIFIABLE (jag körde avgränsat urval 41/41) |
| agent-workday.test.ts:142 föll på Vitests 5000 ms-timeout, ingen assertion | UNVERIFIABLE, se nedan |

agent-workday.test.ts:142 (tillägg). (1) Egen observation: testet ingick INTE i min enda, avgränsade integrationskörning (sex consent-/mandatfiler); ingen passerad/fallen status, tid eller feltext att rapportera, och ingen omkörning gjord. (2) Kan därför inte skilja timeout från assertion av egen observation. Statiskt: testet (rad 142–189) öppnar tre stdio-MCP-underprocesser (connect, varav två legacy) och gör 1 bok + 20 parallella create_booking-anrop, utan egen timeout, så Vitests standard 5000 ms är rimligt snäv; en timeout är förenlig med Codex beskrivning men obekräftad. (3) 6aed511 rör inte testets kodväg: testet importerar src/lib/db, src/lib/domain, src/mcp/environment och scripts/database.mjs; diffen e6702c5..6aed511 ändrar endast docs, scripts/agentprov/*, scripts/integration/run.mts och tests/native-proof-events.test.ts. Testfilen senast ändrad i 05e5eaf. Slutsats: inte en regression från denna ändring.

## Blockerare
Inga.

## Backlog
- NC-QA-1 (Låg): Klassificera Codex JSONL-händelser med allowlist (endast agent_message, reasoning, mcp_tool_call och livscykel), i stället för blocklist command_execution/file_change (native-codex.mts:57); t.ex. web_search-item fälls inte idag.
- NC-QA-2 (Låg): Asserta exakt verktygssekvens per CLI-körning, särskilt att andra körningen saknar create_proposal och extra anrop (native-codex.mts:176–184).
- NC-QA-3 (Låg): Spara replayed i safeCall för create_booking så att evidence.json själv visar idempotensen; ta med cliVersion/pair i delade saneringar.
- NC-QA-4 (Låg): Ersätt tautologisk assertion native-codex.mts:24 med kontroll att allowlistnycklar inte matchar hemlighetsnamn; överväg att även kontrollera item.status === failed (codex-events.mjs:14).
- NC-QA-5 (Info): safeNote redigerar inte e-post; skärmbilder/evidence ligger kvar utan retention; processgrupp-kill vid klienttimeout; audit-rader lämnas.
- NC-QA-6 (Info): I native-läge byter hela pair-körningen BOOKING_PUBLIC_ORIGIN till salongen (run.mts:105), så de 19 standardkontrollerna körs då med annan discovery-origin än vanligt.

## NOT RUN
npm run test:pair -- --native-codex; verklig Codex CLI eller annan assistentklient; ChatGPT (webb/mobil); full integrationssvit inklusive agent-workday.test.ts; gateway npm test (oförändrad, tidigare granskad); CI/GitHub Actions; Docker; Vercel; riktiga konton/data.

## Körda kommandon (sammandrag)
sha256sum/wc -c på bundles; git clone/fetch (läsande, push DISABLED); git bundle verify; git checkout --detach; git log/diff --stat; npm ci (båda); i netns via ns.sh: npx prisma generate; npm run db:migrate + db:seed per färsk DB (nc_gate_test, nc_int_test, nc_pair_test, nc_probe_test); npx vitest run tests/native-proof-events.test.ts; npm test; npm run lint; npx tsc --noEmit; npm run build; npx vitest run --config vitest.integration.config.ts (6 filer); npm run test:pair med GATEWAY_PATH; node --import tsx qa-probe/consent-probe.mts; psql-räkningar; grep -cF hemlighetsmönster; städning.

## Harnessavvikelser
- npm ci kördes utanför netns (behöver registret), övrigt i unshare -rn + userns uid 1000, Postgres 127.0.0.1:56365, TZ=Europe/Stockholm, utan NODE_ENV.
- ~/.local/bin (där codex finns) togs bort ur PATH i netns och CODEX_HOME avsattes, så ingen klient kunde startas; processvakten såg 0 codex-processer (dess 25 rådata-träffar var bara sökvägar som innehåller native-codex-6aed511, ej klienter).
- ls /sys/class/net visade värdens gränssnitt (sysfs-artefakt); ip link i netns visar endast lo.
- Eget prov kopierades tillfälligt till salon/qa-probe och togs bort; godkännandet i provet gjordes med rå HTTP mot befintlig decision-endpoint, inte Chromium.
- Integrationsurvalet var avgränsat till consent-/mandat-/proposalfiler.

## Städning
Inga kvarvarande processer eller lyssnande portar från körningen; Postgres stoppad; pgdata, node_modules, .next, test-results, /tmp/ncns raderade, /tmp/ncsec shreddad. Alla egna DB-rader borta (endast append-only audit kvar i raderade test-DB:er). Hemlighetsgrep (min SESSION_SECRET + runnerns tjänstetoken) över loggar, prov, ns.sh och resultat: 0 träffar; provets egna agentnyckel/labblänk: 0 träffar.

## Bedömning
GO, avgränsat, för syntetisk lokal användning av harnessen och oförändrad vanlig test:pair. Den verkliga Codex CLI-körningen är kod-/bevisgranskad, inte egen körning. Ingen pilotbedömning.
