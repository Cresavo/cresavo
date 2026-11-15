# Aktuellt: Agentprov 2, separat lokal gren

- Niclas godkände denna avgränsade fortsättning 2026-11-15. Worktree
  booking-lab-agentprov-2, branch codex/agentprov-2 från e890b69. Agentprov-1
  på e890b69 är fryst för oberoende QA och får inte ändras eller pushas.
- Ingen push, PR, merge, rebase, deploy, molnmiljö, nya konton eller betaltjänster.
  Ingen .env/hemlighetsläsning; alla nya uppgifter ska vara syntetiska.
- Läs POLICY_MERGE_PLAN, LEGACY_DECOUPLE_PLAN och AGENTPROV_2_PROTOCOL_NOTES.
  Konfliktkontroll fann fem dokumentkonflikter: endast policyplan, ingen merge.
  Legacy får i denna omgång endast planeras; ta inte bort moduler eller tester.
- USP-profil/llms och namnalias behåller native kontrakt och befintlig auth.
  Tool-namn bevisar inte full USP-konformitet. buyer.consent är inget mandat.
- Mandatets plats/schema härleds server-side och jämförs med lagrat scope;
  klient-JSON får inte ersätta eller vidga det. Historiska migrationer består.
- Kör lint, tsc, full unit/integration och build; integration enbart med
  befintlig loopback-DB-vakt. Rapport <local-scratch>/night-02.md under4000tecken.
  Rapporten är aldrig bevis utan faktisk output från den aktuella koden.

## Fryst historik: Agentprov 1

- Niclas valde READ-WRITE 2026-11-15. Bas bf7b6c3, gren codex/agentprov-1.
  Ingen push, PR, merge, rebase, deploy, kontoskapande eller secret-provisionering.
- Läs AGENTPROV_1_PLAN/RUNBOOK/PREVIEW och översta aktuella verifiering/status.
  Äldre leveransavsnitt nedan är historik, inte nya uppdrag eller aktuella bevis.
- Befintlig REST och HTTP-MCP återanvänds. Creation kräver serverlagrat
  syntetiskt operatörsmandat; confirmed räcker inte. Stabil klient över rotation.
  Bevara atomär Booking/händelse/AgentBooking och alla gamla lås/migrationer.
- Ingen .env läses i provet. Inga hemligheter i utskrift, klientkällkod eller
  QA-material. Lokal test-DB-vakt består; Neon är aldrig en integrationstest-DB.
- Windows shared-booking-policy b241d8a/a101704 är separat och inte införd.
  park/legacy bevarar basen; bred modulbortkoppling är inte genomförd.
- Transportprovet är inte en verifierad personlig assistentkörning. /live är
  best effort, inte audit/statuskälla. Inga riktiga kunder eller utskick.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guide för Booking Lab SE

## Uppföljning: agentklient och pilotunderlag

- Produkt/Grok cced211, feature/agent-client-pilot-readiness från7998056.
  Scoped GO lokalt, Actions43597108005 fyra gröna64/64,114unit/128integration/13kort.
- A2A-create behåller public och använder befintligt actorId som tekniskt
  kanal-id. Ingen WorkspaceActor-utökning eller ändring av gamla händelser.
  Visa enbart etikett, aldrig rått actorId. AC-QA-1 negativa testluckor är backlogg.
- Verklig klient har bookingEnabled=true och app-only-bekräftelse. Frånvaro av
  skrivverktyg i modellistan är inte ett anslutningsfel. Ny nativeklickning NOTRUN;
  ingen sidopanel och capturetimeout. Ingen profil/secret/preview ändrad.
- Läs aktuell HANDOFF/VERIFICATION och PRIVACY_SECURITY:s nya pilotgrindar.
  Individuella konton/manuell datahantering finns; MFA/retention/kunddrift kvar.
  Ingen ny fixloop eller nästa epic automatiskt.

## Levererat: komplett bokningsdag och lokalt A2A-prov

