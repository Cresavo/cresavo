# Begriplig bokning och arbetsyta

Avgränsat användbarhetsuppdrag, 2026-11-12. Bas 967454f (dokumentation),
produktkod f2fdac7. Ingen ny Epic, datamodell, migration eller betaltjänst.
Arbetsbranch: `ui/epic05-booking-usability`. Slutresultat finns överst i
VERIFICATION och aktuell leverans i HANDOFF.

## Egen första genomgång

Den skyddade molnpreviewn gav Vercels inloggningsgrind i granskningswebbläsaren.
Skyddet sänktes inte. Därför granskades samma produktkod lokalt med separat
syntetisk `_demo`-databas: kundbokning, admininloggning, kalender, skapa,
flytta, avboka, tjänster, personal/scheman/pauser/ledighet och kampanjer.
Mobil 390 och 320 px samt desktop är Chromium-emulering, inte fysisk Safari.

| Observerat problem och reproduktion | Konsekvens | Genomförd rättning |
| --- | --- | --- |
| Kundsidan: datumfältet är faktiskt text med YYYY-MM-DD, ingen kalender. | Kräver exakt datum och tangentbord. | Gemensam kalender med svenska veckodagar, månadspilar, markerad dag och tangentbordsnavigation. |
| Kundsidan: välj en lördag. Endast ”Inga lediga tider detta datum”. | Återvändsgränd. | Lediga tider som knappar och ”Hitta nästa lediga dag”, sökning högst 60 dagar. |
| Före bekräftelse saknas en samlad behandling, pris, utförare och tid. | Svårt att kontrollera vad som bokas. | Sammanfattning före bokning och tydlig bekräftelse, svenska datum/Stockholmstid. |
| Startsidan har lång presentation före bokningsformuläret. | Bokningen hamnar långt ned på mobil. | Kompakt entré; bokningsflödet före bakgrundsinformation på mobil. |
| Admin: kalender och tomdag ger liten vägledning om nästa handling. | Ägaren måste tolka tekniska formulär. | Dagens/periodens faktiska bokningar, nästa besök, kort hjälp och tydlig ”Ny bokning”. |
| Admin: datum måste skrivas och filter kräver ytterligare ”Visa”. | Onödiga moment mellan behandlingarna. | Samma dagväljare; filter uppdaterar kalendern direkt med laddningsbesked. |
| Avbokning: första fokus är destruktiv bekräftelse. | Risk att oavsiktligt bekräfta. | Första fokus på ”Behåll bokningen”; tydlig separat avbokningsbekräftelse. |
| Kampanjer: tomläge hänvisar enbart till MCP. | Oklart vad ägaren kan göra. | Förklaring av befintliga utkast, publicering och giltighet; inga nya kampanjfunktioner. |

En initial bild av admin togs innan layouten stabiliserats. Den bilden och
andra felaktiga full-page-fångster från granskningsverktyget är **avvisade som
bevis**. En stabil omtagning visar korrekt menygeometri. Det är inte belägg för
att användarens övriga feedback är löst; det kräver den nya faktiska provningen.

## Acceptans och avgränsning

- Kund väljer dag och tid med tryck, ser sammanfattning och bokar utan datumtext.
- Byte av behandling/personal nollställer tidsval och hämtar ny tillgänglighet.
  Rättningsbara fel behåller kundens kontaktutkast och idempotent retry.
- Tomdag erbjuder nästa lediga dag; nätfel får statiskt svenskt besked och retry.
- Ägaren kan välja dag, filtrera personal och skapa/flytta/avboka med samma
  serverregler som tidigare. Tjänster och arbetstider behåller explicit spara.
- Centrala menyer och kalender fungerar utan horisontell scroll vid 320/390 px.
- Schemakonflikter, överlappsskydd, MCP, kvoter och origin/session-kontroller
  behålls. Ingen ändring av historiska migrationer eller produktens API-kontrakt.

## Minsta avgränsade demoåtkomst

Vanlig individuell produktinloggning är kvar. `POST /api/demo/session` är en
separat **avstängd standardväg** som bara skapar en vanlig återkallelig session
för `demo-owner@example.test`, märkt ”Demoägare”. Ingen påstådd Vercelidentitet.

Alla servervillkor måste stämma: explicit BOOKING_DEMO_ACCESS=1,
BOOKING_RUNTIME=vercel, VERCEL=1, VERCEL_ENV=preview, exakt projekt-id och
SHA256-fingeravtryck av separat databasvärd/port/namn. Production nekas även om
flaggan satts. Projekt-id är en Vercel-systemvariabel vid build och runtime:
[officiell dokumentation](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_project_id).
Lösenord ingår inte i fingeravtrycket. Miljöheaders från klienten aktiverar inget.

