<!-- POLISH_CURRENT_START -->
# Booking Lab SE — polerad salongsarbetsyta

Svensk agentredo boknings-POC med syntetiska uppgifter. Gemensam arbetsyta med
Översikt/Kalender/Kunder; Salongen och Konto samlar övriga befintliga funktioner.
Sidomeny på desktop, kompakt mobilnav. Webb och befintlig lokal MCP behåller samma
verksamhetsregler. Inga nya agentanslutningar eller produktmoduler i denna leverans.

[Skyddad demo](https://booking-lab-se-preview.vercel.app/admin) · [provsteg/bilder](docs/DEMO.md) ·
[tester](docs/VERIFICATION.md) · [status](docs/PROJECT_STATUS.md).
Vercel vid behov → Öppna demoadmin utan extra lösenord, endast isolerad demo.

Produkt/Grok/CI/deploy **9840309df4d8addc3e4bf5f6c5da0f3802eb4a2d**, branch **ui/salon-polish**.
106 unit/125 integration/13 kort/58 webb×4/lint/tsc/build PASS; [Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43529548681)4/4.
Grok scoped GO efter2 rättningsvarv. Fullaudit FAIL7 moderate dev, produktion 0.
FysiskSafari/ägaracceptans/pilot återstår. Main/PC-runtime är bevarade.
Senare dokumentation är ingen ny produktrevision. Lokala startinstruktioner nedan.
<!-- POLISH_CURRENT_END -->

## Bilaga — tidigare leveranser och resultat

<!-- COHERENT_CURRENT_START -->
# Booking Lab SE — bokning och salongens arbetsyta

Svensk, agentredo boknings-POC med en sammanhängande arbetsyta och helt syntetiska
uppgifter. Översikt, Kalender och Kunder är huvudval; Salongen samlar tjänster,
personal och kampanjer. Kundbokning och produktsida har tydliga egna ingångar.
Befintlig lokal MCP använder samma verksamhetsregler.

[Öppna skyddad demo](https://booking-lab-se-preview.vercel.app/admin) · [fem provflöden och bilder](docs/DEMO.md) ·
[status](docs/PROJECT_STATUS.md) · [testresultat](docs/VERIFICATION.md).
Vercel-inloggning vid behov, därefter Öppna demoadmin utan ett extra lösenord.

Produkt/Grok/CI/deploy: **51d54d4696dd5fee51449acbd096f8529fbd3c5c**, branch
**feature/coherent-salon-workspace**. Grok scoped GO efter ett rättningsvarv;
[Actions 43502629318](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43502629318)
har fyra gröna jobb med 54 webbtester vardera. Lokalt: 102 unit, 125 integration,
13 MCP-kort, lint/tsc/build PASS. Full audit **FAIL: 7 moderate dev**; omitdev 0.

Detta är en privat syntetisk POC. Fysisk iPhone/Safari och Niclas UX-godkännande
återstår; kundpilot är inte godkänd. Senare dokumentation ändrar inte produktkoden.
Befintlig PC-plugin/runtime är separat och bevarad. Lokala startinstruktioner och
tidigare leveransbevis finns nedan.
<!-- COHERENT_CURRENT_END -->

## Tidigare leveranser och bevis

# booking-lab-se

## Beständig agentbokning och ägarens arbetsdag — lokal syntetisk POC

Det lokala MCP-kortet kan nu återöppna kvitton, återuppta oklara försök och
hämta en kalenderfil. En separat läsprofil visar ägarens dag, nästa besök och
lediga tider. Vanlig skyddad admin används för ändringar. Samma privata
PC-plugin, version 0.3.0; inga nya beroenden eller externa tjänster.

Produkt och slutlig Grok-revision **05e5eaf**, branch
**feature/agent-booking-workday**. Grok GO för lokal syntetisk POC efter två
samlande rättningsvarv. 91 unit, 125 integration, 13 korttester och 48
webbtester i fyra lägen PASS; lokal dev0 behövde cacheåterställning efter
bevarade FAIL-körningar. Actions **43467138367** har fyra gröna jobb på samma
SHA. Full audit kvar på sju moderate dev, produktionsberoenden noll.

Två tidigare testbokningar och händelser är bevarade. Native-klickning av
de nya funktionerna, ägarprofilens hot-reload, fysisk iPhone/Safari och riktig
kalenderimport är inte verifierade. Ingen fjärr-MCP, molndeploy, mainmerge eller
kundpilot följer av detta. Nästa mål startas inte automatiskt.

[Prova och se bilder](docs/DEMO.md) · [resultat och ursprungliga fel](docs/VERIFICATION.md) ·
[Grok-original](docs/qa/QA-REPORT-agent-workday-f2-05e5eaf.md) · [godkänt scope](docs/AGENT_BOOKING_WORKDAY_PLAN.md).

## Tidigare bokningsprov

## Lokalt MCP-bokningskort till admin — verifierad syntetisk POC

Samma privata PC-plugin kan nu, vid separat lokal opt-in, skapa en testbokning
för en fast påhittad kund efter sammanfattning, kryssruta och uttrycklig
bekräftelse. Tappat svar återanvänder samma nyckel, upptagen tid ger nytt val.
Standardens läsläge består. Ingen publik MCP, betalning eller utskick.

Niclas har bokat i faktiska PC-kortet; två skilda tider verifierades som
2bokningar/2create-events/0överlapp och i vanlig skyddad admin i samma lokala
DB. Fysisk iPhone/Safari/mobilanslutning återstår. Produkt8126410 på
feature/mcp-card-booking-proof, Grok scopedGO (4Low/1Info,0Medium+).
85unit/113integration/3läs-UI/4boknings-UI/46webb×4,lint/tsc/build PASS.
Actions43430009174 har4gröna jobb efter1omkörning av ett gammalt testtimeout;
originalfelet bevaras och rotorsaken är inte fastställd. Audit separat7moderate
dev/0prod. Inga nya beroenden, migrationer eller ändringar i bokningsmotorn.
[Prova/status](docs/DEMO.md) · [plan](docs/MCP_CARD_BOOKING_PLAN.md) ·
[resultat/NOT RUN](docs/VERIFICATION.md) · [Grok-original](docs/qa/QA-REPORT-card-booking-8126410.md).
Ingen kundpilot, ny molndeploy eller mainmerge. Ingen ny epic startas automatiskt.

## Tidigare verifierade leveranser

## Kunddata och verkligt ägaragentprov — levererad syntetisk POC

[Öppna skyddade kundarbetsytan](https://booking-lab-se-preview.vercel.app/admin/customers).
Kundkort → Kunddata: begränsad export och uttryckligen bekräftad kontakt-
borttagning med bokningshistorik kvar. Kommande aktiva besök hanteras först.
Automatisk gallring av; inte full anonymisering eller komplett GDPR-utdrag.
Direkt Codex-MCP-prov läste kapacitet, sparade ett opublicerat utkast och
kontrollerade retry/stale efter vanlig webbåterbokning. MCP-provet är lokalt,
inte previewns databas. Ingen publik MCP eller ny modellanslutning.

Produkt95f8071, Grok-GO efter1fixvarv,79unit/99integration/46E2E×4 och4gröna
CIjobb. Full audit7moderate dev; prod0. [Prova/bilder/stopp](docs/DEMO.md) ·
[kommandon/NOT RUN](docs/VERIFICATION.md) · [faktiskt agentprov](docs/agent-proof/OWNER_AGENT_2026-11-13.md).
Fysisk iPhone/Safari och pilot är inte godkända. Senare docs/bilder ändrar ingen kod.

## Tidigare leverans: proaktiv kapacitetsöversikt

[Öppna den skyddade demon](https://booking-lab-se-preview.vercel.app/product),
välj arbetsytan och **Översikt**. Framtida avbokningar kontrolleras mot samma
bokningsmotor; öppna rätt kalenderdag, avfärda eller välj villkor och spara ett
beständigt kampanjutkast. Ingen automatisk publicering eller modellanslutning.
Tjänst+datum gäller alla bokningsbara tider/utförare, inte en exklusiv lucka.

Produkt-/QA-/deploykod8843d06.78unit/90integration/42E2E×4 och fyra CI-jobb PASS;
Grok-GO efter ett samlat fixvarv. Full audit har7moderate dev, prod0fynd.
[Provguide och riktiga bilder](docs/DEMO.md) · [faktiska kommandon/NOT RUN](docs/VERIFICATION.md).
Fysisk iPhone/Safari och kundpilot är inte godkända. Lokalt efter migrering/
grundseed på en separat \*\_demo: `BOOKING_DEMO_SEED=1 npm run demo:seed:capacity`.
Använd individuell lokal admin; previewns opt-in-demoinloggning är miljöbunden.
Ingen ny drift, extern MCP eller betald tjänst behövs för det lokala provet.

## Epic 06 — levererad skyddad syntetisk demo

[Öppna Booking Lab](https://booking-lab-se-preview.vercel.app/product) · [demoadmin](https://booking-lab-se-preview.vercel.app/admin) · [kundbokning](https://booking-lab-se-preview.vercel.app/).
Kod7c1407d är QA-/CI-godkänd för avgränsad demo. Vercel-inloggning vid behov,
sedan demoknapp utan extra lösenord. Inte kundpilot. [Prova och se riktiga bilder](docs/DEMO.md).

Öppna `/product` för produktöversikten, `/admin/customers` för kundregistret
och `/` för kundbokningen. Kundkort samlar kommande och tidigare besök;
Ny bokning och Boka återbesök tar med vald kund. Nuvarande kontaktuppgifter
och äldre bokningssnapshots hålls isär. Ingen automatisk sammanslagning eller
publik kundsökning via e-post. Rå kontakt syns bara i den uttryckligen aktiverade
isolerade demon; normal maskering och produktinloggning finns kvar.

`npm run demo:seed` kräver `BOOKING_DEMO_SEED=1` och separat loopback-databas
med suffix `_demo`. Seedningen är additiv och raderar inga manuella uppgifter.
Integrationstestet för riktig seed-CLI skapar och städar endast sin egen nya
slumpade loopback-databas; lokalt testkonto behöver därför CREATEDB. Ge aldrig
produktionskontot den rättigheten för tester.
Cloudflaggan `--preview` är endast för den befintliga pinnade operatörsmiljön.
[Plan och gränser](docs/EPIC_06_PLAN.md) · [aktuell leveransstatus](docs/PROJECT_STATUS.md)
· [preview och provsteg](docs/DEMO.md). All data är påhittad. Pilot är fortsatt NO-GO.

## Epic 05 — QA-godkänd lokal produktalpha

Den här branchen bygger på den godkända Epic04-POC:n. Migrera och seeda före start. Adminens huvudvy är nu en dag-/veckokalender med personalfilter; öppna ett bokningsblock för att flytta eller avboka, eller välj Ny bokning. Tjänster och Personal & tider har separata redigeringsvyer; tidigare kampanjflöde finns på `/admin/campaigns`. Endast syntetiska uppgifter. [Aktuell verifiering](docs/VERIFICATION.md) och [återstående godkänd omfattning](docs/EPIC_05_PLAN.md): MCP-paritet, ren installation/uppgraderingskopia och produktionsdemo är testade; Grok godkände4fc98d3 efter en avgränsad fix av adminens bokningsbudget; privat leveransc12b98a har grön fullmatris i Actions. [Exakt CI-bevis](docs/CI_DELIVERY_2026_11_12.md). [Stegvis provguide](docs/LOCAL_DEMO_WINDOWS.md). En separat [skyddad syntetisk mobilpreview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app) är verifierad på kod f2fdac7; Vercel-inloggning och individuell appadmin krävs. [Prova och stoppa preview](docs/DEMO.md). Fysisk iPhone/Safari återstår; ingen kundpilot.

## Epic 04 — individuell lokal adminåtkomst

Epic 04 är godkänd som lokal POC efter oberoende Grok-QA och en avgränsad limiterfix, produktkod471f91f. Separata syntetiska konton ersätter delat ADMIN_PASSWORD. Skapa konto med `npm run admin:manage -- create admin@example.test` efter migrering; välj eget testlösenord i den dolda terminalinmatningen. [Operatörsguide](docs/ADMIN_OPERATIONS.md) · [tekniskt beslut](docs/ADR_004_ADMIN_IDENTITY.md). Inga standardkonton skapas. Kund-e-post förblir maskerad; MFA saknas och pilot är fortsatt NO-GO. Aktuell verifiering: [VERIFICATION](docs/VERIFICATION.md).

## Epic 03 — godkänd lokal POC

Prisma CLI/klient/adapter är uppgraderade till exakt **7.10.1**. Samma startkommandon nedan gäller; PostgreSQL-klienten har en uttrycklig poolbudget och UTC-session. Inga historiska migrationer, bokningsregler eller produktfunktioner har ändrats. Lokal slutmatris på **18a4d73**: 51 unit, 31 integration ×3, 12 E2E ×4, lint/tsc/build/cleanup PASS. Full audit **FAIL: 7 måttliga, 0 höga**; produktionsaudit **PASS: 0 fynd**. Groks oberoende slutkontroll godkände 18a4d73 utan blockerande fynd; [slutrapport](docs/qa/QA-REPORT-epic03-18a4d73.md). [Beroende-/licensbeslut](docs/DEPENDENCY_REVIEW.md) · [Verifiering](docs/VERIFICATION.md) · [Morgonrapport](docs/MORNING_REPORT.md). **Endast syntetisk lokal POC; pilot fortsatt NO-GO.**

## Epic 02 — lokal agentbokning

En betrodd lokal MCP-klient kan nu skapa en syntetisk bokning via samma bokningsmotor som webben. Prova `npm run mcp:client -- --admin --book` efter lokal installation och bekräfta med `ja`; kontrollera sedan bokningen i `/admin`. Verktyget kräver separat opt-in, minimerar svaret och bevarar databasens integritetsregler. Ingen extern AI-modell behövs. [MCP-kontrakt och begränsningar](#lokal-syntetisk-agentbokning-epic-02).

Epic 02:s slutmatris på kod 3cd633b: 43 unit, 30 integration ×3 och 12 E2E i fyra lägen, lint/tsc/build/cleanup PASS. Grok verifierade samma matris på cad997b och **godkände Epic 02 som lokal POC**, utan blockerande fynd. Audit vid det tillfället: FAIL (3 höga/7 måttliga); aktuellt Epic 03-resultat står ovan. Slutdemo 4/4 PASS. **POC för syntetiska uppgifter, inte pilot**. [Aktuell status](docs/PROJECT_STATUS.md) · [Exakta resultat](docs/VERIFICATION.md) · [Slut-QA](docs/qa/QA-REPORT-epic02-cad997b.md) · [Demo](docs/DEMO.md).

## Uppföljning M2/L8 efter fixomgång 3

Samtidiga bokningar för samma anställd/dag serialiseras nu före tillgänglighetskontroll. Databasens överlappsskydd är kvar; lås-/serialiseringskonflikter från insert ger det befintliga svenska konfliktfelet. Proxykonfiguration avvisar även IPv6-subnät som annars skulle lita på IPv4-klienter (exempel ::/32).

CI kör ett dev/proxy0-jobb på kodändringar i feature-grenar, och hela fyrfältsmatrisen på main eller manuell Verify POC-körning. Dokumentationsändringar ignoreras; samma repos PR duplicerar inte push-jobbet. Slutleverans kräver fortsatt full matris för exakt levererad kodrevision. Separat veckoaudit rapporterar alla fynd men blockerar sitt eget jobb vid high/critical. Sju kända moderate är fortfarande ett rött full-audit-resultat, inte åtgärdade genom ändrad jobbfördelning. Veckoschemat blir aktivt först när dess workflow finns på default-branchen. Feature-pushen påc12b98a tog4m01s och en manuell slutmatris fick4gröna jobb med24E2E vardera; senare dokumentcommits ändrar ingen kod. Ingen merge/deploy sker automatiskt. [Faktisk verifiering och NOT RUN](docs/VERIFICATION.md).

En liten lokal, svensk boknings-POC för en fiktiv salong. Next.js, TypeScript, PostgreSQL/Prisma och lokal MCP över stdio. Endast syntetiska uppgifter. **Inte för produktion eller riktiga kunder.**

För produktägaren: [projektstatus och acceptanskriterier](docs/PROJECT_STATUS.md), [prova/spela in demo](docs/DEMO.md) och [senaste produktägarrapport](docs/PRODUCT_OWNER_REPORT.md). `npm run demo:record` skapar lokala bilder och video med befintliga Playwright-verktyg; ingen extern publicering.

## Starta lokalt

På den befintliga Windows-datorn finns även en [kort lokal demoguide](docs/LOCAL_DEMO_WINDOWS.md) för det separata syntetiska PostgreSQL-klustret. Den är inte en portabel installation och ersätter inte instruktionerna nedan.

Förutsättningar: Node.js 22.12 eller senare (alternativt 24 eller senare), npm och Docker med Compose. Port 5432 och 3000 måste vara lediga. I projektkatalogen:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Redigera .env: välj SESSION_SECRET (minst 32 slumpmässiga tecken).
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run admin:manage -- create admin@example.test
npm run dev
```

Öppna http://localhost:3000 och välj en vardag inom 60 dagar. Ny seed ger två syntetiska medarbetare: Anna måndag–fredag09–17 och Erik10–16 i Europe/Stockholm, med valbara tider på halvtimmar. Logga in via `/admin` med kontot du skapade lokalt. Seeds kan köras igen utan att skriva över redigerade tjänster, scheman eller bokningar. För egen Postgres, ändra `DATABASE_URL` i `.env`; databasanvändaren måste kunna skapa extensionen `btree_gist`. Lokala verifieringsmiljöer beskrivs i [verifieringsrapporten](docs/VERIFICATION.md). Compose-lösenordet gäller endast lokal demo. `docker compose stop` stoppar databasen och bevarar volymen.

## Bokningskvoter per kanal

Verifierad aktiv admin har en separat budget per konto: **100 nya bokningar per skapandedag i Stockholm**, och **60 försök per15minuter** per process. IP/e-postkundtaken används inte för admin, och adminbokningar förbrukar inte kundens kvot. Kundsidan behåller **5 per klient/skapandedag,3 per normaliserad e-post/skapandedag och30försök/15min**. Lokal MCP-bokning behåller **5 per betrodd lokal kanal/dag och3 per normaliserad e-post/dag**, med samma försöksskydd. Plus-taggar normaliseras. Identiska retries förbrukar ingen ny budget; avbokade rader räknas fortfarande som skapade. Adminkontext hämtas från aktiv serversession och kontrolleras på nytt före replay/skrivning; ett actor-fält eller en cookie på den publika vägen ger inget undantag. Befintliga för-fix-adminrader behåller sina lagrade kvotfält och kan påverka den gamla skapandedagens kundbudget tills dagen löper ut; ingen historik skrivs om.

## MCP

### Epic 05: lokal arbetsytegenomgång, under verifiering

Efter migrering/seed: `npm run mcp:client -- --admin --workspace`. Klienten visar varje syntetisk ändring och kräver ett nytt `ja` inför varje skrivning. Den skapar en provtjänst/utförare och bokning, flyttar/avbokar bokningen och inaktiverar provresurserna. Historiken ligger kvar för kontroll i admin. Vid nej/EOF stoppas genomgången; tidigare bekräftade ändringar ligger kvar. Vid tappat svar, kontrollera admin och den utskrivna åtgärdsnyckeln innan du gör ett nytt försök. Detta är ett lokalt testverktyg och inget bevis på mänskligt samtycke.

Manuell SDK-anslutning använder `node --env-file=.env --import tsx src/mcp/server.ts --admin --allow-workspace`. Nya begränsade läs-/skrivverktyg och deras svar finns i [verktygsmatrisen](docs/ARCHITECTURE.md). Ingen publik MCP-port. Äldre `--allow-bookings` ger inte rätt att flytta/avboka eller ändra tjänster/schema. Inga nya beroenden eller externa modellanslutningar. Äldre `list_bookings` behåller svarstypen men visar nu enbart aktiva bokningar med lagrat tjänstenamn; för status/version och avbokad historik används `list_workspace_bookings`/`get_booking`.

En betrodd lokal MCP-klient kan starta `node --env-file=.env --import tsx src/mcp/server.ts` i projektkatalogen. Standardläget erbjuder `list_services` och `get_availability`. Administratören kan uttryckligen lägga till argumentet `--admin`; då tillkommer `list_bookings` och `create_campaign_draft`. Ge endast betrodda lokala klienter adminläget: flaggan är en lokal behörighetsgräns, inte säker fjärrautentisering. Servern lyssnar inte på något nätverksuttag. Utkastet publiceras manuellt i administrationen.

Prova med den medföljande klienten:

```powershell
npm run mcp:client
npm run mcp:client -- --admin
```

### Lokal syntetisk agentbokning (Epic 02)

```powershell
npm run mcp:client -- --admin --book
```

Detta separata opt-in-läge visar Fotvård, en ledig tid i Europe/Stockholm och en syntetisk testkund. Skriv `ja` för att skapa bokningen; `nej` eller stängd standardindata avbryter utan skrivning. Bokningen syns sedan i `/admin`. Standardklienten bokar aldrig; enbart `--admin` behåller kampanjutkastflödet. Inget externt AI-API krävs.

MCP-serverns nya `create_booking` exponeras endast med **både** `--admin --allow-bookings`. Starten kräver en lokal SESSION_SECRET om minst 32 tecken för den befintliga HMAC-kvoten. Saknad adminflagga eller hemlighet stoppar skrivläget med statisk felkod. Endast betrodda lokala processer får dessa flaggor; detta är inte fjärrautentisering eller pilotstöd.

Verktyget kräver `serviceId`, `start` (ISO-instant med offset), `customerName`, `customerEmail` (endast `example.test`), `clientRequestId` (1–64 tecken, samma regel som HTTP:s idempotensnyckel) och `confirmed: true`. Okända fält nekas. `confirmed` är klientens försäkran, inte tekniskt bevis på en människas godkännande. Använd samma nyckel och uppgifter vid retry; ändrade uppgifter kräver ny nyckel. Nycklar delar samma befintliga namnrymd som HTTP inom demosalongen.

Svaret innehåller endast `id`, `serviceId`, `startsAt`, `endsAt` i UTC. Samma domänmotor, överlappsskydd, idempotens och dagstak används som i webben. Den lokala MCP-kanalen har **ett gemensamt tak på fem nya bokningar per skapandedag i Stockholm**, även efter processomstart, samt tre per e-postnyckel. Det är ett avsiktligt begränsat testläge, inte individuella agentkvoter. Replays förbrukar ingen ny kvot. Ingen klientstyrd IP/kvotidentitet accepteras.

Protokollbegränsningar från slut-QA: SDK:n tar bort ett rått eget `__proto__`-fält före verktygets strikta validering; ingen prototypförorening observerades. Felaktiga anropshöljen där `arguments` inte är ett objekt ger SDK:ns protokollfel, inte verktygets statiska feltext. `ja` kan matas via pipe, så testklientens bekräftelse är inte bevis på mänsklig granskning. Dessa dokumenterade POC-begränsningar ändrar inte flagg-/domänkontrollerna.

`list_bookings` i adminläge kräver nu `from` och `to` som inkluderande datum `YYYY-MM-DD` i Europe/Stockholm, högst 31 kalenderdagar. `limit` är valfri (standard 20, max 100) och `cursor` är valfri. Exempel på argument:

```json
{ "from": "2026-11-16", "to": "2026-11-22", "limit": 20 }
```

Svaret har `bookings` och `nextCursor`. Varje bokning innehåller bara `id`, `startsAt`, `endsAt` och tjänstens `id`/`name`, aldrig kundnamn eller e-post. Använd `nextCursor` som `cursor` med samma datumintervall för nästa sida; `null` betyder sista sidan. Endast bokningar vars **start** ligger inom datumintervallet räknas. Tiderna i svaret är UTC. Sidmarkören måste fortfarande finnas i den aktuella verksamheten och intervallet; om den tagits bort får klienten börja om. Pagineringen ger ingen fryst ögonblicksbild vid samtidiga ändringar. ID, tid och tjänst kan fortfarande vara personuppgifter.

Detta är en avsiktlig brytande ändring: tidigare `list_bookings` utan argument och fullständiga kundposter fungerar inte längre. Ingen funktion för utlämning av kunduppgifter finns i MCP. `--admin` är fortsatt bara ett lokalt förtroendeläge, inte fjärrautentisering.

Det andra kommandot skapar ett riktigt utkast i demodatabasen. MCP använder strukturerade argument, exempelvis `serviceId: "fotvard"`, `discountPercent: 20`, `validFrom: "2026-11-16"` och `validUntil: "2026-11-22"`. Agenten ansvarar för att tolka exempelvis ”nästa vecka” till datum; servern validerar fälten och publicerar aldrig automatiskt.

## Kontrollera

```powershell
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

Integration och Playwright kräver en migrerad, seedad separat databas och `.env`. Testgrinden tillåter bara localhost/127.0.0.1/::1 och databasnamn som slutar med `_test` eller `_demo`; testerna skapar och tar bort sina egna syntetiska poster. Kör aldrig testerna mot produktionsdata. E2E startar en lokal Next-server på port 3000. Integrationstestet provar konkurrerande förfrågningar och en direkt insättning mot databasspärren. Enhetstester täcker sommartid/vintertid och datumvalidering.

## Avgränsningar

Admininloggningen är en minimal lokal lösning med socketbaserad processlokal spärr, serveråterkallad logout och global sessionsversion, med individuella syntetiska konton och lokal lösenordsåterställning, men utan MFA, webbaserad recovery eller revisionslogg. Endast stdio-processens ägare bestämmer MCP-adminläget. Delade cookies, tenant-isolering, HTTPS, säker konfiguration, missbruksskydd, tillgänglighet, integritet och säkerhetsgranskning krävs inför verklig drift. Den signerade cookien kräver HTTPS i `NODE_ENV=production`; kör `npm run dev` för lokalt HTTP. Pris och erbjudande är information, ingen debitering. Översättningsförberedelsen är begränsad: några texter ligger i `src/lib/i18n.ts`, men flertalet är ännu svenska i komponenterna. Kalendern är en kronologisk agenda, inte en fullständig veckovy.

[Omfattning](docs/POC_SCOPE.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Tekniska principer](docs/ENGINEERING_PRINCIPLES.md) · [Underhållsgranskning](docs/MAINTENANCE_REVIEW.md) · [Licens- och projektgranskning](docs/OPEN_SOURCE_REVIEW.md) · [Verifiering](docs/VERIFICATION.md) · [Bidra](CONTRIBUTING.md)

Projektets egen kod är AGPL-3.0-only, se [LICENSE](LICENSE). Paket och tillgångar har egna licenser. Före distribution eller nätverksdrift måste licensuppfyllelse och ett fungerande erbjudande om motsvarande källkod för den körda versionen ordnas; se granskningen.

## Historik — verifiering av Epic 01 QA batch 3

Bas `056d0c2`, branch `epic-01-foundation-hardening`. Fixpunkter 1–5 samt små förbättringar i punkt 6; Visa e-post är fortsatt undantagen. Inga nya beroenden eller migrationer. Endast lokala commits i denna omgång, ingen push eller merge. Aktuella kommandon, resultat och felhistorik: [VERIFICATION](docs/VERIFICATION.md).

Audit-fynden kvarstår i Prisma/config/deepmerge-ts och ESLint-kedjan. [Separat Prisma 7-plan](docs/PRISMA_7_PLAN.md). GitHub Actions test-/byggjobb för föregående `056d0c2` har verifierats grönt, dess audit-jobb rött. Den lokala batch 3-revisionen har inte körts i extern CI. Verklig TLS/proxydrift återstår.

## HTTP-start och betrodda proxyadresser

`npm run dev` och `npm run start` använder `scripts/server.mjs`, en liten Node-startpunkt runt samma Next-app. Den läser socketens remoteAddress och skriver över interna, signerade adressheaders. Nexts route-objekt exponerar inte socketadressen. **Använd dessa npm-kommandon, inte direkt next dev/next start.** Utan verifierad intern adress nekas bokning/login; ingen global reservbucket finns. Produktionsläget använder kompilerad Next med dev:false. Ingen extra tjänst eller npm-dependency.

TRUST_PROXY_IP=0 är standard: verklig socketadress används och X-Real-IP ignoreras. TRUST_PROXY_IP=1 kräver TRUSTED_PROXY_IPS, en kommaseparerad IP/CIDR-lista. Saknad/ogiltig lista stoppar starten. X-Real-IP används bara när anslutande socket matchar listan. Proxyn måste själv skriva över headern med faktisk klientadress. Lista aldrig hela internet eller vanliga klientnät som betrodda. Testerna simulerar proxy med en separat verklig loopback-källadress, 127.0.0.10/32; detta är ingen driftskonfiguration. BOOKING_ADDRESS_SECRET genereras internt vid start och ska inte konfigureras eller delas.

Fem felaktiga login per klient/15 minuter. Därefter nekas alla försök med 429 innan lösenordet kontrolleras, även korrekt lösenord. Felaktiga och spärrade svar fördröjs minst 100 ms asynkront. Andra klienter kan fortfarande logga in; delad NAT delar spärren. Bokningsförsök begränsas till 30 per adress/15 minuter. Vid 10 000 buckets evikteras äldsta posten i stället för att spärra nya klienter. Räknarna är processlokala; omstart och flera processer kräver andra driftkontroller.

## Bokning, sessioner och kampanjer

- Tre nya bokningar per e-postnyckel och skapandedag i Stockholm. Nyckeln använder gemener utan +tagg; kontaktadressen behåller taggen. Detta är en POC-regel, inte universell e-postidentitet. Inga leverantörsspecifika punktregler eller e-postverifiering.
- Fem nya bokningar per verifierad klientidentitet (IPv4-adress eller IPv6-/64) och skapandedag, även med olika e-postadresser. HMAC lagras som clientKey, inte rå IP. Transaktionslås säkrar båda taken. Användare bakom samma NAT delar taket; olika IP kan kringgå det. Det är inte pilotsäkert identitetsskydd.
- Valfri Idempotency-Key, 1–64 tecken [A-Za-z0-9_-]. Samma nyckel/payload ger ursprunglig 201/ID utan att förbruka försöksbudget eller dagstak. Annan payload ger 409 och räknas som försök. UI återanvänder UUID vid retry/dubbelsubmit för samma payload, men nyckeln överlever inte sidomladdning. Servernycklar lever med bokningen.
- Logout sätter revokedAt i AdminSession innan cookien raderas. Kopierad cookie nekas efter logout. DB lagrar tokenhash och skapande/utgång/återkallelsetid. Gamla cookies slutar fungera. ADMIN_SESSION_VERSION är global kill switch: höj och starta om alla instanser; återanvänd inte gamla värden. Vid lyckad inloggning gallras högst 100 utgångna eller återkallade sessioner. Utan nya inloggningar körs ingen gallring. ADMIN_SESSION_VERSION får bara höjas: sänkning kan återaktivera äldre, ännu aktiva sessioner. Individuella konton saknas.
- Admin visar idag till idag+14 inklusive, max 31 dagar/100 rader per sida. Felaktiga datumfilter ger svensk text och standardintervall, inte 500. E-post förblir maskerad. Datum anges YYYY-MM-DD i textfält med validering; kalenderpopupen är ersatt.
- Kampanjer visas endast inom giltiga Stockholmsdatum, högst 90 inkluderande kalenderdagar. Omvända datum och för lång period har olika meddelanden. **100 % rabatt tillåts** i informations-POC:n; ingen betalning/debitering görs. Kommersiella regler måste beslutas före pilot.

## Reproducera testerna

Skapa en ny lokal \*\_test-databas, exempelvis med `docker compose exec db createdb -U booking booking_lab_test`, och peka lokal .env på den. Bevara befintliga databaser. Alternativet är separat lokal PostgreSQL; denna körning använde PostgreSQL 18.6. Kör npm ci, prisma generate, migration och seed enligt startanvisningen.

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:CHECKPOINT_DISABLE='1'
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
npm run build
$env:E2E_PRODUCTION='1'
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
Remove-Item Env:TRUST_PROXY_IP
node --env-file=.env scripts/test-cleanup.mjs
npm audit
```

Alternativt `npm run test:e2e:production` bygger och kör hela produktionssviten. Cleanup-proben framkallar avsiktlig timeout i separat Playwright och godkänner endast förväntad exit 1 plus noll kvarvarande syntetiska bokningar/kampanjer. Kör bara en QA-omgång i taget mot samma miljö/port. Fixture-städning klarar timeout när DB är tillgänglig, inte processkill, strömavbrott eller DB-avbrott.

MCP-klienter skickar explicit förälderns DATABASE_URL; exporterad miljö vinner över env-filen. Ett integrationstest pekar env-filen på en annan oanvändbar databas och bevisar att utkastet hamnar i exporterad testdatabas.

[Tredjepartsnotiser](THIRD_PARTY_NOTICES.md) · [Datakarta](docs/DATA_FLOWS.md) · [Handoff](docs/HANDOFF.md)

### Driftmatris och varning efter QA batch 3

| Anslutning                                        | Konfiguration                                | Identitet och krav                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direkt till Node                                  | `TRUST_PROXY_IP=0`                           | Verklig socket; inkommande forwarding ignoreras och ger en statisk varning en gång.                                                                      |
| Betrodd proxy                                     | `TRUST_PROXY_IP=1`, snäv `TRUSTED_PROXY_IPS` | Proxyn måste skriva över `X-Real-IP` med faktisk klientadress. Begränsa även nätåtkomsten till Node.                                                     |
| Proxy med standardläge eller bara X-Forwarded-For | Felkonfiguration                             | Alla delar proxyns identitet, spärr och bokningstak. `PROXY_CLIENT_IDENTITY_COLLAPSED` varnar en gång, utan IP eller headerinnehåll. Åtgärda före drift. |

Proxylistan avvisar IPv4-prefix kortare än /8 och IPv6-prefix kortare än /32. Dessa gränser innebär inte att stora tillåtna nät är lämpliga; lista endast de verkliga proxyadresserna. IPv6-klienters /64 används för både inloggningsspärr och bokningstak; rå adress används fortfarande för att kontrollera betrodd proxy. IPv4-mappad IPv6 normaliseras till IPv4. Gammal IPv6-/128-bokningshistorik räknas inte retroaktivt mot /64-taket. Inga historiska migrationer ändras.

Test- och demovakten avvisar även `host`/`hostaddr` i URL-parametrar före databasåtkomst. E2E-fixturer tar bort sina egna sessionshashar, även efter timeout, men är inte en generell datagallring.

## Agent API v1 (read-only sandbox)

A small, versioned HTTP API so AI agents can read services and available times
from the synthetic demo salon. It reuses the booking engine's own availability
logic (`getAvailability`); nothing is booked. Spec:
[`docs/agent-api-v1.openapi.yaml`](docs/agent-api-v1.openapi.yaml).

Every key is tied to one business, a named agent and a responsible person.
Only a SHA-256 digest of the key is stored; the key is printed once.

```bash
npm run db:migrate && npm run db:seed
npm run agent-keys -- create --agent "My test agent" --owner "Jane Doe" --contact "jane@example.test"
npm run agent-keys -- list
npm run agent-keys -- revoke blk_<prefix>
```

```bash
KEY=blk_...   # printed once by the create command
curl -s -H "Authorization: Bearer $KEY" "http://localhost:3000/api/v1/services?business=demo"
curl -s -H "X-API-Key: $KEY" \
  "http://localhost:3000/api/v1/availability?business=demo&service=fotvard&date=2026-11-16"
```

```json
{
  "apiVersion": "v1",
  "business": { "id": "demo", "name": "Booking Lab demo salon (synthetic)", "timeZone": "Europe/Stockholm" },
  "service": { "id": "fotvard", "name": "Fotvård", "durationMinutes": 60, "bufferMinutes": 0,
    "price": { "amountMinor": 65000, "currency": "SEK" }, "version": 1,
    "staff": [{ "id": "staff-demo", "name": "Anna" }, { "id": "staff-erik", "name": "Erik" }] },
  "range": { "from": "2026-11-16", "to": "2026-11-16", "timeZone": "Europe/Stockholm" },
  "slots": [
    { "start": "2026-11-16T09:00:00+01:00", "end": "2026-11-16T10:00:00+01:00", "durationMinutes": 60,
      "serviceId": "fotvard", "serviceVersion": 1, "staff": { "id": "staff-demo", "name": "Anna" } }
  ]
}
```

Errors are always `{ "apiVersion": "v1", "error": { "code": "...", "message": "..." } }`
(`unauthorized` 401, `forbidden_scope` / `forbidden_business` 403, `*_not_found` 404,
`invalid_request` / `range_too_large` 400, `rate_limited` 429). A key can only read
its own business. Limit: 300 requests per key per 15 minutes. Use `date`, or
`from`/`to` (max 14 days). Not in v1: creating, moving or cancelling bookings,
booking status, MCP over HTTP/OAuth.
