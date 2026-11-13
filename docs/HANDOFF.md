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
i denna Codex-konversation efter tidigare laddningsproblem. Faktiska tools.*
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
lokala *_demo; alla radhashar lika, manipulerad AES-GCM-data nekas. Befintlig
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

Kodkarta: src/lib/customers.ts; src/app/admin/customers/* och
src/app/api/admin/customers/*; bokningseditor/domän med valfritt customerId;
prisma/schema.prisma och ny20261112190000_customers. De 6 äldre migrationerna
är orörda. src/app/product/page.tsx, public/demo/* och scripts/seed-demo.ts.
Kund-/seed-/E2E-regressioner i tests. Enda nya paketet är lucide-react 1.72.0,
ISC plus bevarad Feather/MIT-notis, inga egna runtime-beroenden. React 19.3.1
och Next 16.4.6 verifierade; inga befintliga paketversioner uppgraderades.
[Beroendebeslut](DEPENDENCY_REVIEW.md), [arkitektur](ARCHITECTURE.md).

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

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.


**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Historik — tidigare leverans

# Handoff — Epic05 QA-godkänd lokal produktalpha

**Skyddad mobilpreview levererad 2026-11-12:** [Öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Branch preview/epic05-vercel-review, faktiskt driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7, deployment dpl_<redacted> (Preview/fra1). Senare dokumentationscommits ändrar inte driftsatt kod. Endast Niclas via Vercel Authentication på alla deployments, dessutom individuell appadmin. Inga nya betalda abonnemang/tillägg; befintlig Pro-förbrukning kan kosta några få dollar, Neon Free. [Drift och lokal hantering av adminuppgifter](DEMO.md).

Codex:72unit/72integration/24E2E×4, lint/tsc/build PASS. Grok GO för kod/paketering efter1samlat fixvarv, [originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md). [Actions43243542749](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749): alla4jobb gröna på exakt f2fdac7. Faktisk drift: perimeter HTML/API/resurs, TLS1.3, headers, stängd appport, login/logout/copierad-cookie-replay, kundbokning, mobilkalender, tjänster/personal, flytt/avbokning och spoofing-spärr PASS. Kallstart bekräftad i Vercellogg, samma session och bokning bevarade. Ny krypterad backup återläst lokalt,10tabellers innehåll identiskt.

Kvar: fysisk iPhone/Safari NOT RUN; krypterad backup finns på PC, inte automatisk extern backup. Audit full FAIL7moderate/0high/critical, production PASS0. PV-QA-4 (eviktion vid mättat lager), PV-QA-7 (minnesspecifika unit-tester med global postgres-env) ligger i backlogg. Bara Niclas får åtkomst; AGPL-källkodserbjudande måste lösas innan andra släpps in. Ingen kundpilot, mainmerge, ny Epic eller publik MCP. [Full faktisk verifiering/NOT RUN](VERIFICATION.md).
