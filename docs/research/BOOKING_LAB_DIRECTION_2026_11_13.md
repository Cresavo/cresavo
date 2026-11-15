## Del B: research och långsiktig målbild

Följande rapport är bakgrund och källunderlag. Del A bestämmer nattens scope. Leverantörsexempel och framtidsscenarier är inte egna implementeringskrav.


# Booking Lab och framtidens bokningssystem
## En svensk verksamhetsplattform i en värld med personliga AI-agenter

**Research utförd 12–13 november 2026**  
**För: Niclas**  
**Horisont: dagens verifierade läge samt scenarier för 2027–2030**

## Huvudbedömning

Booking Lab har en rimlig långsiktig riktning: att bli den plattform som håller ihop ett tjänsteföretags bokningar, kunder och ekonomiska flöden, samtidigt som människor och olika AI-assistenter kan arbeta genom den.

Min bedömning är att bokningssystemets gränssnitt kommer att spridas över fler kanaler. Kunden kan be en personlig assistent boka. Företagaren kan be sin assistent hantera luckor, förbereda ändringar eller förklara försäljningen. Plattformen behöver fortfarande avgöra vad som är tillåtet, vad som faktiskt är ledigt, vad kunden har köpt och vilka ekonomiska händelser som inträffat.

Det är en arkitekturriktning med tydligt stöd i dagens utveckling. Det är däremot ännu inte bevis för att en svensk salong vill byta till Booking Lab.

**Den kommersiella hypotesen bör vara: en enklare arbetsdag, färre förlorade ärenden och pålitlig drift, med frihet att använda olika assistenter.**

Tre viktiga slutsatser:

1. AI-receptionist och agentbokning är redan konkurrensutsatta områden.
2. Säker åtkomst till hela arbetsflödet kan bli mer värdefull än en enskild AI-funktion.
3. Första produkten måste vara användbar även om kundernas användning av personliga agenter växer långsamt.

## Precisering: plattformen och gränssnittet kan utvecklas åt olika håll

Niclas precisering efter den första researchomgången är central: en plattform som byggs från grunden kan göra agenter till naturliga användare redan från början. Ägaren behöver då inte alltid leta i menyer för att upptäcka att något behöver göras.

Min rekommendation är att skilja tre delar:

1. **Verksamhetsmotorn** håller fakta, affärsregler, rättigheter och transaktioner.
2. **Anslutningarna** låter godkända assistenter läsa, utföra handlingar och ta emot relevanta händelser.
3. **Arbetsytan** hjälper människan få överblick, fatta beslut och hantera det som kräver omdöme.

Det gör det möjligt att förändra användarupplevelsen utan att byta ut själva verksamhetsplattformen.

### Ägarens startsida kan bli en arbetsöversikt

En möjlig framtida startsida skulle prioritera:

- **Dagens läge:** bokningar, kapacitet och betalningar som behöver uppmärksamhet.
- **Behöver beslut:** konkreta förslag till ombokningar eller andra avvikelser.
- **Pågår:** arbete som ägaren eller en agent redan har startat.
- **Klart:** genomförda handlingar och deras faktiska resultat.

Kalender, kundkort och ekonomivyer finns kvar som direktåtkomst. De används när de hjälper ägaren förstå eller genomföra något, medan återkommande arbete kan ske genom givna regler eller en ansluten assistent.

### Proaktivitet kräver mer än att lägga till MCP

API och MCP kan ge en agent tillgång till operationer. Ett proaktivt arbetssätt behöver dessutom upptäcka relevanta förändringar, förmedla dem, veta vem som har mandat och följa upp om åtgärden lyckades.

Ett tänkbart exempel:

1. En tid avbokas.
2. Booking Lab registrerar en händelse och beräknar den nya tillgängligheten.
3. En godkänd assistent får relevant information genom en anslutning som stöder detta.
4. Assistenten föreslår en åtgärd utifrån väntelista och ägarens instruktioner.
5. Åtgärden godkänns eller genomförs inom ett tidigare fastställt mandat.
6. Booking Lab kontrollerar reglerna och sparar resultatet.

Detta är ett designförslag, inte en utfästelse om att alla namngivna assistenter redan kan prenumerera på sådana händelser.

### Fördela arbetet mellan plattformen och assistenten

Booking Lab bör äga pålitlig tillgänglighet, behörighet, loggning och uppföljning. En extern assistent kan tolka mål, prioritera, resonera och samordna andra appar. Återkommande rutinjobb som bokningsbekräftelser kan ligga i vanlig automatisering.

Salongens viktiga regler och mandat ska vara sparade i plattformen. De bör inte enbart finnas i en viss assistants konversationsminne. Arbetet måste gå att förstå även om ägaren byter assistent eller en leverantör ligger nere.

**Detta gör lösningen mer anpassningsbar till framtiden:** kunden kan använda webben, telefon eller sin agent, och företagaren kan arbeta direkt i Booking Lab eller genom sin egen assistent. Alla ingångar använder samma tillförlitliga verksamhetsmotor.


## Hela målbilden: journal, lager, ekonomi och marknadsföring

Målbilden omfattar en komplett verksamhetsplattform. Journal, varulager och marknadsföring ska ingå tillsammans med bokning, kunder, betalning, kassa och bokföringskoppling. Funktionerna kan utvecklas i etapper, men bör utformas för att fungera tillsammans.

