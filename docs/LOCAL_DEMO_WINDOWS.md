# Prova Epic 05 på den här Windows-datorn

Syntetisk lokal produktalpha, inte kundpilot. QA-godkänd produktkod4fc98d3, CI-verifierad leveransc12b98a. Demo7fc0e86 visar samma UI före osynlig kvotfix. Ren, seedad **booking_epic05_delivery_demo** finns på127.0.0.1:55451 efter produktionsinspelningen. **booking_epic05_final_test** är separat testdatabas. Den äldre ignorerade .env bevaras; exportera DATABASE_URL i varje ny terminal så att den gamla Epic04-databasen inte används av misstag. Dessa offentligt dokumenterade booking:booking-uppgifter gäller bara detta syntetiska lokala kluster, aldrig extern drift.

## Starta på PC:n

Öppna PowerShell. Kontrollera först att port3000 är ledig och att ingen testmatris körs. PostgreSQL kör redan under leveransen; starta bara om port55451 verkligen är stängd:

```powershell
Set-Location C:\Users\<user>\booking-lab-se
$bookingPgCtl = 'C:\Users\<user>\booking-lab-pg-test\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
$bookingPgData = 'C:\Users\<user>\booking-lab-pg-test\epic05-20261112'
# Endast om detta kluster är stoppat:
# & $bookingPgCtl -D $bookingPgData -o '-h 127.0.0.1 -p 55451' -l 'C:\Users\<user>\booking-lab-pg-test\epic05-demo-pg.log' -w start
$env:DATABASE_URL = 'postgresql://booking:booking@127.0.0.1:55451/booking_epic05_delivery_demo'
$env:TRUST_PROXY_IP = '0'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:CHECKPOINT_DISABLE = '1'
npm run admin:manage -- create admin@example.test
npm run build
npm run start
```

Välj eget syntetiskt lösenord i den dolda terminalfrågan (15–128tecken). Ingen standardadmin finns. SESSION_SECRET måste finnas lokalt och vara minst32slumpmässiga tecken enligt README; skriv inte över en egen .env och lägg inga hemligheter i rapport/Git. Vid ADMIN_ACCOUNT_EXISTS används ditt tidigare lösenord eller operatörens reset-password enligt [ADMIN_OPERATIONS](ADMIN_OPERATIONS.md). Gamla ADMIN_PASSWORD är ingen reservväg. En ren dator behöver installation och databas enligt README; den externa PostgreSQL-installationen här är ett tidigare QA-verktyg, inte ett produktberoende.

## Sex små prov

1. Öppna http://localhost:3000. Välj Fotvård eller Massage, Anna eller Erik och kommande vardag. Seed:Anna09–17,Erik10–16,måndag–fredag. Välj ledig tid och boka med påhittat namn/example.test. Bekräftelsen visar behandling och Stockholmstid. Ingen betalning.
2. Öppna /admin och logga in. Välj samma datum/personal. Prova Dag/Vecka på dator, föregående/nästa/idag och öppna bokningsblocket. Mobilen visar en kronologisk dag/lista. Kund-e-post är maskerad.
3. Klicka Flytta, välj ledig tid/utförare och spara. Kontrollera att kalendern och detaljen ändrats. Klicka Avboka och bekräfta. Visa avbokade i kalendern för historiken; kundsidan ska erbjuda den frigjorda tiden igen. Ett gammalt öppet formulär kan ge versionskonflikt: ladda då om och granska aktuell bokning.
4. Öppna Tjänster. Ändra pris/längd/buffert och spara. Kontrollera nya val på kundsidan. Den tidigare bokningens pris/längd/namn ska förbli dess snapshot. Inaktivering stoppar nya bokningar.
5. Öppna Personal & tider. Välj personal, lägg in paus eller datumledighet och spara. Kontrollera kundens verkliga tillgänglighet för båda utförarna. Ändring som krockar med aktiv bokning nekas; flytta/avboka den först. Inga bokningar försvinner automatiskt.
6. Öppna en andra PowerShell i repot och exportera exakt samma DATABASE_URL. Kör `npm run mcp:client -- --admin --workspace`. Läs varje sammanfattning och svara ja separat för tjänst, personal, bokning, flytt, avbokning och två inaktiveringar. Nej/EOF stoppar framtida skrivningar; tidigare bekräftade handlingar sparas. Titta i samma adminvy. Inga modellnycklar eller externa AI-anrop. Inaktiva syntetiska resurser och avbokad historik blir avsiktligt kvar efter fullföljd manuell provning.

Kampanjregression: kör i samma lokala miljö `npm run mcp:client -- --admin`, granska utkastet under Kampanjer och publicera manuellt. Erbjudandet syns bara inom giltighetsdatumen. Detta skickar inget till sociala medier.

## Bilder, inspelning och mobilåtkomst

[Riktigt galleri28bilder/6videor](../demo-artifacts/2026-11-12T10-29-00-935Z/index.html) · [revision/begränsningar](DEMO.md). För ny inspelning efter manuell provning: skapa en **ny** egen *_demo-DB, migrera/seeda och kör demo:record; verktyget raderar aldrig gamla data för att kunna spela in. Återanvänd inte testdatabasen som din manuella demo.

localhost på Mac/iPhone avser den enheten, inte den här PC:n. Ingen mobilåtkomlig preview är driftsatt. [Beslutsunderlaget](DEMO.md) anger skydd, region, kostnad och beslut som krävs innan någon miljö skapas. Exponera inte3000/55451 eller MCP mot internet som genväg.

## Tester och stopp

Se [VERIFICATION](VERIFICATION.md). Kör bara en testserver åt gången och använd final_test, aldrig din manuella demo. Stoppa webben med Ctrl+C. När inga tester eller andra klienter använder just detta Epic05-kluster kan det stoppas, data bevaras:

```powershell
& $bookingPgCtl -D $bookingPgData -m fast -w stop
```

Inga andra kluster/processer ska stoppas. Inget publiceras externt.
