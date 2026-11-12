# Booking Lab SE: produktmål och leveransordning

Uppdaterad 2026-11-12 efter Niclas produktförtydligande. Detta dokument skiljer målbild, nästa avgränsade bygguppdrag och framtida beslut. Det är inte en lista över färdiga funktioner eller ett tillstånd att bygga alla moduler samtidigt.

## Målbild

En komplett svensk verksamhetsplattform för små salonger och tjänsteföretag. Bokadirekt och Valei är jämförelseprodukter, inte kodbaser eller designmallar att kopiera. Målet är bättre vardagsflöden, öppna data/integrationer, agentstöd och hållbar total kostnad. Funktionell jämförbarhet måste kartläggas mot faktiska användarbehov; den får inte härledas ur antal avslutade epics.

Bokning är en del av helheten. Slutprodukten ska omfatta kalender, tjänster, personal, kunder, kampanjer, produkter/lager och relevanta ekonomi- och dokumentationsfunktioner. Journalstöd är en separat modul att utreda, inte ett obegränsat anteckningsfält i MVP:n. En egen marknadsplats, certifierad kassa eller egen grundmodell är inte en förutsättning för att lösa salongens vardag.

## Baslinje och namngivning

Epic 01–04 är avslutade som avgränsade syntetiska POC:er. Senaste verifierade leverans vid denna planändring: `26b680d73f95255473d07b073ab8e06a43d294f0` på `epic-04-individual-admin`. Produktkoden är QA-granskad på `471f91f`. `main` är en äldre bas och ska inte väljas av slentrian.

- Epic 01: teknisk grund och härdning.
- Epic 02: lokal MCP-bokning, inte hela det äldre förslaget Booking Core.
- Epic 03: beroendesäkerhet/Prisma 7.
- Epic 04: individuella lokala administratörer.
- Epic05: [bokningsarbetsyta](EPIC_05_PLAN.md), nu lokal alpha med Grok-GO på4fc98d3 och grön full-CI påc12b98a. Privat mobilpreview väntar separat miljöbeslut. Inget efterföljande Epic är automatiskt beställt.

Den ursprungliga roadmapändringen byggde inga funktioner. Epic05 har därefter implementerats och verifierats enligt den avgränsade planen. Läs aktuell PROJECT_STATUS och Git-status innan arbetet startar. Hela systemet är fortfarande inte godkänt för riktiga kunder.

## Produktområden och prioritering

| Område | Användarresultat | Placering |
| --- | --- | --- |
| Kalender och bokningar | Mobil dagvy, desktop dag/vecka, manuellt skapa, öppna, flytta och avboka en tid; samma uppdaterade verklighet för kund, admin och agent. | Epic 05 |
| Tjänster, personal och tillgänglighet | Ändra pris/längd, välja utförare, ange arbetstider, pauser och undantag utan kodändring. | Epic 05, liten enverksamhetsmodell |
| Kunder och kontakt | Sökbara kundkort, besök/köp och tydlig kontaktväg, med åtkomster och datalivscykel. | Nästa separat avgränsning; beslut om e-post kvar |
| Produkter och lager | Saldo, inleverans, inventering, försäljning/förbrukning och varning om lågt saldo. Spårbara lagerhändelser och säkra agentåtgärder. | Planerat produktområde, inte Epic 05 |
| Kampanjer och kommunikation | Skapa erbjudande, välja målgrupp/kanal, förhandsgranska, godkänna och följa utfall. Skilj bokningsmeddelanden från reklam. | Befintligt utkastflöde bevaras; större modul planeras separat |
| Betalning, presentkort och ekonomi | Betallänk/förskott, försäljning, avstämning, återbetalning och bokföringskoppling där målgruppen behöver dem. | Partnerutvärdering och egen kravgrind före skarpa integrationer |
| Behandlingsdokumentation/journal | Kontrollerad dokumentation av rätt typ, med egna behörigheter, spårbarhet och livscykel. | Separat behovs-, risk- och regelbedömning; inga verkliga hälsodata nu |
| Säker drift och dataskydd | MFA/recovery, rättigheter/export/radering, retention, isolering, backup/restore, EU/EES-leverantörskedja och distributionslicenser. | Förutsättningar före riktig pilot; egen verifierad leverans |

Framtida områden ska inte få nya epicnummer förrän scope, beroenden och acceptanskriterier är fastställda. Första användbara salongsprodukt och redo-för-pilot är två olika grindar. Fortsätt gärna bygga och granska med syntetiska uppgifter utan att kalla detta regelefterlevnad eller kundlansering.