- Produkt/Grok d8562b8 på feature/complete-booking-day, ett samlat fixvarv.
  Scoped GO endast syntetiskt lokalt. Actions43593764129: fyra gröna62/62,
  114unit/128integration/13kort; audit7moderate dev, produktion0.
- Läs COMPLETE_BOOKING_DAY_PLAN och aktuell HANDOFF/VERIFICATION samt
  docs/qa/QA-REPORT-booking-day-f1-d8562b8.md. Senare docs ändrar inte produktSHA.
- A2A är dev-only opt-in, loopback, skyddad discovery/RPC, separat test/demoDB;
  aldrig Next-route, Vercel eller fjärrbehörighet. Bokning kräver serviceVersion,
  confirmed och UUID men klientflaggan bevisar inte mänskligt mandat.
- Gemensam demokvot/public-historiketikett och Low om obegränsad dränering är
  dokumenterad backlogg. Ingen ny deployment/nativeklient/pilot eller nästa epic.

## Levererat: visuell UI-polering

- Produkt/Grok/CI/deploy9840309, ui/salon-polish från2c74a4b. Två samlade
  rättningsvarv avslutade, scopedGO; inga fler loopar automatiskt.
- 106unit/125integration/13kort/58webb×4 och4grönaCI-jobb43529548681.
  Samma skyddade preview verifierad med Chrome/HTTP/read-onlySQL;94bokningar kvar.
- Ingen lib/API/MCP/auth/schema/packageändring. Kalenderns24pxlayout är ren
  presentation, hover/fokus ändrar aldrig klickytan. Full info i aria/title/detalj.
- Audit7moderate dev/produktion0; pilot/fysiskSafari/ägarnasUX-godkännande kvar.
  Smala kort/kanter/palett och testutökning till backlogg, inget nytt uppdrag.
- Läs UI_POLISH_PLAN, aktuell PROJECT_STATUS/HANDOFF/DEMO/VERIFICATION och
  docs/qa/QA-REPORT-polish-f2-9840309.md. Senare docs ändrar inte produktSHA.

## Levererat: sammanhängande salongsupplevelse

- Produkt/Grok/CI/deploy 51d54d4, feature/coherent-salon-workspace från 3273934.
  Grok scoped GO efter ett samlat fixvarv. Actions 43502629318 har fyra gröna jobb med 54/54;
  102 unit / 125 integration / 13 kort/lint/tsc/build PASS. Audit 7 moderate dev/omit dev: 0.
- Samma skyddade preview verifierad med verklig Chrome-klick och SQL/HTTP.
  93 gamla bokningar/originalrader bevarade, endast 1 egen avbokad testbokning ny.
  Senare Markdown ändrar inte produktkoden. Main är orörd; ingen nästa Epic nu.
- Läs DEMO/PROJECT_STATUS/HANDOFF/VERIFICATION och Groks original i docs/qa.
  Bevara gemensam returkontext/säker allowlist, verklig dirty-guard och grundregler.
  Low gallringsordning/Info korrupt scrollpost är backlogg, ingen ny fixloop.
- Fysisk iPhone/Safari och Niclas UX-godkännande återstår; pilot NO-GO.
  PC-plugin/runtime 05 på 3187 och dess DB/profiler är separata och bevarade.
  Ingen ny fjärr-MCP, modul, ny kostnad/åtkomst, mainmerge eller licensändring.

## Levererat: beständigt agentkort och ägarens arbetsdag

- Produkt/slutlig Grok-revision05e5eaf, två samlade rättningsvarv avslutade.
  Lokal syntetisk POC-GO, inga Medium/High. Privat push och Actions43467138367:
  fyra gröna48/48.91unit/125integration/13kort PASS. Bevarade lokala dev-fel
  och cacheåterställning redovisas i VERIFICATION, inte dolda bakom omkörningen.
