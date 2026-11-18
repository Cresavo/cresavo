# Status

Senast uppdaterad 2026-11-16. Håll den här filen kort: ersätt innehållet när
läget ändras, och lägg detaljerade testbevis i commit-meddelanden eller CI.

## Läge

Visitors can try a booking on the demo landing and watch five recorded studio and customer workflows.

Lokal prototyp med syntetiska data. Ingen produktionsdrift, ingen kundpilot.

- Salongen (detta repo) och gatewayen (`booking-lab-gateway`) är separata repon,
  båda integrerade på `main`.
- Efter städningen och borttaget av gamla demoytor (2026-11-16, lokalt mot
  PostgreSQL 18): 385 enhetstester, 202 integrationstester, 64/64 webbtester
  (desktop och mobil, dev-läge), lint, typkontroll och build. Gateway `e1830fe`: 10/10.
- Kända öppna fynd: sju måttliga sårbarheter i utvecklingsberoenden (inga i
  produktionsberoenden) och några Info-fynd från tidigare granskningar.

## Det här fungerar

- Kundbokning på webben med lediga tider, idempotens och skydd mot dubbelbokning
  i databasen.
- Salongens arbetsyta: översikt, kalender, kunder, tjänster, personal och kampanjer.
- Lokal ägar-MCP: lista, flytta och avboka bokningar, scheman, tjänster,
  kapacitetsförslag och kampanjutkast.
- Agentförslag och mandat som kräver godkännande, med granskningslogg.
- Provider-API `/api/v1` som gatewayen anropar.
- Grund för flera språk (svenska och engelska delvis).

## Det här saknas för riktig användning

1. Fjärranslutning till MCP med OAuth (Claude/ChatGPT/mobil). Idag bara lokalt.
2. Flera verksamheter med riktig dataseparering. `businessId` är inte tenant-isolering.
3. Inloggning för ägare och personal med återställning och MFA.
4. Drift: deploy, backup, övervakning, säkerhetsgranskning.
5. Påminnelser via sms/mejl, import från andra bokningssystem, betalning.
6. Tidszon och valuta per verksamhet (idag fast `Europe/Stockholm` och SEK).

## Regler som gäller tills vidare

- Endast syntetiska data. Inga riktiga kunder eller utskick.
- Ingen push, merge, deploy, ny molnresurs eller betaltjänst utan Niclas uttryckliga godkännande.
