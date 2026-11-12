# Arkitektur

## Epic 02: lokal MCP-skrivning

create_booking är ett separat opt-in-verktyg: --admin och --allow-bookings krävs tillsammans med kvotens befintliga SESSION_SECRET. Det strikta schemat återanvänder bokningens fält och idempotensnyckelregel; confirmed=true och example.test är extra POC-begränsningar. Bekräftelsefältet bevisar inte mänskligt samtycke. Endast betrodda lokala processer får starta läget.

Verktyget går via createBooking med den fasta serverägda kanalkontexten mcp:local-booking-channel:v1. Det använder samma HMAC, 5/kanal/skapandedag, 3/e-post/skapandedag, låsordning, idempotensnamnrymd och exclusion som HTTP. Ingen klientstyrd identitet tillåts; processomstart återställer inte DB-taket. HTTP:s statuskoder och payload är oförändrade. Svar projiceras uttryckligen till id/serviceId/startsAt/endsAt; inga kundfält eller lagringshashar skickas tillbaka.

Testklientens separata --admin --book-läge visar en syntetisk sammanfattning och kräver ja; nej/EOF gör ingen skrivning. Föräldern läser lokal .env. Subprocessen startas utan Node --env-file och mcpEnvironment exporterar SESSION_SECRET endast för uttryckligt bokningsläge, aldrig ADMIN_PASSWORD eller hela föräldramiljön. **Det är inte miljöisolering:** Prisma 6 kan automatiskt läsa projektets .env vid import och därmed ändå göra dess hemligheter tillgängliga i subprocessen. En annan cwd är inte i sig bevis för isolering från genererade Prisma-konfigurationssökvägar. Separat minimal konfiguration och riktig processisolering måste utredas före externa agenter/pilot. Detta befintliga beteende dokumenteras som E02-QA-2; ingen Prisma-uppgradering görs här.

Det nya bokningsverktyget använder SDK:s publika StandardSchemaWithJSON-gränssnitt för att återanvända exakt samma strikta JSON-schema och validera före callbacken. Ogiltig indata går via safeFailure och kastar enbart dess statiska text, som SDK 2.4 omvandlar till isError. Inga privata SDK-metoder eller transporthandlers skrivs om. Äldre verktygs SDK-felkontrakt ändras inte. Regressionen kontrollerar både publicerat schema och exakt statisk feltext över verklig stdio. Se [SDK:s schemadokumentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/advanced/schema-libraries.md).

Ingen publik MCP, ny tabell, migration eller dependency har införts. Ingen garanti om pilot, tenant-isolering eller externa agentmottagare följer av detta.

## Uppföljning M2/L8 efter 8b83a40

createBooking tar nu ett transaktionsbundet advisory lock per verksamhet/anställd/bokningsdag före tillgänglighetsläsning och insert. Fast ordning: idempotensnyckel → klient/skapandedag → e-post/skapandedag → anställd/bokningsdag. Samma anställds bokningsförsök för en dag serialiseras även om tiderna inte överlappar; andra dagar får andra nycklar. Befintlig exclusion constraint och alla tre migrationer är orörda. Bokningsdag tolkas i Europe/Stockholm. Dagens öppettider tillåter inte behandlingar över midnatt; sådant framtida stöd kräver en ny bedömning av låsningen. Direkta interna DB-writes måste fortfarande följa skrivkontraktet eller hantera databasfel själva.

insertBooking mappar strukturerade P2010/meta.code 23P01 (exclusion), 40P01 (deadlock) och 40001 (serialiseringskonflikt) till det befintliga domänfelet ”Tiden är inte tillgänglig”. Övriga fel förblir oväntade fel. Ingen automatisk retry eller ny API-status införs. [PostgreSQL om lås och deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html).