| Del | Plattformens ansvar | Exempel på framtida assistentarbete |
| --- | --- | --- |
| Bokning och resurser | Korrekt tillgänglighet, tjänster, personal och kapacitet. | Föreslå ombokningar och hantera luckor inom givna regler. |
| Kund och journal | Relevant historik, anteckningar, behörighet och spårbarhet. | Förbereda ett journalutkast från behörig personals diktat, för granskning. |
| Varulager och inköp | Saldo, reservationer, faktisk förbrukning, försäljning och returer. | Flagga brist, jämföra behov med kommande bokningar och föreslå inköp. |
| Betalning och kassa | Försäljning, betalningsstatus, presentkort, återbetalningar och underlag. | Uppmärksamma avvikelser och förbereda kontrollerade åtgärder. |
| Bokföringskoppling | Överföring, avstämning och synliga integrationsfel. | Förklara differenser och hjälpa ägaren prioritera rättningar. |
| Marknadsföring | Kampanjer, godkända målgrupper, material, budget och uppföljning. | Föreslå kampanj, skapa inlägg och analysera faktiska resultat. |

### Journal behöver anpassas till verksamheten

Vanliga behandlingsanteckningar och patientjournaler har inte automatiskt samma regelverk. När patientdatalagen är tillämplig uppstår särskilda krav; patientjournalhandlingar ska exempelvis bevaras minst tio år efter sista införda uppgiften. Den regeln ska inte generellt tillämpas på alla salongsanteckningar. [S31]

En gemensam plattform kan därför behöva olika journalflöden beroende på verksamhet. AI kan hjälpa behörig personal med utkast och struktur, medan ansvar, granskning och åtkomst följer verksamhetens krav. Journalinnehåll bör vara avskilt från externa bokningsagenters och marknadsföringsverktygs generella åtkomst.

### Varulagret blir användbart tillsammans med bokning och försäljning

Ett relevant lagerflöde kan skilja på produkter för försäljning, material som förbrukas i behandlingar och sådant som behöver reserveras. Batchnummer och bäst före-datum kan behövas för vissa målgrupper.

En bokning är inte alltid samma sak som faktisk materialförbrukning. Systemet bör kunna reservera vid behov och sedan registrera verklig användning, försäljning, svinn eller retur. Assistenten kan arbeta med dessa uppgifter och exempelvis uppmärksamma att kommande behandlingar kräver mer material än som finns tillgängligt.

### Marknadsföring kan kopplas till ett verkligt verksamhetsbehov

Ett tänkbart proaktivt flöde är att systemet upptäcker återkommande ledig kapacitet, räknar på möjliga erbjudanden, föreslår en kampanj och tar fram material för sociala medier. Ägaren kan godkänna innehåll, målgrupp, kanal, budget och period. Publicering kan senare ske genom en anslutning som faktiskt stöder det och inom givet mandat.

Uppföljningen bör koppla kampanjen till bokningar, genomförda besök, försäljning och täckningsbidrag. Räckvidd, gilla-markeringar och antal AI-skapade inlägg är kompletterande mått, inte bevis på lönsamhet.

Andra tänkbara analyser är återbesök, avbokningar, beläggning per tjänst, försäljning av produkter, lageromsättning och tidsåtgång i förhållande till intäkt. Insikter behöver redovisa datakälla, beräkningsperiod och osäkerhet. Assistenten bör kunna skilja en tillfällig variation från ett återkommande mönster och kontrollera antaganden med ägaren.

Det centrala är att använda relevant, godkänd marknadsföringsdata. Journalinnehåll ska inte automatiskt bli underlag för målgrupper eller reklambudskap.

### Vad detta ändrar i strategin

Booking Labs värde ligger även i sambanden mellan modulerna: ett bokat besök kan leda till en utförd behandling, granskade anteckningar, registrerad materialförbrukning, försäljning och korrekt ekonomiskt underlag. Därefter kan verksamheten analysera resultat och planera lämplig uppföljning.

Dessa samband motiverar en gemensam plattform. Olika assistenter kan utföra delar av arbetet, medan Booking Lab håller ihop regler, status, behörighet och spårbarhet.


## 1. Vad som redan finns

Följande är verifierade produktbeskrivningar och utvecklardokumentation. De är inte egna funktionstester eller oberoende bevis på leverantörernas kvalitet.

| Aktör | Verifierat i granskade källor | Betydelse för Booking Lab |
| --- | --- | --- |
| Valei + Telavox | AI-receptionist kan boka, omboka och avboka i Valei. Separata licenser krävs. [S01] | Den närmaste svenska marknaden har redan en konkret AI-telefonilösning. |
| Bokadirekt | API och webhooks erbjuds. Den offentliga API-sidan beskriver läsåtkomst, vilket inte bevisar ett öppet skriv-API för bokningar. [S02] | Pålitliga och väl avgränsade skrivoperationer kan vara en skillnad, men jämförelsen får inte hävda att konkurrenten saknar integrationer. |
| Cal.com | MCP med OAuth samt gränssnitt som externa assistenter kan använda för tillgänglighet och bokning. [S03] | Modellen där någon annans assistent använder bokningsplattformens motor finns redan. |
| Phorest | Front Desk AI kan hantera bokningar, ändringar, avbokningar och depositioner via SMS/WhatsApp. [S04] | Automatisering omfattar flera kanaler. Meddelandehantering och telefonröst är olika erbjudanden. |
| Stripe | En särskild guide beskriver hur tjänster bokas och betalas av agenter genom API eller MCP. [S05] | Teknikstödet omfattar redan bokningsplattformar, inte bara fysisk e-handel. |

Det starkaste stödet för visionen är därför inte en allmän prognos om AI. Det är att både bokningsföretag och betalningsinfrastruktur uttryckligen bygger för den.

