# Arkitektur

## Beständig lokal kortbokning och ägarens arbetsdag

Godkänt scope: AGENT_BOOKING_WORKDAY_PLAN.md. Den nya additiva tionde
migrationen skapar CardBookingAttempt. Den innehåller businessId, serverhärlett
HMAC-scope, UUID, strikt syntetiskt tjänste-/tidsval, outcome och createdAt.
Inga kontaktfält. Ett partiellt unikt index tillåter bara ett pending-försök
per kanal. Admission serialiseras och släpper sitt eget lås före createBooking;
motorns historiska låsordning/exclusion/kvoter är oförändrade. Sparat försök
kommer före domänskrivning. Både domänbokning och separat slutförandemarkering
kan ha hunnit sparas när svaret tappas; återläsning kontrollerar alltid Booking.

Återläsning kräver samma befintliga opt-in/flaggar/privata SQL-profil/secret som
skrivningen. Scope väljs aldrig av klienten. Booking-uppslag kräver kanalens
serverhärledda clientKey och time-card_-namespace. Även replay med känd nyckel
nekas om den tillhör annan kanal. Det är EN lokal demokanals behörighet, inte
personliga kundkonton eller fjärrautentisering. De senaste20försöken och ett
eventuellt pending-försök visas; inget raderas automatiskt. Bytt secret gör den
gamla kanalen otillgänglig. Behåll befintliga profiler; rotera inte för sessionkill.

UI frågar servern vid omöppning och skapar aldrig automatiskt en bokning.
Okänt försök kräver uttrycklig retry med samma beständiga nyckel/payload.
Aktuellt kvitto läses från Booking; tidigare createBooking-replay behåller sitt
kontrakt med ursprungliga tider. Säkerhetsmarkörer VERCEL* och NOW_REGION nekas
nu både i launcher och kortserver. Resource-v3; äldre alias bevaras.

Kalenderfil hämtas bara för aktiv egen demobokning. UTC-instanter representerar
Stockholmstiden även över DST; DTEND använder duration utan buffer. Stabil UID,
SEQUENCE, escaped text och UTF8-radvikning följer RFC5545. Blobnedladdning kräver
värdens stöd; en nedladdad fil är inte en lyckad import och synkas inte senare.
Ingen kalenderinloggning, ATTENDEE, utskick eller extern nättrafik läggs till.

Ägarkortet är separat: src/mcp/server.ts --admin --workday-card, explicit lokal
opt-in och giltig secret. Exakt ett läsverktyg show_workday, inget normalt admin-
eller skrivverktyg i denna profil. listCalendar (20/sida), listStaff, listServices,
getAvailability och listCapacity återanvänds. Kontaktfält som kalenderfunktionen
använder internt projiceras bort. Nästa besök beräknas oberoende av sidmarkör.
Lediga tider avser uttryckligen vald medarbetare/behandling, högst12visas;
kapacitetsdelen beskriver högst3källor och länkar till hela översikten.
Loopback-länkar öppnar vanlig skyddad admin, inga sessionshemligheter i URL.

Källor: https://www.rfc-editor.org/rfc/rfc5545.html och
https://developers.openai.com/plugins/build/chatgpt-ui (kontrollerade2026-11-13).
Vanlig hostspecifik widgetState behövs inte; serverloggen överlever kort/process.

## Opt-in: lokalt bokningsprov från MCP-kort, 2026-11-13

`MCP_CARD_BOOKING_PLAN.md` utökar läsprovet utan ändring av vanlig MCP-server,
domänmotor eller schema. Standardprofilen behåller två läsverktyg och läsroll.
Separat env-opt-in + båda befintliga bokningsflaggor + SESSION_SECRET krävs
för `book_demo_time`. Production, VERCEL/VERCEL_ENV/VERCEL_URL och workspaceflaggor nekas. Åtta
andra ensamma plattformsmarkörer nekas inte (CB-QA-2 Low-backlogg).
Launcher skickar hemligheten bara i opt-in, aldrig i HTML/payload eller paket.

