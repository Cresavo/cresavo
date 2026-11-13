# Booking Lab SE: produktmål och leveransordning

## Aktuell produktinriktning och nattmål, 2026-11-13

**Niclas produktbeslut:** Booking Lab ska omfatta bokning/kalender/resurser,
kunder/historik, journal/behandlingsdokumentation, produkter/lager/förbrukning/
inköp, betalning/kassa/presentkort/återbetalning/bokföringskoppling samt kampanjer,
kommunikation, sociala medier och analys. Journal och lager är uttryckliga delar
av slutprodukten, inte valfria bortval i denna mindre leverans.

Människor använder en bra arbetsyta och kundbokning. Godkända kund-/ägarassistenter
använder kontrollerade operationer med samma verksamhetsregler. Ägaren ska även
kunna möta relevant läge, förslag, beslut och verkliga resultat i en proaktiv
översikt, med kalender och kundkort som direktåtkomst.

**AI-inriktning:** inkluderad användning i abonnemanget, ansluten egen assistent
och valfria egna API-nycklar. Priser, kvoter, modeller, leverantörer, nyckelförvaring
och budgetpolicy är återstående beslut. En ansluten assistent är en klient;
en modellnyckel finansierar plattformens egen exekvering. Nattens regelbaserade
förslag använder inget modellkonto och ska märkas därefter.

**Externt underlag:** [hela Del B](research/BOOKING_LAB_DIRECTION_2026_11_13.md)
bevarar researchdatum12–13november och ursprungliga källor. Det är levererat
researchunderlag, inte våra nya praktiska tester av varje leverantör eller en
garanti om framtida svensk tillgänglighet. Priser/laguppgifter ska kontrolleras
igen inför respektive skarpa beslut.

**Arkitekturförslag:** verksamhetsmotor → kontrollerade anslutningar → arbetsyta.
Beräkna första signalen vid uppdatering, med minsta persistens för beslut och
utkast. Events, bakgrundsjobb, modellanslutningar, usage-mätning och egna nycklar
byggs först när ett verkligt flöde kräver dem. Ingen generell workflowmotor nu.

**Affärshypoteser:** sparad administration, återfylld kapacitet, betalningsvilja,
usage-nivåer och kommersiell nytta måste mätas. Ett utkast är inte försäljning;
en ny bokning efter ett förslag bevisar inte att kampanjen orsakade den.

Aktivt avgränsat byggmål: [proaktiv kapacitetsöversikt](PROACTIVE_OVERVIEW_PLAN.md).
Framtida avbokning → faktiskt bokningsbar tid → kalender eller beständigt
kampanjutkast → synligt beslut och ny aktualitetskontroll. Samma domän från
webb/API/lokal MCP. Separat branch från28a48fe; kalenderprovet är avslutat.

| Senare leverans | Observerbart resultat | Beroenden och beslut före skarp användning |
| --- | --- | --- |
| Kunddata och pilotgrindar | Export/radering/retention kan provas; MFA/recovery, backup/restore och drift verifierade | Retentionsbeslut, regel-/leverantörs-/licensbedömning, kvarvarande auditfynd |
| Journal/behandlingsdokumentation | Behörig personal skapar/granskar en versionsspårad anteckning med rätt journaltyp | Vald verksamhet och rättslig klassning, separata ändamål/behörigheter/lagringstider; inga hälsodata nu |
| Lager/förbrukning/inköp | Inleverans → saldo/reservation → faktisk förbrukning/försäljning/retur, spårbar historik | Produktmodell och vald målgrupp; batch/bäst före när relevant; inköp kräver mandat |
| Betalning/kassa/presentkort/återbetalning | Bokning/försäljning kopplas till faktisk betalningsstatus och verifierad avvikelsehantering | PSP-/kassapartner, regler/avtal och testmiljö; ingen egen certifierad kassa byggs på antagande |
| Bokföringskoppling | Försäljning/avgifter/utbetalningar/återbetalningar kan stämmas av; fel och retry synliga | Vald ekonomipartner/format, kundmandat och bevarandekrav |
| Marknadsföring/sociala medier | Granskat innehåll/målgrupp/kanal/budget publiceras genom verifierad anslutning; faktiska boknings-/besöksutfall följs | Kanalbehörigheter, samtycke/ändamål, budget och attribution; inga automatiska utskick nu |
| Analys | Beläggning/avbokningar/återbesök/försäljning visar datakälla, period och begränsningar | Faktiskt underlag, definierade mått och dataminimering; inga låtsade prognoser |
| Inbyggd AI och fler assistenter | Ett avgränsat ärende fungerar med budgettak, korrekt mandat och återhämtning | Verifierad klient/provider, användningsmätning och produktbeslut; Dots/Muse är inte redan integrerade |

