# Adapterlabb, paket C

Aktuellt: `demo` är alltid native. Endast syntetiska `lab-partner` kan väljas
via det betrodda in-process-registret nedan. Paket A/B beskrivs som historik.

## Paket A (historik)

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


## Paket C: verksamhetsval och gemensamma auktoritetsregler

Starta `startMockPartnerServer({ port: 0 })`, skapa adaptern med dess `baseUrl`
och anropa `registerLabBookingProvider("lab-partner", provider)` i samma process
som gatewayen. Avsluta servern och kör `clearLabBookingProviders()` efter provet.
Registreringen accepterar bara `lab-partner` och `mock-partner`, aldrig `demo`.
Ingen miljöfil eller nätverkskonfiguration behövs. Katalog, tillgänglighet,
förslag, bokningssnapshot, hämtning och avbokning väljer verksamhetens provider.
Native behåller sina transaktionshookar och publika kontrakt.

API-nycklar skapas för `lab-partner` med befintlig lokal operatörsfunktion.
OAuth använder samma labbflöde och scopes som tidigare. Betrodd test-/operatörskod
kan före första autentisering anropa `registerLabOAuthBusiness(clientId,
"lab-partner")` från `oauth/lab-business.ts`; `clientId` är det verifierade
OAuth-klient-id:t. Registrerings-JSON och tokenindata får inte välja verksamhet.
Utan bindning kvarstår demo. `clearLabOAuthBusinesses()` återställer registret;
en redan lagrad klient kan inte byta verksamhet genom ombindning.

Kundflödet är förslag → engångslänk → kundens Ja → mandat → bokning.
Agentautentiserad POST får inte fatta kundbeslut. Detta är fortfarande det
syntetiska samtyckeslabbet; länkleveransen bevisar ingen verklig kundidentitet.
Gatewayen kontrollerar write-scope, confirmed, syntetisk kontakt, aktuell klient,
mandatets lagrade verksamhet/plats/schema/tid/pris och oförändrat godkänt förslag
innan provider-create. Ägarskapslänken kontrolleras före get/cancel; read- respektive
write-scope krävs. Audit accepterar endast demo/lab-partner och samma redigerade
fält som tidigare; `readAudit({ businessId: "lab-partner", ... })` är operatörsläsning.

### Länkar och migration

Migration `20261115190000_partner_booking_links` behövs före körning, även på
befintliga separata testdatabaser: kör `prisma migrate deploy` med explicit
lokal testkonfiguration som inte laddar någon miljöfil. Migrationen har inte
körts i denna sandlåda. Prisma Client måste genereras efter schemaändringen.

`AgentBooking.bookingId` behålls som global ägarskapsnyckel och mandat-id förblir
unikt. Ny valfri `nativeBookingId` backfylls för alla befintliga länkar och bär
samma sammansatta FK till Booking. En CHECK kräver native-referens lika med
bookingId för alla verksamheter utom lab-partner; lab-partner måste sakna den.
Ingen partnerbokning skrivs till Booking, Service eller Staff. Historiska
migrationer och native-integritetsregler består.

### Okänt utfall och återhämtning

Före partneranropet sparas `PartnerBookingAttempt` med unikt mandat och scoped
idempotensnyckel, klient, verksamhet, provider och hash av den validerade kroppen.
Ingen kontaktuppgift lagras där. Mandatradlås serialiserar kontrollen; ingen
skapandetransaktion hålls öppen över HTTP. Ett okänt utfall får inte frigöra
mandatet eller byta nyckel/kropp. Samma nyckel och kropp är enda säkra omförsöket.
En uttrycklig `slot_unavailable` lämnar ingen AgentBooking/mandate.consumed och
frigör försöksbindningen. Mandatet kan då användas för en annan tid inom sitt
ursprungliga scope; kundens exakta tidsmandat får aldrig vidgas.

Om partnern accepterar men gatewayen avbryts före sparad länk/audit, ligger
försöksbindningen kvar. Ett identiskt omförsök med fortsatt giltig auktoritet
hämtar samma partnerbokning via partnerns idempotens och samma interna id.
Gatewayen sparar AgentBooking, mandate.consumed och booking.created atomärt i
en lokal transaktion. Ett ytterligare omförsök återger ägarens befintliga länk;
inga extra mandat eller bokningar skapas. Timeout betyder okänt utfall, aldrig
att bokningen saknas. Utgången/återkallad auktoritet stoppas även vid olöst försök;
automatisk avstämning efter detta ingår inte.

Detta gäller inom samma adapter-/fejkserverinstans. Paket B:s id-mappning och
partnerns bokningar finns fortfarande i processminne. Processomstart, byte av
adapterinstans, verklig partnerpersistens och generell distribuerad transaktion
är inte lösta i detta paket. Återregistrera inte en ny instans för gamla försök.
Ingen betalning eller riktig partnerintegration ingår.

### Nya prov

`tests/lab-provider-selection.test.ts` provar val och clearing utan lyssnare.
`tests/integration/mock-partner-gateway.test.ts` har åtta prov, inklusive två
hela E2E-flöden med API-nyckel respektive OAuth, kundens HTTP-Ja, providerkatalog,
bokning/hämtning/avbokning, scope, audit, BOLA, samtidiga krockar och två former
av avbrottsläkning. Fejkservern använder 127.0.0.1 port 0; egna databasrader städas.
Testerna kräver befintlig loopback-DB-vakt och migrerad separat *_test/*_demo-DB.
Full integration, webpack-build, agent:proof och native-proben ska verifieras
utanför sandlådan; denna dokumentation utgör inget PASS för dem.
