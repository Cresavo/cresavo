# Booking Lab – lokalt tidvalskort

Privat första prov på PC, inte en fjärrserver eller mobilinstallation.
Pluginet exponerar bara `list_services` och `show_time_picker`.
Tidsvalet reserverar ingenting och skapar ingen bokning.

## Förbered en isolerad lokal runtime

1. Checka ut den exakt granskade revisionen i en separat katalog. Kör `npm ci`
   och `npx prisma generate`. Använd projektets Node-version och låsfil.
2. Skapa en ny PostgreSQL-databas på loopback med suffix `_demo`. Använd inte
   gamla previewdata eller en kunddatabas. Kör de befintliga migrationerna
   och `prisma/seed.ts` med `DATABASE_URL` till just den databasen enligt README.
   Grundseed är additiv, inga kundkontakter behövs för kortet.
3. Skapa ett separat läskonto för denna databas. Tillåt `CONNECT`, `USAGE` på
   schema, `SELECT` på `Service`/`Staff` och endast kolumnerna `id`, `businessId`,
   `staffId`, `status`, `startsAt`, `endsAt` på `Booking`. Prisma läser även `id`
   internt. Ge inte behörighet till kundtabell, kontaktkolumner eller skrivning.
   Sätt kontots `default_transaction_read_only=on`. Ange lösenord säkert lokalt,
   aldrig i chatt, URL till användaren, pluginarkiv eller terminalhistorik.
4. Spara en privat env-fil utanför Git, med bara `DATABASE_URL` till läskontot
   och `BOOKING_TIME_CARD_DEMO=1`. Ingen `SESSION_SECRET` eller modellnyckel
   behövs. Runtime vägrar fjärrdatabas, otillåtet databassuffix, production,
   Vercel och admin-/skrivflaggor. Suffixkontrollen är inte ett bevis på att
   någon annans data är syntetiska; använd bara den nya egna demodatabasen.
5. Skapa användarens `~/.booking-lab/time-card.json`, där `~` är användarens
   hemkatalog i den lokala klientprocessen:

   ```json
   {
     "runtime": "D:/din/frysta/booking-lab-runtime",
     "envFile": "D:/din/privata/time-card.private.env"
   }
   ```

   Båda sökvägarna ska vara absoluta och filen får bara innehålla sökvägar,
   inte hemligheter. Launcher läser en liten explicit miljölista; den är inte
   OS-isolering eller en generell säkerhetsgräns mot en komprometterad PC.

## Anslut och prova

Paketet består av `plugin.json`, `mcp.json` och `launcher.mjs`. Installera det
privat med klientens stödda pluginflöde. Inga `node_modules`, `.env`, profiler
eller databasfiler ska följa med paketet. Befintlig Node behöver finnas i PATH.
En uppladdning sparar pluginet på kontot; verkställandet sker fortfarande på
den förberedda PC:n och förutsätter en klient med lokal exekvering.

Be klienten: ”Visa Booking Labs tidvalskort för massage nästa vardag. Skapa
ingen bokning.” Välj dag/tid och kontrollera ditt tidsval. Byte av tjänst,
utförare eller dag tömmer ett tidigare val. Vid tom dag: Prova nästa dag.
Stängda och fullbokade dagar skiljs inte åt i denna lilla POC.

Grafisk rendering kräver MCP Apps-stöd. Verktygsanrop som bara ger text eller
JSON bevisar inte att kortet visas. Vald tid överförs som modellkontext bara
om värden annonserar stöd; den kan aldrig användas som bokningsbekräftelse.

Tester i reporoten, med en separat migrerad/seedad loopback `*_test` och
`DATABASE_URL` uttryckligen vald:

```text
npm test
npm run test:integration
npx playwright test --config playwright.time-card.config.ts
npm run lint
npx tsc --noEmit
npm run build
```

Korttesterna använder en egen testvärd och verklig stdio/resurs. De verifierar
320/390/1024 px, byte av behandling, upptagen tid, tomläge och transportfel;
de är inte ett eget test av ChatGPTs rendering. Artefakter ligger separat i
`demo-artifacts/time-card/`. Kör full webbmatris enligt projektets README.

För att stoppa provet: stäng av just detta plugin i klienten. Ändra inte
ägarens andra MCP-registrering och stoppa inte en delad lokal PostgreSQL-server.
Ta inte bort data eller profiler automatiskt. Oförändrad AGPL-3.0-only;
korresponderande källkod och licenser finns i det privata projektrepot.
