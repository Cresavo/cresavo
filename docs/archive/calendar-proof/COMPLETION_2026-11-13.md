# Kalenderprov – faktiskt genomförande 2026-11-13

Branch experiment/calendar-agent-proof; HEAD b8de748, produktkod 7c1407d.
Ocommittade planer/fixtures/provskript bevarade. Applikation, migrationer,
HTTP/MCP-kontrakt och drift oförändrade. Detta gäller lokal syntetisk POC.

## Direkta agentanrop

DIRECT_AGENT_2026-11-13.md redovisar list_services och get_availability för
16–20 november, verkliga MCP-verktyg. Även ursprungschatten får nu verktygen;
ett direkt get_availability-anrop bekräftade 17/11 16:30 före webbprovet och
ett nytt anrop efteråt saknade denna start. Endast två läsverktyg exponeras.
Kalenderinnehållet ingick inte i argumenten; ingen livekalendersynk.

Agentjämförelsen gav en match: Massage, Anna, 30 min,450 kr,
tisdag 17/11 16:30–17:00 Europe/Stockholm. Variant utan privat block på onsdagen
gav även onsdag16:00; hela privatperioden upptagen gav0. Inget kalenderkompatibelt
alternativ betyder inte fullbokad salong. SDK:s separata kontroller finns i
sdk-results.json, inte som ersättning för de direkta anropen.

## Lokal webb och konflikt

Ordinarie scripts/server.mjs, produktionsläge och 127.0.0.1:3027, samma exakta
loopbackdatabas booking_calendar_agent_demo: BOOKING_SERVER_READY observerad.
Next-konfigurationen loggade55s och total uppstart var flera minuter. Tidigare
avbrutna starter räknas inte som PASS. Ingen timeout/säkerhetsregel ändrades.
HTTP /api/services200 uppmätt248ms efter start.

Computer Use återställdes genom verktygssessionens reset och återanslutning till
befintlig Chrome. Inställningar/säkerhet ändrades inte. Första navigering och
första screenshot fick timeout; färdigladdade vyer och ersättningsbilder
verifierades därefter. Inga laddningsbilder används som bevis.

Två kundflikar valde Massage/Anna,17nov16:30 genom vanliga kontroller, med
enbart syntetiska example.test-adresser. Första fliken bekräftade:
”Din bokning är klar”, korrekt tjänst/pris/utförare/dag/tid.
Andra fliken skickade därefter samma gamla tidsval och fick:
”Tiden är inte längre tillgänglig. Välj en annan ledig tid. Dina uppgifter finns kvar.”
Den gamla tiden försvann, övriga15alternativ och kundutkast behölls.
Detta är ett stale-slot-prov, inte en ny20-anrops samtidighetssvit.

Ordinarie individuell admininloggning med tillfälligt syntetiskt lokalt konto:
dagkalender17/11 visade exakt16:30–17:00 Massage Kalenderprov Mira under Anna.
Utloggning återgav inloggningsformulär; provkontot inaktiverades via befintlig
operatörslogik efteråt. Ingen demo-bypass eller MCP-skrivbehörighet användes.

Läsande DB-bevis database-after.json: exakt1bekräftad bokning, rätt UTC-tid,
0överlappar enligt SQL-selfjoin på tstzrange &&. Den syntetiska bokningen
behålls som provbevis; inga manuella eller tidigare data raderas.

## Bilder och avgränsning

Verkliga granskade Chromium-bilder: images/confirmation.jpg, images/admin.jpg,
images/conflict.jpg. Befintlig desktopvy, ingen fysisk iPhone/Safari-kontroll
eller ny mobilcertifiering. Ingen video beställd i denna lilla provomgång.

Kört: direkta MCP-anrop; node scripts/calendar-proof.mjs-koden via identisk
.vercel-kopia; riktad ESLint(provskript) PASS; DB-frågor och faktiskt CUA-klickprov.
Inte omkört: npm ci, full lint/tsc/unit/integration/E2E/build/audit/Actions.
Befintligt produktionsbygge användes; oförändrad produktkod har tidigare
Epic06-underlag, inte nya testresultat här. Inga push/deploy eller nya kostnader.

Senare extra lintomkörningar med npx --no-install respektive direkt eslint.js
stannade utan resultat i flera minuter på denna PC och avbröts. De räknas
som AVBRUTNA, inte nya PASS. Tidigare riktad lint av samma provskript passerade.
Endast egna identifierade lintprocesser stoppades; inga övriga Node-jobb.

Grok gav därefter avgränsat GO för just lokalt syntetiskt prov efter egen
kalenderberäkning och artefakt-/bildgranskning, inga egna systemkörningar.
[Faktiskt QA-besked och mindre spårbarhetsfynd](QA_FINAL_REVIEW.md).
