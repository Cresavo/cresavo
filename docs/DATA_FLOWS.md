# Datakarta för Booking Lab SE POC

## Epic 06 — syntetiskt kundregister

Ny Customer-tabell innehåller id, verksamhet, namn, e-post, valfri telefon,
arkiveringsflagga/version och skapandetid. Ingen journal eller fritextanteckning.
Admin söker serverbaserat på namn/e-post/telefon; listsvaret innehåller namn,
status och datum för nästa/tidigare bokning, högst50kort/sida. Söktext kan ingå i
URL/serverns vanliga requestmetadata: använd endast syntetiska data; introducera
inte loggning av sökparametrar. Ingen ny analytics eller extern söktjänst används.

Kundkort är behörighetskontrollerat. Kontakt är maskerad utanför explicit pinnad
Vercel-demo; där får admin se example.test-kontakter. Historik är paginerad och
behåller Booking-snapshots separat från aktuell kontakt. Booking.customerId
kopplas uttryckligen av admin/opt-in lokal arbetsyteagent, aldrig av publik
e-postmatchning. Publik HTTP får fortfarande bara boknings-ID i skrivsvaret.

Lokal MCP kan använda ett redan känt syntetiskt kund-ID med --allow-workspace,
men får inga nya kontaktfält eller registerexportverktyg. WorkspaceRequest lagrar
hash av skrivunderlag samt enbart id/version som resultat, inga råa kontakter.
Arkivering behåller personuppgifter och historik; retention/export/radering är
fortsatt pilotblockerare. Demoseed är additiv och skriver inga externa utskick.

## Avgränsad demoknapp i UI-uppdraget

`POST /api/demo/session` tar inte emot kunduppgifter, lösenord eller en
användaridentitet. I uttryckligen tillåten, skyddad Preview skapas en vanlig
serverlagrad session för den markerade aktören `demo-owner@example.test`.
Frontend får bara ok/fel och en HttpOnly-cookie, aldrig miljöhemligheter.
Aktören visas som Demoägare, inte som en verifierad Vercelanvändare.
Normal individuell inloggning och bokningsregler består.

Ny demodatabas är separat från tidigare prov; inga tidigare
kontaktuppgifter kopieras till demoseed eller Grok. Bara påhittade namn och
reserverade example.test-adresser. Källkod/bilder för Grok kommer från egen
lokal syntetisk kopia; Grok får inga molnhemligheter eller driftåtkomster.
Ingen ny extern telemetri, utskick eller betaltjänst införs av UI-ändringen.
Aktuell faktisk drift, revision och verifiering finns i [DEMO](DEMO.md) och
[VERIFICATION](VERIFICATION.md); grinden i [UI-granskningen](UI_USABILITY_REVIEW.md).

## Tidigare privat Vercel-preview f2fdac7, 2026-11-12

Faktisk leverans på f2fdac7: app-runtime fra1/Frankfurt och Neon eu-central-1,
men Vercelbygget kördes i cle1/USA. Detta är inte en verifierad EU-exklusiv
leverantörskedja för kunddrift. Byggkontexten innehöll bara vitlistad källa,
inga lokala miljöfiler; appbygget använde en dummy-URL till loopbackport1.
Efter syntetiskt driftprov krypterades separat DB-backup på operatörens PC
och återlästes till ny lokal *_demo-databas med identiskt innehåll i10tabeller.
Backupnyckel/adminuppgifter/token finns enbart i ignorerad .vercel, krypterad
backup på D:. Ingen automatiserad offsitebackup eller kundretention följer av
detta. Se DEMO/VERIFICATION för faktisk perimeter, åtkomst och begränsningar.

Endast syntetiska data, separat Vercel-projekt och separat Neon Free-projekt i
Frankfurt (eu-central-1), inte befintliga andra projekts data. Vercel behandlar
IP/HTTP-metadata och sitt eget inloggningskonto vid perimetergrinden. Detta är
en ny extern driftmottagare, inte ett nytt modell-/marknadsföringsanrop.
Neon behandlar bokningsdatabasen och nya RateLimitBucket. Appen använder ett
eget begränsat DB-konto över verifierad TLS. Migrationer körs med operatörskonto.

