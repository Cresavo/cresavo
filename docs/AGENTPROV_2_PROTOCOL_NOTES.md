# Agentprov 2 · avgränsade protokollval

Bas e890b69 är fryst på agentprov-1. Denna worktree/gren är agentprov-2;
ingen policymerge, push, PR, deploy, kontoprovisionering eller Epic 02.

## USP-upptäckbarhet, inte full wire-konformitet

Fält och namn har jämförts med [Standalone](https://usp-protocol.dev/deployment-modes/standalone/),
[profilens schema](https://usp-protocol.dev/schemas/profile.json) och
[MCP-bindningen](https://usp-protocol.dev/transport/mcp/), hämtade2026-11-15,
angiven version2026-08-20. Profilen har REST/MCP-bindningar, catalog,
availability med holds=false, bookings samt Stockholm/SEK. Checkout saknas.
Den publicerar api_key som obligatorisk autentisering för privilegierade anrop.

Detta är upptäckbarhet och fem **namnalias** över native v1. Befintliga
parametrar/svar, nycklar, mandat och kvoter gäller fortfarande. Ingen full
USP-JSON-översättning, förhandling, signering, holds, betalning eller komplett
livscykel införs. Sådan kompatibilitet får inte härledas ur tool-namnet.
Profilen märker begränsningen och pekar på egna faktiska schemas.
Metadata är read-only; inga agent-/adminkontroller blir anonyma.

/.well-known/usp och /llms.txt refererar endast operatorns validerade
BOOKING_PUBLIC_ORIGIN eller lokal loopback/PORT. Host, forwardingheaders och
requestbody används inte. Vercel-läge kräver explicit HTTPS-origin; inga
accessinställningar ändras här. Lokal HTTP är ett testundantag, inte verifierad
USP-hosting eller TLS. Alla miljöers åtkomstskydd måste kontrolleras före drift.

Alias: usp_services_list→list_services, usp_availability_query→get_availability,
usp_bookings_create→create_booking, usp_bookings_get→get_booking.
usp_services_get är ett urval ur samma behöriga servicesV1-katalog; ingen
alternativ tjänstelogik. De gamla namnen och cancel_booking finns kvar.

## Mandatjämförelse

[OSBP BookingMandate v0.1.0](https://osbp.dev/spec/v0.1.0/), revision2026-07-08,
läst2026-11-15, jämfördes semantiskt. Ingen OSBP-kod/schema har kopierats;
inga nya paket eller licensändringar införs.

| Begärd dimension | Befintligt / tillagt i Booking Lab |
| --- | --- |
| Tjänst | serviceId var redan ett exakt serverlagrat tillstånd. |
| Utförare | staffId var redan exakt avgränsad. |
| Plats/schedule | Ny locationId och scheduleId, kontrollerade mot serverns faktiska demoingång. |
| Tidsfönster | validFrom/validUntil omfattar hela behandlingen; expiresAt återkallar senare nya writes. |
| Pristak | maxPriceOre/currency jämförs med aktuellt tjänstepris; ingen agentbestämd prisuppgift accepteras. |

OSBP beskriver wall-clock för mandatfönster och offsets för expiry. Vår
befintliga native v1 använder offsets/UTC-instanter även för fönstret. Vi byter
inte tidskonvention tyst; en framtida OSBP-wire-adapter behöver uttrycklig
Stockholm/DST-konvertering. Full OSBP-konformitet, dess approval-/auditformat
och en verklig kundidentitet/samtyckesbevis hävdas inte.

Plats är nu den enda syntetiska lokalen demo-location. Varje befintlig Staff
äger exakt sitt weekly/exception-schema, identifierat som staff-schedule:<id>.
Detta är ingen ny lokal-/schemahanteringsmodul. Varken fysisk adress eller
visningsnamn används som behörighet. Fler lokaler/schemaflyttar kräver ett
separat datamodellsbeslut; då måste serverns verkliga platskälla uppdateras.

Den additiva migrationen gör äldre implicita scopes explicita med samma
plats och samma personalschema. Äldre migrationer ändras inte. Operatörens
befintliga grantanrop utan nya fält avgränsas server-side till just denna
plats/schema; ingen bred wildcard eller klientvald default. Agenten skickar
fortfarande bara opakt mandateId. Ny JSON, buyer.consent eller confirmed=true
kan inte utfärda, ersätta eller vidga ett mandat.

Tillfälliga data är enbart syntetiska. Inget kundregister eller hälsodata
tillkommer i agentvägen. Booking behåller dock namn/e-post; GDPR är inte löst.
