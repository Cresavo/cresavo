# Projektstatus — Epic 05 pågår

2026-11-12. Branch epic-05-booking-workspace, godkänd plan5c9b07a ovanpå verifierad26b680d. Domändel för E05-1/2 implementerad: konfigurerbara resurser/scheman, snapshots, status/version, atomär flytt/avbokning och mutationsidempotens. Delkontroll:65unit/50integration samt lint/tsc/build PASS mot ny isolerad PostgreSQL. Historiska4migrationer oförändrade; ny femte migration verifierad på tom DB.

**Epic05 är inte färdig.** UI/API/MCP-paritet, uppgraderingskopia, nya E2E, full slutmatris, demo, previewunderlag och Grok-QA återstår. Ingen push/deploy gjord för implementationen. [Aktuellt arbete och verkliga delresultat](WORKPLAN.md) · [Hela godkända omfattningen](EPIC_05_PLAN.md). Mobilpreview har inget miljögodkännande; oberoende produktarbete fortsätter.

## Verifierad föregångare — Epic04

# Projektstatus — Epic 04 godkänd lokal POC

2026-11-12. Produktkod **471f91f**, branch **epic-04-individual-admin**, bas10175ed. Grok godkände full-QA på3419973 och stängde E04-QA-1 efter riktad återkontroll på471f91f; inga nya fynd. **Testad syntetisk POC. Pilot NO-GO.** [Verifiering](VERIFICATION.md) · [slut-QA](qa/QA-REPORT-epic04-471f91f.md) · [prova lokalt](ADMIN_OPERATIONS.md).

| Acceptanskriterium | Tekniskt och automatiskt verifierat | Prova / UX / kundberedskap |
| --- | --- | --- |
| Två individuella administratörer | PASS DB/API och desktop/mobil; eget konto syns i admin | Skapa två example.test-konton via dold lokal CLI. Svensk POC-login, ingen inbjudan/MFA. |
| Logout, reset och spärr återkallar rätt konto | PASS kopierad cookie, andra kontot opåverkat, gamla snapshot/race-sessioner nekas | Logout i UI; reset/spärr genom operatör. Ingen webb-recovery. |
| Ingen reservväg eller främmande salong | PASS password-only, ADMIN_PASSWORD och annan business nekas | Gammal login kräver nytt konto. Ingen full tenant-isolering. |
| Säker asynkron loginspärr | PASS 300 gissningar ger högst5 verifieringar, spärrad rättkod nekas; max4 KDF och minst100ms | Kapacitetsavslag förbrukar inte försök. Kortvarig429 kan kvarstå under flod. Endast processlokalt. |
| Bokning, kampanj och lokal MCP fungerar kvar | PASS 61 unit,40 integration efter fix,14 E2E i alla4 lägen;0 överlapp | Ja lokalt, kund-e-post maskerad. POC-UX; ej kundklart. |
| Tom DB och uppgradering fungerar | PASS 4 migrationer,3 historiska orörda, tidigare data bevarade | README/Windowsguide. Ingen verifierad verklig TLS/flerinstansdrift. |
| Oberoende QA och synlig demo | GO från Grok. Produktionsdemo4/4 PASS,14 bilder/4 videor | [Galleri/revision](DEMO.md). Utvalda bilder granskade; videor avkodade men ej helt genomtittade. |

Sedan föregående Epic: individuella konton, underhållen Argon2id-verifiering, kontobundna hash-only-sessioner och lokal konto-CLI. Ett nytt direkt MIT-paket är motiverat i ADR004. Ett begränsat QA-varv rättade kapacitetsavslag. Inga nya kundfunktioner.

Epic02 dba05a2 och Epic03 10175ed är pushade till privata origin. Båda har4 gröna CI-E2E-jobb och känt rött audit-jobb. Epic04 är pushad som199d326; Actions43172522203 har4 gröna E2E-jobb och känt rött audit-jobb. [CI-bevis](CI_DELIVERY_2026_11_12.md). Ingen merge/deploy. main kvar b000481. [Granskningsunderlag för ChatGPT](CHATGPT_REVIEW_HANDOFF.md).

