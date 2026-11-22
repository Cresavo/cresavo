# Personuppgiftsbiträdesavtal (Data Processing Agreement)

> **Utkast – kräver juristgranskning.** Mallen är ett tekniskt underlag och inte juridisk
> rådgivning. Ingen text här får skickas till en salong eller undertecknas innan en jurist har
> granskat den. Hakparenteser `[...]` är platshållare. Alla namn och uppgifter i mallen är
> fiktiva eller tomma. Samlade juridiska frågor: [Compliance backlog](../compliance/COMPLIANCE_BACKLOG.md).

Mallen gäller när en salong (personuppgiftsansvarig) använder Cresavo (personuppgiftsbiträde) för
bokningar, kundregister och, om salongen väljer det, journalanteckningar. Den är skriven efter
artikel 28 i dataskyddsförordningen (GDPR) och IMY:s vägledning om personuppgiftsbiträdesavtal.

## 1. Parter (Parties)

| | Personuppgiftsansvarig (controller) | Personuppgiftsbiträde (processor) |
| --- | --- | --- |
| Namn | [Salongens firmanamn] | [Det bolag som tillhandahåller Cresavo] |
| Organisationsnummer | [Organisationsnummer] | [Organisationsnummer] |
| Adress | [Adress] | [Adress] |
| Kontaktperson för dataskydd | [Namn, e-post] | [Namn, e-post] |

Avtalet kompletterar [Tjänstevillkor / huvudavtal, datum]. Vid motstridiga bestämmelser om
behandling av personuppgifter gäller detta avtal.

## 2. Bakgrund och roller (Background and roles)

1. Salongen bestämmer ändamål och medel för behandlingen av sina kunders personuppgifter och är
   personuppgiftsansvarig.
2. Biträdet behandlar uppgifterna för salongens räkning och endast enligt dess dokumenterade
   instruktioner. Avtalet och salongens inställningar i Cresavo är instruktionerna.
3. Biträdet är personuppgiftsansvarigt för sin egen behandling av kontouppgifter, fakturering och
   säkerhetsloggar. Den behandlingen omfattas inte av detta avtal. [Jurist: bekräfta gränsdragningen.]

## 3. Behandlingen (Processing, see Annex 1)

| | |
| --- | --- |
| Ändamål | Att tillhandahålla bokning, kundregister, påminnelser, kassa- och betalningsflöden som salongen aktiverar, samt, om salongen aktiverar journalmodulen, anteckningar om behandlingar. |
| Typ av behandling | Lagring, hämtning, ändring, export, radering, överföring till underbiträden enligt bilaga 3. |
| Kategorier av registrerade | Salongens kunder och blivande kunder, salongens personal. |
| Kategorier av personuppgifter | Namn, telefonnummer, e-postadress, födelsedatum (valfritt), anteckningar, etiketter, bokningshistorik, meddelanden som skickats till kunden, omdömen, samtyckesuppgifter (väntelista, accepterade bokningsvillkor), journalanteckningar (se punkt 4). |
| Varaktighet | Så länge avtalet gäller, och därefter enligt punkt 12. |

## 4. Särskilda kategorier av personuppgifter (Special categories)

1. Journalanteckningar kan avslöja hälsotillstånd (till exempel hudproblem, skador, allergier,
   mediciner) och kan då vara känsliga personuppgifter enligt artikel 9.
2. Salongen ansvarar för att det finns en rättslig grund enligt artikel 6 och ett undantag enligt
   artikel 9 innan journalmodulen används för sådana uppgifter, och för att en
   konsekvensbedömning är gjord. Underlag: [DPIA för journalanteckningar](DPIA_JOURNAL.md).
3. Journalmodulen är avstängd som standard. Biträdet ska inte aktivera den åt salongen.
4. Biträdet använder inte journaltext för eget ändamål, utveckling, analys eller träning av
   modeller.

## 5. Biträdets skyldigheter (Processor obligations)

Biträdet ska

1. behandla personuppgifter endast på dokumenterade instruktioner från salongen, även vid
   överföring till tredje land, om inte unionsrätt eller nationell rätt kräver annat. Då ska
   biträdet underrätta salongen före behandlingen, om lagen inte förbjuder det;
2. se till att personer som behandlar uppgifterna har förbundit sig till tystnadsplikt;
3. vidta de tekniska och organisatoriska åtgärder som anges i bilaga 2 (artikel 32);
4. följa villkoren för underbiträden i punkt 7;
5. bistå salongen med att besvara begäranden från registrerade (punkt 8);
6. bistå salongen med säkerhet, incidenthantering, konsekvensbedömning och förhandssamråd
   (artiklarna 32–36), med hänsyn till behandlingens art och uppgifterna biträdet har tillgång till;
