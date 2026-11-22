# Underbiträden (Sub-processors)

> **Utkast – kräver juristgranskning.** Förteckningen är bilaga 3 till
> [personuppgiftsbiträdesavtalet](DPA_TEMPLATE.md). Den bygger på vad koden och dokumentationen
> innehåller vid utkastet. Kolumner som anges med hakparentes `[...]` är inte kontrollerade och får
> inte fyllas i utan underlag från leverantören. Ingen leverantör får räknas som underbiträde i
> ett undertecknat avtal förrän posten är verifierad.

Ett underbiträde är en leverantör som behandlar salongens personuppgifter för Cresavos räkning.
Leverantörer som salongen själv väljer och kopplar in med egen nyckel eller eget konto (till
exempel eget bokföringsprogram eller eget AI-konto) är salongens egna biträden. De listas i
avsnitt B och ska inte tas upp som Cresavos underbiträden förrän en jurist har gjort
bedömningen.

Förteckningen ska ha ett datum och en ändringshistorik. Ändringar meddelas salongerna enligt
punkt 7 i avtalet.

| | |
| --- | --- |
| Version | Utkast 0.1 |
| Datum | [Fyll i vid publicering] |
| Ansvarig | [Namn] |

## A. Cresavos underbiträden (Cresavo's sub-processors)

| Leverantör | Roll | Uppgifter som behandlas | Plats | Överföring utanför EU/EES | Status i koden | Avtal och intyg |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel | Hosting av webbappen och serverfunktioner | Allt som skickas till servern: kunduppgifter, bokningar, journaler i förfrågningar | Konfigurerad region `arn1` (Stockholm) i `vercel.json`. [Verifiera att funktioner och loggar stannar i regionen.] | [Vercel Inc. är amerikanskt. Bedöm ramverket för personuppgiftsöverföring mellan EU och USA eller standardavtalsklausuler.] | Används för demon. Produktionsuppsättning för riktiga salonger är inte beslutad. | [Biträdesavtal: ej kontrollerat] |
| Neon (via Vercel Marketplace) | Hosting av PostgreSQL-databasen | Salongens hela dokument (`tenant_state`), revisionslogg, utskickskö, idempotensnycklar | Dokumentationen anger en EU-region. [Verifiera region, säkerhetskopior och supportåtkomst.] | [Bedöm: bolaget är amerikanskt.] | Beskrivs i installationsguiden. Inget produktionsbeslut. | [Biträdesavtal: ej kontrollerat] |
| E-postleverantör: Resend eller Postmark | Utskick av bokningsbekräftelser, påminnelser och avbokningar | Mottagarens e-postadress, meddelandets ämne och text, bokningsuppgifter | [Verifiera] | [Verifiera] | Adaptrar finns. Utskick simuleras tills en leverantör är kopplad. Ingen är vald. | [Ej kontrollerat] |
| SMS-leverantör: 46elks eller Twilio | Utskick av SMS | Mottagarens telefonnummer och meddelandetext | [46elks är svenskt. Twilio är amerikanskt. Verifiera.] | [Verifiera] | Adaptrar finns. Utskick simuleras tills en leverantör är kopplad. Ingen är vald. | [Ej kontrollerat] |
| Betaltjänstleverantör: Stripe (kort), Swish via godkänd leverantör | Betalning av förskott och avgifter | Belopp, referens, betalarens betaluppgifter hanteras hos leverantören | [Verifiera] | [Verifiera] | Adapter för Stripe finns. Betalningar simuleras. Leverantörens roll (biträde eller eget ansvar) ska bedömas. | [Ej kontrollerat] |
| [Leverantör för säkerhetskopior] | Säkerhetskopior | Som databasen | [Ej beslutat] | [Ej beslutat] | Planerad. | [Ej beslutat] |
| [Leverantör för felspårning och larm] | Felspårning och driftlarm | Får inte innehålla kunduppgifter eller journaltext | [Ej beslutat] | [Ej beslutat] | Planerad. | [Ej beslutat] |

## B. Leverantörer som salongen kopplar in själv (Provider of the salon's own choice)

Dessa leverantörer får personuppgifter bara om salongen aktiverar dem. Utkastet föreslår att de
behandlas som salongens egna biträden, med salongens eget avtal, men det ska en jurist avgöra.

| Leverantör | Roll | Uppgifter som behandlas | Status i koden |
| --- | --- | --- | --- |
| Fortnox, Visma, Bokio | Bokföring | Fakturerings- och betalningsunderlag. Ska inte innehålla journaltext. | Adaptrar finns (Fortnox, Visma). Bokio är bara ett gränssnitt. |
| Google Kalender, Microsoft Kalender | Kalendersynk | Bokningstider och rubriker. Rubriker får inte innehålla hälsouppgifter. | Adaptrar finns. |
| Google Reserve | Bokningslistning | Salongens utbud och lediga tider | Adapter finns. |
| Meta | Publicering och annonser | Salongens egna kampanjer. Inga kunduppgifter. | Adapter finns. Annonsadapter är bara ett gränssnitt. |

## C. AI-leverantörer (AI providers)

| Leverantör | Roll | Uppgifter som behandlas | Status i koden |
| --- | --- | --- | --- |
| Anthropic, OpenAI, OpenRouter | Språkmodeller för uppgifter som sammanfattning av kund, utkast till journal och svar | Utvalda uppgifter som studion skickar för en aktiverad uppgift. Journaltext kan ingå i diktering till journal. | AI är valfritt och av som standard. Nycklar finns bara på servern eller är salongens egna. Den inbyggda regelmotorn fungerar utan nyckel. |

Före första riktiga salong ska för varje AI-leverantör avgöras: roll (biträde, eget ansvar hos
salongen vid egen nyckel), villkor om att inga kunddata används för träning, lagring av
begäranden, behandlingsplats, och vilka uppgifter som får skickas. Journaltext ska inte skickas
till en AI-leverantör utan att [DPIA för journalanteckningar](DPIA_JOURNAL.md) tillåter det.

## D. Underbiträdens egna underbiträden

[Inhämtas från varje leverantör och förs in här.]

## Ändringshistorik (Change log)

| Datum | Ändring | Meddelat salongerna |
| --- | --- | --- |
| [Datum] | Första utkast | Nej |
