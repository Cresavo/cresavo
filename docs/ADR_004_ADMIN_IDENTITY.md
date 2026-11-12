# ADR 004 — liten individuell adminidentitet

2026-11-12. Produktägaren valde individuell adminåtkomst som nästa steg. Bas 10175ed; plan bf290d5. Beslutet avser lokal syntetisk POC, inte pilot.

## Beslut och motiv

Behåll den befintliga signerade cookien, endast tokenhash i AdminSession, databasåterkallad logout, globala sessionsversionen och våra HTTP-/proxy-/spärrgränser. Tillför ett litet AdminUser-register, versionskontrollerad kontobunden login och lokala operatörskommandon. Inga publika registrerings-/återställningsendpoints.

Använd exakt **@node-rs/argon2 2.2.2** för lösenordshash och verifiering, inte egen kryptografisk implementation. Argon2id, version19, minne19456KiB, två iterationer, parallellism1 och32bytes utdata; biblioteket genererar slumpmässigt salt och ett PHC-format. Parametrarna motsvarar [OWASP:s rekommenderade miniminivå](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Lösenord är15–128tecken, utan automatisk trimning eller skiftlägesändring. Kontoidentifieraren normaliseras separat. Ingen pepper-/nyckelplattform införs.

Högst fyra pågående lösenordsoperationer per process, ingen obegränsad kö. Befintlig per-klientreservation måste göras före asynkron verifiering. Okänt/spärrat/främmande konto verifieras mot en offentlig dummyhash med samma kostnad och ger samma generiska fel. Inget resultat/inget hashvärde loggas.

AdminUser har id, unik normaliserad syntetisk e-postidentifierare, passwordHash, businessId, active och credentialVersion. Endast demo-kontext får webbadministration. AdminSession får nullable userId: gamla rader utan konto behålls men nekas. Ingen automatisk konvertering av ADMIN_PASSWORD till ett konto. Senare kontoåteraktivering får inte återuppliva äldre sessioner.

Efter lösenordsverifiering måste login låsa kontoraden och återkontrollera active, businessId och credentialVersion före sessionsskapande. Spärr/lösenordsåterställning uppdaterar kontot och återkallar dess sessioner i samma transaktion och samma låsordning (konto→session). Därmed kan en gammal verifiering inte skapa en ny giltig session efter återställning. Bokningsmotorns låsordning ändras inte.

## Bortvalda alternativ

- Full Better Auth1.7.21 är självhostad och stöder Prisma7, men skulle i denna batch ersätta redan granskade sessioner och införa ytterligare tabeller/endpointsyta. Dess standardmodell lagrar ett sessionstokenfält; vi vill bevara vår befintliga hashbaserade lagring. Det är ett integrations-/scopebeslut, inte ett generellt säkerhetsomdöme om biblioteket. Ingen full provider installeras.
- @better-auth/utils0.5.1/password provades separat. Den lästa Node-implementationen verifierar med vanlig strängjämförelse och en separat scrypt-konfiguration. Vi kopierar eller modifierar inte den implementationen.
- Egen KDF-/hashkod väljs bort. Extern hosted identitet, egen OAuth, social login och mejltjänst krävs inte för två lokala syntetiska administratörer. Ett fullständigt authbibliotek bör omprövas inför MFA/extern drift; detta är fortsatt egen liten applikationsauktorisering med kvarstående underhållsansvar.

## Licens, audit och beroendekostnad

Separat testinstallation: @node-rs/argon2-wrapper och Windows x64-plattformspaket2.2.2; audit exit0 med0fynd. Faktisk wrapper-LICENSE är MIT, copyright LongYinan. Plattformspaketet deklarerar MIT och innehåller nativebindningen. Rootlicens och metadata ersätter inte full granskning av alla native/transitiva byggartefakter vid framtida distribution; bevara originalnotiser och verifiera relevant byggkälla då. Inga binärer kopieras till Git. De två Better Auth-probpaketen installeras inte i appen.

Ett nytt direkt beroende och plattformsvalda nativepaket är motiverade av en underhållen lösenordsimplementation. Låsfilens nya poster och full/prod audit granskas efter projektinstallation; befintliga ESLint- och CLI/EPL-frågor kvarstår separat. Ingen ny telemetri-/nätverkstjänst konfigureras av applikationen; ingen generell egressgaranti påstås utan mätning.

## Kontrakt och avgränsning

POST /api/admin/login kräver nu email och password, med generiskt401 vid fel. Det är en avsiktlig brytning av gamla password-only-login; inga boknings-, kampanj- eller MCP-kontrakt ändras. Ingen fallback till ADMIN_PASSWORD. Cookieformat/åtta timmar/global versionshöjning bevaras, men gamla konto-lösa sessionsrader ger403.

MFA, verifierad e-postleverans, kontorecovery via webben, revisionslogg och kundernas GDPR-livscykel ingår inte. Pilot förblir NO-GO. Visa kund-e-post är fortsatt undantagen.