Strikt schema: tids-/tjänsteversion, UUID och confirmed:true. Servern sätter
fast syntetisk kontakt, använder samma MCP_BOOKING_CLIENT och createBooking,
med `time-card_`-prefix på befintlig idempotensnyckel. Ingen adminbudget;
5/kanal,3/e-post/dag består. Samma transaktion skriver bokning och händelse.
Svaret har id/tider/tjänstesnapshot utan kontakter, kvotnycklar eller session.

UI behåller samma payload/nyckel vid okänt skrivutfall och låser nya försök
tills retry ger besked. Definitiva 4xx/konflikter läser om lediga tider och
kräver nytt val/bekräftelse. Tjänsteversion stoppar ändrat pris/längd; replay
går först i motorn. Bokningen syns i ordinarie skyddad admin i samma lokala DB.
UI söker28dagar; skrivverktyget behåller motorns60dagarsregel (CB-QA-1 Low).
Resurs-v2 undviker gammal UI-cache; v1 finns kvar som alias för samma HTML.
App-only metadata och confirmed är inte verifierat mänskligt mandat eller
fjärrautentisering. Tillfälligt tillstånd överlever inte stängt kort: okänt
utfall kontrolleras då i admin före nytt försök. Ingen molnändring.

## Ursprungligt separat lokalt MCP-tidvalskort

src/mcp/time-card/server.ts är en opt-in ingång med bara två läsverktyg.
Den ändrar inte den vanliga MCP-serverns katalog eller ägarens kapacitetsprofil.
Dataadapter använder samma getAvailability och returnerar minimerade resurser,
inte Booking-kontakter. Ett 28dagarsfönster tolkas i Stockholm. Priset är
uttryckligen ordinarie pris; kortet säljer/publicerar inte en kampanj.

MCP Apps-resursen använder standardbryggan, textContent och tom CSP-nätlista;
inga cookies, hemligheter eller extern hämtning. Tidsval är lokal tillfällig UI-
status, inte en bokning eller reservation. Kontroll läser tillgänglighet igen;
byte/stale tömmer valet och modellkontexten när värden stöder detta.

Launcher läser en användarlokal profil utanför paket/Git och skickar endast
explicit nödvändig miljö, ingen SESSION_SECRET. Opt-in/localDB/NODE_ENV=production/
VERCEL_ENV/flagguard före databasfrågor. VERCEL/VERCEL_URL utan VERCEL_ENV
nekas inte i denna version (TC-QA-3 Low). Separat SQL-konto tillåter endast läsning
avService/Staff och6Bookingkolumner, aldrig kontakter eller writes. Detta är
inte OS-isolering, fjärrautentisering eller verifierad flerföretagsdrift.

Metadata/MIME/resurs och faktiska verktygsanrop verifieras separat från
klientens grafiska rendering. Installation på kontot är inte i sig ett
UI-godkännande. Läs MCP_TIME_CARD_PLAN, DEMO och aktuell VERIFICATION.


## Manuell kunddata och avgränsad agentprofil, 2026-11-13

`customer-data.ts` betjänar enbart aktiv webbadministratör. Ett separat POST
`/api/admin/customers/[id]/data` kräver samma origin och strikt action-schema:
export, preview_removal eller remove_contact. Inga nya MCP-kontaktverktyg.
Det valda kortet måste ha example.test-adress och högst1000uttryckligen kopplade
bokningar. Ingen identitetsmatchning via namn/e-post. Exportfil högst100bokningar,
cursor/token för fortsättning och ett statiskt nedladdningsnamn; no-store.

Sällsynta manuella dataåtgärder tar befintligt exklusivt konfigurationslås,
så kund-/bokningsskrivningar som redan använder delat lås inte kan återinföra
kontaktkopior under åtgärden. Förhandsgranskning/token omfattar kortversion
och kopplade bokningsid/versioner/privacystatus. En ändring kräver nytt underlag.
Kommande/pågående confirmed-besök stoppar kontaktborttagning i denna POC.
Det är en teknisk avgränsning, inte ett automatiskt juridiskt rättighetsbeslut.

