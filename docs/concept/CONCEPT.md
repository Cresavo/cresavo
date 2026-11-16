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

## AI-arkitektur: byggd för att bli bättre när modellerna blir bättre

Kärnan är **headless**: alla verksamhetsåtgärder (boka, flytta, ändra pris,
skapa kampanj, journal, lager, publicera inlägg) är *verktyg* med tydligt
schema. Samma verktyg används av knapparna i appen, kommandorutan, interna
agenter och externa AI:er via MCP. UI:t är bara ett av flera sätt att anropa dem.

```
 Knappar · Kommandoruta · Röst · Claude/ChatGPT (MCP) · Schemalagda agenter
                              │
                  Verktyg (typade åtgärder + förslag/godkänn)
                              │
       Uppgiftsagenter (en sak var) ── Modellväljare (billig/smart/lokal)
                              │                     │
                   Verksamhetsdata            Leverantör: OpenAI / Anthropic /
                                              OpenRouter / egen nyckel (BYOK)
```

- **En agent per uppgift.** Små specialister: `tolka-kommando`,
  `strukturera-journal`, `skriv-inlägg`, `föreslå-kampanj`, `lagerprognos`,
  `svara-kund`, `dagens-summering`. Varje uppgift har eget promptfil, egen
  in/ut-struktur (JSON-schema) och en **modellnivå**: `snabb` (billig),
  `smart` (dyr), `bild`, `tal`. Bättre modell = byt nivå i en tabell.
- **Modellväljare/router.** Ett ställe som mappar nivå → leverantör + modell.
  Standard: plattformens nycklar. Kunden kan lägga in egen nyckel (OpenAI,
  Anthropic eller OpenRouter, som ger hundratals modeller via ett API) och
  välja nivå per funktion. Allt OpenAI-kompatibelt anrop går genom samma klient.
- **Kostnad syns.** Varje AI-anrop loggas med uppgift, modell och uppskattad
  kostnad, så man ser vad features kostar och kan prissätta dem.
- **Alltid en fallback.** Utan nyckel fungerar regelbaserade varianter.
  AI förbättrar, men krävs aldrig.
- **Förslag först.** Agenter ändrar aldrig direkt; de lämnar förslag som
  människan godkänner (eller som ägaren uttryckligen har slagit på
  "godkänn automatiskt" för, per typ).
- **AI i bakgrunden.** Mycket AI ska inte synas: den sorterar Idag-korten,
  fyller i fält, föreslår text, upptäcker mönster. Ingen chattbubbla i onödan.

## Marknadsföring: en kampanj → alla kanaler

- **Kampanjstudio**: välj behandling/erbjudande (eller ta ett högtidsförslag)
  → systemet skriver text per kanal (Instagram, Facebook, TikTok, Google,
  nyhetsbrev, SMS) och gör bild/affisch i salongens stil → granska/ändra →
  **Publicera överallt** eller schemalägg.
- Bilder: mallbaserade affischer (egen text på salongens foton) som standard,
  AI-genererad bild som tillval. Många gillar inte "AI-look", så mallar och
  egna foton först.
- **Annonser**: "Kör detta som annons på Facebook/Instagram, 500 kr, 7 dagar"
  → förslag på målgrupp (närområde) → godkänn.
- **Resultat tillbaka**: räckvidd, klick och – viktigast – **bokningar som
  kom via kampanjlänken** syns på kampanjen. Varje kampanj får spårbar länk.
- I demon är publicering och statistik simulerade men ser verkliga ut.

## Återanvänd i stället för att uppfinna (kandidater)

| Behov | Kandidat | Not |
|---|---|---|
| Publicera i sociala kanaler | Postiz (öppen källkod, AGPL-3.0, självhostad, API + MCP) | Samma licens som repot. Annars Ayrshare/PostPeer som betal-API. |
| Flera AI-leverantörer i ett API | OpenRouter (OpenAI-kompatibelt), Vercel AI SDK | BYOK-stöd. Börja med enkel fetch-klient, byt till SDK vid behov. |
| Tal till text | Webbläsarens taligenkänning → OpenAI-transkribering | Lokal Whisper senare om kostnad/integritet kräver. |
| MCP för "äg din data" | Befintlig `src/mcp` + `/api/v1/mcp` i repot | Utöka med läsverktyg för allt. |
| Affischer | Mall i HTML/SVG → PNG (Playwright finns redan) | AI-bild som tillval. |
| Bokföring (senare) | Fortnox API | Kassa byggs inte nu. |

Licens och kostnad kontrolleras innan något kopplas på på riktigt.

## Öppna protokoll: bygg på andras standarder

Princip: egen kärna med typade verktyg, och **tunna adaptrar** per protokoll.
När ett protokoll blir bättre eller ett nytt vinner, byter/lägger vi till en
adapter, inte kärnan.

