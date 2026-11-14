# En komplett bokningsdag — manuellt och via agenter

## Uppföljning godkänd 14 november 2026

Niclas bad genomföra de tre rekommenderade nästa stegen. Bas7998056,
separat branch feature/agent-client-pilot-readiness. Bevara tidigare granskning.

1. Kontrollera de verkliga Booking Lab-verktygen i den aktuella Codex-klienten.
   Redovisa läsning och bokning separat. Ingen ny fjärranslutning, modellnyckel
   eller utökad klientbehörighet följer av ett lyckat SDK-prov.
2. Märk nya lokala A2A-bokningars skapandehändelse med tekniskt kanal-id och visa
   Lokalt A2A-prov/Local A2A demo i befintlig skyddad bokningshistorik.
   Befintlig public-aktörstyp består; ingen omskrivning av äldre historik, ingen utökning av WorkspaceActor eller
   dess administrativa rättigheter. Webbens indata får inte välja kanaletikett.
3. Samla aktuella pilotgrindar överst i PRIVACY_SECURITY, med faktisk befintlig
   funktion, kvarvarande teknik och uttryckliga drift-/produktbeslut. Ingen
   automatisk gallring, MFA/auth-omskrivning, kunddrift eller ny infrastruktur.

Acceptans: samma A2A-retry ger samma bokning och exakt en korrekt märkt händelse;
publik bokning och äldre händelser behåller etikett; skyddad historik visar rätt
svensk/engelsk text på mobil/desktop. Verkliga klientanrop och begränsningar
dokumenteras utan att likställas med fullständigt bokningsprov. Regressioner,
lint/types/build och audit separat. Fryst Grok-QA, högst två samlade fixvarv,
privat push och exakt Actions enligt befintligt leveransmandat. Ingen deploy
behövs för enbart det lokala A2A-provet. Uppföljningen godkänner inte pilot.

Godkänt av Niclas 14 november 2026 genom ”Kör denna nu”. Bas d015141 på
backend/api-mcp-pilot-proof. Separat branch feature/complete-booking-day.
Tidigare backendbevis dbe1e1f och Grok-GO återanvänds för oförändrad kod.

## Leverans och acceptans

Tre vägar ska gå till samma kalender: ägarens manuella bokning, lokal behörig
ägar-MCP och kundens bokningslänk. Varje väg ska kunna hitta, granska och
bekräfta en tillgänglig tid. Ägarens ändringar ska gå att följa som flytt och
avbokning med historiska snapshots. Versionskontroll, kvoter, kanalavgränsad
idempotens och databasens konfliktskydd består. Kundens boknings-id ger inga
administrativa rättigheter.

Befintliga API/MCP-operationer är implementerade och granskade. Återanvänd
workspace.spec.ts, flow.spec.ts och mcp-workspace.test.ts. Komplettera endast
konkreta luckor. Mobilprov ska täcka grundflödet, nästa kund och returkontext.
Ingen större designomgång.

## Lokalt A2A-prov

Kontrollera officiell specifikation och SDK. Kandidat @a2a-js/sdk 1.3.0,
Apache-2.0, Node >=20, beroende jose. Den ersätter egen implementering av
A2A-transport/protokoll och ska endast installeras om den används i leveransen.
Läs den faktiska paketlicensen och transitiva villkor, och dokumentera audit
innan leverans. Projektets licens är fortsatt AGPL-3.0-only.

Ett separat opt-in-prov får låta en syntetisk kundagent be bokningsagenten
om lediga tider och lämna uttryckligt bekräftat val. Bokningen använder
befintlig domän/MCP, samma skydd och samma syntetiska kalender. Ingen publik
endpoint. Loopbackanslutning behöver ett avgränsat åtkomstskydd och en
isolerad loopbackdatabas. Kundprofilen får inte administrativa verktyg.
Provet dokumenterar faktiskt stödd A2A-version och vilka operationer som
testats, inte generell protokollcertifiering. Vid krav på ny drift eller
större autentiseringsarbete redovisas det separat och övriga flöden slutförs.

## Slutgrind

Ny separat migrerad/seedad PostgreSQL, relevanta regressioner, lint, tsc,
build och separat audit. Grok granskar fryst revision i separat syntetisk
kopia via befintlig konversation, högst två samlade rättningsvarv. Privat
push och Actions på exakt SHA. Uppdatera befintlig status/handoff och ge
konkreta lokala provsteg. Ingen automatisk nästa epic.

