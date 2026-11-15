# Salongens kontrakt med den fristående gatewayen

Salongen äger databas, tider, personal, behörigheter, mandat, bokningar och kalender.
[Gateway-repot](https://github.com/niclasvestlund-YT/booking-lab-gateway) äger den nya fristående
REST/MCP-ingången och dess verktyg. Båda installerar sina egna beroenden. Ingen kod importeras
mellan utcheckningarna. Namnen är arbetsnamn.

Starta salongens normala serverwrapper med `BOOKING_SERVICE_ROLE=salon`. Den inbyggda
HTTP-MCP-rutten och dess schemasida ger då 404. Det äldre samlade körläget finns kvar för
befintliga installationer. Utveckla nya gatewayverktyg i gateway-repot.
I split-läge ska `BOOKING_PUBLIC_ORIGIN` anges till gatewayens adress för discovery.

Provider-API: tjänster, tillgänglighet, bokning med idempotensnyckel, status, avbokning
och befintliga labförslag under `/api/v1`. `GET /api/v1/access` autentiserar aktuell
agent och returnerar endast protokollversion och scopes. Åtkomst till en operation eller ett
bokningsobjekt kontrolleras åter i salongen. Den behåller atomär mandatanvändning och
konfliktskydd även när anslutningen till gatewayen bryts.

## Kör acceptansprovet lokalt

Förbered en ny PostgreSQL-databas på loopback med namn som slutar på `_test`.
Tillför `DATABASE_URL` och ett separat tillfälligt `SESSION_SECRET` (minst 32 tecken) till
salongen och provets process på vanligt säkert sätt. En isolerad terminal för gatewayen
behöver `SALON_ORIGIN`, `PORT` och en separat tjänsteidentitet. Kör Node 24.

Generera 32 kryptografiskt slumpade byte som 64 gemena hextecken. Ge samma värde
som `GATEWAY_SERVICE_TOKEN` enbart till de två serverprocesserna. Vid rotation byter
du värdet och startar om båda. Agentklienter och provkoordinatorn behöver bara sina
ordinarie behörigheter. Använd loopback lokalt och TLS vid en framtida fjärranslutning.
I split-läge ger operativa REST-anrop utan tjänsteidentiteten 401, även med en giltig
agentnyckel. Servern stoppar vid start om rollen är felstavad, om bara en av de två
inställningarna finns eller om split och publik skrivskyddad fixturevy kombineras.
Utan båda inställningarna gäller det äldre samlade läget. Skyddet gäller
bokningsoperationerna och accesskontrollen. Discovery, OpenAPI och det syntetiska
demoflödet har egna åtkomstregler.

1. I salongens repo: `npm ci`, `npx playwright install chromium`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run build`.
2. I salongsterminalen: sätt `PORT=3217`, `BOOKING_SERVICE_ROLE=salon`,
   `BOOKING_PUBLIC_ORIGIN=http://127.0.0.1:3218`. Starta med `npm start`.
3. I gatewayens repo: `npm ci`. Sätt `SALON_ORIGIN=http://127.0.0.1:3217`, `PORT=3218`, kör `npm start`.
4. I salongens provterminal: sätt `AGENTPROV_BASE_URL=http://127.0.0.1:3218`,
   `AGENTPROV_SALON_URL=http://127.0.0.1:3217` och kör `npm run agent:proof` mot samma test-DB som salongen.
5. Förvänta tio PASS-rader inklusive `SEPARATE_SALON_AUTHENTICATED_CALENDAR` och
   `TWO_TRANSPORTS_ONE_WINNER_ONE_CONTROLLED_CONFLICT`. Provet skapar egna syntetiska aktörer
   och kontrollerar en länk till exakt rätt boknings-id i salongens inloggade kalender. En separat
   Chromium-session loggar sedan in via formuläret och klickar vidare till samma bokningsdetalj innan städning.

Provet går via två processer och riktiga HTTP-anrop. Databasåtkomsten i provkoordinatorn används
för operatörens syntetiska mandat, nycklar och städning. Gatewayens bokningsväg har ingen sådan åtkomst.
Att en utvecklare kan köra detta lokalt verifierar varken en molndeployment, ChatGPT i en slutanvändares
konto, en extern bokningsleverantör eller pilotdrift.

## Kontroll vid konfigurationsdrift

Access-svaret innehåller `providerMode`. Salongen ger `split` först efter
agentRoute-kontrollen av både tjänstenyckel och agentnyckel. Det äldre samlade
körläget anger `standalone`. Gatewayen kräver `apiVersion: "v1"`,
`providerMode: "split"` och en scopes-array i ett lyckat access-svar inför varje
operation, inklusive REST-status och skrivningar. Bekräftelsen cachelagras inte
mellan anrop. Saknad eller felaktig bekräftelse ger 503
`provider_configuration_invalid` före den begärda operationen. 401/403 från
autentiseringen behåller sina statuskoder. Uppgradera båda servrarna tillsammans.

Detta upptäcker att fel körläge används vid gatewayens kontroll. En salong som
startas avsiktligt i det äldre samlade läget behåller sin tidigare direkta API-
åtkomst. Discovery är fortsatt åtkomlig. Körningen är ännu en lokal syntetisk POC.

Regression mot verklig felkonfiguration: starta en extra salong utan båda split-
inställningarna och en extra gateway som pekar på den. Med en ny separat lokal
testdatabas och tillfälliga processhemligheter, sätt AGENTPROV_SALON_URL till
den extra salongen och AGENTPROV_BASE_URL till dess gateway. Kör
`node --import tsx scripts/agentprov/check-provider-mode.mts`.
Det verifierar giltig agentnyckel, standalone-besked, nio nekade gatewayoperationer
och oförändrat bokningsantal. Provet städar sin egen klient/nyckel. Den
append-only revisionshistoriken följer befintliga lagringsregler.