- Privat plugin0.3.0 och lokal runtime/web3187 är aktiverade; två äldre bokningar
  och händelser bevarade. Separat readonlySQL/egen ownerhemlighet/show_workday.
  Nya native-klick, owner-hot-reload, fysisk mobil och kalenderimport NOT RUN.
  Målet är avslutat med dessa uttryckliga begränsningar. Ingen ny Epic/fixloop.
- F2: kontrollera faktisk clientKey före svar i äldre MCP/publik HTTP för
  time-card\_-replay. Ändra inte domänens kontrakt för andra namespaces.

- Niclas har godkänt docs/AGENT_BOOKING_WORKDAY_PLAN.md och hela goal-prompten.
  Bas e702838/produkt8126410, branch feature/agent-booking-workday. Ensam skrivare.
- CardBookingAttempt är en liten beständig försökslogg, inte kundautentisering.
  Scope härleds av privat lokal profil och SESSION_SECRET; aldrig av payload/id.
  Högst ett oklart försök per kanal. Behåll retry-payload/nyckel även efter stängt
  kort. Same createBooking/kvoter/lås; tio migrationer varav en ny additiv.
- read_demo_bookings/get_demo_calendar_file är app-only, opt-in, kanalavgränsade.
  Ingen kundkontakt eller obegränsad historik. ICS visar behandling utan buffert;
  kalenderimport och senare synk är inte verifierade bara för att filen hämtats.
- --admin --workday-card + BOOKING_OWNER_CARD_DEMO=1 är separat betrodd lokal
  läsprofil, aldrig kundkortets rättigheter. Vanlig admin krävs i länkad arbetsyta.
- Grok granskar fryst kod i egen syntetisk kopia/max2samlande fixvarv. Privat
  push och exakt full Actions enligt planen. Ingen ny molnanslutning/mainmerge.
  Native/mobil skiljs från testvärd; produktägarens manuella test krävs inte.

## Levererat: lokalt bokningsprov från MCP-kort

- Niclas godkände 2026-11-13 `docs/MCP_CARD_BOOKING_PLAN.md`. Bas fdcb41b,
  feature/mcp-card-booking-proof; bygg vidare utan omtag av gamla epics.
- Separat lokal opt-in/demodatabas, fast syntetisk kund, uttrycklig bekräftelse.
  Samma createBooking/kvoter/idempotens/exclusion; ingen adminbudget i kortet.
- Bevara standardens läsläge, gamla profiler och all historik. Ingen publik
  MCP, ny drift/dependency eller mainmerge. Fryst Grok-QA/max2fixvarv.
- Tappat skrivsvar är ett okänt utfall: samma payload/nyckel på retry, inga
  påståenden om att bokning saknas. Skilj testvärd från verklig klientprovning.
- Produkt8126410 har Grok scopedGO (4Low/1Info, ingaMedium+). Inga nya fixloopar
  för backlogg.85unit/113integration/3läs-UI/4boknings-UI/46webb×4 PASS lokalt.
- Plugin0.2.0 är privat på fryst8126410. Efter Niclas PC-omstart laddades
  bookingEnabled=true. Niclas bokade själv2olika tider; Codex verifierade
  2rader/2create-events/0överlapp och verklig skyddad Chrome-admin/detalj.
- Actions43430009174 är grön på8126410 efter1omkörning av oförändrad dev0:
  initialt112/113 med anslutnings-/testtimeout i gammalt refundtest; rotorsak
  okänd. Inga assertions/timeouts ändrade. OriginalFAIL och Grokrapport bevaras.
- Uppdraget är klart som lokal syntetisk POC. Ingen fysisk iPhone/Safari eller
  egen native-kortklickning är gjord. Ingen nästa epic eller Low-fixloop automatiskt.

## Lokalt MCP-tidvalskort: scoped QA klar, mobil återstår

- Niclas godkände `docs/MCP_TIME_CARD_PLAN.md` och valde ChatGPT på PC:n först.
  Bas `1a49a0e`, branch `feature/mcp-time-card`. Ingen ny epic eller fjärr-MCP.
- Endast läsning och syntetisk separat lokal databas; inga boknings-/adminverktyg.
  Bevara gamla serverprofiler. Tidsval är aldrig en bokning eller reservation.
