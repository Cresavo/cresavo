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
agent och returnerar endast protokollversion, körläge och scopes. Åtkomst till en operation eller ett
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

Salongen nekar också gatewaymärkta operationer i samlat körläge, med statiskt 503
`provider_configuration_invalid`. Det stänger fönstret där servern startar om i
fel läge mellan en lyckad accesskontroll och operationen. MCP-delstegen inom
ett inkommande anrop återanvänder samma accessbesked, aldrig mellan anrop.
En vanlig operation kostar därmed två poster i salongens befintliga anropsbudget.
Gatewayen ersätter alla provider-5xx med statiskt 503 `provider_unavailable`.
Avstängd consent-lab ger kontrollerat 403 även utan konfigurerad publik origin.

En salong som
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

## Reproducerbart prov av ett fryst revisionspar

`scripts/integration/pair.json` låser gatewayens revision. Salongens revision och
smutsig arbetskopia redovisas vid körning. CI kräver rena arbetskopior.
Checka ut de två repona separat. Inga .env-filer får finnas i provkopiorna.
Provet läser inte sådana filer och laddar inga operatörshemligheter från dem.

1. Installera Node 24 och lokalt PostgreSQL. Skapa en ny isolerad databas på
   loopback, med namn som slutar på `_test`. Tillför DATABASE_URL i provprocessens
   miljö. Kör inte mot en befintlig demo eller kunddatabas.
2. Kör `npm ci` i båda repona och `npx playwright install chromium` i salongen.
3. I salongen: `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`
   och `npm run build`. Tillför ett tillfälligt SESSION_SECRET för dessa steg.
4. Ange GATEWAY_PATH till den separata gatewayutcheckningen på den låsta revisionen.
   Kör `npm run test:pair`. Starta inga servrar manuellt för detta prov.

Runnern startar salongens vanliga wrapper och gatewayen med slumpade processhemligheter.
Gatewayens miljö innehåller varken databasadress eller sessionshemlighet. Separata
REST- och riktiga HTTP-MCP-SDK-klienter skapar bokningar. En inloggad Chromium-session
öppnar samma boknings-id i salongens kalender. En lokal testproxy utanför produkterna
tappar ett redan sparat svar, injicerar providerfel och startar om salongen mellan
accesskontroll och skrivning. Dessutom provas 20 samtidiga försök, främmande klient,
återkallad nyckel, driftavbrott och återhämtning. SQL-kontroll kräver noll överlapp.
Egna testfixtures och egna processer städas även vid fel. Append-only historik följer
befintliga lagringsregler. Ta bort hela den isolerade testdatabasen efter provet.

`test-results/integration-pair.json` innehåller endast revisionspar, dirty-markering,
tidpunkt och statiska testkoder. Inga nycklar, kunduppgifter eller råa anropsloggar.
Provets klienter är testscripts och MCP SDK, inte certifierade personliga assistenter.

### Privat CI utan nya åtkomstnycklar

Befintlig GitHub-token kan inte hämta det andra privata repot och inga repo-secrets
finns för detta. Ordinarie push-CI behålls. Det gemensamma provet startas uttryckligen
efter privat push, via operatörens befintliga gh-inloggning:

```powershell
node scripts/integration/dispatch.mjs ../booking-lab-gateway night/gateway-salon-integration
```

Skriptet kräver ren gateway på exakt låst SHA och skickar en Git-bundle av den
committade källan till det privata salongsworkflowets manuella körning.
Inga tokens eller miljöfiler ingår. CI kontrollerar SHA-256, låst commit och bundle,
checkar ut gatewayen separat och kör `test:pair` mot ny lokal Docker-PostgreSQL.
Samma körning behåller den fulla befintliga fyrfältsmatrisen. Endast det sanerade
resultatmanifestet laddas upp som artefakt i sju dagar.

Detta är en manuell revisionsparskörning. Automatisk hämtning från det andra privata
repot vid varje push kräver ett separat beslut om snävt avgränsad läsbehörighet.
Bundlegränsen är 60 000 base64-tecken; när repot växer behövs den lösningen.
Ingen schemalagd körning, deploy eller utökad behörighet införs här.

## Verifierat revisionspar och kompatibilitet · 2026-11-16