Delvis: identitetslivscykel utan MFA/recovery/revisionslogg. Planerat utan byggstart: kund-GDPR, MFA-beslut och verifierad drift/distribution. Pilotblockerare: dessa områden, kontobundet/distribuerat missbruksskydd, audit-/licensgrindar och beslut om Visa kund-e-post. Full audit7 måttliga/0 höga; produktionsaudit0. Övriga QA-fynd i [uppföljningen](EPIC_04_QA_FOLLOWUP.md).


## Bilaga — tidigare verifierad historik

# Projektstatus — Epic 03 godkänd som lokal POC

2026-11-12, kod **18a4d73**, branch epic-03-dependency-security. Epic01/02 avslutade som lokala POC:er. Epic 03 förbättrar beroendesäkerhet utan nya produktfunktioner; Groks oberoende slutkontroll gav GO kl. 02:25 CET; inga blockerande fynd. [Groks originalrapport](qa/QA-REPORT-epic03-18a4d73.md). **Pilot NO-GO**. [Verifiering](VERIFICATION.md) · [Avgränsning](EPIC_03_PLAN.md).

| Acceptanskriterium / produktkvalitet | Tekniskt och automatiskt | Prova / UX / kundberedskap |
| --- | --- | --- |
| Prisma 7 startar mot ny DB och bevarar tidigare schema/data | PASS npm ci/generate/3migrate/seed och syntetisk uppgraderingskopia | Samma README-kommandon; ingen synlig UI-ändring. Ej kundklart. |
| Bokning, admin och kampanj samt lokal MCP bevarar beteende | PASS 51 unit/31 integration×3/12 E2E×4, lint/tsc/build | Ja lokalt, syntetiska uppgifter. Befintlig POC-UX oförändrad. |
| Tider bevaras vid DST och annan serverzon | PASS verklig ORM/rawSQL/SHOW TIME ZONE, sommar/vinter | Affärszon Stockholm, lagring UTC. Ingen midnattsbokning tillkommer. |
| Exclusion, idempotens,20parallell och kvoter består | PASS i produktvägen: 0 överlapp/deadlocks; direkt-ORM-bypass kan deadlocka | Testbart automatiskt, ingen drift-/flerinstansgaranti. |
| Ta bort höga Prisma-advisories utan override | PASS full audit0 high, prod 0 fynd | Verktygsträdet större; notices/releasekontroll krävs. |
| Rätta måttliga ESLint/minimatch-fynd med stödd kedja | **BLOCKERAT upstream**,7 moderate kvar | Inga lintregler/audit dolda. Inte ett grönt full audit eller pilotgodkännande. |
| Oberoende slut-QA och slutleverans | PASS, avgränsad lokal POC | Inga blockerande fynd; sju audit-fynd och distributionsgrindar kvar. |

E03-QA-1–5 är dokumenterade i DEPENDENCY_REVIEW: direkt-ORM-testets förväntade deadlock, CLI/EPL-distribution, upstreamfix, anslutningsåterhämtning och uppvärmning. Den specifika .env-autoladdningen är löst, OS-isolering återstår.

Sedan Epic 02: kontrollerad Prisma 7-adaptermigrering, explicit konfiguration, UTC-/felregressioner, licensinventering och full lokal verifiering. Inga schemafält/historiska migrationer eller användarfunktioner ändrade. Nästa produktfunktioner för adminidentitet/GDPR/kundkontakt kräver separat avgränsning. Demo från 7a65aee är äldre kod; ingen ny inspelning för osynlig ändring.

## Bilaga — Epic 02 godkänd status

Verifierat 2026-11-12, kod **3cd633b**, branch `epic-02-local-agent-booking`. Epic 01 och Epic 02 är avslutade som lokala POC:er. Groks oberoende slutkontroll av **cad997b** godkände samtliga steg, utan blockerande fynd, kl. 01:44 CET. Slutdemon på 7a65aee har 4/4 PASS. Pilot är fortfarande **NO-GO**. [Slut-QA](qa/QA-REPORT-epic02-cad997b.md) · [Exakta kommandon och resultat](VERIFICATION.md) · [Nattens arbetslogg](NIGHT_WORK.md) · [Demo, 14 bilder/4 videor](DEMO.md).

