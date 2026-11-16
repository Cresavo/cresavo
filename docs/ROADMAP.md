# Roadmap

Senast uppdaterad 2026-11-16. Ersätter tidigare PRODUCT_ROADMAP, WORKPLAN och
epic-planer (finns i `docs/archive/`).

## Riktning

**Det öppna bokningssystemet för AI-agenter.** Ett fullvärdigt bokningssystem
för salonger och liknande tjänsteföretag som konkurrerar med Bokadirekt och Zoezi
i Sverige och med Fresha och Vagaro internationellt. Skillnaden: agenten är en
förstaklassanvändare.

Förebild för modellen är [Accounted](https://www.accounted.se), fast för bokning:

- Allt som går att göra i arbetsytan går att göra via API och MCP.
- Ägaren sätter reglerna för agenter: vad som får göras fritt och vad som kräver
  godkännande (till exempel avbokningar, prisändringar, återbetalningar).
- Lätt att byta in: import från befintligt system och personlig flytthjälp.
- Svensk detaljkunskap som moat (BankID, Swish, personalliggare, bokföringsexport),
  men kärnan är internationell och landsspecifikt ligger i utbytbara moduler.

Gatewayen (`booking-lab-gateway`) är kanalen för externa agenter som bokar åt
slutkunder. Ägarens egen assistent ansluter direkt till plattformen.

## Principer

1. **Kärnan först, bredden sen.** Bygg bara det en första salong behöver för att
   kunna byta system. Journal, lager, kassa, presentkort, sociala medier och
   avancerad analys är frysta tills fas 4 är klar.
2. **En regelmotor.** Webb, API och MCP använder samma domänkod.
3. **Internationellt i datamodellen, svenskt i modulerna.** Tidszon, valuta och
   språk per verksamhet. Swish, BankID och Skatteverket bakom adaptrar.
4. **Litet och verifierbart.** Varje steg är en gren med tester och en tydlig
   klar-definition. Ingen ny plan- eller rapportfil per steg.

## Faser

### Fas 0 – Städning

- [x] Ny README, STATUS, ROADMAP och AGENTS. Historik till `docs/archive/`.
- [x] Datumberoende demotester lagade.
- [x] A2A-demo, gamla agentskript, `/live`, `/product` och landningssidan borttagna.
- [ ] Det äldre samlade MCP-läget och discovery tas bort i fas 2 (se tabellen).

| Område | Förslag | Varför |
|---|---|---|
| `/api/v1` services, availability, bookings, proposals, access, openapi | Behåll | Salongens provider-API som gatewayen anropar |
| `src/lib/agent-api` kärna: keys, mandates, proposals, audit, bookings, v1 | Behåll | Agentregler och logg hör till salongen |
| `src/lib/agent-api/oauth`, `/authorize`, `/token`, `/register`, `.well-known/oauth-*` | Behåll och återanvänd | Grund för fjärr-MCP för ägaren i fas 2 |
| `sms-otp`, `customer-identity`, `/consent` | Behåll | Kundens godkännande, salongen äger kunden |
| `payment-contract` | Behåll | Grund för fas 5 |
| `/api/v1/mcp` + schema, `agent-api/mcp*.ts` (det äldre samlade läget) | Ta bort i fas 2 | Dubblerar gatewayen, men OAuth-labbet utfärdar token för just denna resurs och integrationstesterna använder den. Byts ut när ägar-MCP med OAuth byggs |
| `.well-known/usp`, `llms.txt`, `agent-api/discovery.ts` | Flytta till gatewayen i fas 2 | Discovery för externa agenter. `discoveryOrigin` används även av OAuth |
| `src/a2a`, `scripts/a2a-demo.ts`, äldre agent-demo-skript | Borttaget | Demo från före mandaten |
| `/live`, `/product`, `src/pages` (landningssida) | Borttaget | Demo och marknadsföring, hör till webbplatsen |
| `src/mcp/time-card`, `owner-card`, `plugins/` | Utvärdera | Experimentella MCP-kort, behåll bara om de används i fas 2 |

**Klart när:** lint, typkontroll, enhets-, integrations- och webbtester är gröna
och kundbokning, arbetsyta och gatewayns acceptansprov fungerar som förut.

### Fas 1 – Grund för riktig drift

- Flera verksamheter: `Organization`/`Business` som tenant, all data och alla
  frågor avgränsade, tester som bevisar att en salong aldrig ser en annans data.
- Inloggning för ägare och personal: roller, återställning, MFA för ägare.
- Tidszon, valuta och språk per verksamhet i stället för fast Stockholm/SEK.
- Staging-miljö (till exempel Vercel + Neon), backup och felövervakning.

**Klart när:** två syntetiska salonger kan köras i samma miljö utan att se
varandras data, och miljön kan återställas från backup.

### Fas 2 – Agentiskt för ägaren

- Fjärr-MCP med OAuth så att ägaren kan ansluta Claude, ChatGPT och mobilen.
  Ersätter det äldre samlade `/api/v1/mcp`-läget; discovery flyttas till gatewayen.
- Agentregler i arbetsytan: vilka handlingar som kräver godkännande, gränser
  per agent, och en synlig logg över allt agenter gjort.
- Enkel CLI ovanpå samma API.

**Klart när:** ägaren kan fråga "vilka luckor har jag på fredag?" och flytta en
bokning från Claude-appen i mobilen, och flytten syns i loggen.

### Fas 3 – Det en salong behöver för att byta

- Publik bokningssida per salong med egen adress.
- Påminnelser och bekräftelser via sms och mejl.
- Avboknings- och no-show-regler.
- Import av kunder, tjänster och framtida bokningar (CSV först, sedan export
  från de vanligaste svenska systemen) och en checklista för flytthjälp.

### Fas 4 – Pilot

- En riktig salong (Salong Solgården) under en begränsad period, med
  säkerhetsgranskning, personuppgiftsbiträdesavtal och plan för att gå tillbaka.

### Fas 5 – Betalning och svenska krav

- Betalning bakom adapter: Swish Handel (salongens eget avtal) och Stripe.
- Förskott och no-show-avgift.
- Personalliggare för frisörer och skönhetsvård.
- Bokföringsexport (SIE) och koppling till bokföringssystem, till exempel
  Accounteds API.
- Ta inte på kassafunktion förrän kraven på certifierat kassaregister är utredda.

### Fas 6 – Internationellt

- Fullständig översättning, valuta och betalning per land, Stripe som standard.
- Första marknad utanför Sverige väljs utifrån pilotlärdomar.

### Senare (fryst)

Journal och behandlingsdokumentation, lager och inköp, presentkort, kampanjer
via sociala medier, avancerad analys, kedjor och franchise.

## Öppen källkod och affärsmodell

Koden är redan AGPL-3.0-only. Förslaget är att behålla det och tjäna pengar på
det som salonger faktiskt betalar för, vilket inte är koden.

**Intäkter**

1. **Hostad tjänst (huvudintäkten).** Salonger vill inte köra egna servrar.
   Månadsabonnemang för drift, uppdateringar, backup och support. Gratisnivå för
   en behandlare, betalt därefter. Accounted tar till exempel från 199 kr/mån.
2. **Användningsbaserat.** Sms-påminnelser, betalningar och eventuellt agentbokningar
   via gatewayen, med påslag.
3. **Tillval för större kunder.** Flera enheter, kedjor, white label, SSO och
   utökad support.
4. **Flytthjälp och onboarding** som tjänst, eller gratis som säljargument.

**Varför AGPL fungerar här**

- Den som kör en ändrad version som tjänst måste dela sin kod, så en konkurrent
  kan inte ta koden och sälja den som sluten tjänst.
- Öppen kod ger förtroende för ett system som hanterar kunddata, och gör det
  lätt för agenter och utvecklare att bygga mot.
- Det går att självhosta, vilket sänker tröskeln för tekniska kunder och partners.

**Att besluta innan repot blir publikt**

- **CLA för bidrag**, så att projektet kan dubbellicensiera eller sälja
  kommersiella licenser senare.
- **Vad som är öppet och vad som inte är det.** Kärna öppen; driftkonfiguration,
  hemligheter och eventuella betalda tillval i separat privat repo.
- **Ren historik.** Publicera ett nytt repo med ren historik i stället för att
  göra detta repo publikt, efter en genomgång av hemligheter och interna dokument.
- **Varumärke.** Namnet registreras och skyddas separat; AGPL ger inte rätt att
  använda varumärket.
- **Läxa från Cal.com.** Cal.com flyttade i april 2026 sin kommersiella kod till
  sluten källkod med hänvisning till AI-drivna säkerhetsrisker, och släppte en
  separat MIT-licensierad community-version. Bestäm modellen tidigt i stället
  för att byta senare.

Tidpunkt: publicera inte koden förrän fas 1 är klar och säkerhetsgranskad.
