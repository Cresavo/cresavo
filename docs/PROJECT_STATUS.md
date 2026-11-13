# Projektstatus — kunddatas livscykel och ägaragentprov

2026-11-13. Kandidat på feature/customer-lifecycle-agent-proof från d2ccb6c
(föregående produkt8843d06). Niclas har uttryckligen valt manuell hantering;
automatisk gallring är avstängd. Ingen ny Epic eller kundpilot.

| Acceptanskriterium | Faktiskt läge |
| --- | --- |
| Exportera valt kort och uttryckligen kopplade bokningar | Implementerat: max100/fil, fortsättning med token, max1000totalt. Inga andra kunder eller interna kvot-/sessionshemligheter. |
| Förhandsgranska och bekräfta kontaktborttagning | Implementerat: namn/e-post/telefon och kopplade kontaktkopior ersätts; kort arkiveras, tider/priser/status/historik bevaras. |
| Behörighet, samtidighet och oförändrad bokningsmotor | Riktade tester PASS;20samma-idempotensnyckel ger1åtgärd. Separat contactRemovedAt, bokningsversion och kapacitetsbeslut bevaras. |
| Ingen automatisk gallring eller kontakt-MCP | Implementerat och testat. Existerande lokal MCP får ett avgränsat capacity-only-läge; ingen ny server/anslutning. |
| Verkligt ägaragentprov i Codex | Kvar: actual-klientomladdning och nya kapacitetsanrop. SDK-test är inte ett AI-klientbevis. |
| Oberoende Grok, privat CI och samma skyddade preview | Inte körda för kandidaten ännu. Nuvarande preview kör fortfarande8843d06. |

Ny migration9 är additiv; historiska8oförändrade. Isolerad8→9uppgradering och
återseed bevarar äldre kolumnvärden, beslut och konfliktfrihet. Inga paket eller
lockfilsändringar. Se [plan/avgränsning](CUSTOMER_LIFECYCLE_AGENT_PLAN.md).

Detta är kontaktminimering, inte full anonymisering eller komplett GDPR-utdrag.
Fristående bokningar matchas inte på e-post; backups, hämtade filer, loggar och
fria kampanjrubriker påverkas inte. Kommande aktiva besök måste hanteras först
som tekniskt POC-skydd. Lagringstid och rättighetsprövning före pilot återstår.
Pilot fortsatt NO-GO: MFA/recovery, drift/tenant-/leverantörsgrindar, full
dataskyddskedja och fysisk iPhone/Safari är inte godkända.


## Historik — föregående verifierade leverans

# Projektstatus — proaktiv kapacitetsöversikt levererad

Verifierad **2026-11-13**. Branch **feature/proactive-capacity-overview**.
Produkt, Groks återkontroll och driftsatt kod:
**8843d06350c6478e375fb640579cb3ac4f7fe3dc**. Senare dokument-/bildcommit
ändrar ingen produktkod. Bas28a48fe efter avslutat kalenderprov; main är
fortfarande b000481 och har inte mergats.