- Grok scopedGO påa65f0f2,3Low/5Info i backlogg utan ny fixloop. PC-rendering
  bekräftad av användarfoton. Niclas bekräftade därefter lyckad kontroll av
  tidsvalet i PC-klienten efter ett tidigare hämtningsfel; orsaken är okänd.
  Egen klientklickning är inte verifierad och mobilen visar inget kort. Privat push klar, Actions43417840017 har4gröna46/46 påa65f0f2. Skilj ChatGPT-rendering från
  SDK/testvärd. Ingen Vercel-ändring, mainmerge, nya beroenden eller abonnemang.

## Levererat: kunddatas livscykel och lokalt ägaragentprov

- Klart som syntetisk POC på95f8071. Grok-GO efter1fixvarv, Actions43393207291:
  4gröna46/46. Samma skyddade preview verifierad; inga fler epics automatiskt.
- Niclas har godkänt steg2–3 och manuell hantering; automatisk gallring av.
  Läs docs/CUSTOMER_LIFECYCLE_AGENT_PLAN.md. Basd2ccb6c på separat
  feature/customer-lifecycle-agent-proof, inte äldre main. Bevara tidigare bevis.
- Export/kontaktborttagning enbart admin och syntetisk data; kalla inte kvarvarande
  historik anonym eller GDPR-klar. Ingen kontakt-MCP, ny drift eller betaltjänst.
- Kontaktåtgärder tar befintligt exklusivt konfigurationslås. Booking.version
  och CapacityDecision-källor bevaras; separat contactRemovedAt markerar
  kontaktändringen. Återaktivera inte borttagna kort och rensa inte kvotnycklar.
- LC-QA-1: nya icke-adminbokningar lagrar e-postkvot som email-hmac-v1.
  Äldre råa nycklar räknas tillsammans med HMAC och omkodas vid kontaktåtgärd.
  Behåll normaliserat e-post/dagslås, createdAt och tak3/dag även efter borttagning.
- --capacity-only avgränsar befintlig lokal MCP. Klientens confirmed=true är
  ingen garanti för mänskligt mandat; redovisa faktiska klientanrop separat.
- Samma avgränsade arbetssätt: ensam skrivare, fryst separat Grok-QA/max2fixvarv,
  privat push och samma skyddade preview efter verifiering. Behåll äldre8migrationer,
  exclusion/kvoter/lås/idempotens. Faktisk AI-klientprovning skiljs från SDK-test.

## Avslutat nattmål 2026-11-13: proaktiv kapacitet

- Produkt/QA/deploy8843d06, Grok-GO efter1samlat fixvarv; PRO-QA-1 stängt.
  Privat push och Actions43353236981:4gröna42/42jobb. Samma skyddade alias
  verifierad; provsteg/bilder i DEMO, kommandon/NOT RUN i VERIFICATION.
  Senare docs/bilder ändrar inte produktkoden. Nattmålet avslutat; inga fler
  epics utan nytt avgränsat uppdrag. Mindre QA-fynd är backlogg, inte fixloop.

- Godkänd Del A: `docs/PROACTIVE_OVERVIEW_PLAN.md`; full Del B i docs/research.
  Bas28a48fe, feature/proactive-capacity-overview, inte äldre main. Kalenderprov klart.
- Endast framtida avbokning → aktuell tillgänglighet → kalender/avfärda/verkligt
  idempotent kampanjutkast. Inga kundfält i förslagen, ingen slotexklusiv kampanj.
- Codex ensam skrivare, fryst separat Grok-QA/max2fixvarv. Privat push och samma
  skyddade preview efter godkänd QA inom befintligt mandat, ingen mainmerge.
  Slutför och stanna; journal/lager/ekonomi/full AI-prissättning är roadmap.

## Planändring: agent-first och kalenderjämförelse, 2026-11-12