RateLimitBucket: HMAC(route+IP-/admin-/lokal kanalidentitet), slumpmässig
generation, räknare och expiry. Även HMAC är pseudonymiserat, inte anonymt.
Inga råa IP-adresser, kundnamn, e-postadresser, lösenord eller request bodies.
Fönstret gäller15min, högst100utgångna rader gallras per nytt anrop och lagret
är begränsat till10000rader. Inga bakgrundsjobb: inaktiva rader kan ligga kvar
efter expiry när previewn inte används. Ingen beslutad kundretention följer av
detta. Originala kund-/sessionstabeller och lokala MCP-svar är oförändrade.
Leverantörernas driftloggar är separata från appens sanerade loggar och måste
bedömas före kunddrift. Grok får endast fryst källkod och sanerad konfiguration,
aldrig miljöfiler, databaser, autentiseringsläge eller preview/serveråtkomst.

## Epic 05: arbetsytans nya data, kandidat under slutgranskning

| Yta | Uppgifter / mottagare | Minimering och begränsning |
| --- | --- | --- |
| Kundbokning → API | Valfri personal/tjänsteversion, befintligt syntetiskt kundnamn/e-post och tid | Samma origin, domänvalidering, kvoter och idempotens; publikt svar fortfarande endast id. |
| Skyddad kalender / detalj | Boknings-ID, utförare, lagrad behandling/tid/pris/status/version, kundnamn | Kalender max100/sida och31dagar; ingen kund-e-post. Detalj maskerar e-post och visar max20 händelser. |
| Staff / Service | Syntetiskt personalnamn, tjänsttilldelning, veckoperioder, pauser, datumundantag, aktiv/version | Public staff-endpoint skickar bara id/namn/tjänst-ID, inga arbetsscheman. Admin krävs för redigering och konfigurationsläsning. Inga fria frånvaro-/hälsoskäl lagras. |
| Booking snapshots | Namn/pris/längd/buffert, initiala och nuvarande tider, status/version | Behövs för historik; kan indirekt avslöja behandling. Äldre pris rekonstrueras inte. Ingen generell kund-GDPR-gallring införs här. |
| BookingEvent | Tid, åtgärd, bokning, betrodd aktör/kanal, föregående/nästa tid/personal | Inga kundpayloads eller lösenord. Admin-ID är personuppgift; lokal MCP-kanal är inte verifierad individ. |
| WorkspaceRequest | Hashad aktörsbunden nyckel, payloadhash och minimalt mutationsresultat | Inga råa kunduppgifter i ledger. Ingen beslutad produktionsretention; växer med nya request-ID och måste ingå i framtida gallrings-/exportbedömning. |

UI använder samma origins API; ingen ny extern telemetri, modellanslutning eller tjänst läggs till. Lokal MCP-paritet är implementerad under slutverifiering. Nya arbetsyteläsningar kräver --admin och skickar aldrig kundnamn/e-post. Bokningslistan har bara id/tjänst/personal/start/slut/status/version, max100/sida och31dagar. Bokningsdetalj ger snapshotuppgifter och max20händelser. Personalmetadata max20 och tjänster max50. Schemaläsning är normalt31dagar; explicit get_staff_configuration ger en persons kompletta, högst60datumundantag för att kunna ersätta konfiguration utan förlust. Personalnamn och frånvaro kan vara personuppgifter även utan kunddata.

Nya save_service/save_staff/move_booking/cancel_booking kräver --admin --allow-workspace, stabil request-id och confirmed. De skriver genom webbens domän; mutationernas ledger/historik får samma begränsningar ovan. Nya serververktyg öppnar inga portar. Testklientens --workspace bekräftar varje av sju syntetiska skrivningar, skriver endast minimala resultat och använder explicit miljövitlista inklusive kvothemligheten bara i valt skrivläge. Ingen extern AI får data automatiskt. Nej/EOF stoppar efter tidigare bekräftade ändringar; ingen dold rollback eller automatisk återkörning. [Aktuell verktygsmatris](ARCHITECTURE.md). Bara syntetiska uppgifter; pilot fortsatt NO-GO.

Adminens nya bokningar har en kontoanknuten clientKey-HMAC i stället för IP-HMAC och emailCapKeyNULL. Kontolänkad HMAC är pseudonymiserad, inte anonym; den ingår i framtida GDPR-/retentionsbedömning tillsammans med BookingEvent. Kund/MCP:s befintliga nycklar/tak består. Ingen rå IP eller ny extern mottagare. Se ARCHITECTURE för kvoter och äldre rader.

