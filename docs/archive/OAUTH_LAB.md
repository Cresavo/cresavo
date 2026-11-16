# Paket 1: lokal syntetisk OAuth-grund

Metadata: `/.well-known/oauth-protected-resource` och
`/.well-known/oauth-authorization-server`. Origin kommer enbart från
`discoveryOrigin()`; inkommande Host/forwardingheaders används inte.
MCP-resursens exakta identifierare/audience är `<origin>/api/v1/mcp`.

`POST /register` registrerar publika klienter (`token_endpoint_auth_method=none`)
med exakta redirect-URI:er, HTTPS eller HTTP-loopback, utan fragment/credentials.
`GET /authorize` kräver code, registrerad redirect, resource och PKCE S256.
`POST /token` tar application/x-www-form-urlencoded och kräver client_id,
redirect_uri, resource, grant_type=authorization_code, code och code_verifier.
Begärda scopes måste ingå i klientregistreringen och de fyra befintliga scopes.
Koder gäller 60 sekunder, access-token 300 sekunder, klienter 24 timmar.
Token är Ed25519-signerade JWT med issuer, audience, client_id, scope och expiry.
Engångskoder lagras hashade. Felinput och credentials loggas aldrig.

## Uttryckligt labbläge

Utfärdande är avstängt om inte `BOOKING_OAUTH_LAB=1`, operatorns origin är
loopback, runtime inte är Vercel och DATABASE_URL klarar befintlig
`scripts/test-db-guard.mjs` (loopback och suffix `_test`/`_demo`).
Anrop måste dessutom ha socket-wrapperns verifierade loopback-klientadress.
Använd en egen isolerad databas, syntetiskt SESSION_SECRET och explicit
BOOKING_PUBLIC_ORIGIN=http://127.0.0.1:<port> för lokal produktionsstart.
Starta med `env -u OPENAI_API_KEY npm start` och ledig loopback-port.
Ingen `.env` behövs; denna leverans har inte läst någon `.env`.

Opt-in-flaggan är operatörens automatiska godkännande av en **syntetisk
labbklient**. Det finns ingen riktig kundinloggning, kundbekräftelse eller
mandatutfärdande i flödet. Använd aldrig detta läge bakom en publik proxy.
Metadata kan beskriva operatorvald HTTPS-origin men utfärdande nekas där.

Klienter/koder ligger i en begränsad processglobal minneslagring (högst 1000
vardera). Privat signeringsnyckel genereras i minnet vid första labbanropet och
skrivs aldrig till disk eller logg. Omstart tappar registreringar/koder/nyckel.
Ingen flerprocessdrift, beständig OAuth-lagring, refresh, revocation eller
publik nyckeldistribution ingår. De kräver separat design före publik drift.

API-nycklar, USP, CLI, mandat och bokningslogik är oförändrade. JWT accepteras
ännu inte av MCP eller REST; det hör till paket 2. Ingen faktisk extern
connectoranslutning eller produktionskonformitet påstås.

