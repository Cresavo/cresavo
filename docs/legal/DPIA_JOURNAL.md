# Konsekvensbedömning för journalanteckningar (DPIA input: journal entries)

> **Utkast – kräver juristgranskning.** Dokumentet är utvecklingens underlag till salongens
> konsekvensbedömning enligt artikel 35 GDPR. Salongen är personuppgiftsansvarig och äger
> bedömningen. Cresavo, som biträde, lämnar beskrivning av systemet och åtgärder. Inget här är ett
> beslut. Kolumner och avsnitt med `[...]` ska fyllas i av salongen eller dess jurist. Alla exempel
> är fiktiva. Se även [Compliance backlog](../compliance/COMPLIANCE_BACKLOG.md), avsnittet om
> hälsouppgifter, och [personuppgiftsbiträdesavtalet](DPA_TEMPLATE.md).

## 1. Sammanfattning (Summary)

Journalmodulen låter en salong skriva anteckningar per kund och besök: behandling, observationer,
råd, tidpunkt för nästa besök och före- och efterbilder. Anteckningarna kan avslöja en kunds
hälsotillstånd (hudtillstånd, skador, allergier, mediciner) och räknas då som känsliga
personuppgifter enligt artikel 9. Behandlingen riskerar därför att kräva en konsekvensbedömning,
särskilt om den sker i stor omfattning eller för sårbara kunder.

Utkastets utgångspunkt, i linje med compliance-underlaget:

- Journalmodulen är avstängd som standard och ska förbli avstängd i en allmän salongspilot
  tills salongen har gjort bedömningen och bestämt rättslig grund.
- Om salongen utför vård som omfattas av patientdatalagen gäller särskilda regler som Cresavo
  inte uppfyller i dag (till exempel krav på åtkomstkontroll, spårbarhet och lagringstid). Den
  användningen ligger utanför den allmänna pilotens omfattning.

## 2. Beskrivning av behandlingen (Description, art. 35(7)(a))

### 2.1 Vilka uppgifter

| Fält | Innehåll | Kan avslöja hälsa? |
| --- | --- | --- |
| Behandling | Fritext om vad som gjordes | Ja |
| Observationer | Fritext om vad som sågs | Ja |
| Råd | Fritext om rekommendationer | Ja |
| Nästa besök | Fritext | Ibland |
| Före- och efterbilder | Bildfiler eller referenser | Ja |
| Tidigare versioner | Varje ändring sparar föregående innehåll | Ja |
| Koppling | Kund, personal, datum, ev. bokning | Ja i kombination |

### 2.2 Registrerade

Kunder hos salongen. Antal: [Fyll i]. Sårbara grupper (barn, personer med skyddade
personuppgifter, patienter): [Fyll i. Utkastet rekommenderar att inte föra journal om barn].

### 2.3 Flöde och lagring

1. Personal eller ägare skriver eller dikterar en anteckning i studion. Diktering kan använda en
   AI-leverantör för att strukturera texten om salongen aktiverat AI. Utan AI-nyckel används
   inbyggda regler.
2. Anteckningen sparas i salongens dokument. I demon sparas det i webbläsaren. För ägarkonton
   sparas det i databasen (tabellen `tenant_state`) och varje ändring skrivs även i
   revisionsloggen (`tenant_action`) med innehållet.
3. Hela dokumentet, journaler inkluderade, skickas till ägarens webbläsare när salongen öppnas.
4. Journaltexten ingår inte i meddelanden till kunden eller i bokningssidan för kunder.
5. Export av en kunds uppgifter innehåller kundens journal med versioner.

### 2.4 Mottagare och underbiträden

Se [SUBPROCESSORS.md](SUBPROCESSORS.md). För journaler är de relevanta: hosting, databas,
säkerhetskopior och, om aktiverat, AI-leverantör.

### 2.5 Lagringstid