7. radera eller återlämna uppgifterna vid avtalets slut (punkt 12);
8. ge salongen den information som krävs för att visa att artikel 28 följs och medverka vid
   granskningar (punkt 11);
9. omedelbart underrätta salongen om en instruktion enligt biträdets bedömning strider mot
   dataskyddsregler.

## 6. Salongens skyldigheter (Controller obligations)

Salongen ansvarar för att uppgifterna är lagligen insamlade, att de registrerade fått information
enligt artiklarna 13–14, att rättslig grund finns för varje ändamål, att inställningar (till
exempel lagringstider och journalmodulen) väljs medvetet, och att personal i salongen får
åtkomst endast i den omfattning arbetet kräver.

## 7. Underbiträden (Sub-processors)

1. Salongen ger [allmänt / särskilt] skriftligt tillstånd att anlita de underbiträden som anges i
   [SUBPROCESSORS.md](SUBPROCESSORS.md) (bilaga 3).
2. Vid allmänt tillstånd underrättar biträdet salongen minst [30] dagar före tillägg eller byte av
   underbiträde. Salongen kan invända skriftligt inom [14] dagar. Om parterna inte når en lösning
   kan salongen säga upp berörd del av tjänsten utan kostnad.
3. Biträdet ingår avtal med varje underbiträde med motsvarande dataskyddsskyldigheter och är
   ansvarigt gentemot salongen för underbiträdets fullgörande.

## 8. Registrerades rättigheter (Data subject rights)

Biträdet ska med lämpliga tekniska och organisatoriska åtgärder hjälpa salongen att svara på
begäranden om tillgång, rättelse, radering, begränsning, invändning och dataportabilitet.
Beslutet fattas av salongen. Biträdet vidarebefordrar en begäran det får direkt utan onödigt
dröjsmål och besvarar den inte själv.

Funktioner som finns i studion för detta [Verifiera mot aktuell version före signering]:

| Rättighet | Funktion |
| --- | --- |
| Tillgång och portabilitet (art. 15, 20) | Export av en kunds uppgifter som JSON och som kalkylblad: kundkort, bokningar, journal med versioner, meddelanden, samtycken, omdömen. |
| Rättelse (art. 16) | Alla personuppgiftsfält på kundkortet kan ändras, journalanteckningar kan ändras med versionshistorik. |
| Radering (art. 17) | Permanent radering av en kund med bekräftelse, inklusive revisionslogg och meddelandekö. Bokföringsmässiga betalningsposter utan namn sparas. |
| Begränsning och invändning (art. 18, 21) | [Ej byggt. Hanteras manuellt via support tills vidare.] |

## 9. Säkerhet (Security, see Annex 2)

Biträdet ska ha en säkerhetsnivå som är lämplig för risken, och som minst motsvarar bilaga 2.
Bilagan ska visa vilka åtgärder som är genomförda och vilka som är planerade, med datum. Åtgärder
som ännu inte är genomförda får inte beskrivas som genomförda.

## 10. Personuppgiftsincidenter (Personal data breaches)

1. Biträdet underrättar salongen utan onödigt dröjsmål, och senast inom [24] timmar, efter att
   ha fått kännedom om en personuppgiftsincident som rör salongens uppgifter.
2. Underrättelsen innehåller så långt möjligt: vad som hänt, vilka kategorier och ungefärligt antal
   registrerade och poster som berörs, sannolika följder, åtgärder som vidtagits och en
   kontaktperson.
3. Salongen avgör om och hur incidenten anmäls till IMY (inom 72 timmar när det är möjligt) och
   till de registrerade. Biträdet bistår.

## 11. Revision och information (Audit)

Salongen har rätt att, med [30] dagars varsel och högst [en] gång per år om inte en incident
föranleder annat, granska att avtalet följs, själv eller genom oberoende revisor som är bunden av
sekretess. Biträdet får uppfylla kravet genom aktuella intyg eller rapporter, om de ger samma
visshet. [Jurist: bekräfta omfattning och kostnadsansvar.]

## 12. Avslut, radering och återlämning (Termination, deletion and return)

1. När avtalet upphör ska biträdet, enligt salongens val, radera eller återlämna alla
   personuppgifter och radera befintliga kopior, om inte lagringsskyldighet enligt unionsrätt
   eller nationell rätt gäller.
2. Salongen kan före avslut exportera sina uppgifter ([Dina uppgifter] i studion).
3. Radering sker inom [30] dagar efter avslut. Säkerhetskopior förfaller inom [X] dagar och
   raderingar tillämpas på nytt vid återställning. [Fyll i när backup-rutinen är beslutad.]
