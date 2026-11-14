# Backendmål — API och lokal MCP

Godkänt av Niclas 14 november 2026 efter rekommendationen om API/MCP som nästa steg.
Bas 56579bd, produkt 9a8350a, branch backend/api-mcp-pilot-proof.
Separat avgränsat mål. Design, MFA, automatisk gallring, fjärr-MCP och nya moduler
är efterföljande beslut.

## Leverans

Verifiera ägarens sammanhängande bokningsflöde genom befintliga HTTP- och lokala
MCP-ingångar. Kartlägg faktiska operationer, skydd och testbevis i ARCHITECTURE.
Återanvänd redan implementerade verktyg. Rätta konkreta kontrakts-, integritets-
eller behörighetsfel som framkommer.

## Acceptans

- Kalender och tillgänglighet läses med begränsat datumintervall och dataminimerade svar.
- En syntetisk bokning kan skapas, flyttas och avbokas via tillåten lokal ägarprofil.
  Samma bokning och historik går att följa via HTTP och i databasen.
- Utan admin eller skrivopt-in saknas muterande verktyg.
- Fel verksamhet, gamla versioner, ogiltiga indata och upptagna tider nekas säkert.
- Parallella retries skapar en ändring och en historikhändelse. Ändrad payload med
  återanvänd nyckel nekas. En misslyckad flytt behåller ursprungsbokningen.
- HTTP och MCP konkurrerar om samma tider utan överlapp eller förlorade ändringar.
- Befintliga profiler, sessionskontroller, kvoter och historiska migrationer bevaras.
- Relevanta regressioner, lint, tsc, build och separat audit får faktiska resultat.
- Grok granskar fryst revision i separat syntetisk kopia, högst två samlade rättningsvarv.
- Privat push och Actions gäller exakt levererad kod. Dokumentationsändringar efter
  QA anges separat. Ingen mainmerge eller automatisk nästa epic.

## Inventering vid start

create_booking, list_workspace_bookings, get_booking, get_move_availability,
move_booking och cancel_booking finns redan i stdio-servern. Samma domänfunktioner
används i webbvägen. mcp-workspace.test.ts täcker redan kalender, snapshots,
20 parallella flyttretries, avbokningsreplay, dataminimering och otillåtna anrop.
mcp-booking.test.ts täcker blandad samtidig bokning. Nästa kontroll är vad dessa
tester faktiskt bevisar för hela HTTP/MCP-kedjan.

En ny tom loopbackdatabas skapades för baslinjen. Migrering, seed och befintlig
integrationssvit körs där. Baslinjen passerade 125 integrationstester. Därefter passerade den utökade
MCP-arbetsytesviten 5/5 och HTTP/MCP-produktionsprovet 2/2 (desktop/mobil).
Lint, tsc och build passerade. Audit gav 7 moderate dev, 0 high/critical och
0 produktionsfynd. Dev-provet startade inte eftersom en äldre dev-server
använder samma arbetskopia; det redovisas separat från passerat produktionsprov.
Fryst QA, privat push och Actions återstår.
