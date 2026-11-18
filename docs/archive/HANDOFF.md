# Överlämning · separat syntetisk kundkanal · 2026-11-16

Gren `feat/separate-customer-consent-lab`, produkt/prov
`721d445b651f0e08eac1219e1d710b70b1632bed`, gateway
`f9b8506cee3e3cd21bd279e01addf761cd3db1ed` oförändrad.
Ingen merge/deploy. Riktig kundidentifiering och leverantör är fortfarande obeslutade.

Prova enligt GATEWAY_SPLIT på ny loopback-testDB med den nya migrationen:
`npm run test:pair -- --native-codex`. Befintlig CLI-inloggning/modellkvot behövs.
Runnern startar separata servrar, skapar en privat kundinkorg och lämnar ingen
kundhemlighet till agenten. Testkunden är automatiserad och serverbestämd.
Codex bokar först efter separat UI-godkännande. Fel kundkontakt nekas.
Samma id vid retry/status/kalender. Egna data, inkorg och processer städas.

Fulla lokala produktkontroller: 423 unit, 211 integration, lint/tsc/build PASS.
Slutprovet på rena 721d445/f9b8506: generate/migrate/seed/build/tsc0, 25 pair-PASS.
CI 43845636237 på exakt 721d445 är SUCCESS: npm ci/lint/build/tsc,
423 unit, 211 integration, 64 E2E och 13 MCP-kort i dev/proxy0.
Grok: scoped lokal GO på 721d445/f9b8506; egna 423/211 och 19 pair samt
Chromium/REST/MCP. Extraprobe 31/33: två bokningar stoppades av dagskvoten.
Inget pilot-GO. [Originalrapport](qa/QA-REPORT-native-codex-separate-channel-721d445.md)
och [exakta resultat/backlogg](VERIFICATION.md).
Lokala bilder/manifest: `<local-scratch>/separate-consent-qa/final-evidence/`.
Ingen uppdaterad mobilpreview. Legacy-labbets gamla beteende är inte reparerat
eller beskrivet som pilotklart. Välj/verifiera riktig kundkanal före sådan drift.

Efter QA synkas bara dokumentation: gatewaydocs 1617de1 beskriver befintliga
proposalvägar på /api/v1/openapi. Salonens pair-pin pekar på den; runtimekoden
är oförändrad från det granskade paret. Ren 13adc8e/1617de1 gav 19 pair-PASS
och generate/migrate/seed/build/tsc0. Gateway-CI43850785900 är grönt på1617de1,
gren `docs/separate-customer-consent-contract`. Salon-CI43850868544 blev grönt
i försök2 på13adc8e:423/211/13kort/64webb/lint/tsc/build. Försök1 var63/64,
timeout i oförändrat mobilkundval. Fem lokala upprepningar passerade; orsaken
är inte fastställd och observationen kvarstår. Se VERIFICATION. Grok har inte
omgranskat dokumentationsdeltat. Slutlig resultatcommit ändrar bara Markdown;
ingen ny CI/Grok-prövning av produktkod görs för den.

Tre nästa avgränsningar: (1) diagnostik av kundvalets intermittenta CI-timeout
med bevarad felsidetrace, (2) produktbeslut och verifiering av verklig oberoende
kundkanal, (3) uttryckliga mandatgränser för övriga bokningsmutationer. Ingen av
dessa startas automatiskt. Pilot, fysisk iPhone och tvårepoprov i moln återstår.

---

# Tidigare överlämning · riktad kontroll av kundgodkännande · 2026-11-16

Rapportgren `proof/customer-approval-boundary` från `13e0179`, gateway
`f9b8506` oförändrad. Ingen produkt-/API-/testsvits-/migrationsändring.
77/77 riktade unit och 41/41 integration på ny loopback-PostgreSQL samt
12 diagnostiska skyddskontroller passerade. Egna fixtures/processer städade.

**Acceptans FAIL:** innehavaren av agentens returnerade labblänk kan godkänna
i en ny webbläsare utan kundinloggning och få ett bokningsbart servermandat.
Att agent-Authorization nekas på consent-rutten och att approve-MCP saknas
skiljer inte kunden från en agent som använder samma länk i webbläsaren.
OTP på kräver kod men är endast simulerat, med klientvalt mottagarnummer.
`origin=customer-consent` är därför inte bevis för verifierad kundidentitet.

Detta ändrar inte tidigare syntetiska GO. Separat verifierad leverans till
avsedd kund och kundkontroll behöver väljas före riktig användning.
Ingen sådan implementation eller ny tjänst har beställts i denna testomgång.
Grok bekräftade samma brist i egen rå HTTP och färsk Chromium: identitetskriteriet
FAIL, egna 83 unit / 41 integration / 20 diagnostiska PASS. Ingen regression eller
FIX-REQUEST; tidigare POC-GO utvidgas inte. [Originaladdendum](qa/QA-REPORT-native-codex-consent-boundary-13e0179.md):
9804 byte, SHA-256 035add6fe28c89d75c21dfa0574b9a68e6a83c002c32c09791bdaf1ce07b4783.
Den tidigare rapportens breda "agent kan inte godkänna" avgränsas uttryckligen
till då testade auth-headers/verktyg. Båda originalrapporterna bevaras orörda.
[Kommandon, artefakter, NOT RUN och resultat](VERIFICATION.md).

---

# Tidigare överlämning · native-klient, mandat och kalender · 2026-11-16

Fryst provkod `6aed5110e44c0247d93c470e8d2ef6f95072afbe`, gren
`proof/native-codex-consent`, gateway `f9b8506cee3e3cd21bd279e01addf761cd3db1ed`.
Den tidigare salongsprodukten 0a88ac2 är oförändrad. Efterföljande status- och
QA-dokumentation ändrar inte körd/granskad kod. Ingen mainmerge eller deploy.

Byggt: opt-in-harness med verklig installerad Codex CLI och befintlig
ChatGPT-inloggning. Bara sex avgränsade gateway-MCP-verktyg. Ingen global
konfiguration, ny nyckeltjänst eller klientintegration. Normal pair/CI startar
inte en modell; native-flaggan vägras i CI före klientstart.

Verifierad kedja: förslag utan bokning → separat automatiserad syntetisk kund
godkänner exakt bokningsscope i Chromium → servermandat → Codex bokar,
upprepar samma payload/nyckel och läser status → samma id öppnas i kalendern.
Utan mandat och utanför mandatets tidsfönster nekas bokning. Id:
`38609997-b174-4b80-b723-47fb49d36e55`, Massage Anna 17 november 10:30–11:00,
450 SEK. Exakt en rad före städning; efter provet är den borttagen.

Kör själv enligt GATEWAY_SPLIT med ny loopback-testDB och det låsta gatewayparet:
`npm run test:pair -- --native-codex`. Kräver befintlig CLI-inloggning och använder
kontots vanliga modellkvot. Detta är ett utvecklarprov, ingen mobilpreview.
Tre riktiga skärmbilder och sanerat manifest ligger ignorerat i
`test-results/native-codex/`. Säkrad lokal kopia:
`<local-scratch>/native-client-qa/final-evidence/`.

Slutmatris: lint/tsc/build PASS, 408/408 unit, 205/205 integration och 24 pair-PASS.
En första integrationstimeout (204/205) redovisas; nästa fulla körning passerade
utan ändrad kod, timeout eller assertion. [Detaljer](VERIFICATION.md).
CI 43819669674 på exakt 6aed511 är SUCCESS: npm ci, lint, 408 unit,
205 integration, build, 13/13 MCP-kort, 64/64 webb-E2E i dev/proxy0 och tsc.
Manuellt pair-jobb och övriga tre E2E-lägen ingick inte i denna feature-CI.

Grok: fryst 6aed511, avgränsat GO, inga blockerare/FIX-REQUEST. Egna 408 unit,
41 integration, 19 normal-pair och 15 rå-HTTP-prov. Ingen egen native-körning
eller full integrationsmatris. [Originalrapport](qa/QA-REPORT-native-codex-6aed511.md)
är 15810 byte, SHA-256 25843111f82f12e3c2be4b0e06ba346c1cbb973411f3508cc470a3e4c2e3427a.
Originalets sluttid 07:55 är felaktig enligt Groks efterföljande meddelande:
rapporten var klar redan 07:47. Originalet ändras inte. Det granskade första
manifestet saknade metadata; den rena slutkörningens manifest innehåller CLI,
Node, UTC-tid och båda rena SHA. Grok har inte själv verifierat den senare filen.

NC-QA-1..6 är Low/Info i testverktyget och går till backloggen, ingen fixloop.
Kvar: audit 7 moderate/dev (0 prod), ingen fysisk iPhone, moln/TLS eller verifierad
kundidentitet. Pilot NO-GO. Nästa prioriteringar: avgränsat verkligt kundgodkännande,
separat skyddad tvårepopreview och därefter återstående pilotgrindar i PRIVACY_SECURITY.

---

<!-- NIGHT_PAIR_HANDOFF_START -->
# Nattmål · två oberoende repon · 2026-11-16

Leveransen härdar gateway/salong-gränsen och gör felproven reproducerbara.
Produkter: salong `0a88ac27482aef377ecce86892b5bfbb897cc181`,
gateway `f9b8506cee3e3cd21bd279e01addf761cd3db1ed` (produkt ab07b6c).
Båda arbetsgrenarna heter `night/gateway-salon-integration`, privata origin.
Efterföljande dokumentation ändrar inte produkterna. Main är oförändrad.

