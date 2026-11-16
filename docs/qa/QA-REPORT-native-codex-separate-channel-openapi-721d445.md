# QA-ADDENDUM: gatewayens exponerade OpenAPI, 721d445 + f9b8506

Tillägg till QA-REPORT-separate-channel-721d445.md (orörd, sha256 5f6c23e070e8f14c267f2c21e67fc34db0d70c9ac39e6f535a439fc16b466617). Läsande kontroll 2026-11-16 11:31 CET (Europe/Stockholm) i befintlig ren gatewaykopia (HEAD f9b8506cee3e3cd21bd279e01addf761cd3db1ed, git status 0 rader). Ingen ny körning, inga servrar startade.

## SC-QA-5 · Låg (backlog, kontraktsdokumentation) · Gatewayens /api/v1/openapi saknar /proposals
- Var: gateway `src/server.js:29-31` serverar den statiska `openapi.yaml` på `GET /api/v1/openapi`. `openapi.yaml` har bara paths `/api/v1/services` (:24), `/availability` (:40), `/bookings` (:62), `/bookings/{id}` (:93) och `/bookings/{id}/cancel` (:101). Ordet `proposals` förekommer 0 gånger.
- Samtidigt proxar gatewayen proposals: `src/provider.js:1-2` släpper igenom `POST /api/v1/proposals` och `GET /api/v1/proposals/{id}`, och `src/mcp.js:9,17-18,38-41` exponerar `create_proposal`/`get_proposal`.
- Följd: en REST-klient som läser gatewayens spec ser inte förslagsflödet, och därmed inte heller `approvalRequired`/`approvalDelivery` eller 400 `mandate_required` på bokning. Salongens `docs/agent-api-v1.openapi.yaml` (1.4-profilen) påverkar inte gatewayens exponerade spec. Det är bara dokumentation: beteende och säkerhet påverkas inte, och MCP-klienter får verktygen via listTools.
- Status: luckan som Niclas angav är **CONFIRMED** (läsande).
- Minsta fix: lägg till `/api/v1/proposals` (POST) och `/api/v1/proposals/{id}` (GET) i gatewayens `openapi.yaml`, med samma svarsschema som salongens 1.4-profil (legacy `approvalUrl` respektive `approvalDelivery: separate-synthetic-customer`, utan url/token). Ta med 429/500 på GET (SC-QA-4). Ingen ny gatewayfunktion behövs.

## Påståenden (t129u)
| Påstående | Status |
|---|---|
| CI 43845636237 SUCCESS på 721d445 (423/211/64 webb/13 MCP-kort) | UNVERIFIABLE (CI ej öppnat) |
| Native slutmanifest 25 PASS, båda rena | UNVERIFIABLE (`--native-codex` ej kört) |
| Gatewayens server.js:29 läser statisk openapi.yaml utan /proposals | CONFIRMED |

## Bedömning
Oförändrad: GO endast för syntetisk lokal labbanvändning, inga blockerare och ingen FIX-REQUEST. SC-QA-5 läggs i backloggen tillsammans med SC-QA-1..4. Inget pilot-GO, och det här är inte riktig kundidentifiering.
