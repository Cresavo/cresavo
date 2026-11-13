# Projektstatus — agentbokning och ägarens arbetsdag

Verifierat 2026-11-13. Branch **feature/agent-booking-workday** från e702838.
Produkt och slutlig Grok-revision: **05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1**. Senare dokumentationscommit ändrar ingen produktkod.

| Acceptanskriterium                                                | Verifierat resultat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stängt kort/processomstart tappar inte kvitto eller oklart försök | PASS: beständig försökslogg, återläsning och uttrycklig retry med samma nyckel/payload. Ingen automatisk ny bokning vid omöppning.                                                                                                                                                                                                                                                                                                                                                                            |
| Dubbeltryck, tappat svar och samtidiga retries                    | PASS: en bokning/en create-händelse; samma kvoter, idempotens, domänlås och exclusion.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Känd UUID ger inte annan profil ett kvitto                        | PASS: båda riktningar, före/efter commit och race; statiska nekanden även via äldre MCP och publik HTTP.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Flytt/avbokning syns i återläst kvitto                            | PASS i MCP och produktionsbyggd testvärd. Vanlig skyddad admin används för ändringar.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Kalenderfil för egen aktiv bokning                                | PASS: faktisk testvärdsnedladdning, UTC/DST, stabil UID, escaping/radvikning och längd utan buffert. Import/synk ej verifierade.                                                                                                                                                                                                                                                                                                                                                                              |
| Separat ägarkort                                                  | PASS: dag/nästa besök/lediga tider, 20 bokningar per sida, ett läsverktyg, inga kundkontakter.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Responsiv presentation                                            | PASS i Chromium-testvärd vid 320/390/1024 px. Detta är inte fysisk iPhone eller native ChatGPT.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Historik och migrationer                                          | PASS: högst 20 historiska försök plus pending; en additiv migration, nio historiska oförändrade. Uppgraderingsprov och gamla bokningar bevarade.                                                                                                                                                                                                                                                                                                                                                              |
| Grok                                                              | Grok GO för lokal syntetisk POC på exakt 05e5eaf efter två samlade rättningsvarv. Egen separat kopia: 91 unit, 125 integration, 13 kort och 192 webbtester PASS; inga Medium/High. Övriga Low/Info är backlogg. [Groks originalrapport](qa/QA-REPORT-agent-workday-f2-05e5eaf.md). Två samlade rättningsvarv använda; inga nya Medium/High enligt slutrapporten.                                                                                                                                              |
| Privat leverans och CI                                            | Verify POC på exakt 05e5eaf: alla fyra jobb gröna, 48 webbtester per jobb. Dev0 kör även 91 unit, 125 integration och 13 korttester. Docker/PostgreSQL användes i CI; det är inte ett lokalt Dockerprov. [Actions 43467138367](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43467138367).                                                                                                                                                                                                 |
| Lokal aktivering                                                  | Fryst lokal runtime och vanlig skyddad webb på 3187 kör 05e5eaf. Tionde migrationen tillämpad additivt; båda befintliga demokvittona återtagna genom granskad idempotent retry. Separat booking_workday_demo är konfigurerad med endast show_workday. Ingen extern deploy. Samma privata personliga plugin är uppdaterat till 0.3.0, release pluginrel_6af7418393e88191bb5834222b306ab3. Återläsning verifierar oförändrad identitet, audience, anslutningar och standardprompt samt exakt granskad launcher. |
| Faktisk klient                                                    | Faktiskt läsanrop från denna Codex-anslutning lyckades med bookingEnabled=true. Separata SDK-processer genom den riktiga lokala launchern och ägarkonfigurationen återläste båda gamla bokningarna; detta är inte native-klickning. Ingen app var exponerad i sidopanelen. Nya native-klick, ägarprofilens hot-reload, fysisk iPhone/Safari och kalenderimport är NOT RUN. Nästa inläsning av den lokala anslutningen kan behövas innan ägarkortet syns; inget manuellt QA-uppdrag lämnas till Niclas.        |

Ändrat sedan föregående omgång: beständig återhämtning, aktuellt kvitto, ICS och separat läsande arbetsdagskort. Två små rättningsvarv säkrar profilgränserna i båda riktningarna. Ingen ny dependency, ändrad bokningsmotor eller generell UI-omskrivning.