- Läs aktuell `docs/PRODUCT_ROADMAP.md`. Niclas har därefter godkänt första
  lokala syntetiska kalenderprovet med befintlig MCP och Grok-QA. Status och
  underlag: `docs/calendar-proof/README.md`. Ingen fjärr-MCP eller livekalendersynk.
- Kundagentens kalenderunderlag ska stanna hos agenten; behåll webb och
  gemensam domänlogik, dataminimering och samtliga befintliga pilotgrindar.

## Epic 06 levererad skyddad syntetisk demo, 2026-11-12

- Produktkod7c1407d, Grok-GO efter1samlat fixvarv; Actions43301797796 har4gröna
  E2E-jobb40/40. Samma stabila skyddade alias, aktuell drift/provning i DEMO.
  Senare docs/bilder ändrar inte produktkoden. Ingen automatisk nästa Epic.
  Fysisk iPhone/Safari och Niclas UX-beslut kvar; pilot NO-GO.

### Godkänt genomförande och bevarade regler

- Läs docs/EPIC_06_PLAN.md: A kundregister, B återkörbar syntetisk demo/assets,
  C separat produktsida. Bas16dae9a/6acd2ef (produkt d7), inte äldre main.
- Niclas tillåter minsta kundmodell och additiva migrationer samt privat push
  och uppdatering av samma skyddade preview. Ingen mainmerge/reset/ny betaltjänst.
- Bevara snapshots; inga automatiska kundsammanslagningar eller publika
  kunduppslag/överskrivningar via e-post. Kontakt visas bara på kort i explicit
  isolerad demo; listor/bokningar/MCP behåller minimering. Läs DATA_FLOWS.
- Codex är ensam skrivande huvudagent. Samlad fryst Grok-QA i separat syntetisk
  kopia, högst två samlade rättningsvarv. Funktionstester och audit separeras.
- Niclas tillägg: återanvänd standarddelar där de minskar arbetet. Leveransen
  använder ett litet Lucide-urval med textetiketter. Ny komplex UI ska föredra
  granskat Base UI/shadcn; lägg inte till oanvända paket eller skriv om enkla
  fungerande formulär. Versions-/licensbeslut i DEPENDENCY_REVIEW.

## Levererat användbarhetsuppdrag, 2026-11-12

- Produktkod d7bc47f: två samlade Grok-fixvarv avslutade, GO för skyddad syntetisk preview; ingen tredje loop eller pilot. Stabil länk/stopp i docs/DEMO.md, tester i docs/VERIFICATION.md. Senare docs ändrar inte koden.
- Separat `ui/epic05-booking-usability` från967454f/f2fdac7. Befintliga funktioner,
  datumval, arbetsyta och syntetisk demo; ingen ny Epic eller ändrad kärnlogik.
  Läs UI_USABILITY_REVIEW och aktuell VERIFICATION/HANDOFF innan nästa ändring.
- Niclas har uttryckligen ersatt dubbel manuell inloggning för sin privata demo:
  opt-in demoknapp bakom verifierat Vercel-skydd på alla deployments/alias, exakt
  previewprojekt och separat demodatabas. Normal individuell produktinloggning
  består. Aktivera aldrig demo mot Production eller den gamla provdatabasen.
- Gamla molnprover bevaras separat; operatörens nya profil är ignorerad
  `.vercel/ui-runtime.private.json` i previewarbetskopian. Inga hemligheter till
  Git/Grok/URL. Läs DEMO före driftändring. Återkommande GitHub-bevakning är läsande.

## Avgränsad skyddad Vercel-preview, godkänd 2026-11-12