## Epic 04: administratörsidentitet

| Yta | Uppgifter och mottagare | Minimering / kvarstående risk |
| --- | --- | --- |
| Lokal CLI → domän → PostgreSQL | Syntetisk admin-e-post och lösenord vid provisionering/reset; endast saltad Argon2id-hash lagras | Lösenord läses från dold terminal/stdin, aldrig argv, .env eller logg; ingen mejlleverans. Operatörens terminal/OS är betrodd. |
| Loginform → samma origins API | email och password skickas lokalt via HTTP i POC; verklig drift kräver TLS | Strikt validering, generiskt401, klientspärr före KDF, ingen delad lösenordsfallback. Lösenord finns tillfälligt i processminne; ingen säker minnesnollning garanteras i JS. |
| AdminUser | id, email, passwordHash, businessId, active, credentialVersion | Endast example.test, en demosalong. Hash är känslig autentiseringsdata; ingår i DB-backup men inte API/MCP. Ingen automatisk kontogallring. |
| AdminSession / browser | DB: tokenhash, userId, expiresAt, revokedAt. Cookie: slumpmässigt token, expiry, signatur | Serverkontroll varje adminåtkomst; logout/reset/spärr återkallar raden. Befintlig begränsad sessionsgallring kvarstår. |
| Skyddad adminvy | Den inloggades egen e-postidentifierare | Ingen ny kund-e-post lämnas ut. API-fel och CLI-koder innehåller inga identifierare/hashar. |
| MCP / externa tjänster | Inga nya kontofält till MCP och ingen ny extern mottagare | Lokal --admin behåller sin särskilda tillitsmodell. Nativepaket installeras från npm; appen konfigurerar ingen ny extern tjänst. Ingen nätverksfångst gjord. |

Konton/provsessioner skapas och städas av egna testfixtures. Endast syntetiska data; ingen GDPR-funktion för riktiga konton tillkommer. Nedanstående beskrivningar av delat ADMIN_PASSWORD är historiska. [Säkerhetsbeslut](ADR_004_ADMIN_IDENTITY.md).


## Epic 03: explicit databasmiljö

Ingen ny personuppgift, tabell eller extern mottagare tillkommer. Prisma 7 använder lokal PostgreSQL-driveradapter via samma klientfabrik. Runtime/MCP autoläser inte längre .env genom Prisma; endast CLI-konfigurationen laddar den uttryckligen. Startkommandon med --env-file laddar fortfarande filen avsiktligt. Readonly-subprocessens befintliga miljövitlista får därmed avsedd effekt för just automatisk env-laddning, men är ingen OS-/filsystemsisolering. Datum lagras med uttrycklig UTC-session; UI/dagstak använder fortsatt Stockholm. Nedanstående Prisma 6-autoladdning är historiken från Epic 02. Nätverksfångst/leverantörsbedömning har inte gjorts i uppgraderingen; CLI:s större Studio/dev-träd har inte startats som tjänst. [Detaljer](DEPENDENCY_REVIEW.md).

## Epic 02: syntetisk MCP-bokning

I separat lokalt skrivläge tar create_booking emot syntetiskt namn och example.test-e-post samt tjänst, tid, clientRequestId och confirmed=true. En anslutande AI-klient ser därmed sin egen indata; minimerade svar gör inte indata anonym. Riktiga uppgifter och hälsodata är fortsatt förbjudna i denna POC.

createBooking lagrar samma bokningsfält, idempotenshash och e-postkvotnyckel som webben. clientKey är HMAC av en fast serverägd MCP-kanalsträng, inte operatörens IP eller individuell agentidentitet. Samma lokala databas och dagstak används; ingen ny mottagare, tabell eller extern modellanslutning läggs till. Verktygssvar innehåller endast id, serviceId, startsAt och endsAt. Administrationsvyn har fortsatt maskerad e-post. Ingen kundlivscykel/gallring tillkommer.

Testklienten visar syntetiskt kundnamn och tid före ja, skriver ett minimerat resultat och lämnar inte e-post eller sessionshemlighet i resultatloggen. mcpEnvironment exporterar SESSION_SECRET bara i bokningsläge och exporterar inte ADMIN_PASSWORD. **Prisma 6 kan dock automatiskt läsa projektets .env**, även utan Node --env-file, och tillföra båda hemligheterna i subprocessen. Vitlistningen är inte en isoleringsgräns; använd separat minimal konfiguration och utred verklig processisolering före pilot. Det nya create_booking sanerar schemafel till statisk svensk text före SDK:s isError-svar; äldre verktygs SDK-valideringsfel kan fortfarande spegla klientens egen indata.