När nattmålet är verifierat avslutas det. Tabellen är framtida leveranser,
inte tillstånd att starta dem samma natt. Kundpilot förblir en separat grind.

## Föregående riktning och kalenderprov, 2026-11-12

Uppdaterad 2026-11-12 efter Niclas agent-first- och kalenderförtydligande.
Niclas har efter planuppdateringen godkänt det första avgränsade lokala provet.
Genomförandestatus finns i [kalenderprovet](calendar-proof/README.md).
Övriga senare steg är förslag, inte godkända bygguppdrag. Ingen ny drift.

## Målbild

En svensk verksamhetsplattform för små salonger där människor och deras egna
AI-assistenter använder samma tillförlitliga boknings- och verksamhetslogik.
Ägaren ska kunna arbeta via sin valda assistent eller den visuella arbetsytan;
kunden via sin personliga agent eller en enkel bokningssida. Booking Lab äger
bokningens korrekta tillstånd, regler och åtkomstkontroller. Agenten hjälper
användaren att jämföra och utföra tillåtna handlingar.

Positionering: **Driv salongen med den AI-assistent du föredrar. Låt kunderna
boka på sitt sätt.** ChatGPT, Claude, Muse och andra klienter är möjliga
ingångar, inte löften om redan verifierat stöd. MCP ger inte automatisk
upptäckt av salongen eller garanterad kompatibilitet. Bokadirekt och Valei är
jämförelseprodukter, inte funktionslistor att efterlikna. Värdet ska visas i
sparad administration och enklare bokning, inte antal sidor eller MCP-verktyg.

Befintlig kalender, kundregister, tjänster, personal och kampanjer bevaras.
Webben har tre tydliga uppgifter: kundbokning, visuell arbetsyta och separat
produktpresentation. Ingen stor egen chatt krävs. Produkter/lager, ekonomi och
journal/dokumentationsfunktioner är beslutade delar av målbilden, att leverera
i etapper med respektive beslut och grind. De byggs inte automatiskt i nästa
lilla leverans. Journaltypen kräver separat verksamhets- och regelbedömning.

## Kalenderkoppling: ansvar och integritet

- Kundens agent får, med kundens tillåtelse, jämföra privat-, jobb- och andra
  delade kalendrar som kunden har rätt att använda. Börja med upptagna intervall;
  titlar, deltagare och anteckningar behövs normalt inte för tidsjämförelsen.
- Booking Lab lämnar tjänst, utförare, pris, längd och aktuell tillgänglighet.
  Kundens kalenderinnehåll ska inte lagras hos salongen eller skickas som
  bokningsmetadata. Kundagenten får inte ägarens kundregister eller adminroll.
- Agenten kombinerar tillgänglighet med önskemål och eventuell uttrycklig
  tidsbuffert. Ingen kart-/restidsintegration ingår i första provet.
- Bekräftelse visar salong, behandling, utförare, pris och Stockholmstid.
  Tillgänglighet är inget reservationslöfte; bokningsmotorn avgör vid skrivning.
- Kalenderpost skapas först efter lyckad bokning. En framtida kalenderkoppling
  måste hantera återförsök och delvis fel utan dubbelbokning: misslyckad
  kalenderinsättning betyder inte att salongsbokningen misslyckades.
