# Prova på den här Windows-datorn

Detta är en lokal genväg för den befintliga arbetsmiljön, inte en portabel installation. För en ren dator, använd README:s Docker/PostgreSQL-instruktioner. Bara syntetiska uppgifter; ingen pilot.

Efter nattens verifiering finns en separat seedad `booking_epic03_demo` på loopback-port 55449. Testdatabasen heter `booking_epic03_test`; blanda inte ihop dem. Den ignorerade .env ställs vid avslut på demodatabasen och innehåller endast denna omgångs syntetiska lokala konfiguration. Inga riktiga lösenord eller kunduppgifter behövs.

## Starta

Öppna PowerShell i projektet. Om PostgreSQL är stoppad:

```powershell
Set-Location C:\Users\<user>\booking-lab-se
$bookingPgCtl = 'C:\Users\<user>\booking-lab-pg-test\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
$bookingPgData = 'C:\Users\<user>\booking-lab-pg-test\epic03-20261112'
& $bookingPgCtl -D $bookingPgData -o '-h 127.0.0.1 -p 55449' -l 'C:\Users\<user>\booking-lab-pg-test\epic03-demo-pg.log' -w start
npm run dev
```

Öppna http://localhost:3000. Boka en vardag med påhittat namn och example.test-adress. Gå till `/admin` och använd det syntetiska lösenordet i din lokala .env. En separat terminal kan köra `npm run mcp:client -- --admin --book`: läs förslaget och svara `ja` eller avbryt med `nej`. Enbart `--admin` provar kampanjutkastet som publiceras manuellt i admin. Inga externa modellnycklar behövs.

Om .env saknas eller är din egen konfiguration: skriv inte över den. Följ README och välj egen lokal PostgreSQL-konfiguration; denna genväg förutsätter nattens ignorerade syntetiska fil. Starta inte ytterligare server på en upptagen port.

## Tester och stopp

Tester ska köras mot den separata migrerade testdatabasen. Exporterad DATABASE_URL prioriteras över .env; använd samma lokala testuppgifter och byt endast databasnamnet till `booking_epic03_test` i en egen testterminal. Följ hela kommandolistan i VERIFICATION. Kör en matris åt gången.

Stoppa webben med Ctrl+C. När inga tester eller andra klienter använder det här klustret:

```powershell
& $bookingPgCtl -D $bookingPgData -m fast -w stop
```

Databaserna sparas. Inget raderas och inga tjänster exponeras externt. Den här PostgreSQL-installationen är ett tidigare installerat externt testverktyg, inte ett nytt produktberoende.