Journalposter har ingen automatisk lagringstid. Ägaren väljer efter hur många år posterna ska
tas upp för granskning (1, 2, 3, 5, 7 eller 10 år) under Integritet. Ingenting raderas
automatiskt. Förslagen ska bekräftas av salongen eller en jurist. [Fyll i salongens motivering.]

## 3. Nödvändighet och proportionalitet (Necessity and proportionality, art. 35(7)(b))

| Fråga | Bedömning |
| --- | --- |
| Ändamål | [Salongens ändamål, till exempel kontinuitet i behandling och kundens säkerhet.] |
| Rättslig grund, artikel 6 | [Fyll i. Kandidater: avtal, berättigat intresse.] |
| Undantag, artikel 9 | [Fyll i. Kandidater: uttryckligt samtycke enligt 9(2)(a), som måste vara frivilligt och kunna återkallas, eller 9(2)(h) om verksamheten är hälso- och sjukvård. Jurist ska avgöra.] |
| Uppgiftsminimering | Fälten är fritext. Salongen ska instrueras att inte skriva diagnoser eller uppgifter som inte behövs. [Fyll i rutin.] |
| Lagringsminimering | Se 2.5. |
| Information till registrerade | [Salongens integritetsinformation enligt artiklarna 13–14.] |
| Rättigheter | Tillgång och portabilitet (export), rättelse (redigera med versioner) och radering (permanent radering) finns i studion. Begränsning och invändning hanteras manuellt. |
| Underbiträden och överföring | Se SUBPROCESSORS.md. AI-leverantörer ska inte få journaltext förrän bedömningen tillåter det. |

## 4. Risker för de registrerades rättigheter och friheter (Risks, art. 35(7)(c))

Sannolikhet och allvar: [Fylls i av salongen. Skala: låg, medel, hög.]

| # | Risk | Konsekvens för den registrerade | Åtgärder i dag | Kvarstående |
| --- | --- | --- | --- | --- |
| R1 | Obehörig åtkomst av personal | Känsliga uppgifter exponeras för personer utan behov | Personalvyn visar bara kunder personen betjänat. Det är ett filter i klienten och ingen åtkomstkontroll på servern. Åtkomstlogg finns. Riktiga personalkonton saknas. | Hög tills serversidan begränsar åtkomst per roll. |
| R2 | Obehörig åtkomst utifrån (kontoövertagande, läckt session) | Röjande av journaler | Sessioner med återkallning. Ingen flerfaktorinloggning, ingen kontolåsning. | Hög tills dessa finns. |
| R3 | Dataintrång i databasen | Röjande av alla journaler | Ingen kryptering i vila av journalfält. Tenantisolering i databasen är inte klar. | Hög. |
| R4 | Journaler levereras till klienten tillsammans med övriga uppgifter | En kapad eller modifierad klient kan läsa allt utan att det loggas per post | Servern loggar varje inläsning av salongen (även när journaler bara finns i papperskorgen) och vägrar leverera om loggningen misslyckas. Studion rapporterar varje öppnad journal, och servern avgör vem som läser. Svar på ändringar (spara, radera) skickar fortfarande hela salongen, journaler inkluderade, utan egen loggpost. Detta är känt och accepterat tills en granskad läsväg finns. | Medel. Kräver att journaler hämtas en i taget och lämnas utanför övriga svar. |
| R5 | Överlagring: uppgifter finns kvar efter behov | Onödig lagring av känsliga uppgifter | Ägarens granskningstid. Gallring av aktivitetshistorik efter 13 månader. Radering av kund. | Medel. Enskilda journalposter kan inte raderas var för sig i dag. |
| R6 | AI-leverantör får journaltext | Överföring till tredje part, ev. till tredje land | AI är av som standard. Nycklar på servern eller salongens egna. Regelmotor utan nyckel. | Medel tills villkor och plats är bedömda. |
| R7 | Journaltext i revisionsloggen | Känsliga uppgifter lever vidare i loggen | Journalinnehåll i loggen ersätts med `[redacted]` vid radering av kund och efter 13 månader. | Låg till medel. |
| R8 | Journaltext i säkerhetskopior | Raderade uppgifter lever kvar | [Backup-rutin ej beslutad.] | Okänd. |
| R9 | Felaktiga uppgifter | Fel behandling eller råd | Rättelse med versionshistorik. | Låg. |
| R10 | Support läser journaler | Röjande | Supportåtkomst är tidsbegränsad och ägaren ger den. Journalläsning av support loggas inte särskilt. | Medel. |
| R11 | Bilder i journalen | Identifierbara kroppsbilder | Bilder är referenser i dagsläget. [Hantering av filer ej beslutad.] | Hög om bilder aktiveras. |