Detta är en betrodd lokal syntetisk demokanal, inte individuell kundautentisering. Ingen fjärr-MCP, ny drift, ny kostnad, riktiga uppgifter, utskick eller betalning. Ingen mainmerge. Mobil fjärranslutning, fysisk iPhone/Safari och verklig kalenderimport är **inte verifierade**. Kalenderfilen synkas inte vid senare ändringar. Pilot är fortsatt NO-GO.

Delvis/planerat: individuell kundbehörighet, mobil anslutning och kalendersynk. Mindre fynd ligger kvar: gammal kalenderfil-notis efter statusändring (AW-QA-3), fokus vid ägarkortets fel (AW-QA-4), tidigare sökfönster 28/35 dagar (CB-QA-1) och övriga Info enligt originalrapporterna. Samma secret och lokala MCP-identitet är avsiktligt samma kanal. Inga ytterligare fixloopar startas.

[Prova och se bilder](DEMO.md) · [kommandon och råa resultat](VERIFICATION.md) · [handoff](HANDOFF.md).

<!-- AGENT_WORKDAY_CURRENT_END -->

## Historik — tidigare leverans

# Projektstatus — lokalt MCP-kort till admin

2026-11-13, feature/mcp-card-booking-proof från fdcb41b. Produkt **8126410af712bdd71d6b6a42c0a1fcc58055d28d**.
[Godkänt scope](MCP_CARD_BOOKING_PLAN.md). Dokumentation därefter skiljs från kod.

| Acceptanskriterium                          | Faktiskt läge                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Välj, sammanfatta och uttryckligen bekräfta | PASS4bokningskortstester från produktionsbygge, plus320/390/1024bildprov utan skrivning. Fast syntetisk kund, ordinarie pris, tjänst/utförare och Stockholmstid.                                                                                                                                                                                                              |
| Dubbeltryck/retry ger en bokning            | PASSUI-dubbeltryck, sekventiell retry,20samma nyckel:1rad/1create-event/samma id. Ändrat payload409.                                                                                                                                                                                                                                                                          |
| Upptagen tid utan omstart                   | PASS20konkurrerande nycklar:1vinnare/0överlapp. UI läser om och kräver nytt val/bekräftelse.                                                                                                                                                                                                                                                                                  |
| Tappat svar efter commit                    | PASSi testvärden: okänt utfall, nytt val låst, exakt samma payload/nyckel på retry,1rad. Ingen felaktig ”ingen bokning”-försäkran.                                                                                                                                                                                                                                            |
| Bokning i vanlig admin/samma DB             | PASSproduktionsbyggd riktig kalender vid390/1024, vanlig individuell login. Egen CUA verifierade lokal admin/login; faktisk PC-kortkedja särredovisas nedan.                                                                                                                                                                                                                  |
| Default läsläge och separata skydd          | PASS2läsverktyg som standard; enbart explicit opt-in+flaggor/secret ger1app-skrivverktyg. Samma kundkvoter, inga adminbudgetar/registerverktyg.                                                                                                                                                                                                                               |
| Snäv SQL-roll                               | PASSriktig launcher: skapa/retry/konflikt; kundregister/admin och UPDATE/DELETE nekas. Booking-kontakter är syntetiska och behövs internt av motorn, men returneras inte.                                                                                                                                                                                                     |
| Oberoende Grok                              | GO för avgränsad syntetisk lokal POC;4Low/1Info i backlogg,0Medium+; 8126410af712bdd71d6b6a42c0a1fcc58055d28d. [Groks originalrapport](qa/QA-REPORT-card-booking-8126410.md)                                                                                                                                                                                                  |
| Faktisk PC / fysisk mobil                   | PASSanrop efter PC-omstart: bookingEnabled=true och tjänsteversion1. Niclas bekräftade själv bokning i native-kortet; databasen har2skilda bokningar,1create-event vardera och0överlapp. Codex verifierade båda i faktisk skyddad Chrome-admin och öppnade10.00-bokningens detalj. Egen native-kortklickning NOT RUN. Fysisk iPhone/Safari och mobilanslutning NOT RUN/olöst. |
| Privat leverans / Actions                   | [Actions43430009174](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43430009174) —4gröna jobb på8126410 efter1riktad omkörning av dev0 (första försöket112/113 i gammalt refundtest, anslutnings-/testtimeout; ingen kod/testgräns ändrad, rotorsak inte fastställd). Ingen mainmerge/deploy.                                                               |

