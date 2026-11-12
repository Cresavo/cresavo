# Underlag för ChatGPT-granskning

Privat repo: https://github.com/niclasvestlund-YT/booking-lab-se

## Kort text att skicka

Granska Booking Lab SE som lokal syntetisk POC. Epic 02 och03 är färdiga på egna brancher; båda finns i Epic04:s historik. Aktuell branch är epic-04-individual-admin. Läs AGENTS.md, docs/PROJECT_STATUS.md, VERIFICATION.md, HANDOFF.md, EPIC_04_PLAN.md och ADR_004_ADMIN_IDENTITY.md samt originalrapporterna i docs/qa.

Epic04 ersätter delat adminlösenord med individuella syntetiska konton, Argon2id och kontobundna återkallbara sessioner samt lokal dold konto-CLI. Bas10175ed; första kod3419973 och avgränsad QA-fix471f91f för att KDF-kapacitetsavslag inte ska skapa en lång klientspärr. Rätt lösenord nekas fortfarande från redan spärrad klient. De tre historiska migrationerna, bokningsmotorns lås/exclusion och MCP-kontrakten är bevarade.

Bedöm konkreta regressions-, säkerhets- och underhållsfynd mot acceptanskriterierna. Skilj verifierade körningar från rekommendationer och NOT RUN. Full audit har7måttliga utvecklingsverktygsfynd och0höga, produktionsaudit0. Separat auditjobb ska vara synligt rött tills den kända kedjan kan rättas säkert; granska samtliga fyra E2E-jobb per exakt revision i Actions. Slutstatus står i VERIFICATION, inte i denna statiska sammanfattning.

Pilot är fortsatt NO-GO: MFA och identitetslivscykel, kund-GDPR(export/radering/retention), verklig TLS/proxy/flerinstansdrift, kvarstående audit-/distributionslicenser och beslut om Visa kund-e-post. Ingen publik MCP, betalning, journal, OAuth-plattform eller full multi-tenancy byggs här. Föreslå större förändringar separat. Ingen merge till main, deploy eller extern publicering ingår.

## Tillgång och demo

Privat repo kräver att ChatGPT har uttryckligen ansluten åtkomst, annars kan produktägaren bifoga en rensad käll-ZIP. Skicka aldrig .env, cookies, databaser eller riktiga kunduppgifter. Källkodens ZIP och Git innehåller inga lokala demoartefakter; se DEMO.md för reproduktion och exakt äldre bildrevision. Artefakternas lokala sökvägar fungerar bara på PC:n.
