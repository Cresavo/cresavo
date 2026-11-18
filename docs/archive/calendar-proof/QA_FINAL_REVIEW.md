# Grok slutgranskning – lokalt kalenderprov v1, 2026-11-13

Sammanfattning av faktiskt läst svar i befintliga Booking Lab QA-konversationen:
https://grok.com/bot/497a3248-3a65-4323-841e-06ea5f3ff836
Detta är inte en nedladdad originalrapport. Grok anger originalfilen
`/workspace/qa/booking-lab-se/QA-REPORT-calendar-proof-final-v1.md` i sin miljö.

**GO endast för det syntetiska lokala kalenderprovet; inga blockerare.**
Inte pilot-, produkt- eller fullständigt agentintegrationsgodkännande.
Produktkod7c1407d; dokumentbasb8de748; branch experiment/calendar-agent-proof.
Fryst granskat ZIPv1 SHA256
8e2f014cfca14e4c0fde37445b3687e95a37a9a7777403bc89466e6fdf39e9c9.

Grok verifierade ZIP-hash/9filer, räknade själv om kalenderfallen med egen
kandidatlista och bekräftade facit1/2/0. Läste att skriptet hämtar duration
från list_services. Granskade alla3bilder: korrekt bekräftelse, nekat gammalt
tidsval med kvarvarande kundutkast samt samma bokning under Anna i admin.
UTC-tiderna i DB-artefakten stämmer med Stockholmstid.

Grok körde inte server, MCP, DB, UI eller testsviter. Direkta agentanrop och
DB-körningar är Codex bevis. Ingen server-/previewåtkomst eller hemlighet gavs.

## Mindre fynd, inget nytt rättningsvarv

- CAL-1 låg: rått direkt-MCP-transkript före/efter saknas i ZIP; sdk-results.json
  och QA_TEXT_REVIEW.md refererades men ingick inte. Våra anrop finns i chatten,
  Grok har inte oberoende verifierat dem från paketet.
- CAL-2 låg: äldre DIRECT_AGENT-delrapport saknade tydlig ersättningsmarkering.
  Rättad i dokumentationen efter QA; det frysta ZIP:et ändras inte.
- CAL-3 info:0överlappar med1bokning ger inget nytt samtidighetsbevis.
  DB-artefakten saknar SQL/databasnamn/tidsstämpel; körningens SQL och exakta
  demodatabas är redovisade i vår rapport/operatörsskript, inte återkörda av Grok.
- CAL-4 info: ingen separat logout-/kontoinaktiveringsbild, endast vår
  observation och activeAdmins0. Inte oberoende verifierat av Grok.
- CAL-5 info: konfliktprovet är sekventiellt, inte samtidighetstest.
- CAL-6 info: lokal launcher .vercel/calendar-mcp.ts saknas i paketet.
  Flytta till versionshanterad startväg om provverktyget ska utvecklas vidare.

Senare docs korrigerar status och motsägelser; ingen produktkod eller fixture
har rättats efter granskningen. Ingen ny full QA eller obegränsad fixloop.