## Uppdatering efter QA batch 3

Klientidentiteten i processräknaren och bokningens HMAC är nu IPv4 eller IPv6-/64; proxykontrollen använder full socketadress. Pseudonymiseringen och övriga lagrade fält är oförändrade. Varningen PROXY_CLIENT_IDENTITY_COLLAPSED innehåller inga adresser eller headeruppgifter och skrivs högst en gång per serverprocess.

Vid lyckad login tas högst 100 utgångna/återkallade sessionsrader bort. Utan inloggningar sker ingen gallring; detta är inte en generell retentionpolicy. E2E-fixturer städar sina egna sessioner utifrån tokenhash, även i timeout-proben. Övrig kunddata har fortsatt ingen GDPR-livscykel. Ingen ny extern mottagare, dependency eller telemetri införs; nätverksfångst har inte gjorts i denna omgång. Detta ersätter batch 2:s uppgifter om bestående testsessioner och utebliven sessionsgallring.

## Uppdatering efter QA batch 2 — 2026-11-11, a84e48a

Detta tillägg ersätter nedanstående äldre uppgifter om gemensam IP-bucket och logout utan serveråterkallelse.

- Riktig socketadress är standard. X-Real-IP används endast när socketen matchar TRUSTED_PROXY_IPS i aktiverat proxyläge. IP/rutt/räknare ligger i processminne i 15 minuter, rensas vid nästa anrop efter utgång eller processavslut; äldsta post evikteras vid kapacitet. Rå IP skrivs inte av appen till Booking eller applogg.
- Booking lagrar nu clientKey (HMAC av IP med SESSION_SECRET) för fem skapade bokningar per klient/Stockholmsdag, och emailCapKey (gemener utan +tagg) för e-posttaket. Kontaktadressen behåller taggen. HMAC/hash är pseudonymisering, inte anonymisering. NAT delar tak; ingen e-postverifiering eller leverantörsspecifik punkt-normalisering.
- AdminSession lagrar hash av slumpmässigt token och createdAt/expiresAt/revokedAt. Cookien innehåller token, utgångstid och signatur. Logout återkallar DB-raden innan browsercookie raderas, så kopierad cookie nekas. Global version finns kvar. Inga individuella adminkonton och ingen automatisk gallring av sessioner.
- Punkt 6 är undantagen: admin får ingen ny möjlighet att avmaskera e-post. Inga nya utlämnings-/auditflöden. MCP utelämnar fortfarande namn/e-post.
- MCP-subprocesser får uttryckligen exporterad DATABASE_URL och en liten lista nödvändiga operativmiljövariabler. Adminlösenord och sessionshemlighet vidarebefordras inte. Exporterad databas vinner över env-filens databas; detta är integrationstestat.
- Fixtures tar bort egna syntetiska bokningar/kampanjer efter test-timeout när DB finns tillgänglig. Sessionsrader består i isolerade testkluster. Processkill, strömavbrott och DB-avbrott omfattas inte av städgarantin.

Nya nycklar och sessionsrader måste ingå i framtida gallrings-/rättighetsbeslut. Inga nya externa tjänster eller dependencies har tillkommit. Ingen ny egressfångst eller juridisk bedömning har gjorts. Underliggande klassificering och driftosäkerheter nedan består.

Granskad 2026-11-11 mot lokal arbetskopia. Kartan beskriver kodens möjliga behandling och verifierbar konfiguration, inte en godkänd behandling av riktiga kunduppgifter. Endast syntetiska uppgifter får användas. Ingen befintlig kunddatabas eller trafik med riktiga personer granskades. Dokumentet är ett underlag för en faktisk registerförteckning, inte en komplett sådan.

## Klassificering och ändamål