Salongens produkt: `0a88ac27482aef377ecce86892b5bfbb897cc181`.
Gateway: `f9b8506cee3e3cd21bd279e01addf761cd3db1ed`, produkt `ab07b6c`.
Båda finns på privata grenen `night/gateway-salon-integration`.
Senare Markdown ändrar inte produktrevisionerna. Läs aktuell VERIFICATION
för faktiska test- och CI-utfall och Groks oförändrade originalrapport.

| Kombination | Bedömning |
| --- | --- |
| Det låsta nya revisionsparet | Lokalt verifierat med ren installation, separata processer och ny PostgreSQL; Grok reproducerade provet |
| Ny gateway + äldre salong | Inte godkänd som härdad kombination; salongen saknar operationens skydd vid byte till standalone mitt i ett anrop |
| Äldre gateway + ny salong | Ingen ny kompatibilitetscertifiering; äldre gateway saknar nya 5xx-saneringen och request-lokala accessdelningen |
| Ny salong i standalone, direkt klient utan gatewayheader | Äldre kontrakt behålls; inget tillstånd till publik åtkomst eller pilot följer av det |

REST v1, gamla MCP-verktygsnamn och mandat-/idempotenskontrakt består.
Inga migrationsfiler ändras. Uppgradera och verifiera båda processerna som par.
Discovery/alias är inte certifiering mot en extern leverantör eller assistent.

Grok granskade koden och körde pair-provet. Dess egna auditprober bekräftade
antal och avvisningar. Det gjorde ingen ytterligare fristående jämförelse av
kalender-id eller SQL-överlapp efter att runnern städat. Dessa två kontroller
finns i den körda automatiseringen och ska inte beskrivas som separat manuell QA.

Kvar i backlogg: NIGHT-QA-1, Info, `dispatch.mjs` lämnar sin tillfälliga
källkodsbundle/request.json efter utskick. Inga nycklar ingår. Begränsa
åtkomst till operatörens temporära katalog och lägg till ägd finally-städning
vid nästa lilla verktygsändring. Äldre GS1-QA-2 om rate-begränsad loggning
vid nekad tjänsteidentitet ingick inte i nattens fyra fynd och är fortsatt öppet.

## Frivilligt prov med riktig Codex-klient och syntetiskt kundgodkännande

Efter samma lokala förberedelser kan operatören uttryckligen köra:

```powershell
npm run test:pair -- --native-codex
```

Det kräver redan installerad Codex CLI med befintlig ChatGPT-inloggning.
Det använder kontots vanliga modellkvot. Ingen API-nyckel, ny tjänst eller
automatisk CI-modellkörning införs. Flaggan nekas i CI innan några tjänster startas.
Vanliga `test:pair` behåller sitt tidigare beteende.

Det aktuella native-provet använder `BOOKING_CONSENT_DELIVERY=separate-lab`.
Runnern skapar en egen privat temporär katalog med prefix
`booking-consent-inbox-`, ger dess adress bara till salongen och testoperatören
och städar den i finally. Varken agentprocessen eller gatewayen får katalogen.
Den nya migrationen `20261116100000_separate_customer_channel` krävs: den lägger
till en nullable leveransprofil och ett snävt syntetiskt verifiedVia-värde.
Historiska migrationer och PostgreSQL:s överlappsskydd ändras inte.

Provet startar en lokal, test-DB-skyddad consent-lab i salongen. Det gör sedan:

1. Codex läser tjänster och tillgänglighet via gatewayens verkliga HTTP-MCP.
   Det väljer Massage hos Anna nästa vardag, 30 minuter, högst 450 SEK och
   skapar ett förslag. Svaret innehåller `approvalRequired=true` och
   `approvalDelivery=separate-synthetic-customer`, ingen URL/token, kontakt eller
   katalogadress. Ingen bokning eller mandat får då finnas.
2. En separat negativ HTTP-kontroll kräver `400 mandate_required` utan mandat.
3. Testoperatören tar emot länken via den separata lokala kundinkorgen,
   utanför HTTP/MCP. En separat automatiserad syntetisk kund öppnar den i Chromium och
   godkänner exakt tjänst, personal, plats, tid och pris. Det befintliga UI:t
   skapar servermandatet. Ett HTTP-försök utanför tiden måste ge `403 mandate_denied`.