- Ägarens externa kalender kan senare bidra till planeringen, men får inte
  automatiskt skriva om salongens schema eller flytta kundbokningar.
- Befintlig kalenderåtkomst i användarens agent återanvänds när den faktiskt
  stöds. Koppling till Google/Microsoft/Apple, OAuth, realtidssynk och fjärr-MCP
  är separata beslut; lokal stdio eller demoåtkomst får inte exponeras som genväg.

## Minsta nästa prov: hitta en tid som passar kunden

**Godkänt för avgränsat prov; förberedelser påbörjade.** En lokal syntetisk demonstration i en befintlig
agentklient med verifierat stöd för lokal MCP. En klient först; fler klienter
och ägarens assistentflöde kommer efter att nyttan har provats. Ingen ny Epic
numreras eller startas av denna plan.

Niclas ska kunna fråga: ”Hitta en massage nästa vecka efter klockan 16 som
passar både min jobbkalender och privatkalender. Visa två alternativ.”

Första provet använder två små, tydligt märkta syntetiska kalenderunderlag med
datum, upptagna intervall och tidszon, tillgängliga bara för agenten. Detta är
**kalenderjämförelse med testunderlag, inte verifierad livekalendersynk**.
Booking Labs tjänster och lediga tider ska däremot hämtas genom riktiga
befintliga MCP-anrop mot separat lokal demodatabas. Ingen inmatad kopia av
salongens lediga tider får presenteras som en fungerande integration.

| Liten uppgift efter bygggodkännande | Observerbart acceptanskriterium |
| --- | --- |
| 1. Verifiera en befintlig klient och läsbehörig lokal anslutning | Klienten gör verkliga tjänste-/tillgänglighetsanrop; inga admin- eller skrivflaggor, inga hemligheter i prompten. Klient/version och begränsningar dokumenteras. Saknat stöd är en blockerare, inte skäl att öppna publik MCP. |
| 2. Förbered två kalenderunderlag och en reproducerbar fråga | Agenten visar två verkliga alternativ utan överlapp med någon kalender, med svensk dag/tid, behandling, utförare, längd och pris. Ett förberett facit finns. |
| 3. Prova hela vägen med befintlig webb | Niclas väljer förslaget och slutför bokningen i den lokala kundvyn; bokningen syns i samma lokala admin. Dag/tid väljs där manuellt, ingen påstådd förifylld länk eller automatisk agentbokning. |
| 4. Prova negativa fall och granska resultatet | Inga gemensamma tider ger begripligt besked; tidszons-/sommar-vintertidsfall blir rätt; en tid som tas efter förslaget ger konflikt utan dubbelbokning. Kalenderinnehåll förekommer inte i Booking Labs anrop, DB eller loggar. |

Planerad leverans: en kort provguide, verkliga verktygsanrop och en bokning
synlig i kalendern, samt riktade tester för eventuell ändrad kod. Grok granskar
fryst underlag i separat syntetisk kopia via befintligt flöde, högst två samlade
rättningsvarv. Egna tester, Groks faktiska prov och Niclas användarprov redovisas
separat. Ingen ny full QA av oförändrade epics eller påstådd mobil-/molnverifiering.

Provet kräver lokal dator; befintlig skyddad mobilpreview uppdateras inte.
Det innehåller inga nya beroenden som mål, ingen kalenderleverantörsanslutning,
kunddataexport, autonom skrivning, kalenderinsättning, utskick eller ny kostnad.

## Efter provet: separata beslut

1. Om jämförelsen hjälper: välj en faktisk kalenderanslutning och prova med
   syntetiska kalenderkonton. Verifiera behörighet och återkallelse i vald klient.
2. Avgränsa därefter bekräftad agentbokning och kalenderinsättning. Ett
   modellgenererat `confirmed: true` räcker inte; provet behöver en verifierad
   användarbekräftelse och säkra retry-/konflikt-/delfelsfall. Ingen kundagent
   får lokal administratörsbehörighet för att få demonstrationen att fungera.