- Levererad skyddad preview på fryst f2fdac7,1samlat QA-fixvarv. Faktisk drift/CI/backup är verifierade; fysisk iPhone/Safari återstår. Bara Niclas har åtkomst; lägg inte till andra innan AGPL-källkodserbjudande och nytt åtkomstbeslut. Drift/stopp/privata lokala adminuppgifter: docs/DEMO.md.
- Separat worktree/branch preview/epic05-vercel-review från29ac297. Niclas har godkänt runtime-/säkerhetsanpassning och skyddad syntetisk preview, några få dollar extra Vercelförbrukning men inga nya betalda abonnemang/tillägg. Ingen ny Epic/pilot/mainmerge.
- Behåll lokala socketregler. Vercel kräver explicit runtime, gemensam PostgreSQL-spärr, all-deployment perimeter och individuell appadmin. Ingen memoryfallback eller publik MCP. Läs ARCHITECTURE/DEMO och aktuell VERIFICATION.
- Grok granskar fryst källkod i egen kopia, inga miljöfiler, preview-/serveråtkomster eller secrets. Högst två samlade rättningsvarv. Faktisk drift verifieras separat före länk; tidigare lokal QA är inget driftgodkännande.

## Epic 05: leveransstatus och godkänd plan, 2026-11-12

- Epic05 produktkod4fc98d3 har Grok-GO som lokal alpha. Privat leveransc12b98a har4gröna CI-E2E-jobb; senare Markdown ändrar ingen kod. Separat skyddad mobilpreview är levererad enligt ovan; pilot NO-GO. Börja inte om eller härled en ny Epic06. Aktuellt underlag i PROJECT_STATUS/HANDOFF/CI_DELIVERY_2026_11_12.
- Läs `docs/PRODUCT_ROADMAP.md` och `docs/EPIC_05_PLAN.md` när produktägaren startar nästa mål. Epic 01–04 är avslutade POC-uppdrag; bygg inte om dem. Planbas är Epic 04 `26b680d`, inte äldre main.
- Epic 05 ger faktisk kalender, tjänste-/schemakonfiguration, skapa/flytta/avboka och samma tillåtna lokala MCP-handlingar. Framtida lager, kampanjutbyggnad, journal och ekonomi är roadmap, inte automatiskt nya uppdrag.
- Codex skriver kod. Använd befintlig Booking Lab QA/Grok via verifierad Computer Use-konversation för fryst separat granskning. Verifiera skickat meddelande, kodåtkomst och rätt SHA; inget QA-GO från ett oskickat utkast. Högst två samlade rättningsvarv enligt planen.
- Less is more, riktig mobil dagvy och desktopkalender. Tidigare AI-genererade dashboardbilder är avvisade. Riktiga knappar/etiketter, inga bildknappar eller permanent stor AI-panel.
- Planen tillåter relevanta nya domänfunktioner, kontrakt och additiva migrationer efter tester, aldrig omskrivning av historiska migrationer eller borttaget konfliktskydd. Basens säkerhetsinvarianter nedan består.
- Färdig verifierad Epic 05 får pushas till befintligt privat origin enligt planens leveransgrind. Äldre batchspecifika pushstopp nedan gäller sina historiska uppdrag. Ingen main-merge, force-push, deploy, riktig data eller ny betald tjänst. Privat mobilpreview kräver separat uttryckligt miljögodkännande; lokal demo är inte en mobilåtkomlig site.

## Gemensamma regler

- Läs `README.md`, `docs/ARCHITECTURE.md` och `docs/ENGINEERING_PRINCIPLES.md` före ändringar.
- Gör små, tydliga ändringar; behåll webb och MCP på samma domänlogik. Ändra inte API-kontrakt eller migrationer utan uttryckligt uppdrag.
- Behåll servervalidering, admin- och origin-kontroller samt PostgreSQL:s överlappsskydd. Använd bara syntetiska kunduppgifter.
- Kör relevanta tester, lint och build enligt README; ange vad som faktiskt körts och eventuella begränsningar. Använd en separat testdatabas.
- Lägg inte till beroenden utan tydligt behov. Publicera inte, lägg inte till remote och exponera inte hemligheter utan uttryckligt uppdrag.
- Följ `docs/DATA_FLOWS.md` och `docs/PRIVACY_SECURITY.md`: använd syntetiska uppgifter och logga eller skicka inte kunddata/hemligheter till externa agenter eller tjänster utan dokumenterad behörighet och bedömning.
- Behandla `businessId` och lokal MCP-adminflagga som POC-begränsningar, inte verifierad tenant-isolering eller fjärrautentisering. Bedöm även indirekt hälsodata.