4. Codex får samma verksamhetskontext och förslags-id i en ny klientkörning,
   läser godkännandet och bokar. Det upprepar samma payload/nyckel och läser status.
   Krav: två lyckade create-anrop, samma id, en bokningsrad och rätt mandatkoppling.
   Kund är serverns oföränderliga v1-fixture `Separat Demokund`,
   `separate-customer@example.test`. Agenten kan inte byta kontakt eller välja
   annan mottagare genom JSON. Profilen följer förslaget över konfigurationsbyte.
5. Vanlig individuell admininloggning och kalenderklick öppnar samma boknings-id.
   Egna nycklar återkallas före städning av enbart egna fixtures.

Detta provar en riktig modellstyrd Codex CLI, inte ChatGPTs mobil-/webbgränssnitt.
Kundgodkännandet är automatiserat med påhittad identitet. Det bevisar inte
verklig kundautentisering, pilotberedskap eller att en människa klickade.
Hemligheten i kundinkorgen måste behandlas som en engångscredential: inga
råa kvitton/länkar i Git, loggar, modellprompt eller skärmbilder. POSIX kräver
privat katalog (0700), kvittot skapas exklusivt med 0600. Windows ACL är inte
oberoende kvalificerad; testet hävdar ingen isolering mot någon som redan
har serverns filsystem-/databasbehörighet. Ingen HTTP/MCP-läsare av inkorgen finns.

Historisk återkontroll på 13e0179 bekräftade legacy-labbets gräns: den som fick länken
via MCP kunde öppna den i en ny webbläsare utan kundinloggning och godkänna.
Att agent-Authorization nekas på kundrutten eller att approve-MCP saknas
garanterar därför inte separat kundgodkännande. OTP-labb kräver kod, men
simulerad leverans och klientvalt telefonnummer bevisar ingen avsedd kund.
Se den aktuella identitetsbedömningen i VERIFICATION och PRIVACY_SECURITY.

Kompatibilitet: utan BOOKING_CONSENT_DELIVERY gäller fortfarande det äldre
lokala labbkontraktet, också benämnt `legacy-agent-link`. Det får inte beskrivas
som oberoende kundgodkännande. Den nya profilen är opt-in och kan inte väljas
av agenten. Den vägrar kombination med simulerad OTP, cloud-markörer, osäker
katalog eller icke-lokal origin/testDB. Gammalt pending-labblänksgodkännande
nekas när separate-lab aktiverats; ny profils kundbindning kan inte nedgraderas
genom att senare byta tillbaka miljöinställningen. Leveransfel ger inget mandat
eller fallback till att lämna länken åt agenten; ett redan sparat pending-förslag
kan bli kvar till expiry. Detta är ingen produktionskö eller garanterad utskickstjänst.

Klienten får en tillfällig verksamhetsnyckel i sin processmiljö och endast sex
namngivna MCP-verktyg. DB-adress, sessionshemlighet och tjänstenyckel lämnas inte
till klienten. Skalverktyg, webbsökning och externa appar är avstängda.
Verktygsgodkännandet gäller bara den enskilda körningens uttryckliga testlista.
Serverns autentisering, scopes, kundmandat, idempotens och integritetsregler består.
Ingen global Codex-konfiguration eller befintlig demoprofil ändras.

`test-results/native-codex/` innehåller sanerat `evidence.json` och riktiga bilder
av godkännande och bokningsdetalj. Nycklar, labblänkar och rå CLI-output sparas
inte. Bounded modellanteckningar saneras före sparande. CLI körs med
`--ephemeral`; det är ingen garanti för OS-isolering eller modellleverantörens
datalagring. Endast syntetiskt katalog-/bokningsunderlag får användas.

Två separata klientkörningar används för att hålla godkännandet utanför agenten.
Verksamhets-id måste behållas mellan dem: det ingår för närvarande inte i
`get_proposal`-svaret. Agenten ska stanna och fråga om det saknas, inte gissa.
REST och MCP använder samma domänlogik. I den nya servervalda profilen uteblir
legacy-fältet approvalUrl; i övrigt består gamla verktygsnamn och bokningskontrakt.
Se `agent-api-v1.openapi.yaml`. Riktiga mottagare, identifiering och leverans
kräver ett senare beslut, inte nya kundregister eller riktiga utskick i detta prov.

Se officiell dokumentation för [Codex HTTP-MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
och [icke-interaktiv körning](https://learn.chatgpt.com/docs/non-interactive-mode).
Faktiska körresultat och begränsningar redovisas i VERIFICATION.
