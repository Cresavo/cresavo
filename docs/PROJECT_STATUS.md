# Projektstatus – Booking Lab SE

Verifierad 2026-11-11. Produktkod: Git `6535b59` på `epic-01-foundation-hardening`. Denna arbetsomgång tillför dokumentation och demoverktyg/testinstrumentering, inga produktändringar. Demomanifestet anger denna basrevision och `dirty: true` eftersom leveransen ännu inte var committad vid inspelningen. Slutlig leveransrevision finns i Git-loggen.

**Beslut:** går att demonstrera lokalt med syntetiska uppgifter. Ingen funktion är godkänd för riktiga kunder. Ett fungerande test betyder att angivna kriterier passerar, inte att alla möjliga fel eller driftkrav är hanterade.

[Öppna verifierad lokal demo](../demo-artifacts/2026-11-11T17-17-11-326Z/index.html) · [manifest](../demo-artifacts/2026-11-11T17-17-11-326Z/manifest.json) · [spela in/prova själv](DEMO.md) · [produktägarrapport](PRODUCT_OWNER_REPORT.md)

Länkarna till artefakter gäller denna dator och ingår inte i Git. I en ny klon körs demon på nytt enligt DEMO.md. Bilderna visar sex tillstånd på desktop och mobil; filmerna visar faktiskt automatiserat webbläsarflöde utan ljud.

## Fungerar och är testat i POC:n

| Funktion och observerbart acceptanskriterium | Tekniskt | Automatiskt bevis | Kan provas? | UX och kundberedskap |
|---|---|---|---|---|
| Kundbokning: välj tjänst, vardag och ledig tid; få bekräftelse och hitta samma kund i admin | Ja | E2E desktop/mobil, demobild 01–04 | Ja, enligt DEMO | Fungerande grundflöde. Inga kundkonton, avbokning eller ombokning. Inte kundklar: missbruksskydd och integritets-/driftkrav saknas |
| Bokningsmotor: två samtidiga försök för samma tid ger exakt en bokning; angränsande intervall tillåts | Ja | PostgreSQL-integration, även två direkta DB-insättningar; tidszonstester | Via tester; normal tillgänglighet kan provas i UI | Intern regel, ingen separat UX. Inte produktionsverifierad för driftbelastning eller flera företag |
| Admin: nekad publicering utan behörighet; lokal inloggning visar bokningen och tjänsterna | Ja, lokalt | HTTP/E2E och sessionsenhetstester; demobild 04 | Ja, lokalt lösenord | Enkel kronologisk agenda, inte kalender med veckovy. Inte kundklar: personliga konton, återkallelse och rate limiting saknas |
| Lokal MCP: publika verktyg ger tjänster/tider; list_bookings saknas utan --admin och lämnar aldrig kundnamn/e-post | Ja, stdio | Integration med SDK-klient, 31 dagar, max 100/sida, cursor och nekad åtkomst | Ja, CLI/MCP-klient | Kräver teknisk lokal konfiguration; ingen AI-chatt byggd. Inte fjärr-/kundklar: flaggan är bara ett betrott processläge |
| Kampanj: MCP skapar tjänstekopplat utkast med rabatt/datum; först efter adminpublicering syns erbjudandet på bokningssidan | Ja | E2E desktop/mobil, demobild 04–06 | Ja, CLI + admin | Fungerande demonstration, ingen kampanjredigerare eller betalningsrabatt. Agenten måste lämna strukturerade argument; ingen egen tolkning av naturligt språk. Inte kundklar: innehålls-/behörighets-/driftgranskning kvarstår |
| Felhantering: oväntade fel lämnar inte rå DB-text/anslutningsuppgifter i HTTP/MCP-svar eller granskad app-logg | Ja vid granskade gränser | Unit + verkliga trasiga MCP-anslutningar | Via tester; normala UI-fel kan provas | Meddelanden är korta, inte komplett fel-UX. Ingen garanti för ramverk, DB, proxy eller extern agentloggning |

## Delvis implementerat