Origin-kontroll, wrapperns adressbevis, befintlig gemensam loginspärr, aktivt
adminkonto, kontolås/version och sessionernas serverrevokering behålls.
Demoaktörens gamla cookie nekas också när miljögrinden stängs eller inte matchar.
Inga hemligheter finns i knapp, klientkod eller URL. Logout kräver nytt knapptryck.

**Driftgrind:** aktivera inte innan Vercel Authentication är verifierat för alla
deployments och alias, HTML/API/resurser, med bara godkänd ägare. Appen kan inte
själv verifiera Vercelprojektets perimeter; det är en dokumenterad driftkontroll.
Utökat team eller borttaget skydd kräver att demovägen stängs först. Inte kunddrift.

## Reproducerbar syntetisk arbetsdag

`BOOKING_DEMO_SEED=1 npm run demo:seed` kräver lokal loopbackdatabas med `_demo`.
Kör först vanliga migrationer. En ny tom demodatabas behöver inte grundseedningen;
demo:seed skapar egna behandlingar och medarbetare. Befintliga grundseedade resurser
bevaras, vilket annars kan ge liknande behandlingsnamn. För redan godkänd isolerad molnpreview
krävs dessutom `-- --preview` och samtliga ovanstående projekt/databasvillkor.
Miljöuppgifterna läses privat av operatören, klistras aldrig in i chatt.

Seedningen lägger till 3 behandlingar, 2 medarbetare, vardagsscheman med lunch,
ledighet, 33 påhittade besök över lugna/fullbokade/delvis lediga dagar inklusive
historik och avbokningar, samt publicerad kampanj och utkast. Bara example.test.
Återkommande fiktiva personer har konsekventa testadresser. Inga utskick.

Seedningen **raderar eller uppdaterar inte befintliga resurser**. Existerande
idempotensnycklar gör återkörningen ofarlig även efter flytt. Om en ägare ändrat
schemat eller en annan bokning krockar hoppas just den demonstrationen över och
räknas som skipped. Framtida bokningar använder ordinarie domänlogik; historik
valideras mot schema och databasens överlappsskydd. Kör inte mot kunddatabas.

## Bevis och kvarvarande bedömning

Lokala loggar och bilder ligger utanför Git i
`C:/Users/<user>/booking-lab-pg-test/ui-usability/`. Utvalda slutbilder ska även
levereras med QA-underlaget. Skilj automatiserade bilder från egen klicktest.
Grok ska granska fryst revision i egen syntetisk kopia; ingen driftåtkomst.
Grokgranskning, Actions och molnprovning redovisas först när de faktiskt utförts.
Fysisk iPhone/Safari och produktägarens UX-godkännande återstår.

## Samlat rättningsvarv efter Groks första granskning

Originalrapport: [QA-REPORT-ui-dd98ae4](qa/QA-REPORT-ui-dd98ae4.md),
SHA256 314789fd93b22ae742b78563d9c6883a7eb38a2156ddcfe796d39291d34a85d8.
Grok gav avgränsat GO på dd98ae4, inte pilot: 75 unit/75 integration,
32 E2E i fyra lägen, egen headless-klicktest i 320/390/1440 och 66 egna bilder.
Det är Groks utförda kontroller i egen kopia, inte moln- eller iPhoneprovning.

Det samlade varvet rättar UX-QA-1–5, -9 och -10: läsbara personkolumner med
scroll enbart inom desktopkalendern, datum vid nästa besök, en tillbaka-länk,
svensk versalisering, begripligt konfliktbesked och läsbara datumrubriker.
Tangentbordstestet väntar på interaktiv kalender och verifierar flyttat fokus.
E2E mäter kolumnbredd och avsaknad av sidöverflöde; klientens headers/body/query
får inte aktivera demoåtkomsten. Egen komplettering: även port-parametrar i
databas-URL nekas, eftersom PostgreSQL-drivrutinen annars kan välja annan port
än det fastlåsta fingeravtrycket.

Kända låga förbättringar inför eventuell utökning, utan ny fixloop:

- UX-QA-6: dagknapparna är 32–42 px breda på smala skärmar, minst 44 px höga.
  WCAG:s 24 px-minimum uppfylls; fysisk iPhone ska bedöma ergonomin. Vi gör
  inte kalendern horisontellt rullande på telefon för att få 44 px bredd.
- UX-QA-7: miljöflaggan är en åtkomstpaus, inte en permanent revokering.
  En kopierad cookie från en session som inte loggats ut kan fungera igen om
  samma grind återaktiveras inom 8 h. Utloggade sessioner förblir återkallade.
  Använd befintlig kontospärr/credentialVersion eller höj ADMIN_SESSION_VERSION
  för permanent återkallelse vid stopp. Ingen ny auth-modell införs i UI-varvet.
