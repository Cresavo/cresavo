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