Samtidigt försvagas antagandet att etablerade aktörer står stilla. Booking Lab behöver konkurrera mot vad de kan leverera under kommande år, inte enbart mot deras äldre gränssnitt.

## 2. Två olika agentmarknader uppstår

### Kundens assistent

Kunden vill köpa en tjänst med så lite administration som möjligt. Ett tänkbart önskemål är:

> ”Boka fotvård hos Christina nästa vecka, helst efter 16, inom min budget.”

Assistenten behöver förstå önskemålet, hitta rätt verksamhet, välja rätt tjänst och kontrollera en verklig ledig tid. Om kundens instruktion inte redan ger tillräckligt mandat behöver kunden ta ställning till exempelvis pris, tid eller avbokningsvillkor. Därefter kan bokningen och eventuell betalning genomföras.

För en återkommande kund kan detta vara enkelt. För en ny kund är tjänstevalet svårare: ordet ”ansiktsbehandling” eller ”färgning” kan motsvara flera tjänster med olika längd och förutsättningar. Bra tjänstebeskrivningar och bokningsregler blir därför användbara både för människor och agenter.

### Företagarens assistent

Företagaren har ett annat mål: en fungerande och lönsam arbetsdag.

Exempel på framtida arbetsflöden:

- Sammanfatta morgondagens bokningar och ärenden som kräver beslut.
- Föreslå åtgärder för en avbokad tid utifrån väntelista och kundernas önskemål.
- Förbereda ombokningar när en medarbetare blir sjuk.
- Visa vilka betalningar som inte stämmer med försäljningsunderlaget.
- Förklara förändringar i beläggning eller återbesök.
- Ta fram en kampanj som företagaren granskar och beslutar om.

Här finns en viktig skillnad mellan rådgivning och genomförande. Att visa vilka kunder som kan erbjudas en ny tid är en sak. Att kontakta dem, flytta deras bokningar eller betala tillbaka pengar kräver rätt behörighet och mandat.

**Min bedömning:** Företagarens arbetsflöden kan vara en tidigare möjlighet för Booking Lab än bred svensk konsumentanvändning av personliga agenter. En salong behöver inte vänta på att alla kunder skaffar en assistent för att själv spara administration.

Kundens och salongens agenter har dessutom olika intressen. Kunden kan prioritera lägsta pris och en viss tid; salongen kan prioritera beläggning och arbetsschema. Booking Lab bör tillämpa tydliga priser och regler, utan att ge kundagenten tillgång till interna anteckningar, marginaler eller andra kunders uppgifter.

## 3. Dots, Duet, Muse och Claude Code: skilj produktstöd från svensk tillgänglighet

Det finns stöd för riktningen, men varje produkt har egna villkor.

| Produkt | Verifierat nuläge | Konsekvens |
| --- | --- | --- |
| OpenAI Dots | Den aktuella hjälpsidan skiljer konsument-Pro, som undantar EES/Storbritannien/Schweiz, från Business Premium och berättigade organisationskonton. [S06] | Ett generellt påstående att alla svenska användare har eller saknar tillgång blir missvisande. |
| Claude Duet | USA-baserad research preview via väntelista. [S07] | Svensk konsumentlansering är inget säkert beroende för Booking Labs plan. |
| Meta Muse | Meta beskriver en personlig agent och koppling till Stripe/Link. Connector-plattformen granskar anslutningar före publicering. [S08–S09] | En teknisk integration ger inte automatiskt synlighet eller godkännande. Svensk/EU-lansering har inte kunnat verifieras i de granskade officiella källorna. |
| Claude Code | Dokumenterat stöd för externa verktyg genom MCP och autentisering. [S10] | Relevant klient för tekniska användare och ägarflöden, medan vanliga salongsägare också behöver ett lättanvänt gränssnitt. |

Produktnamnen bör vara utbytbara integrationsval. Booking Labs kärna ska inte behöva göras om om en assistent byter villkor, prioriteringar eller protokoll.

## 4. Plattformen behövs, men används på fler sätt

Ett framtida bokningssystem behöver hålla ordning på åtminstone följande:

| Område | Vad som måste vara tillförlitligt |
| --- | --- |
| Tid och kapacitet | Personal, kompetenser, öppettider, ledighet, pauser, lokaler och utrustning. |
| Tjänster och villkor | Tidsåtgång, pris, eventuella tillägg, förskott och avbokningsregler. |
| Kundrelation | Identitet, kontaktuppgifter, historik, preferenser och relevanta tillstånd. |
| Ekonomiska flöden | Försäljning, betalning, presentkort, återbetalning, avgifter och avstämning. |
| Ansvar och kontroll | Vem som gjorde något, med vilken behörighet, vad som ändrades och hur fel hanteras. |

En språkmodell kan hjälpa till att tolka avsikten. Den kan inte på egen hand vara den auktoritativa uppgiften om att en tid är bokad eller en betalning mottagen.

Även skärmen har en viktig roll. En kalender ger snabb överblick över en arbetsdag. En förhandsvisning gör det möjligt att granska sex föreslagna ombokningar. En ekonomivy kan visa vilka poster som behöver åtgärdas.

Min bedömning är därför att bra produkter kombinerar naturliga instruktioner med visuella kontroller. Företagaren kan säga vad som ska göras, se förslaget och förstå utfallet.

Färre besök i Booking Labs egen app behöver inte betyda mindre produktvärde. Om fler korrekta transaktioner genomförs genom plattformen kan den vara mer använd, även när samtalet sker i en annan tjänst.

## 5. Rekommenderad arkitektur: samma regler för alla kanaler

Detta är ett designförslag för framtida utveckling, inte ett påstående om att allt redan finns i projektet.