## 5. Planerade åtgärder (Measures, art. 35(7)(d))

### 5.1 Genomförda i koden

- Journalmodulen är avstängd som standard.
- Åtkomstlogg: varje läsning av en journal (ägare eller personal) och varje inläsning av
  salongen registreras med vem, när och vilken kund, aldrig innehåll. Ägaren ser loggen under
  Integritet. Loggen sparas 24 månader.
- Rättighetsfunktioner: export (JSON och kalkylblad), rättelse och permanent radering.
- Gallring: personuppgifter i aktivitetshistorik tas bort efter 13 månader, meddelandetexter i
  utskickskön efter 90 dagar. Ägaren får påminnelse om inaktiva kunder och om journaler äldre än
  vald tid.

- Förberett, avstängt tills det slås på (`JOURNALS_ON_SERVER=1` med `JOURNAL_ENCRYPTION_KEY`,
  november 2026): journaltext krypteras i vila (AES-256-GCM per version, nyckeln utanför
  databasen), salongen som skickas till webbläsaren bär ingen journaltext, en kunds journal
  hämtas per inloggad begäran och läsningen loggas på servern i samma transaktion, och radering
  av en kund tar bort kundens journalversioner (även omnämnanden i andra kunders journaler).
  Detta är tekniska åtgärder som nu finns tillgängliga; de räknas som genomförda först när
  flaggan är på för piloten. Förlorad nyckel gör journalerna oläsbara, och verktyg för
  nyckelbyte saknas ännu (docs/operations/INCIDENT_RUNBOOK.md).

### 5.2 Krävs före en journalpilot (öppna)

- [ ] Kryptering i vila för journalfält. Förberett (se 5.1), avstängt tills det slås på.
- [ ] Serversidig åtkomstkontroll per roll, med personal som bara når egna kunders journaler.
- [ ] Journaler hämtas en i taget från servern, så att varje läsning kan loggas på servern.
  Förberett (se 5.1), avstängt tills det slås på.
- [ ] Flerfaktorinloggning och kontolåsning för ägarkonton.
- [ ] Beslut om hantering av bilder, eller att bilder inte tillåts.
- [ ] Backuprutin med raderingsåterspelning och testad återställning.
- [ ] Enskilda journalposter kan raderas.
- [ ] Bedömning av AI-leverantörer eller beslut att journaltext aldrig skickas.
- [ ] Salongens integritetsinformation och rutin för begäran från registrerade.
- [ ] Rättslig grund och undantag enligt artikel 9 är beslutade och dokumenterade.

## 6. Kvarstående risk och samråd (Residual risk and consultation)

Bedömning av kvarstående risk efter åtgärderna: [Fylls i av salongen]. Om kvarstående risk är hög
ska salongen samråda med IMY före behandlingen (artikel 36). Dataskyddsombud: [Behov bedömt: ja
eller nej. Namn om ja.]

## 7. Godkännande och översyn (Approval and review)

| | |
| --- | --- |
| Bedömningen utförd av | [Namn, roll] |
| Råd från dataskyddsombud | [Ja/nej, datum] |
| Godkänd av salongens ledning | [Namn, datum] |
| Jurist har granskat | [Namn, datum] |
| Nästa översyn | [Datum. Förslag: vid varje ändring av journalmodulen, och minst årligen.] |