Kontaktåtgärden använder workspaceWrite: aktiv aktör före replay, stabil
idempotensnyckel, atomär uppdatering och minimal åtgärdslogg. Customer och dess
Booking-kontaktkopior ersätts med fasta markörer. Kortet arkiveras och kan inte
redigeras/återaktiveras; DB CHECK skyddar markörerna när contactRemovedAt satts.
Inga rader raderas. Booking.version för tid/status ändras inte av kontaktåtgärden;
den separata contactRemovedAt visar ändringen. Därmed bevaras avbokningskällans
version och CapacityDecision-koppling. Tider/pris/tjänstesnapshot, events,
requestHash/clientKey och konfliktskydd består. E-postkvotens logiska budget
bevaras; äldre rå emailCapKey omkodas till HMAC vid kontaktåtgärden. Gamla replays
innehåller inga råa kontakter i ledger och kan inte återställa borttagna fält.

CustomerDataAction lagrar verksamhet, kort/aktör-id, action, bokningsantal och
tid. Exportlogg betyder förberett underlag, inte att filöverföring till kund är
bevisad. Varje exportdel kan ge en loggrad; kontaktborttagning/retry ger en enda.
Inga kontaktfält eller kompletta exportpayloads lagras i logg/ledger. Ny migration
är additiv; historiska8orörda. Kontaktborttagning är inte full anonymisering.

MCP:s opt-in `--admin --capacity-only` visar enbart två publika läsverktyg och
två befintliga kapacitetsläsningar. `--allow-workspace` och giltig lokal secret
lägger till exakt dismiss_capacity_suggestion/create_capacity_campaign_draft.
Inga boknings-, personal-, kund- eller fristående kampanjskrivningar i denna
profil. --capacity-only utan --admin eller med --allow-bookings nekas vid start.
Utan den nya flaggan är tidigare katalog/kontrakt oförändrade. Det är fortfarande
betrodd lokal stdio, inte OAuth, fjärrmandat eller full flerföretagsisolering.
Faktisk klientprovning ska skiljas från SDK-test; aktuell plan/status i
CUSTOMER_LIFECYCLE_AGENT_PLAN/PROJECT_STATUS.

Nya icke-adminbokningar lagrar emailCapKey som email-hmac-v1 + HMAC-SHA256
med befintlig SESSION_SECRET och verksamhetsnamespace. Oförändrat e-post/
dagslås använder samma normaliserade adress; kvotfrågan räknar både äldre
råa nycklar och HMAC. Kontaktåtgärden omkodar sina äldre kopplade råa nycklar
atomärt, aldrig tömmer dem eller ändrar createdAt. Ingen global backfill eller
ny migration. Äldre obehandlade rader kan ha rå kvotadress. HMAC är fortfarande
pseudonymiserad data, inte anonym. SESSION_SECRET-rotation har liksom tidigare
konsekvenser för kvot-/klientnycklar; normal sessionsrevokering använder version.

## Proaktiv arbetsöversikt, 2026-11-13

`src/lib/capacity.ts` används av `/admin/overview`, `/api/admin/capacity` och
befintlig lokal MCP. Läsning beräknar på begäran, ingen scheduler eller modell.
Källa är en avbokad Booking med cancel-händelse och oförändrad version. Token
hashar källa/tider och aktuell tjänst-/personalversion. Tillgänglighet kontrolleras
av getAvailability; token ersätter aldrig en ny kontroll före handlingen.

En ny additiv migration inför CapacityDecision och sammansatta verksamhets-FK.
De sju historiska migrationerna och exclusion constraint är oförändrade. Läsning
har gemensamt konfigurationslås; mutationer använder workspaceWrite, aktör före
replay, befintligt personal-/lokaldagslås och sedan källås. Kampanj+beslut sparas
atomärt. Unik businessId/bookingId/sourceVersion skyddar även olika request-ID
och aktörer. En retry av redan utförd handling returnerar originalresultatet;
det är ingen ny kapacitetskontroll eller reservation. Ny listläsning visar aktuell
bokningsbarhet separat från beständigt beslut. Utfallet är beslut/utkast/publicerad
status, inte tillskriven försäljning eller bevis på kampanjeffekt.

