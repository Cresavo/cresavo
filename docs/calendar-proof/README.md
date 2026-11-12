# Kalenderprov – genomfört lokalt och avgränsat QA-godkänt

Godkänt 2026-11-12: lokal läsande MCP, två syntetiska kalenderunderlag,
manuell bokning i befintlig webb och avgränsad Grok-granskning. Ingen drift.
Produktbas 7c1407d, dokumentbas b8de748. Planändringarna bevaras.

## Status

Aktuellt 2026-11-13: [faktiskt genomförande](COMPLETION_2026-11-13.md).
Direkt MCP fungerar nu även i originalchatten. Efter CUA-reset och ny
Chrome-anslutning kunde samma syntetiska bokning slutföras i lokal webb,
ses i admin och ett gammalt tidsval nekas med bevarat kundutkast. Exakt1bokning,
0överlappar,0aktiva provadmins. Bokningen behålls. Nedan är daterad historik,
inte kvarstående blockerare. Grok har mottagit fryst provpaket v1 för riktad
artefakt-/bildgranskning: [GO för det lokala provet](QA_FINAL_REVIEW.md), inga
blockerare. Grok räknade kalenderfallen och granskade bilder, körde inte systemet.
Provservern stoppad, konto inaktiverat; ingen ny drift eller kundpilot.

SDK-skriptets fasta facit kräver ursprungligt tomt bokningsläge. Kör det inte
som en allmän tillgänglighetskontroll efter slutbokningen; den ändrar med
avsikt tillgängligheten. Det återställer/raderar aldrig data automatiskt.

### Ny lokal chatt: direkt MCP rapporterat fungerande

Niclas visade en skärmbild från den nya lokala chatten: båda MCP-verktygen
finns där och direkt list_services rapporteras returnera Fotvård 60 min/650 kr
och Massage 30 min/450 kr. Det är användarens skärmbild av den andra chattens
resultat; denna gamla chatt har inte läst dess verktygsspår. Ny session löser
alltså enligt detta underlag exponeringen, medan exakt intern orsak i den
gamla sessionen inte är fastställd. Ingen ny tunnel eller produktändring behövs.
Fortsätt själva agentprovet i den nya lokala chatten, med befintliga fixtures
och samma isolerade databas. Direkt get_availability, kalenderjämförelse,
slutbokning/konflikt och fullständig fryst Grok-återkontroll återstår.

### Efter omstart: delprov verifierat, direkt agentanslutning blockerad

Senare kontroll med appens faktiska binär 0.166.0-alpha.6 (installerad
0.153.2 i PATH var en annan version): samma initiering och katalogprov PASS,
toolsError=null och exakt list_services/get_availability. Versionsskillnaden
förklarar därmed inte ensam felet. Aktuell chatt exponeras fortfarande utan
Booking Lab-verktyg; ingen funktion för omladdning av chattens verktygskatalog
finns bland dess tillgängliga verktyg. Att en ny lokal konversation skulle
lösa detta är ännu en hypotes som måste verifieras, inte ett färdigt resultat.
Ingen ny tunnel/plugin, ändrad autentisering, ominstallation eller drift
har införts under denna diagnos. Fullt agentprov fortsatt öppet.

Fördjupad diagnos: Codex CLI 0.153.2:s egen lokala `app-server --stdio`,
via `initialize` och `mcpServerStatus/list`, returnerade booking_calendar_demo
med serverInfo booking-lab-se 0.1.0 och båda verktygens fulla scheman.
Detta är Codex protokoll-/katalogbevis, inte agentens verktygsanrop.
Ingen modellkörning, ny agentintegration eller beständig tjänst startades;
diagnostikprocessen avslutades. Inga konfigurations-/säkerhetsändringar gjordes.
AuthStatus unsupported avser stdio utan OAuth, inte saknad admininloggning.

Loggdatabasen lästes read-only: ett tidigare thread/start-försök avslutades
Cancelled. Det bevisar inte orsaken i denna chatt. Ingen generell launcher-
eller protokollinkompatibilitet reproducerades. Sessionens verktygsexponering
är fortsatt blockerad. Appens AX-innehåll kan läsas, men input misslyckas med
saknad fönstergeometri och screenshot timeout. Niclas har ombetts kontrollera
just serverns status i appens MCP-inställningar; ingen ny omstart på chans.

Codex-chattens tillgängliga verktyg innehöll fortfarande inte Booking Labs
verktyg efter Niclas omstart. `codex mcp get booking_calendar_demo --json`
visar enabled=true; SDK-handshake med exakt konfigurerat kommando från
C:/Users/<user> lyckas. Orsaken till utebliven chattexponering är inte fastställd.
En ytterligare omstart rekommenderas inte utan ny diagnos.

`node scripts/calendar-proof.mjs` (samma kod kördes först under .vercel) provar
verkliga MCP-anrop och jämför intervallen deterministiskt. PASS: läsverktygslista,
en match, två matcher, ingen match och två DST-konverteringar. Anrop och resultat
finns i `sdk-results.json`; inga kalenderfält skickas som verktygsargument.
Detta bevisar inte direkt agentverktygsåtkomst, omfattande DST-bokningshantering,
fullbokad salong eller slutförd bokning. Ingen ny bokning har skapats.