En gemensam verksamhetsmotor bör användas av:

- kundens vanliga bokningssida,
- salongens kalender och administration,
- telefon- och meddelandeassistenter,
- kundens externa agent,
- ägarens externa agent.

Det innebär att samma tillgänglighet, priser och rättigheter gäller oavsett kanal.

### Bokningsflödet behöver tydliga tillstånd

Ett lämpligt principflöde är:

1. Hämta giltiga tjänster och tider.
2. Kontrollera rätt personal, resurs och längd.
3. Reservera vald kapacitet tillfälligt när flödet kräver det.
4. Presentera aktuellt pris och villkor.
5. Kontrollera identitet och mandat för åtgärden.
6. Genomför bokning och eventuell betalning.
7. Bekräfta först när systemet verkligen har rätt status.

Om två agenter väljer samma tid måste den centrala motorn lösa konflikten. Om ett nätverksfel leder till ett nytt försök ska samma begäran inte skapa en extra bokning. Om betalningen lyckas men bekräftelsen uteblir måste systemet kunna återhämta sig och visa rätt status.

Tillfälliga reservationer behöver även löpa ut och begränsas så att en felande klient inte låser salongens kalender.

### Tre separata behörighetsområden

Kundagenten bör få boka och hantera kundens egna ärenden. Personalagenten bör arbeta inom personalens roll. Ägaragenten kan ha bredare rättigheter, med tydliga gränser för exempelvis prisändringar, massutskick och återbetalningar.

En person som anger någon annans e-postadress har inte därmed visat att den får ändra den personens bokningar. Identitet, fullmakt och åtkomst behöver höra ihop. Behörigheten behöver alltid begränsas till rätt verksamhet, även när samma person eller assistent arbetar för flera företag.

### Standarderna fyller olika funktioner

| Del | Roll i Booking Lab |
| --- | --- |
| Verksamhets-API | Bestämmer och genomför tillåtna handlingar. |
| MCP | Gör verktygen tillgängliga för kompatibla assistenter. Skyddade fjärranslutningar behöver genomtänkt autentisering och behörighet. [S11] |
| A2A | Kan användas för samarbete mellan självständiga agenter när det finns ett verkligt sådant behov. [S12] |
| ACP/UCP och betalningslösningar | Kopplar handel, köpflöden och betalningsmandat mellan parter. [S13–S14] |
| WebMCP | Möjlig framtida förbättring för webbläsaragenter. Det är fortfarande ett föreslaget standardarbete med origin trial. [S15] |

**Prioritering:** Stabil verksamhetslogik och dokumenterade operationer först. Anslutningslager kan sedan följa verkliga kunder och partners. Att implementera alla protokoll samtidigt skulle lägga arbete framför verifierad efterfrågan.

## 6. Telefonreceptionisten: konkret nytta med tydliga kvalitetskrav

Telefon är intressant eftersom en kund kan ringa även när företagaren behandlar någon. Men kundvärdet beror på hur många ärenden som annars skulle kräva arbete eller gå förlorade.

En bra första avgränsning kan vara:

- vanliga frågor,
- bokning av tydligt definierade tjänster,
- hantering av okomplicerade ändringar,
- meddelande eller återuppringning när något behöver bedömas.

Kvalitetskraven bör gälla utfallet: rätt behandling, rätt tid, rätt person, korrekt pris och begriplig bekräftelse. Dialekter, bakgrundsljud, namn, avbrutna meningar och ändrade önskemål behöver ingå i utvärderingen.

Vid osäkerhet kan assistenten exempelvis säga att den behöver låta personalen bedöma vilken behandling som passar. Den ska inte lova en medicinsk bedömning eller en tjänst som verksamheten inte godkänt.

Min rekommendation är att köpa telefoni och modellkapacitet bakom en utbytbar anslutning och lägga den egna utvecklingen på bokningsregler, behörigheter, överlämning och uppföljning. Leverantörsbyte bör inte kräva att salongens tjänster och hela arbetssätt byggs upp på nytt.

## 7. Betalning, svensk kassa och bokföring behöver hänga ihop

Här finns tre separata uppgifter: att ta betalt, att registrera försäljningen korrekt och att skapa ett användbart bokföringsunderlag.

Skatteverket anger kassaregister som huvudregel för kontant-, kort- och Swishbetalningar, med undantag för vissa verksamheter och flöden. Från 1 januari 2027 gäller också kraven i SKVFS 2021:17, bland annat XML-export för register med journalminne. En PSP-integration ersätter inte i sig hela kassalösningen. [S16]

**Produktval:** Låt Booking Lab hålla samman upplevelsen och referenserna mellan bokning, försäljning och betalning. Låt en lämplig betalleverantör och kassapartner bära sina specialistdelar.

Stripes dokumentation listar Sverige bland länderna för Shared Payment Tokens, som kan begränsa betalningsåtkomst. Det är stöd för en betalningskomponent, inte bevis för att alla assistenter och betalningsmetoder är tillgängliga här. Dokumentationen innehåller preview-villkor. [S17]

### Bokföringskopplingen måste tåla vardagens avvikelser

För en verksamhet är detta mer värdefullt än en knapp som bara skickar ett totalbelopp:

- betalningar går att koppla till rätt försäljning,
- avgifter och utbetalningar går att stämma av,
- återbetalningar och krediteringar kan följas,
- presentkort och förskott behandlas med korrekta regler,
- fel hamnar i en synlig kö med möjlighet till nytt försök.

Fortnox dokumenterar kundgodkänd OAuth2-åtkomst. SIE är ett öppet format för överföring av redovisningsdata. Det finns därför flera vägar, och första direktintegrationen bör väljas efter pilotkundernas faktiska behov. [S18–S19]