POST accepterar calendar/preview/dismiss/draft efter aktiv admin+originkontroll;
de två sista kräver Idempotency-Key. Preview validerar samma kampanjschema och
omfattning som save. Befintlig kampanjmodell är tjänst+datumintervall, inte
utförare eller exklusiv lucka. Utkast reserverar ingen tid och publiceras inte.

Lokala adminverktyg: list_capacity_suggestions och inspect_capacity_suggestion.
Med --allow-workspace tillkommer dismiss_capacity_suggestion och
create_capacity_campaign_draft. Samma betrodda lokala aktör, strikt schema och
minimerade resultat. Defaultservern behåller enbart list_services/get_availability.
Confirmed är ingen verifiering av mänskligt mandat. Ingen publik MCP har införts.

PRO-QA-1: listan har nyckelbaserad paginering på startsAt/id. Varje sida läser
högst limit+1källor, aldrig hela perioden. Cursor måste tillhöra verksamheten,
datumfönstret och avbokningsurvalet. nextCursor är additivt; hasMore och äldre
svarsfält består. API och lokal MCP använder samma schema. UI:s Nästa förslag
behåller fönstret i URL; omladdning och mutationsrefresh stannar på samma sida.
Till första sidan börjar om med dagens standardfönster. Ogiltig markör ger
statisk200-fallback i HTML och400 i API/MCP, inga råa parametrar loggas. Alla
sidor inom fönstret är nåbara även när äldre källor är hanterade/inaktuella.

Avgränsningar: max7lokala dagar/max20källor per sida (UI10), ingen historiksida efter att
källans dag lämnat intervallet. Avfärdanden/utkast lagras ändå och kampanjer finns
i befintlig kampanjvy. Stockholmsdagens staff-lås förutsätter fortfarande att
bokningar inte går över midnatt. Ingen full tenant-isolering eller kundpilot.

## Epic 06 — kundkort och historiska snapshots

Customer är aktuell kontakt (namn/e-post/valfri telefon, version, arkiverad).
Booking.customerId är valfri och har sammansatt FK på businessId/customerId.
Historiska bokningsfält skrivs inte om när kundkortet eller behandlingen ändras.
Ingen automatisk sammanslagning/backfill via namn eller obekräftad e-post.
Gamla bokningar är kvar utan kundlänk tills en uttrycklig regel finns; endast
seedens egna exakta nycklar/syntetiska snapshots får kompletteras av demoseed.
En klientvald seednyckel bevisar aldrig ägarskap. Backfill kräver dessutom
lagrad create-händelse av den särskilda demoaktören, förväntad tjänst och
ursprunglig start. Historisk rånyckel kräver även seedens exakta rad-id;
framtida rad använder adminnamespacad nyckel. Kolliderande publika/manuella
rader lämnas orörda och rapporteras som skipped, inte som befintlig demodata.

Kundläsning och skrivning kräver aktiv serverhärledd arbetsyteaktör inom demo-
verksamheten. Listor hämtar högst50/sida utan kontaktfält; kundkortets historik
högst50/sida. Rå kontakt visas bara för admin i uttryckligen aktiverad/pinnad
Vercel-demo och bara example.test-kort, aldrig för lokal MCP. Alla mutationer
använder befintlig workspaceWrite med actor före replay, idempotens och version.
Arkivering tar inte bort besök och är inte personuppgiftsradering.

Adminbokning kan välja customerId; servern läser aktivt kort under FOR SHARE och
tar snapshot i samma bokningstransaktion. Kontaktvalidering och befintliga kvoter,
konfigurations-/idempotens-/personaldagslås samt exclusion består. Kundredigering
låser bara kundraden, tar inga bokningslås. Rättighets-/konfigurationslåset kommer
alltid först. Retry returnerar ursprunglig bokning före nytt kunduppslag.

