# Lokal admin — syntetisk POC

Efter `npm ci`, `npx prisma generate`, `npm run db:migrate` och seed finns inga standardkonton. Kontrollera att DATABASE_URL avser din lokala syntetiska demo, och SESSION_SECRET är minst 32 slumpmässiga tecken. Gamla ADMIN_PASSWORD ignoreras och gamla konto-lösa cookies nekas. Fjärde migrationen bevarar gamla rader och bokningsdata.

```powershell
npm run admin:manage -- create admin-a@example.test
npm run admin:manage -- create admin-b@example.test
```

Välj olika egna testlösenord, 15–128 tecken. Terminalen frågar två gånger och visar inte lösenordet. Lägg det aldrig i kommandoraden, .env, Git eller rapport. Endast syntetiska `example.test`-identifierare accepteras; normalisering gäller e-post, inte lösenord. `ADMIN_COMMAND_OK` betyder lyckat kommando; fel ger statisk kod och exit 1. Ingen mejlleverans eller verifiering finns.

Öppna `/admin`, fyll i identifierare och lösenord. Den egna identifieraren visas efter login; kund-e-post förblir maskerad. Logga ut återkallar just den sessionen på servern.

```powershell
npm run admin:manage -- reset-password admin-a@example.test
npm run admin:manage -- disable admin-a@example.test
```

Reset frågar efter nytt lösenord två gånger och återkallar kontots alla sessioner. Spärr gör kontot inaktivt och återkallar dess sessioner. Det andra kontot påverkas inte. Reset av spärrat/saknat konto nekas. Ingen återaktiveringsfunktion eller webbåterställning byggs här. Global `ADMIN_SESSION_VERSION` kan fortfarande höjas för att neka alla äldre cookies; sänk aldrig versionen.

Före lösenordsverifiering gäller befintlig fem-försöksgräns per klient i 15 minuter. Även rätt lösenord får 429 från spärrad klient; vänta på Retry-After. Högst fyra KDF-operationer pågår samtidigt per process, därefter kortvarig 429. Detta är lokal kapacitetsbegränsning, ingen flerinstanslösning.

Konto-CLI har DB-behörighet och körs endast av betrodd lokal operatör. Den får ingen generell rätt att ändra annan salong. Lokal MCP `--admin` behåller sin separata tillitsmodell och använder inte webbcookien. Ingen publik registrering, OAuth, extern identitetstjänst eller MFA är införd. Endast lokal POC, inte pilot.