Varje IPv6-proxysubnät provas i en separat Node BlockList. Subnät som även matchar IPv4-ändpunkterna nekas; en tidigare tillåten IPv4-proxy får inte påverka kandidatkontrollen. Därmed avvisas bland annat ::/32, ::/64 och ::/80. [Node BlockList](https://nodejs.org/api/net.html#class-netblocklist).

CI använder fyra isolerade jobb via mode=dev/production × proxy=0/1. Varje jobb bygger och kör E2E mot egen runner/databas. Lint/unit/integration körs i dev/0, audit är separat. [GitHub matrix](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations). Konfiguration är inte bevis för grön extern körning; ingen push görs i denna uppföljning.

## Aktuellt beslut efter QA batch 3

Detta ersätter batch 2:s felaktiga beslut att kontrollera lösenord före spärren. Login reserverar ett försök synkront före lösenordsjämförelse. Efter fem fel nekas även rätt lösenord tills fönstret löpt ut; andra klientnycklar påverkas inte. Fel och spärrade svar väntar minst 100 ms asynkront. Lyckade försök återför sin reservation. Detta stoppar även samtidiga försök från att passera kontrollen innan räknaren uppdaterats. Räknaren är fortsatt processlokal och kapacitetsbegränsad, inte ett pilotsäkert distribuerat skydd.

Betrodd proxy kontrolleras mot rå normaliserad socketadress; gränsernas klientnyckel är IPv4 eller IPv6-/64. Identiteten härleds först efter att intern HMAC verifierats. Bokningens befintliga HMAC använder samma nyckel. Ingen migration eller omskrivning av historiska IPv6-nycklar görs. Felkonfigurerad forwarding ger en enda statisk varning per process. /0 och för breda proxy-CIDR avvisas. README beskriver driftmatrisen.

Lyckad login gallrar högst 100 utgångna/återkallade sessionsrader via begränsad select och delete med samma kriterier. Ingen tidsstyrd bakgrundsgallring finns. Versionsnumret får endast höjas; sänkning kan återaktivera äldre giltiga rader/cookies. E2E-fixturer spårar sina egna sessionshashar och städar dem med separat teardown-budget, även vid avsiktlig timeout. Test-/demovakten avvisar host/hostaddr-parametrar före dataåtkomst.

## Aktuellt beslut efter QA batch 2 — a84e48a

Följande ersätter äldre beskrivningar av global bucket och browserlogout nedan. Historiska resonemang bevaras som bakgrund.

- `npm run dev/start` använder `scripts/server.mjs`, en liten Node-startpunkt runt samma Next-app. Den läser socket.remoteAddress och skriver över signerade interna adressheaders; routes verifierar dem. Rått `next dev/start` är inte en stödd startväg. Produktionsläget använder kompilerad Next med dev:false. Nexts route-objekt saknar socketadressen; ingen extra tjänst eller dependency tillkommer. Standalone/serverless kan inte antas fungera med denna startpunkt.
- Standardläget ignorerar forwarding. Proxyläge kräver TRUSTED_PROXY_IPS (IP/CIDR) och kontrollerar verklig socket innan X-Real-IP används. Saknad/ogiltig lista stoppar starten. Implementationen använder Node net.BlockList. Se [Next custom server](https://nextjs.org/docs/app/guides/custom-server) och [Node BlockList](https://nodejs.org/api/net.html#class-netblocklist).
- Misslyckade login får progressiv asynkron fördröjning 100–500 ms och sjätte felet ger 429. Korrekt lösenord nekas inte på grund av andras fel. Vid 10 000 buckets evikteras äldsta posten. Ingen tvärprocessgaranti eller verifierad driftsproxy/TLS påstås.
- Nya bokningar har transaktionssäkrat tak: fem per klientadress/Stockholmsdag och tre per e-postnyckel/dag. Låsordning är idempotensnyckel, klient/dag, e-post/dag. Lyckad idempotent replay förbrukar ingen budget. clientKey är HMAC av IP med SESSION_SECRET; emailCapKey är gemener utan +tagg. Kontaktadressen behåller taggen. NAT delar taket; ny signeringsnyckel ändrar även adressnycklar. Detta är heuristiker, inte identitetsverifiering eller anonymisering.
- HTTP skickar verifierad klientadress till createBooking. Betrodda direkta domäntester kan sakna nätklient; framtida externa adaptrar måste skicka verifierad klientkontext. Ingen alternativ publik bokningsväg tillkommer. Exclusion constraint är oförändrad.
- Ny migration 20261111020000_sessions_client_caps tillför klient-/e-postnycklar, index, e-postbackfill och AdminSession. Båda tidigare migrationerna är orörda. Historiska rader utan clientKey räknas inte retroaktivt mot IP-taket.
- AdminSession lagrar tokenhash samt createdAt/expiresAt/revokedAt. Varje kontroll kräver aktiv rad och signerad cookie. Logout återkallar raden innan cookien raderas; kopierade cookies nekas. ADMIN_SESSION_VERSION fungerar fortsatt globalt. Gamla cookies är inkompatibla. Databasfel stänger åtkomst med statisk fellogg. Individuella konton och sessionsgallring saknas.
- UI återanvänder UUID för samma payload vid retry/dubbelsubmit, men inte efter sidomladdning. Datumfält är validerade textfält YYYY-MM-DD och logout ligger i sidhuvudet. Ogiltiga datumfilter ger statisk text och standardintervall utan fellogg. Punkt 6 är undantagen: e-post förblir maskerad.
- Kampanjer har olika meddelanden för omvända datum och mer än 90 dagar. 100 % rabatt tillåts uttryckligen som information i POC:n; ingen debitering sker.
- MCP-klienter skickar en liten explicit miljölista med DATABASE_URL, utan adminlösenord/sessionshemlighet. Endast lokal stdio, inga nya fjärrbehörigheter.

Aktuella verifieringar finns överst i [VERIFICATION](VERIFICATION.md). POC:n är inte kundklar: audit, konton, datalivscykel, TLS/proxy, backup och tenant-isolering återstår. CSP unsafe-inline och obegränsad kampanjlista är oförändrade.

## Bakgrund före QA batch 2

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