Befintlig lokal create_booking får valfritt känt customerId endast med tidigare
--admin --allow-workspace. --allow-bookings ensamt har kvar gammalt strikt schema.
Kanalen behåller kundkvoter, example.test-krav och minimerat svar; inga nya råa
kontaktfält, registerexporter eller publik MCP. Flytt/avbokning behåller länken.

Produktsida /product; kundbokning / och admin /admin består så äldre länkar
fungerar. Samma isolerade skyddade preview och demoknapp används, ingen ny auth.
Assets är lokala statiska filer utan tredjepartsanrop; manifest i public/demo.

## Godkänd Vercel-previewanpassning, 2026-11-12

Separat previewbranch från Epic05-leverans29ac297. Ingen ny produktfunktion.
Dockerfile.vercel väljer Vercels Container Runtime (beta), Node24 och samma
scripts/server.mjs för alla HTML/API/resurser, inte vanlig Next-deploy som går
förbi wrappern. Runtime kräver VERCEL=1, BOOKING_RUNTIME=vercel,
RATE_LIMIT_STORE=postgres och ingen lokal forwarded-proxykonfiguration.
Startup validerar även SESSION_SECRET (minst32tecken), PostgreSQL-URL och valt
rate-store-läge utan att logga värden. Ogiltigt läge stoppar även lokal start.
Vercels dokumenterade överskrivna x-real-ip ersätter socket-peer-listan endast
i detta uttryckliga plattformsläge; wrappern skriver fortfarande över interna
IP/proof-headers och signerar med sin egen processhemlighet. Saknad/ogiltig
plattformsklientadress nekas utan fallback. Self-hosting behåller socketreglerna.
Faktisk plattformsspoofing/TLS måste verifieras före leverans, inte härledas ur
en lokal stub. Vercel Authentication måste vara aktiverat på ALLA deployments
utöver individuell appadmin. Ingen publik MCP.

En ny additiv migration skapar RateLimitBucket. PostgreSQL-läget använder en
egen pool med max1anslutning, separat från domänpoolens5, så att bokningar inte
väntar på en anslutning som de själva håller. Ett kort separat transaktionslås
serialiserar det högst10000rader stora previewlagret. Det tar aldrig domän- eller
kontolås och släpps före lösenordskontroll. Endast route+identitetens HMAC,
slumpmässig fönstergeneration, DB-expiry och räknare lagras. DB-klockan styr15min.
Högst100utgångna rader städas per anrop; vid kapacitet evikteras äldsta raden,
som i minnesläget. Ingen bakgrundsgallring om tjänsten är avstängd.
Refund tar samma korta store-lås som reservation så att samtidiga processers
räknaruppdateringar inte tappar en återbetalning. Generationen skyddar nya fönster.

Slutimagen använder en separat minimal npm-installation, genererad Prisma-klient,
exakt hashkontrollerad Linux x64 GNU Argon2-binding och byggkompilerad Next-config.
CLI/Studio/ELK/sharp/TypeScript ingår inte i runtime. Se DEPENDENCY_REVIEW och
THIRD_PARTY_NOTICES för avgränsad artefaktinventering. Rootförankrade ignore-regler
släpper igenom källmappar men inte hemligheter; tests/preview-files.test.ts testar
filurvalet. Vercels faktiska filinsamlare kontrolleras separat av Grok.

Login reserverar före KDF. Lyckad login och specifikt PasswordCapacityError
återlämnar endast sin egen generation. Andra fel och blockerade klienter
återlämnas inte; blockerad klient kontrollerar aldrig ett lösenord. Misslyckade
svar fördröjs fortfarande minst100ms. DB-fel får ingen minnesfallback.
Bokningsförsök räknas i separat transaktion även om själva bokningen rullas
tillbaka. Identisk replay returnerar före försöksspärren och förbrukar inget.
Kundens/adminens dagstak, låsordning, sessionsregler och exclusion är oförändrade.
Lokal standard är fortsatt memory; Vercel vägrar memory. Ingen ny npm-dependency.

