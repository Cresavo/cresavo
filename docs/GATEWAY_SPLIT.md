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
behöver bara `SALON_ORIGIN` och `PORT`. Kör Node 24.

1. I salongens repo: `npm ci`, `npx playwright install chromium`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run build`.
2. I salongsterminalen: sätt `PORT=3217`, `BOOKING_SERVICE_ROLE=salon`,
   `BOOKING_PUBLIC_ORIGIN=http://127.0.0.1:3218`. Starta med `npm start`.
3. I gatewayens repo: `npm ci`. Sätt `SALON_ORIGIN=http://127.0.0.1:3217`, `PORT=3218`, kör `npm start`.
4. I salongens provterminal: sätt `AGENTPROV_BASE_URL=http://127.0.0.1:3218`,
   `AGENTPROV_SALON_URL=http://127.0.0.1:3217` och kör `npm run agent:proof` mot samma test-DB som salongen.
5. Förvänta nio PASS-rader inklusive `SEPARATE_SALON_AUTHENTICATED_CALENDAR` och
   `TWO_TRANSPORTS_ONE_WINNER_ONE_CONTROLLED_CONFLICT`. Provet skapar egna syntetiska aktörer
   och kontrollerar en länk till exakt rätt boknings-id i salongens inloggade kalender. En separat
   Chromium-session loggar sedan in via formuläret och klickar vidare till samma bokningsdetalj innan städning.

Provet går via två processer och riktiga HTTP-anrop. Databasåtkomsten i provkoordinatorn används
för operatörens syntetiska mandat, nycklar och städning. Gatewayens bokningsväg har ingen sådan åtkomst.
Att en utvecklare kan köra detta lokalt verifierar varken en molndeployment, ChatGPT i en slutanvändares
konto, en extern bokningsleverantör eller pilotdrift.
