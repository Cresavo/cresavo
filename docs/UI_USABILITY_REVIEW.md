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
Kör först vanliga migrationer och grundseed. För redan godkänd isolerad molnpreview
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
