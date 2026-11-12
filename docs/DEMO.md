# Demo och mobilpreview — Epic 05 under leverans

Ny produktionsinspelning av kalender/tjänster/schema/flytt/avbokning förbereds. Äldre Epic04-bilder nedan är historik och bevisar inte den nya arbetsytan. Aktuell produktkod4099d9d; sluttestning körs på ny isolerad DB efter ren npmci. Ingen publik eller privat testsite är driftsatt.

## Privat mobilpreview: beslutsunderlag, BLOCKERAD

Läsande inventering2026-11-12 hittade en ansluten Vercel Pro-workspace men inget länkat Booking Lab-projekt. Inget Hetzner-konto eller projekt har verifierats/skapat. Nedanstående är ett konkret förslag, inte utförd drift eller en beställning. Lokal demo fungerar oberoende av detta beslut. Kundpilot är fortsatt NO-GO.

| Val | Föreslagen exakt miljö |
| --- | --- |
| Leverantör/projekt | Hetzner Cloud, nytt separat projekt **booking-lab-se-preview**, server **booking-lab-se-e05-preview**, endast syntetiska data. |
| Server/region | **CX23, x86-64,2vCPU/4GB/40GB, HEL1/Helsingfors, Finland**. Kapacitet är inte reserverad; leverantörssidan visar även en otillgänglighetsmarkering. Tillgång i HEL1 måste bekräftas före beställning. Ingen automatisk annan region/större plan. |
| Runtime | En Linuxserver med en Node24-process via befintliga scripts/server.mjs, byggd app och PostgreSQL18.6 på samma server, bara loopback. En process bevarar nuvarande processlokala limiter/proof; inga skalningsgarantier. Linux/nativebibliotek och riktig proxy/TLS måste verifieras före öppning. |
| Databas | Egen **booking_preview_demo** i HEL1, separata credentials, inga publika5432/3000-portar. Migration sker med operatörsbehörighet; appkontot ska inte vara PostgreSQL-superuser. Ingen anslutning till lokal/test-/produktions-DB. |
| Backup | Daglig konsekvent pg_dump, krypterad före överföring till separat **BX11 Storage Box i Tyskland/FSN1**, underkatalog booking-lab-se-preview; föreslagen retention7dagliga/4veckovisa. Återläsning till separat demo-DB ska provas. Cloud-diskbackup är ett tillägg, inte ersättning för logisk DB-backup. |
| Hela webbgränsen | Caddy HTTPS med separat namngivet Basic Auth-konto för Niclas på **alla paths**, inklusive /, /api/*, /admin och Next-resurser. Ingen offentlig health-/API-bakväg eller delad anonym länk. Appens individuella adminsession krävs därutöver. Ingen MCP-port; stdio förblir lokal. |
| Värdnamn | Niclas väljer en redan ägd domän/subdomän för TLS. Inget ägarskap eller fungerande URL antas; DNS/certifikat har inte ändrats. En hemlig URL/noindex ersätter inte åtkomstskydd. |
| Behöriga konton | Endast Niclas godkända preview-/admin-/infrastrukturkonton. Inget konto eller lösenord ges automatiskt till Grok, Codex eller andra. Grok granskar fryst källkod i separat lokal kopia enligt planen. |

**Kostnadsunderlag, inte offert:** renderad officiell prislista läst2026-11-12 visade CX23 **5,99€/månad inklusive IPv4, exklusive moms**, BX11 **3,20€/månad exklusive moms**; tillsammans9,19€. Separat Cloud-backup kostar ytterligare; sidan visade från1,098€/månad. Föreslagen infrastrukturgräns är **15€/månad exklusive moms**, utan ny domän eller förbrukning utöver grundnivå. Pris, regional kapacitet och slutlig order ska kontrolleras igen innan köp. Inget pris anges som garanterad tillgänglig offert och ingen tjänst har köpts. [Serverpris](https://www.hetzner.com/cloud/cost-optimized/) · [Storage Box](https://www.hetzner.com/storage/storage-box/).

Caddy ska överskriva X-Real-IP från verklig klientanslutning; appen litar bara på lokala Caddys exakta loopbackadress, aldrig godtyckligt X-Forwarded-For eller breda CIDR. Host bevaras för befintlig sameOrigin-kontroll. Perimeter-Authorization ska inte vidarebefordras till appen; inga råa request bodies, cookies, credentials eller IP-adresser i demologgar/artefakter. Generera hemligheter separat, behåll filrättigheter och aldrig i Git. Behåll distributions-/native-notisgrindar i DEPENDENCY_REVIEW; förslaget är ingen licensklarering av en framtida image.

Vanlig Next-deploy på det befintliga Vercel-kontot väljs inte automatiskt. Vercel har sedan2026 stöd för Node-servrar, så vi påstår inte ett generellt förbud. Däremot är kombinationen denna Next-wrapper, socketidentitet, processlokal limiter och plattformens instansskalning **inte verifierad**. Det skulle kräva separat runtime-/proxytest; att ta bort wrappern eller lita på alla proxyadresser är ingen tillåten genväg. Detta är vår tekniska bedömning, inte ett påstående att ingen Vercel-lösning är möjlig. [Vercels Node-serverstöd](https://vercel.com/changelog/deploy-node-servers-with-zero-configuration) · [Aktuell Next custom-serverguide](https://nextjs.org/docs/app/guides/custom-server).

**Ett samlat beslut behövs före någon åtgärd:** godkänn leverantör/projekt/HEL1, kostnadsgränsen, backup i Tyskland, valt ägt värdnamn och exakt vilka namngivna konton som får åtkomst. Beställning, DNS, secrets, kontoåtkomst och deploy ingår inte i förberedelsen. Om kapacitet/pris avviker ska förslaget omprövas, inte automatiskt bytas.

Efter ett sådant beslut återstår faktisk verifiering: oinloggat/inkognito ger401 på både HTML och API; direkt3000/5432 är stängt; korrekta proxyheaders och två separata klienter fungerar; cookie/logout/adminregler består över TLS; återställningsprov lyckas; Niclas kan genomföra flödet från sin verkliga mobil. Alla dessa är **NOT RUN** nu. Ingen iPhone/Safari eller privat testsite påstås godkänd genom Playwrights mobilemulering.

Primärkällor för driftförslaget: [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [proxyheaders](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Hetzners backupplacering](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/). Hetzner anger Cloud-backup på samma ort och snapshots inom samma nätzon; därför väljs separat logisk backup med uttrycklig Tysklandsregion i detta förslag. Ingen generell GDPR-certifiering härleds av regionvalet.

## Bilaga — verifierad Epic 04-demo

## Epic 04 — aktuell produktionsdemo

2026-11-12 kl.07:35 CET. Revision **9282cdc9557f0bd76ea6c0196fab7bd92290d21b**, produktkod3419973, dirty=false, produktionsbygge. **4/4 PASS**,34.6s;14PNG och4WebM. Endast syntetiska uppgifter.

- [Lokalt galleri](../demo-artifacts/2026-11-12T06-35-12-079Z/index.html)
- [Manifest](../demo-artifacts/2026-11-12T06-35-12-079Z/manifest.json)
- [Individuell admin och kampanj, mobil](../demo-artifacts/2026-11-12T06-35-12-079Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-mobile/04-admin-och-utkast.png)
- [MCP-bokning i admin, mobil](../demo-artifacts/2026-11-12T06-35-12-079Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-mobile/07-agentbokning-i-admin.png)

Kundbokning/bekräftelse/admin/kampanj och separat lokal agentbokning körs på dator och mobil. Egen syntetisk admin skapas/städas av varje fixture; inga standardkonton lämnas. Manuellt konto skapas med admin:manage enligt ADMIN_OPERATIONS. Granskade stillbilder: mobil/desktopadmin, desktopbekräftelse, mobilpublikt erbjudande och mobilagentbokning. Synlig egen adminidentifierare, maskerad kund-e-post, Stockholmstid/SEK och ingen N-badge i dessa bilder.

Alla4WebM probe/avkodning exit0 (11.08/11.48/4.92/2.92s); ingen full visuell genomtittning påstås. Slutaggregat i demo: bookings/campaigns/sessions/admins/overlaps=0. Artefakter är lokala och ignorerade, **inte tillgängliga via GitHub**. Källkod och reproduktionssteg är delbara. Tidigare Epic02-demo nedan är historisk.

## Bilaga — tidigare Epic 02-demo

Epic 03 ändrar endast databasberoenden/konfiguration. Ingen ny video spelas in i denna batch; nedanstående galleri är från **äldre Epic 02-kod**, inte bevis för den nya Prisma-kandidaten. Kund/admin/kampanj/MCP verifieras i stället med hela E2E-matrisen på 18a4d73 (12/12 ×4). Se VERIFICATION. Det kosmetiska galleriets äldre introduktion nämner bara kampanjutkast; de separata 07-bilderna visar också agentbokningen.

Aktuell giltig inspelning: **7a65aeec341820442effe68a77a1ea978050a0b0** (produktkod 3cd633b), 2026-11-12 kl. 01:27 Europe/Stockholm, dirty=false och produktionsbygge. `npm run demo:record`: **4/4 PASS**, 1,2 min, **14 PNG och 4 WebM**. Bara syntetiska uppgifter, inget externt publicerat.

- [Öppna det lokala galleriet](../demo-artifacts/2026-11-12T00-27-19-502Z/index.html)
- [Manifest med revision och filer](../demo-artifacts/2026-11-12T00-27-19-502Z/manifest.json)
- [Agentbokning i admin, desktop](../demo-artifacts/2026-11-12T00-27-19-502Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-desktop/07-agentbokning-i-admin.png)
- [Agentbokning i admin, mobil](../demo-artifacts/2026-11-12T00-27-19-502Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-mobile/07-agentbokning-i-admin.png)

Två flöden per skärmstorlek: (1) kundbokning → bekräftelse → admin → kampanjutkast → manuell publicering → publikt erbjudande; (2) en separat verklig lokal MCP-bokning som visas i admin. Terminalens MCP-anrop sker i testklienten; videorna visar webbläsarens resultat, ingen extern modellchatt. Bild 07 visar Syntetisk agentkund Anna/Erik. Desktop/mobil-bilderna 07 är visuellt granskade: svensk tid, SEK, maskerad e-post, ingen N-badge eller observerat horisontellt överflöde. Videorna har inte granskats i sin helhet.

Alla fyra WebM har kontrollerats med ffprobe och avkodats till slut med ffmpeg utan mediafel: VP9, 13,24 s / 10,68 s för kund-/kampanjflödena och 8,44 s / 2,44 s för agentflödena. Desktop 800×450, mobil 392×800. Detta är en medieteknisk kontroll, inte en fullständig visuell genomtittning. Lokal resultatfil: `C:\Users\<user>\booking-lab-pg-test\epic02-video-check.json`.

Prova agentflödet själv: starta lokal databas och webb enligt README, kör `npm run mcp:client -- --admin --book`, läs sammanfattningen och skriv `ja`. `nej` eller EOF avbryter utan bokning. Öppna /admin och kontrollera bokningen. Endast example.test och syntetiska namn. Ingen ytterligare UI, dashboard eller modellnyckel behövs.

Reproducera hela inspelningen med instruktionerna nedan och en separat tom *_demo-databas. Demokonfigurationen väljer nu både befintligt fullflöde och agentflödet. Artefakterna är lokala/ignorerade och finns inte i Git eller den rena källkods-ZIP:en. Efter körningen: 0 bokningar, 0 kampanjer, 0 sessioner i demodatabasen.

Första inspelningsförsöket på 18b2ac5 blev FAIL 1/4 vid screenshot, medan funktionella kontroller och tre videoflöden passerade. Det ligger kvar separat och räknas inte som godkänd demo. Riktad diagnostik och ny full inspelning PASS, utan höjd timeout eller ändrad bokningslogik; rotorsaken är inte fastställd. [Felhistorik](EPIC_02_QA_FOLLOWUP.md).

## Bilaga — tidigare inspelningar och gemensamma instruktioner

## När vi spelar in

Full demo spelas in när en Epic är klar, inför en överenskommen viktig avstämning eller på uttrycklig begäran. Vanliga QA-/fixomgångar får automatiska tester och en kort resultatrapport; ingen ny video eller full bildsekvens behövs. Vid synliga ändringar tas riktade skärmbilder om de behövs för granskningen. Testkraven är oförändrade.

Återanvänd senaste relevanta demo och ange dess revision samt eventuella senare ändringar. En äldre demo är inte bevis för att ny kod har verifierats. Policyn gäller kommande arbete; tidigare inspelningar nedan är historik.

## Senaste inspelning

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

3. Skapa `.env` från `.env.example` om den saknas; bevara egen konfiguration. Sätt DATABASE_URL till demodatabasen, exempelvis `postgresql://booking:booking@127.0.0.1:5432/booking_visual_demo`. Välj SESSION_SECRET (minst 32 tecken). Skapa ett eget syntetiskt adminkonto enligt ADMIN_OPERATIONS.md för manuell provning; den automatiska demon skapar och städar sitt eget konto. Lägg dem aldrig i rapporter eller Git.
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

Det är en lokal POC: individuella syntetiska adminer utan MFA, inga kundkonton, ingen avbokning, återbetalning eller automatisk rabattdebitering. Se [PROJECT_STATUS](PROJECT_STATUS.md) innan något tolkas som färdigt för kunder.

## Aktuell QA-inspelning

[Galleri 2026-11-11](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json): 2/2 PASS, 12 PNG, 2 WebM, produktionsbygge. Revisionen var ed1658a med arbetsändringar; den koden är nu 26ea617. Två representativa bilder visuellt granskade utan N-badge. Bekräftelsen visar tjänst, datum/tid och Europe/Stockholm; admin maskerar e-post och har Logga ut. Native datumfält följer fortfarande Chromium-miljöns format.

Git behöver inte finnas: manifestet använder då revision unknown och dirty null. Misslyckade steg skriver statiska koder: DEMO_CONFIG_INVALID, DEMO_DATABASE_UNAVAILABLE, DEMO_DATABASE_NOT_EMPTY_OR_SYNTHETIC, DEMO_BUILD_FAILED, DEMO_RECORDING_FAILED eller DEMO_OUTPUT_FAILED. Felaktiga/partiella inspelningar är inte godkända demos.

I den manuella demon visas ett publicerat erbjudande först på validFrom. Klientens exempel med nästa vecka kan därför finnas i admin men ännu inte på bokningssidan. Använd ett syntetiskt utkast med dagens Stockholm-datum om du vill prova publicering direkt. Välj högst 90 kalenderdagar. Vid bokning längre fram än14 dagar behöver adminfiltret ändras.
