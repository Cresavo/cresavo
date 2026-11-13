# Handoff — proaktiv kapacitet, kandidat 2026-11-13

Aktivt nytt mandat: docs/PROACTIVE_OVERVIEW_PLAN.md och komplett Del B i
docs/research. Bas28a48fe, branch feature/proactive-capacity-overview. Codex
ensam skrivare; ingen QA pågår. Groks originalrapport för956155f finns i
docs/qa: GO syntetisk POC, PRO-QA-1 Medium. Fixvarv1 lägger till begränsad
cursorpaginering i UI/API/MCP; riktad återkontroll väntar efter slutmatrisen.
Ingen push/deployment har gjorts för kandidaten.

Gemensam domän capacity.ts används från /admin/overview, skyddad HTTP och
befintlig lokal stdio. Ny additiv CapacityDecision kopplar källbokning/version
till beständigt beslut och högst ett kampanjutkast. Aktör före replay,
konfigurations-/personaldagslås och exclusion består. Ingen ny npm-dependency,
modell, port, autentisering eller extern utskicksanslutning.

Lokalt hittills: clean npmci571, generate/migrate/seed, lint/tsc/build,
78unit/89integration och7→8-/återseedbevis PASS. Faktiska kommandon, tidiga
misslyckade operatörsförsök och NOT RUN i VERIFICATION. Testkopian på C: är
hashad mot956155f; inga källändringar görs där. Fyra E2E-lägen42/42 vardera
på956155f; motsvarande slutmatris körs efter rättningen. Grok körde själv
78unit/89integration/42prod-E2E och egen UI/API-provning; inte fyrmatrisen.
Preview nedan är fortfarande äldre7c, inte nattens funktion.
Senare dokument-/bildbevis ska tydligt skiljas från produktcommit.

## Föregående verifierade leveranser

## Senare avgränsat kalenderprov, 2026-11-13

Lokalt på experiment/calendar-agent-proof, produktkod7c1407d oförändrad.
Direkt läsande MCP, två syntetiska kalenderunderlag, faktisk kundbokning och
adminvisning samt nekat gammalt tidsval med bevarat utkast. Exakt1bokning och
0överlappar; syntetiskt provkonto inaktiverat och egen provserver stoppad.
Aktuellt underlag: [kalenderprov](calendar-proof/COMPLETION_2026-11-13.md).
Fryst paketv1 till Grok: avgränsat GO efter artefakt-/bildgranskning och egen
kalenderberäkning; inga egna systemtester. [QA och backlogg](calendar-proof/QA_FINAL_REVIEW.md).
Ingen ny drift eller pilot. Äldre delrapporter med datorstyrningshinder är
historiska: verktygssessionens reset och Chrome-återanslutning fungerade.