## Epic 05: bokningsarbetsyta, QA-godkänd lokal alpha

Femte migrationen lägger till versionsstyrda tjänster och personal med strikt begränsade veckoperioder, pauser och datumundantag. Undantag ersätter veckoschemat på det datumet. Bokningar lagrar namn/pris/längd/buffert som snapshots. Backfill kan endast återge tjänstens värden vid migrationen, inte återskapa okänt historiskt pris. Ursprungliga start/slut bevaras. Äldre migrationsfiler är oförändrade; den nya migrationen ersätter exclusion atomärt med samma halvöppna intervall för confirmed-rader.

Bokningar får status och version. Flytt och avbokning använder workspaceWrite med aktörskontroll före replay, aktörsbunden request-id och minimal resultatledger. Konfigurationsskrivning tar exclusive konfigurationslås; bokningsmutation tar shared före befintliga idempotens-/kvot-/personallås. Flytt låser gammal och ny personal/dag i sorterad ordning före bokningsraden och kontrollerar versionen igen. Avbokning är en spårbar statusövergång; skapade avbokade rader fortsätter räknas i missbrukskvoter. Ursprungliga snapshots styr ombokningens längd även efter en pris-/tidsändring.

Adminens nya HTTP-endpoints härleder konto och demo-kontext på servern. Alla mutationer kräver samma origin och Idempotency-Key. Behörighet prövas före JSON och replay. Strikta actions create/move/cancel accepterar inte klientvald aktör eller businessId. Läsningar är no-store; kalendern kräver högst 31 dagar och max 100 rader per sida. Cursor kontrolleras mot samma företag/datum/status/personal. Bokningsdetaljer har högst 20 händelser och maskerad kund-e-post.

| UI-handling | Gemensam domän | HTTP | Lokal MCP / verifiering |
| --- | --- | --- | --- |
| Kund/admin skapar bokning | createBooking | POST /api/bookings respektive /api/admin/bookings action=create | create_booking, strikt syntetiskt schema; valfri staffId/serviceVersion; tidigare fyrfältssvar bevarat |
| Lediga tider per utförare | getAvailability / getMoveAvailability | GET /api/availability och /api/admin/bookings/[id]/availability | get_availability med valfri staffId, get_move_availability med bokningens lagrade längd |
| Kalender och detaljer | listCalendar / getBooking | GET /api/admin/bookings, /[id] | list_workspace_bookings / get_booking, minimerade svar utan kundnamn/e-post |
| Flytta / avboka | moveBooking / cancelBooking | POST /api/admin/bookings | move_booking / cancel_booking med version, clientRequestId, confirmed och separat opt-in |
| Tjänst och schema | listServices / listStaff / getStaff / saveService / saveStaff | GET/POST /api/admin/services och /api/admin/staff | list_workspace_services, list_staff, get_staff_schedule, get_staff_configuration; save_service / save_staff |

Kalendern är huvudyta med faktisk tidsskala på dator och kronologiska kort på mobil; tjänster, personal/tider och kampanjer har separata sidor. Formulär bevarar utkast vid nätverksfel och request-id vid samma retry, väntar på serverbekräftelse och varnar före osparad navigering. Datum anges YYYY-MM-DD oberoende av operativsystemets datumväljare; tider och pengar formateras i sv-SE/Stockholm/SEK. Public availability behåller string[] och kundbokning 201{id}. Valfria staffId/serviceVersion får inga schema-defaults som skulle ändra äldre request-hashar. En skickad gammal serviceVersion nekas med 409, men redan genomförd identisk replay bevaras.

### Separata bokningsbudgetar, E05-QA-1

Samma createBooking skiljer en serverägd adminaktör från publik/lokal MCP-kanal. Aktivt demo-konto kontrolleras i transaktionen före replay och privilegierad skrivning. Adminens clientKey är HMAC(admin:<konto-id>), inte klient-IP; samma konto delar budget över IP-adresser.100nya bokningar per Stockholm-skapandedag, med samma serialiserade klient/dag-lås, och separat processlokalt admin-bookings-fönster60/15min. Kunden behåller30försök/15min,5/klient/dag och3/normaliserad e-post/dag. Lokal MCP behåller sina befintliga kanal-/e-posttak; --allow-workspace är inte en adminkontoidentitet.

