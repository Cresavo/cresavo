# Legacy-bortkoppling · endast plan

2026-11-15. Ingen legacyfunktion, route, migration, fixture eller dependency
tas bort i agentprov-2. park/legacy på bf7b6c3 är en tidigare snapshot, inte
bevis på att något redan kopplats loss. Behåll fryst agentprov-1 orörd.

## Ordning med små verifierbara steg

1. **Kartlägg ingångar före radering.** Markera routes, navlänkar, CLI-skript,
   MCP-flaggor, imports och testspecar för varje grupp. Startsida, vanlig
   admininloggning och nödvändig manuell bokningsadministration ska fungera
   efter varje steg. Låt historiska data och idempotensnamnrymder vara kvar.
2. **Lokal A2A-demo.** Isolera src/a2a och dess CLI/discovery från produktens
   verkliga anslutningsbeskrivningar. Bevara eventuell befintlig kanaletikett
   på gamla BookingEvent; skriv aldrig om historiska aktörer.
3. **MCP-kort.** Time-/owner-card och deras opt-in-ingångar skiljs från vanlig
   lokal stdio och den nya HTTP-gatewayen. Kartlägg shared environment,
   app-only-restriktioner och CardBookingAttempt-recovery innan bortkoppling.
   Gamla okända bokningsutfall ska fortfarande gå att reda ut via behörig admin.
4. **Slot Rescue/kampanjer.** Koppla först loss UI- och MCP-ingångar från
   kapacitetslogiken. Domain innehåller både boknings- och kampanjfunktioner;
   flytta inte hela domain.ts. Bevara befintliga Campaign-/förslagstabeller och
   relationer tills en separat datamigrationsplan är godkänd.
5. **Demoinloggning.** Den vanliga individuella produktinloggningen och
   återkallelse måste bestå. Demoåtkomst har projekts-/DB-avgränsning; att
   koppla loss den får inte ersättas av en publik adminbypass eller dolda
   inloggningskontroller.
6. **Kundregister/export sist.** admin/bookings/editor.tsx importerar
   customers/picker, länkar kundkort och kan skapa via customerId. Behåll en
   fungerande manuell bokningsväg innan dessa ingångar avlägsnas. Domänens
   kundkoppling, kontaktborttagning, åtkomst, teknisk historik och GDPR-skydd
   är inte död kod bara för att agentvägen inte använder kundkort.

## Grind för varje senare bortkopplingscommit

- Dokumenterad lista på faktiska imports/anrop och synliga ingångar.
- Backend, webb och återstående lokal/HTTP-MCP bokar med samma regler.
- Ingen försvagning av validering, BOLA, sessionsskydd, kvoter eller replay.
- workspace-write.ts, konfigurations-/personal-/idempotenslås och alla
  historiska migrationer behålls. Ingen trunkering eller massgallring.
- Meningsfulla kvarvarande regressionstester passerar; tester för en uttryckligen
  bortkopplad modul arkiveras med den, inte för att dölja en regression.
- Lint, tsc, unit/integration, build och berörd manuell admin kontrolleras.
  Dependencyn tas bort först när inga kvarvarande importer/kommandon använder den.
- Separata små commits med tydlig återställningsväg; inget större ramverk,
  nya produktmoduler, licensbyte, mainmerge eller extern publicering.
