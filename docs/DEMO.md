# Prova agentbokning och ägarens arbetsdag

Verifierat 2026-11-13. Branch **feature/agent-booking-workday** från e702838.
Produkt och slutlig Grok-revision: **05e5eafc68302b92eeb3ae2edf3829ffa73f7aa1**. Senare dokumentationscommit ändrar ingen produktkod.

Öppna samma [privata Booking Lab-plugin på PC](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3). Samma privata personliga plugin är uppdaterat till 0.3.0, release pluginrel_6af7418393e88191bb5834222b306ab3. Återläsning verifierar oförändrad identitet, audience, anslutningar och standardprompt samt exakt granskad launcher.
Fryst lokal runtime och vanlig skyddad webb på 3187 kör 05e5eaf. Tionde migrationen tillämpad additivt; båda befintliga demokvittona återtagna genom granskad idempotent retry. Separat booking_workday_demo är konfigurerad med endast show_workday. Ingen extern deploy.

Faktiskt läsanrop från denna Codex-anslutning lyckades med bookingEnabled=true. Separata SDK-processer genom den riktiga lokala launchern och ägarkonfigurationen återläste båda gamla bokningarna; detta är inte native-klickning. Ingen app var exponerad i sidopanelen. Nya native-klick, ägarprofilens hot-reload, fysisk iPhone/Safari och kalenderimport är NOT RUN. Nästa inläsning av den lokala anslutningen kan behövas innan ägarkortet syns; inget manuellt QA-uppdrag lämnas till Niclas.

## Prova hela flödet

