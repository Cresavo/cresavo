# Arkitektur

En Next.js-process exponerar publika HTTP-endpoints och ett separat administrativt gränssnitt. MCP körs lokalt över stdio som en egen process, aldrig som publik nätverksserver. Båda anropar samma serverdomän. PostgreSQL är den gemensamma sanningen. En verksamhetsnyckel finns i domänens data och frågor, men en enda demosalong är konfigurerad: detta är inte tenant-isolering eller en flerföretagslösning.

Tider lagras som UTC-instanter; öppettider och datum tolkas i Europe/Stockholm. Halvöppna tidsintervall och PostgreSQL exclusion constraint (`btree_gist`) förhindrar överlapp för samma anställd även vid samtidiga transaktioner. Domänen kontrollerar tjänst, öppettider, tidssteg och indata på servern; databasen är sista skyddet. Priser lagras som heltal i ören. Kampanjer är utkast tills en administratör publicerar dem.

Administrationen använder ett lokalt konfigurerat lösenord och en tidsbegränsad signerad HttpOnly-cookie, med origin-kontroll på muterande HTTP-anrop. MCP-verktyg för bokningar och utkast kräver att den betrodda lokala operatören uttryckligen startar processen i adminläge. Det är inte autentisering för fjärråtkomst. Ingen OAuth, publik MCP, meddelandehantering eller betalning ingår.

MCP:s `list_bookings` kräver ett inklusive datumintervall i Europe/Stockholm (max 31 dagar), har 20 som standard och max 100 per sida och lämnar inte ut kundnamn/e-post. Paginering använder boknings-ID som sidmarkör och sorterar efter starttid och ID; den är inte en transaktionssnapshot. Webbadmin använder fortsatt sin egen oförändrade listvy. MCP-administratör är endast ett lokalt betrott processläge.
