# Demo – aktuell inspelning efter QA batch 3

`npm run demo:record` PASS från ren **a364bda73850c2983212684e94e9690d100d1d9b**, 2026-11-11 kl. 22:53 Europe/Stockholm. Produktionsbygge, dirty=false, 2/2 tester (25.4 s), 12 PNG och 2 WebM.

- [Lokalt galleri](../demo-artifacts/2026-11-11T21-53-01-311Z/index.html)
- [Manifest med revision och filförteckning](../demo-artifacts/2026-11-11T21-53-01-311Z/manifest.json)

Desktop/mobil visar Testkund Anna respektive Testkund Erik; inga riktiga personer. Slumpmässig e-postmarkör behålls för teststädning. Adminbilderna 04 har granskats visuellt: korta namn, maskerad e-post och ingen N-badge. Videorna har inte granskats i sin helhet. Artefakter ligger lokalt och ingår inte i Git.

Start via **npm run start**, socket-wrappern runt produktionsbygget. Reproducera enligt stegen nedan med ny lokal *_demo-databas; host/hostaddr-queryparametrar avvisas före Prisma-åtkomst. Kör en omgång åt gången. Efter inspelning finns 0 bokningar, 0 kampanjer och 0 sessioner från testerna. Tidigare uppgift om kvarvarande demosessioner gäller bara äldre revisioner.

## Historik och reproduktionsinstruktioner

# Prova Booking Lab SE lokalt

## Aktuell inspelning efter QA batch 2

[Galleri](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html) och [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json): 2/2 PASS, 12 PNG, 2 WebM. Inspelat från ren kodcommit a84e48a, dirty=false och build=production. Start 2026-11-11 kl. 22:04:56 svensk tid (21:04:56Z).

Mobilens adminvy och desktopens bekräftelse är visuellt granskade: YYYY-MM-DD, logout i sidhuvud, maskerad e-post, inga N-badges eller observerat layoutöverflöd. Videorna kan läsas i Chromium: 10,68 s (800×450) och 10,72 s (392×800). De är inte genomtittade i sin helhet; visuella slutsatser bygger på bilderna. Artefakter är lokala och ignorerade. Extern QA kan reproducera demon från revisionen men får inte dessa filer genom Git. Inget har laddats upp.

Startpunkten har ändrats: `npm run start` använder socket-wrappern med kompilerad Next och dev:false, inte rått next start. `npm run test:e2e:production` kör hela produktionssviten. Datumfält är textfält med format YYYY-MM-DD. Kör bara en QA-omgång mot samma databas/port. Sessionsrader består; fixture-städning avser bokningar/kampanjer. Den äldre inspelningen längst ned är historik.

En syntetisk demo visar kundbokning → administrationsagenda → kampanjutkast från lokal MCP → manuell publicering → erbjudande på bokningssidan. Ingen betalning, social publicering eller extern AI-tjänst används. MCP-anropet sker i testklienten; videon visar dess resultat i adminvyn, inte en chatt med en AI-modell.

## Spela in igen

Använd en **separat lokal databas**, utan andra användare eller parallella tester. Namnet måste sluta med `_demo`. Verktyget avvisar databaser med bokningar/kampanjer eller andra tjänster än de två oförändrade syntetiska seedtjänsterna. Det raderar aldrig befintliga data för att förbereda en inspelning. Använd endast syntetiska uppgifter även efter kontrollen; starta inte andra klienter under inspelningen.

1. Installera enligt README (`npm ci`, `npx prisma generate`, `npx playwright install chromium`).
2. Starta lokal PostgreSQL. Med befintlig Compose, skapa en ny databas:

   ```powershell
   docker compose up -d --wait
   docker compose exec db createdb -U booking booking_visual_demo
   ```

   Kommandot skapar databasen en gång. Om namnet redan finns: använd en annan tom `*_demo`-databas, radera inte den befintliga. Docker saknas på verifieringsvärden; den faktiska körningen använde separat PostgreSQL 18.6. En egen lokal PostgreSQL fungerar med motsvarande `createdb`.

3. Skapa `.env` från `.env.example` om den saknas; bevara egen konfiguration. Sätt DATABASE_URL till demodatabasen, exempelvis `postgresql://booking:booking@127.0.0.1:5432/booking_visual_demo`. Välj lokalt ADMIN_PASSWORD (minst 12 tecken) och SESSION_SECRET (minst 32 tecken). Lägg dem aldrig i rapporter eller Git.
4. Kör från projektroten med port 3000 ledig:

   ```powershell
   $env:NEXT_TELEMETRY_DISABLED='1'
   $env:CHECKPOINT_DISABLE='1'
   npm run db:migrate
   npm run db:seed
   npm run demo:record
   ```