## Agentredo som produktregel

Bygg relevanta verksamhetsfunktioner med gemensam domänlogik för UI, API och MCP. Agentstödet ska följa med funktionen, inte skjutas till ett sistasteg. Behörighet, validering, konfliktskydd, retry/idempotens, versionskontroll och dataurval ska testas på båda vägarna.

Lokal stdio-MCP med betrodd operatör är fortfarande bara lokal POC. Ingen påstådd anslutning till ChatGPT/Grok/Claude utan faktiskt integrationstest. En agent ska inte få fri åtkomst till journaler, hemligheter eller säkerhetsinställningar. Massutskick, inköp, betalning, export och radering behöver egna befogenheter och lämplig bekräftelse. Ett fält `confirmed: true` bevisar inte mänskligt godkännande.

## Designprinciper: bekant men egen, less is more

Kalendern är arbetsytan, inte ett kontrollrum med dekorativa KPI-kort. Visa olika funktioner när de används: kundkort, lager och kampanjer behöver inte vara synliga samtidigt.

- Mobil: tydlig dag-/listvy, bekväma tryckytor och bokningsdetaljer i en lättanvänd separat vy. Desktop: luftig dag-/veckokalender. Ingen hoptryckt desktopvy i telefonen.
- En sammanhållen typografi, lugna ytor och sparsamt med semantisk färg. Ingen stor permanent AI-panel, emoji-rubriker, gradientkort eller påhittade prognoser.
- Korta verkliga handlingar: Ny bokning, Flytta, Avboka, Spara. Ta bort repetitiv hjälpprosa, inte etiketter, fel, priser, villkor eller nödvändiga bekräftelser.
- Knappar, fält och kalenderblock är riktiga HTML-komponenter. Använd enhetliga licenskontrollerade ikoner. Bildgenerering kan användas för relevant kampanj-/behandlingsmaterial, inte knapptext eller grundläggande kontroller. Inga nya bilder behövs för kalender-MVP:n.
- Studera åtkomliga officiella referenser och verkliga arbetsflöden. Märk det som inte kan ses bakom konkurrenters inloggning som ej granskat. Kopiera inte skyddad kod, bilder, logotyper eller hela layouter. De tidigare AI-genererade konceptdashboardsen är avvisade och får inte styra bygget.
- Bygg först för vald salongsmålgrupp. Undvik branschkonfigurator eller löftet att samma lösning passar alla utan testning.

## En produktägare på mobilen

Niclas ska kunna följa vad som byggts utan att läsa kod. Varje synlig leverans ska innehålla en provguide och riktig browserverifiering på mobil/desktop. En inspelning är evidens om en viss revision, inte en permanent testmiljö.

Målet är en beständig, autentiserad preview av samma applikation med egen syntetisk databas, oberoende av att Windows-datorn är på. En hemlig URL/noindex är inte åtkomstskydd. Hela previewn, även API och kundbokningssidan, ska omfattas av åtkomstgränsen. Gör aldrig en offentlig tunnel som genväg.

Begäran att uppdatera repot är inte ett separat godkännande av en viss molnleverantör, ny kostnad, hemlighetsändring eller deployment. Epic 05 ska förbereda och redovisa previewns tekniska väg och kvarvarande beslut. Skapa ingen extern resurs/deploy utan uttryckligt mål- och miljögodkännande. Lokal produktdemonstration får fortsätta medan denna del är blockerad. Rapportera mobilpreview separat som tillgänglig/verifierad eller blockerad, aldrig som klar för att en lokal film finns.

## Arbetsfördelning och definition av framsteg

Codex äger kod, tester och samordning. Booking Lab QA/Grok granskar via det befintliga Computer Use-flödet, på fryst revision i egen kopia/databas. Niclas bedömer användbarhet och produktval. ChatGPT följer rapporterade resultat och hjälper till med beslut; det ersätter inte faktisk körning.

Efter en epic: verklig funktionsstatus, exakt commit, automatiska resultat, Groks originalrapport, demo/revision och en kort svensk produktägarrapport. Inga godtyckliga färdigprocent, uppfunna bevis eller eviga QA-loopar. Detaljerad arbetsmetod och nästa acceptansmatris finns i EPIC_05_PLAN.md.

Referenser att undersöka, inte redan bevisad funktionsparitet: https://business.bokadirekt.se/funktioner och https://www.valei.com/bokningssystem. Projektets integritets- och licensregler finns i PRIVACY_SECURITY, DATA_FLOWS och THIRD_PARTY_NOTICES.
