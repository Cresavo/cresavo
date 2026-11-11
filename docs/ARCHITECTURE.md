# Arkitektur

En Next.js-process exponerar publika HTTP-endpoints och ett separat administrativt gränssnitt. MCP körs lokalt över stdio som en egen process, aldrig som publik nätverksserver. Båda anropar samma serverdomän. PostgreSQL är den gemensamma sanningen. En verksamhetsnyckel finns i domänens data och frågor, men en enda demosalong är konfigurerad: detta är inte tenant-isolering eller en flerföretagslösning.

Tider lagras som UTC-instanter; öppettider och datum tolkas i Europe/Stockholm. Halvöppna tidsintervall och PostgreSQL exclusion constraint (`btree_gist`) förhindrar överlapp för samma anställd även vid samtidiga transaktioner. Domänen kontrollerar tjänst, öppettider, tidssteg och indata på servern; databasen är sista skyddet. Priser lagras som heltal i ören. Kampanjer är utkast tills en administratör publicerar dem.

Administrationen använder ett lokalt konfigurerat lösenord och en tidsbegränsad signerad HttpOnly-cookie, med origin-kontroll på muterande HTTP-anrop. MCP-verktyg för bokningar och utkast kräver att den betrodda lokala operatören uttryckligen startar processen i adminläge. Det är inte autentisering för fjärråtkomst. Ingen OAuth, publik MCP, meddelandehantering eller betalning ingår.

MCP:s `list_bookings` kräver ett inklusive datumintervall i Europe/Stockholm (max 31 dagar), har 20 som standard och max 100 per sida och lämnar inte ut kundnamn/e-post. Paginering använder boknings-ID som sidmarkör och sorterar efter starttid och ID; den är inte en transaktionssnapshot. Webbadmin använder samma avgränsade frågebyggare: standard idag till idag+14 dagar, max 31 dagar och max 100/sida, maskerad e-post. MCP-administratör är endast ett lokalt betrott processläge.

## Foundation Hardening: fel och lokal session

`errors.ts` tillåter en liten lista statiska domänmeddelanden. Zod/JSON-fel ger generisk 400; oväntade fel ger generisk 500 och statisk loggkod utan stack, cause eller metadata. Samma klassificering används i HTTP och MCP. SSR sanerar endast dataladdning, inte ramverkets kontrollflöde. MCP-SDK:s egen schemavalidering före callback kan spegla klientindata; SDK-internaler ändras inte. Processstart, tredjeparts- och databas/proxyloggar omfattas inte av någon total saneringsgaranti.

Sessionscookien kräver exakt utgångstid/signaturformat och högst åtta timmars återstående livslängd. Fel format, utgången/manipulerad session eller roterad signeringsnyckel avvisas. Lösenordsjämförelse begränsas till 1024 tecken. Global ADMIN_SESSION_VERSION ingår nu i signeringen; versionshöjning och omstart återkallar alla gamla cookies. Browserlogout och processlokalt gissningsskydd finns, men ersätter inte individuell identitet eller individuell återkallelse.

## Konkret plan före pilot och flera verksamheter

1. Inför individuella administratörer med stabilt user-ID och verksamhetsmedlemskap/roll. Besluta en underhållen autentiseringslösning i separat förändring, efter licens-/säkerhetsbedömning. Ingen egen OAuth-plattform. Testa inaktiverad användare, fel roll och borttaget medlemskap.
2. Inför slumpmässiga återkallbara serversessioner, in-/utloggning och rotation vid autentisering, timeout och spärrade konton. Endast hash av sessionstoken lagras. Behåll HttpOnly/SameSite/Secure och testa återkallelse samt att lösenordsändring stänger gamla sessioner. Begränsa inloggningsförsök och publika bokningsanrop vid faktisk driftgräns; processlokal räknare räcker inte för flera processer.
3. Fastställ konfigurerad tillåten origin och betrodda proxies/TLS innan publik drift. Nuvarande Origin/Host-kontroll jämför inte protokoll och är en lokal POC-kontroll. Sätt/verifiera privat no-store för administrativa svar i hela proxykedjan.
4. Härled businessId från autentiserat medlemskap på servern. För publika bokningar behövs separat verifierad salongskontext. Kräv kontext för alla läsningar/skrivningar, cache och agentverktyg; klientens ID får inte ge behörighet. Lokal --admin övergår inte automatiskt till fjärrautentisering.
5. Ny migration (ändra aldrig historisk migration) ska säkra verksamhetskopplade relationer, exempelvis sammansatt service/business-nyckel för Booking och Campaign. Testa korsverksamhetsläsning, skrivning, cursor, kampanjpublicering och direkta felaktiga relationer. RLS är ett separat beslut, ingen nödvändig POC-infrastruktur.