| Funktion / observerbart acceptanskriterium | Tekniskt / automatiskt verifierat | Kan provas? | UX och riktig kundberedskap |
| --- | --- | --- | --- |
| Kund väljer behandling/datum/tid, får bekräftelse och syns i admin | PASS, full E2E desktop/mobil i dev/prod med och utan proxy | Ja, lokal bokningssida | Mobil POC. Inte kundklart: pilotgrindarna nedan. |
| Admin kräver login, visar agenda och maskerad e-post; logout återkallar session | PASS, befintliga integrationer och E2E kvar | Ja, /admin med egen lokal konfiguration | Enkel agenda/delat lösenord, inga individuella roller/MFA. |
| MCP-bokning kräver två flaggor, bekräftad syntetisk indata och stabil nyckel; svaret saknar kundfält | PASS, verklig stdio, strikt schema och exakta statiska fel | Ja, npm run mcp:client -- --admin --book, sedan ja | Terminalbaserad operatörs-POC. Ingen fjärrautentisering eller verkligt samtyckesbevis. |
| 20 samtidiga anrop och överlappande 30/60 min ger en vinnare; retry ger samma id | PASS, domän/MCP och riktig HTTP/MCP, DB-exclusion kvar, 0 överlapp/deadlocks | Ja, automatiska tester | Integritetsbevis för denna POC, inte drift-/lastgaranti. |
| Gemensamt MCP-tak 5/dag och e-posttak 3/dag består över processomstart; replay efter tak fungerar | PASS, PostgreSQL-integration | Ja, lokal syntetisk testmiljö | Delad kanal är avsiktlig; inte individuella agentkonton eller distribuerat missbruksskydd. |
| Kampanjutkast från lokal agent publiceras manuellt och syns inom giltiga datum | PASS, befintligt fullflöde i fyra E2E-lägen | Ja, --admin-klienten och admin | Grundläggande informationsflöde; inga sociala kanaler eller betalningar. |

**Delvis:** översättningsförberedelse, kalenderns UX och inspelningens tillförlitlighet. Svenskt språk, SEK och Stockholmstid fungerar; full översättningsstruktur och veckokalender är inte byggda. Testklientens ja/nej/EOF passerar, men confirmed=true i själva verktyget kan sättas av en betrodd agent.

**Planerat men inte godkänt som nytt bygguppdrag:** individuella administratörer/MFA, kundernas datalivscykel, beroendeuppgraderingar och faktisk driftverifiering. Ingen Epic 03+ har uppfunnits eller implementerats.

**Blockerare före riktiga kunder/pilot:** delat adminlösenord; GDPR-export/radering/lagringstid saknas; 3 höga/7 måttliga audit-fynd; verklig TLS/proxy/flerinstansdrift inte testad; beslut om Visa e-post/kundkontakt saknas. Prisma-autoladdning av .env kräver dessutom korrekt framtida isoleringsdesign. Lokala adminflaggor och businessId=demo är inte tenant-isolering.

**Sedan förra arbetsomgången:** ett nytt opt-in create_booking med samma bokningsmotor; explicit syntetisk testklient; delad datumformatterare; negativa schema-/behörighetstester; kvot-/retry-/samtidighetsregressioner över verklig MCP och HTTP. Grok har godkänt första serverdelen och identifierat ett lågt fel i feltexten, rättat inför slutkontrollen. Inga nya beroenden, migrationer, betalningar, fjärr-MCP eller ändrade HTTP-kontrakt. Ingen push/merge/deploy.

## Bilaga — Epic 01:s godkända slutstatus

## Slutbeslut för dc15023

Epic 01 är avslutad som lokal POC-grund. Oberoende slutkontroll från Booking Lab QA (Grok Bot), rapport `QA-REPORT-epic01-dc15023.md`, anger att M2/L9/L8 är åtgärdade, utan nya fynd eller regressioner. Rapporten anger tidsintervallet 2026-11-11 kl. 23:48 till cirka 00:05 Europe/Stockholm (över midnatt). Epic 02 får planeras; den har inte påbörjats. **Pilot är fortsatt NO-GO.** Stängning innebär inte merge till main.