Adminrader får emailCapKeyNULL så att manuella bokningar inte förbrukar kundens e-postbudget. Rå e-post lagras fortfarande enligt befintligt syntetiskt bokningskontrakt och maskeras/minimeras som tidigare. Ingen ny tabell/migration. Idempotensnamnrymd, serviceVersion, behörighet före replay, konfigurationslås och exclusion består. Admin hoppar över e-postlåset men byter inte ordning på några gemensamma lås. Identisk retry återges före kvotdekrement; avbokade rader räknas fortfarande. Äldre adminrader skrivs inte om och kan påverka äldre kundkvoter till skapandedagens slut.

### Lokala agentkontrakt

Nya läsverktyg kräver betrott lokalt --admin. Nya flytt-/avboknings-/konfigurationsverktyg kräver dessutom --allow-workspace och kvotens befintliga SESSION_SECRET. Äldre --allow-bookings aktiverar fortfarande enbart sin bokningsskrivning, inte arbetsytemutationer. --allow-workspace aktiverar också samma create_booking. Ingen HTTP-transport/port eller extern modell tillkommer; flaggorna är inte fjärrautentisering. SDK:s officiella StandardSchema-gräns behåller JSON-schemat och sanerar valideringsfel före callback; samma safeFailure används för körfel.

list_workspace_bookings kräver datumintervall max31dagar, max100/sida och scope-kontrollerad cursor, valfritt staffId och status confirmed/all. Svarsfält: id,serviceId,staffId,startsAt,endsAt,status,version samt nextCursor; inga kundfält. get_booking ger lagrad behandling/pris/längd/buffert och max20händelser utan kundfält. Boknings-ID/tider/behandling kan fortfarande vara personuppgifter. Äldre list_bookings behåller sin svarstyp men visar endast confirmed och använder bokningens lagrade tjänstenamn, inte det senare ändrade namnet i katalogen. Inga avbokade tider ska framstå som aktiva i äldre klienter.

Resurslistor är begränsade till50tjänster/20personal, samma gränser som konfigurationsskrivning. list_staff lämnar metadata/tjänsttilldelning, inte hela frånvarokonfigurationen. get_staff_schedule läser en persons veckoschema och undantag inom31dagar. För fullständig ersättning av exceptions krävs get_staff_configuration: en person, max7veckodagar/60datumundantag/8perioder per dag; inga kundfält eller fria frånvaroskäl. Att skriva exceptions ersätter hela listan. Utelämnat exceptions/active/buffer bevarar tidigare värden vid uppdatering; id/expectedVersion måste skickas tillsammans.

Alla nya skrivningar kräver confirmed=true och stabil clientRequestId(max64). Aktören är en serverägd lokal kanal, aldrig klientens fält. Identisk retry återger samma minimala resultat; ändrad payload eller gammal version nekas. Den medföljande klientens --admin --workspace ber om sju separata bekräftelser för skapa tjänst/personal/bokning, flytta, avboka och inaktivera provresurser. Nekande/EOF stoppar innan nästa skrivning; tidigare godkända ändringar ligger kvar. Pipe/automation kan svara ja, så detta bevisar inte mänskligt samtycke.

Kandidat7fc0e86 har ren installation, full slutmatris, faktisk uppgraderingskopia och produktionsdemo PASS. Grok godkände efterföljande kvotfix4fc98d3. Exakt leveransc12b98a har4gröna CI-E2E-jobb med24/24 vardera, se CI_DELIVERY_2026_11_12. Se VERIFICATION/WORKPLAN för faktisk revision, kommandon och begränsningar. Detta är inte pilot- eller driftgodkännande.

## Epic 04: individuell lokal admin