Grok har fått ett fryst textunderlag v1 med exakta intervall, algoritm, våra
resultat och ovanstående begränsningar via befintlig konversation. Beställningen
är textgranskning, inte en påstådd egen körning av hela systemet. Slutbedömning
har mottagits: [sammanfattning av faktisk textgranskning](QA_TEXT_REVIEW.md).
Facit korrekt, inga egna Grok-körningar och inget GO för full agentintegration.
Riktad ESLint av provskriptet PASS. Full lint/test/build och nya UI-/konfliktprov
är inte körda i denna omgång. Ingen kodändring i applikation/domän/MCP eller migrationer.

### Uppdatering: Niclas valde Codex

Claude-inloggning behövs inte. Codex CLI 0.153.2 stöder lokal stdio, enligt
installerad hjälp och [officiell dokumentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Lokal MCP `booking_calendar_demo` har registrerats med en ignorerad operatörs-
launcher i `.vercel/calendar-mcp.ts`. Den läser endast den nya privata lokala
profilen, kontrollerar loopback och exakt `booking_calendar_agent_demo`, och
startar befintlig server utan admin-/skrivflaggor med befintlig miljövitlista.
Ingen credential i Codex-kommandot eller Git. Tas bort med
`codex mcp remove booking_calendar_demo` när provet avslutas.

Faktiskt kört: ny lokal databas skapad utan att återanvända/radera befintliga,
`prisma migrate deploy` och grundseed PASS. SDK-anslutningsprov PASS:
exakt list_services/get_availability tillgängliga, verkliga anrop lyckades.
Massage kostar 450 kr, tar 30 minuter; Anna har 17 november 16:30 ledigt vid
anslutningsprovet. Detta är SDK-bevis, INTE ett direkt agentanrop i denna chatt.

Nästa steg: starta om Codex-appen på PC:n och fortsätt samma konversation.
Dokumentationen anger omstart efter MCP-konfiguration. Kontrollera att de nya
verktygen faktiskt visas innan agentprovet körs. Ingen publik tunnel, extra
modellkörning eller ny betaltjänst har startats. Grok-QA och boknings-/negativa
prov återstår. Äldre förberedelsestatus nedan gäller före klientbytet.

- Claude Code 2.1.268 finns på PC:n och har stöd för explicit MCP-konfiguration.
- `claude auth status` returnerade exit 1, loggedIn=false, authMethod=none.
  Faktiskt agentprov väntar på befintlig kontoinloggning. Ingen API-nyckel,
  prenumeration eller annan klient har konfigurerats som genväg.
- Befintlig Booking Lab QA-konversation i Chrome kan nås. Ingen granskning
  beställd ännu; en fryst faktisk leverans krävs först.
- Kalenderunderlagen är förberedda, inte verkliga kalenderanslutningar.
- MCP-körning, separat ny demodatabas, bokningsprov, negativa funktionstester
  och Grok-QA är ännu INTE KÖRDA. Previewn är oförändrad.

## Kalenderunderlag och fråga

`work.json` och `private.json` innehåller endast upptagna tidsintervall.
Ledig tid får bara härledas inom underlagens coverageStart/coverageEnd.
Intervall är halvöppna: en behandling får börja exakt när en upptagen tid slutar.
Tidszonen är Europe/Stockholm. Inga namn, deltagare, adresser eller mötestitlar.

Fråga till agenten:

> Hitta Massage den 16–20 november 2026, med start tidigast 16:00. Jämför
> båda bifogade syntetiska kalendrarna med verklig tillgänglighet från Booking
> Labs list_services och get_availability. Visa högst två alternativ med
> utförare, längd, pris och svensk dag/tid. Använd bara läsverktygen. Skicka
> inte kalenderunderlagen till Booking Lab. Boka ingenting. Om bara en tid
> passar, visa en; om ingen passar, säg det och föreslå ett ändrat sökfönster.

Facit för kalenderjämförelsen, INTE påstående om faktisk salongstillgänglighet:
med en 30-minutersbehandling och salong stängd 17:00 kan endast tisdag 17/11
16:30 passa. Alla andra vardagar 16:00–17:00 blockeras av minst en kalender.
För två möjliga alternativ: ta bort endast onsdagens privata upptagna intervall
i en separat kopia; onsdag 18/11 16:00 blir då kalenderkompatibel. Agenten måste
fortfarande fråga salongen, aldrig utgå från facit som tillgänglighetskälla.

Efter datumen måste fixtures uppdateras tillsammans med facit före omkörning;
systemklockan eller bokningsreglerna får inte ändras för att acceptera dåtider.

## Återstående verifiering

1. Inloggad befintlig klient, separat loopback `_demo`, befintliga migrationer
   och grundseed. Starta MCP utan --admin, --allow-bookings eller --allow-workspace.
2. Verkliga MCP-anrop, två-alternativsfall, en-alternativsfall och fullbokat.
3. Kontrollera tidszon/sommartid separat; inga kalenderfält i MCP-argument/loggar.
4. Slutför vald tid manuellt i lokal kundvy, se bokningen i samma lokala admin;
   kontrollera konflikt när tiden hinner tas. Ingen skrivbehörighet åt agenten.
5. Fryst underlag och faktisk körning till Grok, högst två samlade fixvarv.
   Skilj agentprov, deterministiska tester och Groks prov från varandra.