1. Be om Booking Labs tidvalskort för Massage nästa vardag. Välj behandling, medarbetare, dag och tid. Bekräfta bara om du vill skapa en syntetisk bokning.
2. Stäng och öppna kortet igen i samma lokala profil. Servern återläser kvitto eller samma oklara försök. Vid oklart utfall används den uttryckliga kontrollknappen och samma nyckel; en ny bokning skapas inte automatiskt.
3. Välj Lägg i min kalender och Hämta kalenderfil. Detta ger en ICS-fil; faktisk import och uppdateringssynk är inte verifierade.
4. Öppna [vanlig lokal admin](http://localhost:3187/admin?date=2026-11-16), flytta eller avboka där och välj Uppdatera bokningsstatus i kortet. Vanlig individuell adminbehörighet krävs. Historiska bokningar och händelser bevaras.
5. Den separata lokala Codex-profilen booking_workday_demo erbjuder show_workday: be ”Visa min arbetsdag för nästa vardag”. Läs dag/nästa besök/lediga tider och använd länkarna till vanlig admin för ändringar. Kortet är läsande och visar inga kundkontakter.

Provningen är frivillig. Du behöver inte manuellt kvalitetssäkra leveransen åt Codex. Den fasta testkunden har fortfarande taket tre bokningar per dag; dina två tidigare testbokningar räknas. Taket kringgås inte och bokningar raderas inte för att frigöra budget.

## Reproducerbar testvärd

Följ README för ny isolerad loopback _\_test eller _\_demo, npm ci, generate, tio migrationer och seed. Kör sedan:

```text
npm run build
npx playwright test --config playwright.agent-workday.config.ts
```

Konfigurationen startar vanlig skyddad webb på loopback 3197 och explicit MCP Apps-testvärd. Alla 13 korttester använder egna syntetiska fixtures som städas. Det är inte native ChatGPT eller en iPhone-simulator. Den verkliga lokala adminn kör uttryckligen på 3187; 3197 är endast testvärden.

Ren ägarserver för en stdio-klient: exporterad DATABASE_URL till separat syntetisk loopbackdatabas, lång egen lokal SESSION_SECRET, BOOKING_OWNER_CARD_DEMO=1 och BOOKING_OWNER_WEB_ORIGIN till vanlig skyddad lokal webb. Kör `node --import tsx src/mcp/server.ts --admin --workday-card`. Inga allow-workspace/bookings-flaggor. Hemligheter ska inte stå i chatt eller delade filer.

## Riktiga bilder från slutrevisionens testvärd

![Ägarens arbetsdag vid 390 px](assets/agent-workday/owner-390.png)

![Aktuellt testkvitto](assets/agent-workday/receipt-390.png)

![Återläst avbokningsstatus](assets/agent-workday/reopen-390.png)

[320 px](assets/agent-workday/owner-320.png) · [desktop](assets/agent-workday/owner-1024.png) · [proveniens och SHA256](assets/agent-workday/manifest.json). Bilderna bevisar varken fysisk mobil eller ny native-klientfunktion.

## Stopp, återställning och gränser

För att stänga av kortets skrivprov: återställ den sparade tidigare läsprofilen ~/.booking-lab/time-card-readonly-8648316.json till time-card.json och läs om anslutningen. Den omedelbara tidigare bokningsprofilen finns också i time-card-booking-8126410-before-1794588993176.json, men den äldre bokningskoden saknar nya skydd och ska inte återaktiveras som lösning. För ägarkortet: sätt endast booking_workday_demo till enabled=false. Global config-backup finns lokalt i config.workday-before-1794589068648.toml; tidigare innehåll är byte-identiskt bevarat. Stoppa bara den identifierade loopback-wrappern på3187, aldrig alla Node-/Postgresprocesser. Återställ inte hemlighet, migration eller bokningar.

Ingen bokning eller migration ska raderas för att återställa profilen. Gamla runtimekataloger/profilbackup finns kvar. Privat envfil och SQL-roller återanvänder befintlig lokalt skyddad databas; ingen publik listener har öppnats.

localhost fungerar bara på PC:n. [Befintlig skyddad webbpreview](https://booking-lab-se-preview.vercel.app/admin) är oförändrad och är inte fjärr-MCP. Detta är en betrodd lokal syntetisk demokanal, inte individuell kundautentisering. Ingen fjärr-MCP, ny drift, ny kostnad, riktiga uppgifter, utskick eller betalning. Ingen mainmerge. Mobil fjärranslutning, fysisk iPhone/Safari och verklig kalenderimport är **inte verifierade**. Kalenderfilen synkas inte vid senare ändringar. Pilot är fortsatt NO-GO.

<!-- AGENT_WORKDAY_CURRENT_END -->

## Historik — tidigare leverans

# Prova MCP-bokningskortet på PC:n

**Demo – endast påhittade uppgifter.** Produkt8126410af712bdd71d6b6a42c0a1fcc58055d28d.
Privat plugin uppdaterat/aktiverat med lokal bokningsprofil. Grok: **GO för avgränsad syntetisk lokal POC;4Low/1Info i backlogg,0Medium+**. PASSanrop efter PC-omstart: bookingEnabled=true och tjänsteversion1. Niclas bekräftade själv bokning i native-kortet; databasen har2skilda bokningar,1create-event vardera och0överlapp. Codex verifierade båda i faktisk skyddad Chrome-admin och öppnade10.00-bokningens detalj. Egen native-kortklickning NOT RUN.

[Samma privata Booking Lab-plugin](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3)
och [lokal admin på PC:n](http://localhost:3187/admin). Ingen publik MCP eller
ny mobilanslutning. Den skyddade Vercel-demon är inte samma databas.

## Prova den aktiverade bokningsprofilen

1. Be pluginet visa Massage hos Anna nästa vardag. Inget bokas av verktygets visning.
2. Välj dag/tid. Läs tjänst, utförare, längd, ordinarie pris och Stockholmstid.
   Demofönstret13nov–10dec visas i kortet. Kontrollera mitt tidsval är valfri omläsning.
3. Kryssa ”Jag vill skapa den här testbokningen”, tryck ”Bekräfta testbokning”.
   Testkunden är fast Tidkort Demo. Inga verkliga uppgifter, utskick eller betalningar.
4. Läs kvitto/boknings-id. Öppna samma dag i lokal admin; bokningen ska synas där.
   Webben behåller vanlig individuell inloggning. Operatörens Chrome är redan
   inloggad på det isolerade syntetiska testkontot, inte en ny authgenväg.
5. Om tiden togs: välj ett av de uppdaterade alternativen och bekräfta på nytt.
   Vid tappat svar: ”Kontrollera samma bokningsförsök”, aldrig nytt försök med ny nyckel.

Tre bokningar per dag för den fasta testadressen; kanalens tak5/dag består.
Gamla bokningar raderas inte/återbetalas inte av en avbokning. Stänger du ett
kort med okänt utfall: kontrollera admin innan ny bokning. Lokal minnesnyckel
är inte en beständig klientjournal. Profil/secret ligger utanför Git/paket.

## Faktiskt PC-prov

Niclas bokade i det nya kortet efter omstart. Codex kontrollerade endast genom
läsning av DB: två olika Massage/Anna-bokningar måndag16nov09.30–10.00 och
10.00–10.30, ett create-event vardera,0överlapp. Båda lämnades kvar. Codex
öppnade faktiskt kalendern och10.00-detaljen i vanlig skyddad Chrome-admin.
Det är inte ett eget klicktest av själva native-kortet eller Groks PC-test.
[Öppna rätt kalenderdag på PC:n](http://localhost:3187/admin?date=2026-11-16&staffId=staff-demo).
Kalenderfliken är redan öppen i Chrome. [DB-bevis](verification/card-booking/user-native-booking.json).

## Bilder och bevis

[Bekräftelsesteg390](assets/card-booking/confirmation-390.png) ·
[kvitto390](assets/card-booking/receipt-390.png) ·
[admin390](assets/card-booking/admin-390.png) ·
[kvitto1024](assets/card-booking/receipt-1024.png) ·
[admin1024](assets/card-booking/admin-1024.png).
[Faktisk PC-admin](assets/card-booking/actual-pc-admin-calendar.png) ·
[faktisk bokningsdetalj](assets/card-booking/actual-pc-admin-booking.png).
[Manifest](assets/card-booking/manifest.json). Kortbilder är från egen verklig
stdio/testvärd, adminbilder från vanlig produktionsbyggd webbsida. Inte native
ChatGPT eller fysisk iPhone. [Groks originalrapport](qa/QA-REPORT-card-booking-8126410.md)

## Start och stopp

Portabel isolerad installation/profiler i [plugin-README](../plugins/booking-lab-time-card/README.md).
Admin kör via befintlig wrapper med samma DB. Lokalt operatörsstartkommando:
`node --env-file=<local-state>/codex/booking-lab-ui/.vercel/card-booking-web.private.env scripts/server.mjs --hostname 127.0.0.1`
från den frysta runtimekatalogen. Envfilen innehåller hemligheter och skickas aldrig.
Stoppa bara denna nya wrapper och detta plugin; stoppa inte delad PostgreSQL
eller ägarens andra MCP. Gammal read-only-profil bevaras som återgångsväg.
Pluginrelease pluginrel_6af70999bc548191a5554d9befb1fe19. [Actions43430009174](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43430009174) —4gröna jobb på8126410 efter1riktad omkörning av dev0 (första försöket112/113 i gammalt refundtest, anslutnings-/testtimeout; ingen kod/testgräns ändrad, rotorsak inte fastställd).
Ingen kostnad, mainmerge, ny Vercel-deploy eller pilot följer av provet.

<!-- CARD_BOOKING_CURRENT_END -->

## Historik — tidigare leverans

# Prova lokalt MCP-tidvalskort i ChatGPT på PC:n

[Booking Lab – tidval](https://chatgpt.com/plugins/plugins_6af6eef3bf6881919d99e654b91644e3)
är ett privat installerat plugin, endast för den förberedda lokala PC:n.
Den skyddade Vercel-previewn är oförändrad. Ingen ny bokningsfunktion eller
moln-/mobilanslutning har lagts till. **Demo – endast påhittade uppgifter.**

1. I en lokal ChatGPT-konversation, välj Booking Lab – tidval och be:
   ”Visa tidvalskortet för Massage hos Anna nästa vardag. Skapa ingen bokning.”
2. Om klienten visar kortet: välj dag och en tid med knappar. Behandling,
   utförare, längd och ordinarie pris visas. Inget datum behöver skrivas.
3. Kontrollera mitt tidsval läser tillgängligheten på nytt. En vald tid är
   aldrig reserverad; kortet skapar ingen bokning.
4. Byt behandling/utförare eller välj en stängd dag; tidigare tidsval töms och
   tomläget erbjuder nästa dag. Sökfönstret i provet är28kalenderdagar.
5. Visa kortet expanderat om du vill att Codex ska kunna klicktesta via den
   befintliga MCP Apps-panelstyrningen. Endast inlinekort syns inte i panelinventeringen.

**Viktig status:** faktiska pluginanrop fungerar och Niclas två riktiga PC-
foton visar Anna-/Erik-korten. Det är användarens renderingsbevis, inte egen
klickning. Niclas ser inget kort i mobilen: mobilstödet är olöst. Nedanstående
bilder är från egen Playwrightvärd med verklig MCP-resurs, inte ChatGPT.
Grok ger GO för lokal syntetisk POC; fokus/hoverkontrast/extraVercelflaggor
har3Low som ligger i backloggen. Inget mobil- eller pilotgodkännande.

- [320px](assets/time-card/harness-320.png) · [390px](assets/time-card/harness-390.png) · [desktop](assets/time-card/harness-1024.png).
- [Bildmanifest](assets/time-card/manifest.json) · [faktiskt anrop](verification/time-card/actual-tool-call.json).
- [Reproducerbar lokal installation och stopp](../plugins/booking-lab-time-card/README.md).
- [Kommandon/resultat](VERIFICATION.md) · [godkänt scope](MCP_TIME_CARD_PLAN.md).

Runtime8648316, granskning a65f0f2 (bara testoutput skiljer). Separat lokal
booking_timecard_demo, läskonto utan kundkontaktåtkomst/skrivning. Profil/nyckel
stannar utanför paket/Git. Stäng av just detta plugin för att stoppa provet;
stoppa inte delad PostgreSQL eller ändra ägarens andra MCP. Ingen ny avgift,
publik tunnel eller extern publicering. Fysisk iPhone/Safari ingår inte här.

## Historik — föregående verifierade leverans

# Demo — kunddata och verkligt lokalt ägaragentprov, 2026-11-13

[Öppna skyddade kundarbetsytan](https://booking-lab-se-preview.vercel.app/admin/customers)
· [produktingång](https://booking-lab-se-preview.vercel.app/product) · [kundbokning](https://booking-lab-se-preview.vercel.app/).
Vercel-inloggning vid behov, sedan demoknapp utan extra adminlösenord.
**Demo – endast påhittade uppgifter.** Fysisk iPhone/Safari inte verifierad.

## Prova på mobilen

1. Kunder → Ny kund. Använd påhittat namn och en ny example.test-adress,
   lämna telefon tom. Inga riktiga kontaktuppgifter eller utskick.
2. På kortet: Kunddata → Exportera → Förbered export → Ladda ner. Filen
   innehåller kort+kopplade bokningar, max100/fil och1000totalt. Fler delar
   förbereds med samma underlag. Fristående bokningar/loggar/backups ingår inte.
3. Vill du prova historiken: Ny bokning från just kortet, välj dag/tid med tryck.
   Öppna bokningen och avboka den innan kontaktborttagning. Pågående/kommande
   aktiva besök blockeras av POC-flödet och måste hanteras först.
4. Kunddata → Ta bort kontaktuppgifter → Förhandsgranska. Läs omfattningen,
   kryssa uttryckligen och bekräfta. Ett nytt tomt provkort kan också användas.
5. Ladda om och öppna Tidigare och avbokade. Namn/e-post/telefon och kopplade
   kontaktkopior är ersatta; tid/pris/status/historik finns kvar. Kortet är
   arkiverat och kan inte återaktiveras. I listan: Visa även arkiverade för att
   hitta det igen. Automatisk gallring är avstängd.

Det redan genomförda [egna molnprovkortet](https://booking-lab-se-preview.vercel.app/admin/customers/cmwepygwe000001o2y7dqxij5?view=history)
visar bevarad Avslappnande massage16nov16.30/450kr, nu avbokad och utan kontakt.
Ändra inte äldre demokort för provet; skapa ett eget. Ingen automatisk radering
eller återseed har gjorts. Exportfiler och äldre backups kan innehålla tidigare
uppgifter: detta är inte full anonymisering eller komplett GDPR-registerutdrag.

## Riktiga före-/efterbilder

Samtliga molnbilder kommer från95f8071 och samma eget syntetiskt kort:

- [Före: förberedd export, kontakt och kopplat besök](assets/lifecycle/cloud-export-mobile.png).
- [Omfattning och avstängd bekräftelse före kryss](assets/lifecycle/cloud-confirm-mobile.png).
- [Efter: kontakt borta,450kr-historik kvar](assets/lifecycle/cloud-removed-mobile.png).
- [Efter på desktop](assets/lifecycle/cloud-removed-desktop.png).
- [Egen CUA på stabil alias](assets/lifecycle/stable-removed-mobile.jpg), CSS390×844;
  browserverktyget returnerade skalad247×844bild. Automatiska molnbilder är390/1440.
- [Manifest/källa/revision/pixelmått/hashar](assets/lifecycle/manifest.json).

Playwright verifierade riktig nedladdning/20retries/bounds/layout i faktiska
molnmiljön; egen CUA kontrollerade stabilaliasens färdigladdade kort. Egen
lokal CUA provade även skapande/exportförberedelse/kryss/borttagning/reload.
Ingen bild på laddningsskärm eller ny video används som bevis.

## Agentprovet är lokalt, inte previewns MCP

Denna faktiska Codex-konversation använde6befintliga lokala MCP-verktyg:
läs/inspektera, skapa ett opublicerat20%-utkast16november, retry/negatives och
stale efter egen webbåterbokning09.00.1beslut/1ledger,0överlapp. Kampanjen gäller
tjänst+hela dagen, inte bara luckan. [Faktiskt transkript och avgränsning](agent-proof/OWNER_AGENT_2026-11-13.md).
Utkastet och dessa4förslag finns i separat booking_lifecycle_demo på PC:n;
de har INTE kopierats till molndemon. Ingen publik MCP eller ny anslutning.
confirmed=true är klientens försäkran, inte bevis för mänskligt samtycke.

MCPe2e0e39/identisk kapacitetskod, webb95f8071 vid huvudprovet. Nästa start av
befintlig booking_calendar_demo är konfigurerad till separat pinnad95f8071-
runtime och SDK-testad. Ingen automatisk följning av utvecklingsarbetskopian.
Lokalt via projektets vanliga instruktioner: separat \*\_demo,9migrate/seed,
BOOKING_DEMO_SEED=1 npm run demo:seed:capacity och individuell admin. Operatörens
privata profiler/nycklar finns utanför Git; klistra dem inte i chatt.

## Revision, åtkomst och kostnad

Produkt/Grok/CI/deploy **95f807196f9b15e0bae2afdcd89604837cf747dd**, feature/customer-lifecycle-agent-proof.
dpl_<redacted>, READY Preview(target=null), runtimefra1/NeonFrankfurt,
buildcle1/USA. [Actions43393207291](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43393207291):4gröna46/46.
Grok stängdeLC-QA-1 efter1fixvarv, egna79/99/46prod, inget Medium+. Deras
agentbedömning gäller underlaget, inte egen åtkomst till vår PC/preview.
[Verkliga resultat/NOT RUN](VERIFICATION.md) och [originalrapport](qa/QA-REPORT-lifecycle-fix1-95f8071.md).

SSOall på5READY-deployments+stabilalias, HTML/API/resurser/chunk skyddade.
Ny kod kräver fortfarande appsession/origin; vanlig individuell produktlogin
finns kvar. Bara Niclas, inga nya konton, delningslänkar eller publika tjänster.
92äldre bokningar/33kort är oförändrade; slut93/34 med ett eget borttaget
provkort+en avbokad bokning,0överlapp. Krypterad backup före12/efter13tabeller
återläst med identiska radhashar; lokaloperatörs-PC, inte automatiskoffsite.
Samma VercelPro/NeonFree, inga nya abonnemang/tillägg/domänköp. Några få dollar
extra befintlig användning är godkänd ram, inte hårt tekniskt tak; faktura ej
verifierad. Ett för tidigt bygge avbröts och korrekt nytt bygge kördes; ingen
Production-promote eller mainmerge. Kundpilot fortsatt NO-GO.

## Stoppa just detta bygge

Vid ett nytt konkret stoppuppdrag, ta bort just denna Previewdeployment och
kontrollera därefter alias/URL. Ingen databas raderas:

```powershell
vercel remove dpl_<redacted> --scope <redacted-vercel-team> --yes
```

Äldre4READY-byggen finns kvar och stoppas inte av detta. Ett fullständigt
demostopp måste inventera alla adresser och återkalla demoaktör/sessioner;
PauseProject är inte verifierat som stopp för alla Previewbyggen. BehållSSO.
Återgå inte automatiskt till äldre kod mot nya privacyfält; kompatibiliteten
måste kontrolleras. DBåterläsning kan återinföra kontakter och kräver hantering
av efterföljande kontaktåtgärder innan åtkomst öppnas. Inget stopp utfördes nu.

## Historik — föregående proaktiva demo

### Demo — proaktiv kapacitetsöversikt, 2026-11-13

[Öppna Booking Lab](https://booking-lab-se-preview.vercel.app/product) ·
[översikten](https://booking-lab-se-preview.vercel.app/admin/overview) ·
[kalendern](https://booking-lab-se-preview.vercel.app/admin) ·
[kundbokning](https://booking-lab-se-preview.vercel.app/).
Vercel-inloggning vid behov, sedan **Prova salongens arbetsyta** eller
**Öppna demoadmin**. Demoägare, endast påhittade uppgifter. Hela sajten,
API och resurser omfattas fortsatt av befintligt Vercelskydd; inga nya konton.

## Prova hela flödet

1. Välj **Översikt**. Sam Demo har måndag16november09.00 ett nytt bokningsbart
   förslag;14.00 är också lämnat öppet.10.00 är återbokad,11.00 avfärdad,
   13.00 har ett10%-utkast och15.00 ett15%-utkast vars tid återbokats.
2. **Öppna kalendern** på09.00: samma datum, dagvy och Sam Demo ska vara vald.
   Gå tillbaka till Översikt.
3. **Förbered kampanjutkast**. Välj rabatt själv och datum med kalenderknappar.
   Förhandsgranska verklig omfattning: tjänst+hela datumperioden, alla bokningsbara
   tider/utförare. En lucka reserveras inte och ordinarie debitering ändras inte.
4. **Spara kampanjutkast**, ladda om och **Granska sparat kampanjutkast**.
   Samma utkast finns i Kampanjer; publicera inte under detta prov.
5. Boka samma09-tid genom kalendern och uppdatera förslagen. Det blir inaktuellt
   men utkastet finns kvar med varning. Prova att avfärda14-förslaget och ladda om.

09-provets20%-förhandsgranskning sparades inte vid leverans, så tiden är kvar
för dig. Datum och tillgänglighet förändras när du provar. **Uppdatera förslagen**
hämtar aktuell status. **Nästa förslag** visar fler när första sidan är full;
om ett gammalt bokmärke blivit ogiltigt, gå till första sidan. Ingen seed körs
automatiskt varje natt. Påhittade example.test-adresser, inga utskick.

## Aktuella granskade bilder

Produkt-/deploykod8843d06, faktisk skyddad preview2026-11-13. Mobil390px och
desktop1440px är Chromiumemulering, inte fysisk iPhone/Safari.

- [Bokningsbart förslag på mobilen](assets/proactive/overview-mobile.jpg).
- [Rätt kalenderdag och Sam Demo](assets/proactive/calendar-mobile.jpg).
- [Vald20%-kampanj och verklig omfattning](assets/proactive/campaign-preview-mobile.jpg).
- [Sparat utkast trots återbokad tid](assets/proactive/stale-mobile.jpg).
- [Verkligt sparad opublicerad kampanj](assets/proactive/saved-campaign-mobile.png).
- [Översikten på desktop](assets/proactive/overview-desktop.jpg).
- [Bildmanifest med ursprung/hashar](assets/proactive/manifest.json).

Fem JPG är egna Computer Use-klickbilder från stabil alias. Kampanj-PNG är
från automatiserad faktisk driftprovning på samma immutable deployment.
Färdigladdade vyer är granskade; en första automatisk laddningsbild används
inte. Lokala äldre956-bilder och Epic06-bilder nedan är historiska, inte bevis
för den nya produktkoden. Ingen ny full videoinspelning behövdes i fixvarvet.

## Revision, skydd och drift

Branch **feature/proactive-capacity-overview**. Produkt, Groks riktade QA,
Actions och driftsatt revision **8843d06350c6478e375fb640579cb3ac4f7fe3dc**.
Senare dokument-/bildcommit ändrar inte detta bygge.
Deployment **dpl_<redacted>**, READY Preview(target=null),
runtimefra1; buildcle1/USA. Immutable URL:
https://booking-lab-se-preview-nfwi9mosj-<redacted-vercel-team>.vercel.app.
Vercel-API:s sourceRevision och stabil alias→deployment-id verifierade.

[Actions43353236981](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43353236981)
har4gröna42/42jobb. [Grok original](qa/QA-REPORT-proactive-fix1-8843d06.md): GO
syntetisk POC efter1samlat fixvarv. [Faktiska resultat/NOT RUN](VERIFICATION.md).
Grok hade ingen previewåtkomst; Codex verifierade separat den driftsatta miljön.
Alla4READY-adresser och stabil alias kräver Vercelåtkomst för HTML/API.
Nya assets/static chunk/POST är också skyddade. Lokal MCP förblir lokal.

Separat booking_ui_preview_demo, samma Neon Free i Frankfurt.84äldre bokningar
är oförändrade; slut92bokningar/33kundkort/4kampanjer/3förslagsbeslut,
4aktiva behandlingar och3aktiva medarbetare,0överlapp. Nya utkast opublicerade.
Äldre demokampanjer kan redan vara publicerade; denna leverans publicerade ingen.
Backup före migration och efter flöden återläst till nya lokala \*\_demo;
11respektive12tabeller med identiska radhashar, AES-256-GCM och separat bevarad
nyckel. Det är operatörens PC-backup, inte automatisk extern backup.

Samma befintliga Vercel Pro/Neon Free, inga nya abonnemang/tillägg/domänköp.
Bygg/registry/runtime kan förbruka befintlig pott eller några få dollar extra;
exakt fakturakostnad är **inte verifierad** och ramen är inget tekniskt hårt tak.
Ingen Production-promote eller mainmerge. Pilot fortsatt NO-GO.

## Stoppa eller återgå

För enbart detta nya bygge: ta bort dess exakta Previewdeployment och verifiera
att URL:en/stabil alias inte längre serverar appen:

```powershell
vercel remove dpl_<redacted> --scope <redacted-vercel-team> --yes
```

Äldre skyddade deployments finns kvar; detta stoppar inte dem. Ett fullständigt
demostopp kräver att demoaktören inaktiveras/versioneras enligt befintlig
ADMIN_OPERATIONS och att åtkomst till samtliga relevanta previewadresser
kontrolleras. Radera inte DB/backup eller andra projekt automatiskt. Vercels
Pause Project är inte ett verifierat stopp av alla Previewdeploymenter.
Sänk aldrig SSO-skyddet. Inget stopp har utförts nu.

Vid rollback används föregående skyddade dpl_<redacted>
för aliasen; den additiva databasen/demouppgifterna bevaras. Återställ inte
backup över den aktiva databasen utan separat beslut. Privata operatorprofiler
finns kvar i C:/Users/<user>/booking-lab-se-preview/.vercel; ui-live-target anger
ny revision. Filer/nycklar/tokens får inte skickas till Git/Grok/chatten.

## Lokal reproduktion

Använd README:s PostgreSQL-/individuella adminsteg, en separat loopback \*\_demo,
migrera och kör grundseed. Därefter:

```powershell
$env:BOOKING_DEMO_SEED = "1"
npm run demo:seed:capacity
npm run build
npm run start
```

Seedningen är additiv/återkörbar och återställer inte manuella ändringar.
Lokal demobypass aktiveras inte; använd individuellt admin enligt befintliga
instruktioner. [Plan/API/MCP-kontrakt](PROACTIVE_OVERVIEW_PLAN.md).

## Appendix — tidigare Epic 06-demo och äldre driftunderlag

Avsnitten nedan är historiska och gäller uttryckligen sina äldre revisioner.
Den stabila länken kör nu bygget ovan.

## Föregående Epic 06, skyddad syntetisk preview

[Öppna Booking Labs produktsida](https://booking-lab-se-preview.vercel.app/product) · [demoadmin](https://booking-lab-se-preview.vercel.app/admin) · [kundbokningen](https://booking-lab-se-preview.vercel.app/).
Använd Niclas befintliga Vercel-inloggning vid behov. Tryck **Prova salongens
arbetsyta** eller **Öppna demoadmin**; inget ytterligare lösenord behövs.
Aktören är tydligt Demoägare, inte en påhittad verifierad Vercelanvändare.
Hela sajten, API och resurser är fortsatt skyddade; endast befintlig ägare.

## Fem saker att prova på mobilen

1. Öppna produktsidan och gå till arbetsytan. Växla till kundbokningen och
   tillbaka med synliga länkar; kalendern visar dagens verkliga demobokningar.
2. Välj Kunder, sök Mira och öppna Mira Demo. Växla mellan Kommande och
   Tidigare och avbokade; öppna ett besök och länken tillbaka till kundkortet.
3. Välj Ny kund med påhittat namn och en adress på example.test. Spara,
   ladda om och välj Ny bokning. Välj behandling, utförare, dag och tidsknapp;
   kontrollera sammanfattningen före Skapa bokning. Du behöver inte skriva ISO-datum.
4. Redigera nya kundkortets namn. Kontrollera att gamla bokningens registrerade
   namn är kvar. Boka återbesök från kortet utan att skriva kontaktuppgifter igen.
5. Öppna en bokning i kalendern, flytta den och avboka en egen testbokning med
   bekräftelse. Se rätt status i kundhistoriken. Arkivera ditt nya kort om du vill;
   det raderar inte historiken. Använd bara egna påhittade provuppgifter.

## Faktiska leveransbilder

Tagna från den stabila skyddade länken2026-11-12, produktionsbygge7c1407d,
automatiserad Chromium390×844. Färdigladdade vyer; inte fysisk iPhone/Safari.

[Produktsida](assets/epic06/product.png) · [kundlista](assets/epic06/customers.png) ·
[kundkort/historik](assets/epic06/customer-history.png) · [valt återbesök](assets/epic06/revisit.png) ·
[mobil arbetsyta](assets/epic06/workspace.png). [Manifest med revision/hashar](assets/epic06/manifest.json).

## Revision, data och drift

Branch **feature/epic06-customers-demo-product**, produkt-/QA-/deploykod **7c1407dce66910ef8ab304c882c90d90c173ca72**. Deployment
**dpl_<redacted>**, READY Preview(target=null), fra1;
immutable URL https://booking-lab-se-preview-jhaiomi7c-<redacted-vercel-team>.vercel.app.
Den stabila aliasen verifierades via Vercel-API till exakt detta deployment-id.
[Actions43301797796](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43301797796):4 gröna jobb; [Groks originalrapport](qa/QA-REPORT-epic06-fix1-7c1407d.md):GO endast syntetisk skyddad preview.
Dokumentation/bilder efter fryst QA ändrar inte den driftsatta produktkoden.

32 seedkunder,79 seedbokningar,3 aktiva behandlingar och2 medarbetare; vid egna
slutprover33 kort/84 bokningar totalt, inklusive arkiverat QA-kort och manuella
prov. Noll överlapp. Relativa datum skapade12 november; Sofia har fullbokad
13 november och ledighet17 november. Prova Hitta nästa lediga dag. Datum blir
inte automatiskt nyseedade varje natt. Fiktiva example.test-adresser, inga
slumpade telefonnummer eller externa utskick. Fem faktiskt genererade och
optimerade AI-assets används; public/demo/manifest.json anger ursprung.

Publika bokningar skapar/kopplar inte kundkort genom e-postmatchning. Äldre
fristående bokningar har ingen efterhandskopplingsknapp. Rå kontakt på kort
är uttryckligen begränsad till denna pinnade demo; listor/MCP förblir minimerade.

Samma befintliga Vercel-konto och Neon Free-resurs; ingen ny plan, abonnemang
eller betaltillägg. Befintlig förbrukning kan kosta några få dollar; exakt
fakturerad kostnad är ej avläst. App/DB i Frankfurt, byggregion cle1/USA;
detta är inte en EU-exklusiv kunddriftskedja. Ingen publik release/pilot.

Operatörsprofiler ligger fortsatt endast i ignorerad
C:/Users/<user>/booking-lab-se-preview/.vercel. ui-runtime.private.json och
ui-owner.private.env avser separata booking_ui_preview_demo; gamla profiler
avser andra tidigare prover och får inte användas. ui-live-target.private.json
har aktuell7c; ui-before-epic06.private.json bevarar föregående d7-mål.
Inga hemligheter ska klistras in i chatten eller lämnas till Grok.

Stopp/paus: använd befintliga operatörsregler nedan, stäng inte av Vercels
skydd. En flaggpaus återkallar inte gamla sessioner permanent; vid permanent
stopp inaktiveras demoaktören eller höjs befintlig sessionsversion. Återställ
alias vid kodrollback till tidigare dpl_<redacted>; behåll
additiv databasmigration och befintliga uppgifter, ingen automatisk DB-restore.
Krypterad backup finns på operatörens PC och har återlästs före/efter migrering;
den är inte automatiserad extern backup. [Full verifiering/NOT RUN](VERIFICATION.md).

Fysisk iPhone/Safari och Niclas eget UX-godkännande återstår. Pilot NO-GO.

## Bilaga — historiska arbetsomgångar

Äldre uppgifter nedan gäller sina angivna revisioner, inte aktuell leverans.

### Demo — förbättrad skyddad mobilpreview

**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Prova nu

1. Öppna den stabila länken i Safari. Vercel-inloggning vid behov → Öppna demoadmin.
2. Kalender: tryck Välj dag, byt dag/medarbetare och öppna en bokning.
3. Ny bokning → välj behandling, person, kalenderdag och tid → skapa. Använd påhittat namn och example.test.
4. Öppna bokningen → Flytta → ny dag/tid → Spara flytt. Avboka har separat bekräftelse och säkert initialt fokus.
5. Visa kundbokningen → välj behandling/person/dag/tid. Fullbokad dag erbjuder Hitta nästa lediga dag. Kontrollera sammanfattningen innan Bekräfta testbokning.

## Exakt miljö och åtkomst

Stabil alias https://booking-lab-se-preview.vercel.app pekar på dpl_<redacted>. Immutable https://booking-lab-se-preview-6bk2naol8-<redacted-vercel-team>.vercel.app. Produktkod d7bc47f5596cc8be06e58603fe2f32457c6b0fa0; Preview target=null, project prj_<redacted>. Alias är manuellt tilldelad; deployment.alias kan vara tom trots korrekt alias-API. Ingen Productionpromotion/Git-autodeploy/DNS-ändring. Image sha256:4b9dfae99b5a67624e8be7c63957eddc685fd705e8f657cc2f7ad8bf0e64477b.

Separat booking_ui_preview_demo på samma befintliga Neon Free-resurs i Frankfurt. Begränsad ny approll, nytt sessionshemligt värde; gamla neondb och gamla previewn är bevarade och används inte av nya demon. Inga nya betalda abonnemang/tillägg; redan godkänd Vercelförbrukning kan tillkomma. Inte verifierat EU-exklusivt: runtime/DB Frankfurt men build cle1/USA.

Demoåtkomst avstängd som standard, kräver explicit Vercel Preview/projekt/databasfingeravtryck och nekas i Production. Markeringen Demoägare är en demoaktör, ingen verifierad personidentitet. Vanlig individuell produktinloggning finns kvar. Skyddet omfattar hela projektet/alla deployments. Inga bypasshemligheter i URL/klientkod. Grok har inte fått miljöåtkomst.

## Drift/stopp och privata operatörsprofiler

Läs enbart lokalt i C:/Users/<user>/booking-lab-se-preview/.vercel: ui-runtime.private.json (ny app), ui-owner.private.env (ny DB-owner), ui-live-target.private.json (exakt mål), backup-key.private (befintlig separat nyckel). Dessa är ignorerade och får aldrig skickas till Git/Grok/chatten. Gamla runtime-private.json/.env.preview.local avser gamla miljön: använd dem inte för nya demon.

För åtkomstpaus: BOOKING_DEMO_ACCESS=0 och ny skyddad Previewdeploy. En flaggpaus är INTE permanent sessionrevokering; återaktivering inom8h kan återuppliva kvarvarande icke-utloggade sessioner. Vid permanent stopp: inaktivera demoaktören/höj dess credentialVersion eller befintlig ADMIN_SESSION_VERSION, därefter stoppa/ta bort just nya deployment/alias genom befintligt Vercelflöde. Radera inte databas eller gamla miljöer automatiskt. Sänk aldrig Vercels skydd. Ingen serverändring utan nytt konkret uppdrag.

Additiv seed: npm run demo:seed kräver uttrycklig opt-in och isolerad \*\_demo-DB. Preview kräver --preview samt exakt pin; kör inte testsviter/testvakt mot molndatabasen. Seed är separat från fixtures och raderar inte befintliga data.

## Historik — tidigare preview och lokal demo

# Demo och mobilpreview — Epic 05

## Skyddad mobilpreview — verifierad 2026-11-12

[Öppna Booking Lab SE](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Använd Niclas befintliga Vercel-konto.
Hela webbplatsen (även API och resurser) kräver Vercel Authentication.
Därefter kräver /admin individuell appinloggning: niclas@example.test.
Lösenordet finns enbart på operatörens PC i ignorerad
C:/Users/<user>/booking-lab-se-preview/.vercel/preview-admin.private.json.
Öppna filen lokalt; klistra inte in lösenordet i chatten, Git eller Grok.
Ingen standardinloggning, delningslänk eller skyddsdispens har införts.

Driftsatt kod **f2fdac700125df2d212e824555758b8ed6d6a7a7**, branch
preview/epic05-vercel-review. Deployment **dpl_<redacted>**,
faktisk Preview (target=null), Container Runtime, Node24, fra1/Frankfurt.
Image digest sha256:281bf3df713ae12726f42dfa67d310239d1ca5fe669a9a8a7ebaf9f2c092db5d.
Builden kördes i cle1/USA, inte Frankfurt. Endast vitlistad källkod/byggfiler
skickades (97filer), inga lokala miljöfiler eller operatörshemligheter.
Projektet saknar Git-autodeploy, custom domain och DNS-ändringar.

### Prova på iPhone

1. Öppna länken i Safari och logga in med ditt Vercel-konto. Ingen annan har
   fått åtkomst. Öppna Administration och logga in med det individuella kontot.
2. Kalender: välj ett vardagsdatum, medarbetare och Visa. Skapa en påhittad
   bokning med Ny bokning. Använd bara example.test-adresser och syntetiska namn.
3. Öppna bokningen: Flytta → medarbetare/datum → Visa lediga tider → Spara flytt.
   Prova därefter Avboka och bekräftelsen. Visa avbokade visar tidigare prov.
4. Öppna Tjänster och Personal & tider för att granska/ändra demodata.
   Logga ut och kontrollera att kalendern kräver ny appinloggning.

Kundflödet finns på startsidan: behandling, personal, vardagsdatum och ledig tid.
Codex driftprov bokade Massage2026-11-19, flyttade till Erik10:00 och avbokade.
Den avbokade syntetiska raden/historiken är kvar; inga testsessioner eller
spärrposter lämnades vid överlämningen. Ordinarie kundtak och bokningsregler
gäller även i preview. Adminens manuella bokningar har egen budget.

### Vad är faktiskt verifierat?

- Befintlig Epic05 lokal QA/CI är separat historik. Nya previewkoden har
  72unit/72integration och24E2E i alla4lägen. Grok gav kod/paketering-GO på
  fryst f2fdac7 i egen kopia; fick aldrig molnhemligheter eller previewåtkomst.
- Vercels faktiska Linuximage byggdes med USER node/chown och minimal53pakets
  runtime. Samma wrapper är enda HTTP-ingång. Inget publikt MCP: tre provade
  MCP-sökvägar ger404 även efter Vercel-autentisering.
- Oinloggade HTML/API/POST/resurs-anrop blockeras av perimeter. TLS1.3 med
  verifierat certifikat, CSP/HSTS/nosniff/referrer/no-powered-by och admin no-store.
  Port3000 är inte externt nåbar. Neon är en autentiserad managed PG-endpoint
  med verifierad TLS, inte en loopbackport eller bevisat nätverksstängd5432.
- Individuell UI-login, kundbokning, mobilkalender, tjänster/personal, flytt,
  avbokning, logout och kopierad-cookie-replay403 PASS. Falska IP/proof-headers
  kan inte rotera limitern; fem401, sedan429 även med rätt lösenord.
- Efter90sekunder utan apptrafik: Vercelloggen visar ny BOOKING_SERVER_READY
  för exakt kontrollrequest. Samma signerade session fungerar, avbokning/version3
  och bokningstid är kvar. Detta är faktisk kallstartsverifiering, inte en
  manuellt framtvingad omstart av alla instanser eller full belastningscertifiering.
- Krypterad backup efter driftflöden återlästes till ny lokal
  booking_preview_live_restore_demo. Alla10tabellers radantal/innehållshashar
  matchar. Manipulerad ciphertext avvisas. Backup på PC, separat bevarad nyckel
  i .vercel; ingen automatisk extern/Tysklandsbackup.
- **Fysisk iPhone/Safari: NOT RUN.** Mobilbilder är verkliga skärmbilder från
  driftsatt produktionsbygge i Chromium390×844, inte Safari eller designmockups.

### Kostnad och stopp

Befintlig Vercel Pro och ny separat **Neon Free/free_v3** i Frankfurt,
Auth/Realtime av. Inga nya betalda abonnemang/tillägg eller domänköp. Vercels
bygg-/registry-/runtimeförbrukning kan belasta befintlig användningspott eller
ge överförbrukning; några få dollar är godkända. Exakt projektkostnad är ännu
inte verifierad i fakturaunderlag. Detta är inte ett tekniskt hårt kostnadstak.
Ändra inte teamgemensamma stopp som påverkar andra projekt. Uppgradera inte
databasen automatiskt. Se [Vercels runtime/prissättningsmodell](https://vercel.com/docs/functions/runtimes/container).

Stoppa åtkomsten genom att ta bort just preview-deploymenten:

```powershell
vercel remove dpl_<redacted> --scope <redacted-vercel-team> --yes
```

Kontrollera att just denna skyddade URL därefter inte serverar appen. Ingen
Git-autodeploy är ansluten. Låt DB/backup finnas för återupptagning; radera inte
andras projekt eller nyckeln. Vercels Pause Project gäller produktion och är
inte i sig ett verifierat stopp av denna preview. Ingen mainmerge har gjorts.

### Operatörsunderlag

Appkonto i Neon saknar superuser/CREATEDB/CREATEROLE och migrationsåtkomst;
max5domän+1limiter-anslutningar per instans. Sex migrationer, bara den sjätte
är ny för preview. Fulla paket/låsfil och historiska migrationer är orörda.
Miljöhemligheter ligger i Vercels Preview target och lokalt ignorerad .vercel.

Första deployförsöket klassades automatiskt Production trots explicit Preview.
Det avbröts innan appstart (dpl_<redacted> CANCELED).
Ett --skip-domain-försök avvisades lokalt eftersom flaggan bara stöds för
produktion. Nästa vanliga --target preview fick faktiskt target=null; detta
kontrollerades via API innan driftprov. Inga hemligheter kopierades till
produktionsmiljön och ingen bootstrap-app driftsattes där.

[Verifiering, original-Grokrapport, CI och lokala artefaktvägar](VERIFICATION.md).
Endast Niclas får åtkomst i denna leverans. Innan andra bjuds in krävs bland
annat AGPL§13-källkodserbjudande; inga bredare åtkomster är godkända.

## Bilaga — Vercel-förstudie 2026-11-12 före godkännandet

Niclas väljer att i första hand undersöka befintligt Vercel-konto. Några få dollar
i extra Vercel-förbrukning är accepterat; nya abonnemang, betalda tillägg och
uppgraderingar är inte godkända. Detta ersätter inte kravet på en konkret säker
driftlösning. Hetznerförslaget nedan är historiskt underlag, inte en beställning.

Fryst bas: `29ac2977627971ededb94a5c50354b316f52f332`, både lokal och remote
`epic-05-booking-workspace`. Arbetskopian var ren. Produktkodens diff mot
QA-granskade `4fc98d37fef805e041f8f8772a3fc37543d4ff04` är tom när Markdown
undantas. Förstudien ligger separat på `preview/epic05-vercel-review`.

### Verifierat och återstående

- Vercel CLI:s läsande kontoanrop visar aktiv Pro-plan. Befintlig Neon-integration
  finns, men dess Free-etikett är inte bevis för kostnadsfri ny databas: samma
  integrationsmetadata innehåller historisk debitering. Ingen befintlig databas
  eller annat projekts data har anslutits eller ändrats.
- Vercel Authentication kan skydda alla deployments utan separat betalt
  skyddstillägg. Planerat enda mänskliga previewkonto är Niclas eget Vercel-konto;
  appens individuella admin krävs dessutom. Inga åtkomster har ändrats.
- Vercel stöder Node-servrar. Det är inte i sig ett bevis för att Next-wrapperns
  socket-/proxyidentitet fungerar oförändrat i den aktuella körmiljön.
- Fluid Compute skalar mellan processer och kan avsluta inaktiva instanser.
  Någon dokumenterad garanti för en enda instans har inte verifierats.
  En region innebär inte en process. Nuvarande limiter använder en processlokal
  Map och kan därför inte antas ge samma spärr över flera instanser.
- Lokalt reproduktionsprov utan databas: två separata Node-processer anropar
  `checkLoginAttempt` sex gånger var med samma syntetiska IP. Varje process
  kontrollerade fem lösenord och spärrade ett försök; tillsammans blev det tio
  kontroller i stället för fem. Detta bevisar processisoleringen, inte Vercels
  faktiska instansfördelning. Endast en stub som alltid svarar falskt användes.
- Vercels dokumenterade överskrivning av klientheaders är användbart underlag,
  men vår befintliga kontroll av anslutningens betrodda socket måste också hålla.
  Att lita på alla adresser eller hoppa över wrapper/proof är inte ett alternativ.

**Stoppgrind:** öppna ingen preview med förändrad limiter- eller proxysemantik.
Om driftskonfiguration inte kan bevara dem behövs separat godkännande för en
avgränsad runtime-/säkerhetsanpassning, exempelvis en transaktionell gemensam
limiter i befintliga PostgreSQL i stället för ytterligare en betald tjänst.
Det är en utredningsriktning, inte en beslutad eller implementerad lösning.

**Oberoende Grok-förstudie via befintlig Booking Lab QA-konversation:** svar
mottaget 2026-11-12: **NO-GO för Vercel med enbart driftkonfiguration**.
Grok anger läsning av sin befintliga separata `4fc98d3`-kopia och Vercels källor,
inte nya runtime-tester. Samma blockerare: processlokal limiter, overifierad
socket/proxyidentitet och wrapperns startpunkt vid vanlig Next-deploy.
Grok har inte fått preview-/serveråtkomst eller secrets. Detta är inte ett nytt
underkännande av den redan godkända lokala Epic05-alphan. Eventuella förslag om
ny Epic eller svagare skydd i svaret är inte nya uppdrag eller godkännanden.
Lokalt originalutdrag och skärmbild finns utanför Git i
`C:/Users/<user>/booking-lab-pg-test/preview-vercel-review/`.

Separat EU-databas/region, plan och kostnadsgränser för databas, backup/återläsning
samt exakt runtime/proxykonfiguration är ännu inte verifierade eller skapade.
Ingen automatisk koppling till befintliga Neon-projekt. Inget nytt värdnamn har
skapats; en skyddad standardadress från Vercel kan utvärderas utan domänköp.
Ingen publik MCP, inga hemligheter eller serveråtkomster till Grok.

Ny full testmatris, deploy, skydd av verklig HTML/API/resurser, TLS/proxy,
admininloggning/logout i drift, bokningsflöden i drift, omstart, återläsning och
fysisk iPhone/Safari: **NOT RUN**. Produktkoden är oförändrad; tidigare Epic05-QA
och CI är historiska bevis och räknas inte som previewgodkännande.

Källor: [Node-servrar](https://vercel.com/changelog/deploy-node-servers-with-zero-configuration),
[instansskalning](https://vercel.com/docs/functions/concurrency-scaling),
[klientheaders](https://vercel.com/docs/headers/request-headers),
[åtkomstskydd](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan),
[Pro-förbrukning](https://vercel.com/docs/plans/pro-plan).

## Befintlig lokal Epic 05-demo

2026-11-12 kl.11:29 CET. Ren kandidat **7fc0e866f0ef457bf9eaef4ca153e7a69b30b3d0**, dirty=false, produktionsbygge. `npm run demo:record` **PASS6/6,52.8s**,28PNG och6WebM på ny separat booking_epic05_delivery_demo. Tre flöden på desktop och mobil: kund/admin/kampanj, lokal MCP-bokning och hela nya arbetsytan tjänst/schema/ledighet/flytt/avbokning. Inspelningen har ingen N-badge. Ingen testsite är driftsatt.

- [Lokalt galleri](../demo-artifacts/2026-11-12T10-29-00-935Z/index.html)
- [Manifest med exakt revision och alla filer](../demo-artifacts/2026-11-12T10-29-00-935Z/manifest.json)
- [Desktop veckokalender](../demo-artifacts/2026-11-12T10-29-00-935Z/workspace-Epic05-salongsar-3594f-st-schema-flytta-och-avboka-desktop/epic05-calendar.png)
- [Mobil kalender](../demo-artifacts/2026-11-12T10-29-00-935Z/workspace-Epic05-salongsar-3594f-st-schema-flytta-och-avboka-mobile/epic05-calendar.png)
- [Mobil schema med paus](../demo-artifacts/2026-11-12T10-29-00-935Z/workspace-Epic05-salongsar-3594f-st-schema-flytta-och-avboka-mobile/11-veckoschema-med-paus.png)
- [Mobil flyttad bokning](../demo-artifacts/2026-11-12T10-29-00-935Z/workspace-Epic05-salongsar-3594f-st-schema-flytta-och-avboka-mobile/13-flyttad-bokning.png)

Dessa fyra stillbilder är visuellt granskade: läsbara handlingar, korrekt YYYY-MM-DD/SEK/Stockholmstid och maskerad kundkontakt; desktop är verklig tidsgrid, mobil kronologisk lista. Det långa personalformuläret kan förbättras senare, inte en full UX-/tillgänglighetscertifiering. Ingen fysisk iPhone/Safari testad. Alla6WebM probe/avkodade exit0 (11.16/10.64/5.56/3.32/9.48/9.56s); de är inte helt visuellt genomtittade. Medieteknisk logg epic05-video-check.json. Dessutom granskades arbetsytefilmernas stillrutor vid2/4/6/8sekunder för desktop/mobil: laddning, sparad personalkonfiguration, bokningsdetalj och flyttbekräftelse är verkliga. Detta är stickprov, inte full filmgranskning. Den automatiska videon går snabbt och scrollar inte igenom hela personalformuläret; de fullhöga skärmbilderna är bättre för detaljgranskning. Slutaggregat0booking/event/request/session/admin/campaign,2service/2staff,0överlappar/observeradeDBdeadlocks.

**QA-begränsning E05-QA-7:** de två09-bokningsdetalj-bilderna visar bara laddningsskärmen och räknas inte som funktionsbevis.28fångade bilder betyder26användbara funktionsbilder+2laddningsbilder.13-flyttad-bokning visar den verkliga detaljen med snapshotpris/tid. Originalmanifest/filer bevaras; ingen ny full inspelning för den osynliga kvotfixen. Fokus efter Flytta, dialogens fokus/Escape och dubblerad kalenderlänk är mindre UX-backlogg enligt originalrapporten.

[Prova själv stegvis](LOCAL_DEMO_WINDOWS.md). Reproducera med npmci/generate, ny egen loopback \*\_demo-DB, db:migrate/db:seed och npm run demo:record; se gemensamma instruktioner i bilagan. Demovakten kräver exakt syntetisk seed och inga boknings-/konto-/sessions-/mutationsrader, raderar aldrig för att förbereda. Efter manuell provning ska nästa inspelning använda ny demo-DB. Artefakter är ignorerade och finns inte automatiskt i GitHub; granskat separat QA-demopaket skapat, hash finns i handoff. Detta är automatiserad verklig POC, inte produktionsklar eller mobilåtkomlig drift.

## Privat mobilpreview: beslutsunderlag, BLOCKERAD

Läsande inventering2026-11-12 hittade en ansluten Vercel Pro-workspace men inget länkat Booking Lab-projekt. Inget Hetzner-konto eller projekt har verifierats/skapat. Nedanstående är ett konkret förslag, inte utförd drift eller en beställning. Lokal demo fungerar oberoende av detta beslut. Kundpilot är fortsatt NO-GO.

| Val                | Föreslagen exakt miljö                                                                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leverantör/projekt | Hetzner Cloud, nytt separat projekt **booking-lab-se-preview**, server **booking-lab-se-e05-preview**, endast syntetiska data.                                                                                                                                                                            |
| Server/region      | **CX23, x86-64,2vCPU/4GB/40GB, HEL1/Helsingfors, Finland**. Kapacitet är inte reserverad; leverantörssidan visar även en otillgänglighetsmarkering. Tillgång i HEL1 måste bekräftas före beställning. Ingen automatisk annan region/större plan.                                                          |
| Runtime            | En Linuxserver med en Node24-process via befintliga scripts/server.mjs, byggd app och PostgreSQL18.6 på samma server, bara loopback. En process bevarar nuvarande processlokala limiter/proof; inga skalningsgarantier. Linux/nativebibliotek och riktig proxy/TLS måste verifieras före öppning.         |
| Databas            | Egen **booking_preview_demo** i HEL1, separata credentials, inga publika5432/3000-portar. Migration sker med operatörsbehörighet; appkontot ska inte vara PostgreSQL-superuser. Ingen anslutning till lokal/test-/produktions-DB.                                                                         |
| Backup             | Daglig konsekvent pg_dump, krypterad före överföring till separat **BX11 Storage Box i Tyskland/FSN1**, underkatalog booking-lab-se-preview; föreslagen retention7dagliga/4veckovisa. Återläsning till separat demo-DB ska provas. Cloud-diskbackup är ett tillägg, inte ersättning för logisk DB-backup. |
| Hela webbgränsen   | Caddy HTTPS med separat namngivet Basic Auth-konto för Niclas på **alla paths**, inklusive /, /api/\*, /admin och Next-resurser. Ingen offentlig health-/API-bakväg eller delad anonym länk. Appens individuella adminsession krävs därutöver. Ingen MCP-port; stdio förblir lokal.                       |
| Värdnamn           | Niclas väljer en redan ägd domän/subdomän för TLS. Inget ägarskap eller fungerande URL antas; DNS/certifikat har inte ändrats. En hemlig URL/noindex ersätter inte åtkomstskydd.                                                                                                                          |
| Behöriga konton    | Endast Niclas godkända preview-/admin-/infrastrukturkonton. Inget konto eller lösenord ges automatiskt till Grok, Codex eller andra. Grok granskar fryst källkod i separat lokal kopia enligt planen.                                                                                                     |

**Kostnadsunderlag, inte offert:** renderad officiell prislista läst2026-11-12 visade CX23 **5,99€/månad inklusive IPv4, exklusive moms**, BX11 **3,20€/månad exklusive moms**; tillsammans9,19€. Separat Cloud-backup kostar ytterligare; sidan visade från1,098€/månad. Föreslagen infrastrukturgräns är **15€/månad exklusive moms**, utan ny domän eller förbrukning utöver grundnivå. Pris, regional kapacitet och slutlig order ska kontrolleras igen innan köp. Inget pris anges som garanterad tillgänglig offert och ingen tjänst har köpts. [Serverpris](https://www.hetzner.com/cloud/cost-optimized/) · [Storage Box](https://www.hetzner.com/storage/storage-box/).

Caddy ska överskriva X-Real-IP från verklig klientanslutning; appen litar bara på lokala Caddys exakta loopbackadress, aldrig godtyckligt X-Forwarded-For eller breda CIDR. Host bevaras för befintlig sameOrigin-kontroll. Perimeter-Authorization ska inte vidarebefordras till appen; inga råa request bodies, cookies, credentials eller IP-adresser i demologgar/artefakter. Generera hemligheter separat, behåll filrättigheter och aldrig i Git. Behåll distributions-/native-notisgrindar i DEPENDENCY_REVIEW; förslaget är ingen licensklarering av en framtida image.

Vanlig Next-deploy på det befintliga Vercel-kontot väljs inte automatiskt. Vercel har sedan2026 stöd för Node-servrar, så vi påstår inte ett generellt förbud. Däremot är kombinationen denna Next-wrapper, socketidentitet, processlokal limiter och plattformens instansskalning **inte verifierad**. Det skulle kräva separat runtime-/proxytest; att ta bort wrappern eller lita på alla proxyadresser är ingen tillåten genväg. Detta är vår tekniska bedömning, inte ett påstående att ingen Vercel-lösning är möjlig. [Vercels Node-serverstöd](https://vercel.com/changelog/deploy-node-servers-with-zero-configuration) · [Aktuell Next custom-serverguide](https://nextjs.org/docs/app/guides/custom-server).

**Ett samlat beslut behövs före någon åtgärd:** godkänn leverantör/projekt/HEL1, kostnadsgränsen, backup i Tyskland, valt ägt värdnamn och exakt vilka namngivna konton som får åtkomst. Beställning, DNS, secrets, kontoåtkomst och deploy ingår inte i förberedelsen. Om kapacitet/pris avviker ska förslaget omprövas, inte automatiskt bytas.

Efter ett sådant beslut återstår faktisk verifiering: oinloggat/inkognito ger401 på både HTML och API; direkt3000/5432 är stängt; korrekta proxyheaders och två separata klienter fungerar; cookie/logout/adminregler består över TLS; återställningsprov lyckas; Niclas kan genomföra flödet från sin verkliga mobil. Alla dessa är **NOT RUN** nu. Ingen iPhone/Safari eller privat testsite påstås godkänd genom Playwrights mobilemulering.

Primärkällor för driftförslaget: [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [proxyheaders](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Hetzners backupplacering](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/). Hetzner anger Cloud-backup på samma ort och snapshots inom samma nätzon; därför väljs separat logisk backup med uttrycklig Tysklandsregion i detta förslag. Ingen generell GDPR-certifiering härleds av regionvalet.

## Bilaga — verifierad Epic 04-demo

## Epic 04 — aktuell produktionsdemo

2026-11-12 kl.07:35 CET. Revision **9282cdc9557f0bd76ea6c0196fab7bd92290d21b**, produktkod3419973, dirty=false, produktionsbygge. **4/4 PASS**,34.6s;14PNG och4WebM. Endast syntetiska uppgifter.

- [Lokalt galleri](../demo-artifacts/2026-11-12T06-35-12-079Z/index.html)
- [Manifest](../demo-artifacts/2026-11-12T06-35-12-079Z/manifest.json)
- [Individuell admin och kampanj, mobil](../demo-artifacts/2026-11-12T06-35-12-079Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-mobile/04-admin-och-utkast.png)
- [MCP-bokning i admin, mobil](../demo-artifacts/2026-11-12T06-35-12-079Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-mobile/07-agentbokning-i-admin.png)

Kundbokning/bekräftelse/admin/kampanj och separat lokal agentbokning körs på dator och mobil. Egen syntetisk admin skapas/städas av varje fixture; inga standardkonton lämnas. Manuellt konto skapas med admin:manage enligt ADMIN_OPERATIONS. Granskade stillbilder: mobil/desktopadmin, desktopbekräftelse, mobilpublikt erbjudande och mobilagentbokning. Synlig egen adminidentifierare, maskerad kund-e-post, Stockholmstid/SEK och ingen N-badge i dessa bilder.

Alla4WebM probe/avkodning exit0 (11.08/11.48/4.92/2.92s); ingen full visuell genomtittning påstås. Slutaggregat i demo: bookings/campaigns/sessions/admins/overlaps=0. Artefakter är lokala och ignorerade, **inte tillgängliga via GitHub**. Källkod och reproduktionssteg är delbara. Tidigare Epic02-demo nedan är historisk.

## Bilaga — tidigare Epic 02-demo

Epic 03 ändrar endast databasberoenden/konfiguration. Ingen ny video spelas in i denna batch; nedanstående galleri är från **äldre Epic 02-kod**, inte bevis för den nya Prisma-kandidaten. Kund/admin/kampanj/MCP verifieras i stället med hela E2E-matrisen på 18a4d73 (12/12 ×4). Se VERIFICATION. Det kosmetiska galleriets äldre introduktion nämner bara kampanjutkast; de separata 07-bilderna visar också agentbokningen.

Aktuell giltig inspelning: **7a65aeec341820442effe68a77a1ea978050a0b0** (produktkod 3cd633b), 2026-11-12 kl. 01:27 Europe/Stockholm, dirty=false och produktionsbygge. `npm run demo:record`: **4/4 PASS**, 1,2 min, **14 PNG och 4 WebM**. Bara syntetiska uppgifter, inget externt publicerat.

- [Öppna det lokala galleriet](../demo-artifacts/2026-11-12T00-27-19-502Z/index.html)
- [Manifest med revision och filer](../demo-artifacts/2026-11-12T00-27-19-502Z/manifest.json)
- [Agentbokning i admin, desktop](../demo-artifacts/2026-11-12T00-27-19-502Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-desktop/07-agentbokning-i-admin.png)
- [Agentbokning i admin, mobil](../demo-artifacts/2026-11-12T00-27-19-502Z/flow-lokal-MCP-bokning-vis-0cccc-dad-admin-med-Stockholmstid-mobile/07-agentbokning-i-admin.png)

Två flöden per skärmstorlek: (1) kundbokning → bekräftelse → admin → kampanjutkast → manuell publicering → publikt erbjudande; (2) en separat verklig lokal MCP-bokning som visas i admin. Terminalens MCP-anrop sker i testklienten; videorna visar webbläsarens resultat, ingen extern modellchatt. Bild 07 visar Syntetisk agentkund Anna/Erik. Desktop/mobil-bilderna 07 är visuellt granskade: svensk tid, SEK, maskerad e-post, ingen N-badge eller observerat horisontellt överflöde. Videorna har inte granskats i sin helhet.

Alla fyra WebM har kontrollerats med ffprobe och avkodats till slut med ffmpeg utan mediafel: VP9, 13,24 s / 10,68 s för kund-/kampanjflödena och 8,44 s / 2,44 s för agentflödena. Desktop 800×450, mobil 392×800. Detta är en medieteknisk kontroll, inte en fullständig visuell genomtittning. Lokal resultatfil: `C:\Users\<user>\booking-lab-pg-test\epic02-video-check.json`.

Prova agentflödet själv: starta lokal databas och webb enligt README, kör `npm run mcp:client -- --admin --book`, läs sammanfattningen och skriv `ja`. `nej` eller EOF avbryter utan bokning. Öppna /admin och kontrollera bokningen. Endast example.test och syntetiska namn. Ingen ytterligare UI, dashboard eller modellnyckel behövs.

Reproducera hela inspelningen med instruktionerna nedan och en separat tom \*\_demo-databas. Demokonfigurationen väljer nu både befintligt fullflöde och agentflödet. Artefakterna är lokala/ignorerade och finns inte i Git eller den rena källkods-ZIP:en. Efter körningen: 0 bokningar, 0 kampanjer, 0 sessioner i demodatabasen.

Första inspelningsförsöket på 18b2ac5 blev FAIL 1/4 vid screenshot, medan funktionella kontroller och tre videoflöden passerade. Det ligger kvar separat och räknas inte som godkänd demo. Riktad diagnostik och ny full inspelning PASS, utan höjd timeout eller ändrad bokningslogik; rotorsaken är inte fastställd. [Felhistorik](EPIC_02_QA_FOLLOWUP.md).

## Bilaga — tidigare inspelningar och gemensamma instruktioner

## När vi spelar in

Full demo spelas in när en Epic är klar, inför en överenskommen viktig avstämning eller på uttrycklig begäran. Vanliga QA-/fixomgångar får automatiska tester och en kort resultatrapport; ingen ny video eller full bildsekvens behövs. Vid synliga ändringar tas riktade skärmbilder om de behövs för granskningen. Testkraven är oförändrade.

Återanvänd senaste relevanta demo och ange dess revision samt eventuella senare ändringar. En äldre demo är inte bevis för att ny kod har verifierats. Policyn gäller kommande arbete; tidigare inspelningar nedan är historik.

## Senaste inspelning

`npm run demo:record` PASS från ren **a364bda73850c2983212684e94e9690d100d1d9b**, 2026-11-11 kl. 22:53 Europe/Stockholm. Produktionsbygge, dirty=false, 2/2 tester (25.4 s), 12 PNG och 2 WebM.

- [Lokalt galleri](../demo-artifacts/2026-11-11T21-53-01-311Z/index.html)
- [Manifest med revision och filförteckning](../demo-artifacts/2026-11-11T21-53-01-311Z/manifest.json)

Desktop/mobil visar Testkund Anna respektive Testkund Erik; inga riktiga personer. Slumpmässig e-postmarkör behålls för teststädning. Adminbilderna 04 har granskats visuellt: korta namn, maskerad e-post och ingen N-badge. Videorna har inte granskats i sin helhet. Artefakter ligger lokalt och ingår inte i Git.

Start via **npm run start**, socket-wrappern runt produktionsbygget. Reproducera enligt stegen nedan med ny lokal \*\_demo-databas; host/hostaddr-queryparametrar avvisas före Prisma-åtkomst. Kör en omgång åt gången. Efter inspelning finns 0 bokningar, 0 kampanjer och 0 sessioner från testerna. Tidigare uppgift om kvarvarande demosessioner gäller bara äldre revisioner.

## Historik och reproduktionsinstruktioner

# Prova Booking Lab SE lokalt

## Aktuell inspelning efter QA batch 2

[Galleri](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html) och [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json): 2/2 PASS, 12 PNG, 2 WebM. Inspelat från ren kodcommit a84e48a, dirty=false och build=production. Start 2026-11-11 kl. 22:04:56 svensk tid (21:04:56Z).

Mobilens adminvy och desktopens bekräftelse är visuellt granskade: YYYY-MM-DD, logout i sidhuvud, maskerad e-post, inga N-badges eller observerat layoutöverflöd. Videorna kan läsas i Chromium: 10,68 s (800×450) och 10,72 s (392×800). De är inte genomtittade i sin helhet; visuella slutsatser bygger på bilderna. Artefakter är lokala och ignorerade. Extern QA kan reproducera demon från revisionen men får inte dessa filer genom Git. Inget har laddats upp.

Startpunkten har ändrats: `npm run start` använder socket-wrappern med kompilerad Next och dev:false, inte rått next start. `npm run test:e2e:production` kör hela produktionssviten. Datumfält är textfält med format YYYY-MM-DD. Kör bara en QA-omgång mot samma databas/port. Sessionsrader består; fixture-städning avser bokningar/kampanjer. Den äldre inspelningen längst ned är historik.

En syntetisk demo visar kundbokning → administrationsagenda → kampanjutkast från lokal MCP → manuell publicering → erbjudande på bokningssidan. Ingen betalning, social publicering eller extern AI-tjänst används. MCP-anropet sker i testklienten; videon visar dess resultat i adminvyn, inte en chatt med en AI-modell.

## Spela in igen

Använd en **separat lokal databas**, utan andra användare eller parallella tester. Namnet måste sluta med `_demo`. Verktyget avvisar databaser med bokningar/kampanjer eller andra tjänster än de två oförändrade syntetiska seedtjänsterna. Det raderar aldrig befintliga data för att förbereda en inspelning. Använd endast syntetiska uppgifter även efter kontrollen; starta inte andra klienter under inspelningen.

1. Installera enligt README (`npm ci`, `npx prisma generate`, `npx playwright install chromium`).
2. Starta lokal PostgreSQL. Med befintlig Compose, skapa en ny databas:

   ```powershell
   docker compose up -d --wait
   docker compose exec db createdb -U booking booking_visual_demo
   ```

   Kommandot skapar databasen en gång. Om namnet redan finns: använd en annan tom `*_demo`-databas, radera inte den befintliga. Docker saknas på verifieringsvärden; den faktiska körningen använde separat PostgreSQL 18.6. En egen lokal PostgreSQL fungerar med motsvarande `createdb`.

3. Skapa `.env` från `.env.example` om den saknas; bevara egen konfiguration. Sätt DATABASE_URL till demodatabasen, exempelvis `postgresql://booking:booking@127.0.0.1:5432/booking_visual_demo`. Välj SESSION_SECRET (minst 32 tecken). Skapa ett eget syntetiskt adminkonto enligt ADMIN_OPERATIONS.md för manuell provning; den automatiska demon skapar och städar sitt eget konto. Lägg dem aldrig i rapporter eller Git.
4. Kör från projektroten med port 3000 ledig:

   ```powershell
   $env:NEXT_TELEMETRY_DISABLED='1'
   $env:CHECKPOINT_DISABLE='1'
   npm run db:migrate
   npm run db:seed
   npm run demo:record
   ```

Kommandot kör först ett produktionsbygge och startar/stoppar sedan sin egen produktionsserver (`npm run start`, socket-wrappern), utan Next-utvecklarbadge. Det kör samma accepterade bokningsflöde som E2E-testerna, på desktop och mobil. Varje körning skapar `demo-artifacts/<UTC-tid>/index.html`, `manifest.json`, tolv PNG-bilder och två WebM-videor. Öppna utskriven index.html direkt i webbläsaren. Galleriet är en statisk lokal fil, ingen tjänst eller dashboard. Videon saknar ljud; varje bildsteg hålls kvar kort för läsbarhet. Inloggningens lösenordsfält är maskerat; trace med requestinnehåll är avstängt i demoläget.

Manifestet anger Git-revision, tid, PASS/FAIL och om arbetskopian hade ändringar. Se alltid statusen: även en misslyckad körning kan lämna partiella bilder. Genererade filer ignoreras av Git, laddas inte upp och gallras inte automatiskt. En lyckad körning tar bort sina skapade bokningar och kampanjer; den seedade databasen består. Vid avbrott kan syntetiska testposter bli kvar: använd en ny databas för nästa inspelning. Det automatiska flödet efterlämnar alltså inte en förbokad kund åt den manuella demon.

## Bildsekvens

| Bild                  | Vad du ser och vad som kontrolleras                                   |
| --------------------- | --------------------------------------------------------------------- |
| 01-bokningssida       | Två tjänster; det opublicerade erbjudandet syns inte publikt          |
| 02-vald-tid           | Fotvård, vardag inom bokningshorisonten, ledig tid och syntetisk kund |
| 03-bekraftelse        | Kunden får bekräftelsen att bokningen är registrerad                  |
| 04-admin-och-utkast   | Samma kund i adminagendan och MCP-skapat utkast med 20 % rabatt       |
| 05-publicerad-i-admin | Administratören har klickat Publicera; statusen har ändrats           |
| 06-publikt-erbjudande | Erbjudandet visas på den egna bokningssidan                           |

Desktop och mobil har varsin sekvens. Den tekniska bokningskonflikten och MCP:s nekade åtkomst visas inte av bilderna; de bevisas i integrationstesterna.

## Prova själv efter inspelningen

1. Kör `npm run dev -- --hostname 127.0.0.1`. Öppna `http://localhost:3000`.
2. Välj Fotvård, en vardag under kommande 60 dagar och Visa lediga tider. Välj en tid och använd `Testkund` / `testkund@example.test`. Bekräfta och kontrollera meddelandet.
3. Öppna `/admin`, logga in med det lokala lösenordet och kontrollera kund, tjänst och tid i agendan.
4. I en andra terminal, kör `npm run mcp:client -- --admin`. Detta skapar ett syntetiskt kampanjutkast i databasen. Ladda om admin och kontrollera tjänst, rabatt och datum. Klicka Publicera och ladda om bokningssidan.
5. Stoppa webbservern med Ctrl+C och databasen med `docker compose stop` om Compose används. Dina manuella testposter består tills du själv väljer att städa testmiljön.

Det är en lokal POC: individuella syntetiska adminer utan MFA, inga kundkonton, ingen avbokning, återbetalning eller automatisk rabattdebitering. Se [PROJECT_STATUS](PROJECT_STATUS.md) innan något tolkas som färdigt för kunder.

## Aktuell QA-inspelning

[Galleri 2026-11-11](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json): 2/2 PASS, 12 PNG, 2 WebM, produktionsbygge. Revisionen var ed1658a med arbetsändringar; den koden är nu 26ea617. Två representativa bilder visuellt granskade utan N-badge. Bekräftelsen visar tjänst, datum/tid och Europe/Stockholm; admin maskerar e-post och har Logga ut. Native datumfält följer fortfarande Chromium-miljöns format.

Git behöver inte finnas: manifestet använder då revision unknown och dirty null. Misslyckade steg skriver statiska koder: DEMO_CONFIG_INVALID, DEMO_DATABASE_UNAVAILABLE, DEMO_DATABASE_NOT_EMPTY_OR_SYNTHETIC, DEMO_BUILD_FAILED, DEMO_RECORDING_FAILED eller DEMO_OUTPUT_FAILED. Felaktiga/partiella inspelningar är inte godkända demos.

I den manuella demon visas ett publicerat erbjudande först på validFrom. Klientens exempel med nästa vecka kan därför finnas i admin men ännu inte på bokningssidan. Använd ett syntetiskt utkast med dagens Stockholm-datum om du vill prova publicering direkt. Välj högst 90 kalenderdagar. Vid bokning längre fram än14 dagar behöver adminfiltret ändras.