- QA rapporterar 80 omgångar med blandade överlapp och 30 omgångar på samma tid, 20 samtidiga anrop per omgång: exakt en framgång, 0 serverfel, 0 deadlocks och 0 överlapp.
- QA rapporterar integration 18/18 elva gånger i rad, unit 28/28 och produktions-E2E 8/8 med och utan proxy. Lint/tsc/build och städning passerade.
- [CI 43114326682](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43114326682) på dc15023: samtliga fyra E2E-jobb 8/8. Codex kontrollerade körningen efter push; QA bekräftar samma resultat. Bara audit-jobbet är rött: 3 höga och 7 måttliga fynd.

QA:s extra belastningskörningar är uppgifter från den lästa slutrapporten, inte nya körningar av Codex. Denna avslutning ändrar endast dokumentation; inga tester eller nya demoinspelningar har körts här. Lokala tidigare testresultat finns i [VERIFICATION](VERIFICATION.md).

### Kvarstående pilotblockerare

1. Delat adminlösenord utan individuella konton/MFA.
2. Kund-GDPR: export, radering och lagringstid saknas.
3. Audit-fynden återstår.
4. Verklig TLS/proxy, flera serverinstanser och riktiga IPv6-sockets är inte verifierade; limiter är processlokal.
5. Produktbeslut om adminens kontaktväg, ”Visa e-post”, återstår.

### Uppföljning vid planering av Epic 02

- Bedöm 409 för bokningskonflikt; dagens 400 är befintligt kontrakt och ändras inte i avslutningen.
- Om bokningar över midnatt införs måste låsningen omfatta berörda dagar.
- Bedöm transaktionsfel utanför INSERT; nuvarande konfliktmappning täcker endast INSERT. Inga sådana fel observerades i slutkontrollen.

Ingen ny fixbeställning behövs för Epic 01. Nästa produktsteg är en beslutad, avgränsad Epic 02; backloggpunkterna ovan startas inte automatiskt.

## Historik före slutgodkännandet

## Uppföljning M2/L8 och CI – 2026-11-11

Kod **01e80ed**, bas **8b83a40**. Bokningsförsök låses per anställd/dag före tillgänglighetsläsning; strukturerade insert-konflikter ger befintligt domänfel. IPv6-proxynät som också litar på IPv4 nekas. Tre historiska migrationer och exclusion bevarade. CI är konfigurerat för fyra E2E-lägen; extern körning återstår tills push godkänns.

Verifierat lokalt: 28/28 unit, 18/18 integration fem gånger, totalt 100 stressomgångar à20 anrop med en framgång/omgång, <2 s/omgång och 0 överlapp/deadlocks. Alla fyra E2E-lägen 8/8, lint/tsc/build och cleanup PASS; slutdatabas 0 bokningar/0 kampanjer/0 sessioner. [Exakta kommandon, resultat och begränsningar](VERIFICATION.md).

Ingen ny demo enligt produktägarens beslut; senaste inspelning avser äldre kod. Ingen push/merge eller Epic 02-funktion. Visa e-post fortsatt undantagen. Audit omkördes inte; senast 3 high/7 moderate. Pilot fortsatt NO-GO av tidigare skäl. Nästa steg: oberoende kontroll av M2/L8, fyrfälts-CI efter godkänd push och därefter beslutad Epic 02. Inga observerade regressioner i sluttester.

## Historik före denna uppföljning

Verifierat 2026-11-11, kod **a364bda**, bas 056d0c2, branch epic-01-foundation-hardening. Endast lokala commits, ingen push eller merge. Inga nya produktfunktioner eller beroenden. [Faktiska kommandon och resultat](VERIFICATION.md).