Privat plugin uppdaterat/aktiverat med lokal bokningsprofil. Lokal vanlig admin: [PC-loopback](http://localhost:3187/admin).
Vercel-previewn och dess databas är OFÖRÄNDRADE, inte bevis på nya MCP-provet.
Testad POC är inte kundpilot. Faktiskt provboknings-id: b48ea9ab-c0e5-4013-8d25-64ca409228ce och47797e71-dfa2-4482-a34b-9b4481241723.

Slutmatris85unit/113integration/3läs-UI/4boknings-UI samt46webb-E2E×4,
lint/tsc/build PASS. Audit separat7moderate dev/0prod. Samma9migrationer,
domänmotor/auth/schema/lockfil; inga nya dependencies eller kostnader.
[Verifikation](VERIFICATION.md) · [prova/bilder](DEMO.md).

<!-- CARD_BOOKING_CURRENT_END -->

## Historik — tidigare leverans

# Projektstatus — lokalt MCP-tidvalskort

2026-11-13. Granskningsrevision **a65f0f2ee5750044dd46c5db50453db5602b79f2**,
branch **feature/mcp-time-card**, bas1a49a0e/produkt95f8071. [Godkänt scope](MCP_TIME_CARD_PLAN.md).

| Acceptanskriterium                                         | Faktiskt läge                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Välj behandling, utförare, dag och tid utan datumskrivning | PASS i egen MCP-testvärd vid320/390/1024px. Vanliga etiketter/knappar/select, sv-SE och Stockholmstid.                                                                                                                                                                                                                                |
| Riktig tillgänglighet, inte påhittade tider                | PASS samma getAvailability, 105integration och3korttester. Ny fixturebokning tar bort tiden från resultatet.                                                                                                                                                                                                                          |
| Förstå tidsvalets omfattning                               | PASS UI/text anger ingen reservation/ingen bokning. Ordinarie pris/längd/utförare och valt datum/tid visas.                                                                                                                                                                                                                           |
| Tomt, felaktigt eller ändrat underlag                      | PASS nästa dag, byte av behandling tömmer val, stale/transportfel/retry. 28dagars gräns, inga fria sökintervall.                                                                                                                                                                                                                      |
| Minimerad lokal anslutning                                 | PASS opt-in/loopback/test- eller demosuffix, production/VERCEL_ENV/skrivflaggor nekas. Low3: VERCEL/VERCEL_URL ensamma nekas inte. Endast2läsverktyg; kunddata och skrivning nekas även av separat SQL-läskonto.                                                                                                                      |
| Faktiskt AI-klientanrop                                    | PASS exponerade pluginverktyget i denna konversation, Anna16tider och Erik12tider16nov. Inte SDK som ersättning.                                                                                                                                                                                                                      |
| Faktisk PC-rendering / klick / mobil                       | Användarens PC-foton visar korten. Efter ett foto med hämtningsfel bekräftade Niclas 2026-11-13 att kontrollknappen svarar ”Tiden är fortfarande ledig. Ingen bokning har skapats.” Det är användarens lyckade prov, inte egen CUA- eller Grok-klickning. Orsaken till föregående fel är okänd; mobilen visar fortfarande inget kort. |
| Oberoende Grok-QA                                          | GO för lokal syntetisk POC på a65f0f2. Egna83/105/3/46×4 PASS; MCP63/0. Egna guard20PASS/2FAIL och UI38PASS/2FAIL med3Low/5Info, ingaMedium+. Inget eget ChatGPT-prov.                                                                                                                                                                |
| Fokus och vald kontrast                                    | DELVIS: GrokLow1 fokus tappas vid laddning, Low2 vald kontroll har dålig hoverkontrast. Backlogg, inte dolt av gröna funktionstester.                                                                                                                                                                                                 |
| Privat push/Actions                                        | a65f0f2 pushad privat efter scopedGrokGO. Full Actions43417840017 PASS:4gröna46/46 på sammaSHA; ingen mainmerge.                                                                                                                                                                                                                      |

Tekniskt verifierad POC är inte ett löfte om färdig upplevelse i ChatGPT.
Nuvarande testmatris: **83unit,105integration,3kort-UI,46webb-E2E i vart och ett
av4lägen**, lint/tsc/build PASS. Audit separat:7moderate dev/0prod.
Fysisk iPhone/Safari och kundpilot är inte verifierade/godkända. Ingen ny drift,
betalning, modellnyckel, schemaändring eller dependency. Befintlig preview95f8071
och ägarens kapacitets-MCP oförändrade. [Kommandon/utdata](VERIFICATION.md).

Sedan förra leveransen: separat read-only MCP Apps-kort, privat lokalt plugin,
minimerat SQL-konto och riktade tester. Manuell kundlivscykel består och
automatisk gallring är fortsatt avstängd. Full produktvision ligger kvar i roadmapen.

## Historik — föregående verifierade leverans

# Projektstatus — kundlivscykel och verkligt ägaragentprov

2026-11-13. Fryst produkt **95f807196f9b15e0bae2afdcd89604837cf747dd**, branch
**feature/customer-lifecycle-agent-proof** från d2ccb6c efter produkt8843d06.
Dokumentation/bilder därefter är separata. Ingen mainmerge eller ny Epic.

| Acceptanskriterium                                             | Faktiskt verifierat / produktkvalitet                                                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exportera valt kort och kopplade bokningar                     | PASS unit/integration/E2E/initialGrok:100/fil,150=100+50, max1000, ingen annan kund eller intern nyckeldata. Verklig UI-nedladdning i E2E.                                                                          |
| Förhandsgranska och uttryckligen bekräfta kontaktåtgärd        | PASS alla4E2Elägen och egen faktisk webbklicktest. Kommande aktiva besök stoppar POC-åtgärden; kort arkiveras och kan inte återaktiveras.                                                                           |
| Bevara teknisk historik och skydd                              | PASS20retries, races, auth/origin/foreign/stale/oversize. Tid/pris/status/version/events/kapacitetsbeslut/exclusion består.                                                                                         |
| Även äldre e-postkvotkopior minimeras utan budgetåterbetalning | LC-QA-1 rättat i fixvarv1: nya HMAC, äldre dualcount och omkodning vid manuell åtgärd. Nytt test99och faktisk MCP+HTTP-E2E PASS. Grok stängdeLC-QA-1 på95f8071.                                                     |
| Ägaragent använder faktiskt lokal MCP                          | PASS faktiska Codex tools.\*: read/inspect/draft/retry/negatives/stale, ett opublicerat20%-utkast. Egen webbåterbokning och DB1beslut/1ledger/0överlapp. MCPe2e0e39, kapacitetskod oförändrad i95f8071; web95f8071. |
| Automatisk gallring och kontakt-MCP av                         | PASS. Inga kontaktverktyg, modellnycklar eller nya agentintegrationer.                                                                                                                                              |
| Privat CI och samma skyddade preview                           | PASS [Actions43393207291](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43393207291):4×46/46 på95f8071. Stabil skyddad alias kör dpl_<redacted>, READY Preview/fra1.           |

[Öppna skyddad kundarbetsyta](https://booking-lab-se-preview.vercel.app/admin/customers). Vercel vid behov, sedan demoknapp. Endast påhittade uppgifter.

Slutmatris EFTER fix1: **79unit/99integration/46E2E×4**, lint/tsc/build PASS.
Ren npmci571Windows,9migrate/seed på6nya miljöer,8→9med legacykvot/återseed
PASS.196källfiler matchar fryst kod. Full audit FAIL7moderate dev; prodPASS0.
Grok initiale2e0e39:79/98/46prodPASS och syntetiskt GO med MediumLC-QA-1.
Riktat fixvarv1: Grok-GO på95f8071, LC-QA-1 stängt, inget Medium+. Egna79/99/46prod, LC-prob23/0 och katalog27/0. Underlagsgranskning av Codex agentprov; inget eget Codex-/molnprov.
[Verifiering](VERIFICATION.md) · [faktiskt agentprov](agent-proof/OWNER_AGENT_2026-11-13.md).

Sedan förra leveransen: manuell kundexport/kontaktåtgärd med minimal logg,
separata privacymarkörer och begränsad MCP-profil som provats av verklig klient.
Automatisk gallring är avstängd enligt Niclas. Inga historiska migrationer,
paket eller låsfiler ändrade; ny migration9 är additiv.

**Delvis/kvar:** inte full anonymisering eller komplett GDPR-registerutdrag.
Oanknutna bokningar, fria kampanjrubriker, driftloggar, hämtade exporter och
backups omfattas inte. Äldre ännu inte hanterade kvotrader kan ha rå e-post.
Verklig lagringstid/rättighetsprövning och återläsning utan återinförda kontakter
måste lösas före pilot.10hashade testspärrposter kvar i integration, övriga
egna affärs-/adminrader0; alla4E2Emiljöer0. Fysisk iPhone/Safari och Niclas
UX-godkännande är inte verifierade. Pilot fortsatt NO-GO.

## Historik — föregående verifierade leverans

# Projektstatus — proaktiv kapacitetsöversikt levererad

Verifierad **2026-11-13**. Branch **feature/proactive-capacity-overview**.
Produkt, Groks återkontroll och driftsatt kod:
**8843d06350c6478e375fb640579cb3ac4f7fe3dc**. Senare dokument-/bildcommit
ändrar ingen produktkod. Bas28a48fe efter avslutat kalenderprov; main är
fortfarande b000481 och har inte mergats.

[Öppna skyddad demo](https://booking-lab-se-preview.vercel.app/product) →
**Prova salongens arbetsyta → Översikt**. Endast påhittade uppgifter.

| Acceptanskriterium                                                        | Faktiskt verifierat / produktkvalitet                                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framtida avbokning visar tjänst, utförare, tid och verklig tillgänglighet | PASS domän/integration/UI/Grok/moln; högst7Stockholmsdagar, max20/sida. Regelbaserat, ingen modell eller intäktsprognos.                            |
| Ägaren öppnar rätt kalenderläge                                           | PASS egen klicktest på stabil alias:16november, Sam Demo; kalender/kundflöden kvar.                                                                 |
| Avfärdande och kampanjutkast består                                       | PASS integration/E2E/Grok; sparat utkast och status i faktisk preview. Beslut knyts till bokning+version.                                           |
| Rabatt väljs uttryckligen och faktisk omfattning framgår                  | PASS förhandsgranskning: tjänst+datum, alla bokningsbara tider/utförare; ingen slotreservation, automatisk publicering eller utskick.               |
| Dubbeltryck/retry/samtidighet ger högst ett utkast                        | PASS lokalt, Grok och20samtidiga HTTP-anrop i molnet; samma utkast-id och ändrad payload409.                                                        |
| Ny bokning eller ändrat underlag gör förslaget inaktuellt                 | PASS domän/Grok; verklig återbokning15.00 i molnet visar stale och behåller utkastet.                                                               |
| Senare förslag går att nå                                                 | PASS efter1samlat fixvarv: cursor i UI/API/MCP, omladdning/handling på sida2. Grok stängde PRO-QA-1.                                                |
| Lokal agent använder samma regler utan kundfält                           | PASS faktiska stdio-kontraktstester. Nya skrivningar kräver --admin --allow-workspace; ingen publik MCP eller påstådd Dots/Muse-integration.        |
| Uppgradering/seed bevarar äldre data                                      | PASS lokal7→8 och återseed; molnets84äldre bokningar oförändrade,92totalt,0överlapp.                                                                |
| Åtkomstskydd och återläsning                                              | PASS HTML/API/resurser, logout/revocation, TLS och alla4READY-adresser+stabil alias. Krypterad slutbackup återläst:12tabeller, identiska radhashar. |

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

| Funktion och observerbart acceptanskriterium                                            | Utfall och kvalitet                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produktingång visar verkliga funktioner och leder till arbetsyta/kundbokning            | PASS i faktisk preview. Separat /product; / och /admin består.                                                                                        |
| Vercel-inloggning vid behov, sedan demoadmin utan extra lösenord                        | PASS via stabil alias. Tydlig Demoägare; vanlig produktinloggning kvar.                                                                               |
| Sök namn/e-post/telefon, öppna kundkort och se kommande/tidigare/avbokade besök         | PASS API/integration/E2E/Grok och moln. Listor utan rå kontakt; kortets example.test-kontakt endast i pinnad demo.                                    |
| Skapa/redigera/arkivera kund utan att slå ihop personer eller skriva om äldre snapshots | PASS. Skapad kund finns efter omladdning; historik kvar efter arkiv.                                                                                  |
| Kalender → bokning → kundkort; ny bokning/återbesök med förvald kund                    | PASS faktisk molnprovning; skapa, flytta, avboka och återbesök. Dag/tid väljs med tryck.                                                              |
| Publik bokning fungerar och kan inte koppla/skriva över kund via e-post                 | PASS inklusive faktisk bokning med samma kontakt som ett kort; customerId förblir null.                                                               |
| Demo uppgraderas additivt och seed kan köras igen                                       | PASS: 35 äldre molnsnapshots bevarade,32 seedkunder/79 seedbokningar; vid slutprovet33 kort/84 bokningar inklusive egna syntetiska prover,0 överlapp. |
| Bilder och granskade mobilvyer fungerar                                                 | PASS riktiga färdigladdade bilder, nio Lucide-ikoner,320/390/1440px. Fysisk iPhone/Safari och Niclas UX-godkännande återstår.                         |

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
