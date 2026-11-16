# Koncept: AI-native salongssystem (klickbar demo)

Beslut av Niclas 2026-11-16. Mål: en **klickbar, levande demo av hela systemet**
som känns verklig. Den ska gå att visa för salongsägare och användas för att
få reaktioner (till exempel från en fotterapeut som använder bokningssystem
dagligen). Det är **inte** en skarp produkt. Fart och känsla går före full
riktighet. Bra delar byggs om "på riktigt" senare.

## Idén i en mening

Ett salongssystem där ägaren och kunden **säger eller skriver vad de vill**
och systemet föreslår ändringen, som man godkänner med ett tryck. Allt går
också att göra med vanliga knappar, så AI är en genväg och inget krav.

## Principer

1. **Less is more.** Få menyval, stora tydliga knappar, högst två tryck till
   allt vanligt. Ägaren är stressad och står ofta med en kund eller i telefon.
2. **Säg det i stället för att klicka.** En kommandoruta (text + mikrofon)
   finns alltid till hands. Resultatet visas som ett **förslagskort** med
   Godkänn / Ändra / Avbryt. Inget ändras utan godkännande.
3. **Proaktivt.** Systemet säger själv vad som behöver göras: luckor att fylla,
   varor som tar slut, högtider att kampanja inför, kunder som inte varit där.
4. **Du äger din data.** Allt går att läsa via MCP och exportera gratis.
   En egen sida visar "koppla Claude/ChatGPT" med kopiera-knapp.
5. **Moduler du själv slår på.** Journal, Lager, Kampanjer, Ekonomi, Omdömen.
   Avstängd modul syns inte i menyn.
6. **Kunden ska förstå direkt.** Kundsidan har en enkel ruta: "Vad vill du
   boka?" → tre färdiga tidsförslag → boka. Klassiskt klickflöde finns kvar.

## Ägarens app (`/studio`)

Meny (flikar i botten på mobil, sidomeny på dator):

| Flik | Innehåll |
|---|---|
| **Idag** (start) | Dagens tidslinje, nästa kund med kundkort-snabbinfo, proaktiva kort ("2 luckor i eftermiddag – skicka erbjudande?", "Fotkräm snart slut – beställ?", "Fars dag om 19 dagar – se kampanjförslag"), dagens intäkt. |
| **Kalender** | Dag/vecka, dra-och-släpp för att flytta, tryck för detaljer. Personalfilter. |
| **Kunder** | Sök, kundkort med bild, historik, anteckningar, journal (om påslagen), "inte varit här på 10 veckor"-markering. |
| **Inkorg** | Meddelanden/förfrågningar från kunder, ombokningsönskemål, nya omdömen. Ett tryck för att svara med förslag. |
| **Mer** | Tjänster & priser, Personal, Lager, Kampanjer, Ekonomi, Omdömen, Funktioner (moduler på/av), Din data & AI, Inställningar. |

**Kommandoruta** ("Vad vill du göra?") överst på varje sida + flytande
mikrofonknapp på mobil. Exempel som ska fungera i demon:

- "Flytta Annas tid på torsdag till 14" → kort som visar före/efter.
- "Boka in Erik på fotvård nästa tisdag förmiddag" → tre lediga tider.
- "Avboka 15:00 idag och erbjud tiden till väntelistan".
- "Kampanj på massage 20 % hela mars" → kampanjkort med pris före/efter.
- "Vad har jag tjänat den här månaden?" → siffra + liten graf.
- "Vilka kunder har inte varit här sedan sommaren?" → lista + "skicka hälsning".
- "Beställ mer fotkräm" → inköpsutkast.
- "Gör en affisch till fars dag" → affischförslag.

## Nya idéer att visa (sådant andra system saknar)

- **Telefonläge**: stor knapp "Någon ringer". Visar dagens/veckans luckor
  direkt och låter ägaren säga "flytta Lisa till fredag 10" med en hand.
- **Röstjournal efter besöket**: tryck "Prata in journal" på besöket →
  transkribering → strukturerad anteckning (behandling, observationer,
  rekommendation, nästa besök) → granska → spara. Föreslår nästa bokning.
- **Smart påminnelse om återbesök**: "Fotvård brukar göras var 6:e vecka –
  5 kunder är sena, skicka förslag?".
- **Fyll luckan**: avbokning → väntelista/stamkunder får erbjudande automatiskt
  (i demon: simulerat utskick som syns i Inkorg).
- **Högtidskalender**: Alla hjärtans dag, påsk, mors dag, fars dag, jul,
  presentkortsperioder. Varje högtid ger färdigt kampanjförslag + affisch.
- **Dagens summering** vid stängning: intäkt, nya kunder, journaler som
  saknas, morgondagens första kund.
- **Lagret pratar**: förbrukning räknas per behandling, varning när det
  börjar ta slut, inköpslista att godkänna.

## Kundens sida (`/boka/[salong]`)

- Salongens sida med bild, adress, öppettider, omdömen, tjänster med bild/pris.
- Överst: **"Vad vill du boka?"**-ruta. "Fotvård nån eftermiddag nästa vecka"
  → tre tidsförslag som kort → tryck → namn + telefon → klart.
- Klassiskt alternativ: välj behandling → välj tid → bekräfta (3 steg).
- Bekräftelsesida med "Lägg i kalender", "Boka om", "Avboka".
- "Mina bokningar" via länk (ingen inloggning i demon).

## Teknik för demon

- Ny separat route-tree: `/studio` och `/boka`. Rör **inte** befintlig
  `/admin`, API, MCP, Prisma-schema eller migrationer.
- **Ingen databas för konceptet.** Fixture-data i TypeScript + state i
  webbläsaren (React state + `localStorage`), med knappen "Återställ demo".
  Det gör demon snabb, säker att visa och oberoende av Postgres.
- **Kommandotolk** i två lägen:
  1. *Utan nyckel* (standard): regelbaserad svensk tolk som klarar
     exempelfraserna ovan och varianter.
  2. *Med `OPENAI_API_KEY`* i `.env`: server-route `/api/concept/intent` som
     ber modellen returnera samma JSON-struktur (åtgärd + parametrar). Faller
     tillbaka till regeltolken vid fel. Nyckeln lämnar aldrig servern.
- **Tal**: webbläsarens `SpeechRecognition` (sv-SE) i första hand. Med nyckel:
  `/api/concept/transcribe` som skickar ljud till OpenAI-transkribering.
- Bilder: använd befintliga i `public/demo` + genererade, enhetliga
  SVG-avatarer (initialer på pastell) för kunder. Inga foton på verkliga personer.
- Alla AI-förslag märks "Förslag" och visar exakt vad som ändras.

## Demodata

Salong: **Salong Eko** (fotvård + massage), Vasastan. Två personer: Anna
(fotterapeut, ägare) och Erik (massör). ~40 kunder med namn, telefon (fiktiv
070-1xx xx xx), anteckningar, 3–12 besök var, några med journalanteckningar.
Kalender fylld ~70 % kommande 3 veckor + historik 6 månader (för grafer).
Lager: ~15 produkter (fotkräm, nagelband­olja, filar, massageolja …) varav
2 nära slut. 3 omdömen per vecka. Dagens datum = verkligt dagens datum så
"Idag" alltid ser levande ut.

## Inte i demon (senare)

Riktiga utskick (SMS/e-post), betalning/kassa, riktig bokföring, inloggning,
GDPR-hantering av journal. Allt sådant visas som simulerat och märkt.
