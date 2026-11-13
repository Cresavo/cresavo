# Produktägarrapport — nattmålet klart, 2026-11-13

[Här öppnar du produkten](https://booking-lab-se-preview.vercel.app/product).
Tryck **Prova salongens arbetsyta → Översikt**. Samma skyddade länk och
Vercel-inloggning vid behov, inget extra demoadminlösenord.

Vi har byggt första proaktiva flödet: en verklig avbokning kontrolleras mot
aktuell tillgänglighet. Du kan öppna rätt kalenderdag, avfärda eller välja
rabatt/datum och spara ett riktigt kampanjutkast. Beslut består; om tiden
bokas igen visas en varning och utkastet finns kvar. Förslaget är regelbaserat,
inte en påstådd AI-analys. Inget publiceras eller skickas automatiskt.

**Prova på mobilen:**

1. Öppna09-förslaget för Sam Demo, måndag16november. Läs tid/längd/pris.
2. Välj Öppna kalendern och kontrollera samma dag och medarbetare.
3. Gå tillbaka, Förbered kampanjutkast, välj egen rabatt och datum med tryck.
   Förhandsgranska: erbjudandet gäller tjänsten under hela perioden, inte bara09.
4. Spara och ladda om. Öppna samma utkast i Kampanjer utan att publicera det.
5. Boka den tiden i kalendern och uppdatera Översikt. Utkastet består, tiden
   blir inaktuell.14-förslaget är också lämnat öppet för ditt prov/avfärdande.

[Aktuella mobil-/desktopbilder och provguide](DEMO.md).15-förslaget visar
redan ett sparat15%-utkast vars tid bokats igen. Första riktiga20%-provningen
på09 förhandsgranskades men sparades inte, så den är kvar för dig.

Branch **feature/proactive-capacity-overview**, produkt-/QA-/deploycommit
**8843d06350c6478e375fb640579cb3ac4f7fe3dc**. Lokalt78unit/90integration/
42E2E×4, lint/tsc/build PASS. [Actions43353236981](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43353236981):
fyra gröna42/42jobb. [Grok original](qa/QA-REPORT-proactive-fix1-8843d06.md):
egna78/90/42 och GO syntetisk POC efter ett samlat fixvarv.
Driftens åtkomstskydd, verkliga flöden och krypterad återläsning är verifierade
separat av Codex. Grok testade inte molnet eller fysisk iPhone.

Kvar: enklare signalen omfattar bara avbokningar och kräver uppdatering;
ingen automatisk prisdebitering, utskick eller full AI-modul. Mindre UX-fynd
ligger i backloggen. Full audit har7måttliga devfynd, prod0; detta är inte ett
pilotgodkännande. Din fysiska iPhone/Safari och ditt UX-godkännande återstår.
Inga nya abonnemang, ingen mainmerge eller publik MCP.

Tre rekommenderade nästa leveranser, inte startade:

1. Prova femstegsflödet på fysisk iPhone med dig och rätta de viktigaste
   orienterings-/a11yproblemen, särskilt hur senare förslag upptäcks.
2. Avgränsa kunddatas livscykel: retention, export och radering med bevarad
   bokningshistorik. Det låser upp en konkret del av pilotgrinden.
3. Ett verifierat ägarassistentflöde med tydligt mandat och uppföljning utifrån
   dagens lokala verktyg; välj verklig klient innan fjärråtkomst/modellbudget.

Hela visionen för journal, lager, ekonomi och marknadsföring är bevarad i
[roadmapen](PRODUCT_ROADMAP.md). Nattmålet är avslutat, inga fler epics startas.

## Föregående leverans — Epic 06,2026-11-12

[Här öppnar du Booking Lab](https://booking-lab-se-preview.vercel.app/product). [Demoadmin](https://booking-lab-se-preview.vercel.app/admin) · [kundbokning](https://booking-lab-se-preview.vercel.app/).
Vercel-inloggning vid behov, därefter en demoknapp utan extra lösenord.

Byggt: ett sammanhängande kundregister och kundkort med besökshistorik,
förvald kund i ny bokning/återbesök och bevarade äldre uppgifter när kortet
ändras. Demon har32 fiktiva kunder/79 seedade besök, personal- och salongsbilder
samt en separat produktingång. Nio återanvända Lucide-ikoner, inga oanvända
form-/tabellbibliotek och ingen större UI-migrering.

Prova nu: hitta Mira, skapa en ny påhittad kund och boka, ändra kontakt och
kontrollera gammal bokning, boka återbesök samt flytta/avboka från kalendern.
[Fem mobiluppgifter och fem riktiga bilder](DEMO.md). Bilderna är tagna från
den stabila skyddade previewn, inte mockups eller laddningsskärmar.

Branch **feature/epic06-customers-demo-product**, produkt-/deploycommit **7c1407dce66910ef8ab304c882c90d90c173ca72**.
76 unit/84 integration/40 E2E lokalt; [Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796)40/40×4. [Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md) har eget
76/84/40-PASS och GO skyddad syntetisk preview efter1 samlat fixvarv.
Faktiska molnflöden, perimeter, historik,0 överlapp och backup11 tabeller PASS.
Funktionstester och audit hålls isär: full audit FAIL7 moderate, runtime PASS: 0.

Kvar: fysisk iPhone/Safari och ditt UX-beslut, enklare tillbakapaginering/aktiv
historikflik och efterhandskoppling av äldre fristående besök. Publik e-post
leder aldrig automatiskt till kundkort. Arkiv är inte GDPR-radering. Pilot
är fortfarande NO-GO; inga nya betalda abonnemang, ingen mainmerge.

Tre nästa mål som rekommendation, inte nya beställningar: ditt faktiska
iPhone-prov; samla dess viktigaste arbetsflödesproblem; prioritera sedan
pilotgrindar för datalivscykel, MFA, drift och säker stabil audit-rättning.

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Produktägarrapport — användbarhet,2026-11-12

**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

- **Prova på mobilen:** kalenderdag och tidsknappar; nästa lediga dag; kundens sammanfattning; skapa/flytta/avboka; ändra behandling/ledighet och växla mellan kund/ägare.
- **Synligt bättre:** bokningen först, begripligt svenskt datumval, inga extra manuella demoadminlösenord, tydligare navigation och arbetsdag. Se [före/efter](UI_USABILITY_REVIEW.md#slutleverans-och-bildbevis).
- **Tre nästa mål, inga automatiska beställningar:** Niclas bedömer fysisk iPhone/Safari och UX; prioritera observerade användarproblem från den provningen; besluta separat om pilotblockerare och driftbackup/audit.

## Historik

# Produktägarrapport — skyddad mobilpreview, 2026-11-12

- **Byggt:** separat skyddad Vercel-preview av befintlig Epic05, kod f2fdac7.
- **Prova:** [öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app), logga in med ditt Vercel-konto och individuell appadmin enligt [DEMO](DEMO.md). Kalender, tjänster, personal, skapa/flytta/avboka fungerar. Syntetiska uppgifter endast.
- **Bättre:** samma wrapper och delad PostgreSQL-spärr fungerar i faktisk Vercelmiljö; minimal runtime, skyddade API/resurser, testad kallstart och krypterad återläsning.
- **Bevis:** Grok GO efter1fixvarv,72unit/72integration/24E2E×4 och4gröna [CI-jobb](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749). Verkliga mobilbilder och faktiska driftkontroller i [VERIFICATION](VERIFICATION.md). Ingen ny Epic/video.
- **Kvar:** fysisk iPhone/Safari, automatisk offsitebackup och exakt fakturakostnad ej verifierade; audit7moderate utvecklingsfynd/0production. Ingen kundpilot.
- **Tre nästa mål, inga automatiska beställningar:** Niclas provar iPhone/Safari; följ upp förbrukning och backupbehov inom godkänd kostnad; besluta separat om bredare åtkomst/källkodserbjudande och befintliga pilotblockerare.

## Historik — tidigare Epic05-rapport

# Produktägarrapport — Epic 05 levererad som lokal alpha

**Vad har vi byggt?** En salongskalender med dag- och veckovy på dator och daglista på mobil. Du kan ändra behandlingar, priser, personalens arbetstider, pauser och ledighet samt skapa, öppna, flytta och avboka bokningar. Lokala agenter kan göra motsvarande tillåtna ändringar genom samma bokningsmotor.

**Vad kan jag testa nu?** Följ [den korta PC-guiden](LOCAL_DEMO_WINDOWS.md): kundbokning → adminkalender → flytt/avbokning → tjänst/schema → guidad lokal agent. Använd bara påhittade uppgifter. [Produktionsgalleriet](../demo-artifacts/2026-11-12T10-29-00-935Z/index.html) visar den verkliga produkten. Ingen mobilåtkomlig testsite är driftsatt.

**Vad blev bättre efter QA?** Receptionens manuella bokningar delar inte längre kundernas fem-bokningstak. Admin har en egen dokumenterad budget. Grok har stängt blockeraren efter en rättningsomgång och gett **GO för avgränsad lokal produktalpha**. [Originalrapporten](qa/QA-REPORT-epic05-4fc98d3.md).

**Vad är verifierat?** Både Codex och Grok har kört 69 enhetstester, 66 integrationstester och 24 E2E-tester i vart och ett av fyra lägen. Lint, typkontroll, build och städkontroll passerar. [Faktiska kommandon, tidiga fel och begränsningar](VERIFICATION.md). GitHub Actions har också fyra gröna E2E-jobb på leveransen. [CI-bevis](CI_DELIVERY_2026_11_12.md). Feature-körningen tog 4 minuter 1 sekund.

**Vilken revision?** Privat branch `epic-05-booking-workspace`, produktkod `4fc98d3`, CI-testad leverans `c12b98a`. Senare dokumentcommits ändrar bara Markdown. `main` är kvar på `b000481`. Ingen merge eller deploy.

**Demo och kvalitet:** Produktionsdemo `7fc0e86` är äldre än den osynliga kvotfixen. Sex flöden passerade; 28 bilder består av 26 funktionsbilder och två laddningsbilder som inte räknas som bevis. Sex videor är avkodade och stickprovsgranskade, men inte helt genomtittade. Fokus efter flytt, avbokningsdialogen och tydligare kvotfeltext behöver förbättras. Ingen ny full inspelning gjordes i fixvarvet.

**Vad fungerar fortfarande inte för riktig drift?** Kundernas GDPR-livscykel, MFA/återställning, verklig TLS/proxy/flerinstansdrift och distributionslicensgrindar återstår. Full audit har sju måttliga fynd och noll höga; produktionsaudit har noll. Kund-e-post förblir maskerad. **Pilot är NO-GO.** Veckoaudit är konfigurerad men inte aktiv innan dess workflow finns på default-branchen. Mobilpreview kräver ett samlat miljöbeslut enligt [förslaget](DEMO.md); ingen URL eller betald resurs har skapats.

**Tre rekommenderade nästa mål:**

1. Fatta och verifiera ett samlat beslut om skyddad syntetisk mobilpreview.
2. Avgränsa export, radering och lagringstid för framtida kunder.
3. Prioritera kvarvarande UX samt MFA och återställning inför pilotplanering.

Inga odefinierade Epics startas automatiskt.

## Bilaga — tidigare produktägarrapporter

# Produktägarrapport — Epic 04 klar som lokal POC

**Byggt:** egna syntetiska adminkonton, säker lösenordsverifiering, kontobundna sessioner och lokal skapa/spärra/återställ-CLI. Det delade lösenordet är borttaget som reservväg.

**Prova nu:** skapa två example.test-konton enligt [operatörsguiden](ADMIN_OPERATIONS.md). Logga in på /admin och prova logout/reset/spärr. Kundbokning, kampanj och lokal MCP fungerar kvar; kund-e-post är fortsatt maskerad.

**Bättre:** ett konto kan återkallas utan att det andra påverkas. Gamla cookies och pågående äldre verifieringar överlever inte reset. QA:s kapacitetsfynd är rättat och oberoende återtestat.61 unit,40 integration och14 E2E ×4 PASS. [Exakta resultat](VERIFICATION.md), [Groks slutgodkännande](qa/QA-REPORT-epic04-471f91f.md).

**Se resultatet:** [lokalt galleri](../demo-artifacts/2026-11-12T06-35-12-079Z/index.html),4/4 PASS,14 bilder/4 videor från produktion9282cdc, före den osynliga limiterfixen. Utvalda bilder granskade och videor avkodade, inte helt visuellt genomtittade. Se [DEMO](DEMO.md) för reproduktion; artefakterna finns inte i GitHub.

**Kvar:** MFA, webb-recovery, kund-GDPR och verifierad verklig drift saknas. Full audit har7 måttliga/0 höga,prod0; native-/CLI-licensgrindar och kontobundet/distribuerat missbruksskydd kvar. Endast testad POC, pilot NO-GO.

**GitHub:** Epic02 och03 är pushade; båda har4 gröna E2E-jobb och känt rött audit-jobb. Epic04 är pushad som199d326. Actions43172522203 har4 gröna E2E-jobb(14/14 vardera),61unit/40integration PASS; endast kändaudit är röd. [CI-bevis](CI_DELIVERY_2026_11_12.md). main lämnas på b000481. [Underlag för ChatGPT](CHATGPT_REVIEW_HANDOFF.md).

**Tre nästa mål:** avgränsa kundernas export/radering/lagringstid; välj MFA-/återställningslösning; definiera och testa EU/EES-/self-hostingens drift- och distributionsgrind. Inga nya Epics startas utan scope.


## Bilaga — tidigare rapport

# Produktägarrapport — Epic 03 godkänd lokal POC

**Byggt/bättre:** Prisma uppgraderad kontrollerat till 7.10.1 med gemensam PostgreSQL-adapter, begränsad pool och UTC-session. De tre höga audit-fynden borta; 7 måttliga lintfynd kvar och synliga. Inga nya produktfunktioner.

**Prova nu:** samma kundbokning, /admin, kampanjflöde och npm run mcp:client -- --admin --book enligt README. Bara syntetiska uppgifter. UX är fortsatt testad POC, inte produktionsklar.

**Verifierat på 18a4d73:** ren installation/Prisma/start,51 unit,31 integration×3,12 E2E×4,lint/tsc/build/cleanup och äldre DB-kopia PASS. [Exakta resultat](VERIFICATION.md). Groks oberoende QA **PASS**, inga blockerande fynd; [Groks originalrapport](qa/QA-REPORT-epic03-18a4d73.md). [Äldre Epic 02-demo](DEMO.md) visar flödena, ingen ny video spelas in.

**Kvar:** upstreamfix för minimatch, individuella admin/MFA, kund-GDPR, riktig drift/processisolering och kundkontaktbeslut. Nya CLI-licens-/distributionsgränser är dokumenterade. Inga riktiga kunder/pilot.

**Tre nästa mål:** individuell adminåtkomst; beslutad/testad GDPR-livscykel; avgränsad leverans-/driftkontroll inklusive stabil auditfix och senare godkänd CI-push. Ingen push/merge/deploy nu.

## Bilaga — Epic 02-rapport

2026-11-12, kod **3cd633b**, lokal branch `epic-02-local-agent-booking`. Ingen push, merge eller publicering. Arbetsnamnet Booking Lab SE används fortsatt.

**Byggt:** en lokal agent kan läsa lediga tider och skapa en uttryckligen bekräftad syntetisk bokning. Samma bokningsmotor och databasregler gäller som i webben. Svaret skickar inte tillbaka kundnamn/e-post. En liten testklient kräver ja, medan nej/EOF lämnar databasen orörd.

**Prova nu:** följ README för lokal start. Kör `npm run mcp:client -- --admin --book`, läs sammanfattningen och skriv `ja`. Öppna `/admin` och kontrollera bokningen. Enbart `--admin` provar fortfarande kampanjutkast och manuell publicering. Använd enbart syntetiska uppgifter.

**Bättre:** testerna täcker verklig stdio, riktiga HTTP/MCP-anrop samtidigt, 20 retries med samma id, bestående dagstak, behörighet och minimerade statiska fel. Lokalt passerar 43 unit, 30 integration tre gånger och 12 E2E i fyra lägen, samt lint/tsc/build/cleanup. [Faktiska resultat och felhistorik](VERIFICATION.md).

**Demo:** [galleri och prova-själv-steg](DEMO.md), 4/4 PASS, 14 bilder/4 videor från ren 7a65aee. Agentbokningens adminbilder är granskade; videorna är inte genomtittade i sin helhet. Första inspelningen fastnade vid screenshot och är kvar som FAIL; dess rotorsak är inte fastställd.

**Slut-QA:** Grok godkände cad997b som lokal POC kl. 01:44 CET. Samma fulla matris passerade i egen miljö; inga blockerande fynd. [Originalrapport](qa/QA-REPORT-epic02-cad997b.md). Tre Low/Info-idéer är dokumenterade, ingen ny fixomgång behövs.

**Kvar:** pilot är fortfarande stoppad av identitet/MFA, GDPR-livscykel, audit, verklig driftverifiering, processisolering och beslut om kundkontakt/e-post. Videorna är inte fullt genomtittade; första inspelningsfelets orsak är okänd.

**Tre nästa mål:** avgränsa och verifiera beroendesäkerhet i Epic 03 enligt nattens fortsättningsuppdrag; besluta nästa pilotkrav för adminidentitet/GDPR; genomför senare uttryckligen godkänd QA-branch-push och kontrollera extern CI. Ingen publicering är godkänd nu.

## Bilaga — tidigare Epic 01-rapport

## Uppföljning M2/L8 och CI – 2026-11-11

Kod **01e80ed**, bas **8b83a40**. Bokningsförsök låses per anställd/dag före tillgänglighetsläsning; strukturerade insert-konflikter ger befintligt domänfel. IPv6-proxynät som också litar på IPv4 nekas. Tre historiska migrationer och exclusion bevarade. CI är konfigurerat för fyra E2E-lägen; extern körning återstår tills push godkänns.

Verifierat lokalt: 28/28 unit, 18/18 integration fem gånger, totalt 100 stressomgångar à20 anrop med en framgång/omgång, <2 s/omgång och 0 överlapp/deadlocks. Alla fyra E2E-lägen 8/8, lint/tsc/build och cleanup PASS; slutdatabas 0 bokningar/0 kampanjer/0 sessioner. [Exakta kommandon, resultat och begränsningar](VERIFICATION.md).

Ingen ny demo enligt produktägarens beslut; senaste inspelning avser äldre kod. Ingen push/merge eller Epic 02-funktion. Visa e-post fortsatt undantagen. Audit omkördes inte; senast 3 high/7 moderate. Pilot fortsatt NO-GO av tidigare skäl. Nästa steg: oberoende kontroll av M2/L8, fyrfälts-CI efter godkänd push och därefter beslutad Epic 02. Inga observerade regressioner i sluttester.

## Historik före denna uppföljning

2026-11-11, kod a364bda. Endast lokala commits; inget pushat eller mergat.

**Vad har vi byggt?** Vi har rättat inloggningsspärren så att en spärrad klient inte längre kan fortsätta gissa lösenord. Vi har lagt till proxyvarning, striktare konfiguration, IPv6-skydd, begränsad sessionsgallring och teststädning. Visa e-post är fortsatt utanför scope.

**Vad kan jag testa nu?** Samma kundbokning, adminvy och kampanjflöde som tidigare. Efter fem felaktiga login måste samma klient vänta även om rätt lösenord anges. En annan klient kan logga in. [Lokal produktionsdemo med tolv bilder och två videor](../demo-artifacts/2026-11-11T21-53-01-311Z/index.html), [prova själv](DEMO.md).

**Vad blev bättre?** Säkerhetstestet kräver nu rätt beteende. Tester städar även sessioner, och demonstrationen visar korta syntetiska kundnamn. Desktop-/mobilbild av admin är visuellt granskad utan observerade layoutproblem; videorna är inte granskade i sin helhet.

**Vad fungerar fortfarande inte?** POC:n är inte redo för pilot: delat lösenord, saknad GDPR-livscykel, oförändrade audit-fynd och ännu inte verifierad verklig TLS/proxy. Delad NAT delar spärr/tak. Proxyvarningen reparerar inte en felkonfiguration. E-post är maskerad.

**Tester:** 24 unit, 17 integration, 8 E2E i vart och ett av fyra lägen, lint/tsc/build, timeout-städning och demo PASS. Audit FAIL: 3 höga/7 måttliga. Ett tidigt körfel vid överlappande Playwrightstarter dokumenterades och hela matrisen kördes om sekventiellt. [Detaljer och faktisk output](VERIFICATION.md).

**Tre nästa mål:** oberoende QA av denna fix; separat beroende- och driftverifiering; individuella administratörer och en beslutad/testad GDPR-livscykel före pilot. Ingen Epic 02 har startats.

## Historik före batch 3

# Produktägarrapport – Epic 01 QA fix batch 2

2026-11-11, kod a84e48a. Lokala commits på epic-01-foundation-hardening. Ingen push; repot förblir privat.

**Vad har vi byggt?** Fixbeställningens punkter 1–5 och 7–11. En besökare delar inte längre global spärr med alla andra, IP-headers måste komma från rätt proxy, logout återkallar även kopierad cookie, retry skapar ingen dubblett och felaktiga adminfilter visar ett begripligt meddelande. Punkt 6 (Visa e-post) är inte byggd.

**Vad kan jag testa nu?** Boka, kontrollera bekräftelsen, logga in, prova datumfilter, skapa/publicera lokalt MCP-utkast och logga ut. [Demoanvisning](DEMO.md) och [nytt galleri med tolv bilder/två videor](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html). Inspelat från ren commit a84e48a; granskade bilder visar YYYY-MM-DD och logout i sidhuvudet utan N-badge. Videofilerna går att läsa men är inte fullständigt genomtittade.

**Vad blev bättre?** Tydligare säkerhetsgräns och UX. Tester täcker både standard-/proxyläge och hela produktionsflödet. Teststädning klarar avsiktlig timeout, och MCP använder samma exporterade databas som webben. Inga nya paket eller ändrade historiska migrationer.

**Vad fungerar fortfarande inte för pilot?** Delat adminlösenord, ingen GDPR-livscykel/sessionsgallring, kvarvarande audit (3 höga + 7 måttliga), processlokalt/IP-baserat skydd och ej verifierad TLS/proxy/Docker/CI. E-post är fortsatt maskerad. Kampanjlista och CSP har tidigare dokumenterade begränsningar. Fortsatt NO-GO för riktiga kunder.

**Testresultat:** 20 unit, 16 integration, åtta E2E i varje av fyra lägen, lint/tsc/build och produktionsdemo PASS. [Faktisk output och begränsningar](VERIFICATION.md), [handoff](HANDOFF.md).

**Tre nästa mål:** oberoende QA av denna revision; separat audit-/driftverifiering; individuell adminåtkomst och beslutad/testad datalivscykel före pilot. Ingen Epic 02 har startats.

## Historik – rapport från batch 1

Senaste kodrevision: `3b3309d` (endast återstående formatering efter funktionellt testade `26ea617`); lint/tsc/build/Prettier omkörda PASS.

Verifierat 2026-11-11, kodcommit `26ea617` på `epic-01-foundation-hardening`. Ingen ny Epic eller extern publicering.

**Vad har vi byggt?** Rättat QA-fynd: säkrare bokningsförsök/retries, utloggning och global återkallelse, begränsad adminlista med maskerad e-post, headers, kampanjregler och fler samtidighets-/negativtester. Historiskt överlappsskydd bevarat; inga nya npm-beroenden.

**Vad kan jag testa nu?** Boka, se behandling/tid i bekräftelsen, hitta bokningen i admin, publicera lokalt MCP-utkast och logga ut. Följ [demoanvisningen](DEMO.md). [Produktionsgalleri: tolv bilder och två videor](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html). Inga N-badges; syntetisk data.

**Vad blev bättre?** 20 samtidiga retries skapar en bokning; överlapp ger begripligt fel. Kunders e-post visas inte rutinmässigt i admin och aldrig i MCP. Testerna vägrar fel databas. Bekräftelsen är tydligare och prisformatet gemensamt.

**Vad fungerar fortfarande inte?** Audit är röd (3 höga + 7 måttliga). Delat adminlösenord och processlokala spärrar räcker inte för kunddrift. Docker/CI, riktig TLS/proxy, backup och GDPR-rutiner är inte verifierade. Datumfältets format följer fortfarande webbläsarmiljön. Detta är en testad POC, inte en produktionsklar tjänst.

**Resultat:** 14 unit + 14 integration + 6 E2E PASS, lint/tsc/build PASS, produktionsdemo 2/2 PASS. Faktisk output och ej körda kontroller finns i [VERIFICATION](VERIFICATION.md), överlämningen i [HANDOFF](HANDOFF.md).

**Tre nästa mål:** oberoende QA/Docker/CI och separat auditåtgärd; individuell adminåtkomst och verifierad driftgräns; syntetisk backup-/gallrings-/dataskyddsövning.