Betalningssimulering, lokal-/gruppbokning, medlemskap, journal, lager och
ekonomi är senare uppdrag. Ingen verklig kunddata, ny kostnad, offentlig
agentåtkomst, fjärr-MCP, mainmerge eller force-push.

## Implementation under verifiering

src/a2a/demo.ts startar en separat JSONRPC 1.0-loopbackserver på slumpad port.
Ett slumpat bearer-token skapas i minnet och skyddar både AgentCard och SendMessage.
Inga headers eller tokens skrivs till logg/URL. Origin-anrop nekas. Svar på
tillgänglighet ger aktuell behandling, pris, längd, utförare och Stockholmstider.
Bokning kräver confirmed=true och UUID-request-id. Den fasta syntetiska
kundprofilen använder samma createBooking och kvoter; den har ingen adminåtkomst.

scripts/a2a-demo.ts använder officiella A2A-klienten, visar sammanfattning och
kräver att operatören skriver BOKA. Enter/EOF avslutar utan bokning.
Tillåtna indata är strikt strukturerade operationer, inte fri språkförståelse.
Det här provet använder inga modellnycklar eller externa modell-/A2A-anrop.

Lokal provväg efter seedning av separat databas
1. Använd dokumenterad lokal webbstart mot loopback *_demo eller *_test.
2. Sätt BOOKING_A2A_DEMO=1 endast i den lokala operatörsmiljön.
3. Kör npm run demo:a2a -- massage staff-demo YYYY-MM-DD.
4. Välj en tid och granska behandling, utförare, längd, pris och datum.
5. Skriv BOKA eller avbryt med Enter. Öppna den utskrivna relativa kalenderadressen
   i samma lokala webbdatabas med vanlig behörig adminsession.
6. Flytt och avbokning görs i befintlig arbetsyta eller via separat lokal
   ägar-MCP; kundagentens A2A-profil saknar dessa rättigheter.

Första SDK-proben föll på saknad A2A-Version eftersom klienten först anropades
direkt som transport. Korrigerad användning går via officiell ClientFactory,
som sköter protokollversionen. TypeScript fångade också ett felaktigt antaget
SDK-fältnamn. Båda är rättade och det riktade verkliga nätverksprovet passerar.
Första pipade CLI-EOF-provet föll när readline stängts före frågan. Itererad
inläsning bevarar nu inmatningen och EOF avslutar utan bokning.

Full integration 127/127 passerade på ny migrerad/seedad bokningsdagsdatabas.
Efter sammanfattningskompletteringen passerade riktad A2A-integration 2/2,
inklusive avläsning av samma bokning genom befintlig lokal ägar-MCP.
114 unit och build passerade. 24 webbflöden för kundbokning och arbetsyta passerade i produktionsbygge
(desktop/mobil). Lint och tsc passerade. Skyddad AgentCard-upptäckt genom
officiell ClientFactory passerade i det riktade A2A-provet. Terminalprovet
valde en tid, skrev BOKA, skapade testbokningen och avbokade den genom
befintlig ägaroperation med två korrekta historikhändelser. Egna rader städades.
Detta var mellanresultatet före det samlade rättningsvarvet nedan.


## Samlat rättningsvarv 1

Första Grok-rapporten gäller4438941 och ger scoped GO med Low/Info.
Inga Medium/High. Codex skärper obligatorisk serviceVersion (A2A-QA-7),
auth401/WWW-Authenticate (A2A-QA-1), standardiserade JSON-RPC-fel med
korrelation/version (A2A-QA-2) samt 413/Connection close utan förstörd
keep-alive-återanvändning (A2A-QA-3). Riktat test täcker även chunkad body.
A2A-QA-4/5 är dokumenterade lokala begränsningar. Status/handoff uppdateras
i befintlig struktur (A2A-QA-6).

## Slutleverans

Produkt/Grok `d8562b8190f52e7b76f3d4682ec6f3b84fd35732`, samma arbetsbranch.
Actions43593764129: fyra gröna lägen, 62 webbtester vardera; 114 unit,
128 integration och 13 MCP-korttester. Lint/types/build/ren installation och
ny databas passerade. [Faktiska bevis](VERIFICATION.md).
[Groks originalrapport](qa/QA-REPORT-booking-day-f1-d8562b8.md) ger scoped GO
efter ett rättningsvarv, inga Medium/High. Ny Low om obegränsad dränering,
gemensam demokvot och public-historiketikett kvarstår som dokumenterad backlogg.
Ingen fjärrdrift, pilot, native-modellklient eller fysisk iPhone är verifierad.
Målet är avslutat; senare docs ändrar inte granskad produktkod.