POC:ns avsedda ändamål är att demonstrera bokning, administration och granskning av kampanjutkast. Med verkliga uppgifter är namn, e-post och boknings-ID knutna till en fysisk person; tid, tjänst, personal och verksamhet kan då också vara personuppgifter. Även IP-adress och användaragent kan vara personuppgifter när de behandlas i nätverk eller loggar. I vissa sammanhang kan bokning av fotvård eller annan tjänst, särskilt ihop med identitet, **avslöja hälsotillstånd** och därmed vara en känslig personuppgift. Det avgörs av innehåll och sammanhang; alla fotvårdsbokningar är inte automatiskt hälsouppgifter. Ett formulär utan journalfält eliminerar inte risken. Se [IMY om hälsouppgifter](https://www.imy.se/vanliga-fragor-och-svar/vad-ar-personuppgifter-om-halsa/) och [IMY:s beslut om indirekt avslöjande](https://www.imy.se/globalassets/dokument/beslut/2025/beslut-efter-tillsyn-waab.pdf).

Personuppgiftsansvar, eventuellt biträdesförhållande, rättslig grund, information till registrerade och lagringstider är inte beslutade. I en tänkt salongsdrift kan salongen vara personuppgiftsansvarig och en managed host personuppgiftsbiträde för bokningar, men rollfördelningen måste bedömas per behandling. Vid self-hosting beror den på vem som bestämmer ändamål och medel. Se [EDPB om ansvarig och biträde](https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en).

## Flöden och lagringsställen

| Yta / källa | Uppgifter och ändamål | Mottagare och lagring | Faktiskt skydd / begränsning |
|---|---|---|---|
| Kundens webbläsare, `src/app/booking-form.tsx` | Tjänst, datum, tid, namn och e-post anges för bokning. Namn och e-post läses från formuläret vid inskick; val och meddelanden hålls i React state. | `GET /api/availability` med tjänst och datum i URL; `POST /api/bookings` med uppgifterna i JSON till samma origin. Webbläsare, tillägg, autofyll, cache och felsökningsverktyg kan skapa ytterligare lokala kopior beroende på miljö. | Ingen uttrycklig `localStorage`/`sessionStorage` i granskad `src`. Datum/tjänst i URL kan förekomma i HTTP-/proxyloggar. TLS är inte konfigurerat av POC:n. |
| Publika API:er, `src/app/api/*` | Tjänster och tillgänglighet är publika. Bokning valideras med Zod och affärsregler; svaret vid lyckad bokning innehåller boknings-ID. | Webbprocessen och PostgreSQL. Fel går genom `src/lib/http.ts`. | `POST /api/bookings` kräver matchande Origin/Host, men origin-kontrollen är inte klientautentisering och jämför host, inte full origin inklusive scheme. Processlokal IP/rutt-spärr och transaktionssäkrat tak på tre bokningar per e-post/skapandedag finns; det är inte verifierad identitet eller distribuerat missbruksskydd. |
| PostgreSQL, `prisma/schema.prisma` | `Booking`: ID, `businessId`, `staffId`, `serviceId`, start/slut i UTC, kundnamn, normaliserad e-post, createdAt och valfri idempotencyKey/requestHash. `Service` och `Campaign` innehåller verksamhets-ID och tjänst-/kampanjinformation; kampanjtitel är fritext som kan innehålla personuppgifter. | Databasen vald av `DATABASE_URL`; lokala Compose-volymen `booking_data` består tills den uttryckligen tas bort. Säkerhetskopior, databasloggar och lagringsmedier beror på driftmiljön. | Tillgänglighetskontroll och databasens exclusion constraint hindrar överlapp, inte dataläckage. Ingen gallring, raderings-/exportfunktion, krypteringspolicy eller backup-policy är implementerad. `DATABASE_URL` kan peka på en extern värd; Compose binder databasporten till loopback. |
| Admininloggning, `src/lib/auth.ts` och `/api/admin/login` | Administratörens lösenord skickas i JSON till samma origin och jämförs med `ADMIN_PASSWORD`. `SESSION_SECRET` används för signering. Ingen personlig administratörsidentitet lagras. | Lösenord finns som konfigurationshemlighet på servern. `booking_admin`-cookie innehåller utgångstid och HMAC-signatur; den är en bearer-session, inte krypterad användarprofil. | Cookien är HttpOnly, SameSite Strict och gäller åtta timmar; Secure endast i `NODE_ENV=production`. Delat lösenord utan individuell identitet. Processlokal loginspärr, browserlogout och global ADMIN_SESSION_VERSION finns; ingen individuell återkallelse. Rotering av signeringshemligheten ogiltigförklarar befintliga cookies. |
| Adminvy, `src/app/admin/page.tsx` | Visar kundnamn, maskerad e-post, behandling och tid inom datumintervallet, högst 100/sida; listar tjänster och kampanjer. | Serverrenderad HTML skickas till inloggad webbläsare. Data kan därmed även hamna i webbläsarhistorik, skärmbilder, cache eller proxylager beroende på konfiguration. | `isAdmin()` kontrolleras före frågorna och sidan är dynamisk. Appen sätter no-store på /admin, verifierat via E2E; faktisk driftsproxy/cache är inte verifierad. |
| Lokal MCP, `src/mcp/server.ts` | Standard: tjänster och lediga tider. Med `--admin`: `list_bookings` kräver ett lokalt datumintervall på högst 31 dagar och returnerar högst 100 per sida (standard 20): boknings-ID, start/slut samt tjänstens ID och namn. Kundnamn och e-post returneras inte. Boknings-ID, tid och tjänst kan ändå vara personuppgifter eller avslöja hälsa. `create_campaign_draft` tar tjänst, titel, rabatt och datum. | JSON-RPC över stdio till den lokala klient som startar servern. Klienten/agentvärden kan spara, logga, vidarebefordra eller skicka innehållet till en extern modell beroende på sin egen konfiguration. | `--admin` ger verktygen vid processstart; det är inte användarautentisering, individuell auktorisering eller en sekretessgräns mot klienten. Ingen publik MCP-server implementerad. Separata processers databasuppgifter ger inte i sig klienten SQL-åtkomst, men klientens ägare och värdmiljö måste betraktas som betrodda. |
| Kampanjutkast och publicering | Agentens titel är fritext; eventuell personinformation kan skrivas in av misstag. | Utkast sparas i PostgreSQL; admin publicerar via `/api/admin/publish`; publicerad titel, tjänst, rabatt och datum visas publikt. | Verktyget publicerar inte självt. Admin måste kontrollera innehåll och skydda sig mot felaktiga eller manipulerade agentförslag. Ingen automatisk PII-detektering finns. |
| Applikations-, databas- och infrastrukturloggar | `safeFailure()` loggar bara `BOOKING_INTERNAL_ERROR` för oväntade fel; HTTP och MCP lämnar ett generiskt meddelande. Sidornas dataladdning kastar ett nytt statiskt fel utan cause. Seed och testklient använder statiska felkoder. Testklienten skriver sina verktygssvar till stdout. PostgreSQL-/proxy-/värdloggar och eventuella kraschrapporter är miljöberoende. | Lokala terminaler, containrar, logginsamling, supportkopior och eventuella externa mottagare beroende på drift. | Applikationsfel är regressionstestade med syntetiska läckagemarkörer, men SQL-parametrar kan fortfarande hamna i PostgreSQL-/proxyloggar. MCP-SDK:s schemafel före callback kan spegla klientens egna indata/nyckelnamn. Ingen generell lagringstid eller åtkomstpolicy finns. |
| Tester och utvecklingsartefakter | Testerna skapar avsedda syntetiska bokningar/kampanjer och Playwright kan producera skärmbilder, felkontext och rapporter. Separata lokala PostgreSQL-testkluster kan ligga utanför projektet. | Testdatabas, lokala resultatmappar, terminalutskrifter och utvecklarens disk; testerna tar bort vissa skapade poster men det är inte en allmän gallringsgaranti. | `.gitignore` utesluter bland annat `.env`, testresultat och vanliga databasfiler. Ignorering är inte kryptering, säker radering eller garanti mot `git add -f`/annan överföring. |

Ingen automatisk lagringstid är definierad. Sekretess- och lösenordsuppgifter ska aldrig hamna i exempel, issue-rapporter, prompts eller loggar. Servervalidering av fritext är inte en garanti för att en användare inte matar in hälsodata.

## Externa tjänster och telemetri

**Verifierat i applikationskällan:** sökning efter URL:er, `fetch`, WebSocket och telemetri i `src` fann relativa, samma-origin-anrop från UI och inga direkt hårdkodade externa analys-, annons-, AI- eller betalningsanrop. MCP-servern använder stdio. Detta är inte en granskning av varje transitivt beroende, nätverksfångst, DNS, värdinställning eller agentklient och bevisar inte att all trafik stannar i EU/EES.

| Källa | Vad som är känt | Kontroll / osäkerhet |
|---|---|---|
| Next.js CLI 16 | `npx next telemetry status` gav **Enabled** i den här lokala utvecklingsmiljön; `NEXT_TELEMETRY_DISABLED` var inte satt i den kontrollerade processen. Enligt [Next.js telemetridokumentation](https://nextjs.org/telemetry) kan `next dev`/`build` skicka användnings- och miljömetadata; leverantören anger att filinnehåll, hemligheter och loggar inte samlas in som telemetri. | Status innebär inte att ett visst paket faktiskt lämnade datorn, eller att kunddata skickades. Någon nätverksfångst har inte gjorts. Opt-out inför processen: `NEXT_TELEMETRY_DISABLED=1`; debugläget `NEXT_TELEMETRY_DEBUG=1` skriver enligt dokumentationen händelser lokalt och skickar dem inte. Kontrollera effekt per installation. |
| Prisma CLI 6 | Installerad CLI innehåller referenser till `checkpoint.prisma.io` och `CHECKPOINT_DISABLE`. [Prismas v6-dokumentation](https://docs.prisma.io/docs/orm/v6/tools/prisma-cli) beskriver CLI-användningsmetadata och att databasinnehåll/schema inte ingår i den användningsdatan; felrapporter kräver enligt dokumentationen bekräftelse. | `CHECKPOINT_DISABLE` var inte satt i den kontrollerade processen. Det visar inte att just ett anrop skickades eller att alla Prisma-versioner beter sig identiskt. Dokumenterat opt-out för v6: `CHECKPOINT_DISABLE=1` före CLI-processen. Kontrollera installerad version och faktisk nätverkspolicy. |
| npm och verktygsinstallation | `npm ci` hämtar paket från konfigurerat registry; `npm audit` skickar enligt [npm-dokumentationen](https://docs.npmjs.com/cli/v11/commands/npm-audit/) beroendenamn/-versioner till registry, med ytterligare systemmetadata vid fallback. Installation och postinstall-skript kan också göra nätverksanrop. | Aktuellt registry, dess region, speglar, npm-konfiguration och alla postinstall-skript har inte kartlagts. Kommandon har tidigare körts i projektet; ingen kunddatabas krävs för audit. |
| Databas, drift och AI-klient | `DATABASE_URL` kan ange en fjärrdatabas. Proxy, hosting, backup, support och valfri agent-/modellklient kan ha egna mottagare, loggar och underbiträden. | Ingen sådan produktionsleverantör är vald eller verifierad. Varken EU/EES-lagring eller frånvaro av åtkomst från tredjeland kan garanteras av denna kodgranskning. |

Miljövariabler för opt-out måste sättas för den faktiska CLI-/byggprocessen **innan den startar**; anta inte att en app-`.env` som laddas senare styr telemetrin. Stäng inte av säkerhetsuppdateringar eller audit utan en ersättande process.

## Kända luckor i kartan

Appens cache-/säkerhetsheaders är E2E-testade. Inga paketflöden under verklig körning, verkliga proxies, loggkonfiguration, databaskryptering, backupkopior, automatiska leverantörsuppdateringar eller en extern MCP-värds databehandling har testats. Ingen formell DPIA, leverantörsbedömning, överföringsbedömning eller juridisk roll-/rättslig-grundanalys har genomförts. Se åtgärder och grindar i [PRIVACY_SECURITY.md](PRIVACY_SECURITY.md).

## Tillkomna dataflöden i QA-batchen

- IP från X-Real-IP används bara med uttrycklig betrodd proxyinställning, annars gemensam lokal nyckel. IP/rutt, räknare och utgångstid ligger i processminne i15 min; utgångna poster rensas vid nästa anrop eller processavslut. Max10000 buckets. Appen skriver dem inte till logg/databas, men infrastrukturen kan ha egna loggar.
- Skapandetid lagras för dagstak. E-post normaliseras till gemener. Idempotency-Key och hash av payload lagras för retries; de kan knytas till bokningar och är inte anonymiserade. Ingen TTL/gallringsfunktion har införts.
- Admin får fortsatt kundnamn, men e-post ersätts med ***@*** innan renderingen. MCP:s svar saknar båda fälten. Retention, mottagarbedömning och känslig indirekt information kvarstår även med maskering.
- Global sessionsversion är konfiguration utan kunddata. Logout raderar browsercookie; kopierade cookies kräver versionshöjning/utgång. Demobilder/video innehåller bara syntetiska uppgifter och är lokalt ignorerade.