- UX-QA-8: fler positiva HTTP-prober genom wrappern bör permanentas i repot.
  Groks separata 43 prober och våra integrationstester ersätter inte framtida
  regressionsunderhåll. Faktisk previewprovning dokumenteras separat.
- UX-QA-11/12/14/15: automatisk nästa-dag, utkast över omladdning, webbläsarens
  valideringsspråk och bättre statiska seed-felkoder är backlog, inga nya funktioner.

## Separering av verkliga prov och den nya arbetsdagen

Läsande kontroll av den gamla molndatabasen fann en tidigare provbokning med
kontaktadress utanför reserverad testdomän. Den gamla databasen är **orörd** och
dess data kopieras inte till den nya demonstrationen eller till Grok.
Den förenklade demovägen aktiveras inte mot den gamla databasen.

En ny tom `booking_ui_preview_demo` har förberetts inom den befintliga Neon
Free-resursen, utan ny tjänst/plan eller beställning. Sex oförändrade migrationer,
separat begränsad databasroll och ny sessionshemlighet. Gamla appkontot saknar
CONNECT till den nya databasen; nya appkontot saknar migrations-/ägarprivilegier.
33 helt syntetiska bokningar kontrollerades: 0 icke-testadresser och 0 överlapp.
Grundseedens egna dubbla resurser i denna nyskapade databas får inaktiveras för
en konsekvent demo; detta görs inte automatiskt av den additiva seedningen.
Aktuell driftsatt databas/revision redovisas i DEMO efter faktisk verifiering.

## Sista avgränsade rättningsvarvet: lång sidscroll

Groks [originalrapport för f737ed2](qa/QA-REPORT-ui-fix1-f737ed2.md)
har SHA256 6a70cd90ac77688c526e6fb47428c13ebd7d6099c4e8df5208e749216f4adb2e.
Även denna fick avgränsat preview-GO, utan pilotgodkännande. Den korta
scrollproben räckte dock inte för att verifiera den fasta tidsaxeln.
Codex reproducerade att axeln försvann vid 2400 px sidscroll: gridens box var
1382 px medan dess innehåll var 4588 px (UX-QA-22).

Varv 2 begränsas till `width: max-content; min-width: 100%` på kalendergriden
och en regression med fyra medarbetare. Testet kontrollerar inbyggd piltangent,
rullar därefter deterministiskt till hela regionens slut och mäter att
tidsaxeln stannar vid vänsterkanten och att sidan inte får horisontell overflow.
Inga boknings-, auth-, MCP-, API- eller databasregler ändras i detta varv.

Övriga nya låga fynd från Grok blir backlog, ingen tredje fixloop:

- UX-QA-17/19: framtida strukturerade felkoder och kosmetik i kalenderns hörn.
- UX-QA-18: fingeravtrycket bör i framtiden även validera tom host och pg:s
  alternativa miljöstandarder. Den faktiska nya previewprofilen har redan
  explicit icke-tom host och port5432; byte av lösenord/roll ändrar inte målet.
- UX-QA-21: migrationen skapar Anna även utan grundseed. En ny lokal databas
  kan därför ha tre aktiva medarbetare efter enbart migrate + demo:seed.
  Den faktiska nya molndatabasen har två efter explicit inaktivering av sina
  egna grundresurser; historiska migrationer och befintliga data ändras inte.

## Slutleverans och bildbevis

Produktkod d7bc47f5596cc8be06e58603fe2f32457c6b0fa0, [Grok slutrapport](qa/QA-REPORT-ui-fix2-d7bc47f.md), SHA2566e79ec4f9ae3990234f67c9aa23b6b4deb65ad87c5ff1a61b9ec915bbfe5f095. Två samlade fixvarv avslutade, GO för syntetisk skyddad preview, inte pilot.

| Flöde | Före f2fdac7 | Efter d7bc47f |
| --- | --- | --- |
| Kundval/sammanfattning | [Bild](assets/ui-usability/before-customer.png) | [Bild](assets/ui-usability/after-customer.png) |
| Mobil arbetsdag | [Bild](assets/ui-usability/before-calendar.png) | [Bild](assets/ui-usability/after-calendar.png) |

Jämförelseparen använder samma lokala syntetiska dataset,390px och produktionsbyggen. [Manifest/hash](assets/ui-usability/manifest.json). [Faktisk molnadmin](assets/ui-usability/live-admin.png) och [bekräftelse](assets/ui-usability/live-confirmation.png) är separata bevis med nytt isolerat dataset. Bilderna är granskade; inga laddningsskärmar används. Inledande felaktiga IAB-fullpagebilder uteslöts; de bevisar inte att basens navigation alltid var trasig. Fysisk iPhone är inte verifierad.