Räkenskapsinformation har också särskilda bevarandekrav: BFN anger sju år efter det kalenderår då räkenskapsåret avslutades. Det är ett annat behov än lagring av en telefoninspelning eller ett vanligt kundkort. [S20]

## 8. AI och dataskydd som produktfunktioner

Tre praktiska konsekvenser är särskilt viktiga:

**Tydlig AI-presentation.** Artikel 50 kräver som huvudregel att människor får veta att de interagerar direkt med AI när detta inte redan är uppenbart. EU-kommissionens aktuella vägledning anger tillämpning från 2 augusti 2026. Bygg in presentationen i telefon- och chattflödet. [S21–S22]

**Begränsad tillgång till kunddata.** Hälsouppgifter är känsliga personuppgifter. Det är relevant för exempelvis fotvård när kunden nämner sjukdom eller medicinering. En bokningsassistent behöver normalt inte hela behandlingshistoriken. [S23]

**Separata ändamål och lagringstider.** Ljud, transkript, sammanfattning, kundhistorik och bokföringsunderlag ska hanteras efter sina egna behov. IMY betonar att GDPR:s grundprinciper gäller även vid AI-användning. [S24]

Detta bör märkas i produkten genom tydliga åtkomstval, export, gallring, loggning och mänsklig överlämning. Företagaren behöver förstå vilken information en ansluten assistent kan läsa och vilka ändringar den får göra.

## 9. Distribution kan bli viktigare än själva bokningsgränssnittet

Det finns två olika frågor:

1. Kan en agent använda Booking Lab?
2. Kommer agenten att hitta och rekommendera salongerna som använder Booking Lab?

Ett bra API löser främst den första.

ACP:s officiella information säger att implementation inte automatiskt ger listning i AI-plattformar. Muse beskriver också granskning före publicering av connectors. [S13, S09]

Google visar en annan del av utvecklingen. Dess funktion för pris- och tillgänglighetsförfrågningar kontaktar lokala företag, men den dokumenterade konsumentfunktionen är USA-/engelskbegränsad och skapar inte bokningen. En separat företagssida beskriver även automatiska bokningssamtal i utvalda regioner. Dessa får inte blandas ihop eller beskrivas som allmänt tillgängliga svenska funktioner. [S25–S26]

Google Actions Center har dessutom en särskild process med dataflöden, tester och granskning för bokningslänkar. En vanlig bokningssida innebär inte automatiskt partnerskap. [S27]

### Konsekvens för Booking Lab

Bygg tydliga, indexerbara företagssidor, bra tjänsteinformation, stabila länkar och aktuell tillgänglighet. Prioritera sedan de distributionskopplingar som målgruppen använder.

Bokadirekts marknadsplats erbjuder redan kundsökning, verifierade omdömen och sparade favoriter. En verksamhet som får många nya kunder därifrån bedömer ett byte utifrån mer än kalenderns kvalitet. [S28]

En möjlig första målgrupp är därför verksamheter som redan har stamkunder, rekommendationer och egen trafik, men vill ha en bättre arbetsdag. Det är en hypotes att undersöka, inte ett påstående om hela marknaden.

## 10. Vad som kan bli Booking Labs konkurrensfördel

Jag ser fem möjliga fördelar. Ingen av dem uppstår automatiskt av att produkten använder AI.

### En sammanhängande arbetsdag

Bokning, kundkort, försäljning och uppföljning bör kännas som ett system. Företagaren ska kunna förstå och lösa undantag utan att reda ut vilken leverantör som tappat ett meddelande. Kunden bör ha en tydlig första kontakt och kunna se om ett ärende väntar på Booking Lab, betalleverantören eller ekonomisystemet.

### Frihet att välja assistent

En egen bra vardagsvy kombineras med dokumenterad åtkomst för externa verktyg. Salongen får möjlighet att använda den assistent som passar, inom de behörigheter den själv ger.

### Svensk verksamhetskunskap

Kassa, betalning, momsunderlag, redovisning, språk och lokala arbetssätt kan göra en svensk produkt mer användbar än generell mötesbokning. Detta skapar samtidigt ett ansvar för kvalitet och support.

### Ett tryggt systembyte

Migrering är en del av produkten. Framtida bokningar, personal, tjänsteregler, kundhistorik, presentkort och ekonomiska åtaganden behöver flyttas kontrollerat. Bokningarna får inte spridas mellan två system som båda tror att de äger samma kapacitet.

### Öppen kod och tydlig dataåtkomst

Open source kan underlätta granskning, partnerskap och kundanpassning. Exportmöjligheter kan minska oro för inlåsning. Intäkten kan komma från drift, uppdateringar, migrering, support och integrerade tjänster.

Öppen kod ger däremot ingen automatisk kundanskaffning. De flesta salongsägare behöver framför allt en tjänst som fungerar när det är fullt i kalendern.

## 11. Pris och ekonomi: sälj mätbar nytta

Valeis publicerade pris för bokning och kassa för en utövare är 300 kr/månad, med ytterligare användare och integrationer som tillägg. Momsangivelsen framgick inte i den hämtade pristexten. Grundlicensen är alltså redan relativt låg, och total kostnad behöver jämföras med samma omfattning. [S29]

Telavox publicerar däremot en tydlig separat AI-kostnad: Essentials 999 kr/månad plus 2,50 kr per röstminut, exklusive moms. Vid 200 minuter blir AI-delens tariff 1 499 kr/månad före separat bokningslicens och eventuella meddelandekostnader. Det är en beräkning från listpriset, inte en offert för hela lösningen. [S30]