## Kodkarta

- `src/lib/domain.ts` och `time.ts`: gemensamma bokningsregler, datum och MCP-paginering; `db.ts` och `prisma/`: databas och historiska integritetsregler.
- `src/lib/auth.ts`, `errors.ts`, `http.ts`: lokal session och säkra felgränser. Skicka aldrig råa felobjekt till loggar eller klienter; `DomainError` får bara innehålla godkända statiska meddelanden.
- `src/app/`: webb/admin/HTTP; `src/mcp/`: endast lokal stdio. SDK-valideringsfel kan spegla klientens egna indata; det är inte en fullständig sekretessgräns.
- `tests/`: unit, riktig PostgreSQL-integration och desktop/mobil. Läs `docs/WORKPLAN.md` för aktuell verifiering och `docs/HANDOFF.md` för överlämning. CI ligger i `.github/workflows/verify.yml`, utan publicering.

## Produktägarleverans efter varje Epic

- Uppdatera `docs/PROJECT_STATUS.md` med observerbara acceptanskriterier, datum/revision, faktisk testning, delvis/planerat och pilotblockerare. Använd inga uppskattade procenttal.
- Spela in full demo enligt `docs/DEMO.md` när en Epic är klar, inför en överenskommen viktig avstämning eller på uttrycklig begäran. Vanliga QA-/fixomgångar kräver tester och en kort resultatrapport, inte ny inspelning. Ta riktade skärmbilder när en synlig ändring behöver granskas. Detta ändrar inte kraven på automatiska tester.
- Återanvänd senaste relevanta demo med tydlig revision och ange om bilderna är äldre än koden. Nya inspelningar använder separat syntetisk databas; länka lokala artefakter/manifest och håll dem utanför Git.
- Lägg kort svensk rapport i `docs/PRODUCT_OWNER_REPORT.md`: byggt, prova nu, förbättrat, kvarstår och tre nästa mål. Skilj alltid POC/PASS från produktionsklarhet; bevara tidigare Epic-bevis i HANDOFF/VERIFICATION.

## QA-skydd

- E05-QA-1: adminbokning använder separat serverhärledd kontobudget100/dag och60/15min, aldrig publik IP-/e-postkvot. Behåll auth före replay, adminnamespacad idempotens och kund/MCP-taken; klientpayload/cookie får inte uppgradera publik väg. Se ARCHITECTURE.

