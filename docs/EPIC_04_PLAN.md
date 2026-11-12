# Epic 04 — förslag: individuell adminåtkomst

Status: **avgränsningsförslag, inte byggstart**. Bas 10175ed, 2026-11-12. Produktägaren har bett oss fortsätta; prioriteringsfrågan mellan adminåtkomst, GDPR och återstående leveranskontroller är ställd. Befintliga Epic 02/03 och deras verifieringsresultat ändras inte av denna plan.

## Resultat för produktägaren

Två syntetiska administratörer kan logga in var för sig till samma demosalong. Ett konto kan spärras och få sina sessioner återkallade utan att det andra påverkas. Det delade ADMIN_PASSWORD används inte som en dold reservväg.

Detta är fortfarande lokal POC. Individuell identitet löser inte på egen hand MFA, GDPR, faktisk TLS/proxy, distribuerat missbruksskydd eller distributionslicenser. Ingen pilotklassning följer av denna Epic.

## Avgränsning

- En befintlig demosalong; alla konton har samma begränsade administratörsbehörighet där. Ingen självregistrering, inbjudningsplattform, OAuth-server, rollbyggare eller full multi-tenancy.
- Konton skapas/spärras och lösenord återställs genom ett litet lokalt operatörsflöde. Inga mejlutskick eller externa identitetstjänster förutsätts.
- Maskerad kund-e-post kvarstår. Ingen ny kundkontaktfunktion, export, radering, lagringstid eller publik/fjärransluten MCP.
- En underhållen autentiseringslösning utvärderas först. Ingen egen kryptografi eller ad hoc-hashning väljs i förväg. Ett nödvändigt beroende kräver licensfiler, audit, kompatibilitet och motivering innan det används.
- Inga pushar, merges, deploys eller riktiga uppgifter. Historiska migrationer och databasens överlappsskydd bevaras.

## Små uppgifter och acceptanskriterier

| ID | Uppgift | Observerbart acceptanskriterium |
| --- | --- | --- |
| E04-0 | Bas och tekniskt beslut | Ren separat implementationbranch från 10175ed. Läs aktuell auth, limiter, sessionsmodell och Next-dokumentation. Dokumentera vald lösning, bortvalda alternativ, stöd för lokal drift, verkliga licenser/audit och varför beroendet behövs. Ingen kodåteranvändning med oklar licens. |
| E04-1 | Minsta kontomodell | Ny migration tillför stabilt konto-ID, unik normaliserad inloggningsidentifierare, säker lösenordsverifierare och aktiv/spärrad status samt sessionskoppling. Inga klartextlösenord. Gamla sessionsrader utan identifierat konto ger ingen åtkomst. De tre tidigare migrationerna är byteidentiska. |
| E04-2 | Lokalt kontounderhåll | Skapa två syntetiska konton med separata lösenord; duplicerad identifierare och ogiltiga indata nekas. Ingen hårdkodad standardadmin eller seedad hemlig reservinloggning. Lösenord får inte hamna i argumentlista, logg eller Git. Ny hash/verifierare och salt följer den valda lösningens verifierade gränssnitt. |
| E04-3 | Login och sessionsidentitet | Rätt konto/lösenord ger ny slumpmässig session kopplad till rätt konto; fel konto/lösenord ger samma statiska fel. Inaktivt konto och konto utanför demosalongens tillåtna kontext nekas. En gammal password-only-request eller ADMIN_PASSWORD ger ingen fallback. Cookie-/origin-/no-store-skydd bevaras. Det ändrade login-kontraktet dokumenteras uttryckligen. |
| E04-4 | Spärr, lösenordsbyte och logout | Logout gör även kopierad cookie obrukbar. Spärr eller lösenordsåterställning återkallar alla berörda kontots sessioner atomärt; andra kontots sessioner fungerar. Varje adminåtkomst kontrollerar aktivt konto och serversession. Global ADMIN_SESSION_VERSION behålls som övergripande återkallelse. |
| E04-5 | Missbruksskydd och negativa tester | Efter fem fel nekas även rätt lösenord med 429 före verifiering. I 300 samtidiga gissningar sker högst fem verifieringar från klienten. Asynkron verifiering får aldrig tolkas som ett sanningsvärdigt Promise. Misslyckade/spärrade svar har minst befintlig 100 ms-fördröjning och Retry-After. Annan klient bakom korrekt proxy kan logga in. |
| E04-6 | Webb och regression | Svensk mobil/desktop-login med identifierare och lösenord; generiskt fel utan kontouppräkning. Inloggat konto kan identifieras utan att kund-e-post avmaskeras. Obehörig admin/publish får fortsatt 403. Bokning, kampanj och lokal MCP behåller tidigare regler, kvoter, idempotens och samtidighet. |
| E04-7 | Slutgrind | Ren npm ci/generate/migrate/seed på ny isolerad PostgreSQL; lint/tsc/build, unit, integration och E2E dev/prod × proxy 0/1. Testa både uppgraderad DB och tom DB; städa egna konton/sessioner/fixtures. Rapportera full/prod audit och alla ej körda kontroller. Grok granskar en fryst revision i egen miljö; full demo en gång vid synlig Epic-leverans. |

## Konkreta risker i nuvarande kod

`checkLoginAttempt(ip, verify)` i src/lib/rate-limit.ts kräver idag en synkron callback och tilldelar `accepted = verify()`. En framtida lösenordshash verifieras ofta asynkront. Det är inte ett befintligt inloggningsfel, men en migration får inte bara stoppa in ett Promise och därmed acceptera fel lösenord. Reservationen ska ligga före varje await/verifiering och testerna måste räkna verkliga verifieringsanrop, även under samtidighet och vid undantag.

Nuvarande AdminSession saknar konto-ID och isAdmin returnerar bara bool. Ny behörighetskontroll måste koppla session → aktivt konto → tillåten demosalong på servern. Ett klientskickat businessId eller ett nytt konto i annan kontext får inte ge tillgång till den hårdkodade demodatans administration. Detta är en uttrycklig negativ kontroll, inte ett påstående att full tenant-isolering byggts.

Återkallelse ska inte bero enbart på att browsercookien försvinner. Ett spärrat konto får inte återfå gamla sessioner genom återaktivering eller lösenordsåterställning. Befintlig begränsad sessionsgallring och databasfelens fail-closed-beteende bevaras.

## Test- och QA-ordning

1. Granska autentiseringsval och migration innan de påverkar webbkontraktet. Vid oklar licens eller ett nytt drift-/tjänstekrav dokumenteras hindret; bygg inte en reservlösning som kringgår grinden.
2. Verifiera login, asynkron spärr och kontobunden återkallelse riktat, sedan bokningens befintliga regressioner.
3. Kör hela slutmatrisen sekventiellt i egen miljö. Grok får bara fryst källkod och syntetiska underlag, inte .env, cookies eller riktiga uppgifter.
4. Högst två rättningsvarv för reproducerade kriterie-/säkerhets-/kontraktsfel. Stilidéer går till backlogg. Ingen ny video per fixomgång.

## Leverans

Små lokala commits, uppdaterad DATA_FLOWS/PRIVACY_SECURITY för administratörers identifierare och sessionskoppling, kort AGENTS-guide, explicit uppgraderings-/operatörsinstruktion och aktuell VERIFICATION/PROJECT_STATUS/HANDOFF. Produktägarrapporten ska visa vad som går att prova och vilka pilotblockerare som återstår. Starta inga framtida GDPR- eller driftfunktioner på antaganden.
