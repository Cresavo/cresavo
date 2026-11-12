# Underlag för ChatGPT-granskning — Epic 05

Privat repo: https://github.com/niclasvestlund-YT/booking-lab-se. Välj **epic-05-booking-workspace**, inte äldre main.

## Kort text att skicka

Granska Booking Lab SE som avgränsad lokal produktalpha med enbart syntetiska uppgifter. Epic01–04 är tidigare verifierade föregångare. Aktuell produktkod är **4fc98d37fef805e041f8f8772a3fc37543d4ff04**, byggd på Epic04-bas26b680d enligt EPIC_05_PLAN. Privat leverans/CI-revision är **c12b98a31f844f4dc50213a72feb57db02595794**; senare commits ändrar enbart dokument. Kontrollera diffen innan du drar slutsatser om en ny kodrevision.

Läs AGENTS, PROJECT_STATUS, HANDOFF, VERIFICATION, EPIC_05_PLAN, ARCHITECTURE och CI_DELIVERY_2026_11_12 samt originalrapporterna QA-REPORT-epic05-7fc0e86 och QA-REPORT-epic05-4fc98d3 i docs/qa. Första rapporten gav NO-GO på en adminbudget; den senare stänger E05-QA-1 efter ett fixvarv och ger GO för lokal alpha. Begär ingen ny full QA av oförändrad kod.

Byggt: verklig kalender, tjänster/priser, personalens schema/paus/undantag, skapa/flytta/avboka med snapshots/historik och motsvarande lokala MCP-verktyg med separat opt-in. Samma domänregler, serverbehörighet, version/idempotens och databasskydd gäller. Fyra gamla migrationer är orörda; en ny framåtmigration ersätter exclusion atomärt med skydd för aktiva bokningar. Ingen ny npm-dependency i Epic05.

Bedöm konkreta regressions-, säkerhets-, produkt- och underhållsfynd mot planens acceptanskriterier. Codex och Grok körde69unit/66integration/24E2E×4. GitHub-manualrun43210413097 påc12b98a har4gröna E2E-jobb; feature-run43209758207 hade ett jobb och tog4m01s. Skilj exakta körningar från kodläsning/NOT RUN. Mindre QA-2–8 är dokumenterad backlogg, inte order om en obegränsad fixloop.

Grönt Verify POC betyder inte noll auditfynd: full audit FAIL7moderate/0high/critical,prod PASS0. Audit har flyttats till ett separat veckoworkflow enligt kostnadsbeslut; schemat är inte aktivt innan filen finns på default-branchen. Ingen sådan merge är godkänd här. Docs-only ignoreras, feature kör ett ben och manuellt/main kör fyra.

Pilot är NO-GO: kund-GDPR, MFA/recovery, kontobundet/distribuerat missbruksskydd, verklig TLS/proxy/flerinstansdrift, kvarstående audit-/distributionslicenser och beslut om Visa kund-e-post. Privat mobilpreview har ett konkret beslutsunderlag men ingen driftsatt URL eller miljögodkännande. Ingen merge till main, deploy, betald resurs eller ny odefinierad Epic ingår.

## Tillgång och demo

Privat repo kräver ansluten åtkomst; annars kan produktägaren bifoga en rensad käll-ZIP. Skicka aldrig .env, cookies, databaser eller riktiga kunduppgifter. Git innehåller inga lokala demoartefakter. DEMO och LOCAL_DEMO_WINDOWS anger reproduktion och exakt äldre bildrevision7fc0e86:6/6PASS,28PNG(26funktionsbilder+2laddningsbilder)/6WebM, ej full filmgenomtittning. Lokal C:-sökväg är inte en mobilåtkomlig testsite. Source4fc98d3-paketets checksumma/inventering finns i HANDOFF; Grok har verifierat faktisk mottagning i egen miljö.