| Funktion | Tekniskt/automatiskt verifierat acceptanskriterium | Kan provas och UX | Riktiga kunder? |
| --- | --- | --- | --- |
| Inloggning | Fem fel spärrar även rätt lösenord före jämförelse; 50 ytterligare försök nekas med fördröjning; annan klient loggar in. Unit + E2E i fyra lägen PASS. | Lokal adminvy; statiskt svenskt fel. NAT delar spärren. | Nej: delat lösenord och processlokal limiter. |
| Klient-/proxygräns | Statisk engångsvarning, snävare prefixvalidering, IPv6-/64 unit PASS; spoofing-E2E fortsatt PASS. | Konfigureras enligt README:s driftmatris. Ingen ny UI. | Nej: riktig TLS/proxy och flera processer ej verifierade. |
| Bokning | Befintliga överlapps-, idempotens- och dagstakstester PASS; kundflöde och bekräftelse PASS. | Mobil/desktop kan provas lokalt med syntetisk data. | Nej: GDPR-livscykel, drift och audit återstår. |
| Session/logout | Återkallelse PASS; 100-raders gallring bevarar aktiva sessioner; efter full E2E/timeout 0 kvarvarande testsessioner. | Logga in/ut; versionsnumret får bara höjas. | Delvis: ingen individuell adminidentitet eller schemalagd retention. |
| Adminbokningar | Maskerad e-post, datumfilter och vy fortsatt E2E PASS. | Kan provas; kontaktväg inte beslutad. | Nej: Visa e-post fortfarande undantaget. |
| Lokal MCP och kampanjer | Befintliga behörighets-, validerings- och miljötester PASS; skapa utkast/publicera E2E PASS. | Lokal stdio och manuell publicering. | Nej: endast betrodd lokal POC. |
| Demo | Produktionsdemo 2/2 PASS, 12 bilder/2 videor, ren kodrevision. | Korta Testkund Anna/Erik; två adminbilder visuellt granskade. | POC-demo, inte produktionsgodkännande. |

**Förändrat sedan förra omgången:** H1 och felaktigt E2E-antagande rättade; proxyvarning och konfigurationsskydd; IPv6-gruppering; sessionsgallring/städning; host/hostaddr stoppas i test-/demovakt; demo och startdokumentation korrigerade. Historiska migrationer och exclusion oförändrade.

**Resultat:** 24 unit, 17 integration, 8 E2E i vardera av fyra lägen, lint/tsc/build, timeout-probe och demo PASS. Audit FAIL: 3 höga + 7 måttliga. Tidig E2E-kollision och omkörning redovisas i VERIFICATION.

**Planerat/separat beslut:** oberoende QA av batch 3, beroendeåtgärder inklusive separat Prisma-plan, verifierad TLS/proxy, individuella adminkonton och GDPR-livscykel. Visa e-post beslutas före pilot. Ingen Epic 02 startad. **Pilot NO-GO.**

[Ny lokal demo](../demo-artifacts/2026-11-11T21-53-01-311Z/index.html) · [Handoff](HANDOFF.md) · [Produktägarrapport](PRODUCT_OWNER_REPORT.md)

## Historik före batch 3

# Projektstatus – Booking Lab SE

## Aktuell status: Epic 01 QA batch 2

Verifierat 2026-11-11, kod **a84e48a32a874a4392c13bb4f32437d06b317c45**, bas b000481 på epic-01-foundation-hardening. Punkterna 1–5 och 7–11 levererade, punkt 6 undantagen. Ingen Epic 02, push eller ändrad synlighet. Lokala commits ligger före GitHub-versionen.