AdminUser innehåller normaliserad syntetisk e-postidentifierare, Argon2id-hash, aktiv status, businessId och credentialVersion. AdminSession lagrar bara tokenhash, expiry/revocation och nullable userId. Historiska sessioner utan konto nekas. Fjärde migrationen är additiv; de tre tidigare ändras inte.

POST /api/admin/login kräver strikt {email,password}; password-only och ADMIN_PASSWORD ger ingen fallback. UI visar bara den egna adminidentifieraren. Kundernas e-post förblir maskerad. Varje adminläsning går via getAdminContext/isAdmin och kontrollerar aktivt konto i demo-kontext. Lokal MCP:s betrodda --admin är fortsatt separat och är inte kopplad till webbsessionen.

Inloggningsspärren reserverar synkront före asynkron KDF. Högst fyra pågående KDF-operationer per process; full kapacitet ger statisk429/Retry-After1 utan att förbruka klientens lösenordsförsök (specifik PasswordCapacityError, originalreservation återlämnas). Andra fel får ingen återbetalning. Login låser kontoraden och jämför credentialVersion innan sessionsskapande. Spärr/reset låser konto före sessioner och återkallar samtliga berörda sessioner i samma transaktion. Detta hindrar en äldre verifiering från att återinföra åtkomst. Annat kontos sessioner påverkas inte. Lokal CLI läser lösenord utan terminaleko; inga publika kontoendpoints.

[Beslut, bibliotek och begränsningar](ADR_004_ADMIN_IDENTITY.md) · [operatörsguide](ADMIN_OPERATIONS.md). Ingen MFA eller verifierad multi-tenancy byggs här.


## Epic 03: databasanslutning

Prisma 7.10.1 med PostgreSQL-adapter skapas endast via scripts/database.mjs. Fabriken återanvänds i appens befintliga singleton, seed, demo och testhjälpare. Varje klient får högst fem anslutningar, fem sekunders anslutnings-/poolväntan och tio sekunders inaktiv timeout; domänens transaktionsgränser är kvar. $disconnect stänger den adapterägda poolen. Flera processer multiplicerar budgeten och är inte verifierad drift.

Adaptern skriver Date som UTC-klockslag utan offset; därför tvingas timezone=UTC sist i PostgreSQL-sessionens options, även om operatörens URL anger annan zon. Stockholm används fortsatt för affärsdagar/öppettider och presentation, UTC för lagring. En verklig DST-regression kontrollerar både ORM, rå SQL och sessionszon. Strukturerade insert-fel läses från v7:s driverAdapterError.cause.originalCode (legacy meta.code stöds); inga felmeddelanden strängmatchas. Exclusion och de tre migrationsfilerna är oförändrade.

prisma.config.ts laddar .env uttryckligen endast i CLI. Runtimeklienter kräver exporterad DATABASE_URL; ingen implicit .env-läsning sker via Prisma Client. Node:s befintliga --env-file i webb/MCP-start fungerar fortsatt. Det löser den specifika Prisma-autoladdningen i E02-QA-2, men tillgång till OS, projektfiler eller explicita env-flaggor är inte isolerat. [Beroende-/licensbeslut och verkliga tidiga fel](DEPENDENCY_REVIEW.md). Kandidaten behåller tills vidare den kompatibla prisma-client-js-generatorn.

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
- Nya bokningar har transaktionssäkrat tak: fem per klientadress/Stockholmsdag och tre per e-postnyckel/dag. Låsordning är idempotensnyckel, klient/dag, e-post/dag. Lyckad idempotent replay förbrukar ingen budget. clientKey är HMAC av IP med SESSION_SECRET. emailCapKey normaliseras till gemener utan +tagg och lagras nu som namespacad HMAC; äldre obehandlade rader kan ha klartext och räknas också. Kontaktadressen behåller taggen tills explicit kontaktåtgärd. NAT delar taket; byte av SESSION_SECRET ändrar nu både klient- och HMAC-e-postnycklar och kan återställa dagens tak. Använd sessionsversion för normal återkallelse; separat kvotnyckel/rotationsrutin är en pilotgrind. Detta är heuristiker, inte identitetsverifiering eller anonymisering.
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