| Område | Finns | Kriterium som ännu inte är uppfyllt |
|---|---|---|
| Svensk/mobil upplevelse | Svenska texter, SEK, Stockholm-tider, mobilanpassad layout | Datumfältets platsmarkör ska vara begriplig i relevanta svenska webbläsare; nu observeras mm/dd/yyyy även med sv-SE. Tillgänglighet och användbarhet är inte fullständigt granskade |
| Administration | Skyddad agenda och tjänstelista, kampanjpublicering | Individuella sessioner/roller, återkallelse, begränsade listor och användbar kalender behövs före verklig drift |
| Integritet | Datakarta, minimerat MCP, säkra appfel | Beslutad datalivscykel, radering/rättigheter, avtal, logg-/backuphantering och återläsningstest saknas |
| Lokal installation/CI | Dokumenterade kommandon och CI-definition | Compose på PostgreSQL 16 och verklig GitHub-run ska passera; hittills används lokal PostgreSQL 18.6 eftersom Docker saknas |
| Agentstöd | Fyra strukturerade lokala MCP-verktyg | Ingen fjärr-MCP eller verifierad integration mot externa modellleverantörer; detta är en avsiktlig säkerhetsavgränsning |

## Planerat, inte levererat

1. Beroendeåtgärder: åtgärda eller formellt bedöm kvarvarande advisories med verifierad licens-/versionskompatibilitet och full regression.
2. Individuell admin: två olika konton kan särskiljas, utloggad/återkallad session nekas och borttaget medlemskap ger ingen åtkomst.
3. Syntetisk pilotdrift: verifierad installation, privat admincache, TLS, loggminimering och lyckad backup/återläsning.
4. Före flera företag: verifierad serverhärledd verksamhetskontext; korsverksamhetsläsning/skrivning och felaktiga relationer ska avvisas genom hela kedjan.

Planen är en prioritering, inte en leveransprognos. Betalning, sociala medier, journaler, kassaregister och momsredovisning ingår inte i denna POC.

## Blockerare före riktiga kunder

- Senaste audit (Epic 01, 2026-11-11): 3 höga och 7 måttliga poster. Inte omkörd i demoarbetet; inga paketversioner ändrades. Riskbedömning och uppströmskällor finns i VERIFICATION.
- Delad adminidentitet, ingen individuell återkallelse eller tillräckligt missbruksskydd.
- Inga färdiga drift-/GDPR-beslut, gallrings-/rättighetsfunktioner eller verifierade backup-/incidentrutiner. Tjänst + identitet kan avslöja känsliga uppgifter.
- Ingen verifierad flerföretagsisolering. Nuvarande businessId-filter räcker inte.

## Förändring sedan Epic 01

Produktbeteendet är oförändrat. Nytt: denna kriteriematris, produktägarrapport, reproducerbar demo med syntetisk datakontroll, bildsekvens, video och revisionsmanifest. Befintligt E2E-flöde återanvänds; inga nya beroenden. AGENTS kräver samma leverans efter kommande Epics. Den tidigare fullständiga tekniska handoffen bevaras.

## Verifieringsunderlag

Aktuell körning: `npm test` 8 PASS, `npm run test:integration` 8 PASS, `npm run demo:record` 2 PASS (desktop/mobil). Tolv bilder och två WebM kontrollerade; Chromium kunde läsa båda videorna (10,00 s och 10,16 s). Två representativa bilder granskades visuellt. Preflight avvisade fjärrvärd, fel databasnamn och databas med befintligt syntetiskt utkast. Efter demo/teststädning var bokningar och kampanjer tomma.

Första demo: FAIL, för snävt testfilter gav inga tester. Andra: desktop PASS, mobil FAIL efter att screenshotverktygets tillfälliga caret-stil störde hydration och en textsökning även träffade dev-overlay. Åtgärd: caret initial och exakt textsökning. Slutlig demo PASS 2/2 på 26,6 sekunder. Ingen produktkod behövde ändras. Se senaste tillägg i [VERIFICATION](VERIFICATION.md) för slutlig lint/TypeScript/build/E2E.

## Så hålls statusen aktuell

Efter varje Epic: uppdatera kriterier från faktiskt körda tester, skriv datum/revision, ange ej körda kontroller, spela in syntetisk demo och länka dess manifest, uppdatera produktägarrapportens fem frågor. Flytta inte en funktion till kundklar bara för att en testkörning eller skärmdump ser bra ut.
