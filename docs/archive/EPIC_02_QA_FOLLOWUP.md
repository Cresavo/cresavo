# Epic 02 — första QA-rättningsvarvet

2026-11-12. Oberoende rapport: [Grok fc83a70](qa/QA-REPORT-epic02-fc83a70.md), [fixbeställning](qa/FIX-REQUEST-epic02-fc83a70.md). Rapportens egna kommandon och extra belastningsprober är Groks resultat, inte nya Codex-körningar.

## Åtgärder i kod 3cd633b

- **E02-QA-1:** det nya verktygets strikt validerande StandardSchemaWithJSON-adapter återanvänder Zods JSON-schema. Den fångar valideringsfel före callbacken och använder safeFailure; SDK får endast godkänd statisk text. Inga privata SDK-metoder patchas, inga nya beroenden eller mildare regler införs. Stdio-testet kräver exakt isError + `Kontrollera uppgifterna` för okänt fält, fel typ, confirmed=false, för lång nyckel, annan e-postdomän och fel datum, utan DB-skrivning eller rå fellogg. Publicerat schema måste fortsatt ha additionalProperties=false och obligatoriska fält.
- **E02-QA-2 (idé):** dokumenterad begränsning i ARCHITECTURE, DATA_FLOWS och PRIVACY_SECURITY. Prisma 6 kan autoläsa projektets .env och tillföra hemligheter även när mcpEnvironment vitlistar explicit export. Ingen miljöisolering påstås. Vår negativa start använder uttryckligt tom hemlighet; Groks separata prob verifierade helt saknad hemlighet utan .env-konfiguration. Ingen manipulation av operatörens .env i testerna.
- **E02-QA-3 (idé):** gemensam idempotensnamnrymd är dokumenterad i README och arkitektur. Ett nytt E2E-test visar MCP → riktig HTTP-replay med samma id och 409 för ändrad payload. Ingen namnrymdsändring eller migration görs.
- Samma E2E-test kör 20 blandade riktiga HTTP/MCP-anrop för överlappande 30/60-minutersbehandlingar. Exakt en vinnare, endast förväntade konfliktfel och SQL-self-join utan överlapp krävs. Desktop och mobil passerade i den riktade körningen (2/2, 23,9 s).

Den riktade nya stdio-sviten passerade 8/8 efter saneringsändringen (9,00 s). Full slutmatris körs därefter på 3cd633b; aktuell tabell uppdateras i VERIFICATION när körningen är färdig. Detta dokument är inte ett oberoende slutgodkännande.

## Inspelning: faktisk avvikelse

Första produktionsdemon på ren 18b2ac5 blev **FAIL 1/4**, inte en godkänd slutdemo. Desktopens nya agentflöde hann verifiera bokning, skyddad admin, maskerad e-post och rätt tid, men `page.screenshot` fastnade efter `fonts loaded` och nådde testets befintliga 60-sekundersgräns. Övriga tre inspelningsflöden passerade. Partiellt galleri: `demo-artifacts/2026-11-12T00-01-06-273Z/index.html`, manifest status FAIL; 13 PNG och 4 WebM, den misslyckade videon räknas inte som verifierat flöde.

Diagnostik utan produktändring: statisk skärmdump med normal rendering och mjukvarurendering PASS; samma prov med video och fullPage PASS i båda lägen. En riktad körning av den verkliga desktop-agentinspelningen med filtrerad Playwright API-diagnostik blev 1/1 PASS (6,4 s); screenshot tog 55 ms. Artefakt `demo-artifacts/render-diagnostic-18b/`. Rotorsaken till första fastningen är **inte fastställd**. Inga timeoutgränser, bokningsregler eller testkrav sänktes. Inspelningens tillförlitlighet redovisas separat från den godkända funktionella E2E-matrisen; en ny full slutdemo provas först efter QA-rättningen och sluttesterna.

Den nya fulla slutdemon på ren 7a65aee (produktkod 3cd633b) gav **4/4 PASS**, 1,2 min, 14 PNG och 4 WebM: `demo-artifacts/2026-11-12T00-27-19-502Z/index.html`. Timeoutgränserna är oförändrade. Detta är den giltiga slutdemon; första FAIL-försöket bevaras och rotorsaken påstås inte vara fastställd eller permanent löst. Bilder 07 på desktop/mobil är granskade, videor inte genomtittade i sin helhet.
