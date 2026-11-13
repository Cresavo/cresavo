# Produktägarrapport — lokalt MCP-kort till admin

Byggt: ett uttryckligt bekräftelsesteg som skapar en riktig syntetisk bokning
och ett begripligt kvitto. Samma bokningsmotor; dubbeltryck, retries och upptagna
tider hanteras. Tappat svar kan betyda sparad bokning och får inte starta ett nytt försök.

Prova när aktiverat: [privat PC-plugin](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3)
→ välj tid → läs sammanfattning → kryssa/bekräfta → [lokal admin](http://localhost:3187/admin).
[Steg/bilder](DEMO.md). Privat plugin uppdaterat/aktiverat med lokal bokningsprofil. PASSanrop efter PC-omstart: bookingEnabled=true och tjänsteversion1. Niclas bekräftade själv bokning i native-kortet; databasen har2skilda bokningar,1create-event vardera och0överlapp. Codex verifierade båda i faktisk skyddad Chrome-admin och öppnade10.00-bokningens detalj. Egen native-kortklickning NOT RUN.

Branch feature/mcp-card-booking-proof, produkt8126410af712bdd71d6b6a42c0a1fcc58055d28d.85unit/113integration/
3läs-UI/4boknings-UI/46webb-E2E×4 samt lint/tsc/build PASS. Audit separat7moderate
dev/0prod. Grok **GO för avgränsad syntetisk lokal POC;4Low/1Info i backlogg,0Medium+**. [Groks originalrapport](qa/QA-REPORT-card-booking-8126410.md) [Actions43430009174](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43430009174) —4gröna jobb på8126410 efter1riktad omkörning av dev0 (första försöket112/113 i gammalt refundtest, anslutnings-/testtimeout; ingen kod/testgräns ändrad, rotorsak inte fastställd).

Faktisk PC-kedja är nu bekräftad av Niclas plus DB/Codex-admin. Kvar: fysisk iPhone/Safari och
mobilanslutning. Stängt kort tappar lokal retry-nyckel; okänt utfall kontrolleras
i admin. Ingen kundpilot, ny drift eller åtkomst till riktiga kunder.

Tre motiverade nästa steg: avgränsa säker mobilanslutning; gör återhämtning
av okänt utfall robust även efter stängt kort; samla de låga gräns-/fel-/
tangentbordsfynden i en separat liten härdningsbeställning. Inget startas automatiskt.

<!-- CARD_BOOKING_CURRENT_END -->

## Historik — tidigare leverans

# Produktägarrapport — lokalt MCP-tidvalskort

[Öppna Booking Lab – tidval på PC:n](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3).
Privat plugin är installerat; faktiska MCP-anrop fungerar i denna konversation.
**Dina två PC-foton bekräftar kortvisningen. Mobilen visar inget kort och är
fortfarande olöst; egen klickning i PC-klienten är inte verifierad.**

Byggt: ett lugnt svenskt tidvalskort med behandling, utförare, pris, dagknappar
och tider. Verklig befintlig tillgänglighet, kontroll av ändrad tid och tydliga
tom-/fel-/retrylägen. Inga bokningar/reservationer, kundfält eller adminverktyg.
Ny separat lokal syntetisk databas med riktigt minimerat SQL-läskonto.

Prova: välj pluginet, be om Massage nästa vardag, tryck på en dag/tid och
Kontrollera mitt tidsval. [Steg/bilder](DEMO.md). Bilderna är från egen MCP-
testvärd, inte ChatGPT. Expandera ett eventuellt inlinekort så kan Codex
granska den faktiska vyn utan att styra själva desktopappens gränssnitt.

Branch feature/mcp-time-card; granskad kod a65f0f2, runtime8648316 med samma
produktkod.83unit/105integration/3korttester och46webb-E2E×4, lint/tsc/build
PASS. En felaktig parallell artefaktkörning rättades och omkörningen passerade.
Audit separat7moderate dev/0prod. [Faktiska utdata](VERIFICATION.md).
Grok ger GO för lokal syntetisk POC påa65f0f2, egna83/105/3/46×4 PASS,
MCP63/0. EgnaUI38PASS/2FAIL och guard20PASS/2FAIL har3Low (fokus,hoverkontrast,Vercelflaggor) och
5Info; ingaMedium+. [Original](qa/QA-REPORT-time-card-a65f0f2.md). Inget eget
ChatGPT-/mobilprov av Grok. Privat push klar; Actions43417840017 PASS:4gröna46/46 påsammaSHA.

Återstår: egen faktisk PC-klickning och ditt UX-besked. Mobilkortet är inte
fungerande hos dig; fysisk iPhone/Safari-klickning,
fjärranslutning och kundpilot ingår inte. Ingen ny drift eller abonnemang;
befintlig skyddad preview95f8071 och kund-/bokningsflöden är bevarade.

Tre nästa avgränsningar när provet är bedömt:1 faktisk klient-/UXåterkoppling,
2 besluta säker anslutning för webb/mobil om du vill dit,3 pilotgrindarna
retention/rättighetsärenden/MFA/återläsning. Ingen av dem startas automatiskt.