Prova: följ GATEWAY_SPLIT för ny loopback-testDB, separat gateway på pair.json-SHA,
npm ci/generate/migrate/seed/build. `npm run test:pair` startar servrarna själv.
Det läser tjänster/tider, bokar via REST och HTTP-MCP, öppnar samma boknings-id
via kalendern i Chromium och provar tappat svar, retry, 20 samtidiga, omstart,
ägarskap och revocation. Egna fixtures/processer städas. Audit följer lagringsregler.
Ingen preview har uppdaterats och ingen ny driftlänk lämnas för denna kod.

Codex rena slutkörning: 402 enhets- och 205 integrationstester samt lint, tsc,
build och 19 pair-kontroller PASS.
Grok reproducerade grindar/prov i egen isolerad kopia och stängde GS3-QA-1..4.
Originalrapport: 10 983 byte,
SHA-256 `78fc8ec1f4326370e9d75a9afaf9ce519a544d4c5ec9d5cf254a433414fbefcd`.
Rapporten behålls oförändrad. Groks egna kalender-id/SQL-efterkontroller NOT RUN;
det körde automatiseringen som innehåller dessa kontroller.
CI 43781899181 på 0a88ac2 och gateway 43781813963 på f9b8506 är SUCCESS.
Alla fyra E2E-lägen: 64/64, MCP-kort 13/13, revisionspar 19 PASS-koder.
Push-jobbet 43781819976 ersattes av den fulla manuella körningen på samma SHA.

Kvar: audit med 7 moderate i dev, 0 i produktion, Info NIGHT-QA-1 (tmp-källa efter dispatch),
tidigare Low GS1-QA-2 (begränsad tjänsteauth-felloggning). Pilot NO-GO.
Ingen ny behörighetsnyckel eller rättighet skapades för CI. Revisionspar-jobbet startas
manuellt med privat sourcebundle; automatisk privat cross-repo-hämtning kräver
senare beslut om snäv läsbehörighet. Se GATEWAY_SPLIT och VERIFICATION.

Tre nästa prioriteringar: stödd rättning av utvecklingskedjan, nästa verkliga
assistentprov med tydligt kundmandat, därefter separat verifierad skyddad drift
för de två tjänsterna. Ingen av dessa leveranser startas automatiskt nu.
<!-- NIGHT_PAIR_HANDOFF_END -->

---

# Aktuellt · två privata repon på main · 2026-11-16

Båda leveranserna är granskade och integrerade med fast-forward.
Arbeta från aktuell main i booking-lab-gateway respektive booking-lab-se.
Gatewayens main e1830fe har grön CI 43772883228 (10/10).
Salongens integrerade 4de4d3e har grön CI 43772631817:
64/64 webbtester i alla fyra lägen, 394 unit, 205 integration och 13 MCP-kort,
samt lint/build/tsc. Efterföljande commit ändrar endast dokumentation.
[Verifiering och exakta revisioner](VERIFICATION.md).
[Lokalt tvårepoprov](../GATEWAY_SPLIT.md). Ingen deploy har gjorts.
Kända audit- och Info-fynd kvarstår. Pilot är fortsatt NO-GO.

---

# Salongens körläge · aktuell lokal leverans · 2026-11-15

Gateway `b37d414`, salong `09f0a0d` på `fix/gateway-service-auth`.
Gatewayen kräver split-bekräftelse inför varje agentoperation. Grok stänger
GS1-QA-3 efter prov med verklig felkonfiguration, omstart och MCP-bokning till kalendern.
Lokalt PASS: gateway 10/10, salong 394 unit / 205 integration, lint/tsc/build,
agent:proof 10/10 samt nio nekade legacyoperationer.
CI är grön i båda repona: salong 43769377375 på 1af3fa2 med 64/64 webbtester
och gateway 43769382799 på b37d414 med 10/10. Endast dev/proxy 0 kördes i
salongens feature-CI. Detaljer och exakta revisioner finns i verifieringen.
[Verifiering och kvarvarande begränsningar](VERIFICATION.md).
[Groks originalrapport](qa/QA-REPORT-provider-mode-b37d414-09f0a0d.md).
Fyra Info-fynd kvarstår, inklusive tidsfönstret vid omstart mitt i ett anrop.
Sju måttliga dev-beroendefynd kvarstår. Pilot är fortsatt NO-GO.

---

# Kundspårets regressioner · aktuell status · 2026-11-15

Produkt/test `4162ec94e0814828a3868b4648fcf55608471056` på `fix/gateway-service-auth`.
Alla 64 webbtester passerar lokalt i produktion på mobil+desktop. Publicerade kampanjer
visas åter på Ekos kundspår och kalenderknapparnas tryckytor ryms vid 320 px.
Tester följer verkligt salongsval och använder etiketter i rätt kundformulär.
392 unit/lint/tsc/build PASS. Ingen säkerhets-, boknings- eller databasregel ändrad.
[Kommandon, mellanresultat och begränsningar](VERIFICATION.md).

[Actions 43765483845](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43765483845)
är grön på exakt `104ad3ae0503b0af88824daf53b4f6b17216d3f5`:
392 unit, 205 integration, 13 MCP-kort och 64 webb-E2E samt lint/build/tsc.
Feature-jobbet körde dev/proxy 0; lokal webbsvit körde produktion.
Efterföljande dokumentation ändrar endast Markdown.
Ny Grok-QA, fysisk iPhone, full audit och drift är NOT RUN.
Tidigare kända 7 moderate dev-beroendefynd kvarstår; pilotgodkännande återstår.

---

# Gateway/salong · aktuell lokal status · 2026-11-15

Gren `fix/gateway-service-auth`. Salongens produkt `c7eeda6`, senare
testcommit `587d84a55475da0f173a1720970de5fea36360b8`; gateway `a239275`.
Grok har stängt GS-QA-1 och klickat fram samma MCP-bokning i salongskalendern.
Sekretesskontrollerna använder nu hela nyckelhemligheten och ett reproducerbart
`_o`-fall i enhetstesterna. Codex verifierade 392/392 unit, 205/205 integration,
lint, typkontroll, build och 10/10 agent:proof mot en ny isolerad lokal databas.

Kör provet enligt [GATEWAY_SPLIT](../GATEWAY_SPLIT.md).
Kommandoutfall, NOT RUN och skillnaden mellan Groks produktgranskning och den
senare testrättningen finns i [VERIFICATION](VERIFICATION.md).
[Groks originalrapport](qa/QA-REPORT-GS-QA-1-a239275-c7eeda6.md) behåller sina två
röda testutfall. Codex har därefter återskapat och rättat det felaktiga suffixprovet.

Ändringarna är lokala. CI, molndrift/TLS, fysisk iPhone och pilot är kvar.
Low/Info i rapporten är backlogg, inklusive loggning av nekad tjänsteidentitet
och upptäckt av konfigurationsdrift till äldre samlat körläge.

---

# Public read-only preview · aktuell lokal gren · 2026-11-15

`codex/public-readonly-preview` från `e890b69`. PUBLIC_READONLY=1 ger
syntetiska fixtures utan DB, server-403 för skrivning/admin/live och spärrad
HTTP-MCP. Landningsskissen är bevarad. Lint/tsc/build PASS; unit **195/195,
27 filer**, inklusive 41 nya databasfria tester. Build i Vercel-läge utan DB-URL
eller sessionshemlighet PASS. Ingen server, integration/E2E, push eller deploy.

Detaljer, filgrupper, kommandoutfall och begränsningar:
[PUBLIC_READONLY_PREVIEW](PUBLIC_READONLY_PREVIEW.md).
Äldre verifiering nedan gäller andra grenar/revisioner, inte denna leverans.

---

# Handoff · Agentprov 2 · 2026-11-15

Separat lokal worktree <local-state>/codex/booking-lab-agentprov-2, branch
codex/agentprov-2 från fryst e890b69. Produkt9e1c929a9246d4cad8c3385cfe5a12afbc20d333.
Ingen push, PR, merge eller deploy. Fryst agentprov-1 är bevarad för dess QA.

Levererat: USP2026-08-20-upptäckbarhet, llms, fem alias över befintligt native
MCP-kontrakt samt uttrycklig plats-/schemabindning i serverlagrat mandat.
Inga checkout/holds eller ny auth. Native kontrakt-URL:erna gör schemaresurserna
åtkomliga utan att hänvisa felaktigt till USP:s annorlunda wire-format.
Full konformitet eller verkligt kundsamtycke hävdas inte.

POLICY_MERGE_PLAN.md redovisar faktisk konfliktkontroll; ingen merge eftersom
fem dokument är i konflikt. LEGACY_DECOUPLE_PLAN.md är enbart en plan; inget
har tagits bort. AGENTPROV_2_PROTOCOL_NOTES.md beskriver standardjämförelsen,
fältmappningen, datumkonventionerna och den enda syntetiska platsens gräns.

Slutmatris efter fix1: unit171/171, integration139/139, lint, tsc och build PASS.
Äldre-mandat-uppgradering13→14 PASS före fix1 (oförändrad migration). Riktiga kommandoutfall och NOTRUN finns
i VERIFICATION.md; kort rapport i <local-scratch>/night-02.md. Extra lokal
HTTP-processstart blockerades av automatisk säkerhetsgranskning. Ingen ny
molnverifiering eller fysisk mobilkontroll påstås för denna revision.

