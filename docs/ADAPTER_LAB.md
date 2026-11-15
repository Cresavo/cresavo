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
