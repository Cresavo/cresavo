# Adapterlabb, paket A

`src/lib/agent-api/provider/types.ts` definierar BookingProvider: katalog med
resurser, tillgänglighet med tidszon, hold, skapa, hämta och avboka.
`getBookingProvider()` väljer alltid native. Ingen extern konfiguration finns.
Native använder den befintliga motorn och samma databaslogik för hämtning och
avbokning. Hold stöds inte och ger ProviderUnsupportedError.

Gatewayen behåller publika JSON-projektioner, scopes, ägarskapskontroll,
mandat, samtycke och audit. Native tar dessutom emot interna transaktionshookar:
skapandets authorize/beforeInsert/booked skickas oförändrade till createBooking.
Credentialkontrollen vid avbokning körs efter konfigurationslåset i samma
transaktion som bokningslåset, uppdateringen och BookingEvent.
Hookarna är inte del av det generiska providerkontraktet. En framtida extern
provider kräver separat arbete kring mandat och återhämtning av okända utfall.

Inga ändringar av webb/admin/stdio-MCP, migrationer eller betalning ingår.

## Paket B: lokal mock-partner

`provider/mock-partner-server.ts` exporterar `startMockPartnerServer({ port,
latencyMs })` med `baseUrl`, `port`, `state` och asynkron `close`. Standardport
0 väljs av OS; bindning är alltid 127.0.0.1. Port 3219 och 3220 avvisas.
Servern har endast processminne, syntetisk katalog, egna POS-id:n, bokningar,
idempotens och överlappskontroll. Ingen Prisma eller persistens används.

Det interna JSON-kontraktet är POST `/rpc` med `operation`: `catalog`,
`availability` (sku/worker/day), `create` (sku/worker/revision/localStart,
email/name/key), `get` eller `cancel` (reference). Svaret är `{ data }` eller
`{ fault, detail }`. Tider är lokala i America/New_York; katalogpriset anges
i ören. `state.fault` kan sättas för felprov. Latens är 0–1000 ms, standard 0.

`createMockPartnerProvider({ baseUrl })` i `provider/mock-partner.ts` skapas
explicit. Den godtar endast HTTP med 127.0.0.1/localhost och kopplar direkt
till IPv4-loopback utan DNS, proxy eller redirects. Servern gör inga HTTP-anrop.
Ingen trafik lämnar loopback och ingen extern integration ingår.

Adaptern mappar provider/instans/typ/externt-id till opaka interna UUID:n;
varje instans har separat minne. Samma partnerbokning behåller internt id
inom instansen, även vid replay. Omstart kräver ny mappning; beständig
återhämtning ingår inte. Partnerns väggtider blir ISO med New York-offset
och bokningsfält blir Date-instanter. Mandat jämför fortsatt absolut tid.
Partnerfel blir fasta AgentApiError-meddelanden; okända fel loggar endast
MOCK_PARTNER_INTERNAL_ERROR. Transporten har 1500 ms inaktivitetstimeout och
storleksgräns. Timeout kan innebära okänt skapandeutfall: återanvänd samma
nyckel och kropp. Hold stöds inte.

`getBookingProvider()` returnerar fortfarande alltid native. Gateway,
salongsval, mandat-/auditkoppling och E2E via mock ingår först i ett separat
paket C. Befintliga native-tester och publika kontrakt är oförändrade.