Groks original på bcae82b finns i docs/qa/QA-REPORT-agentprov2-bcae82b.md:
166/139,75/75 egen HTTP och8/8 migrering. En Medium-blockerare AP2-QA-1:
OpenAPI-filen saknades i paketerad runtime. Fix1 rättar ignore/COPY, förtydligar
paketeringsbevis och begränsar origin. Riktad återkontroll påc9c5e49 (produkt
9e1c929) ger scoped GO för syntetisk lokal POC och filpaketerad simulering.
Original: docs/qa/QA-REPORT-agentprov2-f1-c9c5e49.md, SHA634fc825e6accc2a94d45807e8eded285e4716ce3a89a7e430c1c6b66a221dbf.
171/139,75HTTP-MCP,240originanrop utan reflektion,5negativa kontroller fångade.
Inga kvarvarande blockerare inom detta uppdrag efter1samlat rättningsvarv.
Riktig Docker/Vercel/pilot är inte godkända. Både QA/fixbegärans hash
matchar Groks original efter återställd slut-LF i webbkopian.
Info4/5/7 om DB-CHECK/härledd plats/snabbare unit-täckning är backlogg.
Info6 om CORS/Vary/statiska schemaresurser dokumenteras i protokollnoterna.
Nya Low/Info (localhost-servers, https-loopback, ignore-semantik) är backlogg.
Lokal npm start kräver explicit origin; docs förtydligade efter QA utan kodändring.
Niclas vidarebefordrade separat GO för e890b69:154unit/135integration och30egna
säkerhetsprov. Det är hans återgivna externa QA, inte en ny körning här eller
ett originaldokument som Codex verifierat. Ingen ny fullQA på oförändrad e890.

Nästa beslut är full USP-wire kontra fortsatt nativealias och ett separat
sammanföringsuppdrag efter agentprov-1:s QA. Fler platser kräver verklig
datamodell/platskälla; den modellen införs inte i denna omgång.

## Historik: Agentprov 1

# Handoff · Agentprov 1 · 2026-11-15

Produkt `570de3abc886bb1dc8f313ea27e986e0b5fe83c9` på lokal branch
`codex/agentprov-1`, bas bf7b6c3. Separat arbetskopia:
`<local-state>/codex/booking-lab-agentprov-1`. Originalet booking-lab-premium
på b241d8a är bevarat och rent. Ingen push, PR, merge, rebase eller deploy.

Fungerande prov: två separata REST/HTTP-MCP-processer bokar, läser status,
gör idempotent retry, nekas annan klients objekt och tävlar om samma slot.
Serverlagrat syntetiskt operatörsmandat krävs; stabil klient överlever rotation.
Bokning/händelse/länk committas atomärt. Agentvägen skapar inga kundkort men
lagrar fortfarande namn/e-post på Booking. Ingen verklig kundauktorisation
eller pilotgodkännande hävdas.

Prova med [runbook](AGENTPROV_1_RUNBOOK.md). Ingen `.env` eller Docker behövs;
operatorn tillför en loopback test-DB och processkonfiguration, startar den
befintliga wrappern med `npm start`, kör sedan `npm run agent:proof` i andra
terminalen mot samma databas. Riktiga nycklar skrivs aldrig ut av provet.
Förberedelser för molnet finns i [previewchecklistan](AGENTPROV_1_PREVIEW.md),
men konton, miljö/region, kostnad, åtkomst och exekvering kräver Niclas beslut.

Slutmatris: lint/tsc/build PASS, unit154/154, integration135/135 mot färsk
agentprov_delivery_test och produktionsprov PASS. Full audit FAIL7moderate dev;
omit=dev PASS0. Inga nya paket eller overrides. Ursprungliga felkörningar
och ej körda kontroller finns i [VERIFICATION](VERIFICATION.md).
Grok-konversationen kunde nås, men ingen ny granskning beställd eller godkänd
vid denna överlämning. Äldre Grok-GO gäller andra revisioner.

Lokala commits före denna dokumentation:

- a020784: avgränsad plan.
- e5094c7: klient/mandat/atomisk länk, testkod och driftunderlag.
- e6b7a1c: transaktionell ny migration och strikt MCP-schema.
- 570de3a: separat säker städning och uppdaterad API-guide.

Tre nästa leveranser: sammanför den lokala delade policyn under separat
verifiering; välj/godkänn skyddad Vercel/Neon-miljö och säker verklig
klientåtkomst; koppla därefter loss legacy-ingångar i små grupper med admin-
regressioner. Inga externa bokningsleverantörer eller nya epics startas här.

---

## Historik före Agentprov 1

# Leverans — premiumdemo, 2026-11-14

## Uppföljning · agentklient och pilotgrindar

Produkt cced2112349f0d1bd60fd1ba7e6a37bda36c68fa på
feature/agent-client-pilot-readiness. Ny A2A-händelse visar Lokalt A2A-prov /
Local A2A demo i vanlig behörig bokningsdetalj. Gamla händelser ändras inte.
[Mobilbild](demo/agent-history/mobile.png) · [Desktop](demo/agent-history/desktop.png).
Bilderna kommer från verklig lokal Playwright-körning, inte fysisk iPhone.

Riktiga klientanrop läser behandlingar och tider och returnerar bokningsaktiverat
MCP-kort. Befintlig privat plugin0.3.0, runtime05e5eaf och opt-in kvarstår;
inga profiler/hemligheter ändrade. Ingen styrbar apppanel; nativefångst timeout.
Nytt klick till bokningsbekräftelse i faktisk klient är därför inte verifierat.
Det ska inte ersättas av ett SDK-anrop och beskrivas som samma kontroll.

Aktuella återstående pilotbeslut och teknik finns överst i PRIVACY_SECURITY.
Ingen pilotstart, automatisk retention, MFA-implementation eller ny drift ingår.
Actions43597108005 är grön i alla fyra lägen på exakt produktrevision:
64webb vardera,114unit/128integration/13kort, ren npmci och ny DB.
Grok ger scoped GO på samma SHA, utan Medium/High, inga rättningsvarv beställda.
[Originalrapport](qa/QA-REPORT-booking-day-client-cced211.md), SHA256
3d3500d38c13d687f05b408199659c3aa6992c55b75ef0651bd37148837c6cec.
Grok körde själv114unit/128integration/64produktionswebb, A2A3/3×3 och
separat actor-prov28/28, inklusive verkliga äldre d8562b8-rader oförändrade.
[Testbevis](qa/evidence-agent-client-cced211/ci-results.json).
Low AC-QA-1 (negativa repotestluckor) är backlogg. Dokumentationsfyndet AC-QA-2
hanteras efter QA i status/verification/handoff; ingen produktkod ändras.
Grok har inte verifierat GitHub, PC-klienten eller den driftsatta previewn.


## Lokal bokningsdag via A2A · avslutad 14 november 2026

Läs `COMPLETE_BOOKING_DAY_PLAN.md` för att prova på separat loopbackdatabas.
Sätt BOOKING_A2A_DEMO=1 lokalt och kör
`npm run demo:a2a -- massage staff-demo YYYY-MM-DD`.
Granska behandling, utförare, längd, pris och tid. Välj tidsnummer och skriv
BOKA, eller avbryt med Enter. Använd därefter vanlig lokal admin/ägar-MCP för
flytt och avbokning i samma databas. Kundprofilen har inga adminverktyg.

Detta är ett strukturerat protokollprov med syntetisk kund, ingen språkmodell
eller installerad fjärranslutning i ChatGPT. Produkt och slutlig Grok-revision:
`d8562b8190f52e7b76f3d4682ec6f3b84fd35732`, `feature/complete-booking-day`.
[Grok-original](qa/QA-REPORT-booking-day-f1-d8562b8.md) ger scoped GO efter ett
samlat rättningsvarv; SHA256 `99003d5fe6ec201a0eb309817ac331452b8c73d4e2ae16027b8afc66ed27ac0f`.
Grok körde själv 114 unit, 128 integration, 24 produktionswebbtester och CLI 22/22.
Dess wire-probe 63/64 hade en för snäv minneströskel; separat skalningsprov
bekräftade att kroppen inte buffras proportionellt. Originalutfallet är bevarat.
[Actions 43593764129](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43593764129)
har fyra gröna jobb på exakt produkt-SHA, med 62 webbtester per läge.
[Kommandon och begränsningar](VERIFICATION.md). Audit: 7 moderate dev, produktion 0.

Öppet: gemensam syntetisk kund/kvot, public-etikett i historiken och obegränsad
dränering av autentiserad överstor body (Low). Ingen verklig modellklient,
fysisk iPhone, fjärr-A2A eller ny previewdeployment verifierad. Pilot NO-GO.
Nästa avgränsningar: en verklig godkänd agentklient; tydligare kanalattribution;
pilotgrindarna för identitet, dataskydd och faktisk drift. Inget av detta startas nu.



## Backendprov · API och lokal MCP

Arbetsbranch `backend/api-mcp-pilot-proof`, testrevision `dbe1e1f`. Befintliga
operationer återanvänds; enda kodändringen gäller testbevis för samtidiga
avbokningsretries. Ny databas och städkontroll, schema-/konflikt-/historikskydd,
blandad HTTP/MCP-trafik och versionskontroll ingår i de passerade proven.
[Resultat och kommandon](qa/evidence-backend-dbe1e1f/local-results.json).
[Actions på fryst revision](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43581522275).
CI är godkänd på testrevisionen, med 62 webbtester i vart och ett av fyra jobb.
Grok ger GO för lokal syntetisk backend på samma SHA.
[Originalrapport](qa/QA-REPORT-backend-dbe1e1f.md), verifierad SHA256
e6b30c80439efe7566699511b823cdc823dcc05a146d975e5bcb2de21900c4fb.
Grok körde 125 integration, 114 unit, riktade tester 5/5 tre gånger,
HTTP/MCP 2/2 i både dev och produktion samt en stdio-probe 132/132.
Jämförelsen gjordes mot 9a8350a eftersom föregående dokumentationsarkiv
56579bd inte fanns hos Grok. Lokalt är skillnaden mot 56579bd verifierad. Ingen produktdeploy behövs för test-/dokumentationsändringen.