Protokollunderlag: [MCP Authorization 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization),
[RFC 7591](https://www.rfc-editor.org/rfc/rfc7591),
[RFC 7636](https://www.rfc-editor.org/rfc/rfc7636),
[RFC 8414](https://www.rfc-editor.org/rfc/rfc8414),
[RFC 8707](https://www.rfc-editor.org/rfc/rfc8707),
[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728).

Paket 2: giltiga processlokala labbtoken accepteras som Bearer av HTTP-MCP och
agent-REST parallellt med befintliga API-nycklar. Samma scopes och ägarskap gäller.
En separat stabil `oauth_`-identitet per registrerad klient kopplas till AgentClient
via en intern credential-post utan användbar API-nyckel. Token kräver fortfarande
labbflagga, loopback-origin och testdatabas; de ersätter aldrig bokningsmandat.
401 annonserar Protected Resource Metadata; otillräckligt scope ger 403 med
`insufficient_scope`. Processomstart ogiltigförklarar alla labbtoken.

## Paket 3: kundens syntetiska Ja utfärdar bokningsmandat

`POST /api/v1/proposals` / MCP `create_proposal` kräver `bookings:write`.
Strict input: `business`, `serviceId`, `serviceVersion`, `staffId`, `start`,
samt valfritt `customerPhone` enligt SMS-labbreglerna nedan.
Pris/längd, personalnamn och plats/schema hämtas server-side. Förslaget reserverar
inte tiden. `GET /api/v1/proposals/{id}` / `get_proposal` kräver `bookings:read`
eller `bookings:write`, bara för samma stabila klient. Status: `pending`,
`approved`, `declined`, `expired`; godkänt svar innehåller `mandateId`.
Både API-nyckel och labb-OAuth fungerar. OAuth-godkännande i paket 1 utfärdar
fortfarande inget bokningsmandat.

Aktivera separat `BOOKING_CONSENT_LAB=1` på lokal loopback-origin och isolerad
`*_test`/`*_demo`. Standard-TTL 600 sekunder, `BOOKING_CONSENT_TTL_SECONDS` kan
sättas till 1–900 i tester. Endast i detta labbläge returnerar identitetsadaptern
`approvalUrl` till anroparen. Öppna länken i webbläsare: `/consent/{id}#<token>`.
Fragmentet skickas inte i sidans HTTP-URL; sidan tar bort det ur adressfältet och
skickar det endast i kundytans POST-body, aldrig i loggar eller `/live`.
Kundytan kräver verifierad loopback-socket, samma Origin och separat kundtoken;
Authorization/x-api-key nekas även med en giltig kundtoken. Kundytan är inget
agentverktyg. Sidan visar syntetiskt namn, tjänst/tid i Stockholm, personal,
salong/plats, SEK, längd och utgång före Ja/Nej.

Ja låser förslaget, förbrukar länken och skapar ett `customer-consent`-mandat i
samma transaktion. Nej/utgång/återanvändning ger inget nytt mandat. Mandatet är
engångs för exakt tjänst/tid/personal/plats/schema/pris/längd/klient; både aktuell
bokning och lagrat förslag jämförs med mandatets SHA-256. Ändrat katalogpris eller
längd kräver ett nytt förslag och nytt godkännande. Mandatet löper ut samtidigt
som länken. Agenten slutför via befintlig booking-route med `mandateId`, samma
idempotensnyckel vid retry och `confirmed=true`. Ingen betalning införs.

`CustomerIdentityProvider` i `customer-identity.ts` kapslar labbets credential,
identifiering och leverans. Det är en innehavarbaserad syntetisk identitet,
**inte verifiering av en riktig kund eller tekniskt bevis på att en människa
klickat**. Eftersom agenten får länken i labbet kan den efterlikna en webbläsare;
frånvaro av Bearer bevisar inte mänsklighet. Före skarp drift ska adaptern ersättas
med oberoende kundidentifiering/leverans; godkännandehemligheten får då aldrig gå
till agenten. Skarp metod är inte beslutad. Ingen extern e-post-/SMS-leverantör eller annan
extern plattform används; SMS-kod simuleras lokalt enligt nedan.
Operatorns gamla `issueSyntheticMandate` och fixtures är oförändrade och exponeras
inte via REST/MCP. Den nya additiva migrationen behåller gamla operatörsmandat
med null `proposalHash` och utökar endast ursprungskontrollen till kundflödet.

## Paket 4: separat operatörsaudit

`AgentAuditEvent` är en separat append-only-logg, aldrig källa till `/live`.
`recordAudit` validerar en fast fältlista och skriver bara id, kända scopes,
händelsetyp, statiskt utfall och route/verktyg. Servergenererat UUID följer
REST/MCP-anropets underhändelser; inkommande korrelationsheaders ignoreras.
OAuth-klientens id loggas bara efter att det har hittats i labbets register.
Inga tokens, koder, PKCE-värden, kundfält eller länkcredentials sparas.

Händelser: `oauth.client_registered`, `oauth.register_denied`,
`oauth.authorize_granted`, `oauth.authorize_denied`, `oauth.token_issued`,
`oauth.token_denied`, `agent.request`, `proposal.created`, `proposal.viewed`,
`proposal.expired`, `consent.approved`, `consent.declined`, `mandate.created`,
`mandate.consumed`, `mandate.expired`, `booking.created`, `booking.cancelled`.
Utfall är HTTP-status, statisk felkod eller pending/success/booked/cancelled/
expired/ursprung. Replay skapar ingen ny `booking.created` eller förbrukning.
MCP loggar både transport och körda verktyg; transportstatus 200 kan innehålla
ett verktygsfel, vars egen auditrad bär felkoden.

`GET /api/admin/audit` kräver befintlig adminsession; API-nyckel och OAuth-token
räcker inte. Filter: `from`, `to` (ISO UTC), `clientId`, `requestId`, `proposalId`,
`mandateId`, `bookingId`. `chain=true` plus ett förslags-, mandat- eller
boknings-id följer de serverlagrade länkarna. Resultatet ordnas på createdAt/id,
max 200 rader, med `nextCursor` som skickas som `after` med samma filter.
Befintliga identitetslänkar måste finnas för full kedjeupplösning.

Audit skrivs efter lyckade verksamhetstransaktioner, utan kundfält. Fel ger
bara `AGENT_AUDIT_WRITE_FAILED` och ändrar inte verksamhetsutfallet. Detta är
best effort, inte atomär eller garanterat komplett audit: processavbrott och
skrivfel kan ge luckor. DB-trigger nekar UPDATE/DELETE på den nya tabellen;
appmodulens mutationskapabiliteter kastar. DB-ägare kan fortfarande ändra DDL
eller TRUNCATE; detta är ingen kryptografiskt manipulationssäker logg.
Testauditrader bevaras även när deras fixtures städas, utan foreign keys.

Betalning är inte implementerad. Se [Mandat och betalning](MANDATE_VS_PAYMENT.md).

## Steg 5: simulerad SMS-kod, endast lokalt labb

Två lager aktiverar kravet: `BOOKING_SMS_OTP_LAB=1` och verksamhetens id i
`BOOKING_SMS_OTP_BUSINESSES` (kommaseparerad, exempelvis `demo,lab-partner`).
Labbet kräver dessutom `BOOKING_CONSENT_LAB=1`, loopback-origin, runtime som
inte är Vercel samt befintlig loopback-DB-vakt för `*_test`/`*_demo`.
Flaggorna är labbets ersättning för en framtida per-salong-inställning; ingen
ny inställningstabell införs. Osatt/tom lista eller avstängd labbflagga ger
befintligt länk + Ja utan kod. `customerPhone` avvisas då med `invalid_request`.

När båda lagren aktiverar verksamheten krävs `customerPhone`: strikt E.164
med labbets syntetiska prefix `+46700…` och exakt sex efterföljande siffror.
Detta är en lokal syntetisk konvention, **inte en reserverad svensk nummerserie**;
använd aldrig verkliga kundnummer. Kravet sparas som `smsOtpRequired` på
förslaget och kan inte tas bort genom senare flaggändringar. Befintliga
förslag och operatorns `issueSyntheticMandate` fortsätter fungera oförändrat.

Rå telefon lagras aldrig. Förslaget innehåller endast purpose-prefixad SHA-256
(`sms-phone-v1:`), helt maskerad nummersuffixvisning, kodhash och tids-/försöksfält.
`SmsSender` är injicerbart. Enda implementationen `SimulatedSmsSender` skriver
kod och hash/maskerad destination till en begränsad processlokal labbuffert
(högst 1000 meddelanden). Inget skrivs till vanlig konsol eller disk, inga
HTTP-anrop eller nycklar används. Lokal operatör/testkod kan läsa bufferten
via `simulatedSmsSender.read()`; ingen REST/MCP-route exponerar den. Omstart
eller buffertgallring förlorar meddelandet; kunden kan begära omsändning.
Ett skarpt leveransgränssnitt och en SMS-leverantör är inte beslutade/inkopplade.

Koden har sex kryptografiskt slumpade siffror och lagras endast som SHA-256
av `sms-otp-v1:<proposalId>:<code>`. Standardgiltighet är 600 sekunder;
`BOOKING_SMS_OTP_TTL_SECONDS` tillåter 1–900 för tester. Fem felaktiga Ja
(inklusive saknad kod) spärrar även en korrekt kod tills omsändning.
`BOOKING_SMS_OTP_RESEND_SECONDS` är minstaintervall mellan utskick,
standard 60, testintervall 1–900 sekunder. Omsändning kräver giltig, oanvänd
kundlänk; den nollställer försöken och gör den gamla koden ogiltig.
Förslagets egen utgång gäller alltid, även efter omsändning.

Kundytans strict POST accepterar valfritt `code` och beslutet `resend` utöver
`view|yes|no`. View och Nej kräver ingen kod. SMS-krävande Ja kräver korrekt,
ännu giltig kod och förslagshash. Felaktiga försök sparas innan nekandet
returneras; samma radlås serialiserar försök, omsändning och Ja. Bara ett
mandat kan skapas. Mandatet behåller `origin=customer-consent` och får
`verifiedVia=sms-otp`; äldre mandat och operator-mandat lämnas null.
Märkningen är inget nytt ursprung och ändrar inte gamla mandatkontroller.

OTP returneras **aldrig till agenten**, inte heller i approvalUrl. Telefonmask
visas endast på kundytan; agentens statusprojektion är oförändrad. Befintliga
Origin-, socket-, auth-, storleks- och felskydd på kundytan består.
`sms_otp.sent`, `sms_otp.resent`, `sms_otp.verified`, `sms_otp.denied` lägger till
append-only-audit med id och statiskt utfall, inga kund-/kod-/tokenfält.
Försök/omsändning/verifiering auditeras i samma DB-transaktion; första utskick
är, liksom befintlig förslagsaudit, best effort efter att förslaget skapats.
Processbufferten är inte transaktionell: vid ett commitfel kan ett simulerat
meddelande finnas utan giltig kod i DB. Ingen bokningsrätt följer av meddelandet.
Detta labb bevisar varken riktig kundidentitet eller mänskligt mandat.

Additiv migration: `20261116000000_sms_otp_lab`. Historiska migrationer och
append-only-triggern lämnas orörda. De isolerade databaserna
`booking_lab_gw_suite_test` och `booking_lab_gw_e2e_test` på `127.0.0.1:55434`
behöver `prisma migrate deploy` via `scripts/test-db-guard.mjs` före extern
verifiering. Prisma CLI:s vanliga config läser `.env`; använd en separat
explicit config utan dotenv om en sådan fil inte får läsas.