Min rekommendation är en begriplig grundavgift för plattformen och tydligt prissatt användning där kostnaden faktiskt varierar. API-åtkomst bör stödja kärnlöftet om valfri assistent. Intäkter från betalningar behöver analyseras med hänsyn till partneravtal och marginaler, inte räknas som gratis vinst.

När kunden eller företagaren använder en egen assistent kan dess abonnemang bära modellkostnaden. Booking Lab har fortfarande kostnader för API, drift, kontroller och support. En egen telefonreceptionist har en annan kostnadsprofil. Den skillnaden bör märkas i paketeringen, utan att alla agentåtgärder räknas som samma sorts AI-förbrukning.

### Tre sätt att använda AI: inkluderat, egen assistent och egna API-nycklar

Niclas föreslår att abonnemanget innehåller viss AI-användning och att mer avancerade kunder kan lägga till egna API-nycklar. Det passar den föreslagna arkitekturen. Följande är ett paketeringsförslag, inte beslutade priser eller befintliga funktioner.

| Läge | Kundens upplevelse | Kostnadsprincip |
| --- | --- | --- |
| Inbyggd AI | Funktionerna fungerar direkt i Booking Lab, inklusive godkända bakgrundsjobb. | En avgränsad månadspott ingår; ytterligare förbrukning har tydliga villkor och budgettak. |
| Egen personlig assistent | Kunden eller ägaren ansluter en kompatibel assistent som använder Booking Labs verktyg. | Assistentens egna villkor gäller för dess arbete. Booking Lab behöver fortfarande täcka API, drift, kontroller och support. |
| Egen API-nyckel | En avancerad verksamhet kopplar ett stödd modellavtal för plattformens AI-arbete. | Modellkostnaden kan gå mot kundens leverantörskonto, medan plattformsabonnemanget består. |

Att ansluta en personlig assistent och att ange en modellleverantörs API-nyckel är två skilda saker. Assistenten är en extern klient med eget arbetssätt; API-nyckeln låter Booking Labs egen exekvering använda ett modellkonto.

Headless betyder att funktioner kan användas utan Booking Labs vanliga gränssnitt. Bakgrundsarbete betyder att uppgifter kan fortsätta när användaren inte har appen öppen. Båda kan stödjas, men de kräver fortfarande planering, behörighet, säker exekvering och uppföljning.

Den inbyggda AI:n kan ge ett enhetligt grundstöd även när en extern assistent inte kan utföra ett visst arbetsflöde. En uppgift behöver ha en tydlig ansvarig exekverare så att den egna och externa assistenten inte gör samma utskick, inköp eller bokningsändring två gånger.

**Rekommenderad standard:** vanligt abonnemang fungerar utan API-nycklar. Egen assistent och egna nycklar är valmöjligheter. Visa begriplig förbrukning, kvarvarande budget och vad som händer vid gränsen.

Telefoni, längre analyser och enklare textutkast har olika kostnadsprofiler. Mät verklig användning före fasta löften om antal uppgifter. Om en egen nyckel slutar fungera bör betald reservkapacitet bara användas enligt ett redan tydligt godkänt val och budgettak.

Egna nycklar behöver förvaras säkert på serversidan, vara avskilda per verksamhet och aldrig hamna i webbläsarkod eller loggar. Modellerna ska nå samma kontrollerade verksamhetsverktyg oavsett vem som betalar användningen.


### Illustrativ leverantörsekonomi

Alla belopp i följande räkneexempel är exklusive moms.

Följande är antaganden, inte Booking Labs kända kostnader eller rekommenderade pris:

| Post per kund och månad | Antagande |
| --- | ---: |
| 100 samtal à 3 minuter | 300 minuter |
| Samlad rörlig kostnad, 2 kr/minut | 600 kr |
| Övrig direkt drift | 100 kr |
| Support och handpåläggning | 150 kr |
| Direkt kostnad | 850 kr |

Vid 999 kr i intäkt återstår 149 kr före utveckling, försäljning och gemensamma kostnader. Vid 1 499 kr återstår 649 kr. Därför bör användning, långa samtal och supportbehov mätas innan ett obegränsat paket utlovas.

### Illustrativt kundvärde

Fem verkligt tillkommande genomförda behandlingar med 400 kr i täckningsbidrag ger 2 000 kr före systemkostnaden. Om samma fem kunder annars hade bokat på webben är de inte fem extra behandlingar.

Sparad administration kan ha stort värde, men ska redovisas separat från faktisk extra försäljning. För en fullbokad terapeut kan färre avbrott vara den främsta nyttan.

## 12. Framtiden 2027–2030: tre scenarier

Detta är egna scenarier utifrån verifierade riktningar. Årtalen är planeringshorisonter, inte löften om lanseringar eller marknadsandelar.

| Scenario | Tänkbar utveckling | Vad som gör Booking Lab relevant |
| --- | --- | --- |
| Gradvis förändring | Företag använder mer AI internt, medan de flesta kunder fortsätter med webb, telefon och personal. | En komplett, lättanvänd vardagsprodukt med stegvis automation. |
| Snabb tillväxt för personliga agenter | Fler kunder delegerar återkommande bokningar och ändringar. Integrationer och live-data får större betydelse. | Bra skrivgränssnitt, behörigheter, betalningsstöd och anslutningar till relevanta kanaler. |
| Starka plattformsgrindvakter | Några stora assistenter och marknadsplatser styr upptäckt, partnerskap och delar av transaktionen. | Starka kundrelationer, flera distributionsvägar och ekonomi som tål partnerberoende. |