| Funktion / acceptanskriterium | Tekniskt och automatiskt testat | Prova / UX / kundklarhet |
|---|---|---|
| Fem fel från A spärrar inte korrekt lösenord; 30 bokningsförsök från A spärrar inte B | PASS, riktiga sockets i direkt/proxyläge | Lokalt API/tester. IP/NAT delar fortfarande tak; inte kundklar. |
| Förfalskad IP från olistad proxy nekas; full Map blockerar inte nya klienter | PASS E2E/unit, startup utan proxylista nekas | Konfigurationsskydd; verklig driftsproxy/TLS återstår. |
| Max fem nya bokningar/klient/dag och tre/e-postnyckel inklusive +taggar | PASS, sex samtidiga försök ger fem bokningar | Syntetisk demo/API; inte verifierad identitet. |
| Kopierad cookie nekas efter logout; global versionsåterkallelse består | PASS E2E/unit | Logga ut i sidhuvudet. Delad identitet och ingen sessionsgallring. |
| Ogiltiga datumfilter ger 200, svensk text och standardintervall | PASS E2E/unit | Kan provas i /admin. Agenda, inte full kalender. |
| Kundretry/dubbelsubmit ger samma ID och en rad; replays förbrukar ingen budget | PASS HTTP/UI/integration | UUID hålls i formulärminnet, inte över sidomladdning. |
| Kampanjfel skiljer omvända datum från för lång giltighet | PASS unit, tidigare campaign-integration kvar | 100 % tillåts som information; ingen debitering. |
| MCP följer exporterad databas trots annan env-fil; cleanup efter timeout | PASS integration och separat faktisk timeout-process | Lokal stdio och syntetisk DB. Ingen fjärr-MCP. |
| YYYY-MM-DD och logout i header, utan N-badge | PASS produktionsdemo + två visuellt granskade bilder | Kan provas; textdatum saknar native kalenderpopup. |

Sammanfattad verifiering: **20 unit, 16 integration, 8 E2E i vardera av fyra lägen**, lint/tsc/build PASS. Produktionsdemo 2/2 PASS. Audit FAIL: 3 höga + 7 måttliga. [Faktiska kommandon, tidigare fel och ej körda kontroller](VERIFICATION.md).

## Kvarstående och planerat

- Punkt 6 (Visa e-post) är inte implementerad enligt beslut. Adminmaskering och minimerat MCP-svar består.
- Individuella administratörer, datalivscykel/GDPR, sessionsgallring, auditåtgärder och verifierad drift saknas. Ingen funktion är godkänd för riktiga kunder.
- Processlokala räknare, NAT-delade tak, obegränsad kampanjlista och CSP unsafe-inline kvarstår. Flerföretagsisolering är inte verifierad.
- Docker/PG16, extern CI och verklig TLS/proxy har inte körts/verifierats i denna batch. Repo är privat och ändringarna är inte pushade.

## Förändrat och demo

Den globala bucketen och blinda header-tilliten har ersatts med verifierad socketgräns. Logout återkallar serverraden. UI-retry, säkra filterfel, tydliga datum och tillförlitligare teststädning finns nu. Ingen ny dependency; gamla migrationer och exclusion constraint är oförändrade. Ny migration tillför sessioner och bokningsnycklar för dagstak.

[Ny produktionsdemo](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html), [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json): a84e48a, dirty=false, 12 bilder/2 videor. Bilder är visuellt granskade; videometadata kontrollerade, inte full genomtittning. Artefakter är lokala, inte åtkomliga via Git. Prova enligt [DEMO](DEMO.md).

Tre nästa mål: (1) oberoende QA av denna revision och därefter godkänd delning till privat repo, (2) separat auditåtgärd samt Docker/CI/TLS-proxy-verifiering, (3) individuella adminidentiteter och beslutad/testad datalivscykel före pilot. Inget av detta är påbörjat som Epic 02.

## Historik före QA batch 2

Senaste kodrevision: `3b3309d` (endast återstående formatering efter funktionellt testade `26ea617`); lint/tsc/build/Prettier omkörda PASS.

Verifierat 2026-11-11, kodrevision `26ea6171de05fe17ce4d8bd1e4a4d931d9d5bc82`, branch `epic-01-foundation-hardening`, bas `ed1658a`. Denna leverans är **Epic 01 QA fix batch**, ingen ny Epic. Faktiska kommandon, fel och ej körda kontroller: [VERIFICATION](VERIFICATION.md).

## Fungerar och är automatiskt testat