[Öppna skyddad demo](https://booking-lab-se-preview.vercel.app/product) →
**Prova salongens arbetsyta → Översikt**. Endast påhittade uppgifter.

| Acceptanskriterium | Faktiskt verifierat / produktkvalitet |
| --- | --- |
| Framtida avbokning visar tjänst, utförare, tid och verklig tillgänglighet | PASS domän/integration/UI/Grok/moln; högst7Stockholmsdagar, max20/sida. Regelbaserat, ingen modell eller intäktsprognos. |
| Ägaren öppnar rätt kalenderläge | PASS egen klicktest på stabil alias:16november, Sam Demo; kalender/kundflöden kvar. |
| Avfärdande och kampanjutkast består | PASS integration/E2E/Grok; sparat utkast och status i faktisk preview. Beslut knyts till bokning+version. |
| Rabatt väljs uttryckligen och faktisk omfattning framgår | PASS förhandsgranskning: tjänst+datum, alla bokningsbara tider/utförare; ingen slotreservation, automatisk publicering eller utskick. |
| Dubbeltryck/retry/samtidighet ger högst ett utkast | PASS lokalt, Grok och20samtidiga HTTP-anrop i molnet; samma utkast-id och ändrad payload409. |
| Ny bokning eller ändrat underlag gör förslaget inaktuellt | PASS domän/Grok; verklig återbokning15.00 i molnet visar stale och behåller utkastet. |
| Senare förslag går att nå | PASS efter1samlat fixvarv: cursor i UI/API/MCP, omladdning/handling på sida2. Grok stängde PRO-QA-1. |
| Lokal agent använder samma regler utan kundfält | PASS faktiska stdio-kontraktstester. Nya skrivningar kräver --admin --allow-workspace; ingen publik MCP eller påstådd Dots/Muse-integration. |
| Uppgradering/seed bevarar äldre data | PASS lokal7→8 och återseed; molnets84äldre bokningar oförändrade,92totalt,0överlapp. |
| Åtkomstskydd och återläsning | PASS HTML/API/resurser, logout/revocation, TLS och alla4READY-adresser+stabil alias. Krypterad slutbackup återläst:12tabeller, identiska radhashar. |

Automatik: **78unit/90integration/42E2E×4**, lint/tsc/build PASS.
[Actions43353236981](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43353236981):
fyra gröna jobb på exakt produkt-SHA. [Grok original](qa/QA-REPORT-proactive-fix1-8843d06.md):
egna78/90/42prod-E2E, riktad UI/API/MCP och GO syntetisk POC; inte egen fyrmatris/moln.
[Aktuella resultat och råutdata](VERIFICATION.md) · [provguide/bilder](DEMO.md).

Sedan förra omgången: ny Översikt, beständiga beslut/utkast, gemensamma lokala
agentverktyg, additiv scenarioseed och nåbara förslag efter första sidan.
Full målbild bevarad i befintlig [roadmap](PRODUCT_ROADMAP.md) och Del B.

**Delvis/kvar:** signalen täcker avbokningar, inte all ledig kapacitet;
uppdateras vid läsning/knapp, inga bakgrundsnotiser. Kampanjpris debiteras inte
automatiskt. Ett Low och tre Info från återkontrollen ligger i backloggen.
Mobil emulering är testad; fysisk iPhone/Safari och Niclas UX-beslut återstår.
14hashade spärrposter finns i integrationstestdatabasen, övriga egna affärsrader0.

**Pilot NO-GO:** MFA/recovery, kundexport/radering/retention, full tenant-/drift-
och leverantörs-/licensgrind kvar. Full audit FAIL7moderate i dev; prod0fynd.
Ingen automatiserad extern backup eller framtida integration är levererad.
Journal, lager, ekonomi, sociala medier och AI-prissättning är planerade områden,
inte nattens implementation. Nattmålet är avslutat; inga fler epics startas.

## Föregående leverans — Epic 06 skyddad syntetisk demo

Verifierad 2026-11-12. Branch **feature/epic06-customers-demo-product**; granskad och driftsatt produktkod
**7c1407dce66910ef8ab304c882c90d90c173ca72**. Senare dokument-/bildcommit ändrar inte denna kod. [Öppna produkten](https://booking-lab-se-preview.vercel.app/product).

| Funktion och observerbart acceptanskriterium | Utfall och kvalitet |
| --- | --- |
| Produktingång visar verkliga funktioner och leder till arbetsyta/kundbokning | PASS i faktisk preview. Separat /product; / och /admin består. |
| Vercel-inloggning vid behov, sedan demoadmin utan extra lösenord | PASS via stabil alias. Tydlig Demoägare; vanlig produktinloggning kvar. |
| Sök namn/e-post/telefon, öppna kundkort och se kommande/tidigare/avbokade besök | PASS API/integration/E2E/Grok och moln. Listor utan rå kontakt; kortets example.test-kontakt endast i pinnad demo. |
| Skapa/redigera/arkivera kund utan att slå ihop personer eller skriva om äldre snapshots | PASS. Skapad kund finns efter omladdning; historik kvar efter arkiv. |
| Kalender → bokning → kundkort; ny bokning/återbesök med förvald kund | PASS faktisk molnprovning; skapa, flytta, avboka och återbesök. Dag/tid väljs med tryck. |
| Publik bokning fungerar och kan inte koppla/skriva över kund via e-post | PASS inklusive faktisk bokning med samma kontakt som ett kort; customerId förblir null. |
| Demo uppgraderas additivt och seed kan köras igen | PASS: 35 äldre molnsnapshots bevarade,32 seedkunder/79 seedbokningar; vid slutprovet33 kort/84 bokningar inklusive egna syntetiska prover,0 överlapp. |
| Bilder och granskade mobilvyer fungerar | PASS riktiga färdigladdade bilder, nio Lucide-ikoner,320/390/1440px. Fysisk iPhone/Safari och Niclas UX-godkännande återstår. |

Tekniskt testad, automatiskt verifierad och möjlig att prova: **ja**. Färdig
UX för målgruppen/redo för riktiga kunder: **nej**. Detta är en syntetisk POC.
[Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md): GO preview efter1 samlat rättningsvarv, inte pilot. [Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796):4 gröna jobb på exakt produkt-SHA. [Full resultattabell](VERIFICATION.md).

Sedan förra arbetsomgången: kundmodell och bokningskoppling,32kundkort och
historik, levande syntetisk salongsdag, fem faktiska AI-assets, separat
produktsida och återanvänt Lucide-urval. Rättat seedägarskap, bokstavlig
sökning och långa kontaktfält. Inga nya autentiseringssystem eller nya tjänster.

Delvis/återstår: listan har Nästa men saknar Föregående/antal och tydligare
aktiv historikflik; äldre fristående bokningar saknar efterhandskoppling.
Publika bokningar skapar/kopplar inte kort automatiskt. Arkiv är inte radering.
Seedade datum är relativa vid körning, inte en schemalagd automatisk reset.

Blockerar kundpilot: datalivscykel/export/radering/retention, MFA, full
kommersiell drift-/integritetsbedömning och auditens7 måttliga utvecklingsfynd.
Produktionsaudit0 är inte ett allmänt säkerhetsgodkännande. Ingen ny abonnemangs-
eller tilläggskostnad; faktisk fakturaförbrukning ej avläst. Automatisk extern
backup och framtvingad omstart/lastcertifiering är inte verifierade.

Planändring 2026-11-12, dokumentation endast: [agent-first-riktning och
kalenderprov](PRODUCT_ROADMAP.md). Nästa föreslagna prov jämför två syntetiska
kundkalendrar med verklig lokal MCP-tillgänglighet; bokningen slutförs i
befintlig webb. Ingen implementation, livekalenderanslutning eller ny QA
påbörjad vid planändringen. Därefter godkänt första lokalprov: två dummy-
kalendrar förberedda på experiment/calendar-agent-proof. Klienten byttes
till Codex och provet är nu genomfört lokalt 2026-11-13: direkta
läsverktyg, kalenderjämförelse, kundbokning, admin och gammalt tidsval som
nekas med bevarade uppgifter.1bokning/0överlappar; provkonto inaktiverat.
Grok ger avgränsat GO efter artefakt-/bildgranskning och egen kalenderberäkning,
inga egna server-/MCP-/UI-körningar. Inga blockerare; spårbarhetsidéer backlogg.
[Aktuell provstatus](calendar-proof/README.md). Pilotgrindar kvarstår.
Main är inte mergad. [Prova och stoppa](DEMO.md), [handoff](HANDOFF.md).

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Projektstatus — förbättrad skyddad demo

## Epic 06 — kandidat inför samlad QA, 2026-11-12

Ny branch feature/epic06-customers-demo-product från16dae9a/6acd2ef, produktbas d7bc47f. Kundkort och uttrycklig bokningskoppling, additiv sjunde migration,32fiktiva kunder/79seedbokningar samt separat /product. Gamla kundbokningen / och admin /admin består. Lokal uppgraderingskopia behåller37äldre bokningssnapshots;83bokningar totalt inklusive manuella prov,0överlapp, oförändrade tabellhashar vid ny seed. Riktat kundtest7/7, unit76, preliminär full integration81 före sista MCP-proben, kund-E2E4/4 på desktop/mobil. Ny slutmatris och oberoende Grok-QA återstår; preview är fortfarande d7bc47f. Ingen pilot eller ny betaltjänst. [Plan](EPIC_06_PLAN.md).


## Avgränsad auditomgång 2026-11-12

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.


**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Historik — tidigare leverans

# Projektstatus — Epic05 QA-godkänd lokal produktalpha

**Skyddad mobilpreview levererad 2026-11-12:** [Öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Branch preview/epic05-vercel-review, faktiskt driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7, deployment dpl_<redacted> (Preview/fra1). Senare dokumentationscommits ändrar inte driftsatt kod. Endast Niclas via Vercel Authentication på alla deployments, dessutom individuell appadmin. Inga nya betalda abonnemang/tillägg; befintlig Pro-förbrukning kan kosta några få dollar, Neon Free. [Drift och lokal hantering av adminuppgifter](DEMO.md).

Codex:72unit/72integration/24E2E×4, lint/tsc/build PASS. Grok GO för kod/paketering efter1samlat fixvarv, [originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md). [Actions43243542749](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749): alla4jobb gröna på exakt f2fdac7. Faktisk drift: perimeter HTML/API/resurs, TLS1.3, headers, stängd appport, login/logout/copierad-cookie-replay, kundbokning, mobilkalender, tjänster/personal, flytt/avbokning och spoofing-spärr PASS. Kallstart bekräftad i Vercellogg, samma session och bokning bevarade. Ny krypterad backup återläst lokalt,10tabellers innehåll identiskt.

Kvar: fysisk iPhone/Safari NOT RUN; krypterad backup finns på PC, inte automatisk extern backup. Audit full FAIL7moderate/0high/critical, production PASS0. PV-QA-4 (eviktion vid mättat lager), PV-QA-7 (minnesspecifika unit-tester med global postgres-env) ligger i backlogg. Bara Niclas får åtkomst; AGPL-källkodserbjudande måste lösas innan andra släpps in. Ingen kundpilot, mainmerge, ny Epic eller publik MCP. [Full faktisk verifiering/NOT RUN](VERIFICATION.md).
