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
Strict input: `business`, `serviceId`, `serviceVersion`, `staffId`, `start`.
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
till agenten. Skarp metod är inte beslutad. Ingen e-post/SMS/extern plattform används.
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