Levererat: kundregister med sökning/paginering, kundkort och aktuell kontakt,
versionerad redigering/arkivering, bevarade bokningssnapshots och uttrycklig
kundkoppling i bokning/återbesök. Ingen automatisk matchning på e-post, inga
nya MCP-exporter. Syntetisk seed och fem optimerade bildassets används i UI.
Separat [produktsida](https://booking-lab-se-preview.vercel.app/product), [demoadmin](https://booking-lab-se-preview.vercel.app/admin) och [kundbokning](https://booking-lab-se-preview.vercel.app/).

- Branch **feature/epic06-customers-demo-product**, produkt-/QA-/deploy-SHA **7c1407dce66910ef8ab304c882c90d90c173ca72**.
- Bas16dae9a/6acd2ef, produktbas d7bc47f. Initial Epic06-kod024796f;
  rättning aab9fdf; uttryckligt beställt Lucide-urval och bildrefresh7c1407d.
- [Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md), original-SHA256 **5c1f5194d76fb2b88bb5ce05b7c3c7c0b3a68a4451cc50fd71c12bbcfc8a4381**. GO endast skyddad syntetisk preview;
  1 av 2 samlade fixvarv användes, inget nytt blockerande fynd. Grok testade
  separat Linux/Chromium-kopia, inte vår molnmiljö eller Actions.
- [Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796):alla4jobb40/40,76 unit/84 integration. Push-jobb43301798348 avbröts av
  avsedd concurrency när full manuell matris startades. Main oförändrad b000481.
- Deployment **dpl_<redacted>**, READY Preview target=null,
  fra1; faktiskt containerbygge i cle1/USA. Image sha256:
  **8dfea65990374ff6c8d16570c033ccac641deeea99748171f7bede0e1f6db3b0**.

Kodkarta: src/lib/customers.ts; src/app/admin/customers/* och
src/app/api/admin/customers/*; bokningseditor/domän med valfritt customerId;
prisma/schema.prisma och ny20261112190000_customers. De 6 äldre migrationerna
är orörda. src/app/product/page.tsx, public/demo/* och scripts/seed-demo.ts.
Kund-/seed-/E2E-regressioner i tests. Enda nya paketet är lucide-react 1.72.0,
ISC plus bevarad Feather/MIT-notis, inga egna runtime-beroenden. React 19.3.1
och Next 16.4.6 verifierade; inga befintliga paketversioner uppgraderades.
[Beroendebeslut](DEPENDENCY_REVIEW.md), [arkitektur](ARCHITECTURE.md).

Molnet: samma skyddade projekt och isolerade booking_ui_preview_demo.
Backup före migration verifierad genom återläsning. Alla35 äldre snapshots
bevarade; första seed46 nya+33 befintliga, tre följande0 nya/79 befintliga.
Efter egna molnprover33 kort/84 bokningar,0 överlapp,0 icke-example.test-kontakter.
Nya QA-kortet arkiverades, manuella/äldre data raderades inte. Endast den nya
Customer-tabellens SELECT/INSERT/UPDATE gavs befintlig approle; inga nya personer.

Faktisk Chromium-provning och fem riktiga stabil-aliasbilder finns i [DEMO](DEMO.md).
TLS/perimeter, appbehörighet, logout/replay, kundflöden och backup11 tabeller
PASS. Beständighet efter90 sekunder PASS; framtvingad omstart är NOT RUN.
[Kommandon, mellan-FAIL, audit och samlat bevis](VERIFICATION.md).

Rest/backlogg: ingen automatisk offentlig kundkoppling eller efterhandskoppling
av gamla fristående besök. Mobil paginering/aktiv flik kan förtydligas. En
avsiktligt kolliderande publik seednyckel gör att en demobokning hoppas över;
ingen felaktig koppling eller dataskada (Grok Låg, ingen ny fixloop).
Testport3000 är fast. Fysisk iPhone/Safari och ägarens UX-beslut återstår.
Pilot NO-GO; full audit7 moderate/0 high, runtime0; inga riskabla overrides.

Inga nya betalda abonnemang/tillägg, mainmerge, force-push, publik MCP eller
verkliga kunduppgifter. Fortsätt inte automatiskt till nästa Epic. Drift/stopp,
privata operatörsprofiler och tidigare miljöer beskrivs i DEMO; kopiera aldrig
miljöfiler till Git/Grok. Efter denna frysta revision är leveransändringar
endast dokumentation, original-QA och verkliga skärmbilder.

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Handoff — förbättrad skyddad demo

## Epic 06 — kandidat inför samlad QA, 2026-11-12

Ny branch feature/epic06-customers-demo-product från16dae9a/6acd2ef, produktbas d7bc47f. Kundkort och uttrycklig bokningskoppling, additiv sjunde migration,32fiktiva kunder/79seedbokningar samt separat /product. Gamla kundbokningen / och admin /admin består. Lokal uppgraderingskopia behåller37äldre bokningssnapshots;83bokningar totalt inklusive manuella prov,0överlapp, oförändrade tabellhashar vid ny seed. Riktat kundtest7/7, unit76, preliminär full integration81 före sista MCP-proben, kund-E2E4/4 på desktop/mobil. Ny slutmatris och oberoende Grok-QA återstår; preview är fortfarande d7bc47f. Ingen pilot eller ny betaltjänst. [Plan](EPIC_06_PLAN.md).


## Avgränsad auditomgång 2026-11-12

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.


**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Historik — tidigare leverans

# Handoff — Epic05 QA-godkänd lokal produktalpha

**Skyddad mobilpreview levererad 2026-11-12:** [Öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Branch preview/epic05-vercel-review, faktiskt driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7, deployment dpl_<redacted> (Preview/fra1). Senare dokumentationscommits ändrar inte driftsatt kod. Endast Niclas via Vercel Authentication på alla deployments, dessutom individuell appadmin. Inga nya betalda abonnemang/tillägg; befintlig Pro-förbrukning kan kosta några få dollar, Neon Free. [Drift och lokal hantering av adminuppgifter](DEMO.md).

Codex:72unit/72integration/24E2E×4, lint/tsc/build PASS. Grok GO för kod/paketering efter1samlat fixvarv, [originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md). [Actions43243542749](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749): alla4jobb gröna på exakt f2fdac7. Faktisk drift: perimeter HTML/API/resurs, TLS1.3, headers, stängd appport, login/logout/copierad-cookie-replay, kundbokning, mobilkalender, tjänster/personal, flytt/avbokning och spoofing-spärr PASS. Kallstart bekräftad i Vercellogg, samma session och bokning bevarade. Ny krypterad backup återläst lokalt,10tabellers innehåll identiskt.

Kvar: fysisk iPhone/Safari NOT RUN; krypterad backup finns på PC, inte automatisk extern backup. Audit full FAIL7moderate/0high/critical, production PASS0. PV-QA-4 (eviktion vid mättat lager), PV-QA-7 (minnesspecifika unit-tester med global postgres-env) ligger i backlogg. Bara Niclas får åtkomst; AGPL-källkodserbjudande måste lösas innan andra släpps in. Ingen kundpilot, mainmerge, ny Epic eller publik MCP. [Full faktisk verifiering/NOT RUN](VERIFICATION.md).