3. Prova ägarens ”min arbetsdag” med minimerade verksamhetsdata, följt av en
   uttryckligt bekräftad ändring. Fjärråtkomst och stöd i en andra klient kräver
   egna verifierade anslutnings- och behörighetsbeslut.

Pilotspåret består: kunddataexport/anonymisering/retention, MFA/recovery,
drift-/integritetsbedömning och kvarvarande auditfynd. Agentprovet ersätter
ingen av dessa grindar och ger inget tillstånd för riktiga kunduppgifter.

## Baslinje och namngivning

Epic 01–06 är avslutade inom respektive avgränsning. Lokal ren bas vid denna
planändring: `b8de7489cfdbe87de2dea33305ffcbc8c900fc5d` på
`feature/epic06-customers-demo-product`. Produktkod `7c1407d` är levererad som
skyddad syntetisk preview; senare dokumentation ändrar inte produktkoden.
Se [PROJECT_STATUS](PROJECT_STATUS.md) och [HANDOFF](HANDOFF.md) för faktisk
QA/CI/drift. `main` är en äldre bas och ska inte väljas av slentrian.

- Epic 01: teknisk grund och härdning.
- Epic 02: lokal MCP-bokning, inte hela det äldre förslaget Booking Core.
- Epic 03: beroendesäkerhet/Prisma 7.
- Epic 04: individuella lokala administratörer.
- Epic 05: [bokningsarbetsyta](EPIC_05_PLAN.md), följd av separat godkänd skyddad preview och användbarhetsförbättringar.
- Epic 06: [kundregister, syntetisk demo och separat produktsida](EPIC_06_PLAN.md), levererad. Ingen efterföljande implementation är beställd genom denna plan.

Den ursprungliga roadmapändringen byggde inga funktioner. Epic05 har därefter implementerats och verifierats enligt den avgränsade planen. Läs aktuell PROJECT_STATUS och Git-status innan arbetet startar. Hela systemet är fortfarande inte godkänt för riktiga kunder.

## Produktområden och prioritering

| Område | Användarresultat | Placering |
| --- | --- | --- |
| Kalender och bokningar | Mobil dagvy, desktop dag/vecka, manuellt skapa, öppna, flytta och avboka en tid; samma uppdaterade verklighet för kund, admin och agent. | Epic 05 |
| Tjänster, personal och tillgänglighet | Ändra pris/längd, välja utförare, ange arbetstider, pauser och undantag utan kodändring. | Epic 05, liten enverksamhetsmodell |
| Kunder och kontakt | Sökbara kundkort och besök; kontaktväg och datalivscykel måste avgränsas för riktiga kunder. | Kundregister levererat i Epic 06; export/anonymisering/retention och verklig kontaktåtkomst återstår |
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

Befintlig skyddad Vercel-preview är levererad enligt [DEMO](DEMO.md).
Denna plan ändrar varken dess kostnadsram, åtkomst eller deployment.
Skapa ingen extern resurs eller ny anslutning utan uttryckligt uppdrag.
En lokal demonstration är inte en mobilåtkomlig agentintegration.

## Arbetsfördelning och definition av framsteg

Codex äger kod, tester och samordning. Booking Lab QA/Grok granskar via det befintliga Computer Use-flödet, på fryst revision i egen kopia/databas. Niclas bedömer användbarhet och produktval. ChatGPT följer rapporterade resultat och hjälper till med beslut; det ersätter inte faktisk körning.

Efter en leverans: verklig funktionsstatus, exakt commit, automatiska resultat,
Groks originalrapport och en kort svensk produktägarrapport med provbevis.
Inga godtyckliga färdigprocent, uppfunna bevis eller eviga QA-loopar. Nästa
föreslagna prov och dess acceptanskriterier finns ovan; äldre Epic-planer gäller
sina avslutade uppdrag.

Referenser att undersöka, inte redan bevisad funktionsparitet: https://business.bokadirekt.se/funktioner och https://www.valei.com/bokningssystem. Projektets integritets- och licensregler finns i PRIVACY_SECURITY, DATA_FLOWS och THIRD_PARTY_NOTICES.