4. Under avtalstiden gäller de lagringstider som salongen väljer inom de gränser som
   tjänsten tillåter. Standardvärden finns i `src/concept/privacy/retention.ts` och ska
   bekräftas av salongen eller en jurist:

| Uppgift | Standard |
| --- | --- |
| Inaktiva kunder | Salongen får en påminnelse att granska efter 3 år utan besök. Ingenting raderas automatiskt. |
| Journalanteckningar | Enligt salongens inställning. Ingenting raderas automatiskt. |
| Personuppgifter i aktivitetshistorik | Tas bort efter 13 månader. |
| Meddelandetexter i utskicksloggen | Tas bort efter 90 dagar. |
| Hastighetsbegränsningsposter | Tas bort efter 1 dygn. |
| Nycklar för upprepade förfrågningar | Förfaller efter 24 timmar. |
| Logg över läsning av journaler | Sparas 24 månader. [Tillägg av tekniken. Bekräfta.] |
| Bokföringsunderlag | Salongen ansvarar för att spara räkenskapsinformation så länge bokföringslagen kräver. [Jurist: bekräfta vilka poster Cresavo ska bevara åt salongen.] |

## 13. Överföring till tredje land (Transfers outside the EU/EEA)

Biträdet och dess underbiträden behandlar uppgifter inom EU/EES, om inte annat anges i bilaga 3.
En överföring till tredje land får bara ske med stöd av ett beslut om adekvat skyddsnivå eller
lämpliga skyddsåtgärder enligt kapitel V (till exempel standardavtalsklausuler med en bedömning av
överföringen). [Fyll i per underbiträde. AI-leverantörer och leverantörer med amerikanskt
moderbolag kräver särskild bedömning.]

## 14. Ansvar (Liability)

[Jurist: ansvarsbegränsning och skadestånd. Ska vara förenligt med artikel 82.]

## 15. Giltighet och lagval (Term and governing law)

Avtalet gäller från [datum] så länge biträdet behandlar personuppgifter för salongens räkning.
Svensk lag gäller. Tvister avgörs av [domstol].

## Underskrifter (Signatures)

| Salongen | Biträdet |
| --- | --- |
| [Namn, titel, datum] | [Namn, titel, datum] |

## Bilaga 1: Behandlingen i detalj (Annex 1: Processing details)

| Datakategori | Exempel i Cresavo | Särskild kategori? |
| --- | --- | --- |
| Kontakt | Namn, telefon, e-post | Nej |
| Kundkort | Födelsedatum (valfritt), etiketter, anteckning, väntelistans samtycke | Anteckning kan innehålla hälsouppgifter |
| Bokningar | Tid, behandling, personal, pris, bokningsvillkor, avbokningsorsak | Behandling och avbokningsorsak kan avslöja hälsa |
| Meddelanden | Bekräftelser, påminnelser och svar | Kan innehålla hälsouppgifter om kunden skriver dem |
| Journal | Behandling, observationer, råd, nästa besök, före- och efterbilder, tidigare versioner | Ja, möjligen |
| Betalningar | Belopp, referens, datum | Nej |
| Åtkomstlogg för journal | Vem, när och vilken kunds journal. Aldrig innehåll. | Nej |

## Bilaga 2: Tekniska och organisatoriska åtgärder (Annex 2: Security measures)

Fyll i status per åtgärd när avtalet skrivs. Statusen nedan är utvecklingens bedömning vid
utkastet och ska verifieras.

| Åtgärd | Status |
| --- | --- |
| Separata konton för ägare med lösenord och sessionshantering | Delvis genomfört. Flerfaktorinloggning, återställning och kontolåsning saknas. |
| Isolering mellan salonger | Salongens id kommer alltid från sessionen. Isolering i databasen och tester som försöker läsa en annan salong är inte klara. |
| Behörighetsroller (ägare, personal, support) | Rollväxlingen i studion styr vyn. Den är ingen åtkomstkontroll på servern. Inte klar. |
| Kryptering i vila för journaler | Planerad. Inte genomförd. |
| Loggning av läsning av journaler | Genomförd för ägarkonton: studion rapporterar öppnade journaler och servern loggar inläsning av salongen. Journalerna levereras ändå tillsammans med resten av salongens data. |
| Radering och rättelse | Genomförd, se punkt 8. |
| Gallring | Genomförd som schemalagda funktioner (`npm run store:sweep`). Schemaläggning hos driftmiljön återstår. |
| Säkerhetskopior med testad återställning | Planerad. |
| Incidentrutin med 72-timmarsflöde | Planerad. |
| Hosting inom EU | Se bilaga 3. |

## Bilaga 3: Underbiträden (Annex 3: Sub-processors)

Se [SUBPROCESSORS.md](SUBPROCESSORS.md).