Kommandot kör först ett produktionsbygge och startar/stoppar sedan sin egen produktionsserver (`npm run start`, socket-wrappern), utan Next-utvecklarbadge. Det kör samma accepterade bokningsflöde som E2E-testerna, på desktop och mobil. Varje körning skapar `demo-artifacts/<UTC-tid>/index.html`, `manifest.json`, tolv PNG-bilder och två WebM-videor. Öppna utskriven index.html direkt i webbläsaren. Galleriet är en statisk lokal fil, ingen tjänst eller dashboard. Videon saknar ljud; varje bildsteg hålls kvar kort för läsbarhet. Inloggningens lösenordsfält är maskerat; trace med requestinnehåll är avstängt i demoläget.

Manifestet anger Git-revision, tid, PASS/FAIL och om arbetskopian hade ändringar. Se alltid statusen: även en misslyckad körning kan lämna partiella bilder. Genererade filer ignoreras av Git, laddas inte upp och gallras inte automatiskt. En lyckad körning tar bort sina skapade bokningar och kampanjer; den seedade databasen består. Vid avbrott kan syntetiska testposter bli kvar: använd en ny databas för nästa inspelning. Det automatiska flödet efterlämnar alltså inte en förbokad kund åt den manuella demon.

## Bildsekvens

| Bild | Vad du ser och vad som kontrolleras |
|---|---|
| 01-bokningssida | Två tjänster; det opublicerade erbjudandet syns inte publikt |
| 02-vald-tid | Fotvård, vardag inom bokningshorisonten, ledig tid och syntetisk kund |
| 03-bekraftelse | Kunden får bekräftelsen att bokningen är registrerad |
| 04-admin-och-utkast | Samma kund i adminagendan och MCP-skapat utkast med 20 % rabatt |
| 05-publicerad-i-admin | Administratören har klickat Publicera; statusen har ändrats |
| 06-publikt-erbjudande | Erbjudandet visas på den egna bokningssidan |

Desktop och mobil har varsin sekvens. Den tekniska bokningskonflikten och MCP:s nekade åtkomst visas inte av bilderna; de bevisas i integrationstesterna.

## Prova själv efter inspelningen

1. Kör `npm run dev -- --hostname 127.0.0.1`. Öppna `http://localhost:3000`.
2. Välj Fotvård, en vardag under kommande 60 dagar och Visa lediga tider. Välj en tid och använd `Testkund` / `testkund@example.test`. Bekräfta och kontrollera meddelandet.
3. Öppna `/admin`, logga in med det lokala lösenordet och kontrollera kund, tjänst och tid i agendan.
4. I en andra terminal, kör `npm run mcp:client -- --admin`. Detta skapar ett syntetiskt kampanjutkast i databasen. Ladda om admin och kontrollera tjänst, rabatt och datum. Klicka Publicera och ladda om bokningssidan.
5. Stoppa webbservern med Ctrl+C och databasen med `docker compose stop` om Compose används. Dina manuella testposter består tills du själv väljer att städa testmiljön.

Det är en lokal POC: delat lösenord, inga kundkonton, ingen avbokning, återbetalning eller automatisk rabattdebitering. Se [PROJECT_STATUS](PROJECT_STATUS.md) innan något tolkas som färdigt för kunder.

## Aktuell QA-inspelning

[Galleri 2026-11-11](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json): 2/2 PASS, 12 PNG, 2 WebM, produktionsbygge. Revisionen var ed1658a med arbetsändringar; den koden är nu 26ea617. Två representativa bilder visuellt granskade utan N-badge. Bekräftelsen visar tjänst, datum/tid och Europe/Stockholm; admin maskerar e-post och har Logga ut. Native datumfält följer fortfarande Chromium-miljöns format.

Git behöver inte finnas: manifestet använder då revision unknown och dirty null. Misslyckade steg skriver statiska koder: DEMO_CONFIG_INVALID, DEMO_DATABASE_UNAVAILABLE, DEMO_DATABASE_NOT_EMPTY_OR_SYNTHETIC, DEMO_BUILD_FAILED, DEMO_RECORDING_FAILED eller DEMO_OUTPUT_FAILED. Felaktiga/partiella inspelningar är inte godkända demos.

I den manuella demon visas ett publicerat erbjudande först på validFrom. Klientens exempel med nästa vecka kan därför finnas i admin men ännu inte på bokningssidan. Använd ett syntetiskt utkast med dagens Stockholm-datum om du vill prova publicering direkt. Välj högst 90 kalenderdagar. Vid bokning längre fram än14 dagar behöver adminfiltret ändras.