Min huvudbedömning för 2027–2028 är en blandning av det första och andra scenariot: mer användbar automation, men fortsatt stor betydelse för vanliga gränssnitt och mänsklig hjälp.

För 2029–2030 är det rimligt att planera för mer delegering av återkommande ärenden inom givna gränser. Däremot är det osäkert vilka assistenter som dominerar, vilka avgifter de tar och hur snabbt svenska småföretag förändrar sina arbetssätt.

En produkt som bara fungerar i scenariot med snabb agenttillväxt blir sårbar. En pålitlig plattform med flera ingångar kan vara användbar i alla tre.

## 13. Kan OpenAI, Anthropic, Meta eller Google ta hela marknaden?

Det är möjligt att de tar en större del av kunddialogen och även delar av administrationen. Dokumenterade satsningar från Google och Meta visar redan steg i den riktningen. [S08, S25–S26]

Det innebär en verklig risk: kundens relation kan främst vara till assistenten, medan Booking Lab blir en leverantör bakom kulisserna. Assistenterna kan också börja prioritera stora integrationspartners.

Samtidigt behöver en bokning fortfarande samordnas med fysisk kapacitet, personal, verksamhetsregler och ekonomiska händelser. Att lösa detta för svenska småföretag innebär löpande drift, integrationer, support och ansvar.

Min bedömning är därför att det finns utrymme för specialiserade plattformar. Det utrymmet bör förtjänas genom branschkunskap, driftsäkerhet och kundvärde. Det går inte att utgå från att storbolagen aldrig bygger egna vertikala produkter eller köper någon av konkurrenterna.

## 14. Rekommenderad utvecklingsordning för Booking Lab

Den senaste granskade projektstatusen beskriver en skyddad demo med syntetiska data, med återstående UX- och pilotgrindar. Den är inte ett godkännande för riktiga kunddata eller kommersiell drift. [P01]

Den här rapporten är ett strategiskt underlag och ändrar inte den avgränsningen.

### Etapp 1: gör den valda vardagsprodukten redo

Följ de redan beslutade stegen för UX, datalivscykel, åtkomst och drift. Behåll ambitionen att den kommersiella produkten ska täcka de centrala arbetsflöden målgruppen behöver: kalender, kunder, tjänster, personal, journal, varulager, betalning, kassa och bokföringskoppling. Marknadsföring och analys hör också till den kompletta målbilden. Bestäm funktionsnivån för den första kommersiella versionen utifrån målgruppen; utveckla delarna i etapper inom projektets beslutade grindar.

Formulera den första målgruppen tillräckligt snävt för att ”komplett” ska gå att uppnå. En ensam terapeut och en kedja med många lokaler har olika behov.

### Etapp 2: verifiera en sammanhängande pilot

Salong Solgården kan ge nära återkoppling när projektet uppfyller pilotkraven. Därefter behövs flera oberoende verksamheter för att pröva onboarding, begriplighet och support.

En pilot bör undersöka både hur produkten används och om någon vill betala för den. Närheten till utvecklaren får inte bli en förutsättning för att den fungerar.

### Etapp 3: anslut en AI-kanal med tydligt problem

Välj exempelvis missade samtal eller ett återkommande ägarärende utifrån faktisk frekvens och kostnad. Använd samma bokningsregler som i den ordinarie produkten och behåll en begriplig väg till mänsklig hantering.

### Etapp 4: utöka efter verifierad nytta

Fler assistenter, proaktiva arbetsflöden och distributionspartners blir aktuella när grundflödet fungerar och efterfrågan går att visa. Prioritera integrationer efter riktiga kunder, inte efter antalet logotyper på en integrationssida.

## 15. Pilotmått som kan avgöra om idén håller

| Fråga | Mått |
| --- | --- |
| Löser systemet uppgiften? | Andel ärenden med korrekt slutstatus, uppdelat på bokning, ändring och frågor. |
| Skapas nytt värde? | Tillkommande genomförda behandlingar samt separat uppmätt administrationstid. |
| Behövs mänsklig räddning? | Andel överlämningar och korrigeringstid per ärende. |
| Är det pålitligt? | Felaktiga bokningar, dubbelbokningar, obehöriga ändringar och betalningsavvikelser. |
| Bär ekonomin? | Intäkt minus rörlig kostnad, support och partneravgifter per verksamhet. |
| Är erbjudandet attraktivt? | Faktisk betalning och fortsatt användning efter en avgränsad pilot. |
| Går det att skala? | Tid för migrering, onboarding och återkommande support hos oberoende kunder. |

Testa också konflikter: två kunder väljer samma tid, agenten försöker igen efter timeout, en betalning kommer sent och en kund försöker ändra någon annans bokning.

Sätt tydliga operativa stoppregler för allvarliga fel. Att observera noll fel i en liten pilot bevisar inte att felfrekvensen är noll.

## 16. Vad som skulle försvaga affärsidén

Följande är viktiga motbevis att söka aktivt:

- Salonger gillar demonstrationen men kan inte beskriva ett problem de vill betala för att få löst.
- De flesta AI-bokningar ersätter en fungerande bokningskanal utan att minska arbetet.
- Systembyte riskerar mer kundinflöde än produkten skapar.
- Varje ny kund behöver mycket specialkonfiguration och handpåläggning.
- Stora konkurrenter paketerar motsvarande funktioner så att Booking Labs skillnad blir för liten.
- Partnerkostnader eller plattformsavgifter lämnar otillräcklig marginal.
- Tillit och felhantering är sämre än i det manuella arbetssättet.

Detta behöver inte innebära att projektet ska läggas ned. Det kan innebära att första segmentet, erbjudandet eller prissättningen behöver ändras.