- Tester får bara använda separat loopback-databas med suffix `_test`/`_demo`; kringgå aldrig `scripts/test-db-guard.mjs`.
- Bevara rate limit, dagstak, idempotenslås och databasens exclusion constraint. Gå via `createBooking`, inte lagringshjälparen.
- Starta HTTP via `npm run dev/start` och socket-wrappern. `TRUST_PROXY_IP=1` kräver matchande socket i TRUSTED_PROXY_IPS och överskrivande proxy; lokal `--admin` är ingen fjärrbehörighet.
- Aktuell resultatlista finns överst i VERIFICATION; historik i bilagan. Licensbegränsningar: `THIRD_PARTY_NOTICES.md`. Prisma 7 är verifierad i Epic 03; beslut/återstående distributionsgrindar finns i `docs/DEPENDENCY_REVIEW.md`.
- CI-kostnadsändring 2026-11-12: feature-push kör ett ben; main/manuell Verify POC kör alla4. Behåll full manuell matris på exakt levererad SHA vid Epic-slut. Docs ignoreras och samma repos PR-jobb duplicerar inte push. Separat veckoaudit har synligt full-audit-utfall och high/critical-grind; måttliga fynd är inte lösta eller pilotgodkända. Schemat aktiveras först när workflow finns på default-branchen; ingen mainmerge följer av detta.
- Epic 01 är avslutad. Epic 02 är godkänd enligt `docs/EPIC_02_PLAN.md`: endast lokal syntetisk MCP-bokning. Visa e-post är fortsatt utanför scope. Logout måste återkalla serverraden; idempotenta replays förbrukar ingen budget. Bevara alla historiska migrationer.
- MCP-subprocesser får samma exporterade DATABASE_URL via mcpEnvironment, inte alla förälderns hemligheter. Kör bara en QA-omgång per miljö; bevara fixture-städningens egen teardown-tid och spårning av egna sessionshashar.
- Epic05 MCP: nya arbetsytemutationer kräver separat --admin --allow-workspace; äldre --allow-bookings får inte aktivera dem. Behåll strict/safeToolSchema, version/request-id och kundfria svar. get_staff_schedule är ett datumfönster; läs get_staff_configuration före full ersättning av exceptions. Medföljande --workspace-klient kräver ja inför varje skrivning och ska stoppa vid nej/EOF utan att rulla tillbaka tidigare bekräftade ändringar. Se ARCHITECTURE/DATA_FLOWS.
- Vitlistad explicit miljö är inte OS-isolering. Prisma 7:s runtime autoläser inte .env; CLI laddar den uttryckligen. Se ARCHITECTURE och PRIVACY_SECURITY. Bevara create_booking:s strikta publicerade schema, safeFailure-sanerade validering och separata --admin/--allow-bookings-flaggor.
- Repot ska förbli privat. Äldre lokala batcher fick inte pushas utan nytt uppdrag; senare uttryckliga leveransmandat anges i respektive målplan.

- Epic 02 är slutgodkänd i dba05a2. Epic 03 följer `docs/EPIC_03_PLAN.md` och `docs/DEPENDENCY_REVIEW.md`. Prisma 7 använder `scripts/database.mjs` överallt: skapa inte adapterlös PrismaClient eller separat pool. Bevara UTC-session, poolgräns och strukturerad adapterfelsmappning. Bara CLI:s prisma.config.ts laddar .env; detta är inte OS-isolering. Äldre Prisma 6-noteringar beskriver Epic 02.

- Loginspärren måste kontrolleras före lösenordet, även rätt lösenord nekas från spärrad klient. Behåll testet att ingen lösenordskontroll anropas efter spärr. ADMIN_SESSION_VERSION får endast höjas.

- Uppföljning efter 8b83a40: M2/L8 och fyrfältsmatris i CI. Bevara låsordningen idempotens → klient/dag → e-post/dag → anställd/bokningsdag; ta anställdslåset före tillgänglighetskontroll. Ombokning som låser flera resurser måste utvidga ordningen deterministiskt och regressionstestas. Nya CI-jobb är inte verifierade på GitHub förrän en godkänd push har körts.

- Epic 04: individuell lokal admin enligt docs/ADR_004_ADMIN_IDENTITY.md och docs/ADMIN_OPERATIONS.md. Ingen ADMIN_PASSWORD-fallback. Behåll asynkron spärrreservation före KDF, max fyra KDF-operationer, kontoradlås och credentialVersion vid login/reset/spärr. Radera aldrig historiska sessioner som migreringsgenväg. Endast example.test; kund-e-post är fortsatt maskerad. Testfixtures måste städa egna AdminUser och sessionsrader.

- Produktägaren godkände 2026-11-12 push av färdiga Epic02–04-brancher till befintligt privat origin efter tester/Grok-QA. Det avslutade målet finns i docs/GOAL_EPIC_02_04.md. Epic 05 har separat plan ovan; inga odefinierade framtida Epics. Rapportera alla fyra Actions-jobb och kända audit-undantag per exakt revision.

- Epic04 är godkänd som lokal POC på471f91f. Bevara PasswordCapacityError som enda återbetalningsgrund för inloggningsförsök: återlämna originalobjektet, aldrig aktuell bucket via ny uppslagning. Verkliga fel och redan spärrad klient får ingen refund. Läs EPIC_04_QA_FOLLOWUP och slutrapporten före ändringar.