## Begränsad skalbarhetskontroll

Tillgänglighet läser nu endast start/slut, aldrig kundnamn/e-post. Exclusion constraint per verksamhet/personal och halvöppna intervall är oförändrade. Integrationstestet gör även två samtidiga direkta inserts och provar att angränsande intervall tillåts.

Kampanjlistan är fortfarande obegränsad; webbadmin har nu max 100/sida och datumintervall: planera avgränsning före verklig större datamängd. MCP har max 101 hämtade rader inklusive nästa-sidaindikator. Inget B-tree-index finns för `(businessId, startsAt, id)`; mät med realistisk syntetisk volym och `EXPLAIN (ANALYZE, BUFFERS)` före en ny indexmigration. GiST-spärren är inte bevis för att scalar-tidsfrågorna är optimerade. En dubblerad tjänsteläsning vid bokning lämnas tills en tydlig förbättring motiveras.

Prisma-klienten återanvänds i webbprocessen; varje MCP-process har egen pool. Bestäm anslutningsbudget = antal webb-/MCP-processer gånger poolstorlek plus driftmarginal före skalning. Ingen Redis, extern pooler, mikrotjänst eller spekulativ optimering tillkommer. Inga övergivna spårade experiment eller ytterligare säkert borttagbara beroenden identifierades. Fler UI-nätverksfel kan förbättras separat. Enradiga TypeScript-filer har formaterats med extern Prettier utan nytt projektberoende.

## QA-batch: transaktioner och datakontrakt

`createBooking` är skrivgränsen. En transaktion låser först valfri verksamhets-/idempotensnyckel, returnerar befintligt resultat vid samma SHA-256 av normaliserad payload eller 409 vid skillnad. Därefter låses verksamhet/e-post/Stockholmsdag och skapade rader räknas (max 3). Tjänst och tillgänglighet läses med samma transaktionsklient; detta undviker extra poolanslutningar under samtidighet. PostgreSQL:s oförändrade exclusion constraint är sista överlappsskyddet.

Prisma6 ORM-create returnerar UnknownRequestError för exclusion; därför använder en liten betrodd insertBooking-hjälpare parameteriserad INSERT RETURNING via Prisma. Det ger strukturerat P2010 med meta.code23P01 och säker mappning till DomainError400. Hjälparen är för intern lagring/tester, aldrig en alternativ publik väg förbi createBooking. ID genereras som UUID; API behandlar ID som opak sträng. Inga SQL-strängar byggs från klientdata.

Ny migration tillför createdAt, unik businessId/idempotencyKey, requestHash, e-post/datumindex och CHECK för kampanjdatum. Historisk migration och exclusion är orörda. RequestHash är inte anonymisering; ingen automatisk gallring av nycklar finns. Gamla rader får migrationstid för createdAt. Migrationen kräver att eventuella befintliga kampanjdatum redan är korrekta; inga data repareras automatiskt.

Per-IP/rutt-spärren är en begränsad processlokal Map (högst 10000 buckets,15 min). Betrodd X-Real-IP aktiveras endast uttryckligen; annars delar klienter en bucket. Flera processer kräver en annan verifierad driftgräns. Cookieversionen är serverkonfiguration, inte en ny sessionsdatabas. CSP tillåter inline-script för Next; ingen nonce-mekanism tillförs.

Kampanjer syns publikt endast inom dagens inkluderande Stockholmsintervall, max 90 kalenderdagar. Adminbokningslistan och MCP delar validering/cursor men olika fältprojektioner. UI, HTTP och lokal MCP behåller gemensamma domänregler.