## Rekommenderad position

**Booking Lab bör byggas som en svensk verksamhetsplattform för tjänsteföretag, där bokning, kundarbete och ekonomiska flöden kan skötas både direkt och genom godkända AI-assistenter.**

Kundlöftet bör handla om resultat: mindre administration, färre tappade ärenden, tydlig kontroll och en arbetsdag som fungerar. Agentstödet gör det möjligt att utveckla hur detta levereras.

Den långsiktiga möjligheten är att bli den pålitliga plattform som olika assistenter använder. Den närmaste uppgiften är att visa att den valda målgruppen får tillräcklig nytta för att vilja använda, betala för och rekommendera den.

## Metod och begränsningar

Researchen bygger främst på officiella produkt-, pris-, utvecklar- och myndighetskällor, kontrollerade 12 november 2026. Dokumenterad funktionalitet har skilts från egna rekommendationer och scenarier.

Ingen praktisk jämförelsetest av leverantörernas AI-receptionister har utförts. Offentliga funktioner, priser och regionvillkor kan ändras. Påståenden om konverteringsökning eller stora effektvinster från leverantörernas marknadsföring har inte använts som oberoende bevis.

Ingen exakt svensk marknadsstorlek eller marknadsandel har beräknats. En sådan analys behöver skilja företag, arbetsställen och behandlare samt fastställa vilka som faktiskt tillhör första målgruppen.

## Källförteckning

Webbkällorna nedan kontrollerades 12–13 november 2026. Hänvisningar i texten avser uppgiften nära respektive källmarkering.

- **[S01]** [Telavox: Valei-integration](https://telavox.se/integrationer/valei/).
- **[S02]** [Bokadirekt: API & Webhooks](https://business.bokadirekt.se/funktioner/api-webhooks).
- **[S03]** [Cal.com: MCP och bokningsinfrastruktur för agenter](https://cal.com/mcp).
- **[S04]** [Phorest: How does Front Desk AI work?](https://support.phorest.com/hc/en-us/articles/33199970495634-How-does-Front-Desk-AI-work-with-Phorest-Chat-Two-Way-SMS-Whatsapp). Uppdaterad 7 november 2026.
- **[S05]** [Stripe: Accept service bookings and payments from agents](https://docs.stripe.com/agentic-commerce/sellers/use-cases/booking).
- **[S06]** [OpenAI: Getting started with your dot](https://help.openai.com/en/articles/20001530-getting-started-with-your-dot).
- **[S07]** [Anthropic: Get started with Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- **[S08]** [Meta: Introducing Muse](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/). Publicerad 8 september, uppdaterad 10 november 2026.
- **[S09]** [Muse Connector Platform](https://platform.muse.ai/).
- **[S10]** [Claude Code: Connect tools via MCP](https://code.claude.com/docs/en/mcp).
- **[S11]** [Model Context Protocol: Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
- **[S12]** [A2A: Specification](https://a2a-protocol.org/v1.0.0/specification/).
- **[S13]** [Agentic Commerce Protocol](https://www.agenticcommerce.dev/), inklusive FAQ om deltagande och listning.
- **[S14]** [Stripe: Universal Commerce Protocol](https://docs.stripe.com/agentic-commerce/protocols/ucp).
- **[S15]** [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp).
- **[S16]** [Skatteverket: Kassaregister](https://www.skatteverket.se/foretag/drivaforetag/kassaregister.4.121b82f011a74172e5880005263.html).
- **[S17]** [Stripe: Shared Payment Tokens](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens.md?agent-seller=seller).
- **[S18]** [Fortnox: Authorize your integration](https://www.fortnox.se/developer/authorization).
- **[S19]** [Föreningen SIE-gruppen](https://sie.se/).
- **[S20]** [Bokföringsnämnden: Arkivering](https://www.bfn.se/fragor-och-svar/arkivering/).
- **[S21]** [EU: AI Act, artikel 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50).
- **[S22]** [EU-kommissionen: Transparency obligations under Article 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).
- **[S23]** [IMY: Känsliga personuppgifter](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/).
- **[S24]** [IMY: AI och grundläggande principer](https://www.imy.se/verksamhet/dataskydd/innovationsportalen/vagledning-om-gdpr-och-ai/gdpr-och-ai/ai-och-grundlaggande-principer/).
- **[S25]** [Google Search: Check pricing for local businesses with AI](https://support.google.com/websearch/answer/16421135?hl=en).
- **[S26]** [Google Business Profile: Automated calls and texts](https://support.google.com/business/answer/7690269?hl=en).
- **[S27]** [Google Actions Center: Appointments Redirect integration overview](https://developers.google.com/actions-center/verticals/appointments/redirect/integration-steps/overview).
- **[S28]** [Bokadirekt: Marknadsplatsen](https://business.bokadirekt.se/funktioner/marknadsplats).
- **[S29]** [Valei: Priser](https://www.valei.com/priser).
- **[S30]** [Telavox: Priser](https://telavox.se/priser/).
- **[S31]** [Riksdagen: Patientdatalag (2008:355)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/patientdatalag-2008355_sfs-2008-355/). Kontrollerad 13 november 2026; särskilt tillämpningsområdet och 3 kap. 17 §.
- **[P01]** [Booking Lab: dokumenterad projektstatus på feature/epic06-customers-demo-product](https://github.com/niclasvestlund-YT/booking-lab-se/blob/feature/epic06-customers-demo-product/docs/PROJECT_STATUS.md). Privat projektunderlag läst 12 november 2026; statusuppgifterna avser den dokumenterade demon.

