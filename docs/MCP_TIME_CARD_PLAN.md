# Avgränsat prov: tidvalskort via lokal MCP i ChatGPT

Godkänt av Niclas 2026-11-13, inklusive valet **ChatGPT på PC:n – lokal
anslutning först**. Bas `1a49a0e`, produkt `95f8071`; separat branch
`feature/mcp-time-card`. Det föregående uppdraget är avslutat, inte omstartat.

## Leverans och acceptans

- Ett litet MCP Apps-kort med behandling, utförare, ordinarie pris, längd,
  svenska dagval och tryckbara tider. Stockholmstid, tangentbord, 320/390 px
  och desktop. Inget tekniskt datum behöver skrivas.
- Samma `getAvailability` som webben; ingen alternativ bokningsmotor.
- En ny kontroll av tidsvalet visar om tiden försvunnit. Byte av dag, tjänst
  eller utförare tömmer tidigare tidsval. Tomläge leder vidare till nästa dag.
- Tydligt: **Demo – endast påhittade uppgifter.** Ett tidsval reserverar
  ingenting och skapar ingen bokning. Inga kundfält eller adminverktyg.
- Opt-in, lokal stdio, loopbackdatabas med `_test`/`_demo`. Produktionsmiljö,
  Vercelmiljö och skrivflaggor nekas. Separat syntetisk databas för kortet.
- Faktisk anslutning och rendering i ChatGPT måste observeras innan den delen
  får kallas klar. En egen testvärd/SDK eller skärmbild är inte ett ChatGPT-bevis.
- Fryst separat Grok-QA, högst två samlade rättningsvarv. Skillnad mellan
  egen klientprovning, Groks tester och läsning av vårt underlag ska framgå.

## Teknik och avgränsning

`src/mcp/time-card/` är en separat ingång. Den vanliga MCP-serverns katalog,
kapacitetsprofil och behörighetsmodell består. Den nya profilen har endast
`list_services` och `show_time_picker` och en `ui://`-resurs. Text och
`structuredContent` fungerar även utan grafisk klient. 28 dagars sökfönster.

Kortet är en självständig HTML-resurs med vanliga select-/button-kontroller.
MCP Apps JSON-RPC-brygga; ingen extern nätåtkomst, font/CDN, telemetri eller
modellanslutning. Ingen ny npm-dependency. Lokalt privat plugin återanvänder
fryst kod och oförändrade befintliga runtimeberoenden. Profil och databasnyckel
stannar utanför paket/Git. Plugin är PC-bundet, inte en moln-/mobilanslutning.

Ingen schemaändring, ny epic, fjärr-MCP, publik tunnel, ny betaltjänst,
mainmerge eller ändring av den skyddade Vercel-previewn behövs. Kundpilot
förblir NO-GO. Fysisk iPhone/Safari ingår inte i detta lokala första prov.

## Källor och licenser

Egen implementation enligt protokollbeskrivningar, ingen återanvänd hel app
eller skyddad asset. Projektlicens AGPL-3.0-only består. Befintliga officiella
MCP SDK v2.4.0 används; inga nya transitiva beroenden. Temporär befintlig
Prettier 3.6.2 används enbart som utvecklingsverktyg, inte i lockfilen.

- [OpenAI: MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OpenAI: lokalt plugin](https://developers.openai.com/plugins/deploy/desktop-only)
- [MCP Apps-specifikation](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx)
- [OpenAI Extensions-kontrakt](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md)
