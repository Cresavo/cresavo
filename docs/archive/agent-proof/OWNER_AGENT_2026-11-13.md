# Ägaragentprov — faktiskt genomfört i Codex, 2026-11-13

Kundkalenderprovet görs inte om. Detta är ägarens kapacitets-/kampanjprov på
en separat loopbackdemodatabas, inte previewns data eller en fjärr-MCP-server.

**Verklig klient:** denna Codex-konversation anropade de faktiska exponerade
MCP-verktygen via tools.*, utan shell/SDK som ersättning. Serverns pinnade
källrevision var e2e0e398de683823ffa962a4c669085f9800b6f2. Samma capacity.ts,
server.ts och workspace.ts är byte-oförändrade i slutlig produkt95f8071;
fixvarv1 ändrar kvotnycklar/kontaktborttagning, inte kapacitetsverktygen.
Webbprovet använde slutbygget95f8071 i C:-testkopian;196filer matchar Git.

Existerande booking_calendar_demo återanvändes. Isolerad källa/node_modules
i <local-state>/codex/booking-lab-owner-mcp-20261113, ren npmci/Prisma7.10.1.
Launcher kontrollerar127.0.0.1:55451, exakt booking_lifecycle_demo och9
migrationer. Vitlistad miljö, --admin --capacity-only --allow-workspace,
exakt6verktyg, ingen publik lyssnare eller kontaktåtkomst. Katalogen blev
slutligen synlig i chatten efter tidigare laddningsproblem; exakt orsak till
klientens fördröjda omladdning är inte fastställd. Användaren behövde inte
göra någon ny manuell inloggning eller ge ut nycklar för detta prov.

## Faktiska utfall

1. list_services och list_capacity_suggestions läste3tjänster/4förslag utan
   kundfält. inspect_capacity_suggestion gav16november, dagvy, Sam Demo.
2. Inom Niclas godkända syntetiska provmandat valde och annonserade Codex
   testvillkoren20%, Massage – kapacitetsdemo,16november, opublicerat. Det är
   inte ett påstående om ett nytt mänskligt samtyckes-/OAuthprotokoll.
3. create_capacity_campaign_draft gav cmweounz60000d0uamzujbnk8. Identisk
   retry gav samma id; samma nyckel med25% nekades. DB:1beslut/1accepterad
   ledgerpost för försöket. Kampanjen gäller hela tjänst+datumdagen, inte
   endast09-luckan; inget publiceras eller skickas.
4. Negativt prov confirmed=false nekades med statiskt valideringsfel.
   Ett nytt utkast på redan otillgängligt10-förslag nekades som inaktuellt.
   DB:0ledgerposter för båda nekade försöken. Det är syntetiska negativa
   indata, inte en påstådd verklig användare som svarat nej.
5. Egen faktisk CUA öppnade Kampanjer, laddade om och såg samma20%-utkast
   opublicerat. Översiktens kalenderlänk valde16november/Sam. Via Ny bokning
   valdes samma behandling och09.00 med tryck; påhittad example.test-bokning
   skapades via ordinarie webb/motor. Bekräftelsen visade09.00–09.30/450kr.
6. inspect_capacity_suggestion nekade därefter gammalt underlag. Ny MCP-
   läsning och webböversikt visade available=false men samma opublicerade
   utkast kvar, med varning. DB:1bekräftad bokning i luckan,0överlapp.

[Faktisk verktygstranskription](../verification/lifecycle/owner-tool-transcript.json)
och [separat läsande DB-kontroll](../verification/lifecycle/owner-proof-db.json).
[Utkast i admin](../assets/lifecycle/owner-agent-draft.jpg) och
[inaktuellt underlag](../assets/lifecycle/owner-agent-stale.jpg) är verkliga
desktopbilder. Tidigare2-verktygs-/timeoutstadiet är en löst klientbegränsning,
inte ett kvarvarande blockerande fel eller bevis för en viss resetmekanism.

**NOT RUN:** fjärr-MCP/OAuth/flera företag, fysisk iPhone/Safari, riktiga
kunduppgifter och en riktig människa som nekar ett erbjudande. confirmed är
fortfarande klientens försäkran. Grok ska granska detta underlag separat från
sina egna verktygs-/UIprov; ingen tillgång till vår PC eller demodatabas ges.