| Funktion och acceptanskriterium | Tekniskt/testat | Kan provas? | UX / riktiga kunder |
|---|---|---|---|
| Kund bokar ledig tjänst; bekräftelse innehåller tjänst och Stockholmstid | PASS unit/integration/E2E | Ja, lokal demo | POC; native datumformat och nätverksfel behöver förbättras. Inte kundklar. |
| Samtidighet: 20 försök, exakt en bokning per konfliktfönster, noll SQL-överlapp | PASS riktig PostgreSQL | Via automatiska tester | Ingen belastnings-/flerprocessdrift verifierad. |
| Retry: samma nyckel/payload ger samma 201/ID även 20 parallellt; annan payload 409 | PASS domän och HTTP | API med Idempotency-Key | Nyckel är valfri; UI genererar ännu ingen retry-nyckel. |
| Admin: datumfilter, max 100/sida, maskerad e-post; 150 poster ger100 + 50 | PASS integration/E2E | Ja, /admin | Agenda, inte full kalender; felaktigt URL-filter ger generiskt fel. Delad identitet. |
| Logout tar bort browseråtkomst; versionshöjning ogiltigförklarar gamla cookies | PASS E2E/unit | Ja, Logga ut / lokal konfiguration | Global återkallelse, inga individuella serversessioner. |
| Missbruk: sjätte felaktiga login ger 429; max 3 skapade bokningar/e-post/Stockholmsdag | PASS unit/integration/HTTP | API/testsvit | Processlokal IP-gräns; proxykonfiguration krävs före drift. |
| MCP: avgränsade läsningar och strikt kampanjutkast, utan kundnamn/e-post | PASS stdio-integration/E2E | Ja, lokal testklient | Betrodd lokal --admin, ingen publik fjärråtkomst. |
| Kampanj publiceras manuellt och visas bara under giltiga datum, max 90 dagar | PASS integration/produktionsdemo | Ja, MCP + admin | Informationspris, ingen debitering. |
| Headers, no-store admin, testdatabasgrind | PASS E2E/unit, HSTS i produktionsdemo | Testkommandon | CSP unsafe-inline, verklig TLS/proxy ej verifierad. |

Inga ovanstående funktioner är godkända för riktiga kunduppgifter. **14 unit + 14 integration + 6 E2E PASS**, lint/tsc/build PASS; demo 2/2 PASS. Audit FAIL: 3 höga + 7 måttliga.

## Delvis implementerat och blockerare

- Lokal missbruksspärr och global sessionsversion finns; individuella konton, individuell återkallelse och robust driftgräns saknas.
- Bokningslista är avgränsad; kampanjlistan är fortsatt obegränsad. Pagineringen är inte en fryst snapshot.
- Testad Windows/PostgreSQL 18.6/Chromium. Docker/PostgreSQL16 och faktisk GitHub-CI inte körda.
- Kvarvarande audit, binära tredjepartsnotiser/källkodserbjudande, TLS, loggar, backup/restore, gallring, rättslig grund och mottagare måste hanteras före kunddrift.
- Ingen verifierad flerföretagsisolering. Ingen fullständig extern trafik-/leverantörsgranskning.

## Förändrat sedan föregående arbetsomgång

QA-fynd 1–13 hanterade med rate limit, dagstak, logout/version, avgränsad lista, idempotensmigration, headers, test-DB-grind, strukturerad konfliktmappning, samtidighetstester, kampanjregler, bekräftelse/prisformat och produktionsdemo. Enradiga filer formaterade, audit separerat i CI, licensnotiser och separat Prisma 7-plan tillagda. Inga nya npm-beroenden, ingen major-uppgradering; gammal migration/exclusion constraint bevarad.

## Prova nu

Följ [DEMO](DEMO.md). [Nytt galleri med tolv bilder och två videor](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json). Inspelat mot produktionsbygge, bas ed1658a med arbetsändringarna som sedan blev 26ea617. Artefakter är lokala/ignorerade, inte del av Git.

## Tre rekommenderade nästa mål (inte påbörjade)

1. Oberoende QA av denna commit och verifiering på Docker/PostgreSQL16/CI; hantera audit i separat beroendeförändring enligt Prisma 7-planen.
2. Före pilot: individuell adminidentitet/återkallelse och verifierad TLS/proxy-/missbruksgräns.
3. Syntetisk driftövning för backup/restore, loggminimering, gallring och dataskyddsansvar; tenant-isolering före delad flerföretagsdrift.