| Protokoll | Vad det gör | Status i repot |
|---|---|---|
| MCP | AI (Claude/ChatGPT) läser data och kör verktyg | Finns (`src/mcp`, `/api/v1/mcp`). Utöka med läsverktyg för allt. |
| A2A | Agent pratar med agent (kundens assistent ↔ salongens agent) | Lokalt prov finns (`@a2a-js/sdk`). |
| USP (Universal Services Protocol) | Upptäckt/bokning av tjänster via agenter | Upptäcktsprofil `/.well-known/usp` + namnalias, inte full konformitet. Tidigt utkast till standard. |
| UCP (Google/Shopify) | Agentisk handel: upptäckt, kassa, order; bygger ut mot resor/boende | Inte påbörjat. Relevant för e-handel och ev. bokning. |
| ACP (OpenAI/Stripe) | Köp inne i ChatGPT | Inte påbörjat. Senare, när kassa finns. |
| AP2 | Bevis på att en människa godkänt en agents betalning | Inte påbörjat. Repots mandat/godkännande-modell ligger nära idén. |
| OAuth 2.1 + discovery, OpenAPI, llms.txt | Säker anslutning, maskinläsbar API-beskrivning | Finns (labb). |

Demon visar detta på Mer → Din data & AI: "Din salong kan nås av AI-assistenter
via MCP, A2A och USP" med status per protokoll.

## Affärsmodell: öppen kärna enligt Accounted-modellen (förslag)

Förebild: [Accounted](https://github.com/erp-mafia/accounted), svensk
AI-native bokföring med öppen källkod (Next.js 16, AGPL, 150+ MCP-verktyg,
agenten föreslår och människan godkänner). Deras modell, översatt hit:

1. **Kärnan är AGPL och kan driftas fritt.** Det ger förtroende och
   uppmärksamhet. Gratis att drifta själv, aldrig spärrat där.
2. **Betald molnversion.** Abonnemang för den som bara vill logga in
   (de flesta salonger).
3. **"Connect"-tjänst, privat och betald.** Det som kräver avtal, nycklar
   och certifikat (SMS, betalning, publicering i sociala kanaler, annonser,
   Google-bokning, kalendersynk) körs som separat tjänst. Även den som driftar
   själv köper den. Accounted valde detta efter att någon sålt vidare en fork.
4. **Undantag för tillägg i licensen.** Tredjepartsmoduler som bara använder
   det dokumenterade tilläggs-API:t får ha egen licens, så det kan växa en
   marknadsplats.
5. **White label.** Kedjor, franchiser och leverantörer kan köra under eget
   varumärke.
6. **Ingen provision per bokning.** Det är skillnaden mot kedjorna.

**Bokföring byggs inte själv.** Koppla i stället till Accounted via deras
MCP/API. Det är samma stack och samma licens, och vi slipper bygga om
bokföring.

## Drift, loggning och support: byggt för en person

En person ska kunna driva detta. Därför gör systemet så mycket som möjligt
av supporten själv, och felen ska synas innan kunden ringer.

- **Strukturerad loggning från dag ett.** Varje anrop får ett request-id.
  JSON-loggar med nivå, verksamhet, användare (pseudonymiserat), åtgärd och
  tid. Aldrig kunddata, journaltext eller nycklar i loggar.
- **Händelselogg per verksamhet.** Allt som ändras (av människa, AI eller
  integration) sparas med vem, vad, före/efter och varifrån. Visas för ägaren
  som "Vad har hänt?" och gör att man kan ångra och felsöka utan att gräva i servern.
- **AI-logg.** Varje AI-anrop: uppgift, modell, tokens, kostnad, tid, om
  fallback användes, om förslaget godkändes. Det är både felsökning och prissättning.
- **Felspårning och larm.** Fel samlas (t.ex. Sentry eller öppen källkods-
  alternativet GlitchTip) med request-id. Larm till telefonen vid fel som
  påverkar bokning. Hälsosida för integrationer (SMS, publicering, betalning).
- **Inbyggd support.** "Hjälp"-knapp i appen som (1) svarar med AI utifrån
  dokumentation och kundens egna data/logg, (2) kan visa "så här gör du"
  direkt i rätt vy, (3) skapar ett ärende med skärmbild, request-id och
  senaste händelser när AI inte räcker. Ett ställe för alla ärenden.
- **Självbetjäning.** Export, återställning av raderat (papperskorg),
  ångra, statussida och kunskapsbank, så att färre behöver kontakta support.
- **Supportläge.** Ägaren kan tidsbegränsat ge support läsåtkomst; varje
  åtkomst loggas och syns för ägaren.

## Bidrag till projektet

- Varje bidrag kräver ett **bidragsgivaravtal (CLA)** som signeras digitalt
  en gång (t.ex. CLA Assistant på GitHub) innan första PR kan slås ihop.
- Varför CLA och inte bara DCO (som Accounted använder): Accounted
  konstaterade att de inte kan ändra licens utan samtycke från alla
  bidragsgivare. Med CLA behåller projektet möjligheten att erbjuda
  kommersiell licens eller ändra licens senare. Kärnan förblir AGPL för alla.
- `CONTRIBUTING.md` beskriver: CLA, kodstil, tester, syntetisk data,
  säkerhetsrapportering (aldrig publik issue) och tilläggs-API:t.
- Texten i CLA:n ska granskas juridiskt innan projektet blir publikt.

## Fler branscher

Salong (fotvård/massage) är första provet. Kärnan ska passa fler: frisör,
naglar, PT, klinik, hantverkare med bokning och e-handel. Branschen är ett
**paket** av moduler, ord ("behandling"/"tjänst"/"produkt") och agentprompter
– inte en egen kodbas.

## Inte i demon (senare)

Riktiga utskick (SMS/e-post), betalning/kassa, riktig bokföring, inloggning,
GDPR-hantering av journal. Allt sådant visas som simulerat och märkt.