## Prova det mobila bokningsflödet

[Öppna den skyddade demon](https://booking-lab-se-preview.vercel.app/product). För hela vägen till rätt kalenderdag, öppna först demoarbetsytan en gång i samma webbläsare. Demoinloggning från en ny session landar på standardkalendern. [Groks originalrapport](qa/QA-REPORT-mobile-story-9a8350a.md).

Checka ut `design/mobile-booking-story` och använd projektets lokala demostart med en isolerad syntetisk databas. Öppna `/product`, följ **Try the booking demo**, kontrollera tid och utförare och bekräfta med en adress på `example.test`. Följ sedan **See this time in the demo calendar** med en behörig demosession. Öppna en bokning med kopplad kund, besök kundkortet och gå tillbaka två gånger. Datum och personalfilter ska finnas kvar. På mobilen ligger Översikt, Kalender och Kunder vid nederkanten.

[Produktstatus och bildpar](PROJECT_STATUS.md) · [CI på produktrevisionen](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43578328177).


## Bred översikt · 14 november 2026

[Öppna den skyddade översikten](https://booking-lab-se-preview.vercel.app/admin/overview). Produktrevision `4b02f26ae5240cc80c09bb71e4e7bb1688f0e9f5`, branch `design/international-agent-ready`. Tre kolumner från 1680 CSS-px, med innehållet centrerat bredvid sidomenyn. [Före](assets/premium/overview-4b02f26/overview-wide-before.png) och [driftsatt vid 2880 px](assets/premium/overview-4b02f26/cloud-overview.png).

[Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43573515733) gav 62 godkända webbtester i varje matrisjobb, 114 enhets-, 125 integrations- och 13 korttester. [Grok](qa/QA-REPORT-premium-f1-4b02f26.md) utförde 205 godkända Chromium-kontroller. Vid återgång bevaras scrollpositionen men tangentbordsfokus hamnar på sidan. Fysisk Safari återstår. [Verifierad deployment](assets/premium/overview-4b02f26/preview-final.json), [åtkomstskydd](assets/premium/overview-4b02f26/preview-anonymous-alias.json) och [datakontroll](assets/premium/overview-4b02f26/preview-db-proof.json). Codex öppnade demoarbetsytan och den färdigladdade översikten på det fasta aliaset.


**[Öppna den skyddade premiumdemon](https://booking-lab-se-preview.vercel.app/product)**. [Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43546809210): 62/62 webbtester i vart och ett av fyra gröna jobb. [Driftbevis](assets/premium/preview-final.json), [CI-loggarnas kontrollsummor](assets/premium/ci-final-proof.json) och [Groks original](qa/QA-REPORT-premium-5212b7a.md).

Vercel `dpl_<redacted>`, fra1. Fast alias och immutable preview kontrollerades: anonyma HTML/API/resurser stoppades; behörig Vercel-session utan appinloggning fick 403 för admin-API. Direktport 3000 gick inte att nå. Egen Chrome-klick: öppna demoadmin utan extra lösenord, välj gårdagens bokningar och läs bokningsdetaljen. [Alla åtta datatabeller oförändrade](assets/premium/preview-db-proof.json), inklusive 94 bokningar. Ingen mainmerge. Pilot och fysisk Safari ej godkända.

Branch `design/international-agent-ready`, isolerad från `46b261a`.
Fryst produktrevision `5212b7afb439ec22e36116f226b6db504cc7c5c3`.
Grok har lämnat scoped GO för syntetisk lokal demo, inga Medium/High.
[Groks originalrapport](qa/QA-REPORT-premium-5212b7a.md); originalets SHA256 är verifierad. Noll rättningsvarv använda.
Produkten är privat pushad; Actions 43546809210 har fyra gröna ben på exakt SHA.
Skyddad preview är uppdaterad. Senare dokumentation ändrar inte koden.
Föregående previewrevision var `9840309`.

Implementerat: fotografisk engelsk Relay-landningssida med tydligt illustrerad
agentinteraktion, gemensam engelska/svenska för befintliga boknings- och
arbetsyteflöden, mörk desktopnavigation och ljusa arbetsytor. Ingen ändring av
domänregler, databasmigrationer, MCP, autentisering eller beroenden.

Lokalt klickprov: skapade `Premium Journey Demo` med `@example.test`, hittade
bokningen i kalendern, flyttade 09:30 till 11:00 och avbokade. Historiken visar
alla tre steg. Endast nya isolerade demodatabasen berördes. Mobil emulerad
390px; fysisk iPhone inte testad. Den avbokade raden behålls som demo/bevis.

Den egna avbokningen gav också ett verkligt kapacitetsförslag. I lokal
produktionswebb sparades ett 15-procentigt kampanjutkast för samma tjänst/dag;
kampanjvyn visade utkastet som opublicerat och omfattningen var uttrycklig.
Kundkortets retur behöll sökningen; mobil teamvy 390px hade ingen sidscroll
och Avbryt lämnade formuläret utan sparning. Produktionsbilder ligger separat
från tidigare dev-bilder i `.vercel/premium-evidence/`.

Motion-fragmentets JS, tidsval, återspelning och 390px-bredd passerade lokal
Chromium-kontroll. Referensen har återgetts med absolut framåtslash-sökväg.
Värdens faktiska inline-rendering är fortfarande inte verifierad: Windows-
fönstret gav bara tomma regioner och skärmbildsanropet fick timeout.

Aktuella resultat och tidigare misslyckade körningar finns i VERIFICATION;
alla fyra webbtestlägen passerade 62/62. Produktionsbilder finns och fryst separat
Grok-QA är klar. Full Actions och samma skyddade preview är verifierade.
Plan och acceptanskriterier: [PREMIUM_DEMO_PLAN](PREMIUM_DEMO_PLAN.md).

<!-- POLISH_CURRENT_START -->
# Handoff — UI-polering

Verifierat 2026-11-14. Branch **ui/salon-polish**, från 2c74a4b/produkt 51d54d4.
Produkt, slutlig Grok-revision, CI och deploy: **9840309df4d8addc3e4bf5f6c5da0f3802eb4a2d**.
Senare dokumentationscommit ändrar ingen produktkod. Main b000481 är orörd.
[Samma skyddade preview](https://booking-lab-se-preview.vercel.app/admin), deployment `dpl_<redacted>`, fra1.
Vercel-inloggning vid behov → **Öppna demoadmin**, inget andra lösenord.

Byggt: systemfont och enhetliga ytor/fält, desktopsidebar, mobilnav, samlad
kalenderkontroll, tydliga personalkort och tvåkolumnig förslagsöversikt. Ingen
dekorativ agentknapp. Befintliga kund-/boknings-/förslagsflöden och retur består.

Filer: src/app/workspace-polish.css (ny), layout.tsx, admin/header.tsx,
calendar.tsx, calendar-layout.ts (ny ren presentationsfunktion), overview.tsx,
admin/overview/page.tsx; tests/calendar-layout.test.ts och tests/e2e/polish.spec.ts.
Se git diff 2c74a4b..984 för exakt lista. Ingen lib/API/MCP/auth/schema/packageändring.

106 unit/125 integration/13 kort/58 webb×4/lint/tsc/build PASS lokalt och [CI](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43529548681).
Slutlig [Grokrapport](qa/QA-REPORT-polish-f2-9840309.md) scoped GO på 984,
två rättningsvarv använda. Groks sista egna tester är106 unit/4 polish/99 klick,
inte full 58×4; den fulla matrisen kördes av Codex/CI. Original/hash/proveniens och
tidiga bevarade FAIL i VERIFICATION. Audit 7 moderate dev/produktion 0 separat.

Moln är faktiskt kontrollerat på 984 med SSO all/HTTP/CSS/adminskydd och Chrome.
94 bokningar och 8 affärstabeller oförändrade. Inga nya hemligheter/åtkomster, inga
affärsdataändringar (vanlig demosession skapades). [Provväg/bilder](DEMO.md).
Privat push, ingen mainmerge.

Öppet: fysisk Safari/skärmläsare/ägaracceptans/pilot. Info: smala långa kort kan
klippa text, täta24 px-kort ligger kant i kant, paletten återanvänds efter 4 personal.
Mindre förbättringar till backlogg; inget tredje varv eller nästa Epic automatiskt.
<!-- POLISH_CURRENT_END -->

## Bilaga — tidigare leveranser och resultat

<!-- COHERENT_CURRENT_START -->
# Handoff — sammanhängande salongsupplevelse

Klart som privat syntetisk POC på **51d54d4696dd5fee51449acbd096f8529fbd3c5c**,
branch **feature/coherent-salon-workspace** från 3273934/05e5eaf. Main b000481
är orörd. [Preview](https://booking-lab-se-preview.vercel.app/admin), `dpl_<redacted>`, region fra1.
Senare dokumentationscommit skiljs från denna produkt-/QA-/CI-/driftrevision.

- Tre lägen och gemensam ram. Översikt/Kalender/Kunder; Salongen samlar tjänster,
  personal och kampanjer. Konto visar identitet, kund-/produktväg och logout.
- Kontextbunden kalender→bokning→kundkort, kundsökning och återgång efter sparande.
  Retur och vanlig Bakåt bevarar även scroll; direktlänk har säker reservväg.
- Explicita Stäng/Avbryt/Spara; verkliga ändringar skyddas, återställda värden rena.
  Fokus/återkoppling förbättrad; kundbekräftelsen kommer i bild.
- Verkliga förslags-/utkaststatus och händelsekanaler. Inga nya agentlöften eller
  API-/MCP-/domän-/datamodellsändringar. Tio historiska migrationer och lock orörda.

Kod: components/context-link.tsx och lib/navigation-context.ts, adminram,
boknings-/kund-/personal-/tjänsteredigering, översikt/kampanjfokus, publikt
bokningsformulär och style.css. Tester: tests/navigation-context.test.ts,
tests/e2e/coherence.spec.ts och oförsvagade befintliga flödestester.

102 unit /125 integration /13 kort /54 webb ×4 /lint/tsc/build PASS lokalt.
[Grok-original](qa/QA-REPORT-coherent-f1-51d54d4.md): scoped GO efter rättningsvarv 1;
egna 102/125/13,54×4,72 extra coherence-körningar och 91 klickprober PASS.
[Actions 43502629318](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43502629318):
fyra gröna jobb på exakt SHA; Docker/PostgreSQL i CI. Full audit 7 moderate dev
exit 1, omit dev: 0 exit 0. Lokal Docker är inte körd. Råa fel/NOT RUN i VERIFICATION.

Molnet: SSO all på samma projekt, anonyma HTML/API/assets→Vercel-login;
app-API 403 utan appsession trots giltig perimeteråtkomst. CSP/HSTS/nosniff/
referrer/no-store/poweredBy kontrollerade. Direktport 3000 gav timeout, ingen
HTTP-tjänst observerad. Egna verkliga Chrome-klick med 390 px emulering: bokning,
demoadmin utan andra lösenord, avbryt/flytt/avbokning/historik, sökning/kundkort,
tjänster/personal, översikt/kampanjfokus och logout. Fysisk iPhone är inte testad.

93 gamla bokningar och originalrader i åtta tabeller matchar före-hasharna. Endast en
ny egen testbokning skapad/flyttad/avbokad, version 3 / 3 events / 0 överlapp. Ingen
ny migration eller behörighet i molnet: 9 befintliga webbmigrationer. Tionde lokala
MCP-tabellen används inte av webben och infördes inte där. PC-plugin/runtime 05
på 3187 och dess bokningar/profiler är bevarade och separata från moln-DB.

Öppet Low/Info: gallringsordning/korrupt scrollpost och äldre Info6–9. Ingen ny
fixloop. Fysisk Safari/ägarens UX-godkännande och pilotgrindar återstår.
[Provguide/bilder](DEMO.md) · [status](PROJECT_STATUS.md) · [scope](COHERENT_EXPERIENCE_PLAN.md).
<!-- COHERENT_CURRENT_END -->

## Bilaga — tidigare verifierade leveranser

# Handoff — beständig agentbokning och ägarens arbetsdag

Verifierat 2026-11-13. Branch **feature/agent-booking-workday** från e702838.
Produkt och slutlig Grok-revision: **05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1**. Senare dokumentationscommit ändrar ingen produktkod.

Byggt: CardBookingAttempt, beständig pending/retry och aktuellt kvitto, lokal kalenderfil och separat läsande arbetsdagskort. En additiv migration och inga nya beroenden. Gemensam domänlogik, historiska migrationer, överlappsskydd, kvoter och adminbehörighet bevaras.

QA: Grok GO för lokal syntetisk POC på exakt 05e5eaf efter två samlade rättningsvarv. Egen separat kopia: 91 unit, 125 integration, 13 kort och 192 webbtester PASS; inga Medium/High. Övriga Low/Info är backlogg. [Groks originalrapport](qa/QA-REPORT-agent-workday-f2-05e5eaf.md). Första granskningen på c4e och riktad F1 på cf6 finns kvar i docs/qa. Slutlig F2 på 05e5eaf stänger omvänd replay vid befintliga MCP-/HTTP-ingångar. Inga HTML- eller domänändringar i rättningsvarven. Två varv använda, inget automatiskt omtag.

91 unit, 125 integration, 13 kort och 48 webbtester i fyra lägen, lint/tsc/build PASS. Audit separat FAIL: sju moderate dev; produktion PASS: noll. Verify POC på exakt 05e5eaf: alla fyra jobb gröna, 48 webbtester per jobb. Dev0 kör även 91 unit, 125 integration och 13 korttester. Docker/PostgreSQL användes i CI; det är inte ett lokalt Dockerprov. [Actions 43467138367](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43467138367). [Råa resultat](VERIFICATION.md).

Fryst lokal runtime och vanlig skyddad webb på 3187 kör 05e5eaf. Tionde migrationen tillämpad additivt; båda befintliga demokvittona återtagna genom granskad idempotent retry. Separat booking_workday_demo är konfigurerad med endast show_workday. Ingen extern deploy. Samma privata personliga plugin är uppdaterat till 0.3.0, release pluginrel_6af7418393e88191bb5834222b306ab3. Återläsning verifierar oförändrad identitet, audience, anslutningar och standardprompt samt exakt granskad launcher. De två gamla syntetiska bokningarna och två create-händelserna är oförändrade, med identisk SHA256 före/efter migration och retry. Vanlig Chrome-admin laddades om på den nya runtime med samma individuella session och visade båda besöken. Aktiv publik HTTP-replay nekas med statiskt403 och admin-API utan cookie med403.

Lokal produkt-runtime: <local-state>/codex/booking-lab-agent-workday-05e5eaf. Vanlig webb använder samma frysta produkt på http://localhost:3187 och samma tidigare individuella adminsessioner. Ägarprofilen booking_workday_demo har bara show_workday och en separat SQL-läsroll/hemlighet, utan emailkolumn. Gamla läs-/bokningsprofiler och kapacitetsprofilen bevaras. Hemligheter finns endast i ignorerad lokal konfiguration, aldrig i plugin/URL/Git.

Faktiskt läsanrop från denna Codex-anslutning lyckades med bookingEnabled=true. Separata SDK-processer genom den riktiga lokala launchern och ägarkonfigurationen återläste båda gamla bokningarna; detta är inte native-klickning. Ingen app var exponerad i sidopanelen. Nya native-klick, ägarprofilens hot-reload, fysisk iPhone/Safari och kalenderimport är NOT RUN. Nästa inläsning av den lokala anslutningen kan behövas innan ägarkortet syns; inget manuellt QA-uppdrag lämnas till Niclas. Läs [provväg, bilder, stopp och återställning](DEMO.md). Webbpreviewn är oförändrad; denna lokala MCP-leverans är inte en ny molndeploy. Detta är en betrodd lokal syntetisk demokanal, inte individuell kundautentisering. Ingen fjärr-MCP, ny drift, ny kostnad, riktiga uppgifter, utskick eller betalning. Ingen mainmerge. Mobil fjärranslutning, fysisk iPhone/Safari och verklig kalenderimport är **inte verifierade**. Kalenderfilen synkas inte vid senare ändringar. Pilot är fortsatt NO-GO.

Mindre fynd ligger kvar: gammal kalenderfil-notis efter statusändring (AW-QA-3), fokus vid ägarkortets fel (AW-QA-4), tidigare sökfönster 28/35 dagar (CB-QA-1) och övriga Info enligt originalrapporterna. Samma secret och lokala MCP-identitet är avsiktligt samma kanal. Inga ytterligare fixloopar startas.

Tre nästa leveranser: vald säker mobilanslutning och faktisk klientprovning; individuell kundbehörighet inför fler agenthandlingar; avgränsade pilotgrindar för MFA/recovery, retention och drift. Inget av dem startas automatiskt.

<!-- AGENT_WORKDAY_CURRENT_END -->

## Historik — tidigare leverans

# Handoff — avgränsat MCP-bokningsprov

2026-11-13, feature/mcp-card-booking-proof från fdcb41b, produkt **8126410af712bdd71d6b6a42c0a1fcc58055d28d**.
[Mandat/acceptans](MCP_CARD_BOOKING_PLAN.md). Ingen nästa epic eller core-omskrivning.

Byggt: opt-in book*demo_time, fast syntetisk kontakt, befintlig createBooking/
kundkvoter, UUID med time-card*-namnrymd och tjänsteversion. UI har checkbox/
uttrycklig bekräftelse, kvitto i Stockholmstid, konflikt → nytt val och okänt
skrivutfall → låst nytt val + exakt retry. Senare adminändring visas som sådan.
Standardens två läsverktyg/gamla läsprofil består. VERCEL/VERCEL_ENV/VERCEL_URL och
production/workspace nekas;8andra ensamma plattformsmarkörer är Low-backlogg. App-only metadata är inte fjärrautentisering.

Ny src/mcp/time-card/booking.ts; små ändringar i guard/data/server/ui och
befintlig launcher/pluginmetadata0.2.0. Ny integration och testvärdshjälpare,
ny Playwrightkonfiguration för bokning→admin. CI kör kortsviter i befintligt
dev0-jobb; övrig fullmatris består. Inga nya beroenden, migrations-/auth-/
domänmotor-/HTTP-/gammal MCP-serverändringar.

85unit/113integration/3läs-UI/4boknings-UI/46webb×4,lint/tsc/build PASS.
Ren npmci571Windows,9migreringar/seed på7nya DB. Full auditFAIL7moderate dev,
prodPASS0. 13riktiga launcher/SQL-kontroller och egen faktisk CUA-adminlogin.
[Groks originalrapport](qa/QA-REPORT-card-booking-8126410.md) Status: **GO för avgränsad syntetisk lokal POC;4Low/1Info i backlogg,0Medium+**, granskad revision 8126410af712bdd71d6b6a42c0a1fcc58055d28d.
[Actions43430009174](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43430009174) —4gröna jobb på8126410 efter1riktad omkörning av dev0 (första försöket112/113 i gammalt refundtest, anslutnings-/testtimeout; ingen kod/testgräns ändrad, rotorsak inte fastställd). Privat plugin uppdaterat/aktiverat med lokal bokningsprofil.

Runtime <local-state>/codex/booking-lab-card-booking-8126410. Källmatchning
451filer,0mismatch (normaliserad UTF8-LF/exakta binärer, next-env genererad).
Verifierade rena C-dependencies och produktionsbygge kopierades till egen
fryst runtime; tre genererade externa paketjunctions återställdes inom den.
Vanlig serverwrapper på127.0.0.1:3187, NY booking_cardbooking_demo. SQL-writer
har SELECTService/Staff/Booking/BookingEvent och INSERTBooking/BookingEvent;
syntetiska Booking-kontakter behövs internt, Customer/Admin/User-åtkomst nekas.
Det är inte OS-isolering eller tenant-säker drift. Old reader och DB orörda.
Ny vanlig syntetisk webadmin, slumpat lösenord endast privat lokal envfil;
ingen bypass/autologin i produktkoden. Normal login i operatörens Chrome är verifierad.

PASSanrop efter PC-omstart: bookingEnabled=true och tjänsteversion1. Niclas bekräftade själv bokning i native-kortet; databasen har2skilda bokningar,1create-event vardera och0överlapp. Codex verifierade båda i faktisk skyddad Chrome-admin och öppnade10.00-bokningens detalj. Egen native-kortklickning NOT RUN. Befintlig Vercel-preview/databas oförändrade, inga
publiceringar/utskick/betalningar/riktiga kunder eller mainmerge. Fysisk mobil
och kundpilot inte godkända. Inget native-PC-/Grokprov kan härledas ur testvärden.
Bevara stängd-kort-begränsningen: kontrollera admin innan nytt försök vid okänt utfall.
[Provguide/bilder](DEMO.md) · [kommandon och NOT RUN](VERIFICATION.md).

Faktiskt PC-slutprov: Massage/Anna16nov09.30–10.00 (b48ea9ab-c0e5-4013-8d25-64ca409228ce)
och10.00–10.30 (47797e71-dfa2-4482-a34b-9b4481241723). Två olika tidsval,
1create-event vardera,0överlapp. Niclas bekräftade i native-kortet; Codex läste
DB och klickade faktisk vanlig admin/detalj. Inga av dessa rader raderades.
Appomstarten tog även ned den lokala wrappern; den återstartades med samma
frysta kod/DB/secret och befintlig individuellt inloggad browsersession fungerade.
Groks oförändrade original: SHA2562064b2f90e762b8af901237ec156ab308464ab30ed377e7235179ac7adf1e685.

<!-- CARD_BOOKING_CURRENT_END -->

## Historik — tidigare leverans

# Handoff — lokalt MCP-tidvalskort

2026-11-13, feature/mcp-time-card från1a49a0e. Produktkod8648316,
testartefaktisolering **a65f0f2ee5750044dd46c5db50453db5602b79f2**. Endast
Playwrights outputDir skiljer de två revisionerna. Scope/mandat i
[MCP_TIME_CARD_PLAN](MCP_TIME_CARD_PLAN.md); Niclas valde ChatGPT på PC:n först.

Nya src/mcp/time-card delar befintlig getAvailability och aktiva resurser.
Två läsverktyg, en MCP Apps HTML-resurs och strukturerad/textfallback. Inga
kundfält eller skrivningar; explicit opt-in, lokal DB-guard, production/Vercel/
adminflaggor nekas. Alla9migrationer, paket/lockfil och gamla profiler bevarade.
Ingen appbackend-/infrastrukturmigrering. Inga nya npm-beroenden; cached
Prettier3.6.2 formaterade bara koden, inte ett levererat beroende.

Privat plugin: [Booking Lab – tidval](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3),
USER/PRIVATE, release pluginrel_6af6eef513a88191bf80a0fe215fac42, version0.1.0.
Installerat bekräftat i konto-UI och två faktiska verktyg exponerade i denna
konversation. Verkliga show_time_picker/list_services anrop fungerar. Därefter gav Niclas två foton av den riktiga PC-klienten: både Anna-/Erik-kort
visas. Dessa är användarens observation, inte egen CUA-klickning eller Groks
klientprov. Mobilen visar enligt Niclas inget kort. Orsaken är ännu inte fastställd;
ingen mobil-GO. Fotooriginal stannar utanför Git, hash/proveniens i underlaget.
Webbens pluginstart hänvisar korrekt till desktop för lokal exekvering.

Uppföljning 2026-11-13, oförändrad produkt8648316/runtime: ett nytt användarfoto
visade hämtningsfel efter tidsval. Niclas bekräftade sedan att kontrollknappen
svarade ”Tiden är fortfarande ledig. Ingen bokning har skapats.” Lyckad
användarprovning i PC-klienten, inte egen eller Groks klicktest. Direkta MCP-anrop
fungerade under felsökningen. Rotorsak och varaktig lösning på det tidigare felet
är INTE verifierade; ingen kodrättning eller ny Grok-runda har gjorts. Mobilen
är fortsatt olöst. Endast dokumentationsuppföljning, inga nya testresultat.

Operatörens runtime <local-state>/codex/booking-lab-time-card-8648316 är fryst.
Oförändrade verifierade9migrations-dependencies återanvänds genom node_modules-
junction till egen tidigare95f8071-runtime; ny npmci är INTE körd denna gång.
Användarprofil ~/.booking-lab/time-card.json innehåller bara lokala sökvägar,
privat envfil stannar utanför Git/paket. Anslutning enbart till ny
booking_timecard_demo på127.0.0.1:55451 med separat läskonto. Bara Service/Staff
och6Bookingkolumner (inklusive Prismas implicita id); inga kontakter.
default_transaction_read_only=on. Kundtabell/kontaktläsning42501, UPDATE25006.
En tillfällig redundant config.toml-registrering togs bort efter riktig
pluginanslutning; original booking_calendar_demo kontrollerades oförändrad.

Slutmatris83/105/3 och46webb-E2E×4 PASS; lint/tsc/build.9migrate/seed på6nya
loopbackDB,207källfiler matchar Git.7moderate dev/0prod audit. Alla egna
affärs-/admin-/session-/ledger-rader0 efter testerna; integration16hashade
RateLimitBucket kvar, övriga5miljöer0. Ingen ny domänbokning i användardemon.

Operatörsfel öppet redovisade: lokal PG var stoppad efter föregående session;
native återstart återhämtade befintliga data utan radering. Första reader-grant
saknade id som Prisma läser implicit:42501; enbart id lades till. Dev0 fick
ENOENTtrace när jag körde kort-UI samtidigt med webb-E2E i samma outputDir;
a65f0f2 separerar artefakter och sekventiella omkörningar46/46 båda devlägen.
Ingen produktassertion eller säkerhetskontroll sänktes. Första uppladdningsknappen
öppnade en meny; efter rätt val skickades ett QA-paket, inte dubbla beställningar.

Grok: original QA-REPORT-time-card-a65f0f2.md, SHA256
891b6903f92fd963bff1310dba19c1f6bfaf10011b69b569ef98723b127ab676.
Scoped GO lokal syntetisk POC; egna npmci572/83unit/105integration/3kort-UI/
46webb-E2E×4 PASS, MCP63/0. Guard20PASS/2FAIL och UI38PASS/2FAIL har3Low, ingaMedium+.
Inget eget ChatGPT-/fysiskt mobilprov. Bilderna kom till vår konversation efter
deras granskning och har inte granskats av Grok. Ingen ny fixloop för små fynd:
fokus, hoverkontrast och kompletterande Vercelflaggor går till backloggen.
5Info dokumenterade. Privat push a65f0f2 klar, Actions43417840017 PASS:4gröna46/46 påsammaSHA. Preview95f8071 orörd; inga nya kostnader,
tunnlar, driftbehörigheter eller mainmerge. Fysisk iPhone/Safari-klickning och egen faktisk PC-
klickning NOT RUN. PC-rendering från användarfoton, mobilen olöst. [Testbevis](verification/time-card/), [prova](DEMO.md).

## Historik — föregående verifierade leverans

# Handoff — kundlivscykel och ägaragentprov

2026-11-13. Produkt **95f807196f9b15e0bae2afdcd89604837cf747dd**, feature/customer-lifecycle-agent-proof
från ren d2ccb6c. Niclas godkände steg2–3 och valde manuell hantering;
automatisk gallring av. [Scope](CUSTOMER_LIFECYCLE_AGENT_PLAN.md).

customer-data.ts + POST /api/admin/customers/[id]/data och kundkortets
Kunddata delar bounded export/token, preview och bekräftad kontaktåtgärd.
Aktiv webadmin/origin/strict/no-store; lokal MCP får inte kunddataåtgärder.
Migration9: två contactRemovedAt, minimal CustomerDataAction och kontroller.
Äldre8oförändrade. Kort/kopplade snapshots minimeras, kort arkiveras; teknisk
historik/Booking.version/källbeslut/exclusion bevaras. Inga kontaktpayloads i
logg/ledger, inga automatiska matchningar via e-post eller fullgallringslöften.

**QA-fix1:** Grok hittade att emailCapKey var rå normaliserad e-post.
95f8071 lagrar nya icke-adminnycklar som namespacad HMAC och omkodar äldre
kopplade rånycklar vid manuell åtgärd. Inget töms, createdAt/dagslås/tak består.
Kvotfrågan räknar båda formaten; ingen global backfill/ny migration. Nya tester
verifierar full Booking-rad efter riktig stdio-MCP och HTTPadmin, blandad
legacy/HMAC-kvot före/efter åtgärd, +tag och gamla replays. Ingen ny dependency.

Slutmatris79unit/99integration/46E2E×4, lint/tsc/build PASS. Ren npmci571,
generate7.10.1,9migrate/seed på6nya loopbackmiljöer och8→9/återseed PASS.
196produkt/konfig/test/assetfiler matchar Gitblobs; LF-text/exaktbinär.
Audit separat7moderate dev/0prod. Grok initialGO för syntetiskt prov med
LC-QA-1; riktad återkontroll fix1på95f8071 GO, LC-QA-1 stängt och inget Medium+. Originalrapport/fixrequest
bevarade i docs/qa. Privat push genomförd. [Actions43393207291](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43393207291) success:4×46/46 på exakt95f8071, npmci572Linux/generate/migrate/seed/lint/79unit/99integration/build/tsc. Push43393207637 avbröts av den manuella fullmatrisen enligt befintlig concurrency. Senare docs är separat från produktkoden.

**Verkligt agentprov:** samma booking_calendar_demo, ingen ny integration.
Default2/full äldre kataloger består; capacity-only ger4läsverktyg och med
befintlig allow-workspace+secret exakt6totalt. Verktygen blev faktiskt synliga
i denna Codex-konversation efter tidigare laddningsproblem. Faktiska tools.\*
skapade ett opublicerat20%-utkast16november; samma retry samma id, ändradretry,
confirmedfalse och nytt staleunderlag nekades. Egen CUA såg utkast efter reload,
öppnade rätt kalender och återbokade09via vanlig webb; MCP/UI visade stale.
DB1beslut/1accepteradledger, nekade0,0överlapp. [Transkript/avgränsning](agent-proof/OWNER_AGENT_2026-11-13.md).
MCPkällae2e0e39, kapacitetskod oförändrad i95f8071; web95f8071. Det är inte
fjärrmandat/OAuth, och confirmed=true bevisar inte mänskligt samtycke.

[Grok original95f8071](qa/QA-REPORT-lifecycle-fix1-95f8071.md), SHA2561a07d93fb6eff74a8996882883537303ee33bcf7b5bb0cf3971bb14a2f7b4a9b. Egna79/99/46prod, LC-prob23/0, katalog27/0 och riktig8843→95fuppgradering med gammal MCP-råkvot. Underlagsgranskning av Codex-provet; inte ett eget Codex-/PC-/molnprov. Fixvarv2 behövdes inte. Ett Low/fleraInfo ligger i roadmap, inga nya uppdrag.

Fryst QA-kod ändrades inte medan Grok granskade. Privata profiler, exporter,
nycklar, databaser och node_modules finns utanför Git och QA-paketen. **Drift verifierad:** samma https://booking-lab-se-preview.vercel.app/admin/customers, dpl_<redacted>, sourceRevision95f8071, READY Preview(target=null), runtimefra1/NeonFrankfurt, buildcle1/USA. SSOall kvar,5READY-adresser+stabil alias skyddade förHTML/API/resurser. TLS1.3, headers/no-store, ingen port3000anslutning inom5s (inte full pentest). Minimerad API/auth/origin/strict/bounds, riktig exportdownload, framtidabesökblock, en kontaktåtgärd/20retries och cookie-revocation PASS i molnet. Egen CUA på stabilalias såg samma borttagna kort/450kr-historik. [Bilder/provsteg](DEMO.md).

Migration9 bevarade alla äldre kolumnvärden i11tabeller. Efter testet: ursprungliga92bokningar/33kort/107events/4kampanjer/3beslut/6tjänster/5personal oförändrade. Endast ett eget nytt syntetiskt kort och en senare avbokad bokning tillkom:93bokningar/34kort,1remove/3exports,0överlapp. Den lokala agentkampanjen kopierades inte till molnet. Backup före12och efter13tabeller AES-GCM återläst med identiska radhashar; befintlig separat nyckel bevarad. Operatörs-PC, inte automatisk offsite.

Ett första deploybygge startades felaktigt innan driftkontrollens resultat lästs; det avbröts(CANCELED), stabil alias förblev gammal. Kontrollfelet antog id på samtliga tabeller och stoppade före migration. Rättat utan produktändring. Två driftprobfel: inaktiva startfixture-ID och pris läst från ett minimerat API utan pris. Samma eget kort återanvändes; priset jämfördes därefter med exporterad bokningssnapshot och allt PASS. Försöksutdata bevarade, ingen ny bokning eller kontaktåtgärd vid sista återkontrollen.

MCP:s nästa start är konfigurerad till separat pinnad95f8071-runtime (kopierad verifierad oförändrad npmci-kedja), SDK-start/katalog6PASS. Det faktiska huvudsakliga AI-provet använde e2e0e39 med identisk kapacitetskod; ingen påstådd pågående klientomstart/cutover. Ingen publik MCP.

Inga nya abonnemang/tillägg/domänköp; befintlig Vercelanvändning/få dollar är ramen, exakt faktura ej verifierad. Stoppa exakt nya deploymenten enligt DEMO, bevara data/SSO. Ingen mainmerge/force-push. Fysisk iPhone/Safari, automatisk gallring/externbackup, framtida nyckelrotation och kundpilot NOT RUN/NO-GO.

## Historik — föregående verifierade leverans

# Handoff — levererad proaktiv kapacitet, 2026-11-13

Branch **feature/proactive-capacity-overview**, bas28a48fe efter avslutat
kalenderprov. Produkt-/QA-/CI-/deployrevision
**8843d06350c6478e375fb640579cb3ac4f7fe3dc**. Privat push genomförd; main
fortfarande b000481. Dokumentation/bilder därefter är separat från produktkod.

Byggt: capacity.ts med minimerad sjudagarssignal, bounded cursorpaginering,
aktualitetskontroll och beständigt beslut per avbokad bokningsversion.
Översikt → rätt kalenderläge eller explicit förhandsgranskat kampanjutkast.
Ny CapacityDecision-migration är additiv; historiska7migreringar och exclusion
är orörda. Befintlig workspaceWrite, aktör-före-replay och personaldagslås
återanvänds. Kampanj+beslut sparas atomärt; ingen alternativ bokningsmotor.

Berörda ingångar: /admin/overview, /api/admin/capacity, befintlig lokal
src/mcp/workspace.ts; nya adminläsningar och opt-in-skrivningar delar domän.
scripts/seed-capacity.ts lägger additivt till fyra scenarier; inga nya beroenden
eller lockfilsändringar. Produktvisionens hela Del B och tydliga beslut/
förslag/hypoteser finns i befintlig roadmap/research.

**QA:** initial956155f GO med Medium PRO-QA-1. Ett samlat fixvarv gav8843d06;
[Grok återkontroll](qa/QA-REPORT-proactive-fix1-8843d06.md) stänger fyndet,
inga blockerare/Medium+. Fyra mindre fynd till backlog, inget andra fixvarv.
Original SHA25624763222f4002aa0edf4b3b8e5dd0e75af4aa0c9335d067832095bc0acc9b639.
Grok körde själv78/90/42prod-E2E och egna UI/API/MCP-prov i separat syntetisk
kopia. Grok hade ingen PC-, GitHub-, preview- eller serveråtkomst.

**Verifiering:** ren npmci571Windows, generate7.10.1,8migreringar/seed på nya
loopbackmiljöer, lint/tsc/build,78unit/90integration/42E2E×4 PASS. Testkopians167
kod-/konfig-/assetfiler matchar Gitarchive8843d06; källändringar gjordes bara i
<local-state>/codex/booking-lab-ui. Full audit FAIL7moderate dev, omitdev PASS0.
[Actions43353236981](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43353236981)
har4gröna42/42jobb på exakt SHA. Pushens enbenskörning43353218140 avbröts av
den manuella fullmatrisen enligt befintlig concurrency, inte ett kodfel.

**Faktisk preview:** https://booking-lab-se-preview.vercel.app/product,
dpl_<redacted>, READY Preview(target=null), fra1.
Vercel-API:s sourceRevision och alias verifierade. Oförändrat SSO på alla
deployments; ingen Production-promote. Build cle1/USA, runtime/DB Frankfurt.
Samma Neon Free och befintlig Vercelanvändning; inga nya abonnemang/tillägg.
Exakt förbrukningskostnad är inte fakturaverifierad, några få dollar är ramen.

Moln:84äldre bokningshashar oförändrade,92bokningar/33kundkort/4kampanjer/
3beslut,4aktiva tjänster/3aktiva medarbetare, endast example.test och0överlapp.
Seed två gånger ger identiska tabellhashar. Alla nya utkast är opublicerade.
20HTTP-draft/replay, faktisk UI/save/stale/logout, perimeter/TLS,320/390/1440
PASS. Egen Computer Use på stabil alias verifierar kalender16nov/Sam och
20%-förhandsgranskning utan att spara09-tiden. Bilder i DEMO.

Backup före migration11tabeller och efter flöden12tabeller återlästa till nya
lokala \*\_demo; alla radhashar lika, manipulerad AES-GCM-data nekas. Befintlig
separat ignorerad nyckel bevarad. Backup är på operatörens PC, inte automatisk
offsitebackup. Secrets/operatorprofiler stannar utanför Git och Grok.

**Inte verifierat/klart:** fysisk iPhone/Safari/WebKit, Niclas UX-godkännande,
forcerad Vercelomstart/felåterhämtning över flera instanser, ny video och skarp
drift. 14hashade rate-limit-rader kvar i integrationstest; övriga affärs-/admin-
testrader0. Mindre paginerings-/a11y-fynd och tidigare Info i roadmapbacklog.
Kundpilot fortsatt NO-GO enligt PROJECT_STATUS/PRIVACY_SECURITY.

Prova och stoppa miljön: [DEMO](DEMO.md). Aktuella kommandon, råbevis, initiala
misslyckade försök och NOT RUN: [VERIFICATION](VERIFICATION.md). Nattmålet är
avslutat. Starta ingen efterföljande modul utan nytt avgränsat uppdrag.

## Föregående verifierade leveranser

## Senare avgränsat kalenderprov, 2026-11-13

Lokalt på experiment/calendar-agent-proof, produktkod7c1407d oförändrad.
Direkt läsande MCP, två syntetiska kalenderunderlag, faktisk kundbokning och
adminvisning samt nekat gammalt tidsval med bevarat utkast. Exakt1bokning och
0överlappar; syntetiskt provkonto inaktiverat och egen provserver stoppad.
Aktuellt underlag: [kalenderprov](calendar-proof/COMPLETION_2026-11-13.md).
Fryst paketv1 till Grok: avgränsat GO efter artefakt-/bildgranskning och egen
kalenderberäkning; inga egna systemtester. [QA och backlogg](calendar-proof/QA_FINAL_REVIEW.md).
Ingen ny drift eller pilot. Äldre delrapporter med datorstyrningshinder är
historiska: verktygssessionens reset och Chrome-återanslutning fungerade.

Levererat: kundregister med sökning/paginering, kundkort och aktuell kontakt,
versionerad redigering/arkivering, bevarade bokningssnapshots och uttrycklig
kundkoppling i bokning/återbesök. Ingen automatisk matchning på e-post, inga
nya MCP-exporter. Syntetisk seed och fem optimerade bildassets används i UI.
Separat [produktsida](https://booking-lab-se-preview.vercel.app/product), [demoadmin](https://booking-lab-se-preview.vercel.app/admin) och [kundbokning](https://booking-lab-se-preview.vercel.app/).

- Branch **feature/epic06-customers-demo-product**, produkt-/QA-/deploy-SHA **7c1407dce66910ef8ab304c882c90d90c173ca72**.
- Bas16dae9a/6acd2ef, produktbas d7bc47f. Initial Epic06-kod024796f;
  rättning aab9fdf; uttryckligt beställt Lucide-urval och bildrefresh7c1407d.
- [Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md), original-SHA256 **5c1f5194d76fb2b88bb5ce05b7c3c7c0b3a68a4451cc50fd71c12bbcfc8a4381**. GO endast skyddad syntetisk preview;
  1 av 2 samlade fixvarv användes, inget nytt blockerande fynd. Grok testade
  separat Linux/Chromium-kopia, inte vår molnmiljö eller Actions.
- [Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796):alla4jobb40/40,76 unit/84 integration. Push-jobb43301798348 avbröts av
  avsedd concurrency när full manuell matris startades. Main oförändrad b000481.
- Deployment **dpl_<redacted>**, READY Preview target=null,
  fra1; faktiskt containerbygge i cle1/USA. Image sha256:
  **8dfea65990374ff6c8d16570c033ccac641deeea99748171f7bede0e1f6db3b0**.

Kodkarta: src/lib/customers.ts; src/app/admin/customers/_ och
src/app/api/admin/customers/_; bokningseditor/domän med valfritt customerId;
prisma/schema.prisma och ny20261112190000_customers. De 6 äldre migrationerna
är orörda. src/app/product/page.tsx, public/demo/\* och scripts/seed-demo.ts.
Kund-/seed-/E2E-regressioner i tests. Enda nya paketet är lucide-react 1.72.0,
ISC plus bevarad Feather/MIT-notis, inga egna runtime-beroenden. React 19.3.1
och Next 16.4.6 verifierade; inga befintliga paketversioner uppgraderades.
[Beroendebeslut](../DEPENDENCY_REVIEW.md), [arkitektur](../ARCHITECTURE.md).

Molnet: samma skyddade projekt och isolerade booking_ui_preview_demo.
Backup före migration verifierad genom återläsning. Alla35 äldre snapshots
bevarade; första seed46 nya+33 befintliga, tre följande0 nya/79 befintliga.
Efter egna molnprover33 kort/84 bokningar,0 överlapp,0 icke-example.test-kontakter.
Nya QA-kortet arkiverades, manuella/äldre data raderades inte. Endast den nya
Customer-tabellens SELECT/INSERT/UPDATE gavs befintlig approle; inga nya personer.

Faktisk Chromium-provning och fem riktiga stabil-aliasbilder finns i [DEMO](DEMO.md).
TLS/perimeter, appbehörighet, logout/replay, kundflöden och backup11 tabeller
PASS. Beständighet efter90 sekunder PASS; framtvingad omstart är NOT RUN.
[Kommandon, mellan-FAIL, audit och samlat bevis](VERIFICATION.md).

Rest/backlogg: ingen automatisk offentlig kundkoppling eller efterhandskoppling
av gamla fristående besök. Mobil paginering/aktiv flik kan förtydligas. En
avsiktligt kolliderande publik seednyckel gör att en demobokning hoppas över;
ingen felaktig koppling eller dataskada (Grok Låg, ingen ny fixloop).
Testport3000 är fast. Fysisk iPhone/Safari och ägarens UX-beslut återstår.
Pilot NO-GO; full audit7 moderate/0 high, runtime0; inga riskabla overrides.

Inga nya betalda abonnemang/tillägg, mainmerge, force-push, publik MCP eller
verkliga kunduppgifter. Fortsätt inte automatiskt till nästa Epic. Drift/stopp,
privata operatörsprofiler och tidigare miljöer beskrivs i DEMO; kopiera aldrig
miljöfiler till Git/Grok. Efter denna frysta revision är leveransändringar
endast dokumentation, original-QA och verkliga skärmbilder.

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Handoff — förbättrad skyddad demo

## Epic 06 — kandidat inför samlad QA, 2026-11-12

Ny branch feature/epic06-customers-demo-product från16dae9a/6acd2ef, produktbas d7bc47f. Kundkort och uttrycklig bokningskoppling, additiv sjunde migration,32fiktiva kunder/79seedbokningar samt separat /product. Gamla kundbokningen / och admin /admin består. Lokal uppgraderingskopia behåller37äldre bokningssnapshots;83bokningar totalt inklusive manuella prov,0överlapp, oförändrade tabellhashar vid ny seed. Riktat kundtest7/7, unit76, preliminär full integration81 före sista MCP-proben, kund-E2E4/4 på desktop/mobil. Ny slutmatris och oberoende Grok-QA återstår; preview är fortfarande d7bc47f. Ingen pilot eller ny betaltjänst. [Plan](EPIC_06_PLAN.md).

## Avgränsad auditomgång 2026-11-12

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](../DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.

**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Historik — tidigare leverans

# Handoff — Epic05 QA-godkänd lokal produktalpha

**Skyddad mobilpreview levererad 2026-11-12:** [Öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Branch preview/epic05-vercel-review, faktiskt driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7, deployment dpl_<redacted> (Preview/fra1). Senare dokumentationscommits ändrar inte driftsatt kod. Endast Niclas via Vercel Authentication på alla deployments, dessutom individuell appadmin. Inga nya betalda abonnemang/tillägg; befintlig Pro-förbrukning kan kosta några få dollar, Neon Free. [Drift och lokal hantering av adminuppgifter](DEMO.md).

Codex:72unit/72integration/24E2E×4, lint/tsc/build PASS. Grok GO för kod/paketering efter1samlat fixvarv, [originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md). [Actions43243542749](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749): alla4jobb gröna på exakt f2fdac7. Faktisk drift: perimeter HTML/API/resurs, TLS1.3, headers, stängd appport, login/logout/copierad-cookie-replay, kundbokning, mobilkalender, tjänster/personal, flytt/avbokning och spoofing-spärr PASS. Kallstart bekräftad i Vercellogg, samma session och bokning bevarade. Ny krypterad backup återläst lokalt,10tabellers innehåll identiskt.

Kvar: fysisk iPhone/Safari NOT RUN; krypterad backup finns på PC, inte automatisk extern backup. Audit full FAIL7moderate/0high/critical, production PASS0. PV-QA-4 (eviktion vid mättat lager), PV-QA-7 (minnesspecifika unit-tester med global postgres-env) ligger i backlogg. Bara Niclas får åtkomst; AGPL-källkodserbjudande måste lösas innan andra släpps in. Ingen kundpilot, mainmerge, ny Epic eller publik MCP. [Full faktisk verifiering/NOT RUN](VERIFICATION.md).
